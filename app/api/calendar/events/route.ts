import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchUpcomingMeetEvents, fetchAllEvents } from '@/lib/google-calendar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get company_id
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Check calendar connection
    const { data: connection } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('id, status')
      .eq('user_id', user.id)
      .single()

    if (!connection || connection.status !== 'active') {
      return NextResponse.json({ error: 'Calendar not connected', events: [] }, { status: 200 })
    }

    // Check view param: ?view=all fetches ALL events, default fetches only Meet events
    const { searchParams } = new URL(request.url)
    const viewAll = searchParams.get('view') === 'all'

    // Fetch events from Google Calendar (30 days to support week navigation)
    const daysAhead = parseInt(searchParams.get('days') || '30')
    const calendarEvents = viewAll
      ? await fetchAllEvents(user.id, daysAhead)
      : await fetchUpcomingMeetEvents(user.id, daysAhead)

    if (!calendarEvents) {
      return NextResponse.json({ error: 'Failed to fetch calendar events', events: [] }, { status: 200 })
    }

    console.log(`[Calendar Events] Fetched ${calendarEvents.length} events for user ${user.id} (${daysAhead} days ahead)`)

    // Upsert events into calendar_scheduled_bots (only for events with Meet links)
    const enrichedEvents = []

    for (const event of calendarEvents) {
      const hasMeet = !!event.meetLink

      if (hasMeet) {
        // Upsert: create if not exists, don't overwrite bot_enabled or bot_status
        const { data: existing } = await supabaseAdmin
          .from('calendar_scheduled_bots')
          .select('*')
          .eq('user_id', user.id)
          .eq('google_event_id', event.id)
          .single()

        if (!existing) {
          // New event — insert with defaults (bot_enabled: true, bot_status: pending)
          const { data: inserted } = await supabaseAdmin
            .from('calendar_scheduled_bots')
            .insert({
              user_id: user.id,
              company_id: employee.company_id,
              calendar_connection_id: connection.id,
              google_event_id: event.id,
              event_title: event.title,
              event_start: event.start,
              event_end: event.end,
              meet_link: event.meetLink,
              attendees: event.attendees,
              bot_enabled: true,
              bot_status: 'pending',
            })
            .select()
            .single()

          enrichedEvents.push({
            ...event,
            botEnabled: true,
            botStatus: 'pending',
            botId: null,
            evaluationId: null,
            scheduledBotId: inserted?.id || null,
          })
        } else {
          // Existing — update event details (title, time, attendees may change)
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

          enrichedEvents.push({
            ...event,
            botEnabled: existing.bot_enabled,
            botStatus: existing.bot_status,
            botId: existing.bot_id,
            evaluationId: existing.evaluation_id,
            scheduledBotId: existing.id,
          })
        }
      } else {
        // No Meet link — just pass through without bot info
        enrichedEvents.push({
          ...event,
          botEnabled: false,
          botStatus: null,
          botId: null,
          evaluationId: null,
          scheduledBotId: null,
        })
      }
    }

    // Also fetch past events that have evaluations (completed in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentCompleted } = await supabaseAdmin
      .from('calendar_scheduled_bots')
      .select('*, meet_evaluations!calendar_scheduled_bots_evaluation_id_fkey(overall_score, performance_level)')
      .eq('user_id', user.id)
      .eq('bot_status', 'completed')
      .gte('event_start', sevenDaysAgo)
      .lt('event_start', new Date().toISOString())
      .order('event_start', { ascending: false })
      .limit(10)

    const pastEvents = (recentCompleted || []).map(e => ({
      id: e.google_event_id,
      title: e.event_title,
      start: e.event_start,
      end: e.event_end,
      meetLink: e.meet_link,
      attendees: e.attendees || [],
      organizer: null,
      description: null,
      botEnabled: e.bot_enabled,
      botStatus: e.bot_status,
      botId: e.bot_id,
      evaluationId: e.evaluation_id,
      scheduledBotId: e.id,
      evaluation: e.meet_evaluations || null,
    }))

    return NextResponse.json({
      events: enrichedEvents,
      pastEvents,
    })
  } catch (error: any) {
    console.error('[Calendar Events] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch events' },
      { status: 500 }
    )
  }
}
