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

    // WhatsApp: ONLY in-memory check (real-time truth)
    // If the seller has an active WhatsApp client right now → connected
    const allConnected = getAllConnectedClients()
    const connectedMap = new Map(allConnected.map(c => [c.userId, c.phone]))

    // Build map
    const connections: Record<string, { google: boolean; whatsapp: boolean; whatsappPhone: string | null }> = {}

    for (const uid of userIds) {
      connections[uid] = {
        google: false,
        whatsapp: connectedMap.has(uid),
        whatsappPhone: connectedMap.get(uid) || null
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
