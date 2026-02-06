import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Normalize phone number for matching (same logic as conversations)
const normalizePhone = (phone: string): string => {
  // Remove lid_ prefix
  let normalized = phone.replace(/^lid_/, '')
  // Remove all non-digits
  normalized = normalized.replace(/\D/g, '')
  // Remove Brazil country code (55) if present and number is long enough
  if (normalized.startsWith('55') && normalized.length > 11) {
    normalized = normalized.substring(2)
  }
  // Get last 9 digits (the core number without area code variations)
  if (normalized.length > 9) {
    normalized = normalized.slice(-9)
  }
  return normalized
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactPhone = searchParams.get('contactPhone')
    const format = searchParams.get('format') // 'raw' or 'analysis'
    const sellerName = searchParams.get('sellerName') || 'Vendedor'
    const limit = parseInt(searchParams.get('limit') || '500')

    if (!contactPhone) {
      return NextResponse.json({ error: 'contactPhone is required' }, { status: 400 })
    }

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

    // Normalize the requested phone for comparison
    const normalizedRequestPhone = normalizePhone(contactPhone)

    // Fetch ALL messages for this user (we'll filter by normalized phone)
    // This ensures we see full history even with different phone formats
    const { data: allMessages, error } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('message_timestamp', { ascending: true })

    // Filter messages by normalized phone number
    const messages = (allMessages || []).filter(msg => {
      const normalizedMsgPhone = normalizePhone(msg.contact_phone || '')
      return normalizedMsgPhone === normalizedRequestPhone
    }).slice(0, limit)

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`)
    }

    console.log(`[Messages API] User ${user.id}, requested phone: ${contactPhone}, normalized: ${normalizedRequestPhone}`)
    console.log(`[Messages API] Total messages for user: ${allMessages?.length || 0}, filtered: ${messages.length}`)

    // If analysis format requested, return formatted text
    if (format === 'analysis') {
      const contactName = messages?.[0]?.contact_name || 'Cliente'
      const lines = (messages || []).map(msg => {
        const sender = msg.direction === 'outbound' ? sellerName : contactName
        const time = new Date(msg.message_timestamp).toLocaleString('pt-BR')
        const content = msg.content || `[${msg.message_type}]`
        return `[${time}] ${sender}: ${content}`
      })

      return NextResponse.json({ formatted: lines.join('\n') })
    }

    // Return raw messages
    return NextResponse.json({
      messages: (messages || []).map(msg => {
        // Check if media exists - either from stored media_id or from raw_payload.hasMedia
        const rawPayload = msg.raw_payload || {}
        const hasStoredMedia = !!msg.media_id
        const hadOriginalMedia = rawPayload.hasMedia === true
        const isMediaType = ['image', 'audio', 'ptt', 'video', 'document', 'sticker'].includes(msg.message_type)

        // Use stored media_id, or fallback to wa_message_id for on-demand loading
        const mediaId = msg.media_id || (hadOriginalMedia && isMediaType ? msg.wa_message_id : null)

        return {
          id: msg.id,
          waMessageId: msg.wa_message_id,
          body: msg.content || '',
          fromMe: msg.direction === 'outbound',
          timestamp: msg.message_timestamp,
          type: msg.message_type,
          hasMedia: hasStoredMedia || hadOriginalMedia,
          mediaId: mediaId,
          mimetype: msg.media_mime_type,
          contactName: msg.contact_name,
          status: msg.status
        }
      })
    })

  } catch (error: any) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
