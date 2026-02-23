import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  try {
    // Usar service role key para ignorar RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Obter company_id do header (definido pelo middleware baseado no subdomínio)
    const headers = request.headers
    const companyId = headers.get('x-company-id')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    // Primeiro, buscar todos os employees da empresa
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('user_id')
      .eq('company_id', companyId)

    if (employeesError) {
      console.error('Erro ao buscar employees:', employeesError)
      return NextResponse.json({ error: employeesError.message }, { status: 500 })
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const companyUserIds = employees.map(e => e.user_id)

    // Buscar sessões de roleplay apenas dos usuários da empresa
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('roleplay_sessions')
      .select('*')
      .in('user_id', companyUserIds)
      .eq('status', 'completed')
      .not('evaluation', 'is', null)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.error('Erro ao buscar sessões:', sessionsError)
      return NextResponse.json({ error: sessionsError.message }, { status: 500 })
    }

    // Agrupar sessões por usuário e calcular métricas (igual ao PerfilView)
    const userMetrics = new Map<string, any>()

    ;(sessions || []).forEach(session => {
      const userId = session.user_id

      if (!userMetrics.has(userId)) {
        userMetrics.set(userId, {
          user_id: userId,
          total_sessions: 0,
          totalOverallScore: 0,
          countOverallScore: 0,
          totals: { S: 0, P: 0, I: 0, N: 0 },
          counts: { S: 0, P: 0, I: 0, N: 0 },
          top_strengths: [],
          critical_gaps: [],
          latestScore: null,
          sessions: []
        })
      }

      const metrics = userMetrics.get(userId)
      metrics.total_sessions++
      metrics.sessions.push(session)

      let evaluation = session.evaluation

      // Parse se necessário (formato N8N)
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try {
          evaluation = JSON.parse(evaluation.output)
        } catch (e) {
          return
        }
      }

      // Calcular SPIN scores
      if (evaluation?.spin_evaluation) {
        const spinEval = evaluation.spin_evaluation

        if (spinEval.S?.final_score !== undefined) {
          metrics.totals.S += spinEval.S.final_score
          metrics.counts.S += 1
        }
        if (spinEval.P?.final_score !== undefined) {
          metrics.totals.P += spinEval.P.final_score
          metrics.counts.P += 1
        }
        if (spinEval.I?.final_score !== undefined) {
          metrics.totals.I += spinEval.I.final_score
          metrics.counts.I += 1
        }
        if (spinEval.N?.final_score !== undefined) {
          metrics.totals.N += spinEval.N.final_score
          metrics.counts.N += 1
        }

      }

      // Usar overall_score REAL da avaliação (convertendo de 0-100 para 0-10)
      if (evaluation?.overall_score !== undefined) {
        let scoreValue = evaluation.overall_score

        // Converter de 0-100 para 0-10 se necessário
        if (scoreValue > 10) {
          scoreValue = scoreValue / 10
        }

        metrics.totalOverallScore += scoreValue
        metrics.countOverallScore++

        // Guardar última pontuação
        if (!metrics.latestScore || new Date(session.created_at) > new Date(metrics.latestScore.date)) {
          metrics.latestScore = { score: scoreValue, date: session.created_at }
        }
      }

      // Coletar pontos fortes e gaps
      if (evaluation?.top_strengths) {
        metrics.top_strengths.push(...evaluation.top_strengths)
      }
      if (evaluation?.critical_gaps) {
        metrics.critical_gaps.push(...evaluation.critical_gaps)
      }
    })

    // Buscar informações de TODOS os employees da empresa
    const { data: usersData } = await supabaseAdmin
      .from('employees')
      .select('user_id, name, email')
      .eq('company_id', companyId)

    // Formatar dados finais - incluir TODOS os employees
    const allEmployeeIds = (usersData || []).map(u => u.user_id)
    const sellersData = allEmployeeIds.map(employeeId => {
      const user = usersData?.find(u => u.user_id === employeeId)
      const metrics = userMetrics.get(employeeId)

      // Employee sem sessões - retornar dados vazios
      if (!metrics) {
        return {
          user_id: employeeId,
          user_name: user?.name || 'Usuário Desconhecido',
          user_email: user?.email || 'N/A',
          total_sessions: 0,
          overall_average: 0,
          spin_s_average: 0,
          spin_p_average: 0,
          spin_i_average: 0,
          spin_n_average: 0,
          top_strengths: [],
          critical_gaps: [],
          trend: 'stable',
          timeline: []
        }
      }

      // Calcular médias
      const overall_average = metrics.countOverallScore > 0
        ? metrics.totalOverallScore / metrics.countOverallScore
        : 0

      // Contar frequência de pontos fortes e gaps (top 5)
      const strengthCounts = new Map<string, number>()
      metrics.top_strengths.forEach((s: string) => {
        strengthCounts.set(s, (strengthCounts.get(s) || 0) + 1)
      })

      const gapCounts = new Map<string, number>()
      metrics.critical_gaps.forEach((g: string) => {
        gapCounts.set(g, (gapCounts.get(g) || 0) + 1)
      })

      const topStrengths = Array.from(strengthCounts.entries())
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const criticalGaps = Array.from(gapCounts.entries())
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Determinar tendência
      let trend = 'stable'
      if (metrics.sessions.length >= 3) {
        const recentSessions = metrics.sessions
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3)

        // Comparar primeira e última das 3 recentes
        const firstScore = metrics.latestScore?.score || 0
        const lastScore = recentSessions[2]?.evaluation?.overall_score || 0

        if (firstScore > lastScore + 0.5) trend = 'improving'
        else if (firstScore < lastScore - 0.5) trend = 'declining'
      }

      // Criar timeline de sessões
      const timeline = metrics.sessions
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .map((session: any) => {
          let evaluation = session.evaluation

          // Parse se necessário
          if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
            try {
              evaluation = JSON.parse(evaluation.output)
            } catch (e) {
              return null
            }
          }

          // Usar overall_score REAL da avaliação e extrair SPIN scores
          const spinScores = { S: 0, P: 0, I: 0, N: 0 }
          let overallScore = evaluation?.overall_score || 0

          // Converter de 0-100 para 0-10 se necessário
          if (overallScore > 10) {
            overallScore = overallScore / 10
          }

          if (evaluation?.spin_evaluation) {
            const spinEval = evaluation.spin_evaluation

            if (spinEval.S?.final_score !== undefined) spinScores.S = spinEval.S.final_score
            if (spinEval.P?.final_score !== undefined) spinScores.P = spinEval.P.final_score
            if (spinEval.I?.final_score !== undefined) spinScores.I = spinEval.I.final_score
            if (spinEval.N?.final_score !== undefined) spinScores.N = spinEval.N.final_score
          }

          return {
            session_id: session.id,
            created_at: session.created_at,
            overall_score: overallScore,
            spin_scores: spinScores
          }
        })
        .filter((s: any) => s !== null)

      return {
        user_id: metrics.user_id,
        user_name: user?.name || 'Usuário Desconhecido',
        user_email: user?.email || 'N/A',
        total_sessions: metrics.total_sessions,
        overall_average,
        spin_s_average: metrics.counts.S > 0 ? metrics.totals.S / metrics.counts.S : 0,
        spin_p_average: metrics.counts.P > 0 ? metrics.totals.P / metrics.counts.P : 0,
        spin_i_average: metrics.counts.I > 0 ? metrics.totals.I / metrics.counts.I : 0,
        spin_n_average: metrics.counts.N > 0 ? metrics.totals.N / metrics.counts.N : 0,
        top_strengths: topStrengths,
        critical_gaps: criticalGaps,
        trend,
        timeline
      }
    })

    // Ordenar por média geral
    sellersData.sort((a, b) => b.overall_average - a.overall_average)

    return NextResponse.json({ data: sellersData })
  } catch (error) {
    console.error('Erro na API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}