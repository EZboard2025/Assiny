import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
    const userEmail = userData.user.email || ''

    // Buscar todas as sessões completadas do usuário
    const { data: sessions, error: sessionsError } = await supabase
      .from('roleplay_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: true })

    if (sessionsError) {
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    // Filtrar sessões com avaliação válida
    const completedSessions = sessions.filter(session => {
      const evaluation = session.evaluation
      return evaluation && typeof evaluation === 'object'
    })

    if (completedSessions.length === 0) {
      return NextResponse.json(
        { message: 'No completed sessions to summarize' },
        { status: 200 }
      )
    }

    // Processar evaluation (formato N8N)
    const getProcessedEvaluation = (session: any) => {
      let evaluation = session.evaluation

      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try {
          evaluation = JSON.parse(evaluation.output)
        } catch (e) {
          return null
        }
      }

      return evaluation
    }

    // Processar todas as avaliações
    const allEvaluations = completedSessions
      .map(s => getProcessedEvaluation(s))
      .filter(e => e !== null)

    // Calcular médias gerais (TODAS as sessões)
    let totalScore = 0
    let countScore = 0
    const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
    const spinCounts = { S: 0, P: 0, I: 0, N: 0 }

    allEvaluations.forEach((e, index) => {
      if (e?.spin_evaluation) {
        const spin = e.spin_evaluation
        const sessionScores = []

        // CRÍTICO: Usar !== undefined (não truthy) para incluir scores zero
        if (spin.S?.final_score !== undefined) {
          const score = spin.S.final_score
          spinTotals.S += score
          spinCounts.S++
          sessionScores.push(score)
        }
        if (spin.P?.final_score !== undefined) {
          const score = spin.P.final_score
          spinTotals.P += score
          spinCounts.P++
          sessionScores.push(score)
        }
        if (spin.I?.final_score !== undefined) {
          const score = spin.I.final_score
          spinTotals.I += score
          spinCounts.I++
          sessionScores.push(score)
        }
        if (spin.N?.final_score !== undefined) {
          const score = spin.N.final_score
          spinTotals.N += score
          spinCounts.N++
          sessionScores.push(score)
        }

        // Calcular média geral desta sessão (média das 4 notas SPIN)
        // Mesma lógica que PerfilView usa
        if (sessionScores.length > 0) {
          const avgScore = sessionScores.reduce((sum, s) => sum + s, 0) / sessionScores.length
          totalScore += avgScore
          countScore++
        }
      }
    })

    const overallAverage = countScore > 0 ? totalScore / countScore : 0
    const spinAverages = {
      S: spinCounts.S > 0 ? spinTotals.S / spinCounts.S : 0,
      P: spinCounts.P > 0 ? spinTotals.P / spinCounts.P : 0,
      I: spinCounts.I > 0 ? spinTotals.I / spinCounts.I : 0,
      N: spinCounts.N > 0 ? spinTotals.N / spinCounts.N : 0
    }

    // Para feedback recorrente: usar apenas os últimos 5 roleplays
    const last5Sessions = completedSessions.slice(-5)
    const last5Evaluations = last5Sessions
      .map(s => getProcessedEvaluation(s))
      .filter(e => e !== null)

    // Coletar pontos fortes, gaps e melhorias (últimos 5)
    const allStrengths: string[] = []
    const allGaps: string[] = []
    const allImprovements: any[] = []

    last5Evaluations.forEach(e => {
      if (e.top_strengths) allStrengths.push(...e.top_strengths)
      if (e.critical_gaps) allGaps.push(...e.critical_gaps)
      if (e.priority_improvements) allImprovements.push(...e.priority_improvements)
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

    // Calcular evolução recente
    let latestScore = null
    let scoreImprovement = null
    let trend = 'stable'

    if (allEvaluations.length > 0) {
      const latest = allEvaluations[allEvaluations.length - 1]
      latestScore = latest.overall_score || null

      if (allEvaluations.length > 1) {
        const previous = allEvaluations[allEvaluations.length - 2]
        if (latestScore && previous.overall_score) {
          scoreImprovement = latestScore - previous.overall_score

          if (scoreImprovement > 0.5) trend = 'improving'
          else if (scoreImprovement < -0.5) trend = 'declining'
          else trend = 'stable'
        }
      }
    }

    // Upsert na tabela user_performance_summaries
    const { error: upsertError } = await supabase
      .from('user_performance_summaries')
      .upsert({
        user_id: userId,
        user_name: userName,
        user_email: userEmail,
        total_sessions: completedSessions.length,
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
        totalSessions: completedSessions.length,
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
