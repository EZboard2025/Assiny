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

// Lock to prevent concurrent initialization for the same user
const initializingUsers = new Set<string>()

// Cache for contact phone lookups (chatId -> contactPhone)
const contactPhoneCache = new Map<string, string>()

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

  // Prevent concurrent initialization for the same user
  if (initializingUsers.has(userId)) {
    console.log(`[WA] Already initializing for user ${userId}, waiting...`)
    await new Promise(resolve => setTimeout(resolve, 1000))
    const state = clients.get(userId)
    if (state) {
      return { qrCode: state.qrCode, status: state.status }
    }
    return { qrCode: null, status: 'initializing' }
  }

  // Mark user as initializing
  initializingUsers.add(userId)
  console.log(`[WA] Starting initialization for user ${userId}`)

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

  // QR Code event
  client.on('qr', async (qr: string) => {
    console.log(`[WA] QR code generated for user ${userId}`)
    try {
      state.qrCode = await QRCode.toDataURL(qr, { width: 256, margin: 2 })
    } catch {
      state.qrCode = qr
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
    initializingUsers.delete(userId)

    const info = client.info
    state.phoneNumber = info?.wid?.user || null

    await upsertConnection(state)

    // Sync in background (don't block)
    syncChatHistory(state).catch(err => console.error('[WA] Sync error:', err))
  })

  // Message received
  client.on('message', async (msg: Message) => {
    if (state.status !== 'connected' || !state.connectionId) return
    handleIncomingMessage(state, msg, false)
  })

  // Message sent by us
  client.on('message_create', async (msg: Message) => {
    if (state.status !== 'connected' || !state.connectionId) return
    if (msg.fromMe) {
      handleIncomingMessage(state, msg, true)
    }
  })

  // Disconnected
  client.on('disconnected', async (reason: string) => {
    console.log(`[WA] Disconnected for user ${userId}: ${reason}`)
    state.status = 'disconnected'
    state.error = reason
    initializingUsers.delete(userId)

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
    initializingUsers.delete(userId)
  })

  // Initialize the client
  client.initialize().catch((err: Error) => {
    console.error(`[WA] Failed to initialize for user ${userId}:`, err)
    state.status = 'error'
    state.error = err.message
    initializingUsers.delete(userId)
  })

  await new Promise(resolve => setTimeout(resolve, 3000))
  return { qrCode: state.qrCode, status: state.status }
}

export async function disconnectClient(userId: string): Promise<void> {
  const state = clients.get(userId)
  initializingUsers.delete(userId)
  if (!state) return

  try { await state.client.logout() } catch {}
  try { await state.client.destroy() } catch {}

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
  console.log(`[WA] Connection saved: ${state.connectionId}`)
}

// Helper to extract message content
function extractMessageContent(msg: Message): { messageType: string; content: string; mediaMimeType: string | null } | null {
  let messageType = 'text'
  let mediaMimeType: string | null = null
  let content = msg.body || ''

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
    content = loc ? `${loc.latitude},${loc.longitude}${loc.description ? ` - ${loc.description}` : ''}` : '[Localização]'
  } else if (msg.type === 'vcard' || msg.type === 'multi_vcard') {
    messageType = 'contact'
    content = msg.body || '[Contato]'
  } else if (msg.type === 'e2e_notification' || (msg.type as string) === 'notification' || (msg.type as string) === 'notification_template') {
    return null
  } else if ((msg.type as string) === 'interactive' || (msg.type as string) === 'button_reply' || (msg.type as string) === 'list_reply') {
    messageType = 'interactive'
    content = msg.body || (msg as any).selectedButtonId || (msg as any).selectedRowId || '[Mensagem interativa]'
  } else if (msg.type === 'chat') {
    content = msg.body || ''
    if (!content && (msg as any)._data?.body) content = (msg as any)._data.body
  } else {
    content = msg.body || ''
    if (!content) return null
  }

  return { messageType, content, mediaMimeType }
}

// Helper to resolve contact phone (with caching)
async function resolveContactPhone(chatId: string, contact: any, state: ClientState): Promise<{ contactPhone: string; isLidContact: boolean } | null> {
  // Check cache first
  const cached = contactPhoneCache.get(chatId)
  if (cached) {
    return { contactPhone: cached, isLidContact: chatId.endsWith('@lid') }
  }

  const isLidContact = chatId.endsWith('@lid')
  let contactPhone: string

  if (isLidContact) {
    const lidNumber = chatId.replace(/@lid$/, '')
    let rawPhone = (contact as any)?.number || ''

    if (!rawPhone && contact?.id?.user && !contact.id._serialized?.endsWith('@lid')) {
      rawPhone = contact.id.user
    }

    if (!rawPhone) {
      try {
        const formattedNumber = await (contact as any).getFormattedNumber?.()
        if (formattedNumber) rawPhone = formattedNumber
      } catch {}
    }

    const normalizedPhone = rawPhone ? String(rawPhone).replace(/[^0-9]/g, '') : ''
    const isValidPhone = normalizedPhone &&
                         normalizedPhone.length >= 8 &&
                         normalizedPhone.length <= 15 &&
                         normalizedPhone !== lidNumber

    contactPhone = isValidPhone ? normalizedPhone : `lid_${lidNumber}`
  } else {
    contactPhone = chatId.replace(/@.*$/, '')
  }

  if (!contactPhone || contactPhone === state.phoneNumber) return null

  contactPhoneCache.set(chatId, contactPhone)
  return { contactPhone, isLidContact }
}

// Process a single chat (for parallel processing)
async function processSingleChat(chat: any, state: ClientState): Promise<void> {
  try {
    const contact = await chat.getContact()
    const contactName = contact?.pushname || contact?.name || chat.name || null
    const chatIdSerialized = chat.id._serialized || ''

    const resolved = await resolveContactPhone(chatIdSerialized, contact, state)
    if (!resolved) return

    const { contactPhone, isLidContact } = resolved

    // Fetch only last 30 messages (faster initial sync)
    const messages = await chat.fetchMessages({ limit: 30 })
    if (messages.length === 0) return

    // Get existing message IDs in bulk
    const messageIds = messages.map((m: Message) => m.id._serialized)
    const { data: existingMsgs } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('wa_message_id')
      .in('wa_message_id', messageIds)

    const existingIds = new Set(existingMsgs?.map(m => m.wa_message_id) || [])

    // Prepare batch insert
    const messagesToInsert: any[] = []
    let lastMessageAt: Date | null = null
    let lastMessagePreview = ''

    for (const msg of messages) {
      if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') continue
      if (existingIds.has(msg.id._serialized)) continue

      const extracted = extractMessageContent(msg)
      if (!extracted) continue

      const { messageType, content, mediaMimeType } = extracted
      const msgTimestamp = new Date(msg.timestamp * 1000)

      messagesToInsert.push({
        connection_id: state.connectionId,
        user_id: state.userId,
        company_id: state.companyId,
        wa_message_id: msg.id._serialized,
        contact_phone: contactPhone,
        contact_name: contactName,
        direction: msg.fromMe ? 'outbound' : 'inbound',
        message_type: messageType,
        content,
        media_id: null,
        media_mime_type: mediaMimeType,
        message_timestamp: msgTimestamp.toISOString(),
        status: msg.fromMe ? 'sent' : 'delivered',
        raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: chatIdSerialized, is_lid: isLidContact }
      })

      if (!lastMessageAt || msgTimestamp > lastMessageAt) {
        lastMessageAt = msgTimestamp
        lastMessagePreview = content?.substring(0, 100) || `[${messageType}]`
      }
    }

    // Batch insert messages
    if (messagesToInsert.length > 0) {
      try {
        await supabaseAdmin.from('whatsapp_messages').insert(messagesToInsert)
      } catch {}
    }

    // Upsert conversation
    const latestMsg = messages.reduce((latest: any, msg: any) => {
      if (!latest || msg.timestamp > latest.timestamp) return msg
      return latest
    }, null)

    if (latestMsg) {
      const latestTimestamp = new Date(latestMsg.timestamp * 1000)
      const latestContent = extractMessageContent(latestMsg)
      const preview = latestContent?.content?.substring(0, 100) || `[${latestContent?.messageType || 'message'}]`

      await supabaseAdmin
        .from('whatsapp_conversations')
        .upsert({
          connection_id: state.connectionId,
          user_id: state.userId,
          company_id: state.companyId,
          contact_phone: contactPhone,
          contact_name: contactName,
          last_message_at: latestTimestamp.toISOString(),
          last_message_preview: preview,
          unread_count: 0,
          message_count: messagesToInsert.length + existingIds.size,
          updated_at: new Date().toISOString()
        }, { onConflict: 'connection_id,contact_phone' })
    }
  } catch {}
}

async function syncChatHistory(state: ClientState): Promise<void> {
  try {
    const client = state.client
    const chats = await client.getChats()

    console.log(`[WA] Found ${chats.length} chats, syncing...`)

    // Only sync individual chats, limit to 50 for speed
    const individualChats = chats.filter(chat => !chat.isGroup).slice(0, 50)

    // Process chats in parallel batches of 5
    const batchSize = 5
    for (let i = 0; i < individualChats.length; i += batchSize) {
      const batch = individualChats.slice(i, i + batchSize)
      await Promise.allSettled(batch.map(chat => processSingleChat(chat, state)))
    }

    console.log(`[WA] Sync complete for user ${state.userId}`)
  } catch (error) {
    console.error('[WA] Error syncing:', error)
  }
}

async function handleIncomingMessage(state: ClientState, msg: Message, fromMe: boolean): Promise<void> {
  try {
    const chat = await msg.getChat()
    if (chat.isGroup) return
    if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return

    const contact = await chat.getContact()
    const contactName = contact?.pushname || contact?.name || chat.name || null

    const targetId = fromMe ? (msg.to || '') : (msg.from || '')

    // Check cache first for contact phone
    let contactPhone = contactPhoneCache.get(targetId)

    if (!contactPhone) {
      const resolved = await resolveContactPhone(targetId, contact, state)
      if (!resolved) return
      contactPhone = resolved.contactPhone
    }

    if (!contactPhone || contactPhone === state.phoneNumber) return

    const extracted = extractMessageContent(msg)
    if (!extracted) return

    const { messageType, content, mediaMimeType } = extracted
    const direction = fromMe ? 'outbound' : 'inbound'
    const msgTimestamp = new Date(msg.timestamp * 1000)
    const isLidContact = targetId.endsWith('@lid')

    // Insert message and upsert conversation in parallel
    const messageInsert = supabaseAdmin
      .from('whatsapp_messages')
      .insert({
        connection_id: state.connectionId,
        user_id: state.userId,
        company_id: state.companyId,
        wa_message_id: msg.id._serialized,
        contact_phone: contactPhone,
        contact_name: contactName,
        direction,
        message_type: messageType,
        content,
        media_id: null,
        media_mime_type: mediaMimeType,
        message_timestamp: msgTimestamp.toISOString(),
        status: fromMe ? 'sent' : 'delivered',
        raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: targetId, is_lid: isLidContact }
      })

    const messagePreview = content?.substring(0, 100) || `[${messageType}]`
    const convUpsert = supabaseAdmin
      .from('whatsapp_conversations')
      .upsert({
        connection_id: state.connectionId,
        user_id: state.userId,
        company_id: state.companyId,
        contact_phone: contactPhone,
        contact_name: contactName,
        last_message_at: msgTimestamp.toISOString(),
        last_message_preview: messagePreview,
        unread_count: direction === 'inbound' ? 1 : 0,
        message_count: 1,
        updated_at: new Date().toISOString()
      }, { onConflict: 'connection_id,contact_phone', ignoreDuplicates: false })

    await Promise.allSettled([messageInsert, convUpsert])
  } catch {}
}
