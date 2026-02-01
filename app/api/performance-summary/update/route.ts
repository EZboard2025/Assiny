import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Interface unificada para avaliações de qualquer fonte
interface UnifiedEvaluation {
  id: string
  source: 'roleplay' | 'meet' | 'challenge'
  created_at: string
  overall_score: number | null
  spin_s: number | null
  spin_p: number | null
  spin_i: number | null
  spin_n: number | null
  top_strengths: string[]
  critical_gaps: string[]
  priority_improvements: any[]
  evaluation: any
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

    // Cliente com service role para bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Buscar dados do usuário
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const userName = userData.user.user_metadata?.name || userData.user.email?.split('@')[0] || 'Usuário'

    // ===== BUSCAR TODAS AS FONTES DE DADOS EM PARALELO =====
    const [sessionsResult, meetResult, challengesResult] = await Promise.all([
      // 1. Roleplay sessions
      supabase
        .from('roleplay_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),

      // 2. Meet evaluations
      supabase
        .from('meet_evaluations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),

      // 3. Daily challenges (completados)
      supabase
        .from('daily_challenges')
        .select('roleplay_session_id')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .not('roleplay_session_id', 'is', null)
    ])

    const sessions = sessionsResult.data || []
    const meetEvaluations = meetResult.data || []
    const challengeSessionIds = new Set((challengesResult.data || []).map((c: any) => c.roleplay_session_id))

    console.log(`📊 Fontes de dados: Roleplays=${sessions.length}, Meets=${meetEvaluations.length}, Desafios=${challengeSessionIds.size}`)

    // Processar evaluation (formato N8N)
    const getProcessedEvaluation = (evaluation: any) => {
      if (!evaluation || typeof evaluation !== 'object') return null

      if ('output' in evaluation) {
        try {
          return JSON.parse(evaluation.output)
        } catch (e) {
          return null
        }
      }

      return evaluation
    }

    // ===== UNIFICAR TODAS AS AVALIAÇÕES =====
    const unifiedEvaluations: UnifiedEvaluation[] = []

    // 1. Processar roleplay sessions
    sessions.forEach(session => {
      const evaluation = getProcessedEvaluation(session.evaluation)
      if (!evaluation) return

      const isChallenge = challengeSessionIds.has(session.id)

      unifiedEvaluations.push({
        id: session.id,
        source: isChallenge ? 'challenge' : 'roleplay',
        created_at: session.created_at,
        overall_score: evaluation.overall_score ?? null,
        spin_s: evaluation.spin_evaluation?.S?.final_score ?? null,
        spin_p: evaluation.spin_evaluation?.P?.final_score ?? null,
        spin_i: evaluation.spin_evaluation?.I?.final_score ?? null,
        spin_n: evaluation.spin_evaluation?.N?.final_score ?? null,
        top_strengths: evaluation.top_strengths || [],
        critical_gaps: evaluation.critical_gaps || [],
        priority_improvements: evaluation.priority_improvements || [],
        evaluation
      })
    })

    // 2. Processar meet evaluations
    meetEvaluations.forEach(meet => {
      const evaluation = getProcessedEvaluation(meet.evaluation)

      unifiedEvaluations.push({
        id: meet.id,
        source: 'meet',
        created_at: meet.created_at,
        overall_score: meet.overall_score ?? null,
        spin_s: meet.spin_s_score ?? null,
        spin_p: meet.spin_p_score ?? null,
        spin_i: meet.spin_i_score ?? null,
        spin_n: meet.spin_n_score ?? null,
        top_strengths: evaluation?.top_strengths || [],
        critical_gaps: evaluation?.critical_gaps || [],
        priority_improvements: evaluation?.priority_improvements || [],
        evaluation
      })
    })

    // Ordenar por data de criação
    unifiedEvaluations.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    console.log(`✅ Total de avaliações unificadas: ${unifiedEvaluations.length}`)

    if (unifiedEvaluations.length === 0) {
      return NextResponse.json(
        {
          message: 'No evaluations to summarize',
          debug: {
            totalRoleplays: sessions.length,
            totalMeets: meetEvaluations.length,
            totalChallenges: challengeSessionIds.size
          }
        },
        { status: 200 }
      )
    }

    // ===== CALCULAR MÉDIAS GERAIS (TODAS AS AVALIAÇÕES) =====
    let totalScore = 0
    let countScore = 0
    const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
    const spinCounts = { S: 0, P: 0, I: 0, N: 0 }

    unifiedEvaluations.forEach((e) => {
      const sessionScores: number[] = []

      // CRÍTICO: Usar != null para incluir scores zero (cobre null E undefined)
      if (e.spin_s != null && !isNaN(Number(e.spin_s))) {
        const score = Number(e.spin_s)
        spinTotals.S += score
        spinCounts.S++
        sessionScores.push(score)
      }
      if (e.spin_p != null && !isNaN(Number(e.spin_p))) {
        const score = Number(e.spin_p)
        spinTotals.P += score
        spinCounts.P++
        sessionScores.push(score)
      }
      if (e.spin_i != null && !isNaN(Number(e.spin_i))) {
        const score = Number(e.spin_i)
        spinTotals.I += score
        spinCounts.I++
        sessionScores.push(score)
      }
      if (e.spin_n != null && !isNaN(Number(e.spin_n))) {
        const score = Number(e.spin_n)
        spinTotals.N += score
        spinCounts.N++
        sessionScores.push(score)
      }

      // Calcular média geral desta avaliação (média das 4 notas SPIN)
      if (sessionScores.length > 0) {
        const avgScore = sessionScores.reduce((sum, s) => sum + s, 0) / sessionScores.length
        totalScore += avgScore
        countScore++
      }
    })

    const overallAverage = countScore > 0 ? totalScore / countScore : 0
    const spinAverages = {
      S: spinCounts.S > 0 ? spinTotals.S / spinCounts.S : 0,
      P: spinCounts.P > 0 ? spinTotals.P / spinCounts.P : 0,
      I: spinCounts.I > 0 ? spinTotals.I / spinCounts.I : 0,
      N: spinCounts.N > 0 ? spinTotals.N / spinCounts.N : 0
    }

    // ===== ÚLTIMAS 5 AVALIAÇÕES (INDEPENDENTE DA FONTE) =====
    const last5Evaluations = unifiedEvaluations.slice(-5)
    console.log(`📋 Últimas 5 avaliações:`, last5Evaluations.map(e => ({
      source: e.source,
      date: e.created_at.split('T')[0]
    })))

    // Coletar pontos fortes, gaps e melhorias (últimos 5)
    const allStrengths: string[] = []
    const allGaps: string[] = []
    const allImprovements: any[] = []

    last5Evaluations.forEach(e => {
      if (e.top_strengths?.length) allStrengths.push(...e.top_strengths)
      if (e.critical_gaps?.length) allGaps.push(...e.critical_gaps)
      if (e.priority_improvements?.length) allImprovements.push(...e.priority_improvements)
    })

    // Contar frequência
    const strengthCounts: { [key: string]: number } = {}
    const gapCounts: { [key: string]: number } = {}

    allStrengths.forEach(s => strengthCounts[s] = (strengthCounts[s] || 0) + 1)
    allGaps.forEach(g => gapCounts[g] = (gapCounts[g] || 0) + 1)

    // Top 5 pontos fortes e gaps
    const topStrengths = Object.entries(strengthCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }))

    const topGaps = Object.entries(gapCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }))

    // Top 10 melhorias prioritárias
    const priorityImprovements = allImprovements.slice(0, 10)

    // ===== CALCULAR EVOLUÇÃO RECENTE =====
    let latestScore = null
    let scoreImprovement = null
    let trend = 'stable'

    if (unifiedEvaluations.length > 0) {
      const latest = unifiedEvaluations[unifiedEvaluations.length - 1]
      latestScore = latest.overall_score

      if (unifiedEvaluations.length > 1) {
        const previous = unifiedEvaluations[unifiedEvaluations.length - 2]
        if (latestScore != null && previous.overall_score != null) {
          scoreImprovement = latestScore - previous.overall_score

          if (scoreImprovement > 0.5) trend = 'improving'
          else if (scoreImprovement < -0.5) trend = 'declining'
          else trend = 'stable'
        }
      }
    }

    // Contar por fonte
    const sourceCounts = {
      roleplay: unifiedEvaluations.filter(e => e.source === 'roleplay').length,
      meet: unifiedEvaluations.filter(e => e.source === 'meet').length,
      challenge: unifiedEvaluations.filter(e => e.source === 'challenge').length
    }

    console.log(`📊 Resumo por fonte: Roleplays=${sourceCounts.roleplay}, Meets=${sourceCounts.meet}, Desafios=${sourceCounts.challenge}`)

    // Upsert na tabela user_performance_summaries
    const { error: upsertError } = await supabase
      .from('user_performance_summaries')
      .upsert({
        user_id: userId,
        user_name: userName,
        total_sessions: unifiedEvaluations.length,
        overall_average: overallAverage,
        spin_s_average: spinAverages.S,
        spin_p_average: spinAverages.P,
        spin_i_average: spinAverages.I,
        spin_n_average: spinAverages.N,
        top_strengths: topStrengths,
        critical_gaps: topGaps,
        priority_improvements: priorityImprovements,
        latest_session_score: latestScore,
        score_improvement: scoreImprovement,
        trend: trend,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return NextResponse.json(
        { error: 'Failed to update performance summary' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Performance summary updated successfully',
      data: {
        totalEvaluations: unifiedEvaluations.length,
        sources: sourceCounts,
        overallAverage,
        trend
      }
    })

  } catch (error: any) {
    console.error('Error updating performance summary:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
