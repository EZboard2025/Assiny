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

    // Get user's active connection
    const { data: connection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!connection) {
      return NextResponse.json({ error: 'No active WhatsApp connection' }, { status: 404 })
    }

    // Fetch messages for this conversation
    const { data: messages, error } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('*')
      .eq('connection_id', connection.id)
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
      messages: (messages || []).map(msg => ({
        id: msg.id,
        waMessageId: msg.wa_message_id,
        body: msg.content || '',
        fromMe: msg.direction === 'outbound',
        timestamp: msg.message_timestamp,
        type: msg.message_type,
        hasMedia: !!msg.media_id,
        mediaId: msg.media_id,
        mimetype: msg.media_mime_type,
        contactName: msg.contact_name,
        status: msg.status
      }))
    })

  } catch (error: any) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
