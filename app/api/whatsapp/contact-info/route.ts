import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const contactPhone = request.nextUrl.searchParams.get('contactPhone')
    if (!contactPhone) {
      return NextResponse.json({ error: 'contactPhone is required' }, { status: 400 })
    }

    // Authenticate
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = getConnectedClient(user.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    // Resolve chat ID from phone
    const cleanPhone = contactPhone.replace(/[^0-9]/g, '')
    let chatId = `${cleanPhone}@c.us`

    // Check if we have a stored original_chat_id
    const { data: recentMessage } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('raw_payload')
      .eq('user_id', user.id)
      .eq('contact_phone', contactPhone)
      .order('message_timestamp', { ascending: false })
      .limit(1)
      .single()

    if (recentMessage?.raw_payload?.original_chat_id) {
      chatId = recentMessage.raw_payload.original_chat_id
    }

    // Get contact from whatsapp-web.js
    let contact
    try {
      contact = await client.getContactById(chatId)
    } catch {
      // Try without @c.us suffix variations
      try {
        contact = await client.getContactById(`${cleanPhone}@c.us`)
      } catch {
        return NextResponse.json({ contactInfo: { phone: contactPhone } })
      }
    }

    // Build contact info response
    const contactInfo: any = {
      phone: contactPhone,
      name: contact.pushname || contact.name || null,
      shortName: contact.shortName || null,
      isBusiness: contact.isBusiness || false,
      isEnterprise: contact.isEnterprise || false,
    }

    // Get profile picture
    try {
      contactInfo.profilePicUrl = await contact.getProfilePicUrl() || null
    } catch {
      contactInfo.profilePicUrl = null
    }

    // Get about/status text
    try {
      contactInfo.about = await contact.getAbout() || null
    } catch {
      contactInfo.about = null
    }

    // Get business profile if it's a business account
    if (contact.isBusiness) {
      try {
        // whatsapp-web.js exposes business profile via contact object
        const businessProfile = (contact as any).businessProfile || null
        if (businessProfile) {
          contactInfo.businessProfile = {
            description: businessProfile.description || null,
            category: businessProfile.category || null,
            website: businessProfile.website || null,
            email: businessProfile.email || null,
            address: businessProfile.address || null,
            businessHours: businessProfile.businessHours || null,
          }
        }
      } catch {
        // Business profile may not be available
      }
    }

    return NextResponse.json({ contactInfo })
  } catch (error: any) {
    console.error('Error fetching contact info:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contact info' },
      { status: 500 }
    )
  }
}
