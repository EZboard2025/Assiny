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

    // Normalize phone number for deduplication (skip groups — they use @g.us IDs)
    const isGroupPhone = (phone: string) => phone.includes('@g.us')
    const normalizePhone = (phone: string): string => {
      // Groups use their serialized ID as-is (no normalization)
      if (isGroupPhone(phone)) return phone
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

      // Check if we've seen this name before with a different phone (skip groups — multiple groups can share names)
      let dedupeKey = normalizedPhone
      if (!isGroupPhone(phone) && contactName && nameToPhoneMap.has(contactName)) {
        dedupeKey = nameToPhoneMap.get(contactName)!
      } else if (!isGroupPhone(phone) && contactName) {
        nameToPhoneMap.set(contactName, normalizedPhone)
      }

      if (!deduplicatedMap.has(dedupeKey)) {
        deduplicatedMap.set(dedupeKey, { ...conv })
      } else {
        const existing = deduplicatedMap.get(dedupeKey)
        const existingDate = existing.last_message_at ? new Date(existing.last_message_at) : new Date(0)
        const currentDate = conv.last_message_at ? new Date(conv.last_message_at) : new Date(0)
        const existingUpdated = existing.updated_at ? new Date(existing.updated_at) : new Date(0)
        const currentUpdated = conv.updated_at ? new Date(conv.updated_at) : new Date(0)
        if (currentDate > existingDate) {
          const merged = { ...conv }
          if (!merged.profile_pic_url && existing.profile_pic_url) {
            merged.profile_pic_url = existing.profile_pic_url
          }
          deduplicatedMap.set(dedupeKey, merged)
        } else if (currentDate < existingDate) {
          // Keep existing but fill missing fields
          if (!existing.profile_pic_url && conv.profile_pic_url) {
            existing.profile_pic_url = conv.profile_pic_url
          }
        } else {
          // Same last_message_at — prefer the most recently updated record
          if (currentUpdated >= existingUpdated) {
            const merged = { ...conv }
            if (!merged.profile_pic_url && existing.profile_pic_url) {
              merged.profile_pic_url = existing.profile_pic_url
            }
            deduplicatedMap.set(dedupeKey, merged)
          } else {
            if (!existing.profile_pic_url && conv.profile_pic_url) {
              existing.profile_pic_url = conv.profile_pic_url
            }
          }
        }
        // Always prefer the most recently updated contact_name
        // But also fallback to ANY available name if winner has none
        const winner = deduplicatedMap.get(dedupeKey)
        if (conv.contact_name && (currentUpdated >= existingUpdated || !winner.contact_name)) {
          winner.contact_name = conv.contact_name
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

    // Enrich conversations with last message sender info
    // Only need 1 per phone — limit to ~2x conversation count for safety
    const contactPhones = conversations.map((c: any) => c.contact_phone)
    if (contactPhones.length > 0) {
      const { data: latestMsgs } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('contact_phone, direction, contact_name')
        .eq('user_id', user.id)
        .in('contact_phone', contactPhones)
        .order('message_timestamp', { ascending: false })
        .limit(Math.max(contactPhones.length * 2, 50))

      // Build map: first occurrence per phone = latest message
      const latestByPhone = new Map<string, { direction: string; contact_name: string | null }>()
      for (const msg of latestMsgs || []) {
        if (!latestByPhone.has(msg.contact_phone)) {
          latestByPhone.set(msg.contact_phone, { direction: msg.direction, contact_name: msg.contact_name })
        }
      }

      // Add sender info to each conversation + enrich missing contact names
      for (const conv of conversations) {
        const info = latestByPhone.get(conv.contact_phone)
        if (info) {
          conv.last_message_from_me = info.direction === 'outbound'
          conv.last_message_sender = info.direction === 'outbound' ? 'Você' : (info.contact_name || conv.contact_name || null)
          // Enrich missing contact_name from latest message's contact_name
          if (!conv.contact_name && info.contact_name) {
            conv.contact_name = info.contact_name
          }
        }
      }
    }

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
