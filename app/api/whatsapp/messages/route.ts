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
    const isGroup = contactPhone.includes('@g.us')

    // Query messages filtered at DB level for efficiency
    // Use the last 9 digits suffix match to handle phone format variations
    let messages: any[] = []
    let error: any = null

    if (isGroup || contactPhone.startsWith('lid_')) {
      // Groups and LID contacts: exact match on contact_phone
      const result = await supabaseAdmin
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('contact_phone', contactPhone)
        .order('message_timestamp', { ascending: true })
        .limit(limit)
      messages = result.data || []
      error = result.error
    } else {
      // Regular contacts: suffix match on last 9 digits
      const result = await supabaseAdmin
        .from('whatsapp_messages')
        .select('*')
        .eq('user_id', user.id)
        .like('contact_phone', `%${normalizedRequestPhone}`)
        .order('message_timestamp', { ascending: true })
        .limit(limit)
      messages = result.data || []
      error = result.error

      // If no results with suffix match, also check lid_ contacts by resolving phone
      if (messages.length === 0) {
        const lidResult = await supabaseAdmin
          .from('whatsapp_messages')
          .select('*')
          .eq('user_id', user.id)
          .like('contact_phone', 'lid_%')
          .order('message_timestamp', { ascending: true })

        if (lidResult.data) {
          messages = lidResult.data.filter(msg => {
            const normalizedMsgPhone = normalizePhone(msg.contact_phone || '')
            return normalizedMsgPhone === normalizedRequestPhone
          }).slice(0, limit)
        }
      }
    }

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`)
    }

    console.log(`[Messages API] User ${user.id}, phone: ${contactPhone}, normalized: ${normalizedRequestPhone}, found: ${messages.length}`)

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
          status: msg.status,
          transcription: msg.transcription || null,
          isAutopilot: msg.is_autopilot || false,
          quotedMsg: rawPayload.quotedMsg || null
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
