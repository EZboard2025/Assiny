import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { updateEventAttendees, updateCalendarEvent, hasWriteScopes } from '@/lib/google-calendar'

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

    // Check write scopes
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

    const body = await request.json()
    const { eventId, attendees, title, startDateTime, endDateTime, description, addMeetLink } = body

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
    }

    // If only attendees provided (legacy/simple add), use the quick attendees-only path
    const isFullUpdate = title !== undefined || startDateTime || endDateTime || description !== undefined || addMeetLink !== undefined

    if (isFullUpdate) {
      const updated = await updateCalendarEvent(user.id, eventId, {
        title,
        startDateTime,
        endDateTime,
        description,
        attendees,
        addMeetLink,
      })

      if (!updated) {
        return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
      }

      // Update calendar_scheduled_bots
      const botUpdate: any = {}
      if (updated.attendees) botUpdate.attendees = updated.attendees
      if (updated.title) botUpdate.event_title = updated.title
      if (startDateTime) botUpdate.event_start = startDateTime
      if (endDateTime) botUpdate.event_end = endDateTime
      if (updated.meetLink) botUpdate.meet_link = updated.meetLink

      if (Object.keys(botUpdate).length > 0) {
        await supabaseAdmin
          .from('calendar_scheduled_bots')
          .update(botUpdate)
          .eq('user_id', user.id)
          .eq('google_event_id', eventId)
      }

      return NextResponse.json({ event: updated })
    }

    // Attendees-only update
    if (!Array.isArray(attendees)) {
      return NextResponse.json({ error: 'attendees[] is required for attendee-only update' }, { status: 400 })
    }

    const result = await updateEventAttendees(user.id, eventId, attendees)

    if (!result) {
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
    }

    // Update attendees in calendar_scheduled_bots too
    await supabaseAdmin
      .from('calendar_scheduled_bots')
      .update({ attendees: result.attendees })
      .eq('user_id', user.id)
      .eq('google_event_id', eventId)

    return NextResponse.json({ attendees: result.attendees })
  } catch (error: any) {
    console.error('[Calendar Update] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update event' },
      { status: 500 }
    )
  }
}
