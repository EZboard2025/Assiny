import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revokeGoogleToken } from '@/lib/google-calendar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
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

    // Fetch current connection
    const { data: connection } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!connection) {
      return NextResponse.json({ error: 'No connection found' }, { status: 404 })
    }

    // Revoke Google token
    await revokeGoogleToken(connection.access_token)

    // Mark connection as disconnected
    await supabaseAdmin
      .from('google_calendar_connections')
      .update({
        status: 'disconnected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    // Cancel all pending/scheduled bots for this user
    await supabaseAdmin
      .from('calendar_scheduled_bots')
      .update({
        bot_status: 'skipped',
        bot_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .in('bot_status', ['pending', 'scheduled'])

    console.log(`[Calendar Disconnect] Disconnected ${connection.google_email} for user ${user.id}`)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Calendar Disconnect] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
