import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { quickAddEvent, hasWriteScopes } from '@/lib/google-calendar'

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

    // Check write scopes
    const { data: connection } = await supabaseAdmin
      .from('google_calendar_connections')
      .select('id, scopes, status')
      .eq('user_id', user.id)
      .single()

    if (!connection || connection.status !== 'active') {
      return NextResponse.json({ error: 'Calendar not connected' }, { status: 400 })
    }

    if (!hasWriteScopes(connection.scopes)) {
      return NextResponse.json({ error: 'Write access required. Please reauthorize.' }, { status: 403 })
    }

    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const event = await quickAddEvent(user.id, text.trim())

    if (!event) {
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
    }

    return NextResponse.json({ event })
  } catch (error: any) {
    console.error('[Calendar QuickAdd] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to quick add event' },
      { status: 500 }
    )
  }
}
