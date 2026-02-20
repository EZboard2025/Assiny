import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deleteCalendarEvent, hasWriteScopes } from '@/lib/google-calendar'

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
    const { eventId } = body

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
    }

    const success = await deleteCalendarEvent(user.id, eventId)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
    }

    // Also remove from calendar_scheduled_bots if exists
    await supabaseAdmin
      .from('calendar_scheduled_bots')
      .delete()
      .eq('user_id', user.id)
      .eq('google_event_id', eventId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Calendar Delete] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete event' },
      { status: 500 }
    )
  }
}
