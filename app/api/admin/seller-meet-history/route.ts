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

    // Fetch meet evaluations (full data for detail panel)
    const { data: evaluations, error } = await supabaseAdmin
      .from('meet_evaluations')
      .select('*')
      .eq('user_id', sellerId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Seller Meet History] Error fetching evaluations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ evaluations: [], simulations: {}, correctionScores: {} })
    }

    const evalIds = evaluations.map((e: any) => e.id)

    // Fetch calendar enrichment + simulations in parallel
    const [calendarRes, simulationsRes] = await Promise.all([
      supabaseAdmin
        .from('calendar_scheduled_bots')
        .select('evaluation_id, event_title, event_start, meet_link')
        .in('evaluation_id', evalIds),

      supabaseAdmin
        .from('saved_simulations')
        .select('*')
        .in('meet_evaluation_id', evalIds),
    ])

    // Enrich evaluations with calendar data
    const calendarLinks = calendarRes.data || []
    const enrichedEvaluations = evaluations.map((ev: any) => {
      const calLink = calendarLinks.find((c: any) => c.evaluation_id === ev.id)
      return {
        ...ev,
        calendar_event_title: calLink?.event_title || null,
        calendar_event_start: calLink?.event_start || null,
        calendar_meet_link: calLink?.meet_link || null,
      }
    })

    // Build simulations map
    const sims = simulationsRes.data || []
    const simulations: Record<string, any> = {}
    sims.forEach((s: any) => {
      if (s.meet_evaluation_id) {
        simulations[s.meet_evaluation_id] = s
      }
    })

    // Load correction scores for completed simulations
    const correctionScores: Record<string, number | null> = {}
    const correctionSessions: Record<string, any> = {}
    const completedSims = sims.filter((s: any) => s.status === 'completed' && s.roleplay_session_id)

    if (completedSims.length > 0) {
      const sessionIds = completedSims.map((s: any) => s.roleplay_session_id)
      const { data: sessions } = await supabaseAdmin
        .from('roleplay_sessions')
        .select('*')
        .in('id', sessionIds)

      if (sessions) {
        completedSims.forEach((sim: any) => {
          const session = sessions.find((s: any) => s.id === sim.roleplay_session_id)
          if (session) {
            let evalData = session.evaluation
            if (evalData && typeof evalData === 'object' && 'output' in evalData) {
              try { evalData = JSON.parse(evalData.output) } catch {}
            }
            const score = evalData?.overall_score
            correctionScores[sim.meet_evaluation_id] = score !== undefined ? (score > 10 ? score / 10 : score) : null
            correctionSessions[sim.meet_evaluation_id] = { ...session, evaluation: evalData }
          }
        })
      }
    }

    return NextResponse.json({
      evaluations: enrichedEvaluations,
      simulations,
      correctionScores,
      correctionSessions,
    })
  } catch (error: any) {
    console.error('[Seller Meet History] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
