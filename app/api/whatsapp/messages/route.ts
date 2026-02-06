import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Fetch ALL messages for this user and contact (regardless of connection_id)
    // This ensures we see full history even when connection is recreated
    const { data: messages, error } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_phone', contactPhone)
      .order('message_timestamp', { ascending: true })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`)
    }

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
