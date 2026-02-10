import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient } from '@/lib/whatsapp-client'
import { MessageMedia } from 'whatsapp-web.js'
import { execFile } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    return handleMediaMessage(request)
  } else {
    const body = await request.json()
    if (body.type === 'contact') {
      return handleContactMessage(request, body)
    }
    return handleTextMessage(request, body)
  }
}

// ============================================
// Text message (existing behavior)
// ============================================

async function handleTextMessage(request: NextRequest, body: any) {
  try {
    const { to, message } = body

    if (!to || !message) {
      return NextResponse.json(
        { error: 'to (phone number) and message are required' },
        { status: 400 }
      )
    }

    const { user, error: authErr } = await authenticateRequest(request)
    if (authErr) return authErr

    console.log(`[WA Send] Attempting to send text to: ${to}`)

    const client = getConnectedClient(user!.id)
    if (!client) {
      console.error(`[WA Send] No connected client for user ${user!.id}`)
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    console.log(`[WA Send] Resolving chatId for: ${to}`)
    const chatId = await Promise.race([
      resolveChatId(to, user!.id),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('resolveChatId timeout (5s)')), 5000))
    ])
    console.log(`[WA Send] Resolved chatId: ${chatId}`)

    // Send directly (no typing indicator or delay for now - debugging)
    console.log(`[WA Send] Sending message to ${chatId}...`)
    const sentMsg = await Promise.race([
      client.sendMessage(chatId, message),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sendMessage timeout (15s)')), 15000))
    ])
    console.log(`[WA Send] Message sent! ID: ${sentMsg.id._serialized}`)

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
    let mediaBuffer: Buffer = Buffer.from(arrayBuffer)
    let mediaMimetype = (file.type || 'application/octet-stream').split(';')[0].trim()
    let mediaFilename = file.name || `media_${Date.now()}`

    // For audio: remux WebM/Opus → OGG/Opus via ffmpeg (whatsapp-web.js requires real OGG container)
    if (messageType === 'audio') {
      console.log(`[WA Send Media] Converting audio: ${mediaMimetype}, size=${file.size}`)
      try {
        const oggBuffer = await convertToOgg(mediaBuffer)
        mediaBuffer = oggBuffer
        mediaMimetype = 'audio/ogg; codecs=opus'
        mediaFilename = mediaFilename.replace(/\.\w+$/, '.ogg')
        console.log(`[WA Send Media] Converted to OGG: size=${oggBuffer.length}`)
      } catch (convErr) {
        console.error(`[WA Send Media] ffmpeg conversion failed:`, convErr)
        return NextResponse.json({ error: 'Falha ao converter áudio' }, { status: 500 })
      }
    }

    console.log(`[WA Send Media] type=${messageType}, mimetype=${mediaMimetype}, size=${mediaBuffer.length}, name=${mediaFilename}`)

    const base64 = mediaBuffer.toString('base64')
    const media = new MessageMedia(mediaMimetype, base64, mediaFilename)

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

    const sentMsg = await client.sendMessage(chatId, media, options)

    // Upload to Supabase Storage for consistent display
    const ext = messageType === 'audio' ? 'ogg' : (file.name?.split('.').pop() || 'bin')
    const mediaId = `${user!.id}/${Date.now()}_sent.${ext}`

    await supabaseAdmin.storage
      .from('whatsapp-media')
      .upload(mediaId, mediaBuffer, {
        contentType: mediaMimetype,
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
// Contact message (vCard)
// ============================================

async function handleContactMessage(request: NextRequest, body: any) {
  try {
    const { to, contactName, contactPhone } = body

    if (!to || !contactName || !contactPhone) {
      return NextResponse.json(
        { error: 'to, contactName and contactPhone are required' },
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

    // Build vCard
    const cleanPhone = contactPhone.replace(/[^0-9+]/g, '')
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactName}\nTEL;type=CELL;type=VOICE;waid=${cleanPhone.replace('+', '')}:${cleanPhone}\nEND:VCARD`

    // Anti-ban delay
    const delay = 1000 + Math.random() * 1000
    await new Promise(resolve => setTimeout(resolve, delay))

    const sentMsg = await client.sendMessage(chatId, vcard, { parseVCards: true })

    return NextResponse.json({
      success: true,
      message: {
        id: sentMsg.id._serialized,
        waMessageId: sentMsg.id._serialized,
        body: `📇 ${contactName}`,
        fromMe: true,
        timestamp: new Date().toISOString(),
        type: 'contacts',
        hasMedia: false,
        status: 'sent'
      }
    })

  } catch (error: any) {
    console.error('Error sending contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send contact' },
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

// Convert WebM/Opus → OGG/Opus via ffmpeg (two-stage for WhatsApp mobile compatibility)
// WhatsApp mobile requires: OGG/Opus, 16kHz, mono, ~32kbps
function convertToOgg(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ts = Date.now()
    const tmpIn = join(tmpdir(), `voice_in_${ts}.webm`)
    const tmpWav = join(tmpdir(), `voice_mid_${ts}.wav`)
    const tmpOut = join(tmpdir(), `voice_out_${ts}.ogg`)

    writeFileSync(tmpIn, inputBuffer)

    // Stage 1: Normalize to clean WAV (strips any corrupt metadata from browser recording)
    execFile('ffmpeg', [
      '-y', '-i', tmpIn,
      '-vn', '-ac', '1', '-ar', '16000',
      '-c:a', 'pcm_s16le',
      '-map_metadata', '-1',
      tmpWav
    ], { timeout: 15000 }, (err1) => {
      try { unlinkSync(tmpIn) } catch {}

      if (err1) {
        try { unlinkSync(tmpWav) } catch {}
        reject(err1)
        return
      }

      // Stage 2: Encode to WhatsApp-compatible OGG/Opus
      execFile('ffmpeg', [
        '-y', '-i', tmpWav,
        '-c:a', 'libopus',
        '-b:a', '32k',
        '-vbr', 'on',
        '-compression_level', '10',
        '-frame_duration', '60',
        '-application', 'voip',
        tmpOut
      ], { timeout: 15000 }, (err2) => {
        try { unlinkSync(tmpWav) } catch {}

        if (err2) {
          try { unlinkSync(tmpOut) } catch {}
          reject(err2)
          return
        }

        try {
          const oggBuffer = readFileSync(tmpOut)
          unlinkSync(tmpOut)
          resolve(oggBuffer)
        } catch (readErr) {
          reject(readErr)
        }
      })
    })
  })
}
