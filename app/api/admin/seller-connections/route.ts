import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getClientState } from '@/lib/whatsapp-client'

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

    // Get all employees for this company
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('user_id')
      .eq('company_id', companyId)

    if (!employees || employees.length === 0) {
      return NextResponse.json({ data: {} })
    }

    const userIds = employees.map(e => e.user_id)

    // Fetch Google Calendar connections from DB
    const { data: googleData } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('user_id, status')
      .in('user_id', userIds)

    // Build map
    const connections: Record<string, { google: boolean; whatsapp: boolean; whatsappPhone: string | null }> = {}

    for (const uid of userIds) {
      // WhatsApp: check in-memory client state (real-time, source of truth)
      const waState = getClientState(uid)
      const waConnected = waState?.status === 'connected'

      connections[uid] = {
        google: false,
        whatsapp: waConnected,
        whatsappPhone: waConnected ? (waState.phoneNumber || null) : null
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
