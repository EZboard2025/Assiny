import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getClientState, getAllConnectedClients } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const companyId = request.headers.get('x-company-id')
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('user_id')
      .eq('company_id', companyId)

    if (!employees || employees.length === 0) {
      return NextResponse.json({ data: {} })
    }

    const userIds = employees.map(e => e.user_id)

    // Google Calendar: from DB
    const { data: googleData } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('user_id, status')
      .in('user_id', userIds)

    // WhatsApp: from DB
    const { data: whatsappData } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('user_id, status, display_phone_number')
      .in('user_id', userIds)

    // WhatsApp: ALL in-memory connected clients (real-time truth)
    const allConnected = getAllConnectedClients()
    const connectedSet = new Set(allConnected.map(c => c.userId))
    const connectedPhones: Record<string, string | null> = {}
    for (const c of allConnected) {
      connectedPhones[c.userId] = c.phone
    }

    // Build map
    const connections: Record<string, { google: boolean; whatsapp: boolean; whatsappPhone: string | null }> = {}

    for (const uid of userIds) {
      // WhatsApp: in-memory first, DB fallback
      const inMemory = connectedSet.has(uid)
      const dbRecord = whatsappData?.find(w => w.user_id === uid && w.status === 'active')

      const waConnected = inMemory || !!dbRecord
      const waPhone = connectedPhones[uid] || dbRecord?.display_phone_number || null

      connections[uid] = {
        google: false,
        whatsapp: waConnected,
        whatsappPhone: waPhone
      }
    }

    for (const gc of googleData || []) {
      if (gc.status === 'active' || gc.status === 'expired') {
        connections[gc.user_id] = { ...connections[gc.user_id], google: true }
      }
    }

    // Debug: log connected clients for troubleshooting
    const waConnectedUsers = Object.entries(connections).filter(([, v]) => v.whatsapp).map(([uid]) => uid)
    console.log(`[Seller Connections] Company ${companyId}: ${waConnectedUsers.length} WA connected, in-memory clients: [${allConnected.map(c => c.userId.substring(0, 8)).join(', ')}]`)

    return NextResponse.json({ data: connections })
  } catch (error: any) {
    console.error('[Seller Connections] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
