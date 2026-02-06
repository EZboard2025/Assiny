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

    // Normalize phone number for deduplication
    const normalizePhone = (phone: string): string => {
      // Remove lid_ prefix
      let normalized = phone.replace(/^lid_/, '')
      // Remove all non-digits
      normalized = normalized.replace(/\D/g, '')
      // Remove Brazil country code (55) if present and number is long enough
      if (normalized.startsWith('55') && normalized.length > 11) {
        normalized = normalized.substring(2)
      }
      // Get last 8-9 digits (the core number without area code variations)
      if (normalized.length > 9) {
        normalized = normalized.slice(-9)
      }
      return normalized
    }

    // Deduplicate by normalized phone AND by contact_name
    // This handles cases where same contact has multiple entries with different phone formats
    const deduplicatedMap = new Map<string, any>()
    const nameToPhoneMap = new Map<string, string>() // Track name -> normalized phone mapping

    for (const conv of rawConversations || []) {
      const phone = conv.contact_phone
      const normalizedPhone = normalizePhone(phone)
      const contactName = conv.contact_name?.toLowerCase().trim() || ''

      // Check if we've seen this name before with a different phone
      let dedupeKey = normalizedPhone
      if (contactName && nameToPhoneMap.has(contactName)) {
        // Use the existing phone key for this name
        dedupeKey = nameToPhoneMap.get(contactName)!
      } else if (contactName) {
        // First time seeing this name, record the mapping
        nameToPhoneMap.set(contactName, normalizedPhone)
      }

      if (!deduplicatedMap.has(dedupeKey)) {
        deduplicatedMap.set(dedupeKey, { ...conv })
      } else {
        // Keep the one with most recent last_message_at
        const existing = deduplicatedMap.get(dedupeKey)
        const existingDate = existing.last_message_at ? new Date(existing.last_message_at) : new Date(0)
        const currentDate = conv.last_message_at ? new Date(conv.last_message_at) : new Date(0)
        if (currentDate > existingDate) {
          // Keep new one but preserve merged data
          const merged = { ...conv }
          if (!merged.profile_pic_url && existing.profile_pic_url) {
            merged.profile_pic_url = existing.profile_pic_url
          }
          if (!merged.contact_name && existing.contact_name) {
            merged.contact_name = existing.contact_name
          }
          deduplicatedMap.set(dedupeKey, merged)
        } else {
          // Keep existing but merge data from current
          if (!existing.profile_pic_url && conv.profile_pic_url) {
            existing.profile_pic_url = conv.profile_pic_url
          }
          if (!existing.contact_name && conv.contact_name) {
            existing.contact_name = conv.contact_name
          }
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
