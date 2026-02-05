import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp-api'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, message } = body

    if (!to || !message) {
      return NextResponse.json(
        { error: 'to (phone number) and message are required' },
        { status: 400 }
      )
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
      .select('id, phone_number_id, access_token, company_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!connection) {
      return NextResponse.json({ error: 'No active WhatsApp connection' }, { status: 404 })
    }

    // Send message via Meta API
    const result = await sendTextMessage(
      connection.phone_number_id,
      to,
      message,
      connection.access_token
    )

    const waMessageId = result.messages?.[0]?.id || null

    // Save outbound message to database
    const { data: savedMsg } = await supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        connection_id: connection.id,
        user_id: user.id,
        company_id: connection.company_id,
        wa_message_id: waMessageId,
        contact_phone: to,
        direction: 'outbound',
        message_type: 'text',
        content: message,
        message_timestamp: new Date().toISOString(),
        status: 'sent'
      })
      .select('id')
      .single()

    // Update conversation
    const { data: existingConv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, message_count')
      .eq('connection_id', connection.id)
      .eq('contact_phone', to)
      .single()

    if (existingConv) {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: message.substring(0, 100),
          message_count: (existingConv.message_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConv.id)
    } else {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .insert({
          connection_id: connection.id,
          user_id: user.id,
          company_id: connection.company_id,
          contact_phone: to,
          last_message_at: new Date().toISOString(),
          last_message_preview: message.substring(0, 100),
          message_count: 1
        })
    }

    return NextResponse.json({
      success: true,
      message: {
        id: savedMsg?.id || null,
        waMessageId,
        body: message,
        fromMe: true,
        timestamp: new Date().toISOString(),
        type: 'text',
        hasMedia: false,
        status: 'sent'
      }
    })

  } catch (error: any) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    )
  }
}
