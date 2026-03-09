import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Lightweight endpoint for desktop app to poll for upcoming meetings
// Returns the next meeting with a Meet link starting within the next X minutes
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const minutesAhead = parseInt(request.nextUrl.searchParams.get('minutes') || '5')

    const now = new Date()
    const soon = new Date(now.getTime() + minutesAhead * 60 * 1000)

    // Find the next meeting starting within the window that has a meet link
    const { data: meeting, error } = await supabaseAdmin
      .from('calendar_scheduled_bots')
      .select('id, event_title, event_start, event_end, meet_link, attendees, bot_enabled, bot_status')
      .eq('user_id', user.id)
      .not('meet_link', 'is', null)
      .gte('event_start', now.toISOString())
      .lte('event_start', soon.toISOString())
      .order('event_start', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Failed to query' }, { status: 500 })
    }

    if (!meeting) {
      return NextResponse.json({ meeting: null })
    }

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        title: meeting.event_title || 'Reuniao',
        start: meeting.event_start,
        end: meeting.event_end,
        meetLink: meeting.meet_link,
        attendees: meeting.attendees,
        botEnabled: meeting.bot_enabled,
        botStatus: meeting.bot_status,
        minutesUntil: Math.round((new Date(meeting.event_start).getTime() - now.getTime()) / 60000),
      },
    })
  } catch (error: any) {
    console.error('[Next Meeting] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
