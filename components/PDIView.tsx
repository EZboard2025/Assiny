'use client'

import { useState, useEffect } from 'react'

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

      // Calcular médias gerais
      let totalScore = 0
      let countScore = 0
      const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
      const spinCounts = { S: 0, P: 0, I: 0, N: 0 }

      allEvaluations.forEach((e: any) => {
        if (e?.overall_score !== undefined) {
          let scoreValue = e.overall_score
          if (scoreValue > 10) scoreValue = scoreValue / 10
          totalScore += scoreValue
          countScore++
        }

        if (e?.spin_evaluation) {
          const spin = e.spin_evaluation
          if (spin.S?.final_score !== undefined) { spinTotals.S += spin.S.final_score; spinCounts.S++ }
          if (spin.P?.final_score !== undefined) { spinTotals.P += spin.P.final_score; spinCounts.P++ }
          if (spin.I?.final_score !== undefined) { spinTotals.I += spin.I.final_score; spinCounts.I++ }
          if (spin.N?.final_score !== undefined) { spinTotals.N += spin.N.final_score; spinCounts.N++ }
        }
      })

      const overallAverage = countScore > 0 ? totalScore / countScore : 0
      const spinS = spinCounts.S > 0 ? spinTotals.S / spinCounts.S : 0
      const spinP = spinCounts.P > 0 ? spinTotals.P / spinCounts.P : 0
      const spinI = spinCounts.I > 0 ? spinTotals.I / spinCounts.I : 0
      const spinN = spinCounts.N > 0 ? spinTotals.N / spinCounts.N : 0

      // Coletar pontos fortes e gaps dos últimos 5 roleplays
      const last5Sessions = completedSessions.slice(-5)
      const last5Evaluations = last5Sessions.map(s => getProcessedEvaluation(s)).filter(e => e !== null)

      const allStrengths: string[] = []
      const allGaps: string[] = []

      last5Evaluations.forEach((e: any) => {
        if (e.top_strengths) allStrengths.push(...e.top_strengths)
        if (e.critical_gaps) allGaps.push(...e.critical_gaps)
      })

      const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'Vendedor'

      // Buscar dados da empresa (personas, objeções, company_data)
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      // Buscar company_type e company_data
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

      const resumoTexto = `
RESUMO DE PERFORMANCE - ${userName}

DADOS GERAIS:
- Nome: ${userName}
- Total de Sessões: ${completedSessions.length}
- Nota Média Geral: ${overallAverage.toFixed(1)}

MÉDIAS SPIN:
- Situação (S): ${spinS.toFixed(1)}
- Problema (P): ${spinP.toFixed(1)}
- Implicação (I): ${spinI.toFixed(1)}
- Necessidade (N): ${spinN.toFixed(1)}

PONTOS FORTES RECORRENTES:
${allStrengths.length > 0 ? allStrengths.map(s => `- ${s}`).join('\n') : '- Nenhum ponto forte identificado ainda'}

GAPS CRÍTICOS RECORRENTES:
${allGaps.length > 0 ? allGaps.map(g => `- ${g}`).join('\n') : '- Nenhum gap identificado ainda'}
      `.trim()

      console.log('=== DEBUG PDI ===')
      console.log('Sessões processadas:', completedSessions.length)
      console.log('SPIN Averages:', { spinS, spinP, spinI, spinN })
      console.log('Strengths:', allStrengths.length)
      console.log('Gaps:', allGaps.length)
      console.log('Resumo formatado:', resumoTexto)

      // Enviar para o webhook do N8N (produção)
      const response = await fetch('https://ezboard.app.n8n.cloud/webhook/pdi/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          userName: userName,
          resumoPerformance: resumoTexto,
          companyName: companyDataRecord?.nome || 'Empresa',
          companyDescription: companyDataRecord?.descricao || '',
          companyType: companyType?.business_type || 'B2B',
          personas: personasFormatted,
          objections: objectionsFormatted
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao gerar PDI')
      }

      const pdiResult = await response.json()

      // Processar resposta do N8N (pode vir em diferentes formatos)
      let parsedPDI = pdiResult
      if (Array.isArray(pdiResult) && pdiResult[0]?.output) {
        parsedPDI = JSON.parse(pdiResult[0].output)
      } else if (pdiResult?.output && typeof pdiResult.output === 'string') {
        parsedPDI = JSON.parse(pdiResult.output)
      }

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
    const labels = ['S', 'P', 'I', 'N']
    const values = [scores.situacao, scores.problema, scores.implicacao, scores.necessidade]
    const max = 10
    const centerX = 110
    const centerY = 110
    const radius = 70
    const angleStep = (Math.PI * 2) / 4
    const startAngle = -Math.PI / 2

    const points = values.map((value, index) => {
      const angle = startAngle + angleStep * index
      const r = (value / max) * radius
      const x = centerX + r * Math.cos(angle)
      const y = centerY + r * Math.sin(angle)
      return `${x},${y}`
    }).join(' ')

    const labelPositions = labels.map((label, index) => {
      const angle = startAngle + angleStep * index
      const r = radius + 25
      const x = centerX + r * Math.cos(angle)
      const y = centerY + r * Math.sin(angle)
      return { label, x, y, value: values[index] }
    })

    return (
      <svg viewBox="0 0 220 220" className="w-full h-full">
        {[0.25, 0.5, 0.75, 1].map((scale, i) => (
          <circle key={i} cx={centerX} cy={centerY} r={radius * scale} fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3" />
        ))}
        {labels.map((_, index) => {
          const angle = startAngle + angleStep * index
          const x = centerX + radius * Math.cos(angle)
          const y = centerY + radius * Math.sin(angle)
          return <line key={index} x1={centerX} y1={centerY} x2={x} y2={y} stroke="#374151" strokeWidth="0.5" opacity="0.3" />
        })}
        <polygon points={points} fill="rgba(147, 51, 234, 0.3)" stroke="#a855f7" strokeWidth="2" />
        {values.map((value, index) => {
          const angle = startAngle + angleStep * index
          const r = (value / max) * radius
          const x = centerX + r * Math.cos(angle)
          const y = centerY + r * Math.sin(angle)
          return <circle key={index} cx={x} cy={y} r="3" fill="#a855f7" stroke="#fff" strokeWidth="1" />
        })}
        {labelPositions.map((pos, index) => (
          <g key={index}>
            <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" className="fill-gray-300 font-bold text-sm">{pos.label}</text>
            <text x={pos.x} y={pos.y + 12} textAnchor="middle" dominantBaseline="middle" className="fill-green-400 font-semibold text-xs">{pos.value.toFixed(1)}</text>
          </g>
        ))}
      </svg>
    )
  }

  const renderEmptyRadarChart = () => {
    const labels = ['S', 'P', 'I', 'N']
    const centerX = 110
    const centerY = 110
    const radius = 70
    const angleStep = (Math.PI * 2) / 4
    const startAngle = -Math.PI / 2

    const labelPositions = labels.map((label, index) => {
      const angle = startAngle + angleStep * index
      const r = radius + 25
      const x = centerX + r * Math.cos(angle)
      const y = centerY + r * Math.sin(angle)
      return { label, x, y }
    })

    return (
      <svg viewBox="0 0 220 220" className="w-full h-full opacity-30">
        {[0.25, 0.5, 0.75, 1].map((scale, i) => (
          <circle key={i} cx={centerX} cy={centerY} r={radius * scale} fill="none" stroke="#374151" strokeWidth="0.5" />
        ))}
        {labels.map((_, index) => {
          const angle = startAngle + angleStep * index
          const x = centerX + radius * Math.cos(angle)
          const y = centerY + radius * Math.sin(angle)
          return <line key={index} x1={centerX} y1={centerY} x2={x} y2={y} stroke="#374151" strokeWidth="0.5" />
        })}
        {labelPositions.map((pos, index) => (
          <text key={index} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle" className="fill-gray-500 font-bold text-sm">{pos.label}</text>
        ))}
      </svg>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white relative">
        {/* Animated background particles - fixed position */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto"></div>
            <p className="text-gray-400 mt-4">Gerando seu PDI...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Animated background particles - fixed position */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      <div className="relative z-10 p-4 md:p-8 min-h-screen">
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">

        {/* Error/Warning Message */}
        {errorMessage && (
          <div className="bg-gradient-to-r from-yellow-900/40 via-orange-900/30 to-yellow-900/40 backdrop-blur-sm rounded-2xl p-6 border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.2)] animate-slide-in">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
                  <span className="text-2xl">⚠️</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-yellow-300 mb-2">Atenção</h3>
                <p className="text-yellow-100/90 leading-relaxed">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center transition-all duration-200 hover:scale-110"
              >
                <span className="text-yellow-300 text-lg">×</span>
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-green-900/40 to-blue-900/40 rounded-2xl p-6 md:p-8 border border-green-500/20 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                PDI - Plano de Desenvolvimento Individual
              </h1>
              <p className="text-gray-300 text-lg">
                {hasData && pdiData.vendedor ? `${pdiData.vendedor.nome} • ${pdiData.vendedor.empresa}` : 'Aguardando dados...'}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {!hasData ? (
                <button
                  onClick={handleGeneratePDI}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-green-500/50 transition-all duration-300 hover:scale-105 disabled:scale-100 flex items-center gap-2 justify-center"
                  style={{ boxShadow: '0 0 30px rgba(34, 197, 94, 0.5), 0 0 60px rgba(34, 197, 94, 0.3)' }}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      Gerando...
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">✨</span>
                      Gerar PDI
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleGeneratePDI}
                  disabled={isLoading || cooldownRemaining > 0}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 disabled:scale-100 flex items-center gap-2 justify-center"
                  title={cooldownRemaining > 0 ? `Disponível em ${cooldownRemaining} dia(s)` : 'Gerar novo PDI'}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      Gerando...
                    </>
                  ) : cooldownRemaining > 0 ? (
                    <>
                      <span className="text-2xl">🔒</span>
                      Aguarde {cooldownRemaining} dia(s)
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">🔄</span>
                      Gerar Novo PDI
                    </>
                  )}
                </button>
              )}
              <span className="px-4 py-2 rounded-lg border font-semibold text-center bg-green-500/20 text-green-400 border-green-500/30">
                {hasData ? pdiData.periodo : '7 dias'}
              </span>
              {hasData && pdiData.vendedor && (
                <div className="text-right md:text-center">
                  <p className="text-sm text-gray-400">Total de Sessões</p>
                  <p className="text-2xl font-bold text-white">{pdiData.vendedor.total_sessoes}</p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              {hasData ? `Gerado em ${formatDate(pdiData.gerado_em)}` : 'PDI será gerado após completar sessões de roleplay'}
            </p>
          </div>
        </div>

        {/* Diagnóstico Geral */}
        <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">🎯</span>
            Diagnóstico Geral
          </h2>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 font-medium">Nota Geral</span>
              <span className="text-2xl font-bold text-gray-500">{hasData ? pdiData.diagnostico.nota_geral.toFixed(1) : '---'}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gray-600 to-gray-500 rounded-full transition-all duration-1000"
                style={{ width: hasData ? `${(pdiData.diagnostico.nota_geral / 10) * 100}%` : '0%' }}
              ></div>
            </div>
          </div>

          <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
            <p className="text-gray-400 leading-relaxed italic">
              {hasData ? pdiData.diagnostico.resumo : 'O resumo do seu diagnóstico aparecerá aqui após a geração do PDI...'}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Notas SPIN */}
          <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">📊</span>
              Notas SPIN
            </h2>
            <div className="aspect-square max-w-sm mx-auto">
              {hasData ? renderRadarChart(pdiData.notas_spin) : renderEmptyRadarChart()}
            </div>
            <div className="mt-6 grid grid-cols-4 gap-2">
              <div className="text-center p-3 bg-green-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Situação</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.situacao.toFixed(1) : '---'}</p>
              </div>
              <div className="text-center p-3 bg-green-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Problema</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.problema.toFixed(1) : '---'}</p>
              </div>
              <div className="text-center p-3 bg-green-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Implicação</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.implicacao.toFixed(1) : '---'}</p>
              </div>
              <div className="text-center p-3 bg-green-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Necessidade</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.necessidade.toFixed(1) : '---'}</p>
              </div>
            </div>
          </div>

          {/* Foco da Semana */}
          <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">🎯</span>
              Foco da Semana
            </h2>

            <div className="p-5 bg-gradient-to-r from-green-900/40 to-blue-900/40 rounded-xl border border-green-500/30 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-lg">
                  <p className="text-green-300 font-bold text-2xl">
                    {hasData ? pdiData.foco_da_semana?.area || pdiData.meta_7_dias?.objetivo.split(' ')[0] || '?' : '?'}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-green-300 font-semibold text-sm">ÁREA PRIORITÁRIA</p>
                  <p className="text-gray-400 text-xs">
                    {hasData && pdiData.foco_da_semana?.area ?
                      `${pdiData.foco_da_semana.area === 'S' ? 'Situação' :
                         pdiData.foco_da_semana.area === 'P' ? 'Problema' :
                         pdiData.foco_da_semana.area === 'I' ? 'Implicação' : 'Necessidade'}`
                      : 'Será definida após análise...'}
                  </p>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-4">
                {hasData ? pdiData.foco_da_semana?.motivo || pdiData.meta_7_dias?.objetivo || 'Motivo será definido aqui...' : 'Motivo será definido aqui...'}
              </p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">Meta de Evolução</span>
                  <div className="flex items-center gap-2">
                    <span className="text-orange-400 font-bold">
                      {hasData ? (pdiData.foco_da_semana?.nota_atual || pdiData.meta_7_dias?.nota_atual || 0).toFixed(1) : '---'}
                    </span>
                    <span className="text-gray-500">→</span>
                    <span className="text-green-400 font-bold">
                      {hasData ? (pdiData.foco_da_semana?.nota_meta || pdiData.meta_7_dias?.nota_meta || 0).toFixed(1) : '---'}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
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
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <p className="text-gray-400 text-xs mb-1 font-semibold">META SEMANAL</p>
                <p className="text-white text-sm mb-2">
                  <span className="text-green-400 font-bold">{pdiData.meta_semanal.total_simulacoes}</span> simulações na Ramppy
                </p>
                <p className="text-gray-400 text-xs italic">{pdiData.meta_semanal.resultado_esperado}</p>
              </div>
            )}
          </div>
        </div>

        {/* Simulações */}
        <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">🎮</span>
            Simulações Recomendadas
          </h2>
          <div className="space-y-4">
            {hasData && pdiData.simulacoes ? (
              pdiData.simulacoes.map((simulacao, index) => (
                <div
                  key={index}
                  className="p-5 bg-gray-900/50 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-900/40 border border-purple-500/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-400 font-bold">{simulacao.quantidade}x</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold mb-3">{simulacao.objetivo}</p>

                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400 text-xs font-semibold">PERSONA:</span>
                          <span className="text-gray-300 text-sm">{simulacao.persona_sugerida}</span>
                        </div>
                        {simulacao.objecao_para_treinar && (
                          <div className="flex items-center gap-2">
                            <span className="text-orange-400 text-xs font-semibold">OBJEÇÃO:</span>
                            <span className="text-gray-300 text-sm">{simulacao.objecao_para_treinar}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-gray-500 text-xs mb-1">Critério de Sucesso</p>
                        <p className="text-green-400 text-sm">{simulacao.criterio_sucesso}</p>
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
                  className="p-5 bg-gray-900/50 rounded-xl border border-gray-700 hover:border-green-500/50 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-900/40 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-400 font-bold">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold mb-3">{acao.acao}</p>
                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-gray-500 text-xs mb-1">Resultado Esperado</p>
                        <p className="text-green-400 text-sm">{acao.resultado_esperado}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="p-5 bg-gray-900/50 rounded-xl border border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-700/40 border border-gray-600/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-500 font-bold">1</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 font-semibold mb-3 italic">Ação 1 será definida aqui...</p>
                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-gray-500 text-xs mb-1">Resultado Esperado</p>
                        <p className="text-gray-500 text-sm italic">---</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-5 bg-gray-900/50 rounded-xl border border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-700/40 border border-gray-600/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-500 font-bold">2</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 font-semibold mb-3 italic">Ação 2 será definida aqui...</p>
                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-gray-500 text-xs mb-1">Resultado Esperado</p>
                        <p className="text-gray-500 text-sm italic">---</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Próximo Ciclo */}
        <div className="bg-gradient-to-r from-green-900/60 to-blue-900/60 rounded-2xl p-6 md:p-8 border border-green-500/40 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">🚀</span>
            Próximo Ciclo
          </h2>
          <p className="text-gray-300 leading-relaxed italic">
            {hasData ? (pdiData.proximo_ciclo || pdiData.proximos_passos || 'Orientações sobre o próximo ciclo aparecerão aqui após a geração do PDI...') : 'Orientações sobre o próximo ciclo aparecerão aqui após a geração do PDI...'}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-gray-500 text-sm">
            PDI gerado automaticamente pela plataforma Ramppy • Foco em resultados em 7 dias
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
