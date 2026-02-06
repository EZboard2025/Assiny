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

    // Only sync individual chats, skip groups - get all chats for full history
    const individualChats = chats.filter(chat => !chat.isGroup).slice(0, 100) // Limit to 100 most recent

    for (const chat of individualChats) {
      try {
        // Get contact info
        const contact = await chat.getContact()
        const contactName = contact?.pushname || contact?.name || chat.name || null

        // Get the actual phone number - handle LID (Linked Device ID) format
        // LID format: 80303171309822@lid (internal WhatsApp ID, NOT a phone number)
        // Phone format: 5531967884482@c.us (actual phone number)
        let contactPhone: string
        const chatIdSerialized = chat.id._serialized || ''
        const isLidContact = chatIdSerialized.endsWith('@lid')

        if (isLidContact) {
          // This is a LID, need to get phone from contact.number
          // LID contacts don't have a real phone number in the chat ID - we need to find it elsewhere
          const lidNumber = chat.id.user // e.g., "83425679642877"
          let rawPhone = (contact as any)?.number || ''

          // Fallback 1: Try to extract from contact.id if it's not a LID
          if (!rawPhone && contact?.id?.user && !contact.id._serialized?.endsWith('@lid')) {
            rawPhone = contact.id.user
          }

          // Fallback 2: Try getFormattedNumber() method
          if (!rawPhone) {
            try {
              const formattedNumber = await (contact as any).getFormattedNumber?.()
              if (formattedNumber) {
                rawPhone = formattedNumber
              }
            } catch (e) {
              console.log(`[WA] getFormattedNumber failed for ${contactName || chatIdSerialized}`)
            }
          }

          // Normalize phone to digits only for comparison
          const normalizedPhone = rawPhone ? String(rawPhone).replace(/[^0-9]/g, '') : ''

          console.log(`[WA] LID detected - contact.number: "${(contact as any)?.number}", rawPhone: "${rawPhone}", normalizedPhone: "${normalizedPhone}", lidNumber: "${lidNumber}", name: "${contactName}"`)

          // Validate if this is a real phone number:
          // - Must have 8-15 digits (international phone numbers vary in length)
          // - Must NOT be the same as the LID number (this is the key check!)
          // - If contact.number returns the LID itself, it means we don't have the real phone
          const isValidPhone = normalizedPhone &&
                               normalizedPhone.length >= 8 &&
                               normalizedPhone.length <= 15 &&
                               normalizedPhone !== lidNumber

          if (isValidPhone) {
            contactPhone = normalizedPhone
            console.log(`[WA] Valid phone found for LID contact: ${contactName || chatIdSerialized} -> ${contactPhone}`)
          } else {
            // Not a valid phone or it's the LID number itself - use LID identifier
            contactPhone = `lid_${lidNumber}`
            console.log(`[WA] Using LID identifier for: ${contactName || chatIdSerialized} -> ${contactPhone} (normalizedPhone="${normalizedPhone}" is same as LID or invalid)`)
          }
        } else {
          // Regular @c.us format - user field contains the phone number
          contactPhone = chat.id.user
        }

        // Skip if we couldn't get any identifier
        if (!contactPhone) {
          console.log(`[WA] Skipping chat - no identifier found for: ${contactName || chatIdSerialized}`)
          continue
        }

        // Skip if this is the user's own number (conversations with yourself)
        if (state.phoneNumber && contactPhone === state.phoneNumber) {
          console.log(`[WA] Skipping chat - this is the user's own number: ${contactPhone}`)
          continue
        }

        console.log(`[WA] Chat ID: ${chatIdSerialized}, contactPhone: ${contactPhone}, name: ${contactName}`)

        // Fetch last 100 messages from this chat for full history
        const messages = await chat.fetchMessages({ limit: 100 })

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
          } else if (msg.type === 'e2e_notification' || (msg.type as string) === 'notification' || (msg.type as string) === 'notification_template') {
            // System notifications - skip these
            continue
          } else if ((msg.type as string) === 'interactive' || (msg.type as string) === 'button_reply' || (msg.type as string) === 'list_reply') {
            // Interactive messages (buttons, lists)
            messageType = 'interactive'
            content = msg.body || (msg as any).selectedButtonId || (msg as any).selectedRowId || '[Mensagem interativa]'
          } else if (msg.type === 'chat') {
            // Regular text message - use body directly, with fallback to _data
            content = msg.body || ''
            if (!content && (msg as any)._data?.body) {
              content = (msg as any)._data.body
            }
          } else {
            // Unknown type - use body if available, otherwise skip
            content = msg.body || ''
            if (!content) {
              console.log(`[WA] Skipping unknown message type: ${msg.type}`)
              continue
            }
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
              raw_payload: { type: msg.type, hasMedia: msg.hasMedia, body: msg.body, from: msg.from, to: msg.to, original_chat_id: chatIdSerialized, is_lid: isLidContact }
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

          // Store original chat ID for LID contacts so we can send messages later
          const conversationMetadata = {
            original_chat_id: chatIdSerialized,
            is_lid: isLidContact
          }

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

    // IMPORTANT: For sent messages, msg.getContact() returns the SENDER (ourselves)
    // We need the OTHER party's contact, so use chat.getContact() for 1:1 chats
    const contact = await chat.getContact()
    const contactName = contact?.pushname || contact?.name || chat.name || null

    // Get the actual phone number - handle LID (Linked Device ID) format
    const rawTo = msg.to || ''
    const rawFrom = msg.from || ''
    const targetId = fromMe ? rawTo : rawFrom
    const isLidContact = targetId.endsWith('@lid')

    let contactPhone: string

    // IMPORTANT: For consistency, first check if we already have a conversation with this chat ID
    // This prevents mismatches where sync resolved a phone but later messages can't
    const { data: existingMsgWithChatId } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('contact_phone')
      .eq('connection_id', state.connectionId!)
      .contains('raw_payload', { original_chat_id: targetId })
      .limit(1)
      .single()

    if (existingMsgWithChatId?.contact_phone) {
      // Use the same contact_phone we used before for this chat
      contactPhone = existingMsgWithChatId.contact_phone
      console.log(`[WA] Using existing contact_phone for ${targetId}: ${contactPhone}`)
    } else if (isLidContact) {
      // LID format - get phone from contact.number
      const lidUser = targetId.replace(/@lid$/, '')
      let rawPhone = (contact as any)?.number || ''

      // Fallback 1: Try to extract from contact.id if it's not a LID
      if (!rawPhone && contact?.id?.user && !contact.id._serialized?.endsWith('@lid')) {
        rawPhone = contact.id.user
      }

      // Fallback 2: Try getFormattedNumber() method
      if (!rawPhone) {
        try {
          const formattedNumber = await (contact as any).getFormattedNumber?.()
          if (formattedNumber) {
            rawPhone = formattedNumber
          }
        } catch (e) {
          console.log(`[WA] getFormattedNumber failed for incoming message`)
        }
      }

      // Normalize phone to digits only for comparison
      const normalizedPhone = rawPhone ? String(rawPhone).replace(/[^0-9]/g, '') : ''

      console.log(`[WA] LID message - contact.number: "${(contact as any)?.number}", rawPhone: "${rawPhone}", normalizedPhone: "${normalizedPhone}", lidUser: "${lidUser}"`)

      // Validate if this is a real phone number:
      // - Must have 8-15 digits (international phone numbers vary in length)
      // - Must NOT be the same as the LID number (this is the key check!)
      const isValidPhone = normalizedPhone &&
                           normalizedPhone.length >= 8 &&
                           normalizedPhone.length <= 15 &&
                           normalizedPhone !== lidUser

      if (isValidPhone) {
        contactPhone = normalizedPhone
        console.log(`[WA] Valid phone for LID message: ${contactPhone}`)
      } else {
        contactPhone = `lid_${lidUser}`
        console.log(`[WA] Using LID identifier for message: ${contactPhone} (normalizedPhone="${normalizedPhone}" is same as LID or invalid)`)
      }
    } else {
      // Regular format - extract phone from ID
      contactPhone = targetId.replace(/@.*$/, '')
    }

    // Skip if no identifier
    if (!contactPhone) {
      console.log(`[WA] Skipping message - no identifier for: ${targetId}`)
      return
    }

    // Skip if this is the user's own number
    if (state.phoneNumber && contactPhone === state.phoneNumber) {
      console.log(`[WA] Skipping message - this is the user's own number: ${contactPhone}`)
      return
    }

    // Debug logging
    console.log(`[WA] Message: fromMe=${fromMe}, targetId=${targetId}, contactPhone=${contactPhone}`)

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
    } else if (msg.type === 'e2e_notification' || (msg.type as string) === 'notification' || (msg.type as string) === 'notification_template') {
      // System notifications - skip these
      console.log(`[WA] Skipping notification message type: ${msg.type}`)
      return
    } else if ((msg.type as string) === 'interactive' || (msg.type as string) === 'button_reply' || (msg.type as string) === 'list_reply') {
      // Interactive messages (buttons, lists)
      messageType = 'interactive'
      content = msg.body || (msg as any).selectedButtonId || (msg as any).selectedRowId || '[Mensagem interativa]'
    } else if (msg.type === 'chat') {
      // Regular text message - ensure we get the body
      content = msg.body || ''
      if (!content && (msg as any)._data?.body) {
        content = (msg as any)._data.body
      }
    } else {
      // Unknown type - use body if available, otherwise skip
      content = msg.body || ''
      if (!content) {
        console.log(`[WA] Skipping unknown message type: ${msg.type}`)
        return
      }
    }

    console.log(`[WA] Processed content: "${content?.substring(0, 50)}"`)

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
        raw_payload: { type: msg.type, hasMedia: msg.hasMedia, from: msg.from, to: msg.to, original_chat_id: targetId, is_lid: isLidContact }
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
