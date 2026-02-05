import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Fetch conversations ordered by most recent message
    const { data: conversations, error } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(50)

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`)
    }

    return NextResponse.json({ conversations: conversations || [] })

  } catch (error: any) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

// PATCH: Mark conversation as read (reset unread_count)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactPhone } = body

    if (!contactPhone) {
      return NextResponse.json({ error: 'contactPhone is required' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ unread_count: 0, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('contact_phone', contactPhone)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error marking conversation as read:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update conversation' },
      { status: 500 }
    )
  }
}
