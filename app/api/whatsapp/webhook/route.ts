import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyWebhookSignature, parseWebhookPayload, extractMessageContent } from '@/lib/whatsapp-api'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Webhook verification (Meta sends this to verify the endpoint)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WhatsApp webhook verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('WhatsApp webhook verification failed:', { mode, token: token?.substring(0, 5) + '...' })
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// POST: Receive messages from Meta
export async function POST(request: NextRequest) {
  // Always return 200 quickly to acknowledge receipt
  // Process in the same request but don't let errors block the response
  try {
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256') || ''
    if (process.env.FACEBOOK_APP_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      console.warn('Invalid webhook signature')
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const entries = parseWebhookPayload(body)

    for (const entry of entries) {
      if (!entry.phoneNumberId) continue

      // Find the connection for this phone number
      const { data: connection } = await supabaseAdmin
        .from('whatsapp_connections')
        .select('id, user_id, company_id')
        .eq('phone_number_id', entry.phoneNumberId)
        .eq('status', 'active')
        .single()

      if (!connection) {
        console.warn(`No active connection for phone_number_id: ${entry.phoneNumberId}`)
        continue
      }

      // Update last_webhook_at
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({ last_webhook_at: new Date().toISOString() })
        .eq('id', connection.id)

      // Process incoming messages
      for (const msg of entry.messages) {
        const contactName = entry.contacts.find(c => c.wa_id === msg.from)?.profile?.name || null
        const { content, mediaId, mediaMimeType } = extractMessageContent(msg)

        // Insert message (UNIQUE constraint on wa_message_id handles dedup)
        const { error: insertError } = await supabaseAdmin
          .from('whatsapp_messages')
          .insert({
            connection_id: connection.id,
            user_id: connection.user_id,
            company_id: connection.company_id,
            wa_message_id: msg.id,
            contact_phone: msg.from,
            contact_name: contactName,
            direction: 'inbound',
            message_type: msg.type,
            content,
            media_id: mediaId,
            media_mime_type: mediaMimeType,
            message_timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
            status: 'delivered',
            raw_payload: msg
          })

        if (insertError) {
          // Likely duplicate (wa_message_id UNIQUE constraint)
          if (insertError.code === '23505') continue
          console.error('Error inserting message:', insertError)
          continue
        }

        // Upsert conversation
        const messagePreview = content?.substring(0, 100) || `[${msg.type}]`
        const { data: existingConv } = await supabaseAdmin
          .from('whatsapp_conversations')
          .select('id, message_count, unread_count')
          .eq('connection_id', connection.id)
          .eq('contact_phone', msg.from)
          .single()

        if (existingConv) {
          await supabaseAdmin
            .from('whatsapp_conversations')
            .update({
              contact_name: contactName || undefined,
              last_message_at: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
              last_message_preview: messagePreview,
              unread_count: (existingConv.unread_count || 0) + 1,
              message_count: (existingConv.message_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingConv.id)
        } else {
          await supabaseAdmin
            .from('whatsapp_conversations')
            .insert({
              connection_id: connection.id,
              user_id: connection.user_id,
              company_id: connection.company_id,
              contact_phone: msg.from,
              contact_name: contactName,
              last_message_at: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
              last_message_preview: messagePreview,
              unread_count: 1,
              message_count: 1
            })
        }
      }

      // Process status updates (sent, delivered, read)
      for (const status of entry.statuses) {
        await supabaseAdmin
          .from('whatsapp_messages')
          .update({ status: status.status })
          .eq('wa_message_id', status.id)
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error)
  }

  // Always return 200 to prevent Meta from retrying
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
