import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role bypasses RLS — needed to count ALL company records, not just the current user's
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')

  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
  }

  // Verify the requesting user belongs to this company
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check user belongs to company
  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!employee || employee.company_id !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // All queries use supabaseAdmin (service role) to bypass RLS
    const [
      { count: roleplayCount },
      { count: publicRoleplayCount },
      { count: followupCount },
      { count: meetCount },
      { count: pdiCount },
      dailyChallengesResult,
      aiGenerationsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('roleplay_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', startOfMonth),
      supabaseAdmin
        .from('roleplays_unicos')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', startOfMonth),
      supabaseAdmin
        .from('followup_analyses')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', startOfMonth),
      supabaseAdmin
        .from('meet_evaluations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', startOfMonth),
      supabaseAdmin
        .from('pdis')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', startOfMonth),
      Promise.resolve(
        supabaseAdmin
          .from('daily_challenges')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', startOfMonth)
      ).catch(() => ({ count: 0 })),
      Promise.resolve(
        supabaseAdmin
          .from('ai_generations')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', startOfMonth)
      ).catch(() => ({ count: 0 })),
    ])

    return NextResponse.json({
      roleplay: roleplayCount || 0,
      publicRoleplay: publicRoleplayCount || 0,
      followup: followupCount || 0,
      meet: meetCount || 0,
      pdi: pdiCount || 0,
      dailyChallenges: dailyChallengesResult?.count || 0,
      aiGeneration: aiGenerationsResult?.count || 0,
    })
  } catch (error) {
    console.error('Error fetching usage data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
