import crypto from 'crypto'

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'

// ============================================
// Token Management
// ============================================

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; token_type: string }> {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('FACEBOOK_APP_ID or FACEBOOK_APP_SECRET not configured')
  }

  const response = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`,
    { method: 'GET' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to exchange code: ${JSON.stringify(error)}`)
  }

  return response.json()
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('FACEBOOK_APP_ID or FACEBOOK_APP_SECRET not configured')
  }

  const response = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`,
    { method: 'GET' }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to exchange for long-lived token: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// ============================================
// WABA Management
// ============================================

export async function subscribeToWebhooks(wabaId: string, accessToken: string): Promise<void> {
  const response = await fetch(
    `${GRAPH_API_BASE}/${wabaId}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to subscribe to webhooks: ${JSON.stringify(error)}`)
  }
}

export async function getPhoneNumberDetails(phoneNumberId: string, accessToken: string): Promise<{ display_phone_number: string; verified_name: string }> {
  const response = await fetch(
    `${GRAPH_API_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get phone number details: ${JSON.stringify(error)}`)
  }

  return response.json()
}

// ============================================
// Messaging
// ============================================

export async function sendTextMessage(
  phoneNumberId: string,
  to: string,
  text: string,
  accessToken: string
): Promise<{ messaging_product: string; contacts: any[]; messages: any[] }> {
  const response = await fetch(
    `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: text }
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to send message: ${JSON.stringify(error)}`)
  }

  return response.json()
}

export async function markMessageAsRead(
  phoneNumberId: string,
  messageId: string,
  accessToken: string
): Promise<void> {
  await fetch(
    `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    }
  )
}

// ============================================
// Media
// ============================================

export async function getMediaUrl(mediaId: string, accessToken: string): Promise<{ url: string; mime_type: string; file_size: number }> {
  const response = await fetch(
    `${GRAPH_API_BASE}/${mediaId}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get media URL: ${JSON.stringify(error)}`)
  }

  return response.json()
}

export async function downloadMedia(mediaUrl: string, accessToken: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(mediaUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  const arrayBuffer = await response.arrayBuffer()

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType
  }
}

// ============================================
// Webhook Verification
// ============================================

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appSecret) return false

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')

  return `sha256=${expectedSignature}` === signature
}

// ============================================
// Webhook Payload Parsing
// ============================================

export interface WebhookMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string; caption?: string }
  audio?: { id: string; mime_type: string }
  video?: { id: string; mime_type: string; caption?: string }
  document?: { id: string; mime_type: string; filename?: string; caption?: string }
  sticker?: { id: string; mime_type: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
  contacts?: any[]
  reaction?: { message_id: string; emoji: string }
}

export interface WebhookStatusUpdate {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: any[]
}

export interface WebhookContact {
  profile: { name: string }
  wa_id: string
}

export interface ParsedWebhookEntry {
  phoneNumberId: string
  messages: WebhookMessage[]
  statuses: WebhookStatusUpdate[]
  contacts: WebhookContact[]
}

export function parseWebhookPayload(body: any): ParsedWebhookEntry[] {
  const entries: ParsedWebhookEntry[] = []

  if (body.object !== 'whatsapp_business_account') return entries

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue

      const value = change.value
      if (!value) continue

      entries.push({
        phoneNumberId: value.metadata?.phone_number_id || '',
        messages: value.messages || [],
        statuses: value.statuses || [],
        contacts: value.contacts || []
      })
    }
  }

  return entries
}

export function extractMessageContent(msg: WebhookMessage): { content: string; mediaId: string | null; mediaMimeType: string | null } {
  switch (msg.type) {
    case 'text':
      return { content: msg.text?.body || '', mediaId: null, mediaMimeType: null }
    case 'image':
      return { content: msg.image?.caption || '', mediaId: msg.image?.id || null, mediaMimeType: msg.image?.mime_type || null }
    case 'audio':
      return { content: '', mediaId: msg.audio?.id || null, mediaMimeType: msg.audio?.mime_type || null }
    case 'video':
      return { content: msg.video?.caption || '', mediaId: msg.video?.id || null, mediaMimeType: msg.video?.mime_type || null }
    case 'document':
      return { content: msg.document?.caption || msg.document?.filename || '', mediaId: msg.document?.id || null, mediaMimeType: msg.document?.mime_type || null }
    case 'sticker':
      return { content: '', mediaId: msg.sticker?.id || null, mediaMimeType: msg.sticker?.mime_type || null }
    case 'location':
      return { content: msg.location ? `${msg.location.latitude},${msg.location.longitude}${msg.location.name ? ` - ${msg.location.name}` : ''}` : '', mediaId: null, mediaMimeType: null }
    case 'contacts':
      return { content: JSON.stringify(msg.contacts), mediaId: null, mediaMimeType: null }
    case 'reaction':
      return { content: msg.reaction?.emoji || '', mediaId: null, mediaMimeType: null }
    default:
      return { content: '', mediaId: null, mediaMimeType: null }
  }
}
