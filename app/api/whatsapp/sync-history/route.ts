import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient, getClientState } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Sync historical messages from WhatsApp for a specific contact
export async function POST(request: NextRequest) {
  try {
    const { contactPhone, limit = 50 } = await request.json()

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

    // Get WhatsApp client
    const client = getConnectedClient(user.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 })
    }

    // Get client state for connectionId
    const clientState = getClientState(user.id)
    if (!clientState?.connectionId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 400 })
    }

    // Normalize phone to find the chat
    // Try different formats: with @c.us, with lid_, etc.
    let chat = null
    const phoneDigits = contactPhone.replace(/\D/g, '')

    // Try formats: direct, with @c.us, with lid_ prefix
    const formatsToTry = [
      contactPhone,
      `${phoneDigits}@c.us`,
      `${contactPhone}@c.us`,
    ]

    // If it's a lid_ format, also try without it
    if (contactPhone.startsWith('lid_')) {
      const lidNumber = contactPhone.replace('lid_', '')
      formatsToTry.push(`${lidNumber}@lid`)
      formatsToTry.push(contactPhone.replace('lid_', '') + '@c.us')
    }

    for (const format of formatsToTry) {
      try {
        chat = await client.getChatById(format)
        if (chat) {
          console.log(`[Sync] Found chat with format: ${format}`)
          break
        }
      } catch {
        // Try next format
      }
    }

    if (!chat) {
      // Try to get all chats and find by matching phone
      try {
        const allChats = await client.getChats()
        const normalizedPhone = phoneDigits.slice(-9) // Last 9 digits

        chat = allChats.find(c => {
          const chatPhone = c.id._serialized.replace(/\D/g, '')
          return chatPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(chatPhone.slice(-9))
        })

        if (chat) {
          console.log(`[Sync] Found chat by searching: ${chat.id._serialized}`)
        }
      } catch (e) {
        console.error('[Sync] Error searching chats:', e)
      }
    }

    if (!chat) {
      return NextResponse.json({
        error: 'Chat not found in WhatsApp',
        synced: 0
      }, { status: 404 })
    }

    // Fetch messages from the chat
    console.log(`[Sync] Fetching up to ${limit} messages from chat ${chat.id._serialized}`)
    const messages = await chat.fetchMessages({ limit: Math.min(limit, 100) })
    console.log(`[Sync] Fetched ${messages.length} messages from WhatsApp`)

    // Get existing message IDs to avoid duplicates
    const { data: existingMessages } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('wa_message_id')
      .eq('user_id', user.id)

    const existingIds = new Set(existingMessages?.map(m => m.wa_message_id) || [])

    // Process and save new messages
    let syncedCount = 0
    const contactName = chat.name || contactPhone

    for (const msg of messages) {
      // Skip if already exists
      if (existingIds.has(msg.id._serialized)) {
        continue
      }

      // Determine message type and content
      let messageType = 'text'
      let content = msg.body || ''
      let mediaMimeType: string | null = null

      if (msg.hasMedia) {
        if (msg.type === 'image') messageType = 'image'
        else if (msg.type === 'audio' || msg.type === 'ptt') messageType = msg.type
        else if (msg.type === 'video') messageType = 'video'
        else if (msg.type === 'document') messageType = 'document'
        else if (msg.type === 'sticker') messageType = 'sticker'

        // Try to get media info
        try {
          const media = await msg.downloadMedia()
          if (media) {
            mediaMimeType = media.mimetype
          }
        } catch {
          // Media might not be available anymore
        }
      }

      // Skip system messages
      if (['notification_template', 'e2e_notification', 'call_log', 'gp2'].includes(msg.type)) {
        continue
      }

      const direction = msg.fromMe ? 'outbound' : 'inbound'
      const msgContactPhone = contactPhone // Use the phone we're syncing

      // Insert message
      const { error: insertError } = await supabaseAdmin
        .from('whatsapp_messages')
        .insert({
          user_id: user.id,
          connection_id: clientState.connectionId,
          wa_message_id: msg.id._serialized,
          contact_phone: msgContactPhone,
          contact_name: contactName,
          direction,
          message_type: messageType,
          content,
          media_mime_type: mediaMimeType,
          status: 'delivered',
          message_timestamp: new Date(msg.timestamp * 1000).toISOString(),
          raw_payload: {
            hasMedia: msg.hasMedia,
            type: msg.type,
            isForwarded: msg.isForwarded,
            isStarred: msg.isStarred
          }
        })

      if (!insertError) {
        syncedCount++
      } else {
        console.error(`[Sync] Error inserting message:`, insertError)
      }
    }

    // Update conversation message count
    if (syncedCount > 0) {
      const { data: conv } = await supabaseAdmin
        .from('whatsapp_conversations')
        .select('message_count')
        .eq('user_id', user.id)
        .eq('contact_phone', contactPhone)
        .single()

      if (conv) {
        await supabaseAdmin
          .from('whatsapp_conversations')
          .update({
            message_count: (conv.message_count || 0) + syncedCount,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('contact_phone', contactPhone)
      }
    }

    console.log(`[Sync] Synced ${syncedCount} new messages for ${contactPhone}`)

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: messages.length
    })

  } catch (error: any) {
    console.error('Error syncing history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync history', synced: 0 },
      { status: 500 }
    )
  }
}
