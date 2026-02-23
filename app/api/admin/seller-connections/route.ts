import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

    // Fetch Google Calendar and WhatsApp connections in parallel
    const [googleRes, whatsappRes] = await Promise.all([
      supabaseAdmin
        .from('google_calendar_connections')
        .select('user_id, status')
        .in('user_id', userIds),
      supabaseAdmin
        .from('whatsapp_connections')
        .select('user_id, status, display_phone_number')
        .in('user_id', userIds),
    ])

    // Build map: { user_id: { google: boolean, whatsapp: boolean, whatsappPhone: string | null } }
    const connections: Record<string, { google: boolean; whatsapp: boolean; whatsappPhone: string | null }> = {}

    for (const uid of userIds) {
      connections[uid] = { google: false, whatsapp: false, whatsappPhone: null }
    }

    for (const gc of googleRes.data || []) {
      if (gc.status === 'active' || gc.status === 'expired') {
        connections[gc.user_id] = { ...connections[gc.user_id], google: true }
      }
    }

    for (const wc of whatsappRes.data || []) {
      if (wc.status === 'active') {
        connections[wc.user_id] = { ...connections[wc.user_id], whatsapp: true, whatsappPhone: wc.display_phone_number || null }
      }
    }

    return NextResponse.json({ data: connections })
  } catch (error: any) {
    console.error('[Seller Connections] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
