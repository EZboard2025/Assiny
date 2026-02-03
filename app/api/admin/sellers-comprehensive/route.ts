import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')
    const companyId = request.headers.get('x-company-id')

    if (!sellerId) {
      return NextResponse.json({ error: 'sellerId is required' }, { status: 400 })
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    // Verificar se o vendedor pertence à empresa
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('user_id, name, email')
      .eq('user_id', sellerId)
      .eq('company_id', companyId)
      .single()

    if (!employee) {
      return NextResponse.json({ error: 'Seller not found in this company' }, { status: 404 })
    }

    // Buscar todos os dados em paralelo
    const [
      roleplayResult,
      meetsResult,
      challengesResult,
      followupsResult,
      summaryResult,
      pdiResult
    ] = await Promise.all([
      // Roleplay sessions
      supabaseAdmin
        .from('roleplay_sessions')
        .select('*')
        .eq('user_id', sellerId)
        .order('created_at', { ascending: false }),

      // Meet evaluations
      supabaseAdmin
        .from('meet_evaluations')
        .select('*')
        .eq('user_id', sellerId)
        .order('created_at', { ascending: false }),

      // Daily challenges
      supabaseAdmin
        .from('daily_challenges')
        .select('*')
        .eq('user_id', sellerId)
        .order('created_at', { ascending: false }),

      // Follow-up analyses
      supabaseAdmin
        .from('followup_analyses')
        .select('*')
        .eq('user_id', sellerId)
        .order('created_at', { ascending: false }),

      // Performance summary
      supabaseAdmin
        .from('user_performance_summaries')
        .select('*')
        .eq('user_id', sellerId)
        .single(),

      // PDI ativo
      supabaseAdmin
        .from('pdis')
        .select('*')
        .eq('user_id', sellerId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
    ])

    // Processar roleplay sessions para extrair métricas SPIN
    const roleplaySessions = (roleplayResult.data || []).map((session: any) => {
      let evaluation = session.evaluation

      // Parse se necessário (formato N8N)
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try {
          evaluation = JSON.parse(evaluation.output)
        } catch (e) {
          evaluation = null
        }
      }

      let overallScore = evaluation?.overall_score || 0
      if (overallScore > 10) overallScore = overallScore / 10

      const spinScores = { S: 0, P: 0, I: 0, N: 0 }
      if (evaluation?.spin_evaluation) {
        const spinEval = evaluation.spin_evaluation
        if (spinEval.S?.final_score !== undefined) spinScores.S = spinEval.S.final_score
        if (spinEval.P?.final_score !== undefined) spinScores.P = spinEval.P.final_score
        if (spinEval.I?.final_score !== undefined) spinScores.I = spinEval.I.final_score
        if (spinEval.N?.final_score !== undefined) spinScores.N = spinEval.N.final_score
      }

      return {
        id: session.id,
        created_at: session.created_at,
        status: session.status,
        overall_score: overallScore,
        spin_scores: spinScores,
        top_strengths: evaluation?.top_strengths || [],
        critical_gaps: evaluation?.critical_gaps || [],
        performance_level: evaluation?.performance_level || null
      }
    })

    // Processar meet evaluations
    const meetEvaluations = (meetsResult.data || []).map((meet: any) => {
      let evaluation = meet.evaluation
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try {
          evaluation = JSON.parse(evaluation.output)
        } catch (e) {
          evaluation = null
        }
      }

      return {
        id: meet.id,
        created_at: meet.created_at,
        meeting_url: meet.meeting_url,
        overall_score: evaluation?.overall_score || meet.overall_score || 0,
        strengths: evaluation?.pontos_fortes || [],
        improvements: evaluation?.areas_melhoria || [],
        summary: evaluation?.resumo_executivo || meet.summary || null
      }
    })

    // Processar daily challenges
    const dailyChallenges = (challengesResult.data || []).map((challenge: any) => ({
      id: challenge.id,
      created_at: challenge.created_at,
      challenge_type: challenge.challenge_type,
      score: challenge.score || 0,
      completed: challenge.completed || false,
      response: challenge.response
    }))

    // Calcular estatísticas de desafios
    const completedChallenges = dailyChallenges.filter((c: any) => c.completed).length
    const totalChallenges = dailyChallenges.length
    const avgChallengeScore = dailyChallenges.length > 0
      ? dailyChallenges.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / dailyChallenges.length
      : 0

    // Processar follow-up analyses
    const followupAnalyses = (followupsResult.data || []).map((followup: any) => ({
      id: followup.id,
      created_at: followup.created_at,
      nota_final: followup.nota_final || 0,
      classificacao: followup.classificacao,
      tipo_venda: followup.tipo_venda,
      fase_funil: followup.fase_funil
    }))

    // Calcular métricas agregadas
    const completedRoleplays = roleplaySessions.filter((s: any) => s.status === 'completed')
    const avgRoleplayScore = completedRoleplays.length > 0
      ? completedRoleplays.reduce((sum: number, s: any) => sum + s.overall_score, 0) / completedRoleplays.length
      : 0

    const avgMeetScore = meetEvaluations.length > 0
      ? meetEvaluations.reduce((sum: number, m: any) => sum + m.overall_score, 0) / meetEvaluations.length
      : 0

    const avgFollowupScore = followupAnalyses.length > 0
      ? followupAnalyses.reduce((sum: number, f: any) => sum + f.nota_final, 0) / followupAnalyses.length
      : 0

    // Calcular médias SPIN
    const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
    const spinCounts = { S: 0, P: 0, I: 0, N: 0 }

    completedRoleplays.forEach((s: any) => {
      if (s.spin_scores.S > 0) { spinTotals.S += s.spin_scores.S; spinCounts.S++ }
      if (s.spin_scores.P > 0) { spinTotals.P += s.spin_scores.P; spinCounts.P++ }
      if (s.spin_scores.I > 0) { spinTotals.I += s.spin_scores.I; spinCounts.I++ }
      if (s.spin_scores.N > 0) { spinTotals.N += s.spin_scores.N; spinCounts.N++ }
    })

    const spinAverages = {
      S: spinCounts.S > 0 ? spinTotals.S / spinCounts.S : 0,
      P: spinCounts.P > 0 ? spinTotals.P / spinCounts.P : 0,
      I: spinCounts.I > 0 ? spinTotals.I / spinCounts.I : 0,
      N: spinCounts.N > 0 ? spinTotals.N / spinCounts.N : 0
    }

    // Coletar pontos fortes e gaps mais frequentes
    const strengthCounts = new Map<string, number>()
    const gapCounts = new Map<string, number>()

    completedRoleplays.forEach((s: any) => {
      s.top_strengths.forEach((str: string) => {
        strengthCounts.set(str, (strengthCounts.get(str) || 0) + 1)
      })
      s.critical_gaps.forEach((gap: string) => {
        gapCounts.set(gap, (gapCounts.get(gap) || 0) + 1)
      })
    })

    const topStrengths = Array.from(strengthCounts.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const criticalGaps = Array.from(gapCounts.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Determinar tendência geral
    let trend = 'stable'
    if (completedRoleplays.length >= 3) {
      const recent = completedRoleplays.slice(0, 3)
      const older = completedRoleplays.slice(-3)

      const recentAvg = recent.reduce((sum: number, s: any) => sum + s.overall_score, 0) / recent.length
      const olderAvg = older.reduce((sum: number, s: any) => sum + s.overall_score, 0) / older.length

      if (recentAvg > olderAvg + 0.5) trend = 'improving'
      else if (recentAvg < olderAvg - 0.5) trend = 'declining'
    }

    return NextResponse.json({
      seller: {
        id: sellerId,
        name: employee.name,
        email: employee.email
      },
      summary: {
        overall_average: avgRoleplayScore,
        total_roleplay_sessions: completedRoleplays.length,
        total_meet_evaluations: meetEvaluations.length,
        total_challenges: totalChallenges,
        completed_challenges: completedChallenges,
        total_followups: followupAnalyses.length,
        avg_roleplay_score: avgRoleplayScore,
        avg_meet_score: avgMeetScore,
        avg_challenge_score: avgChallengeScore,
        avg_followup_score: avgFollowupScore,
        spin_averages: spinAverages,
        top_strengths: topStrengths,
        critical_gaps: criticalGaps,
        trend
      },
      roleplay: {
        sessions: roleplaySessions, // ALL sessions for AI analysis
        total: roleplaySessions.length
      },
      meets: {
        evaluations: meetEvaluations, // ALL evaluations for AI analysis
        total: meetEvaluations.length
      },
      challenges: {
        items: dailyChallenges, // ALL challenges for AI analysis
        total: totalChallenges,
        completed: completedChallenges,
        completion_rate: totalChallenges > 0 ? (completedChallenges / totalChallenges) * 100 : 0
      },
      followups: {
        analyses: followupAnalyses, // ALL follow-ups for AI analysis
        total: followupAnalyses.length
      },
      performance_summary: summaryResult.data || null,
      pdi: pdiResult.data || null
    })
  } catch (error) {
    console.error('Erro na API sellers-comprehensive:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
