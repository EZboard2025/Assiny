// WhatsApp Web.js Client Manager (Singleton)
// Each user gets their own WhatsApp client instance
// Messages are saved to Supabase via event handlers

import { Client, LocalAuth, Message } from 'whatsapp-web.js'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import OpenAI, { toFile } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

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
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error'
  error: string | null
  phoneNumber: string | null
  lastHeartbeat: number
  destroyed: boolean  // Flag to abort running sync when client is destroyed
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
    webVersionCache: {
      type: 'none' // Always load latest WhatsApp Web version (prevents stale version issues)
    },
    puppeteer: {
      headless: true,
      protocolTimeout: 180000, // 180s timeout for slow operations (getChats can be slow under memory pressure)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--mute-audio',
        '--hide-scrollbars',
        // Memory optimization for multi-user support
        '--js-flags=--max-old-space-size=384',
        '--disable-software-rasterizer',
        '--disable-logging',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--renderer-process-limit=1',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows'
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
    syncStatus: 'pending',
    error: null,
    phoneNumber: null,
    lastHeartbeat: Date.now(),
    destroyed: false
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

  // Authentication event - start a timeout for ready
  let readyTimeout: NodeJS.Timeout | null = null
  client.on('authenticated', () => {
    console.log(`[WA] Authenticated for user ${userId}`)
    state.status = 'connecting'

    // If ready doesn't fire within 90s, the session is likely corrupted
    if (readyTimeout) clearTimeout(readyTimeout)
    readyTimeout = setTimeout(async () => {
      if (state.status === 'connecting') {
        console.error(`[WA] Ready timeout for user ${userId} - destroying stuck client`)
        state.destroyed = true
        state.status = 'error'
        state.error = 'Conexao travou. Tente novamente.'
        initializingUsers.delete(userId)
        try { await client.destroy() } catch {}
        clients.delete(userId)

        // Delete cached session to prevent re-corruption
        try {
          const sessionPath = `${getAuthPath()}/session-user_${userId.replace(/-/g, '').substring(0, 16)}`
          const fs = await import('fs')
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true })
            console.log(`[WA] Cleared corrupted session cache for user ${userId}`)
          }
        } catch (e) {
          console.error(`[WA] Error clearing session cache:`, e)
        }
      }
    }, 90000)
  })

  // Ready event (fully connected) - guard against duplicate fires
  let readyFired = false
  client.on('ready', async () => {
    if (readyFired || state.destroyed) return
    readyFired = true
    console.log(`[WA] Ready for user ${userId}`)
    if (readyTimeout) { clearTimeout(readyTimeout); readyTimeout = null }
    state.status = 'connected'
    state.qrCode = null
    state.lastHeartbeat = Date.now()
    initializingUsers.delete(userId)

    const info = client.info
    state.phoneNumber = info?.wid?.user || null

    await upsertConnection(state)

    // Wait for Chrome to fully settle before syncing (prevents getChats timeout)
    console.log(`[WA] Waiting 10s before sync for user ${userId}...`)
    await new Promise(resolve => setTimeout(resolve, 10000))

    if (state.destroyed) return  // Check again after delay

    // Sync in background (don't block)
    state.syncStatus = 'syncing'
    syncChatHistory(state).then(() => {
      if (!state.destroyed) state.syncStatus = 'synced'
    }).catch(err => {
      console.error('[WA] Sync error:', err)
      if (!state.destroyed) state.syncStatus = 'error'
    })
  })

  // Message received
  client.on('message', async (msg: Message) => {
    console.log(`[WA] Message received from ${msg.from}, status=${state.status}, connectionId=${state.connectionId}`)
    if (state.status !== 'connected' || !state.connectionId) {
      console.log(`[WA] Skipping message - not ready`)
      return
    }
    handleIncomingMessage(state, msg, false)
  })

  // Message sent by us
  client.on('message_create', async (msg: Message) => {
    if (!msg.fromMe) return
    console.log(`[WA] Message sent to ${msg.to}, status=${state.status}, connectionId=${state.connectionId}`)
    if (state.status !== 'connected' || !state.connectionId) {
      console.log(`[WA] Skipping outbound message - not ready`)
      return
    }
    handleIncomingMessage(state, msg, true)
  })

  // Disconnected - fully destroy client to prevent stale Puppeteer state
  client.on('disconnected', async (reason: string) => {
    console.log(`[WA] Disconnected for user ${userId}: ${reason}. Destroying client.`)
    state.destroyed = true  // Signal running sync to abort
    initializingUsers.delete(userId)

    if (state.connectionId) {
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('id', state.connectionId)
    }

    // Destroy the Puppeteer instance to prevent broken context issues
    try { await client.destroy() } catch {}
    clients.delete(userId)
    console.log(`[WA] Client destroyed and removed for user ${userId}`)
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

  // Signal running sync to abort immediately
  state.destroyed = true

  // Remove from map immediately so UI sees disconnected state
  clients.delete(userId)

  // Update DB immediately (don't wait for Puppeteer cleanup)
  if (state.connectionId) {
    await supabaseAdmin
      .from('whatsapp_connections')
      .delete()
      .eq('id', state.connectionId)
  }

  // Cleanup Puppeteer with timeout (logout/destroy can hang on bad browser state)
  const cleanup = async () => {
    try { await state.client.logout() } catch {}
    try { await state.client.destroy() } catch {}
  }
  const timeout = new Promise<void>(resolve => setTimeout(resolve, 10000))
  await Promise.race([cleanup(), timeout])
  console.log(`[WA] Disconnect complete for user ${userId}`)
}

export function getConnectedClient(userId: string): Client | null {
  const state = clients.get(userId)
  if (!state || state.status !== 'connected') return null
  return state.client
}

export function updateHeartbeat(userId: string): boolean {
  const state = clients.get(userId)
  if (!state) return false
  state.lastHeartbeat = Date.now()
  return true
}

// Manual sync trigger (called from API when user clicks "Sync")
export async function triggerSync(userId: string): Promise<{ success: boolean; error?: string }> {
  const state = clients.get(userId)
  if (!state) return { success: false, error: 'Client not connected' }
  if (state.status !== 'connected') return { success: false, error: 'Client not in connected state' }

  // Allow retry even if previous sync is stuck (reset from 'syncing' state)
  // The getChats timeout ensures old syncs won't run forever
  state.syncStatus = 'syncing'
  try {
    await syncChatHistory(state)
    state.syncStatus = 'synced'
    return { success: true }
  } catch (err: any) {
    state.syncStatus = 'error'
    return { success: false, error: err.message || 'Sync failed' }
  }
}

// ============================================
// TTL Reaper: Auto-disconnect stale clients
// ============================================

const TTL_CHECK_INTERVAL_MS = 30_000  // Check every 30s
const TTL_THRESHOLD_MS = 180_000      // Disconnect if no heartbeat for 3 min (browser throttles bg tabs to ~1x/min)

const reaperInterval = setInterval(async () => {
  const now = Date.now()

  for (const [userId, state] of clients.entries()) {
    // Only reap connected clients — initializing/qr_ready/connecting don't receive heartbeats
    if (state.status !== 'connected') continue

    const elapsed = now - state.lastHeartbeat

    if (elapsed > TTL_THRESHOLD_MS) {
      console.log(
        `[WA TTL] Client for user ${userId} expired (last heartbeat ${Math.round(elapsed / 1000)}s ago, status=${state.status}). Auto-disconnecting...`
      )
      try {
        await disconnectClient(userId)
      } catch (err) {
        console.error(`[WA TTL] Error disconnecting user ${userId}:`, err)
        clients.delete(userId)
      }
    }
  }
}, TTL_CHECK_INTERVAL_MS)

// Prevent the interval from keeping Node.js alive during shutdown
if (reaperInterval.unref) {
  reaperInterval.unref()
}

// Clean up orphaned DB connections on server restart
;(async () => {
  try {
    const { count } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    if (count && count > 0) {
      console.log(`[WA Startup] Found ${count} orphaned active connections, marking as disconnected`)
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('status', 'active')
    }
  } catch (err) {
    console.error('[WA Startup] Error cleaning orphaned connections:', err)
  }
})()

// ============================================
// Internal helpers
// ============================================

async function upsertConnection(state: ClientState): Promise<void> {
  // First check if connection exists for this user
  const { data: existing } = await supabaseAdmin
    .from('whatsapp_connections')
    .select('id')
    .eq('user_id', state.userId)
    .single()

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from('whatsapp_connections')
      .update({
        status: 'active',
        phone_number_id: state.phoneNumber || 'wwebjs',
        display_phone_number: state.phoneNumber,
        connected_at: new Date().toISOString(),
        last_webhook_at: new Date().toISOString()
      })
      .eq('id', existing.id)

    if (updateError) {
      console.error(`[WA] Failed to update connection:`, updateError)
    }
    state.connectionId = existing.id
    console.log(`[WA] Connection updated: ${state.connectionId}`)
  } else {
    // Check if phone_number_id is already used by another user (and delete if so)
    if (state.phoneNumber) {
      const { data: existingByPhone } = await supabaseAdmin
        .from('whatsapp_connections')
        .select('id, user_id')
        .eq('phone_number_id', state.phoneNumber)
        .single()

      if (existingByPhone && existingByPhone.user_id !== state.userId) {
        console.log(`[WA] Phone ${state.phoneNumber} was connected to another user, cleaning up...`)
        // Delete old connection and related data
        await supabaseAdmin.from('whatsapp_messages').delete().eq('connection_id', existingByPhone.id)
        await supabaseAdmin.from('whatsapp_conversations').delete().eq('connection_id', existingByPhone.id)
        await supabaseAdmin.from('whatsapp_connections').delete().eq('id', existingByPhone.id)
      }
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('whatsapp_connections')
      .insert({
        user_id: state.userId,
        company_id: state.companyId,
        phone_number_id: state.phoneNumber || `wwebjs_${state.userId.substring(0, 8)}`,
        waba_id: 'wwebjs',
        display_phone_number: state.phoneNumber,
        access_token: 'wwebjs_session',
        status: 'active',
        connected_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (insertError) {
      console.error(`[WA] Failed to insert connection:`, insertError)
      state.connectionId = null
    } else {
      state.connectionId = inserted?.id || null
      console.log(`[WA] Connection created: ${state.connectionId}`)
    }
  }
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
async function processSingleChat(chat: any, state: ClientState, isGroup = false): Promise<void> {
  try {
    const chatIdSerialized = chat.id._serialized || ''
    let contactPhone: string
    let contactName: string | null
    let profilePicUrl: string | null = null
    let isLidContact = false

    if (isGroup) {
      // For groups: use group ID as contact_phone, group name as contact_name
      contactPhone = chatIdSerialized
      contactName = chat.name || 'Grupo'

      try {
        profilePicUrl = await chat.getProfilePicUrl?.() || null
      } catch {}
    } else {
      const contact = await chat.getContact()
      contactName = contact?.pushname || contact?.name || chat.name || null

      try {
        profilePicUrl = await contact?.getProfilePicUrl() || null
      } catch {}

      const resolved = await resolveContactPhone(chatIdSerialized, contact, state)
      if (!resolved) return

      contactPhone = resolved.contactPhone
      isLidContact = resolved.isLidContact
    }

    // Fetch only last 15 messages per chat (fast initial sync, reduces memory pressure)
    const messages = await chat.fetchMessages({ limit: 15 })
    if (messages.length === 0) return

    // Get existing message IDs in bulk
    const messageIds = messages.map((m: Message) => m.id._serialized)
    const { data: existingMsgs } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('wa_message_id')
      .in('wa_message_id', messageIds)

    const existingIds = new Set(existingMsgs?.map(m => m.wa_message_id) || [])

    // Prepare batch insert - separate media and non-media messages
    const nonMediaMessages: any[] = []
    const mediaMessages: { msg: any; extracted: { messageType: string; content: string; mediaMimeType: string | null } }[] = []
    let lastMessageAt: Date | null = null
    let lastMessagePreview = ''

    for (const msg of messages) {
      if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') continue
      if (existingIds.has(msg.id._serialized)) continue

      const extracted = extractMessageContent(msg)
      if (!extracted) continue

      const { messageType, content, mediaMimeType } = extracted
      const msgTimestamp = new Date(msg.timestamp * 1000)

      // For groups, resolve sender name for non-fromMe messages
      let msgContactName = contactName
      if (isGroup && !msg.fromMe) {
        try {
          const senderContact = await msg.getContact()
          msgContactName = senderContact?.pushname || senderContact?.name || msg.author || contactName
        } catch {
          msgContactName = msg.author || contactName
        }
      }

      const baseMessage = {
        connection_id: state.connectionId,
        user_id: state.userId,
        company_id: state.companyId,
        wa_message_id: msg.id._serialized,
        contact_phone: contactPhone,
        contact_name: msgContactName,
        direction: msg.fromMe ? 'outbound' : 'inbound',
        message_type: messageType,
        content,
        media_id: null as string | null,
        media_mime_type: mediaMimeType,
        message_timestamp: msgTimestamp.toISOString(),
        status: msg.fromMe ? 'sent' : 'delivered',
        raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: chatIdSerialized, is_lid: isLidContact, is_group: isGroup }
      }

      // Separate media messages for individual processing
      if (msg.hasMedia && ['audio', 'ptt', 'image', 'video', 'document', 'sticker'].includes(messageType)) {
        mediaMessages.push({ msg, extracted })
      } else {
        nonMediaMessages.push(baseMessage)
      }

      if (!lastMessageAt || msgTimestamp > lastMessageAt) {
        lastMessageAt = msgTimestamp
        lastMessagePreview = content?.substring(0, 100) || `[${messageType}]`
      }
    }

    // Insert all messages in batch (skip media downloads during sync for speed)
    // Media files will be downloaded on-demand when user opens the conversation
    const allInsertMessages = [
      ...nonMediaMessages,
      ...mediaMessages.map(({ msg, extracted }) => {
        let msgContactName = contactName
        if (isGroup && !msg.fromMe) {
          msgContactName = msg.author || contactName
        }
        return {
          connection_id: state.connectionId,
          user_id: state.userId,
          company_id: state.companyId,
          wa_message_id: msg.id._serialized,
          contact_phone: contactPhone,
          contact_name: msgContactName,
          direction: msg.fromMe ? 'outbound' : 'inbound',
          message_type: extracted.messageType,
          content: extracted.content,
          media_id: null,
          media_mime_type: extracted.mediaMimeType,
          message_timestamp: new Date(msg.timestamp * 1000).toISOString(),
          status: msg.fromMe ? 'sent' : 'delivered',
          raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: chatIdSerialized, is_lid: isLidContact, is_group: isGroup }
        }
      })
    ]

    if (allInsertMessages.length > 0) {
      try {
        await supabaseAdmin.from('whatsapp_messages').insert(allInsertMessages)
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
          profile_pic_url: profilePicUrl,
          last_message_at: latestTimestamp.toISOString(),
          last_message_preview: preview,
          unread_count: 0,
          message_count: nonMediaMessages.length + mediaMessages.length + existingIds.size,
          updated_at: new Date().toISOString()
        }, { onConflict: 'connection_id,contact_phone' })
    }
  } catch (err: any) {
    console.error(`[Sync] Error processing chat:`, err.message || err)
  }
}

async function syncChatHistory(state: ClientState): Promise<void> {
  try {
    if (state.destroyed) { console.log(`[WA] Sync aborted (destroyed) for user ${state.userId}`); return }
    const client = state.client

    // LIGHTWEIGHT APPROACH: Get chat IDs directly from WhatsApp Web store
    // instead of using client.getChats() which serializes every chat + group metadata (very slow)
    console.log(`[WA] Getting chat list (lightweight) for user ${state.userId}`)

    let chatIds: { id: string; name: string; isGroup: boolean }[] = []

    try {
      chatIds = await Promise.race([
        client.pupPage!.evaluate(() => {
          const chats = (window as any).Store.Chat.getModelsArray()
          return chats.map((chat: any) => ({
            id: chat.id._serialized,
            name: chat.formattedTitle || chat.name || chat.id.user || '',
            isGroup: chat.isGroup || chat.id._serialized.endsWith('@g.us')
          }))
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Chat list fetch timed out after 30s')), 30000)
        )
      ])
    } catch (err: any) {
      console.error(`[WA] Failed to get chat list:`, err.message || err)
      throw err
    }

    if (state.destroyed) return

    // Include both individual chats and groups, limit to 40
    const filteredChats = chatIds.slice(0, 40)
    const groupCount = filteredChats.filter(c => c.isGroup).length
    console.log(`[WA] Found ${chatIds.length} total chats (${groupCount} groups). Syncing ${filteredChats.length}...`)

    if (filteredChats.length === 0) {
      console.log(`[WA] No chats found for user ${state.userId}`)
      return
    }

    // Process chats one by one, fetching each chat object individually (lighter than getChats)
    for (let i = 0; i < filteredChats.length; i++) {
      if (state.destroyed) { console.log(`[WA] Sync aborted mid-batch for user ${state.userId}`); return }

      try {
        const chatInfo = filteredChats[i]
        const chat = await Promise.race([
          client.getChatById(chatInfo.id),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`getChatById timed out for ${chatInfo.id}`)), 15000)
          )
        ])
        await processSingleChat(chat, state, chatInfo.isGroup)
      } catch (chatErr: any) {
        console.error(`[WA] Error processing chat ${filteredChats[i].id}:`, chatErr.message || chatErr)
        // Continue with next chat instead of failing the entire sync
      }
    }

    console.log(`[WA] Sync complete for user ${state.userId}`)
  } catch (error) {
    if (state.destroyed) return  // Don't propagate errors for destroyed clients
    console.error('[WA] Error syncing:', error)
    throw error // Re-throw so caller can set syncStatus to 'error'
  }
}

async function handleIncomingMessage(state: ClientState, msg: Message, fromMe: boolean): Promise<void> {
  try {
    console.log(`[WA] Processing message: type=${msg.type}, fromMe=${fromMe}, body=${msg.body?.substring(0, 50) || '[no body]'}`)
    const chat = await msg.getChat()
    if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return

    const isGroup = chat.isGroup || false
    let contactPhone: string
    let contactName: string | null
    let convContactName: string | null  // Name for the conversation record (group name for groups)
    let profilePicUrl: string | null = null
    let isLidContact = false

    if (isGroup) {
      // For groups: use group ID as contact_phone, group name as conversation name
      contactPhone = chat.id._serialized
      convContactName = chat.name || 'Grupo'

      // For individual messages, resolve the sender's name
      if (fromMe) {
        contactName = 'Você'
      } else {
        try {
          const senderContact = await msg.getContact()
          contactName = senderContact?.pushname || senderContact?.name || (msg as any).author || convContactName
        } catch {
          contactName = (msg as any).author || convContactName
        }
      }
    } else {
      const contact = await chat.getContact()
      contactName = contact?.pushname || contact?.name || chat.name || null
      convContactName = contactName

      if (!fromMe) {
        try {
          profilePicUrl = await contact?.getProfilePicUrl() || null
        } catch {}
      }

      const targetId = fromMe ? (msg.to || '') : (msg.from || '')
      let resolved = contactPhoneCache.get(targetId)
        ? { contactPhone: contactPhoneCache.get(targetId)!, isLidContact: targetId.endsWith('@lid') }
        : await resolveContactPhone(targetId, contact, state)
      if (!resolved) return
      contactPhone = resolved.contactPhone
      isLidContact = resolved.isLidContact

      if (!contactPhone || contactPhone === state.phoneNumber) return
    }

    const extracted = extractMessageContent(msg)
    if (!extracted) return

    const { messageType, content, mediaMimeType } = extracted
    const direction = fromMe ? 'outbound' : 'inbound'
    const msgTimestamp = new Date(msg.timestamp * 1000)

    // Download and save media if present
    let mediaId: string | null = null
    if (msg.hasMedia && (messageType === 'audio' || messageType === 'image' || messageType === 'video' || messageType === 'document' || messageType === 'sticker')) {
      try {
        const media = await msg.downloadMedia()
        if (media?.data) {
          const ext = messageType === 'audio' ? 'ogg' :
                      messageType === 'image' ? 'jpg' :
                      messageType === 'video' ? 'mp4' :
                      messageType === 'sticker' ? 'webp' : 'bin'
          mediaId = `${state.userId}/${Date.now()}_${msg.id._serialized.slice(-8)}.${ext}`

          const buffer = Buffer.from(media.data, 'base64')
          await supabaseAdmin.storage
            .from('whatsapp-media')
            .upload(mediaId, buffer, {
              contentType: media.mimetype || mediaMimeType || 'application/octet-stream',
              upsert: true
            })

          console.log(`[WA] Media saved: ${mediaId}`)

          if (messageType === 'audio') {
            transcribeAudioMessage(buffer, msg.id._serialized, state.userId).catch(() => {})
          }
        }
      } catch (err) {
        console.error('[WA] Failed to download/save media:', err)
      }
    }

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
        media_id: mediaId,
        media_mime_type: mediaMimeType,
        message_timestamp: msgTimestamp.toISOString(),
        status: fromMe ? 'sent' : 'delivered',
        raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: chat.id._serialized, is_lid: isLidContact, is_group: isGroup }
      })

    const messagePreview = content?.substring(0, 100) || `[${messageType}]`
    const convData: any = {
      connection_id: state.connectionId,
      user_id: state.userId,
      company_id: state.companyId,
      contact_phone: contactPhone,
      contact_name: convContactName,
      last_message_at: msgTimestamp.toISOString(),
      last_message_preview: messagePreview,
      unread_count: direction === 'inbound' ? 1 : 0,
      message_count: 1,
      updated_at: new Date().toISOString()
    }
    if (profilePicUrl) {
      convData.profile_pic_url = profilePicUrl
    }
    const convUpsert = supabaseAdmin
      .from('whatsapp_conversations')
      .upsert(convData, { onConflict: 'connection_id,contact_phone', ignoreDuplicates: false })

    const [msgResult, convResult] = await Promise.allSettled([messageInsert, convUpsert])

    if (msgResult.status === 'rejected') {
      console.error(`[WA] Failed to insert message:`, msgResult.reason)
    }
    if (convResult.status === 'rejected') {
      console.error(`[WA] Failed to upsert conversation:`, convResult.reason)
    }

    console.log(`[WA] Message processed: ${direction} ${messageType} from ${contactPhone}`)

    // === COPILOT AUTO-LEARNING HOOKS (non-blocking, skip groups) ===
    if (messageType === 'text' && content && !isGroup) {
      if (fromMe) {
        // Seller sent a message → track it for outcome analysis
        trackSellerMessage(state, contactPhone, contactName, content, msgTimestamp).catch((err: any) =>
          console.error('[WA] trackSellerMessage error:', err.message || err)
        )
      } else {
        // Client responded → trigger automatic outcome analysis
        triggerOutcomeAnalysis(state, contactPhone, content).catch((err: any) =>
          console.error('[WA] triggerOutcomeAnalysis error:', err.message || err)
        )
      }
    }
  } catch (error) {
    console.error(`[WA] Error handling message:`, error)
  }
}

// === AUDIO TRANSCRIPTION (Whisper) ===

async function transcribeAudioMessage(
  mediaBuffer: Buffer,
  messageId: string,
  userId: string
): Promise<void> {
  try {
    const file = await toFile(mediaBuffer, 'audio.ogg', { type: 'audio/ogg' })

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'pt',
      prompt: 'Transcrição de áudio de conversa de vendas no WhatsApp em português brasileiro.'
    })

    const text = transcription.text?.trim()
    if (!text) return

    await supabaseAdmin
      .from('whatsapp_messages')
      .update({ transcription: text })
      .eq('wa_message_id', messageId)
      .eq('user_id', userId)

    console.log(`[WA] Transcribed audio ${messageId}: ${text.substring(0, 80)}...`)
  } catch (err: any) {
    console.error(`[WA] Transcription failed for ${messageId}:`, err.message || err)
  }
}

// === COPILOT AUTO-LEARNING FUNCTIONS ===

async function trackSellerMessage(
  state: ClientState,
  contactPhone: string,
  contactName: string | null,
  content: string,
  msgTimestamp: Date
): Promise<void> {
  // Fetch recent conversation context from DB
  const { data: recentMsgs } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('direction, content, message_timestamp')
    .eq('contact_phone', contactPhone)
    .eq('user_id', state.userId)
    .order('message_timestamp', { ascending: false })
    .limit(10)

  const context = (recentMsgs || [])
    .reverse()
    .map((m: any) => {
      const sender = m.direction === 'outbound' ? 'Vendedor' : (contactName || 'Cliente')
      const time = new Date(m.message_timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      return `[${time}] ${sender}: ${m.content || '[mídia]'}`
    })
    .join('\n')

  await supabaseAdmin
    .from('seller_message_tracking')
    .insert({
      user_id: state.userId,
      company_id: state.companyId,
      contact_phone: contactPhone,
      contact_name: contactName,
      seller_message: content.slice(0, 2000),
      conversation_context: context.slice(0, 5000),
      message_timestamp: msgTimestamp.toISOString()
    })

  console.log(`[WA] Tracked seller message to ${contactPhone}`)
}

async function triggerOutcomeAnalysis(
  state: ClientState,
  contactPhone: string,
  clientResponse: string
): Promise<void> {
  // Call analyze-outcome API internally (fire-and-forget)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  await fetch(`${baseUrl}/api/copilot/analyze-outcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contactPhone,
      clientResponse: clientResponse.slice(0, 2000),
      companyId: state.companyId,
      userId: state.userId
    })
  })

  console.log(`[WA] Triggered outcome analysis for ${contactPhone}`)
}
