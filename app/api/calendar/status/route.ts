import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
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

    // Fetch connection
    const { data: connection } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('id, google_email, status, auto_record_enabled, created_at, updated_at')
      .eq('user_id', user.id)
      .single()

    if (!connection || connection.status === 'disconnected') {
      return NextResponse.json({
        connected: false,
        email: null,
        status: 'disconnected',
      })
    }

    return NextResponse.json({
      connected: connection.status === 'active',
      email: connection.google_email,
      status: connection.status,
      autoRecordEnabled: connection.auto_record_enabled,
      connectedAt: connection.created_at,
    })
  } catch (error: any) {
    console.error('[Calendar Status] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    )
  }
}
