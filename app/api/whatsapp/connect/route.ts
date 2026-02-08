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

    // Get user's company_id
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const companyId = employee?.company_id || null

    console.log(`[CONNECT] Initializing WhatsApp client for user ${user.id}`)
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
