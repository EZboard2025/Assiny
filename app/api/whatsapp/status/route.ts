import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientState } from '@/lib/whatsapp-client'
import { isDesktopConnected } from '@/lib/whatsapp-command-queue'

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

    // Check VPS in-memory client state first
    const clientState = getClientState(user.id)
    if (clientState) {
      if (clientState.status === 'connected') {
        return NextResponse.json({
          connected: true,
          status: 'active',
          source: 'vps',
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

    // Check Desktop App connection (recent heartbeat)
    const desktopOnline = await isDesktopConnected(user.id)
    if (desktopOnline) {
      return NextResponse.json({
        connected: true,
        status: 'active',
        source: 'desktop',
      })
    }

    // No VPS client and no desktop connection = not connected
    // Clean up stale DB records (non-desktop only) so they don't cause confusion later
    const { data: staleConnection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id, phone_number_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .not('phone_number_id', 'like', 'desktop_%')
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
