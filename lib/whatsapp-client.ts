// WhatsApp Web.js Client Manager (Singleton)
// Each user gets their own WhatsApp client instance
// Messages are saved to Supabase via event handlers

import { Client, LocalAuth, Message } from 'whatsapp-web.js'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ClientState {
  client: Client
  userId: string
  companyId: string | null
  connectionId: string | null
  qrCode: string | null
  status: 'initializing' | 'qr_ready' | 'connecting' | 'connected' | 'disconnected' | 'error'
  error: string | null
  phoneNumber: string | null
}

// Store active clients by userId
const clients = new Map<string, ClientState>()

function getAuthPath(): string {
  return process.env.WWEBJS_AUTH_PATH || '.wwebjs_auth'
}

export function getClientState(userId: string): ClientState | null {
  return clients.get(userId) || null
}

export async function initializeClient(userId: string, companyId: string | null): Promise<{ qrCode: string | null; status: string }> {
  // If client already exists and is connected, return status
  const existing = clients.get(userId)
  if (existing) {
    if (existing.status === 'connected') {
      return { qrCode: null, status: 'connected' }
    }
    if (existing.status === 'qr_ready' || existing.status === 'initializing' || existing.status === 'connecting') {
      return { qrCode: existing.qrCode, status: existing.status }
    }
    // If disconnected or error, destroy and recreate
    try {
      await existing.client.destroy()
    } catch {}
    clients.delete(userId)
  }

  const sessionId = `user_${userId.replace(/-/g, '').substring(0, 16)}`

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath: getAuthPath()
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--single-process'
      ]
    }
  })

  const state: ClientState = {
    client,
    userId,
    companyId,
    connectionId: null,
    qrCode: null,
    status: 'initializing',
    error: null,
    phoneNumber: null
  }

  clients.set(userId, state)

  // QR Code event - convert to data URL for frontend display
  client.on('qr', async (qr: string) => {
    console.log(`[WA] QR code generated for user ${userId}`)
    try {
      state.qrCode = await QRCode.toDataURL(qr, { width: 256, margin: 2 })
    } catch {
      state.qrCode = qr // fallback to raw string
    }
    state.status = 'qr_ready'
  })

  // Authentication event
  client.on('authenticated', () => {
    console.log(`[WA] Authenticated for user ${userId}`)
    state.status = 'connecting'
  })

  // Ready event (fully connected)
  client.on('ready', async () => {
    console.log(`[WA] Ready for user ${userId}`)
    state.status = 'connected'
    state.qrCode = null

    // Get phone number
    const info = client.info
    state.phoneNumber = info?.wid?.user || null

    // Upsert connection in database
    await upsertConnection(state)

    // Sync message history from existing chats
    console.log(`[WA] Starting history sync for user ${userId}`)
    await syncChatHistory(state)
  })

  // Message received
  client.on('message', async (msg: Message) => {
    if (state.status !== 'connected' || !state.connectionId) return
    await handleIncomingMessage(state, msg, false)
  })

  // Message sent by us (from phone or other device)
  client.on('message_create', async (msg: Message) => {
    if (state.status !== 'connected' || !state.connectionId) return
    if (msg.fromMe) {
      await handleIncomingMessage(state, msg, true)
    }
  })

  // Disconnected
  client.on('disconnected', async (reason: string) => {
    console.log(`[WA] Disconnected for user ${userId}: ${reason}`)
    state.status = 'disconnected'
    state.error = reason

    if (state.connectionId) {
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('id', state.connectionId)
    }
  })

  // Auth failure
  client.on('auth_failure', (msg: string) => {
    console.error(`[WA] Auth failure for user ${userId}: ${msg}`)
    state.status = 'error'
    state.error = msg
  })

  // Initialize the client (async, don't await)
  client.initialize().catch((err: Error) => {
    console.error(`[WA] Failed to initialize for user ${userId}:`, err)
    state.status = 'error'
    state.error = err.message
  })

  // Wait a bit for QR or immediate auth
  await new Promise(resolve => setTimeout(resolve, 3000))

  return { qrCode: state.qrCode, status: state.status }
}

export async function disconnectClient(userId: string): Promise<void> {
  const state = clients.get(userId)
  if (!state) return

  try {
    await state.client.logout()
  } catch {}

  try {
    await state.client.destroy()
  } catch {}

  if (state.connectionId) {
    await supabaseAdmin
      .from('whatsapp_connections')
      .delete()
      .eq('id', state.connectionId)
  }

  clients.delete(userId)
}

export function getConnectedClient(userId: string): Client | null {
  const state = clients.get(userId)
  if (!state || state.status !== 'connected') return null
  return state.client
}

// ============================================
// Internal helpers
// ============================================

async function upsertConnection(state: ClientState): Promise<void> {
  // Check if connection exists
  const { data: existing } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('id')
    .eq('user_id', state.userId)
    .single()

  if (existing) {
    await supabaseAdmin
      .from('whatsapp_connections')
      .update({
        status: 'active',
        display_phone_number: state.phoneNumber,
        connected_at: new Date().toISOString(),
        last_webhook_at: new Date().toISOString()
      })
      .eq('id', existing.id)

    state.connectionId = existing.id
  } else {
    const { data: inserted } = await supabaseAdmin
      .from('whatsapp_connections')
      .insert({
        user_id: state.userId,
        company_id: state.companyId,
        phone_number_id: state.phoneNumber || 'wwebjs',
        waba_id: 'wwebjs',
        display_phone_number: state.phoneNumber,
        access_token: 'wwebjs_session',
        status: 'active',
        connected_at: new Date().toISOString()
      })
      .select('id')
      .single()

    state.connectionId = inserted?.id || null
  }

  console.log(`[WA] Connection saved: ${state.connectionId} for user ${state.userId}`)
}

async function syncChatHistory(state: ClientState): Promise<void> {
  try {
    const client = state.client
    const chats = await client.getChats()

    console.log(`[WA] Found ${chats.length} chats for user ${state.userId}`)

    // Only sync individual chats, skip groups
    const individualChats = chats.filter(chat => !chat.isGroup).slice(0, 50) // Limit to 50 most recent

    for (const chat of individualChats) {
      try {
        // Get contact info
        const contact = await chat.getContact()
        const contactPhone = chat.id.user
        const contactName = contact?.pushname || contact?.name || chat.name || null

        // Fetch last 20 messages from this chat
        const messages = await chat.fetchMessages({ limit: 20 })

        console.log(`[WA] Syncing ${messages.length} messages from ${contactName || contactPhone}`)

        let lastMessageAt: Date | null = null
        let lastMessagePreview = ''
        let messageCount = 0

        for (const msg of messages) {
          // Skip status broadcasts
          if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') continue

          const fromMe = msg.fromMe
          const waMessageId = msg.id._serialized

          // Check if message already exists
          const { data: existingMsg } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('id')
            .eq('wa_message_id', waMessageId)
            .single()

          if (existingMsg) continue // Skip if already synced

          // Extract message content
          let messageType = 'text'
          let mediaId: string | null = null
          let mediaMimeType: string | null = null
          let content = msg.body || ''

          // Debug logging for content extraction
          console.log(`[WA] Message debug: type=${msg.type}, body="${msg.body?.substring(0, 50)}", hasMedia=${msg.hasMedia}`)

          if (msg.hasMedia) {
            if (msg.type === 'image') {
              messageType = 'image'
              mediaMimeType = 'image/jpeg'
              content = (msg as any).caption || ''
            } else if (msg.type === 'ptt' || msg.type === 'audio') {
              messageType = 'audio'
              mediaMimeType = 'audio/ogg'
              content = '[Áudio]'
            } else if (msg.type === 'video') {
              messageType = 'video'
              mediaMimeType = 'video/mp4'
              content = (msg as any).caption || ''
            } else if (msg.type === 'document') {
              messageType = 'document'
              content = (msg as any).filename || '[Documento]'
            } else if (msg.type === 'sticker') {
              messageType = 'sticker'
              mediaMimeType = 'image/webp'
              content = '[Sticker]'
            }
          } else if (msg.type === 'location') {
            messageType = 'location'
            const loc = (msg as any).location
            if (loc) {
              content = `${loc.latitude},${loc.longitude}${loc.description ? ` - ${loc.description}` : ''}`
            }
          } else if (msg.type === 'vcard' || msg.type === 'multi_vcard') {
            messageType = 'contact'
            content = msg.body || '[Contato]'
          } else if (msg.type === 'chat') {
            // Regular text message - use body directly
            content = msg.body || ''
          }

          const direction = fromMe ? 'outbound' : 'inbound'
          const msgTimestamp = new Date(msg.timestamp * 1000)

          // Insert message
          const { error: insertError } = await supabaseAdmin
            .from('whatsapp_messages')
            .insert({
              connection_id: state.connectionId,
              user_id: state.userId,
              company_id: state.companyId,
              wa_message_id: waMessageId,
              contact_phone: contactPhone,
              contact_name: contactName,
              direction,
              message_type: messageType,
              content,
              media_id: mediaId,
              media_mime_type: mediaMimeType,
              message_timestamp: msgTimestamp.toISOString(),
              status: fromMe ? 'sent' : 'delivered',
              raw_payload: { type: msg.type, hasMedia: msg.hasMedia, body: msg.body, from: msg.from, to: msg.to }
            })

          if (insertError && insertError.code !== '23505') {
            console.error('[WA] Error inserting history message:', insertError)
            continue
          }

          messageCount++

          // Track last message for conversation
          if (!lastMessageAt || msgTimestamp > lastMessageAt) {
            lastMessageAt = msgTimestamp
            lastMessagePreview = content?.substring(0, 100) || `[${messageType}]`
          }
        }

        // Upsert conversation after syncing messages
        if (messageCount > 0 && lastMessageAt) {
          const { data: existingConv } = await supabaseAdmin
            .from('whatsapp_conversations')
            .select('id, message_count')
            .eq('connection_id', state.connectionId!)
            .eq('contact_phone', contactPhone)
            .single()

          if (existingConv) {
            await supabaseAdmin
              .from('whatsapp_conversations')
              .update({
                contact_name: contactName || undefined,
                last_message_at: lastMessageAt.toISOString(),
                last_message_preview: lastMessagePreview,
                message_count: (existingConv.message_count || 0) + messageCount,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingConv.id)
          } else {
            await supabaseAdmin
              .from('whatsapp_conversations')
              .insert({
                connection_id: state.connectionId,
                user_id: state.userId,
                company_id: state.companyId,
                contact_phone: contactPhone,
                contact_name: contactName,
                last_message_at: lastMessageAt.toISOString(),
                last_message_preview: lastMessagePreview,
                unread_count: 0,
                message_count: messageCount
              })
          }

          console.log(`[WA] Synced conversation: ${contactName || contactPhone} (${messageCount} messages)`)
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (chatError) {
        console.error(`[WA] Error syncing chat:`, chatError)
      }
    }

    console.log(`[WA] History sync complete for user ${state.userId}`)

  } catch (error) {
    console.error('[WA] Error syncing chat history:', error)
  }
}

async function handleIncomingMessage(state: ClientState, msg: Message, fromMe: boolean): Promise<void> {
  try {
    const chat = await msg.getChat()

    // Skip group messages
    if (chat.isGroup) return

    // Skip status broadcasts
    if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return

    const contactPhone = fromMe
      ? msg.to.replace('@c.us', '')
      : msg.from.replace('@c.us', '')

    const contact = await msg.getContact()
    const contactName = contact?.pushname || contact?.name || null

    // Debug logging for message content
    console.log(`[WA] Incoming message debug: type=${msg.type}, body="${msg.body?.substring(0, 50)}", hasMedia=${msg.hasMedia}`)

    // Determine message type
    let messageType = 'text'
    let mediaId: string | null = null
    let mediaMimeType: string | null = null
    let content = msg.body || ''

    if (msg.hasMedia) {
      const media = await msg.downloadMedia().catch(() => null)
      if (msg.type === 'image') {
        messageType = 'image'
        mediaMimeType = media?.mimetype || 'image/jpeg'
        content = (msg as any).caption || '[Imagem]'
      } else if (msg.type === 'ptt' || msg.type === 'audio') {
        messageType = 'audio'
        mediaMimeType = media?.mimetype || 'audio/ogg'
        content = '[Áudio]'
      } else if (msg.type === 'video') {
        messageType = 'video'
        mediaMimeType = media?.mimetype || 'video/mp4'
        content = (msg as any).caption || '[Vídeo]'
      } else if (msg.type === 'document') {
        messageType = 'document'
        mediaMimeType = media?.mimetype || 'application/octet-stream'
        content = (msg as any).filename || '[Documento]'
      } else if (msg.type === 'sticker') {
        messageType = 'sticker'
        mediaMimeType = media?.mimetype || 'image/webp'
        content = '[Sticker]'
      }
    } else if (msg.type === 'location') {
      messageType = 'location'
      const loc = (msg as any).location
      if (loc) {
        content = `${loc.latitude},${loc.longitude}${loc.description ? ` - ${loc.description}` : ''}`
      } else {
        content = '[Localização]'
      }
    } else if (msg.type === 'vcard' || msg.type === 'multi_vcard') {
      messageType = 'contact'
      content = msg.body || '[Contato]'
    } else if (msg.type === 'chat') {
      // Regular text message - ensure we get the body
      content = msg.body || ''
      if (!content && (msg as any)._data?.body) {
        content = (msg as any)._data.body
      }
    }

    console.log(`[WA] Processed content: "${content?.substring(0, 50)}"`)

    // If content is still empty for text messages, log raw data for debugging
    if (!content && messageType === 'text') {
      console.log(`[WA] Empty text message, raw _data:`, JSON.stringify((msg as any)._data || {}).substring(0, 500))
    }

    const direction = fromMe ? 'outbound' : 'inbound'
    const waMessageId = msg.id._serialized

    // Insert message
    const { error: insertError } = await supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        connection_id: state.connectionId,
        user_id: state.userId,
        company_id: state.companyId,
        wa_message_id: waMessageId,
        contact_phone: contactPhone,
        contact_name: contactName,
        direction,
        message_type: messageType,
        content,
        media_id: mediaId,
        media_mime_type: mediaMimeType,
        message_timestamp: new Date(msg.timestamp * 1000).toISOString(),
        status: fromMe ? 'sent' : 'delivered',
        raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to }
      })

    if (insertError) {
      if (insertError.code === '23505') return // Duplicate
      console.error('[WA] Error inserting message:', insertError)
      return
    }

    // Upsert conversation
    const messagePreview = content?.substring(0, 100) || `[${messageType}]`
    const { data: existingConv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, message_count, unread_count')
      .eq('connection_id', state.connectionId!)
      .eq('contact_phone', contactPhone)
      .single()

    if (existingConv) {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({
          contact_name: contactName || undefined,
          last_message_at: new Date(msg.timestamp * 1000).toISOString(),
          last_message_preview: messagePreview,
          unread_count: direction === 'inbound' ? (existingConv.unread_count || 0) + 1 : existingConv.unread_count,
          message_count: (existingConv.message_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingConv.id)
    } else {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .insert({
          connection_id: state.connectionId,
          user_id: state.userId,
          company_id: state.companyId,
          contact_phone: contactPhone,
          contact_name: contactName,
          last_message_at: new Date(msg.timestamp * 1000).toISOString(),
          last_message_preview: messagePreview,
          unread_count: direction === 'inbound' ? 1 : 0,
          message_count: 1
        })
    }

    // Update connection last activity
    await supabaseAdmin
      .from('whatsapp_connections')
      .update({ last_webhook_at: new Date().toISOString() })
      .eq('id', state.connectionId!)

    console.log(`[WA] ${direction} message saved: ${contactPhone} (${contactName}) - ${messageType}`)
  } catch (error) {
    console.error('[WA] Error handling message:', error)
  }
}
