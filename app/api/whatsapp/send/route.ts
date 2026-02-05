import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient } from '@/lib/whatsapp-client'

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

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the connected WhatsApp client
    const client = getConnectedClient(user.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    let chatId: string

    // Handle LID contacts (stored with lid_ prefix)
    if (to.startsWith('lid_')) {
      // Extract the LID number and use @lid suffix
      const lidNumber = to.replace('lid_', '')
      chatId = `${lidNumber}@lid`
      console.log(`[WA Send] LID contact detected, using: ${chatId}`)
    } else if (to.includes('@')) {
      // Already has a suffix, use as-is
      chatId = to
    } else {
      // Regular phone number - first try to find original chat ID from recent message
      const { data: recentMessage } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('raw_payload')
        .eq('user_id', user.id)
        .eq('contact_phone', to)
        .order('message_timestamp', { ascending: false })
        .limit(1)
        .single()

      if (recentMessage?.raw_payload?.original_chat_id) {
        // Use the stored original chat ID
        chatId = recentMessage.raw_payload.original_chat_id
        console.log(`[WA Send] Using stored original_chat_id: ${chatId}`)
      } else {
        // No stored chat ID, use standard @c.us format
        chatId = `${to.replace(/[^0-9]/g, '')}@c.us`
        console.log(`[WA Send] Using @c.us format: ${chatId}`)
      }
    }

    // Send message via whatsapp-web.js
    const sentMsg = await client.sendMessage(chatId, message)

    // The message_create event handler will save it to the database
    // But we return immediately with the sent message info
    return NextResponse.json({
      success: true,
      message: {
        id: sentMsg.id._serialized,
        waMessageId: sentMsg.id._serialized,
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
