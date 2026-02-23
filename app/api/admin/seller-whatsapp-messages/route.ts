import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MESSAGE_COLUMNS = 'id, wa_message_id, contact_phone, content, direction, message_timestamp, message_type, media_id, media_mime_type, contact_name, status, transcription, is_autopilot, raw_payload'

const normalizePhone = (phone: string): string => {
  let normalized = phone.replace(/^lid_/, '')
  normalized = normalized.replace(/\D/g, '')
  if (normalized.startsWith('55') && normalized.length > 11) {
    normalized = normalized.substring(2)
  }
  if (normalized.length > 9) {
    normalized = normalized.slice(-9)
  }
  return normalized
}

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('x-company-id')
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    const sellerId = request.nextUrl.searchParams.get('sellerId')
    const contactPhone = request.nextUrl.searchParams.get('contactPhone')
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100')

    if (!sellerId || !contactPhone) {
      return NextResponse.json({ error: 'sellerId and contactPhone are required' }, { status: 400 })
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

    const normalizedRequestPhone = normalizePhone(contactPhone)
    const isGroup = contactPhone.includes('@g.us')

    let messages: any[] = []

    if (isGroup) {
      const result = await supabaseAdmin
        .from('whatsapp_messages')
        .select(MESSAGE_COLUMNS)
        .eq('user_id', sellerId)
        .eq('contact_phone', contactPhone)
        .order('message_timestamp', { ascending: false })
        .limit(limit)
      messages = result.data || []
    } else {
      // Step 1: Exact match
      const exactResult = await supabaseAdmin
        .from('whatsapp_messages')
        .select(MESSAGE_COLUMNS)
        .eq('user_id', sellerId)
        .eq('contact_phone', contactPhone)
        .order('message_timestamp', { ascending: false })
        .limit(limit)
      messages = exactResult.data || []

      // Step 2: Suffix match
      if (messages.length === 0) {
        const suffixResult = await supabaseAdmin
          .from('whatsapp_messages')
          .select(MESSAGE_COLUMNS)
          .eq('user_id', sellerId)
          .like('contact_phone', `%${normalizedRequestPhone}`)
          .order('message_timestamp', { ascending: false })
          .limit(limit)
        messages = suffixResult.data || []
      }

      // Step 3: LID contacts
      if (messages.length === 0) {
        const lidResult = await supabaseAdmin
          .from('whatsapp_messages')
          .select(MESSAGE_COLUMNS)
          .eq('user_id', sellerId)
          .like('contact_phone', 'lid_%')
          .order('message_timestamp', { ascending: false })

        if (lidResult.data) {
          messages = lidResult.data
            .filter(msg => normalizePhone(msg.contact_phone || '') === normalizedRequestPhone)
            .slice(0, limit)
        }
      }
    }

    // Reverse to ascending for display
    messages = messages.reverse()

    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error('[Admin Seller WhatsApp Messages] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
