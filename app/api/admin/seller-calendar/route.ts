import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { fetchAllEvents } from '@/lib/google-calendar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const companyId = request.headers.get('x-company-id')
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')
    if (!sellerId) {
      return NextResponse.json({ error: 'sellerId is required' }, { status: 400 })
    }

    // Verify seller belongs to this company
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('user_id')
      .eq('user_id', sellerId)
      .eq('company_id', companyId)
      .single()

    if (!employee) {
      return NextResponse.json({ error: 'Seller not found in company' }, { status: 404 })
    }

    // Fetch connection status + Google Calendar events + bot data in parallel
    const [connectionRes, googleEvents, botsRes, completedRes] = await Promise.all([
      // 1. Google Calendar connection status
      supabaseAdmin
        .from('google_calendar_connections')
        .select('google_email, status')
        .eq('user_id', sellerId)
        .single(),

      // 2. ALL events from Google Calendar API (not just Meet)
      fetchAllEvents(sellerId, 90),

      // 3. Bot data from DB (for bot status enrichment)
      supabaseAdmin
        .from('calendar_scheduled_bots')
        .select('google_event_id, bot_enabled, bot_status, evaluation_id')
        .eq('user_id', sellerId),

      // 4. Completed meetings with evaluation (for meet_evaluations title enrichment)
      supabaseAdmin
        .from('calendar_scheduled_bots')
        .select('evaluation_id, event_title, event_start, meet_link')
        .eq('user_id', sellerId)
        .not('evaluation_id', 'is', null)
        .order('event_start', { ascending: false })
        .limit(50),
    ])

    // Build connection status
    const conn = connectionRes.data
    const connection = {
      connected: !!conn && (conn.status === 'active' || conn.status === 'expired'),
      googleEmail: conn?.google_email || null,
    }

    // Build bot status map (google_event_id -> bot info)
    const botMap = new Map<string, { botEnabled: boolean; botStatus: string; evaluationId: string | null }>()
    for (const bot of botsRes.data || []) {
      botMap.set(bot.google_event_id, {
        botEnabled: bot.bot_enabled,
        botStatus: bot.bot_status,
        evaluationId: bot.evaluation_id,
      })
    }

    // Map Google Calendar events, enriching with bot data where available
    const now = new Date().toISOString()
    const allEvents = (googleEvents || []).map((e) => {
      const bot = botMap.get(e.id)
      return {
        id: e.id,
        eventTitle: e.title,
        eventStart: e.start,
        eventEnd: e.end,
        meetLink: e.meetLink || '',
        attendees: e.attendees || [],
        botEnabled: bot?.botEnabled ?? false,
        botStatus: bot?.botStatus ?? (e.meetLink ? 'pending' : null),
        evaluationId: bot?.evaluationId ?? null,
      }
    })

    // Derive upcoming meetings (future events with Meet links + active bot status)
    const upcomingMeetings = allEvents.filter((m) =>
      m.eventStart >= now && m.meetLink && ['pending', 'scheduled', 'joining', 'recording'].includes(m.botStatus || '')
    )

    // Build completed meetings map (evaluationId -> calendar info)
    const completedMeetings = (completedRes.data || [])
      .filter((m: any) => m.evaluation_id)
      .map((m: any) => ({
        evaluationId: m.evaluation_id,
        eventTitle: m.event_title || null,
        eventStart: m.event_start,
        meetLink: m.meet_link,
      }))

    return NextResponse.json({
      connection,
      allEvents,
      upcomingMeetings,
      completedMeetings,
    })
  } catch (error: any) {
    console.error('[Seller Calendar] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
