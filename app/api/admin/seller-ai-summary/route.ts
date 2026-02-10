import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Cost per AI seller analysis - 1 credit
const AI_SELLER_ANALYSIS_CREDIT_COST = 1

// GET - Fetch saved AI analyses for a seller
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sellerId = searchParams.get('sellerId')
    const companyId = request.headers.get('x-company-id')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!sellerId) {
      return NextResponse.json({ error: 'sellerId is required' }, { status: 400 })
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch saved analyses for this seller
    const { data: analyses, error } = await supabaseAdmin
      .from('seller_ai_analyses')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Erro ao buscar análises:', error)
      return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 })
    }

    // Get the most recent analysis
    const latestAnalysis = analyses && analyses.length > 0 ? analyses[0] : null

    return NextResponse.json({
      success: true,
      latest: latestAnalysis ? {
        id: latestAnalysis.id,
        ai_summary: latestAnalysis.ai_summary,
        raw_metrics: latestAnalysis.raw_metrics,
        created_at: latestAnalysis.created_at
      } : null,
      history: analyses?.map(a => ({
        id: a.id,
        created_at: a.created_at,
        performance_level: a.ai_summary?.performance_level,
        credits_used: a.credits_used
      })) || [],
      total: analyses?.length || 0
    })
  } catch (error) {
    console.error('Erro na API seller-ai-summary GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Generate new AI analysis
export async function POST(request: Request) {
  try {
    const { sellerId } = await request.json()
    const companyId = request.headers.get('x-company-id')

    if (!sellerId) {
      return NextResponse.json({ error: 'sellerId is required' }, { status: 400 })
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar TODOS os dados do vendedor diretamente do banco para máxima completude
    const [
      employeeResult,
      roleplayResult,
      meetsResult,
      challengesResult,
      followupsResult,
      summaryResult,
      pdiResult,
      playbookResult
    ] = await Promise.all([
      // Employee info
      supabaseAdmin
        .from('employees')
        .select('user_id, name, email')
        .eq('user_id', sellerId)
        .eq('company_id', companyId)
        .single(),

      // ALL roleplay sessions with full evaluations
      supabaseAdmin
        .from('roleplay_sessions')
        .select('*')
        .eq('user_id', sellerId)
        .order('created_at', { ascending: false }),

      // ALL meet evaluations
      supabaseAdmin
        .from('meet_evaluations')
        .select('*')
        .eq('user_id', sellerId)
        .order('created_at', { ascending: false }),

      // ALL daily challenges
      supabaseAdmin
        .from('daily_challenges')
        .select('*')
        .eq('user_id', sellerId)
        .order('created_at', { ascending: false }),

      // ALL follow-up analyses
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

      // Active PDI
      supabaseAdmin
        .from('pdis')
        .select('*')
        .eq('user_id', sellerId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),

      // Company Playbook (for aptitude analysis)
      supabaseAdmin
        .from('sales_playbooks')
        .select('id, title, content')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
    ])

    if (!employeeResult.data) {
      return NextResponse.json({ error: 'Seller not found in this company' }, { status: 404 })
    }

    const employee = employeeResult.data
    const playbook = playbookResult.data || null
    const roleplaySessions = roleplayResult.data || []
    const meetEvaluations = meetsResult.data || []
    const dailyChallenges = challengesResult.data || []
    const followupAnalyses = followupsResult.data || []
    const performanceSummary = summaryResult.data
    const pdi = pdiResult.data

    // Process roleplay sessions to extract detailed evaluation data
    const processedRoleplaySessions = roleplaySessions.map((session: any) => {
      let evaluation = session.evaluation

      // Parse if necessary (N8N format)
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
        performance_level: evaluation?.performance_level || null,
        executive_summary: evaluation?.executive_summary || null,
        top_strengths: evaluation?.top_strengths || [],
        critical_gaps: evaluation?.critical_gaps || [],
        priority_improvements: evaluation?.priority_improvements || [],
        spin_evaluation_details: evaluation?.spin_evaluation ? {
          S: {
            score: spinScores.S,
            technical_feedback: evaluation.spin_evaluation.S?.technical_feedback || null,
            missed_opportunities: evaluation.spin_evaluation.S?.missed_opportunities || []
          },
          P: {
            score: spinScores.P,
            technical_feedback: evaluation.spin_evaluation.P?.technical_feedback || null,
            missed_opportunities: evaluation.spin_evaluation.P?.missed_opportunities || []
          },
          I: {
            score: spinScores.I,
            technical_feedback: evaluation.spin_evaluation.I?.technical_feedback || null,
            missed_opportunities: evaluation.spin_evaluation.I?.missed_opportunities || []
          },
          N: {
            score: spinScores.N,
            technical_feedback: evaluation.spin_evaluation.N?.technical_feedback || null,
            missed_opportunities: evaluation.spin_evaluation.N?.missed_opportunities || []
          }
        } : null,
        objections_analysis: evaluation?.objections_analysis || []
      }
    })

    // Process meet evaluations
    const processedMeetEvaluations = meetEvaluations.map((meet: any) => {
      let evaluation = meet.evaluation
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try {
          evaluation = JSON.parse(evaluation.output)
        } catch (e) {
          evaluation = null
        }
      }

      // Extract playbook adherence data
      const playbookAdherence = evaluation?.playbook_adherence || null

      return {
        id: meet.id,
        created_at: meet.created_at,
        overall_score: evaluation?.overall_score || meet.overall_score || 0,
        pontos_fortes: evaluation?.pontos_fortes || [],
        areas_melhoria: evaluation?.areas_melhoria || [],
        resumo_executivo: evaluation?.resumo_executivo || meet.summary || null,
        detalhes_avaliacao: evaluation?.detalhes || null,
        playbook_adherence: playbookAdherence ? {
          overall_score: playbookAdherence.overall_adherence_score || 0,
          adherence_level: playbookAdherence.adherence_level || 'N/A',
          dimensions: playbookAdherence.dimensions || null,
          violations: playbookAdherence.violations || [],
          missed_requirements: playbookAdherence.missed_requirements || [],
          coaching_notes: playbookAdherence.coaching_notes || null
        } : null
      }
    })

    // Calculate playbook adherence statistics
    const meetsWithPlaybook = processedMeetEvaluations.filter((m: any) => m.playbook_adherence !== null)
    const avgPlaybookScore = meetsWithPlaybook.length > 0
      ? meetsWithPlaybook.reduce((sum: number, m: any) => sum + (m.playbook_adherence?.overall_score || 0), 0) / meetsWithPlaybook.length
      : null

    // Aggregate playbook dimensions
    const playbookDimensionsTotals: Record<string, { total: number; count: number }> = {
      opening: { total: 0, count: 0 },
      closing: { total: 0, count: 0 },
      conduct: { total: 0, count: 0 },
      required_scripts: { total: 0, count: 0 },
      process: { total: 0, count: 0 }
    }

    meetsWithPlaybook.forEach((m: any) => {
      const dims = m.playbook_adherence?.dimensions
      if (dims) {
        Object.keys(playbookDimensionsTotals).forEach(key => {
          const dimData = dims[key]
          if (dimData && dimData.status !== 'not_evaluated' && typeof dimData.score === 'number') {
            playbookDimensionsTotals[key].total += dimData.score
            playbookDimensionsTotals[key].count++
          }
        })
      }
    })

    const playbookDimensionsAverages: Record<string, number | null> = {}
    Object.keys(playbookDimensionsTotals).forEach(key => {
      const data = playbookDimensionsTotals[key]
      playbookDimensionsAverages[key] = data.count > 0 ? data.total / data.count : null
    })

    // Collect all playbook violations and missed requirements
    const allViolations: any[] = []
    const allMissedRequirements: any[] = []
    meetsWithPlaybook.forEach((m: any) => {
      if (m.playbook_adherence?.violations?.length > 0) {
        m.playbook_adherence.violations.forEach((v: any) => {
          if (v.criterion) allViolations.push({ ...v, date: m.created_at })
        })
      }
      if (m.playbook_adherence?.missed_requirements?.length > 0) {
        m.playbook_adherence.missed_requirements.forEach((mr: any) => {
          if (mr.criterion) allMissedRequirements.push({ ...mr, date: m.created_at })
        })
      }
    })

    // Process challenges with details
    const processedChallenges = dailyChallenges.map((challenge: any) => ({
      id: challenge.id,
      created_at: challenge.created_at,
      challenge_type: challenge.challenge_type,
      score: challenge.score || 0,
      completed: challenge.completed || false,
      response: challenge.response,
      feedback: challenge.feedback || null
    }))

    // Process follow-ups with full evaluation
    const processedFollowups = followupAnalyses.map((followup: any) => ({
      id: followup.id,
      created_at: followup.created_at,
      nota_final: followup.nota_final || 0,
      classificacao: followup.classificacao,
      tipo_venda: followup.tipo_venda,
      fase_funil: followup.fase_funil,
      avaliacao: followup.avaliacao || null,
      pontos_fortes: followup.avaliacao?.pontos_fortes || [],
      areas_melhoria: followup.avaliacao?.areas_melhoria || []
    }))

    // Calculate comprehensive statistics
    const completedRoleplays = processedRoleplaySessions.filter((s: any) => s.status === 'completed')
    const avgRoleplayScore = completedRoleplays.length > 0
      ? completedRoleplays.reduce((sum: number, s: any) => sum + s.overall_score, 0) / completedRoleplays.length
      : 0

    const avgMeetScore = processedMeetEvaluations.length > 0
      ? processedMeetEvaluations.reduce((sum: number, m: any) => sum + m.overall_score, 0) / processedMeetEvaluations.length
      : 0

    const avgFollowupScore = processedFollowups.length > 0
      ? processedFollowups.reduce((sum: number, f: any) => sum + f.nota_final, 0) / processedFollowups.length
      : 0

    const completedChallenges = processedChallenges.filter((c: any) => c.completed).length
    const avgChallengeScore = processedChallenges.length > 0
      ? processedChallenges.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / processedChallenges.length
      : 0

    // Calculate SPIN averages
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

    // Collect all strengths and gaps with frequency
    const strengthCounts = new Map<string, number>()
    const gapCounts = new Map<string, number>()
    const improvementCounts = new Map<string, number>()

    completedRoleplays.forEach((s: any) => {
      s.top_strengths.forEach((str: string) => {
        strengthCounts.set(str, (strengthCounts.get(str) || 0) + 1)
      })
      s.critical_gaps.forEach((gap: string) => {
        gapCounts.set(gap, (gapCounts.get(gap) || 0) + 1)
      })
      if (s.priority_improvements) {
        s.priority_improvements.forEach((imp: any) => {
          const impText = typeof imp === 'string' ? imp : imp.area || imp.action_plan
          if (impText) improvementCounts.set(impText, (improvementCounts.get(impText) || 0) + 1)
        })
      }
    })

    const topStrengths = Array.from(strengthCounts.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)

    const criticalGaps = Array.from(gapCounts.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)

    const priorityImprovements = Array.from(improvementCounts.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)

    // Determine trend
    let trend = 'stable'
    if (completedRoleplays.length >= 3) {
      const recent = completedRoleplays.slice(0, 3)
      const older = completedRoleplays.slice(-3)
      const recentAvg = recent.reduce((sum: number, s: any) => sum + s.overall_score, 0) / recent.length
      const olderAvg = older.reduce((sum: number, s: any) => sum + s.overall_score, 0) / older.length
      if (recentAvg > olderAvg + 0.5) trend = 'improving'
      else if (recentAvg < olderAvg - 0.5) trend = 'declining'
    }

    // Build COMPREHENSIVE context for AI - MAXIMUM DATA
    const context = `
================================================================================
ANÁLISE COMPLETA DE PERFORMANCE - ${employee.name} (${employee.email})
================================================================================

=== RESUMO EXECUTIVO ===
- Total de Sessões de Roleplay: ${completedRoleplays.length}
- Total de Avaliações de Reunião (Meet): ${processedMeetEvaluations.length}
- Total de Desafios: ${processedChallenges.length} (${completedChallenges} concluídos - ${processedChallenges.length > 0 ? ((completedChallenges / processedChallenges.length) * 100).toFixed(0) : 0}%)
- Total de Follow-ups Analisados: ${processedFollowups.length}

=== MÉDIAS GERAIS ===
- Média Roleplay: ${avgRoleplayScore.toFixed(2)}/10
- Média Reuniões: ${avgMeetScore.toFixed(2)}/10
- Média Follow-ups: ${avgFollowupScore.toFixed(2)}/10
- Média Desafios: ${avgChallengeScore.toFixed(2)}/10
- Tendência Geral: ${trend === 'improving' ? 'MELHORANDO' : trend === 'declining' ? 'PIORANDO' : 'ESTÁVEL'}

=== SCORES SPIN (Roleplay) - Metodologia SPIN Selling ===
- Situação (S): ${spinAverages.S.toFixed(2)}/10 - Perguntas para entender o contexto do cliente
- Problema (P): ${spinAverages.P.toFixed(2)}/10 - Perguntas para identificar dores e problemas
- Implicação (I): ${spinAverages.I.toFixed(2)}/10 - Perguntas sobre consequências dos problemas
- Necessidade (N): ${spinAverages.N.toFixed(2)}/10 - Perguntas que levam à solução

=== PONTOS FORTES RECORRENTES (${topStrengths.length} identificados) ===
${topStrengths.slice(0, 10).map((s, i) => `${i + 1}. ${s.text} (apareceu ${s.count}x em ${completedRoleplays.length} sessões)`).join('\n') || 'Nenhum identificado ainda'}

=== GAPS CRÍTICOS RECORRENTES (${criticalGaps.length} identificados) ===
${criticalGaps.slice(0, 10).map((g, i) => `${i + 1}. ${g.text} (apareceu ${g.count}x em ${completedRoleplays.length} sessões)`).join('\n') || 'Nenhum identificado ainda'}

=== MELHORIAS PRIORITÁRIAS RECORRENTES ===
${priorityImprovements.slice(0, 10).map((imp, i) => `${i + 1}. ${imp.text} (sugerido ${imp.count}x)`).join('\n') || 'Nenhuma identificada ainda'}

================================================================================
HISTÓRICO DETALHADO DE SESSÕES DE ROLEPLAY (${completedRoleplays.length} sessões)
================================================================================
${completedRoleplays.map((s: any, i: number) => `
--- Sessão ${i + 1} (${new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}) ---
Nota Geral: ${s.overall_score.toFixed(1)}/10 | Nível: ${s.performance_level || 'N/A'}
SPIN: S=${s.spin_scores.S.toFixed(1)} | P=${s.spin_scores.P.toFixed(1)} | I=${s.spin_scores.I.toFixed(1)} | N=${s.spin_scores.N.toFixed(1)}
${s.executive_summary ? `Resumo: ${s.executive_summary}` : ''}
${s.top_strengths.length > 0 ? `Pontos Fortes: ${s.top_strengths.join('; ')}` : ''}
${s.critical_gaps.length > 0 ? `Gaps: ${s.critical_gaps.join('; ')}` : ''}
${s.spin_evaluation_details ? `
  - Feedback Situação: ${s.spin_evaluation_details.S?.technical_feedback || 'N/A'}
  - Feedback Problema: ${s.spin_evaluation_details.P?.technical_feedback || 'N/A'}
  - Feedback Implicação: ${s.spin_evaluation_details.I?.technical_feedback || 'N/A'}
  - Feedback Necessidade: ${s.spin_evaluation_details.N?.technical_feedback || 'N/A'}` : ''}
`).join('') || 'Nenhuma sessão de roleplay registrada'}

================================================================================
HISTÓRICO DE REUNIÕES REAIS (MEET) - ${processedMeetEvaluations.length} avaliações
================================================================================
${processedMeetEvaluations.map((m: any, i: number) => `
--- Reunião ${i + 1} (${new Date(m.created_at).toLocaleDateString('pt-BR')}) ---
Nota: ${m.overall_score?.toFixed(1) || 'N/A'}/10
${m.resumo_executivo ? `Resumo: ${m.resumo_executivo}` : ''}
${m.pontos_fortes?.length > 0 ? `Pontos Fortes: ${m.pontos_fortes.join('; ')}` : ''}
${m.areas_melhoria?.length > 0 ? `Áreas de Melhoria: ${m.areas_melhoria.join('; ')}` : ''}
${m.playbook_adherence ? `Aderência ao Playbook: ${m.playbook_adherence.overall_score}% (${m.playbook_adherence.adherence_level})
  ${m.playbook_adherence.coaching_notes ? `Notas: ${m.playbook_adherence.coaching_notes}` : ''}` : ''}
`).join('') || 'Nenhuma avaliação de reunião registrada'}

${meetsWithPlaybook.length > 0 ? `
================================================================================
ANÁLISE DE ADERÊNCIA AO PLAYBOOK (${meetsWithPlaybook.length} reuniões avaliadas)
================================================================================
MÉDIA GERAL DE ADERÊNCIA: ${avgPlaybookScore?.toFixed(1)}%

MÉDIAS POR DIMENSÃO:
- Abertura: ${playbookDimensionsAverages.opening !== null ? playbookDimensionsAverages.opening.toFixed(1) + '%' : 'Não avaliado'}
- Fechamento: ${playbookDimensionsAverages.closing !== null ? playbookDimensionsAverages.closing.toFixed(1) + '%' : 'Não avaliado'}
- Conduta: ${playbookDimensionsAverages.conduct !== null ? playbookDimensionsAverages.conduct.toFixed(1) + '%' : 'Não avaliado'}
- Scripts Obrigatórios: ${playbookDimensionsAverages.required_scripts !== null ? playbookDimensionsAverages.required_scripts.toFixed(1) + '%' : 'Não avaliado'}
- Processo: ${playbookDimensionsAverages.process !== null ? playbookDimensionsAverages.process.toFixed(1) + '%' : 'Não avaliado'}

${allViolations.length > 0 ? `VIOLAÇÕES IDENTIFICADAS (${allViolations.length} total):
${allViolations.slice(0, 10).map((v, i) => `${i + 1}. ${v.criterion} (${v.severity}) - ${new Date(v.date).toLocaleDateString('pt-BR')}`).join('\n')}` : 'Nenhuma violação identificada nas reuniões'}

${allMissedRequirements.length > 0 ? `REQUISITOS NÃO CUMPRIDOS (${allMissedRequirements.length} total):
${allMissedRequirements.slice(0, 10).map((mr, i) => `${i + 1}. ${mr.criterion} (${mr.weight}) - ${new Date(mr.date).toLocaleDateString('pt-BR')}`).join('\n')}` : 'Nenhum requisito faltante identificado'}
` : ''}

================================================================================
HISTÓRICO DE DESAFIOS DIÁRIOS - ${processedChallenges.length} desafios
================================================================================
${processedChallenges.map((c: any, i: number) => `
--- Desafio ${i + 1} (${new Date(c.created_at).toLocaleDateString('pt-BR')}) ---
Tipo: ${c.challenge_type} | Nota: ${c.score?.toFixed(1) || 'N/A'}/10 | Status: ${c.completed ? 'Concluído' : 'Pendente'}
${c.feedback ? `Feedback: ${c.feedback}` : ''}
`).join('') || 'Nenhum desafio registrado'}

================================================================================
HISTÓRICO DE FOLLOW-UPS - ${processedFollowups.length} análises
================================================================================
${processedFollowups.map((f: any, i: number) => `
--- Follow-up ${i + 1} (${new Date(f.created_at).toLocaleDateString('pt-BR')}) ---
Nota: ${f.nota_final.toFixed(1)}/10 | Classificação: ${f.classificacao} | Tipo: ${f.tipo_venda} | Fase: ${f.fase_funil}
${f.pontos_fortes?.length > 0 ? `Pontos Fortes: ${f.pontos_fortes.join('; ')}` : ''}
${f.areas_melhoria?.length > 0 ? `Áreas de Melhoria: ${f.areas_melhoria.join('; ')}` : ''}
`).join('') || 'Nenhum follow-up registrado'}

================================================================================
PDI ATUAL (Plano de Desenvolvimento Individual)
================================================================================
${pdi ? `
Status: ${pdi.status}
Criado em: ${new Date(pdi.created_at).toLocaleDateString('pt-BR')}
Meta: ${pdi.meta_objetivo || 'N/A'}
Nota Situação: ${pdi.nota_situacao || 'N/A'}
Nota Problema: ${pdi.nota_problema || 'N/A'}
Nota Implicação: ${pdi.nota_implicacao || 'N/A'}
Nota Necessidade: ${pdi.nota_necessidade || 'N/A'}
Resumo: ${pdi.resumo || 'N/A'}
` : 'Nenhum PDI ativo encontrado'}

================================================================================
RESUMO DE PERFORMANCE CONSOLIDADO (do sistema)
================================================================================
${performanceSummary ? `
Média Geral: ${performanceSummary.overall_average?.toFixed(2) || 'N/A'}/10
Total de Sessões: ${performanceSummary.total_sessions || 0}
SPIN S: ${performanceSummary.spin_s_average?.toFixed(2) || 'N/A'}
SPIN P: ${performanceSummary.spin_p_average?.toFixed(2) || 'N/A'}
SPIN I: ${performanceSummary.spin_i_average?.toFixed(2) || 'N/A'}
SPIN N: ${performanceSummary.spin_n_average?.toFixed(2) || 'N/A'}
` : 'Resumo de performance não encontrado'}

${playbook ? `
================================================================================
PLAYBOOK DE VENDAS DA EMPRESA
================================================================================
Título: ${playbook.title}
Conteúdo do Playbook:
---
${playbook.content.substring(0, 8000)}
---
(Use este playbook para avaliar a aptidão do vendedor às práticas definidas pela empresa)
` : ''}
`

    // Generate AI summary with comprehensive data
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Você é um especialista sênior em análise de performance de vendedores, com profundo conhecimento em metodologia SPIN Selling.

Você receberá dados COMPLETOS e DETALHADOS sobre um vendedor, incluindo:
- Histórico completo de sessões de roleplay com avaliações detalhadas
- Avaliações de reuniões reais
- Desafios diários completados
- Análises de follow-up
- PDI (Plano de Desenvolvimento Individual) atual
${playbook ? '- PLAYBOOK DE VENDAS da empresa (documento que define as práticas, processos e abordagens que o vendedor deve seguir)' : ''}

Sua tarefa é fazer uma análise PROFUNDA e COMPLETA, identificando:
1. Padrões de comportamento ao longo do tempo
2. Evolução (ou regressão) nas diferentes áreas SPIN
3. Correlações entre diferentes métricas
4. Problemas recorrentes que precisam de atenção urgente
5. Pontos fortes que podem ser potencializados
${playbook ? '6. APTIDÃO AO PLAYBOOK: Avalie o quanto o vendedor está aderente ao playbook da empresa' : ''}

ESTILO DE ESCRITA (MUITO IMPORTANTE):
- Seja CONCISO e DIRETO - o gestor tem pouco tempo para ler
- Escreva como um coach de vendas falando com um gestor, linguagem simples
- NÃO coloque números soltos no texto - use descrições qualitativas (excelente, bom, precisa melhorar)
- O summary deve ter NO MÁXIMO 4-5 frases curtas que vão direto ao ponto
- Highlights, concerns e recommendations devem ser frases CURTAS (máx 15 palavras cada)
- EVITE repetição - cada item deve trazer uma informação NOVA
- Priorize INSIGHTS ACIONÁVEIS sobre descrições genéricas

IMPORTANTE:
- Identifique PADRÕES nos dados históricos
- Compare sessões antigas com recentes para identificar evolução
- Analise cada área SPIN separadamente
- Forneça insights ACIONÁVEIS e PRÁTICOS
- Se há poucos dados, mencione isso e sugira mais prática
- NUNCA especule sobre erros de sistema, bugs ou problemas de dados - relate os dados de forma objetiva sem questionar sua validade
- NUNCA diga que algo "provavelmente é um erro" ou "não representa a realidade" - apenas apresente os fatos
${playbook ? '- Para a APTIDÃO AO PLAYBOOK: Compare as práticas do vendedor com o que está definido no playbook' : ''}

Responda APENAS em JSON válido com a seguinte estrutura:
{
  "summary": "Resumo CONCISO de NO MÁXIMO 4-5 frases curtas e diretas. Vá direto ao ponto: qual o nível atual do vendedor, principal evolução recente, maior problema, e o que fazer agora. NÃO escreva parágrafos longos.",
  "highlights": ["3-4 destaques positivos em frases CURTAS (máx 15 palavras). Ex: 'Cria rapport rápido e adapta discurso ao perfil do cliente'"],
  "concerns": ["3-4 pontos de atenção em frases CURTAS (máx 15 palavras). Ex: 'Não aprofunda nas consequências dos problemas do cliente'"],
  "recommendations": ["3-4 ações práticas em frases CURTAS (máx 15 palavras). Ex: 'Preparar 3 perguntas sobre consequências antes de cada conversa'"],
  "performance_level": "excelente | bom | regular | precisa_atencao | critico",
  "priority_action": "UMA frase curta e prática: a ação mais importante agora. Máx 20 palavras.",
  "spin_analysis": {
    "S": "1 frase sobre perguntas de Situação",
    "P": "1 frase sobre identificação de Problemas",
    "I": "1 frase sobre exploração de Implicações",
    "N": "1 frase sobre Necessidades de solução"
  },
  "evolution_trend": "1 frase sobre a tendência de evolução",
  "coaching_focus": "1 frase sobre onde o gestor deve focar o coaching",
  "real_calls_summary": "2-3 frases CURTAS sobre performance em reuniões reais. Se não houver, diga que ainda não tem reuniões avaliadas."${playbook ? `,
  "playbook_aptitude": {
    "score": 0.0,
    "percentage": 0,
    "level": "exemplary | compliant | partial | non_compliant",
    "summary": "2-3 frases CURTAS sobre aderência ao playbook: o que segue bem, o que não segue, e o impacto.",
    "dimension_analysis": {
      "opening": "1 frase sobre abertura (se avaliado)",
      "closing": "1 frase sobre fechamento (se avaliado)",
      "conduct": "1 frase sobre conduta (se avaliado)",
      "required_scripts": "1 frase sobre scripts (se avaliado)",
      "process": "1 frase sobre processo (se avaliado)"
    },
    "strengths": ["2-3 práticas do playbook que executa bem, frases curtas"],
    "gaps": ["2-3 práticas que não segue, frases curtas"],
    "priority_actions": ["1-2 ações prioritárias para melhorar aderência"]
  }` : ''}
}`
        },
        {
          role: 'user',
          content: context
        }
      ],
      temperature: 0.7,
      max_tokens: 2500
    })

    const aiContent = response.choices[0]?.message?.content
    if (!aiContent) {
      return NextResponse.json({ error: 'AI failed to generate summary' }, { status: 500 })
    }

    let aiSummary
    try {
      aiSummary = JSON.parse(aiContent)
    } catch (e) {
      console.error('Erro ao parsear resposta da IA:', e)
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

    const rawMetrics = {
      overall_average: avgRoleplayScore,
      total_roleplay_sessions: completedRoleplays.length,
      total_meet_evaluations: processedMeetEvaluations.length,
      total_challenges: processedChallenges.length,
      total_followups: processedFollowups.length,
      trend,
      spin_averages: spinAverages,
      playbook_adherence: avgPlaybookScore !== null ? {
        average_score: avgPlaybookScore,
        meets_evaluated: meetsWithPlaybook.length,
        dimensions_averages: playbookDimensionsAverages,
        total_violations: allViolations.length,
        total_missed_requirements: allMissedRequirements.length
      } : null
    }

    // Save analysis to database
    let savedAnalysisId = null
    try {
      const { data: savedAnalysis, error: saveError } = await supabaseAdmin
        .from('seller_ai_analyses')
        .insert({
          seller_id: sellerId,
          company_id: companyId,
          ai_summary: aiSummary,
          raw_metrics: rawMetrics,
          credits_used: AI_SELLER_ANALYSIS_CREDIT_COST,
          model_used: 'gpt-4.1'
        })
        .select('id')
        .single()

      if (saveError) {
        console.error('Erro ao salvar análise (não crítico):', saveError)
      } else {
        savedAnalysisId = savedAnalysis?.id
        console.log(`💾 Análise salva com ID: ${savedAnalysisId}`)
      }
    } catch (saveDbError) {
      console.error('Erro ao salvar análise no banco (não crítico):', saveDbError)
    }

    // Consume 1 AI credit for seller analysis
    try {
      await supabaseAdmin
        .from('ai_generations')
        .insert({
          company_id: companyId,
          generation_type: 'seller_ai_analysis',
          credits_used: AI_SELLER_ANALYSIS_CREDIT_COST,
          created_at: new Date().toISOString()
        })
      console.log(`📝 Crédito consumido: Análise IA do vendedor ${employee.name} para empresa ${companyId}`)
    } catch (creditError) {
      console.error('Erro ao registrar consumo de crédito (não crítico):', creditError)
    }

    return NextResponse.json({
      success: true,
      analysis_id: savedAnalysisId,
      seller_id: sellerId,
      seller_name: employee.name,
      generated_at: new Date().toISOString(),
      ai_summary: aiSummary,
      raw_metrics: rawMetrics
    })
  } catch (error) {
    console.error('Erro na API seller-ai-summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
