import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

    // Date range for calendar view (3 months back, 3 months ahead)
    const rangeStart = new Date()
    rangeStart.setMonth(rangeStart.getMonth() - 3)
    const rangeEnd = new Date()
    rangeEnd.setMonth(rangeEnd.getMonth() + 3)

    // Fetch all calendar data in parallel
    const [connectionRes, allEventsRes, completedRes] = await Promise.all([
      // 1. Google Calendar connection status
      supabaseAdmin
        .from('google_calendar_connections')
        .select('google_email, status')
        .eq('user_id', sellerId)
        .single(),

      // 2. All calendar events (for week view + upcoming list)
      supabaseAdmin
        .from('calendar_scheduled_bots')
        .select('id, event_title, event_start, event_end, meet_link, attendees, bot_enabled, bot_status, evaluation_id')
        .eq('user_id', sellerId)
        .gte('event_start', rangeStart.toISOString())
        .lte('event_start', rangeEnd.toISOString())
        .order('event_start', { ascending: true })
        .limit(200),

      // 3. Completed meetings with evaluation (for title enrichment of meet_evaluations)
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

    // Build all calendar events (for week view)
    const now = new Date().toISOString()
    const allEvents = (allEventsRes.data || []).map((m: any) => ({
      id: m.id,
      eventTitle: m.event_title || 'Reuniao sem titulo',
      eventStart: m.event_start,
      eventEnd: m.event_end,
      meetLink: m.meet_link,
      attendees: m.attendees || [],
      botEnabled: m.bot_enabled,
      botStatus: m.bot_status,
      evaluationId: m.evaluation_id,
    }))

    // Derive upcoming meetings (future + active status)
    const upcomingMeetings = allEvents.filter((m: any) =>
      m.eventStart >= now && ['pending', 'scheduled', 'joining', 'recording'].includes(m.botStatus)
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
