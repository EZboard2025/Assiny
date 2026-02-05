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

    // Format phone number for WhatsApp (add @c.us suffix)
    const chatId = to.includes('@') ? to : `${to.replace(/[^0-9]/g, '')}@c.us`

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
