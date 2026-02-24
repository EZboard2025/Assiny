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

    // DB fallback: check active connections for sellers not found in-memory
    // This handles cases where the manager panel runs on a different instance
    // or when the client exists but the employee query didn't match
    const { data: dbConnections } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('user_id, display_phone_number')
      .in('user_id', userIds)
      .eq('status', 'active')

    const dbConnMap = new Map(
      (dbConnections || []).map(c => [c.user_id, c.display_phone_number])
    )

    // Build map — prefer in-memory, fallback to DB
    const connections: Record<string, { google: boolean; whatsapp: boolean; whatsappPhone: string | null }> = {}

    for (const uid of userIds) {
      const inMemory = connectedMap.has(uid)
      const inDb = dbConnMap.has(uid)
      connections[uid] = {
        google: false,
        whatsapp: inMemory || inDb,
        whatsappPhone: connectedMap.get(uid) || dbConnMap.get(uid) || null
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
