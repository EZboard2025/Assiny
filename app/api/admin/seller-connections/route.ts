import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAllConnectedClients } from '@/lib/whatsapp-client'

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

    // WhatsApp: in-memory check first (real-time truth), DB fallback
    const allConnected = getAllConnectedClients()
    const connectedMap = new Map(allConnected.map(c => [c.userId, c.phone]))

    // DB: check ALL connections (active or disconnected) to know if seller ever connected
    const { data: dbConnections } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('user_id, display_phone_number, status')
      .in('user_id', userIds)

    const dbConnMap = new Map<string, { phone: string; active: boolean }>()
    for (const c of dbConnections || []) {
      // If multiple records exist, prefer active over disconnected
      const existing = dbConnMap.get(c.user_id)
      if (!existing || c.status === 'active') {
        dbConnMap.set(c.user_id, { phone: c.display_phone_number, active: c.status === 'active' })
      }
    }

    // Build map: whatsapp = ever connected, whatsappOnline = currently active
    const connections: Record<string, { google: boolean; whatsapp: boolean; whatsappOnline: boolean; whatsappPhone: string | null }> = {}

    for (const uid of userIds) {
      const inMemory = connectedMap.has(uid)
      const dbEntry = dbConnMap.get(uid)
      connections[uid] = {
        google: false,
        whatsapp: inMemory || !!dbEntry,  // true if ever connected
        whatsappOnline: inMemory || (dbEntry?.active ?? false),  // true only if currently active
        whatsappPhone: connectedMap.get(uid) || dbEntry?.phone || null
      }
    }

    for (const gc of googleData || []) {
      if (gc.status === 'active' || gc.status === 'expired') {
        connections[gc.user_id] = { ...connections[gc.user_id], google: true }
      }
    }

    return NextResponse.json({ data: connections })
  } catch (error: any) {
    console.error('[Seller Connections] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
