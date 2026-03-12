import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface DesktopMessage {
  body: string
  fromMe: boolean
  timestamp: number
  type: string
  sender: string
}

interface SidebarConversation {
  name: string
  phone: string
  lastMessage: string
  unread: number
}

function generateMessageId(
  userId: string,
  contactPhone: string,
  timestamp: number,
  fromMe: boolean,
  body: string
): string {
  const direction = fromMe ? 'out' : 'in'
  // Use body + direction + timestamp for stable dedup across re-scrapes.
  // Timestamp comes from WhatsApp's data-pre-plain-text (stable across scrapes).
  // Round to nearest minute to tolerate minor timestamp drift.
  const tsMinute = Math.floor(timestamp / 60000) * 60000
  const contentHash = createHash('sha256')
    .update(`${body || ''}_${direction}_${tsMinute}`)
    .digest('hex')
    .substring(0, 12)
  return `desktop_${userId}_${contactPhone}_${contentHash}`
}

/**
 * Desktop app sync — handles two modes:
 * 1. Message sync: receives scraped messages for the currently open conversation
 * 2. Conversation list sync: receives sidebar conversation list for ALL visible chats
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()

    // Get company_id from employees table
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const companyId = employee?.company_id || null

    // Find active desktop connection
    const phoneNumberId = `desktop_${user.id}`
    const { data: connection, error: connError } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('phone_number_id', phoneNumberId)
      .eq('status', 'active')
      .single()

    if (!connection) {
      console.warn(`[Desktop Sync] No active desktop connection for ${user.id}`, connError?.message)
      return NextResponse.json({ ok: false, error: 'No active desktop connection', synced: 0 })
    }

    // ─── MODE 1: Conversation List Sync (sidebar) ───────────────────
    if (body.conversationList) {
      const list = body.conversationList as SidebarConversation[]
      console.log(`[Desktop Sync] Conversation list: ${list.length} conversations for user ${user.id}`)

      let upserted = 0
      const now = Date.now()
      for (let i = 0; i < list.length; i++) {
        const conv = list[i]
        if (!conv.phone && !conv.name) continue

        const contactPhone = conv.phone || conv.name
        // Preserve WhatsApp sidebar order: first item = most recent
        // Each subsequent item gets a timestamp 1 second earlier
        const positionBasedTime = new Date(now - (i * 1000)).toISOString()

        const { error } = await supabaseAdmin
          .from('whatsapp_conversations')
          .upsert({
            connection_id: connection.id,
            user_id: user.id,
            company_id: companyId,
            contact_phone: contactPhone,
            contact_name: conv.name || null,
            last_message_preview: conv.lastMessage?.substring(0, 100) || null,
            last_message_at: positionBasedTime,
            unread_count: conv.unread || 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'connection_id,contact_phone', ignoreDuplicates: false })

        if (!error) upserted++
      }

      console.log(`[Desktop Sync] ✓ Conversation list: ${upserted}/${list.length} upserted`)
      return NextResponse.json({ ok: true, upserted, total: list.length })
    }

    // ─── MODE 2: Message Sync (open conversation) ───────────────────
    const { contactPhone, contactName, messages } = body as {
      contactPhone: string
      contactName: string
      messages: DesktopMessage[]
    }

    if (!contactPhone || !messages || messages.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, skipped: 0 })
    }

    console.log(`[Desktop Sync] Messages: "${contactName}" (${contactPhone}), ${messages.length} msgs`)

    // Generate deterministic IDs for all messages
    const generatedIds = messages.map((msg) =>
      generateMessageId(user.id, contactPhone, msg.timestamp, msg.fromMe, msg.body)
    )

    // Bulk check existing messages
    const { data: existingMsgs } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('wa_message_id')
      .in('wa_message_id', generatedIds)

    const existingSet = new Set(existingMsgs?.map(m => m.wa_message_id) || [])

    // Build insert array for new messages only
    const newMessages = messages
      .map((msg, i) => {
        const waMessageId = generatedIds[i]
        if (existingSet.has(waMessageId)) return null

        const ts = new Date(msg.timestamp)
        const messageTimestamp = isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString()

        return {
          connection_id: connection.id,
          user_id: user.id,
          company_id: companyId,
          wa_message_id: waMessageId,
          contact_phone: contactPhone,
          contact_name: msg.fromMe ? null : (contactName || null),
          direction: msg.fromMe ? 'outbound' : 'inbound',
          message_type: msg.type || 'text',
          content: msg.body || `[${msg.type}]`,
          media_id: null,
          media_mime_type: null,
          message_timestamp: messageTimestamp,
          status: msg.fromMe ? 'sent' : 'delivered',
          raw_payload: {
            source: 'desktop_scraper',
            type: msg.type,
            sender: msg.sender,
            hasMedia: msg.type !== 'text'
          }
        }
      })
      .filter(Boolean)

    // Insert new messages
    if (newMessages.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('whatsapp_messages')
        .insert(newMessages)

      if (insertError) {
        console.error('[Desktop Sync] Insert error:', insertError)
        return NextResponse.json({ ok: false, error: `Insert failed: ${insertError.message}`, synced: 0 })
      }

      // --- Auto-learning hooks (non-blocking, fire-and-forget) ---
      // Only for text messages in non-group conversations
      const isGroup = contactPhone.includes('@g.us')
      if (!isGroup && companyId) {
        triggerAutoLearningHooks(
          newMessages as any[],
          user.id,
          companyId,
          contactPhone,
          contactName
        ).catch(err => console.error('[Desktop Sync] Auto-learning error:', err.message))
      }
    }

    // Upsert conversation record
    const latestMsg = messages.reduce<DesktopMessage | null>(
      (latest, msg) => (!latest || msg.timestamp > latest.timestamp ? msg : latest),
      null
    )

    if (latestMsg) {
      const ts = new Date(latestMsg.timestamp)
      const lastMessageAt = isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString()
      const preview = latestMsg.body?.substring(0, 100) || `[${latestMsg.type}]`

      await supabaseAdmin
        .from('whatsapp_conversations')
        .upsert({
          connection_id: connection.id,
          user_id: user.id,
          company_id: companyId,
          contact_phone: contactPhone,
          contact_name: contactName || null,
          last_message_at: lastMessageAt,
          last_message_preview: preview,
          unread_count: 0,
          message_count: messages.length,
          updated_at: new Date().toISOString()
        }, { onConflict: 'connection_id,contact_phone', ignoreDuplicates: false })
    }

    console.log(`[Desktop Sync] ✓ Messages: synced=${newMessages.length}, skipped=${messages.length - newMessages.length}`)

    return NextResponse.json({
      ok: true,
      synced: newMessages.length,
      skipped: messages.length - newMessages.length,
      total: messages.length
    })
  } catch (error: any) {
    console.error('[Desktop Sync] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Auto-learning hooks — mirrors whatsapp-client.ts trackSellerMessage + triggerOutcomeAnalysis
 * but without Puppeteer dependency. Runs non-blocking after message insert.
 */
async function triggerAutoLearningHooks(
  newMessages: Array<{
    direction: string
    message_type: string
    content: string
    contact_phone: string
    contact_name: string | null
    message_timestamp: string
    user_id: string
    company_id: string
  }>,
  userId: string,
  companyId: string,
  contactPhone: string,
  contactName: string
) {
  // Check contact type — skip personal contacts
  const { data: conv } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('contact_type')
    .eq('user_id', userId)
    .eq('contact_phone', contactPhone)
    .single()

  const contactType = conv?.contact_type || null

  for (const msg of newMessages) {
    if (msg.message_type !== 'text' || !msg.content) continue

    if (msg.direction === 'outbound') {
      // Track seller message for outcome analysis
      if (contactType === 'personal') continue

      // Get conversation context (last 15 messages)
      const { data: recentMsgs } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('direction, content, message_timestamp, transcription')
        .eq('user_id', userId)
        .eq('contact_phone', contactPhone)
        .order('message_timestamp', { ascending: false })
        .limit(15)

      const contextLines = (recentMsgs || []).reverse().map(m => {
        const ts = new Date(m.message_timestamp)
        const time = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}`
        const role = m.direction === 'outbound' ? 'Vendedor' : 'Cliente'
        const text = m.transcription || m.content || ''
        return `[${time}] ${role}: ${text}`
      })

      await supabaseAdmin
        .from('seller_message_tracking')
        .insert({
          user_id: userId,
          company_id: companyId,
          contact_phone: contactPhone,
          contact_name: contactName || null,
          seller_message: (msg.content || '').substring(0, 2000),
          conversation_context: contextLines.join('\n').substring(0, 5000),
          message_timestamp: msg.message_timestamp,
          is_autopilot: false,
        })
        .then(() => console.log(`[Desktop Sync] Tracked seller message for ${contactPhone}`))
        .catch(err => console.error('[Desktop Sync] trackSellerMessage error:', err.message))

    } else if (msg.direction === 'inbound') {
      // Client response → trigger outcome analysis
      if (contactType !== 'client') continue

      // Fire-and-forget to analyze-outcome endpoint
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?
        (process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000') :
        'http://localhost:3000'

      fetch(`${baseUrl}/api/copilot/analyze-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactPhone,
          clientResponse: (msg.content || '').substring(0, 2000),
          companyId,
          userId,
        }),
      }).catch(err => console.error('[Desktop Sync] triggerOutcomeAnalysis error:', err.message))
    }
  }
}
