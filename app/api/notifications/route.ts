import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch notifications for authenticated user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const all = searchParams.get('all') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!all) {
      query = query.eq('is_read', false)
    }

    query = query.limit(all ? 50 : 20)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notifications: data || [] })

  } catch (error: any) {
    console.error('Error in notifications GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Mark notification as read
export async function PATCH(request: Request) {
  try {
    const { notificationId, userId, markAll } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Mark all unread notifications as read
    if (markAll) {
      const { error } = await supabaseAdmin
        .from('user_notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false)

      if (error) {
        console.error('Error marking all notifications as read:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error marking notification as read:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error in notifications PATCH:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
