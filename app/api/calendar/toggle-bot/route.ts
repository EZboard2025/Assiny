import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const body = await request.json()
    const { scheduledBotId, enabled } = body

    if (!scheduledBotId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'scheduledBotId and enabled are required' }, { status: 400 })
    }

    // Fetch the scheduled bot
    const { data: scheduledBot, error: fetchError } = await supabaseAdmin
      .from('calendar_scheduled_bots')
      .select('*')
      .eq('id', scheduledBotId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !scheduledBot) {
      return NextResponse.json({ error: 'Scheduled bot not found' }, { status: 404 })
    }

    // Cannot toggle if already completed or currently recording
    if (['completed', 'recording'].includes(scheduledBot.bot_status)) {
      return NextResponse.json({
        error: `Cannot toggle bot in status: ${scheduledBot.bot_status}`,
      }, { status: 400 })
    }

    // Update bot_enabled
    const newStatus = enabled ? 'pending' : 'skipped'
    await supabaseAdmin
      .from('calendar_scheduled_bots')
      .update({
        bot_enabled: enabled,
        bot_status: enabled ? 'pending' : 'skipped',
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduledBotId)

    // If disabling and bot was already scheduled (has botId), try to stop it
    if (!enabled && scheduledBot.bot_id && ['scheduled', 'joining'].includes(scheduledBot.bot_status)) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        await fetch(`${appUrl}/api/recall/stop-bot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botId: scheduledBot.bot_id }),
        })
      } catch (stopError) {
        console.warn('[Toggle Bot] Failed to stop bot:', stopError)
        // Non-fatal — bot will timeout eventually
      }
    }

    return NextResponse.json({
      success: true,
      botEnabled: enabled,
      botStatus: newStatus,
    })
  } catch (error: any) {
    console.error('[Toggle Bot] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to toggle bot' },
      { status: 500 }
    )
  }
}
