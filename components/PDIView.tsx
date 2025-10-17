'use client'

import { useState, useEffect } from 'react'

interface PDIData {
  versao?: string
  gerado_em: string
  periodo: string
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
  meta_7_dias: {
    objetivo: string
    nota_atual: number
    nota_meta: number
    como_medir: string
  }
  acoes: Array<{
    acao: string
    resultado_esperado: string
  }>
  checkpoint: {
    quando: string
    como_avaliar: string
  }
  proximos_passos: string
}

export default function PDIView() {
  const [pdiData, setPdiData] = useState<PDIData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastPdiDate, setLastPdiDate] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0)
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
    // Verificar cooldown
    if (cooldownRemaining > 0) {
      alert(`Você só pode gerar um novo PDI após ${cooldownRemaining} dia(s). Aguarde o período de cooldown.`)
      return
    }

    setIsLoading(true)
    try {
      // Buscar dados do usuário autenticado
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('Usuário não autenticado')
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
          alert('Erro ao remover PDI antigo. Tente novamente.')
          setIsLoading(false)
          return
        }
        console.log('PDI antigo removido com sucesso')
      }

      // Buscar resumo de performance do usuário
      const { data: performanceSummary, error } = await supabase
        .from('user_performance_summaries')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error || !performanceSummary) {
        alert('Você precisa completar algumas sessões de roleplay antes de gerar o PDI.')
        setIsLoading(false)
        return
      }

      // Formatar resumo de performance em texto único
      const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'Vendedor'

      // Extrair médias SPIN corretamente (a tabela usa colunas separadas, não um objeto)
      const spinS = performanceSummary.spin_s_average !== undefined && performanceSummary.spin_s_average !== null
        ? parseFloat(performanceSummary.spin_s_average)
        : 0
      const spinP = performanceSummary.spin_p_average !== undefined && performanceSummary.spin_p_average !== null
        ? parseFloat(performanceSummary.spin_p_average)
        : 0
      const spinI = performanceSummary.spin_i_average !== undefined && performanceSummary.spin_i_average !== null
        ? parseFloat(performanceSummary.spin_i_average)
        : 0
      const spinN = performanceSummary.spin_n_average !== undefined && performanceSummary.spin_n_average !== null
        ? parseFloat(performanceSummary.spin_n_average)
        : 0

      // Extrair pontos fortes (podem ser objetos ou strings)
      const topStrengths = performanceSummary.top_strengths || []
      const strengthsList = topStrengths.map((item: any) => {
        if (typeof item === 'string') return item
        if (item.strength) return item.strength
        if (item.text) return item.text
        return JSON.stringify(item)
      }).filter((s: string) => s && s.trim() !== '')

      // Extrair gaps críticos (podem ser objetos ou strings)
      const criticalGaps = performanceSummary.critical_gaps || []
      const gapsList = criticalGaps.map((item: any) => {
        if (typeof item === 'string') return item
        if (item.gap) return item.gap
        if (item.text) return item.text
        return JSON.stringify(item)
      }).filter((g: string) => g && g.trim() !== '')

      const resumoTexto = `
RESUMO DE PERFORMANCE - ${userName}

DADOS GERAIS:
- Nome: ${userName}
- Empresa: Assiny
- Total de Sessões: ${performanceSummary.total_sessions}
- Nota Média Geral: ${performanceSummary.overall_average?.toFixed(1) || 'N/A'}

MÉDIAS SPIN:
- Situação (S): ${spinS.toFixed(1)}
- Problema (P): ${spinP.toFixed(1)}
- Implicação (I): ${spinI.toFixed(1)}
- Necessidade (N): ${spinN.toFixed(1)}

PONTOS FORTES RECORRENTES:
${strengthsList.length > 0 ? strengthsList.map((s: string) => `- ${s}`).join('\n') : '- Nenhum ponto forte identificado ainda'}

GAPS CRÍTICOS RECORRENTES:
${gapsList.length > 0 ? gapsList.map((g: string) => `- ${g}`).join('\n') : '- Nenhum gap identificado ainda'}

MELHORIAS PRIORITÁRIAS:
${performanceSummary.priority_improvements?.length > 0 ? performanceSummary.priority_improvements.map((improvement: any, index: number) =>
  `${index + 1}. Área: ${improvement.area || 'N/A'}
   - Prioridade: ${improvement.priority || 'N/A'}
   - Gap Atual: ${improvement.current_gap || 'N/A'}
   - Ação Sugerida: ${improvement.action_plan || 'N/A'}`
).join('\n\n') : '- Nenhuma melhoria prioritária identificada ainda'}
      `.trim()

      console.log('=== DEBUG PDI ===')
      console.log('Performance Summary Raw:', performanceSummary)
      console.log('SPIN Averages:', { spinS, spinP, spinI, spinN })
      console.log('Strengths List:', strengthsList)
      console.log('Gaps List:', gapsList)
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
          resumoPerformance: resumoTexto
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
          empresa: 'Assiny',
          total_sessoes: performanceSummary.total_sessions
        }
      }

      // Salvar PDI no banco de dados
      const { error: insertError } = await supabase
        .from('pdis')
        .insert({
          user_id: user.id,
          vendedor_nome: parsedPDI.vendedor.nome,
          vendedor_empresa: parsedPDI.vendedor.empresa,
          total_sessoes: parsedPDI.vendedor.total_sessoes,
          versao: parsedPDI.versao || 'pdi.7dias.v1',
          periodo: parsedPDI.periodo,
          gerado_em: parsedPDI.gerado_em,
          nota_geral: parsedPDI.diagnostico.nota_geral,
          resumo: parsedPDI.diagnostico.resumo,
          nota_situacao: parsedPDI.notas_spin.situacao,
          nota_problema: parsedPDI.notas_spin.problema,
          nota_implicacao: parsedPDI.notas_spin.implicacao,
          nota_necessidade: parsedPDI.notas_spin.necessidade,
          meta_objetivo: parsedPDI.meta_7_dias.objetivo,
          meta_nota_atual: parsedPDI.meta_7_dias.nota_atual,
          meta_nota_meta: parsedPDI.meta_7_dias.nota_meta,
          meta_como_medir: parsedPDI.meta_7_dias.como_medir,
          acoes: parsedPDI.acoes,
          checkpoint_quando: parsedPDI.checkpoint.quando,
          checkpoint_como_avaliar: parsedPDI.checkpoint.como_avaliar,
          proximos_passos: parsedPDI.proximos_passos,
          status: 'ativo',
          pdi_json: parsedPDI
        })

      if (insertError) {
        console.error('Erro ao salvar PDI no banco:', insertError)
        alert('PDI gerado com sucesso, mas houve um erro ao salvar. Tente novamente.')
        return
      }

      console.log('PDI salvo no banco com sucesso!')
      setPdiData(parsedPDI)

      // Atualizar data do último PDI e resetar cooldown
      setLastPdiDate(new Date().toISOString())
      setCooldownRemaining(7)
    } catch (error) {
      console.error('Erro ao gerar PDI:', error)
      alert('Erro ao gerar PDI. Tente novamente.')
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
            <text x={pos.x} y={pos.y + 12} textAnchor="middle" dominantBaseline="middle" className="fill-purple-400 font-semibold text-xs">{pos.value.toFixed(1)}</text>
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
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
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

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-2xl p-6 md:p-8 border border-purple-500/20 shadow-2xl">
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
              <span className="px-4 py-2 rounded-lg border font-semibold text-center bg-purple-500/20 text-purple-400 border-purple-500/30">
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
              <div className="text-center p-3 bg-purple-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Situação</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.situacao.toFixed(1) : '---'}</p>
              </div>
              <div className="text-center p-3 bg-purple-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Problema</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.problema.toFixed(1) : '---'}</p>
              </div>
              <div className="text-center p-3 bg-purple-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Implicação</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.implicacao.toFixed(1) : '---'}</p>
              </div>
              <div className="text-center p-3 bg-purple-900/30 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Necessidade</p>
                <p className="text-gray-500 font-bold text-lg">{hasData ? pdiData.notas_spin.necessidade.toFixed(1) : '---'}</p>
              </div>
            </div>
          </div>

          {/* Meta 7 Dias */}
          <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-3xl">🎯</span>
              Meta de 7 Dias
            </h2>

            <div className="p-5 bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-xl border border-purple-500/30 mb-4">
              <p className="text-purple-300 font-semibold mb-2 text-sm">OBJETIVO</p>
              <p className="text-gray-400 text-base italic mb-4">{hasData ? pdiData.meta_7_dias.objetivo : 'Seu objetivo será definido aqui...'}</p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-300 text-sm">Progresso</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-bold">{hasData ? pdiData.meta_7_dias.nota_atual.toFixed(1) : '---'}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-gray-500 font-bold">{hasData ? pdiData.meta_7_dias.nota_meta.toFixed(1) : '---'}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gray-600 to-gray-500 rounded-full transition-all duration-1000"
                    style={{
                      width: hasData ? `${(pdiData.meta_7_dias.nota_atual / pdiData.meta_7_dias.nota_meta) * 100}%` : '0%'
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
              <p className="text-gray-400 text-xs mb-1 font-semibold">COMO MEDIR</p>
              <p className="text-gray-400 text-sm italic">{hasData ? pdiData.meta_7_dias.como_medir : 'Critérios de medição serão definidos...'}</p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8 border border-gray-700/50 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">📋</span>
            Ações para os Próximos 7 Dias
          </h2>
          <div className="space-y-4">
            {hasData ? (
              pdiData.acoes.map((acao, index) => (
                <div
                  key={index}
                  className="p-5 bg-gray-900/50 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-900/40 border border-purple-500/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-purple-400 font-bold">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold mb-3">{acao.acao}</p>
                      <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-gray-500 text-xs mb-1">Resultado Esperado</p>
                        <p className="text-purple-400 text-sm">{acao.resultado_esperado}</p>
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

        {/* Próximos Passos */}
        <div className="bg-gradient-to-r from-purple-900/60 to-blue-900/60 rounded-2xl p-6 md:p-8 border border-purple-500/40 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-3xl">🚀</span>
            Próximos Passos
          </h2>
          <p className="text-gray-300 leading-relaxed italic">
            {hasData ? pdiData.proximos_passos : 'Orientações sobre os próximos passos aparecerão aqui após a geração do PDI...'}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-gray-500 text-sm">
            PDI gerado automaticamente pela plataforma Assiny • Foco em resultados em 7 dias
          </p>
        </div>
        </div>
      </div>
    </div>
  )
}
