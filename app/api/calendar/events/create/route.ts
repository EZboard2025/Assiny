import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createCalendarEvent, hasWriteScopes } from '@/lib/google-calendar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
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

    // Check connection + write scopes
    const { data: connection } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('id, scopes, status')
      .eq('user_id', user.id)
      .single()

    if (!connection || connection.status !== 'active') {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 })
    }

    if (!hasWriteScopes(connection.scopes)) {
      return NextResponse.json({ error: 'Write access required. Please reauthorize.' }, { status: 403 })
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

    const body = await request.json()
    const { title, startDateTime, endDateTime, description, attendees, addMeetLink } = body

    if (!title || !startDateTime || !endDateTime) {
      return NextResponse.json({ error: 'title, startDateTime, and endDateTime are required' }, { status: 400 })
    }

    const event = await createCalendarEvent(user.id, {
      title,
      startDateTime,
      endDateTime,
      description,
      attendees,
      addMeetLink: addMeetLink !== false, // default true
    })

    if (!event) {
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
    }

    // If event has Meet link, auto-create scheduled bot entry
    if (event.meetLink) {
      await supabaseAdmin
        .from('calendar_scheduled_bots')
        .upsert(
          {
            user_id: user.id,
            company_id: employee.company_id,
            calendar_connection_id: connection.id,
            google_event_id: event.id,
            event_title: event.title,
            event_start: startDateTime,
            event_end: endDateTime,
            meet_link: event.meetLink,
            attendees: event.attendees,
            bot_enabled: true,
            bot_status: 'pending',
          },
          { onConflict: 'user_id,google_event_id' }
        )
    }

    return NextResponse.json({ event })
  } catch (error: any) {
    console.error('[Calendar Create] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create event' },
      { status: 500 }
    )
  }
}
