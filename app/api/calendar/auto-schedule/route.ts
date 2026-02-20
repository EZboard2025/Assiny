import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchUpcomingMeetEvents } from '@/lib/google-calendar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RECALL_API_KEY = process.env.RECALL_API_KEY!
const RECALL_REGION = process.env.RECALL_API_REGION || 'us-west-2'
const CRON_SECRET = process.env.CRON_SECRET

export async function POST(request: NextRequest) {
  try {
    // Auth: validate cron secret
    const cronSecret = request.headers.get('x-cron-secret')
    if (CRON_SECRET && cronSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'schedule'

    if (action === 'sync') {
      return await handleSync()
    }

    return await handleSchedule()
  } catch (error: any) {
    console.error('[Auto-Schedule] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Auto-schedule failed' },
      { status: 500 }
    )
  }
}

/**
 * Schedule bots for meetings starting in the next 5 minutes
 */
async function handleSchedule() {
  const now = new Date()
  const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000)

  // Find enabled meetings with pending status starting soon
  const { data: upcomingMeetings, error } = await supabaseAdmin
    .from('calendar_scheduled_bots')
    .select('*, google_calendar_connections!calendar_scheduled_bots_calendar_connection_id_fkey(user_id, status, auto_record_enabled)')
    .eq('bot_enabled', true)
    .eq('bot_status', 'pending')
    .gte('event_start', now.toISOString())
    .lte('event_start', fiveMinLater.toISOString())

  if (error) {
    console.error('[Auto-Schedule] DB query error:', error)
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 })
  }

  let scheduled = 0
  let errors = 0

  for (const meeting of upcomingMeetings || []) {
    try {
      // Skip if calendar connection is not active or auto-record is disabled
      const conn = meeting.google_calendar_connections
      if (conn && conn.status !== 'active') continue
      if (conn && conn.auto_record_enabled === false) continue

      // Create Recall.ai bot for this meeting
      const botResponse = await createRecallBot(meeting.meet_link, meeting.user_id, meeting.company_id)

      if (botResponse.botId) {
        // Update scheduled bot with Recall bot ID
        await supabaseAdmin
          .from('calendar_scheduled_bots')
          .update({
            bot_id: botResponse.botId,
            bot_status: 'scheduled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', meeting.id)

        scheduled++
        console.log(`[Auto-Schedule] Bot created for "${meeting.event_title}" (${meeting.meet_link})`)
      } else {
        throw new Error(botResponse.error || 'Failed to create bot')
      }
    } catch (err: any) {
      errors++
      console.error(`[Auto-Schedule] Failed for meeting ${meeting.id}:`, err.message)
      await supabaseAdmin
        .from('calendar_scheduled_bots')
        .update({
          bot_status: 'error',
          error_message: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', meeting.id)
    }
  }

  // Also clean up stale scheduled bots (started 30+ min ago, still "scheduled")
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000)
  await supabaseAdmin
    .from('calendar_scheduled_bots')
    .update({
      bot_status: 'error',
      error_message: 'Bot timed out (never joined)',
      updated_at: new Date().toISOString(),
    })
    .eq('bot_status', 'scheduled')
    .lt('event_start', thirtyMinAgo.toISOString())

  return NextResponse.json({
    success: true,
    action: 'schedule',
    scheduled,
    errors,
    checked: (upcomingMeetings || []).length,
  })
}

/**
 * Sync calendar events for all active connections
 */
async function handleSync() {
  // Fetch all active connections
  const { data: connections, error } = await supabaseAdmin
    .from('google_calendar_connections')
    .select('user_id, id, status, auto_record_enabled')
    .eq('status', 'active')
    .neq('auto_record_enabled', false)

  if (error || !connections) {
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
  }

  let synced = 0
  let syncErrors = 0

  for (const conn of connections) {
    try {
      const events = await fetchUpcomingMeetEvents(conn.user_id, 7)
      if (!events) continue

      // Get company_id
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('company_id')
        .eq('user_id', conn.user_id)
        .single()

      if (!employee) continue

      for (const event of events) {
        // Upsert — only update event details, not bot_enabled or bot_status
        const { data: existing } = await supabaseAdmin
          .from('calendar_scheduled_bots')
          .select('id')
          .eq('user_id', conn.user_id)
          .eq('google_event_id', event.id)
          .single()

        if (!existing) {
          await supabaseAdmin
            .from('calendar_scheduled_bots')
            .insert({
              user_id: conn.user_id,
              company_id: employee.company_id,
              calendar_connection_id: conn.id,
              google_event_id: event.id,
              event_title: event.title,
              event_start: event.start,
              event_end: event.end,
              meet_link: event.meetLink,
              attendees: event.attendees,
              bot_enabled: true,
              bot_status: 'pending',
            })
        } else {
          await supabaseAdmin
            .from('calendar_scheduled_bots')
            .update({
              event_title: event.title,
              event_start: event.start,
              event_end: event.end,
              meet_link: event.meetLink,
              attendees: event.attendees,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        }
      }

      synced++
    } catch (err: any) {
      syncErrors++
      console.error(`[Auto-Schedule Sync] Error for user ${conn.user_id}:`, err.message)
    }
  }

  return NextResponse.json({
    success: true,
    action: 'sync',
    synced,
    syncErrors,
    totalConnections: connections.length,
  })
}

/**
 * Create a Recall.ai bot directly (same as /api/recall/create-bot but internal)
 */
async function createRecallBot(meetingUrl: string, userId: string, companyId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  try {
    const response = await fetch(`https://${RECALL_REGION}.recall.ai/api/v1/bot/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: 'Ramppy Análise',
        transcription_options: {
          provider: 'deepgram',
          deepgram: {
            model: 'nova-3',
            language: 'pt-BR',
            diarize: true,
          },
        },
        real_time_transcription: {
          destination_url: `${appUrl}/api/recall/webhook`,
          partial_transcripts: true,
        },
        automatic_leave: {
          waiting_room_timeout: 600,
          noone_joined_timeout: 600,
          everyone_left_timeout: 30,
        },
        chat: {
          on_bot_join: {
            send_to: 'everyone',
            message: '🎙️ Ramppy está gravando e transcrevendo esta reunião.',
          },
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Recall.ai error ${response.status}: ${errorText}`)
    }

    const data = await response.json()

    // Save bot session for webhook processing (same as create-bot route)
    await supabaseAdmin
      .from('meet_bot_sessions')
      .insert({
        bot_id: data.id,
        user_id: userId,
        company_id: companyId,
        meeting_url: meetingUrl,
        status: 'created',
        recall_status: 'ready',
      })

    return { botId: data.id }
  } catch (err: any) {
    console.error('[Auto-Schedule] Recall.ai bot creation failed:', err.message)
    return { botId: null, error: err.message }
  }
}
