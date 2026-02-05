import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientState } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Check in-memory client first
    const clientState = getClientState(user.id)
    if (clientState && clientState.status === 'connected') {
      return NextResponse.json({
        connected: true,
        status: 'active',
        phone_number: clientState.phoneNumber
      })
    }

    // Fall back to database
    const { data: connection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id, display_phone_number, status, connected_at, last_webhook_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('connected_at', { ascending: false })
      .limit(1)
      .single()

    if (!connection) {
      return NextResponse.json({
        connected: false,
        status: 'disconnected'
      })
    }

    return NextResponse.json({
      connected: true,
      status: connection.status,
      phone_number: connection.display_phone_number,
      connected_at: connection.connected_at,
      last_webhook_at: connection.last_webhook_at
    })

  } catch (error: any) {
    console.error('Error checking WhatsApp status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    )
  }
}
