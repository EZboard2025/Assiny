import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { initializeClient, getClientState, updateHeartbeat } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST: Start connecting (initialize client, generate QR code)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get company from subdomain (source of truth for which company we're on)
    const host = request.headers.get('host') || ''
    const hostParts = host.split('.')
    let subdomainCompanyId: string | null = null
    if (hostParts.length >= 3 || (hostParts.length >= 2 && hostParts[0] !== 'localhost' && hostParts[0] !== 'www')) {
      const subdomain = hostParts[0]
      if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
        const { data: company } = await supabaseAdmin
          .from('companies')
          .select('id')
          .eq('subdomain', subdomain)
          .single()
        subdomainCompanyId = company?.id || null
      }
    }

    // Get user's company_id from employee record
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const companyId = employee?.company_id || null

    // Detect auth/company mismatch: user is logged in with an account from a different company
    if (subdomainCompanyId && companyId && subdomainCompanyId !== companyId) {
      console.log(`[CONNECT] AUTH MISMATCH: User ${user.email} (company ${companyId}) on subdomain company ${subdomainCompanyId}`)
      return NextResponse.json({
        error: 'auth_mismatch',
        message: `Você está logado como ${user.email}, mas essa conta pertence a outra empresa. Faça logout e entre com a conta correta para este subdomínio.`,
        loggedEmail: user.email
      }, { status: 403 })
    }

    console.log(`[CONNECT] Initializing WhatsApp client for user ${user.id} (email: ${user.email}, company: ${companyId})`)
    const result = await initializeClient(user.id, companyId)

    return NextResponse.json({
      success: true,
      qrcode: result.qrCode,
      status: result.status
    })

  } catch (error: any) {
    console.error('Error connecting WhatsApp:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to connect WhatsApp' },
      { status: 500 }
    )
  }
}

// GET: Poll for QR code or connection status
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const state = getClientState(user.id)

    // Polling counts as activity - prevents TTL reaping during QR phase
    if (state) {
      updateHeartbeat(user.id)
    }

    if (!state) {
      // Check if there's a connection in DB (might be from a previous server session)
      const { data: connection } = await supabaseAdmin
        .from('whatsapp_connections')
        .select('id, status')
        .eq('user_id', user.id)
        .single()

      if (connection && connection.status === 'active') {
        return NextResponse.json({ status: 'disconnected_needs_reconnect' })
      }

      return NextResponse.json({ status: 'no_client' })
    }

    return NextResponse.json({
      status: state.status,
      qrcode: state.qrCode,
      phoneNumber: state.phoneNumber,
      syncStatus: state.syncStatus,
      error: state.error
    })

  } catch (error: any) {
    console.error('Error getting WhatsApp status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get status' },
      { status: 500 }
    )
  }
}
