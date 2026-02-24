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

    // Only trust in-memory client state (not DB, which can be stale)
    const clientState = getClientState(user.id)
    if (clientState) {
      if (clientState.status === 'connected') {
        return NextResponse.json({
          connected: true,
          status: 'active',
          phone_number: clientState.phoneNumber,
          syncStatus: clientState.syncStatus
        })
      }

      // Return intermediate states so frontend can resume
      return NextResponse.json({
        connected: false,
        status: clientState.status,
        qrCode: clientState.qrCode,
        error: clientState.error
      })
    }

    // No in-memory client = not connected
    // DB may still show 'active' from a previous session but that's stale
    // Clean up stale DB records so they don't cause confusion later
    const { data: staleConnection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('connected_at', { ascending: false })
      .limit(1)
      .single()

    if (staleConnection) {
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('id', staleConnection.id)
    }

    return NextResponse.json({
      connected: false,
      status: 'disconnected'
    })

  } catch (error: any) {
    console.error('Error checking WhatsApp status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    )
  }
}
