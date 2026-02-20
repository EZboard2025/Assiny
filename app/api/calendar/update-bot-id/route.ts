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

    const { scheduledBotId, botId, botStatus } = await request.json()

    if (!scheduledBotId || !botId) {
      return NextResponse.json({ error: 'scheduledBotId and botId required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('calendar_scheduled_bots')
      .update({
        bot_id: botId,
        bot_status: botStatus || 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', scheduledBotId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
