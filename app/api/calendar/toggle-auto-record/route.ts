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
    console.log(`[Toggle Auto-Record] User ${user.id}, enabled=${enabled}`)

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
    }

    // Update connection — also match 'expired' status (token refresh is automatic)
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('google_calendar_connections')
      .update({
        auto_record_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .in('status', ['active', 'expired'])
      .select('id')

    console.log(`[Toggle Auto-Record] Updated ${updated?.length || 0} connections, error=${updateError?.message || 'none'}`)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    if (!enabled) {
      // Disabling: disable ALL future bots (regardless of current status)
      const { data: disabled } = await supabaseAdmin
        .from('calendar_scheduled_bots')
        .update({
          bot_enabled: false,
          bot_status: 'skipped',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .in('bot_status', ['pending', 'scheduled'])
        .gte('event_start', new Date().toISOString())
        .select('id')
      console.log(`[Toggle Auto-Record] Disabled ${disabled?.length || 0} future bots`)
    } else {
      // Enabling: enable ALL future bots (regardless of current status)
      const { data: activated } = await supabaseAdmin
        .from('calendar_scheduled_bots')
        .update({
          bot_enabled: true,
          bot_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .in('bot_status', ['skipped', 'error'])
        .gte('event_start', new Date().toISOString())
        .select('id')
      console.log(`[Toggle Auto-Record] Activated ${activated?.length || 0} future bots`)
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
