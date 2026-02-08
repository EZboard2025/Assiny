import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient } from '@/lib/whatsapp-client'
import { MessageMedia } from 'whatsapp-web.js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    return handleMediaMessage(request)
  } else {
    return handleTextMessage(request)
  }
}

// ============================================
// Text message (existing behavior)
// ============================================

async function handleTextMessage(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, message } = body

    if (!to || !message) {
      return NextResponse.json(
        { error: 'to (phone number) and message are required' },
        { status: 400 }
      )
    }

    const { user, error: authErr } = await authenticateRequest(request)
    if (authErr) return authErr

    const client = getConnectedClient(user!.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    const chatId = await resolveChatId(to, user!.id)

    // Anti-ban: Simulate typing before sending
    try {
      const chat = await client.getChatById(chatId)
      await chat.sendStateTyping()
    } catch {}

    // Anti-ban: Random delay (2-4 seconds)
    const typingDelay = 2000 + Math.random() * 2000
    await new Promise(resolve => setTimeout(resolve, typingDelay))

    const sentMsg = await client.sendMessage(chatId, message)

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
    console.error('Error sending text message:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    )
  }
}

// ============================================
// Media message (image, audio, document)
// ============================================

async function handleMediaMessage(request: NextRequest) {
  try {
    const formData = await request.formData()
    const to = formData.get('to') as string
    const file = formData.get('file') as File
    const messageType = (formData.get('type') as string) || 'document'
    const caption = formData.get('caption') as string | null

    if (!to || !file) {
      return NextResponse.json(
        { error: 'to and file are required' },
        { status: 400 }
      )
    }

    // File size validation
    const maxSize = messageType === 'document' ? 100 * 1024 * 1024 : 16 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Limite: ${messageType === 'document' ? '100MB' : '16MB'}` },
        { status: 400 }
      )
    }

    const { user, error: authErr } = await authenticateRequest(request)
    if (authErr) return authErr

    const client = getConnectedClient(user!.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    const chatId = await resolveChatId(to, user!.id)

    // Convert File to base64 for MessageMedia
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Clean mimetype: remove codec params that can confuse whatsapp-web.js
    let cleanMimetype = (file.type || 'application/octet-stream').split(';')[0].trim()

    // For voice recordings from browser (webm), use audio/ogg which WhatsApp prefers
    if (messageType === 'audio' && (cleanMimetype === 'audio/webm' || cleanMimetype === 'audio/ogg')) {
      cleanMimetype = 'audio/ogg; codecs=opus'
    }

    console.log(`[WA Send Media] type=${messageType}, mimetype=${cleanMimetype}, size=${file.size}, name=${file.name}`)

    const media = new MessageMedia(
      cleanMimetype,
      base64,
      file.name || `media_${Date.now()}`
    )

    // Anti-ban: Short delay for media (1-2s)
    const typingDelay = 1000 + Math.random() * 1000
    await new Promise(resolve => setTimeout(resolve, typingDelay))

    // Send via whatsapp-web.js
    const options: any = {}
    if (caption?.trim()) {
      options.caption = caption.trim()
    }
    if (messageType === 'audio') {
      options.sendAudioAsVoice = true
    }

    let sentMsg
    try {
      sentMsg = await client.sendMessage(chatId, media, options)
    } catch (sendErr: any) {
      console.error(`[WA Send Media] sendMessage failed:`, sendErr?.message || sendErr, JSON.stringify({ mimetype: cleanMimetype, fileSize: file.size, fileName: file.name, options }))
      throw sendErr
    }

    // Upload to Supabase Storage for consistent display
    const ext = file.name?.split('.').pop() || 'bin'
    const mediaId = `${user!.id}/${Date.now()}_sent.${ext}`

    await supabaseAdmin.storage
      .from('whatsapp-media')
      .upload(mediaId, Buffer.from(arrayBuffer), {
        contentType: file.type || 'application/octet-stream',
        upsert: true
      })

    return NextResponse.json({
      success: true,
      message: {
        id: sentMsg.id._serialized,
        waMessageId: sentMsg.id._serialized,
        body: caption?.trim() || '',
        fromMe: true,
        timestamp: new Date().toISOString(),
        type: messageType === 'audio' ? 'ptt' : messageType,
        hasMedia: true,
        mediaId: mediaId,
        mimetype: file.type,
        status: 'sent'
      }
    })

  } catch (error: any) {
    console.error('Error sending media message:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send media' },
      { status: 500 }
    )
  }
}

// ============================================
// Shared helpers
// ============================================

async function authenticateRequest(request: NextRequest): Promise<{ user: any; error: NextResponse | null }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { user, error: null }
}

async function resolveChatId(to: string, userId: string): Promise<string> {
  if (to.startsWith('lid_')) {
    const lidNumber = to.replace('lid_', '')
    console.log(`[WA Send] LID contact detected, using: ${lidNumber}@lid`)
    return `${lidNumber}@lid`
  }

  if (to.includes('@')) {
    return to
  }

  // Try to find original chat ID from recent message
  const { data: recentMessage } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('raw_payload')
    .eq('user_id', userId)
    .eq('contact_phone', to)
    .order('message_timestamp', { ascending: false })
    .limit(1)
    .single()

  if (recentMessage?.raw_payload?.original_chat_id) {
    console.log(`[WA Send] Using stored original_chat_id: ${recentMessage.raw_payload.original_chat_id}`)
    return recentMessage.raw_payload.original_chat_id
  }

  const chatId = `${to.replace(/[^0-9]/g, '')}@c.us`
  console.log(`[WA Send] Using @c.us format: ${chatId}`)
  return chatId
}
