import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForToken, exchangeForLongLivedToken, subscribeToWebhooks, getPhoneNumberDetails } from '@/lib/whatsapp-api'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, waba_id, phone_number_id } = body

    if (!code || !waba_id || !phone_number_id) {
      return NextResponse.json(
        { error: 'code, waba_id, and phone_number_id are required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company_id
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const companyId = employee?.company_id || null

    // Exchange code for access token
    console.log('Exchanging code for access token...')
    const tokenResult = await exchangeCodeForToken(code)
    let accessToken = tokenResult.access_token

    // Exchange for long-lived token (60 days)
    try {
      console.log('Exchanging for long-lived token...')
      const longLivedResult = await exchangeForLongLivedToken(accessToken)
      accessToken = longLivedResult.access_token
      console.log(`Long-lived token obtained, expires in ${longLivedResult.expires_in}s`)
    } catch (e) {
      console.warn('Could not get long-lived token, using short-lived:', e)
    }

    // Subscribe to webhooks
    console.log('Subscribing to webhooks...')
    await subscribeToWebhooks(waba_id, accessToken)

    // Get phone number display info
    let displayPhoneNumber = ''
    try {
      const phoneDetails = await getPhoneNumberDetails(phone_number_id, accessToken)
      displayPhoneNumber = phoneDetails.display_phone_number || ''
    } catch (e) {
      console.warn('Could not get phone details:', e)
    }

    // Check if connection already exists for this phone_number_id
    const { data: existing } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id')
      .eq('phone_number_id', phone_number_id)
      .single()

    if (existing) {
      // Update existing connection
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({
          user_id: user.id,
          company_id: companyId,
          waba_id,
          access_token: accessToken,
          display_phone_number: displayPhoneNumber,
          status: 'active',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      // Create new connection
      await supabaseAdmin
        .from('whatsapp_connections')
        .insert({
          user_id: user.id,
          company_id: companyId,
          waba_id,
          phone_number_id,
          display_phone_number: displayPhoneNumber,
          access_token: accessToken,
          status: 'active'
        })
    }

    console.log(`WhatsApp connected: ${displayPhoneNumber} (${phone_number_id}) for user ${user.id}`)

    return NextResponse.json({
      success: true,
      phone_number: displayPhoneNumber,
      phone_number_id
    })

  } catch (error: any) {
    console.error('Error connecting WhatsApp:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to connect WhatsApp' },
      { status: 500 }
    )
  }
}
