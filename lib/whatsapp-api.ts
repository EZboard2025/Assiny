// WhatsApp API helpers
// With whatsapp-web.js approach, most logic is in lib/whatsapp-client.ts
// This file is kept minimal for any shared utilities

// Extract phone number from JID (e.g., "5511999999999@c.us" -> "5511999999999")
export function jidToPhone(jid: string): string {
  return jid.replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
}

// Convert phone to JID
export function phoneToJid(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '')
  return `${cleaned}@c.us`
}

// Check if JID is a group
export function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us')
}

// Format phone number for display (e.g., "5511999999999" -> "+55 11 99999-9999")
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`
  }
  if (cleaned.length === 12 && cleaned.startsWith('55')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`
  }
  return `+${cleaned}`
}
