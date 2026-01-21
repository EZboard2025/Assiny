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
      <svg viewBox="0 0 240 240" className="w-full h-full drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
        {/* Filtro de glow verde */}
        <defs>
          <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background diamonds (losangos) - 10 níveis */}
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => {
          const size = level * 8;
          return (
            <polygon
              key={level}
              points={`120,${120-size} ${120+size},120 120,${120+size} ${120-size},120`}
              fill="none"
              stroke={level % 2 === 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.08)"}
              strokeWidth="0.5"
            />
          );
        })}

        {/* Diagonal lines - verde tech */}
        <line x1="120" y1="40" x2="120" y2="200" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />
        <line x1="40" y1="120" x2="200" y2="120" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />

        {/* Data polygon */}
        <>
          {/* Glow effect verde */}
          <polygon
            points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
            fill="rgba(34, 197, 94, 0.15)"
            stroke="rgb(34, 197, 94)"
            strokeWidth="3"
            filter="url(#greenGlow)"
          />
          <polygon
            points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
            fill="rgba(34, 197, 94, 0.3)"
            stroke="rgb(34, 197, 94)"
            strokeWidth="2.5"
          />
          {/* Data points com efeito tech */}
          <circle cx="120" cy={sY} r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
          <circle cx="120" cy={sY} r="4" fill="rgb(34, 197, 94)" />
          <circle cx="120" cy={sY} r="2" fill="rgb(255, 255, 255)" />

          <circle cx={pX} cy="120" r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
          <circle cx={pX} cy="120" r="4" fill="rgb(34, 197, 94)" />
          <circle cx={pX} cy="120" r="2" fill="rgb(255, 255, 255)" />

          <circle cx="120" cy={iY} r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
          <circle cx="120" cy={iY} r="4" fill="rgb(34, 197, 94)" />
          <circle cx="120" cy={iY} r="2" fill="rgb(255, 255, 255)" />

          <circle cx={nX} cy="120" r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
          <circle cx={nX} cy="120" r="4" fill="rgb(34, 197, 94)" />
          <circle cx={nX} cy="120" r="2" fill="rgb(255, 255, 255)" />
        </>

        {/* Labels tech com borda verde */}
        <g>
          <rect x="100" y="15" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
          <text x="120" y="32" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">S</text>
        </g>
        <g>
          <rect x="200" y="108" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
          <text x="220" y="125" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">P</text>
        </g>
        <g>
          <rect x="100" y="201" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
          <text x="120" y="218" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">I</text>
        </g>
        <g>
          <rect x="0" y="108" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
          <text x="20" y="125" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">N</text>
        </g>
      </svg>
    )
  }

  const renderEmptyRadarChart = () => {
    return (
      <svg viewBox="0 0 240 240" className="w-full h-full opacity-30">
        {/* Background diamonds (losangos) - 10 níveis */}
        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => {
          const size = level * 8;
          return (
            <polygon
              key={level}
              points={`120,${120-size} ${120+size},120 120,${120+size} ${120-size},120`}
              fill="none"
              stroke="rgba(107, 114, 128, 0.3)"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Diagonal lines */}
        <line x1="120" y1="40" x2="120" y2="200" stroke="rgba(107, 114, 128, 0.3)" strokeWidth="0.5" />
        <line x1="40" y1="120" x2="200" y2="120" stroke="rgba(107, 114, 128, 0.3)" strokeWidth="0.5" />

        {/* Labels */}
        <g>
          <rect x="100" y="15" width="40" height="24" rx="6" fill="rgba(107, 114, 128, 0.1)" stroke="rgba(107, 114, 128, 0.3)" strokeWidth="1.5" />
          <text x="120" y="32" textAnchor="middle" fill="rgb(107, 114, 128)" fontSize="14" fontWeight="bold">S</text>
        </g>
        <g>
          <rect x="200" y="108" width="40" height="24" rx="6" fill="rgba(107, 114, 128, 0.1)" stroke="rgba(107, 114, 128, 0.3)" strokeWidth="1.5" />
          <text x="220" y="125" textAnchor="middle" fill="rgb(107, 114, 128)" fontSize="14" fontWeight="bold">P</text>
        </g>
        <g>
          <rect x="100" y="201" width="40" height="24" rx="6" fill="rgba(107, 114, 128, 0.1)" stroke="rgba(107, 114, 128, 0.3)" strokeWidth="1.5" />
          <text x="120" y="218" textAnchor="middle" fill="rgb(107, 114, 128)" fontSize="14" fontWeight="bold">I</text>
        </g>
        <g>
          <rect x="0" y="108" width="40" height="24" rx="6" fill="rgba(107, 114, 128, 0.1)" stroke="rgba(107, 114, 128, 0.3)" strokeWidth="1.5" />
          <text x="20" y="125" textAnchor="middle" fill="rgb(107, 114, 128)" fontSize="14" fontWeight="bold">N</text>
        </g>
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
    <div className="min-h-screen py-20 px-6 relative z-10">
      <div className="max-w-6xl mx-auto space-y-6">

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
        <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)] hover:shadow-[0_0_60px_rgba(34,197,94,0.25)] transition-all duration-500">
          {/* Efeito de brilho */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 rounded-2xl"></div>

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                <Target className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-1 bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                  PDI • 7 Dias
                </h1>
                <p className="text-gray-400 text-lg flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  {hasData && pdiData.vendedor ? `${pdiData.vendedor.nome} • ${pdiData.vendedor.empresa}` : 'Aguardando dados...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {!hasData ? (
                <button
                  onClick={handleGeneratePDI}
                  disabled={isLoading}
                  className="group relative px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl font-bold transition-all hover:scale-105 hover:-translate-y-1 flex items-center gap-3 shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_50px_rgba(34,197,94,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      <span>Gerando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                      <span>Gerar PDI</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleGeneratePDI}
                    disabled={isLoading || cooldownRemaining > 0}
                    className="group relative px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl font-medium transition-all hover:scale-105 hover:-translate-y-1 flex items-center gap-2 shadow-[0_0_25px_rgba(34,197,94,0.3)] hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0"
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
                        <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        <span>Gerar Novo</span>
                      </>
                    )}
                  </button>
                  {hasData && pdiData.vendedor && (
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all"></div>
                      <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-xl p-4 border border-green-500/30 backdrop-blur-sm text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Award className="w-3 h-3 text-green-400" />
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Sessões</p>
                        </div>
                        <p className="text-2xl font-bold text-white">{pdiData.vendedor.total_sessoes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {hasData && (
            <div className="relative mt-6 pt-4 border-t border-gray-700/50">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-4 h-4 text-green-400" />
                  <span>Gerado em {formatDate(pdiData.gerado_em)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-green-400 font-semibold">{pdiData.periodo}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Diagnóstico Geral */}
        <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)] hover:shadow-[0_0_60px_rgba(34,197,94,0.25)] transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 rounded-2xl"></div>

          <h2 className="relative text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              <Award className="w-6 h-6 text-green-400" />
            </div>
            <span className="bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent">
              Diagnóstico Geral
            </span>
          </h2>

          <div className="relative mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-300 font-medium text-lg">Nota Geral</span>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/50 to-emerald-500/50 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                <span className="relative text-5xl font-black bg-gradient-to-br from-green-400 via-emerald-300 to-green-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                  {hasData ? pdiData.diagnostico.nota_geral.toFixed(1) : '---'}
                </span>
              </div>
            </div>
            <div className="relative w-full bg-gray-900/50 rounded-full h-4 overflow-hidden border border-gray-700/50 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(34,197,94,0.5)] relative overflow-hidden"
                style={{ width: hasData ? `${(pdiData.diagnostico.nota_geral / 10) * 100}%` : '0%' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
              </div>
            </div>
          </div>

          <div className="relative p-6 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-green-500/20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent"></div>
            <p className="relative text-gray-300 leading-relaxed text-base">
              {hasData ? pdiData.diagnostico.resumo : 'O resumo do seu diagnóstico aparecerá aqui após a geração do PDI...'}
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Notas SPIN */}
          <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)] hover:shadow-[0_0_60px_rgba(34,197,94,0.25)] transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 rounded-2xl"></div>

            <h2 className="relative text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <span className="bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent">
                Notas SPIN
              </span>
            </h2>
            <div className="aspect-square max-w-sm mx-auto">
              {hasData ? renderRadarChart(pdiData.notas_spin) : renderEmptyRadarChart()}
            </div>
            <div className="relative mt-6 grid grid-cols-4 gap-3">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all"></div>
                <div className="relative text-center p-3 bg-green-900/20 backdrop-blur-sm rounded-xl border border-green-500/20 hover:border-green-500/40 transition-all">
                  <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Situação</p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-green-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                    {hasData ? pdiData.notas_spin.situacao.toFixed(1) : '---'}
                  </p>
                </div>
              </div>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all"></div>
                <div className="relative text-center p-3 bg-green-900/20 backdrop-blur-sm rounded-xl border border-green-500/20 hover:border-green-500/40 transition-all">
                  <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Problema</p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-green-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                    {hasData ? pdiData.notas_spin.problema.toFixed(1) : '---'}
                  </p>
                </div>
              </div>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all"></div>
                <div className="relative text-center p-3 bg-green-900/20 backdrop-blur-sm rounded-xl border border-green-500/20 hover:border-green-500/40 transition-all">
                  <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Implicação</p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-green-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                    {hasData ? pdiData.notas_spin.implicacao.toFixed(1) : '---'}
                  </p>
                </div>
              </div>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all"></div>
                <div className="relative text-center p-3 bg-green-900/20 backdrop-blur-sm rounded-xl border border-green-500/20 hover:border-green-500/40 transition-all">
                  <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider">Necessidade</p>
                  <p className="text-2xl font-bold bg-gradient-to-br from-green-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                    {hasData ? pdiData.notas_spin.necessidade.toFixed(1) : '---'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Foco da Semana */}
          <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)] hover:shadow-[0_0_60px_rgba(34,197,94,0.25)] transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 rounded-2xl"></div>

            <h2 className="relative text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                <Zap className="w-6 h-6 text-green-400" />
              </div>
              <span className="bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent">
                Foco da Semana
              </span>
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
        <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)] hover:shadow-[0_0_60px_rgba(34,197,94,0.25)] transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 rounded-2xl"></div>

          <h2 className="relative text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <span className="bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent">
              Simulações Recomendadas
            </span>
          </h2>
          <div className="relative space-y-4">
            {hasData && pdiData.simulacoes ? (
              pdiData.simulacoes.map((simulacao, index) => (
                <div
                  key={index}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/5 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative p-5 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-green-500/30 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-lg"></div>
                        <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                          <span className="text-green-400 font-bold text-lg">{simulacao.quantidade}x</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-lg mb-3">{simulacao.objetivo}</p>

                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Persona:</span>
                            <span className="text-gray-200 text-sm">{simulacao.persona_sugerida}</span>
                          </div>
                          {simulacao.objecao_para_treinar && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
                              <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Objeção:</span>
                              <span className="text-gray-200 text-sm">{simulacao.objecao_para_treinar}</span>
                            </div>
                          )}
                        </div>

                        <div className="relative p-3 bg-gradient-to-br from-green-900/20 to-emerald-900/10 rounded-lg border border-green-500/20 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent"></div>
                          <p className="relative text-gray-400 text-xs mb-1 uppercase tracking-wider font-semibold">Critério de Sucesso</p>
                          <p className="relative text-green-300 text-sm font-medium">{simulacao.criterio_sucesso}</p>
                        </div>
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
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/5 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative p-5 bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50 hover:border-green-500/30 transition-all duration-300">
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-lg"></div>
                        <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                          <span className="text-green-400 font-bold text-lg">{index + 1}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-lg mb-3">{acao.acao}</p>
                        <div className="relative p-3 bg-gradient-to-br from-green-900/20 to-emerald-900/10 rounded-lg border border-green-500/20 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent"></div>
                          <p className="relative text-gray-400 text-xs mb-1 uppercase tracking-wider font-semibold">Resultado Esperado</p>
                          <p className="relative text-green-300 text-sm font-medium">{acao.resultado_esperado}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="p-5 bg-gray-900/20 backdrop-blur-sm rounded-xl border border-gray-700/30 opacity-50">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-700/20 border border-gray-600/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-500 font-bold text-lg">1</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 font-semibold text-lg mb-3 italic">Simulação 1 será definida aqui...</p>
                      <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                        <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Critério de Sucesso</p>
                        <p className="text-gray-500 text-sm italic">---</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-5 bg-gray-900/20 backdrop-blur-sm rounded-xl border border-gray-700/30 opacity-50">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-700/20 border border-gray-600/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-500 font-bold text-lg">2</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-400 font-semibold text-lg mb-3 italic">Simulação 2 será definida aqui...</p>
                      <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
                        <p className="text-gray-500 text-xs mb-1 uppercase tracking-wider">Critério de Sucesso</p>
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
        <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)] hover:shadow-[0_0_60px_rgba(34,197,94,0.25)] transition-all duration-500 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-full blur-3xl"></div>

          <h2 className="relative text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
              <Sparkles className="w-6 h-6 text-green-400" />
            </div>
            <span className="bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent">
              Próximo Ciclo
            </span>
          </h2>
          <p className="relative text-gray-200 leading-relaxed">
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
  )
}
