'use client'

import { useState, useEffect } from 'react'
import { Target, TrendingUp, Zap, CheckCircle, Calendar, Award, Sparkles, AlertTriangle } from 'lucide-react'

interface PDIData {
  versao?: string
  gerado_em: string
  periodo: string
  empresa: {
    nome: string
    tipo: string
  }
  vendedor?: {
    nome: string
    empresa: string
    total_sessoes: number
  }
  diagnostico: {
    nota_geral: number
    resumo: string
  }
  notas_spin: {
    situacao: number
    problema: number
    implicacao: number
    necessidade: number
  }
  foco_da_semana: {
    area: string
    motivo: string
    nota_atual: number
    nota_meta: number
  }
  simulacoes: Array<{
    objetivo: string
    persona_sugerida: string
    objecao_para_treinar?: string
    criterio_sucesso: string
    quantidade: number
  }>
  meta_semanal: {
    total_simulacoes: number
    resultado_esperado: string
  }
  checkpoint: {
    quando: string
    como_avaliar: string
  }
  proximo_ciclo: string
  // Campos legados (retrocompatibilidade)
  meta_7_dias?: {
    objetivo: string
    nota_atual: number
    nota_meta: number
    como_medir: string
  }
  acoes?: Array<{
    acao: string
    resultado_esperado: string
  }>
  proximos_passos?: string
}

export default function PDIView() {
  const [pdiData, setPdiData] = useState<PDIData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastPdiDate, setLastPdiDate] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasData = pdiData !== null

  // Carregar PDI mais recente ao montar o componente
  useEffect(() => {
    const loadLatestPDI = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return

        // Buscar PDI ativo mais recente
        const { data: pdiRecord, error } = await supabase
          .from('pdis')
          .select('pdi_json, created_at')
          .eq('user_id', user.id)
          .eq('status', 'ativo')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error || !pdiRecord) {
          console.log('Nenhum PDI encontrado para este usuário')
          return
        }

        // Carregar o PDI do banco
        setPdiData(pdiRecord.pdi_json as PDIData)
        setLastPdiDate(pdiRecord.created_at)

        // Calcular cooldown
        const createdAt = new Date(pdiRecord.created_at)
        const now = new Date()
        const diffInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
        const remaining = Math.max(0, 7 - diffInDays)
        setCooldownRemaining(remaining)

        console.log('PDI carregado do banco:', pdiRecord.pdi_json)
      } catch (error) {
        console.error('Erro ao carregar PDI:', error)
      }
    }

    loadLatestPDI()
  }, [])

  const handleGeneratePDI = async () => {
    // Limpar mensagem de erro anterior
    setErrorMessage(null)

    // Verificar cooldown
    if (cooldownRemaining > 0) {
      setErrorMessage(`Você só pode gerar um novo PDI após ${cooldownRemaining} dia(s). Aguarde o período de cooldown.`)
      return
    }

    setIsLoading(true)
    try {
      // Buscar dados do usuário autenticado
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setErrorMessage('Usuário não autenticado. Faça login novamente.')
        setIsLoading(false)
        return
      }

      // Verificar se a empresa tem créditos suficientes (1 crédito para PDI)
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (companyId) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
          .eq('id', companyId)
          .single()

        if (companyData) {
          const { PLAN_CONFIGS } = await import('@/lib/types/plans')
          const planConfig = PLAN_CONFIGS[companyData.training_plan as keyof typeof PLAN_CONFIGS]
          const baseLimit = planConfig?.monthlyCredits
          const extraCredits = companyData.extra_monthly_credits || 0
          const totalLimit = baseLimit !== null ? baseLimit + extraCredits : null

          if (totalLimit !== null) {
            const currentUsed = companyData.monthly_credits_used || 0
            const remaining = totalLimit - currentUsed

            if (remaining < 1) {
              setErrorMessage(`Créditos insuficientes. Você tem ${remaining} crédito(s) restante(s), mas a geração de PDI requer 1 crédito.`)
              setIsLoading(false)
              return
            }
          }
        }
      }

      // Deletar PDI antigo antes de criar novo
      if (hasData) {
        const { error: deleteError } = await supabase
          .from('pdis')
          .delete()
          .eq('user_id', user.id)
          .eq('status', 'ativo')

        if (deleteError) {
          console.error('Erro ao deletar PDI antigo:', deleteError)
          setErrorMessage('Erro ao remover PDI antigo. Tente novamente.')
          setIsLoading(false)
          return
        }
        console.log('PDI antigo removido com sucesso')
      }

      // Buscar TODAS as sessões do usuário (mesma lógica do PerfilView)
      const { data: allSessions, error: sessionsError } = await supabase
        .from('roleplay_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      console.log('🔍 DEBUG PDI - Sessões encontradas:', allSessions?.length)

      if (sessionsError || !allSessions || allSessions.length === 0) {
        setErrorMessage('Você precisa completar algumas sessões de roleplay antes de gerar o PDI.')
        setIsLoading(false)
        return
      }

      // Filtrar sessões com avaliação válida (mesma lógica do PerfilView)
      const completedSessions = allSessions.filter(session => {
        const evaluation = (session as any).evaluation
        return evaluation && typeof evaluation === 'object'
      })

      console.log('🔍 DEBUG PDI - Sessões com avaliação:', completedSessions.length)

      if (completedSessions.length === 0) {
        setErrorMessage('Nenhuma sessão avaliada encontrada. Complete um roleplay e aguarde a avaliação.')
        setIsLoading(false)
        return
      }

      // Processar avaliações (mesma lógica do PerfilView)
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

      const allEvaluations = completedSessions
        .map(s => getProcessedEvaluation(s))
        .filter(e => e !== null)

      // ========== COLETA DE DADOS ENRIQUECIDOS ==========

      // 1. Calcular médias gerais e coletar indicadores detalhados
      let totalScore = 0
      let countScore = 0
      const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
      const spinCounts = { S: 0, P: 0, I: 0, N: 0 }

      // Agregadores para indicadores detalhados
      const indicatorTotals: Record<string, Record<string, number>> = {
        S: {}, P: {}, I: {}, N: {}
      }
      const indicatorCounts: Record<string, Record<string, number>> = {
        S: {}, P: {}, I: {}, N: {}
      }

      // Agregadores para objeções
      const objectionTotals: Record<string, { total: number; count: number }> = {}

      // Coletar missed opportunities
      const missedOpportunityCounts: Record<string, number> = {}

      // Coletar priority improvements
      const priorityImprovementsCounts: Record<string, { item: any; count: number }> = {}

      // Executive summaries recentes
      const recentExecutiveSummaries: string[] = []

      // Performance por temperamento
      const performanceByTemperament: Record<string, { total: number; count: number }> = {}

      allEvaluations.forEach((e: any, idx: number) => {
        if (e?.overall_score !== undefined) {
          let scoreValue = e.overall_score
          if (scoreValue > 10) scoreValue = scoreValue / 10
          totalScore += scoreValue
          countScore++
        }

        if (e?.spin_evaluation) {
          const spin = e.spin_evaluation
          const letters = ['S', 'P', 'I', 'N'] as const

          letters.forEach(letter => {
            if (spin[letter]?.final_score !== undefined) {
              spinTotals[letter] += spin[letter].final_score
              spinCounts[letter]++

              // Coletar indicadores detalhados
              if (spin[letter]?.indicators) {
                Object.entries(spin[letter].indicators).forEach(([indicator, score]) => {
                  if (typeof score === 'number') {
                    indicatorTotals[letter][indicator] = (indicatorTotals[letter][indicator] || 0) + score
                    indicatorCounts[letter][indicator] = (indicatorCounts[letter][indicator] || 0) + 1
                  }
                })
              }

              // Coletar missed opportunities
              if (spin[letter]?.missed_opportunities && Array.isArray(spin[letter].missed_opportunities)) {
                spin[letter].missed_opportunities.forEach((opp: string) => {
                  const oppNormalized = opp.toLowerCase().trim()
                  missedOpportunityCounts[oppNormalized] = (missedOpportunityCounts[oppNormalized] || 0) + 1
                })
              }
            }
          })
        }

        // Coletar análise de objeções
        if (e?.objections_analysis && Array.isArray(e.objections_analysis)) {
          e.objections_analysis.forEach((obj: any) => {
            if (obj.objection_type && typeof obj.score === 'number') {
              const type = obj.objection_type.toLowerCase()
              if (!objectionTotals[type]) {
                objectionTotals[type] = { total: 0, count: 0 }
              }
              objectionTotals[type].total += obj.score
              objectionTotals[type].count++
            }
          })
        }

        // Coletar priority improvements
        if (e?.priority_improvements && Array.isArray(e.priority_improvements)) {
          e.priority_improvements.forEach((imp: any) => {
            const key = `${imp.area}:${imp.current_gap}`
            if (!priorityImprovementsCounts[key]) {
              priorityImprovementsCounts[key] = { item: imp, count: 0 }
            }
            priorityImprovementsCounts[key].count++
          })
        }

        // Coletar executive summaries (últimos 3)
        if (e?.executive_summary && idx >= allEvaluations.length - 3) {
          recentExecutiveSummaries.push(e.executive_summary)
        }
      })

      // Coletar performance por temperamento das sessões
      completedSessions.forEach((session: any) => {
        const config = session.config
        const evaluation = getProcessedEvaluation(session)
        if (config?.temperament && evaluation?.overall_score !== undefined) {
          const temp = config.temperament
          let score = evaluation.overall_score
          if (score > 10) score = score / 10
          if (!performanceByTemperament[temp]) {
            performanceByTemperament[temp] = { total: 0, count: 0 }
          }
          performanceByTemperament[temp].total += score
          performanceByTemperament[temp].count++
        }
      })

      const overallAverage = countScore > 0 ? totalScore / countScore : 0
      const spinS = spinCounts.S > 0 ? spinTotals.S / spinCounts.S : 0
      const spinP = spinCounts.P > 0 ? spinTotals.P / spinCounts.P : 0
      const spinI = spinCounts.I > 0 ? spinTotals.I / spinCounts.I : 0
      const spinN = spinCounts.N > 0 ? spinTotals.N / spinCounts.N : 0

      // 2. Calcular indicador mais fraco por letra SPIN
      const findWeakestIndicator = (letter: string) => {
        const indicators = indicatorTotals[letter]
        const counts = indicatorCounts[letter]
        let weakestIndicator = 'N/A'
        let weakestScore = 10

        Object.entries(indicators).forEach(([indicator, total]) => {
          const count = counts[indicator] || 1
          const avg = total / count
          if (avg < weakestScore) {
            weakestScore = avg
            weakestIndicator = indicator
          }
        })

        return { weakestIndicator, weakestScore: Number(weakestScore.toFixed(1)) }
      }

      const spinDetailed = {
        S: { average: Number(spinS.toFixed(1)), ...findWeakestIndicator('S') },
        P: { average: Number(spinP.toFixed(1)), ...findWeakestIndicator('P') },
        I: { average: Number(spinI.toFixed(1)), ...findWeakestIndicator('I') },
        N: { average: Number(spinN.toFixed(1)), ...findWeakestIndicator('N') }
      }

      // 3. Calcular objeções com pior desempenho
      const objectionPerformance = Object.entries(objectionTotals)
        .map(([type, data]) => ({
          type,
          averageScore: Number((data.total / data.count).toFixed(1)),
          count: data.count
        }))
        .sort((a, b) => a.averageScore - b.averageScore)

      // 4. Encontrar oportunidades perdidas recorrentes (top 5)
      const recurringMissedOpportunities = Object.entries(missedOpportunityCounts)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([opp, count]) => `${opp} (${count}/${completedSessions.length} sessões)`)

      // 5. Priority improvements mais frequentes
      const priorityImprovements = Object.values(priorityImprovementsCounts)
        .filter(({ count }) => count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(({ item, count }) => ({
          area: item.area,
          current_gap: item.current_gap,
          action_plan: item.action_plan,
          priority: item.priority,
          count
        }))

      // 6. Performance por temperamento (média)
      const temperamentPerformance: Record<string, number> = {}
      Object.entries(performanceByTemperament).forEach(([temp, data]) => {
        temperamentPerformance[temp] = Number((data.total / data.count).toFixed(1))
      })

      // 7. Calcular tendência (comparing last 3 to first 3)
      let trend: 'improving' | 'stable' | 'declining' = 'stable'
      if (allEvaluations.length >= 4) {
        const first3 = allEvaluations.slice(0, 3)
        const last3 = allEvaluations.slice(-3)
        const avgFirst = first3.reduce((sum: number, e: any) => {
          let score = e?.overall_score || 0
          if (score > 10) score = score / 10
          return sum + score
        }, 0) / 3
        const avgLast = last3.reduce((sum: number, e: any) => {
          let score = e?.overall_score || 0
          if (score > 10) score = score / 10
          return sum + score
        }, 0) / 3
        if (avgLast - avgFirst > 0.5) trend = 'improving'
        else if (avgFirst - avgLast > 0.5) trend = 'declining'
      }

      // Coletar pontos fortes e gaps dos últimos 5 roleplays
      const last5Sessions = completedSessions.slice(-5)
      const last5Evaluations = last5Sessions.map(s => getProcessedEvaluation(s)).filter(e => e !== null)

      const allStrengths: string[] = []
      const allGaps: string[] = []

      last5Evaluations.forEach((e: any) => {
        if (e.top_strengths) allStrengths.push(...e.top_strengths)
        if (e.critical_gaps) allGaps.push(...e.critical_gaps)
      })

      // Contar gaps recorrentes
      const gapCounts: Record<string, number> = {}
      allGaps.forEach(gap => {
        const normalized = gap.toLowerCase().trim()
        gapCounts[normalized] = (gapCounts[normalized] || 0) + 1
      })
      const recurringGaps = Object.entries(gapCounts)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([gap]) => gap)

      const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'Vendedor'

      // Buscar company_type e company_data (companyId já foi obtido na verificação de créditos)
      const { data: companyType } = await supabase
        .from('company_type')
        .select('business_type')
        .eq('company_id', companyId)
        .single()

      const { data: companyDataRecord } = await supabase
        .from('company_data')
        .select('nome, descricao')
        .eq('company_id', companyId)
        .single()

      // Buscar personas
      const { data: personas } = await supabase
        .from('personas')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })

      // Buscar objeções
      const { data: objections } = await supabase
        .from('objections')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })

      // Formatar personas para o agente
      const personasFormatted = personas?.map(p =>
        `${p.cargo} - ${p.tipo_empresa_faturamento} (${p.contexto})`
      ).join('\n') || 'Nenhuma persona cadastrada'

      // Formatar objeções para o agente
      const objectionsFormatted = objections?.map(o =>
        `"${o.name}" → Rebatidas: ${Array.isArray(o.rebuttals) ? o.rebuttals.join(', ') : 'N/A'}`
      ).join('\n') || 'Nenhuma objeção cadastrada'

      // Construir objeto de performance enriquecido
      const enrichedPerformance = {
        totalSessions: completedSessions.length,
        overallAverage: Number(overallAverage.toFixed(1)),
        trend,
        spin: spinDetailed,
        objectionPerformance,
        recurringMissedOpportunities,
        recurringGaps,
        recentExecutiveSummaries,
        priorityImprovements,
        performanceByTemperament: temperamentPerformance,
        topStrengths: [...new Set(allStrengths)].slice(0, 5),
        criticalGaps: [...new Set(allGaps)].slice(0, 5)
      }

      console.log('=== DEBUG PDI ENRIQUECIDO ===')
      console.log('Sessões processadas:', completedSessions.length)
      console.log('SPIN Detalhado:', spinDetailed)
      console.log('Objeções:', objectionPerformance)
      console.log('Oportunidades perdidas recorrentes:', recurringMissedOpportunities.length)
      console.log('Tendência:', trend)
      console.log('Performance por temperamento:', temperamentPerformance)

      // Gerar PDI via API direta (OpenAI)
      const response = await fetch('/api/pdi/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          userName: userName,
          enrichedPerformance,
          companyName: companyDataRecord?.nome || 'Empresa',
          companyDescription: companyDataRecord?.descricao || '',
          companyType: companyType?.business_type || 'B2B',
          personas: personasFormatted,
          objections: objectionsFormatted
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao gerar PDI')
      }

      const pdiResult = await response.json()

      // API retorna { success: true, pdi: {...} }
      let parsedPDI = pdiResult.pdi || pdiResult

      // Adicionar dados do vendedor se não vieram no PDI
      if (!parsedPDI.vendedor) {
        parsedPDI.vendedor = {
          nome: userName,
          empresa: parsedPDI.empresa?.nome || 'Ramppy',
          total_sessoes: completedSessions.length
        }
      }

      // Converter simulações em acoes (formato do banco)
      const acoes = parsedPDI.simulacoes?.map((sim: any) => ({
        acao: `${sim.quantidade}x ${sim.objetivo} (Persona: ${sim.persona_sugerida}${sim.objecao_para_treinar ? ', Objeção: ' + sim.objecao_para_treinar : ''})`,
        resultado_esperado: sim.criterio_sucesso
      })) || parsedPDI.acoes || []

      // Salvar PDI no banco de dados (suporta v1 e v2)
      const { error: insertError } = await supabase
        .from('pdis')
        .insert({
          user_id: user.id,
          vendedor_nome: parsedPDI.vendedor.nome,
          vendedor_empresa: parsedPDI.vendedor.empresa,
          total_sessoes: parsedPDI.vendedor.total_sessoes,
          versao: parsedPDI.versao || 'pdi.7dias.v2',
          periodo: parsedPDI.periodo,
          gerado_em: parsedPDI.gerado_em,
          nota_geral: parsedPDI.diagnostico.nota_geral,
          resumo: parsedPDI.diagnostico.resumo,
          nota_situacao: parsedPDI.notas_spin.situacao,
          nota_problema: parsedPDI.notas_spin.problema,
          nota_implicacao: parsedPDI.notas_spin.implicacao,
          nota_necessidade: parsedPDI.notas_spin.necessidade,
          // Suporta v2 (foco_da_semana) com fallback para v1 (meta_7_dias)
          meta_objetivo: parsedPDI.foco_da_semana?.motivo || parsedPDI.meta_7_dias?.objetivo || '',
          meta_nota_atual: parsedPDI.foco_da_semana?.nota_atual || parsedPDI.meta_7_dias?.nota_atual || 0,
          meta_nota_meta: parsedPDI.foco_da_semana?.nota_meta || parsedPDI.meta_7_dias?.nota_meta || 0,
          meta_como_medir: parsedPDI.meta_semanal?.resultado_esperado || parsedPDI.meta_7_dias?.como_medir || '',
          acoes: acoes,
          checkpoint_quando: parsedPDI.checkpoint.quando,
          checkpoint_como_avaliar: parsedPDI.checkpoint.como_avaliar,
          proximos_passos: parsedPDI.proximo_ciclo || parsedPDI.proximos_passos || '',
          status: 'ativo',
          pdi_json: parsedPDI
        })

      if (insertError) {
        console.error('Erro ao salvar PDI no banco:', insertError)
        setErrorMessage('PDI gerado com sucesso, mas houve um erro ao salvar. Tente novamente.')
        setIsLoading(false)
        return
      }

      console.log('PDI salvo no banco com sucesso!')

      // Consumir 1 crédito pela geração do PDI
      try {
        const { data: companyCredits } = await supabase
          .from('companies')
          .select('monthly_credits_used')
          .eq('id', companyId)
          .single()

        const currentUsed = companyCredits?.monthly_credits_used || 0

        await supabase
          .from('companies')
          .update({ monthly_credits_used: currentUsed + 1 })
          .eq('id', companyId)

        console.log(`💳 1 crédito consumido para geração de PDI: ${currentUsed} → ${currentUsed + 1}`)
      } catch (creditError) {
        console.error('⚠️ Erro ao consumir crédito do PDI:', creditError)
        // Não falha a operação principal
      }

      setPdiData(parsedPDI)

      // Atualizar data do último PDI e resetar cooldown
      setLastPdiDate(new Date().toISOString())
      setCooldownRemaining(7)
    } catch (error) {
      console.error('Erro ao gerar PDI:', error)
      setErrorMessage('Erro ao gerar PDI. Verifique sua conexão e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const renderRadarChart = (scores: { situacao: number; problema: number; implicacao: number; necessidade: number }) => {
    const S = scores.situacao || 0
    const P = scores.problema || 0
    const I = scores.implicacao || 0
    const N = scores.necessidade || 0

    // Calculate positions for diamond (4 vertices)
    const sY = 120 - (S * 8)  // Top (S)
    const pX = 120 + (P * 8)  // Right (P)
    const iY = 120 + (I * 8)  // Bottom (I)
    const nX = 120 - (N * 8)  // Left (N)

    return (
      <svg viewBox="0 0 240 240" className="w-full h-full">
        {/* Background diamonds (losangos) - 10 níveis */}
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => {
          const size = level * 8;
          return (
            <polygon
              key={level}
              points={`120,${120-size} ${120+size},120 120,${120+size} ${120-size},120`}
              fill="none"
              stroke={level % 2 === 0 ? "#E5E7EB" : "#F3F4F6"}
              strokeWidth="1"
            />
          );
        })}

        {/* Diagonal lines */}
        <line x1="120" y1="40" x2="120" y2="200" stroke="#E5E7EB" strokeWidth="1" />
        <line x1="40" y1="120" x2="200" y2="120" stroke="#E5E7EB" strokeWidth="1" />

        {/* Data polygon */}
        <polygon
          points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
          fill="rgba(34, 197, 94, 0.15)"
          stroke="rgb(22, 163, 74)"
          strokeWidth="2"
        />

        {/* Data points */}
        <circle cx="120" cy={sY} r="5" fill="rgb(22, 163, 74)" />
        <circle cx={pX} cy="120" r="5" fill="rgb(22, 163, 74)" />
        <circle cx="120" cy={iY} r="5" fill="rgb(22, 163, 74)" />
        <circle cx={nX} cy="120" r="5" fill="rgb(22, 163, 74)" />

        {/* Labels */}
        <g>
          <rect x="100" y="15" width="40" height="24" rx="6" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1" />
          <text x="120" y="32" textAnchor="middle" fill="#166534" fontSize="14" fontWeight="bold">S</text>
        </g>
        <g>
          <rect x="200" y="108" width="40" height="24" rx="6" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1" />
          <text x="220" y="125" textAnchor="middle" fill="#166534" fontSize="14" fontWeight="bold">P</text>
        </g>
        <g>
          <rect x="100" y="201" width="40" height="24" rx="6" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1" />
          <text x="120" y="218" textAnchor="middle" fill="#166534" fontSize="14" fontWeight="bold">I</text>
        </g>
        <g>
          <rect x="0" y="108" width="40" height="24" rx="6" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1" />
          <text x="20" y="125" textAnchor="middle" fill="#166534" fontSize="14" fontWeight="bold">N</text>
        </g>
      </svg>
    )
  }

  const renderEmptyRadarChart = () => {
    return (
      <svg viewBox="0 0 240 240" className="w-full h-full opacity-50">
        {/* Background diamonds (losangos) - 10 níveis */}
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => {
          const size = level * 8;
          return (
            <polygon
              key={level}
              points={`120,${120-size} ${120+size},120 120,${120+size} ${120-size},120`}
              fill="none"
              stroke={level % 2 === 0 ? "#E5E7EB" : "#F3F4F6"}
              strokeWidth="1"
            />
          );
        })}

        {/* Diagonal lines */}
        <line x1="120" y1="40" x2="120" y2="200" stroke="#E5E7EB" strokeWidth="1" />
        <line x1="40" y1="120" x2="200" y2="120" stroke="#E5E7EB" strokeWidth="1" />

        {/* Labels */}
        <g>
          <rect x="100" y="15" width="40" height="24" rx="6" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" />
          <text x="120" y="32" textAnchor="middle" fill="#9CA3AF" fontSize="14" fontWeight="bold">S</text>
        </g>
        <g>
          <rect x="200" y="108" width="40" height="24" rx="6" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" />
          <text x="220" y="125" textAnchor="middle" fill="#9CA3AF" fontSize="14" fontWeight="bold">P</text>
        </g>
        <g>
          <rect x="100" y="201" width="40" height="24" rx="6" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" />
          <text x="120" y="218" textAnchor="middle" fill="#9CA3AF" fontSize="14" fontWeight="bold">I</text>
        </g>
        <g>
          <rect x="0" y="108" width="40" height="24" rx="6" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="1" />
          <text x="20" y="125" textAnchor="middle" fill="#9CA3AF" fontSize="14" fontWeight="bold">N</text>
        </g>
      </svg>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">Gerando seu PDI...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-20 px-6 relative z-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Error/Warning Message */}
        {errorMessage && (
          <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-yellow-800 mb-2">Atenção</h3>
                <p className="text-yellow-700 leading-relaxed">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-100 hover:bg-yellow-200 flex items-center justify-center transition-all duration-200"
              >
                <span className="text-yellow-600 text-lg">×</span>
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  PDI - 7 Dias
                </h1>
                <p className="text-gray-500 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  {hasData && pdiData.vendedor ? `${pdiData.vendedor.nome} • ${pdiData.vendedor.empresa}` : 'Aguardando dados...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {!hasData ? (
                <button
                  onClick={handleGeneratePDI}
                  disabled={isLoading}
                  className="group px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      <span>Gerando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Gerar PDI</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-4">
                  {hasData && pdiData.vendedor && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Award className="w-3 h-3 text-green-600" />
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Sessões</p>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{pdiData.vendedor.total_sessoes}</p>
                    </div>
                  )}
                  <button
                    onClick={handleGeneratePDI}
                    disabled={isLoading || cooldownRemaining > 0}
                    className="group px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title={cooldownRemaining > 0 ? `Disponível em ${cooldownRemaining} dia(s)` : 'Gerar novo PDI'}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                        <span>Gerando...</span>
                      </>
                    ) : cooldownRemaining > 0 ? (
                      <>
                        <AlertTriangle className="w-5 h-5" />
                        <span>Aguarde {cooldownRemaining} dia(s)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>Gerar Novo</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
          {hasData && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <span>Gerado em {formatDate(pdiData.gerado_em)}</span>
                </div>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">{pdiData.periodo}</span>
              </div>
            </div>
          )}
        </div>

        {/* Diagnóstico Geral */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <Award className="w-5 h-5 text-green-600" />
            </div>
            Diagnóstico Geral
          </h2>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600 font-medium">Nota Geral</span>
              <span className="text-4xl font-bold text-green-600">
                {hasData ? pdiData.diagnostico.nota_geral.toFixed(1) : '---'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: hasData ? `${(pdiData.diagnostico.nota_geral / 10) * 100}%` : '0%' }}
              />
            </div>
          </div>

          <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-gray-700 leading-relaxed">
              {hasData ? pdiData.diagnostico.resumo : 'O resumo do seu diagnóstico aparecerá aqui após a geração do PDI...'}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Notas SPIN */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              Notas SPIN
            </h2>
            <div className="aspect-square max-w-sm mx-auto">
              {hasData ? renderRadarChart(pdiData.notas_spin) : renderEmptyRadarChart()}
            </div>
            <div className="mt-6 grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-100">
                <p className="text-cyan-600 text-xs mb-1 uppercase tracking-wider font-medium">Situação</p>
                <p className="text-2xl font-bold text-cyan-700">
                  {hasData ? pdiData.notas_spin.situacao.toFixed(1) : '---'}
                </p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                <p className="text-green-600 text-xs mb-1 uppercase tracking-wider font-medium">Problema</p>
                <p className="text-2xl font-bold text-green-700">
                  {hasData ? pdiData.notas_spin.problema.toFixed(1) : '---'}
                </p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-100">
                <p className="text-yellow-600 text-xs mb-1 uppercase tracking-wider font-medium">Implicação</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {hasData ? pdiData.notas_spin.implicacao.toFixed(1) : '---'}
                </p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border border-pink-100">
                <p className="text-pink-600 text-xs mb-1 uppercase tracking-wider font-medium">Necessidade</p>
                <p className="text-2xl font-bold text-pink-700">
                  {hasData ? pdiData.notas_spin.necessidade.toFixed(1) : '---'}
                </p>
              </div>
            </div>
          </div>

          {/* Foco da Semana */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              Foco da Semana
            </h2>

            <div className="p-5 bg-purple-50 rounded-xl border border-purple-100 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="px-4 py-2 bg-purple-100 border border-purple-200 rounded-lg">
                  <p className="text-purple-700 font-bold text-2xl">
                    {hasData ? pdiData.foco_da_semana?.area || pdiData.meta_7_dias?.objetivo.split(' ')[0] || '?' : '?'}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-purple-700 font-semibold text-sm">ÁREA PRIORITÁRIA</p>
                  <p className="text-gray-600 text-xs">
                    {hasData && pdiData.foco_da_semana?.area ?
                      `${pdiData.foco_da_semana.area === 'S' ? 'Situação' :
                         pdiData.foco_da_semana.area === 'P' ? 'Problema' :
                         pdiData.foco_da_semana.area === 'I' ? 'Implicação' : 'Necessidade'}`
                      : 'Será definida após análise...'}
                  </p>
                </div>
              </div>

              <p className="text-gray-700 text-sm mb-4">
                {hasData ? pdiData.foco_da_semana?.motivo || pdiData.meta_7_dias?.objetivo || 'Motivo será definido aqui...' : 'Motivo será definido aqui...'}
              </p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 text-sm">Meta de Evolução</span>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-600 font-bold">
                      {hasData ? (pdiData.foco_da_semana?.nota_atual || pdiData.meta_7_dias?.nota_atual || 0).toFixed(1) : '---'}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-600 font-bold">
                      {hasData ? (pdiData.foco_da_semana?.nota_meta || pdiData.meta_7_dias?.nota_meta || 0).toFixed(1) : '---'}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-green-500 rounded-full transition-all duration-1000"
                    style={{
                      width: hasData && (pdiData.foco_da_semana || pdiData.meta_7_dias) ?
                        `${((pdiData.foco_da_semana?.nota_atual || pdiData.meta_7_dias?.nota_atual || 0) /
                            (pdiData.foco_da_semana?.nota_meta || pdiData.meta_7_dias?.nota_meta || 10)) * 100}%` : '0%'
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {hasData && pdiData.meta_semanal && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-gray-500 text-xs mb-1 font-semibold uppercase tracking-wider">Meta Semanal</p>
                <p className="text-gray-900 text-sm mb-2">
                  <span className="text-green-600 font-bold">{pdiData.meta_semanal.total_simulacoes}</span> simulações na Ramppy
                </p>
                <p className="text-gray-500 text-xs">{pdiData.meta_semanal.resultado_esperado}</p>
              </div>
            )}
          </div>
        </div>

        {/* Simulações */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            Simulações Recomendadas
          </h2>
          <div className="space-y-4">
            {hasData && pdiData.simulacoes ? (
              pdiData.simulacoes.map((simulacao, index) => (
                <div
                  key={index}
                  className="p-5 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100 hover:border-blue-200 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-bold text-lg">{simulacao.quantidade}x</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 font-semibold text-lg mb-3">{simulacao.objetivo}</p>

                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-blue-100">
                          <span className="text-blue-600 text-xs font-semibold uppercase tracking-wider">Persona:</span>
                          <span className="text-gray-700 text-sm">{simulacao.persona_sugerida}</span>
                        </div>
                        {simulacao.objecao_para_treinar && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-orange-100">
                            <span className="text-orange-600 text-xs font-semibold uppercase tracking-wider">Objeção:</span>
                            <span className="text-gray-700 text-sm">{simulacao.objecao_para_treinar}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                        <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Critério de Sucesso</p>
                        <p className="text-green-700 text-sm font-medium">{simulacao.criterio_sucesso}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : hasData && pdiData.acoes ? (
              // Retrocompatibilidade com formato antigo
              pdiData.acoes.map((acao, index) => (
                <div
                  key={index}
                  className="p-5 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-700 font-bold text-lg">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-900 font-semibold text-lg mb-3">{acao.acao}</p>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                        <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider font-semibold">Resultado Esperado</p>
                        <p className="text-green-700 text-sm font-medium">{acao.resultado_esperado}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 opacity-60">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 font-bold text-lg">1</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 font-semibold text-lg mb-3 italic">Simulação 1 será definida aqui...</p>
                      <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
                        <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Critério de Sucesso</p>
                        <p className="text-gray-400 text-sm italic">---</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 opacity-60">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 font-bold text-lg">2</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 font-semibold text-lg mb-3 italic">Simulação 2 será definida aqui...</p>
                      <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
                        <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Critério de Sucesso</p>
                        <p className="text-gray-400 text-sm italic">---</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Próximo Ciclo */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-green-600" />
            </div>
            Próximo Ciclo
          </h2>
          <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
            <p className="text-gray-700 leading-relaxed">
              {hasData ? (pdiData.proximo_ciclo || pdiData.proximos_passos || 'Orientações sobre o próximo ciclo aparecerão aqui após a geração do PDI...') : 'Orientações sobre o próximo ciclo aparecerão aqui após a geração do PDI...'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-gray-400 text-sm">
            PDI gerado automaticamente pela plataforma Ramppy
          </p>
        </div>
      </div>
    </div>
  )
}
