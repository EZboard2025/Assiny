import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const companyId = request.headers.get('x-company-id')
    if (!companyId) {
      return NextResponse.json({ ok: false, error: 'Company ID not found' }, { status: 400 })
    }

    const body = await request.json()
    const { sellerId, contactName, contactPhone } = body

    if (!sellerId || !contactName) {
      return NextResponse.json({ ok: false, error: 'sellerId and contactName are required' }, { status: 400 })
    }

    // Verify seller belongs to company
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('user_id')
      .eq('user_id', sellerId)
      .eq('company_id', companyId)
      .single()

    if (!employee) {
      return NextResponse.json({ ok: false, error: 'seller_not_found' }, { status: 404 })
    }

    // Check if seller's desktop is online
    const { data: connection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id, status')
      .eq('user_id', sellerId)
      .like('phone_number_id', 'desktop_%')
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!connection) {
      return NextResponse.json({ ok: false, error: 'desktop_offline' })
    }

    // Dedup: check for existing pending request for same seller + contact
    const { data: existingRequest } = await supabaseAdmin
      .from('scrape_requests')
      .select('id, status')
      .eq('user_id', sellerId)
      .eq('contact_name', contactName)
      .in('status', ['pending', 'in_progress'])
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .single()

    if (existingRequest) {
      return NextResponse.json({ ok: true, requestId: existingRequest.id })
    }

    // Create new scrape request
    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from('scrape_requests')
      .insert({
        user_id: sellerId,
        company_id: companyId,
        requested_by: companyId, // gestor context
        contact_name: contactName,
        contact_phone: contactPhone || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[Request Scrape] Insert error:', insertError)
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, requestId: newRequest.id })
  } catch (error: any) {
    console.error('[Request Scrape] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
