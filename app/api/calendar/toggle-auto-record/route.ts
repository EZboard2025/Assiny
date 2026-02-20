import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
    }

    // Update connection
    const { error: updateError } = await supabaseAdmin
      .from('google_calendar_connections')
      .update({
        auto_record_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    // If disabling, mark all pending bots as skipped
    if (!enabled) {
      await supabaseAdmin
        .from('calendar_scheduled_bots')
        .update({
          bot_enabled: false,
          bot_status: 'skipped',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('bot_status', 'pending')
    }

    return NextResponse.json({
      success: true,
      autoRecordEnabled: enabled,
    })
  } catch (error: any) {
    console.error('[Toggle Auto-Record] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to toggle auto-record' },
      { status: 500 }
    )
  }
}
