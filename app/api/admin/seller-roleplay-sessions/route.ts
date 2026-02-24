import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const companyId = request.headers.get('x-company-id')
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')
    if (!sellerId) {
      return NextResponse.json({ error: 'sellerId is required' }, { status: 400 })
    }

    // Verify seller belongs to this company
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('user_id')
      .eq('user_id', sellerId)
      .eq('company_id', companyId)
      .single()

    if (!employee) {
      return NextResponse.json({ error: 'Seller not found in company' }, { status: 404 })
    }

    // Exclude challenge and correction sessions
    const { data: challengeSessions } = await supabaseAdmin
      .from('daily_challenges')
      .select('roleplay_session_id')
      .eq('user_id', sellerId)
      .not('roleplay_session_id', 'is', null)

    const challengeSessionIds = (challengeSessions || [])
      .map(c => c.roleplay_session_id)
      .filter(Boolean)

    let query = supabaseAdmin
      .from('roleplay_sessions')
      .select('id, user_id, created_at, status, config, messages, evaluation, duration_seconds')
      .eq('user_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (challengeSessionIds.length > 0) {
      query = query.not('id', 'in', `(${challengeSessionIds.join(',')})`)
    }

    query = query.not('config', 'cs', '{"is_meet_correction":true}')

    const { data: sessions, error } = await query

    if (error) {
      console.error('[Seller Roleplay Sessions] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sessions: sessions || [] })
  } catch (error) {
    console.error('[Seller Roleplay Sessions] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
