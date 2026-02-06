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
    const { data: rawConversations, error } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`)
    }

    // Deduplicate by contact_phone - keep the one with most recent message
    // This handles cases where same contact has multiple entries (e.g., different connection_ids)
    const deduplicatedMap = new Map<string, any>()
    for (const conv of rawConversations || []) {
      const phone = conv.contact_phone
      if (!deduplicatedMap.has(phone)) {
        deduplicatedMap.set(phone, conv)
      } else {
        // Keep the one with most recent last_message_at
        const existing = deduplicatedMap.get(phone)
        const existingDate = existing.last_message_at ? new Date(existing.last_message_at) : new Date(0)
        const currentDate = conv.last_message_at ? new Date(conv.last_message_at) : new Date(0)
        if (currentDate > existingDate) {
          deduplicatedMap.set(phone, conv)
        }
        // Merge data: use profile_pic_url and contact_name from whichever has it
        if (!deduplicatedMap.get(phone).profile_pic_url && conv.profile_pic_url) {
          deduplicatedMap.get(phone).profile_pic_url = conv.profile_pic_url
        }
        if (!deduplicatedMap.get(phone).contact_name && conv.contact_name) {
          deduplicatedMap.get(phone).contact_name = conv.contact_name
        }
      }
    }

    const conversations = Array.from(deduplicatedMap.values())
      .sort((a, b) => {
        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return dateB - dateA
      })
      .slice(0, 50)

    return NextResponse.json({ conversations })

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
