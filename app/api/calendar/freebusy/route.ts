import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkFreeBusy } from '@/lib/google-calendar'

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

    // Check connection
    const { data: connection } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('id, status')
      .eq('user_id', user.id)
      .single()

    if (!connection || connection.status !== 'active') {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 })
    }

    const body = await request.json()
    const { timeMin, timeMax, emails } = body

    if (!timeMin || !timeMax || !emails?.length) {
      return NextResponse.json({ error: 'timeMin, timeMax, and emails are required' }, { status: 400 })
    }

    const results = await checkFreeBusy(user.id, timeMin, timeMax, emails)

    if (!results) {
      return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 })
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('[Calendar FreeBusy] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check availability' },
      { status: 500 }
    )
  }
}
