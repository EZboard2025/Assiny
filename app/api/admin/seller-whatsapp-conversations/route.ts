import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id')
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    const sellerId = request.nextUrl.searchParams.get('sellerId')
    if (!sellerId) {
      return NextResponse.json({ error: 'sellerId is required' }, { status: 400 })
    }

    // Verify seller belongs to company
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('user_id')
      .eq('company_id', companyId)
      .eq('user_id', sellerId)
      .single()

    if (!employee) {
      return NextResponse.json({ error: 'Seller not found in company' }, { status: 403 })
    }

    const { data: conversations, error } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('contact_phone, contact_name, last_message_at, last_message_preview, unread_count, message_count, profile_pic_url')
      .eq('user_id', sellerId)
      .order('last_message_at', { ascending: false })
      .limit(50)

    if (error) {
      throw error
    }

    return NextResponse.json({ conversations: conversations || [] })
  } catch (error: any) {
    console.error('[Admin Seller WhatsApp Conversations] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
