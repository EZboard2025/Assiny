'use client'

import { useState, useEffect } from 'react'
import { User, TrendingUp, Target, Zap, Search, Settings, BarChart3, Play, ChevronLeft, ChevronRight, FileText, History, Users, MessageSquare, FileSearch, Award, Calendar, CheckCircle, AlertCircle, Sparkles, X } from 'lucide-react'
import { getUserRoleplaySessions, type RoleplaySession } from '@/lib/roleplay'
import { getFollowUpAnalyses, getFollowUpStats } from '@/lib/followup'

interface PerfilViewProps {
  onViewChange?: (view: 'home' | 'chat' | 'roleplay' | 'pdi' | 'historico' | 'perfil' | 'roleplay-links' | 'followup') => void | Promise<void>
}

// Tipos para as estatísticas
interface PersonaStats {
  persona: any
  count: number
  scores: number[]
  average: number
  lastPractice: string
}

interface ObjectionStats {
  name: string
  count: number
  scores: number[]
  average: number
  bestScore: number
}

export default function PerfilView({ onViewChange }: PerfilViewProps = {}) {
  const [mounted, setMounted] = useState(false)
  const [spinAverages, setSpinAverages] = useState({
    S: 0,
    P: 0,
    I: 0,
    N: 0
  })
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [evolutionData, setEvolutionData] = useState<Array<{ label: string, score: number, date: string }>>([])
  const [latestSession, setLatestSession] = useState<{ label: string, score: number, improvement: number } | null>(null)
  const [scrollIndex, setScrollIndex] = useState(0)
  const [overallAverage, setOverallAverage] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [summaryData, setSummaryData] = useState<any>(null)
  const [sessions, setSessions] = useState<RoleplaySession[]>([])

  // Novos estados para as abas
  const [activeTab, setActiveTab] = useState<'geral' | 'personas' | 'objecoes' | 'followups'>('geral')
  const [personaStats, setPersonaStats] = useState<Map<string, PersonaStats>>(new Map())
  const [objectionStats, setObjectionStats] = useState<Map<string, ObjectionStats>>(new Map())

  // Estados para follow-ups
  const [followUpAnalyses, setFollowUpAnalyses] = useState<any[]>([])
  const [followUpStats, setFollowUpStats] = useState<any>(null)
  const [loadingFollowUps, setLoadingFollowUps] = useState(false)
  const [selectedFollowUpAnalysis, setSelectedFollowUpAnalysis] = useState<any>(null)

  const maxVisibleSessions = 8

  useEffect(() => {
    setMounted(true)
    loadUserData()
    loadSpinAverages()
    loadFollowUpData()
  }, [])

  const loadUserData = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUserEmail(user.email || '')
        // Tentar pegar o nome do user_metadata ou usar email
        setUserName(user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário')
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error)
    }
  }

  const loadFollowUpData = async () => {
    try {
      setLoadingFollowUps(true)

      // Carregar análises
      const { data: analyses, error: analysesError } = await getFollowUpAnalyses()
      if (!analysesError && analyses) {
        setFollowUpAnalyses(analyses)
      }

      // Carregar estatísticas
      const stats = await getFollowUpStats()
      if (stats) {
        setFollowUpStats(stats)
      }
    } catch (error) {
      console.error('Erro ao carregar dados de follow-up:', error)
    } finally {
      setLoadingFollowUps(false)
    }
  }

  const loadSpinAverages = async () => {
    try {
      setLoading(true)
      const allSessions = await getUserRoleplaySessions(1000) // Buscar todas as sessões
      console.log(`📊 PerfilView: Total de sessões carregadas: ${allSessions.length}`)
      setSessions(allSessions) // Salvar todas as sessões para o resumo

      // Filtrar apenas sessões completadas com avaliação
      const completedSessions = allSessions.filter(session =>
        session.status === 'completed' && (session as any).evaluation
      )

      console.log(`✅ Sessões completadas com avaliação: ${completedSessions.length}`)

      if (completedSessions.length === 0) {
        setLoading(false)
        return
      }

      // Somar todas as notas de cada pilar SPIN
      const totals = { S: 0, P: 0, I: 0, N: 0 }
      const counts = { S: 0, P: 0, I: 0, N: 0 }

      // Preparar dados de evolução
      const evolutionPoints: Array<{ label: string, score: number, date: string }> = []
      let totalOverallScore = 0
      let countOverallScore = 0

      completedSessions.forEach((session, index) => {
        let evaluation = (session as any).evaluation

        console.log(`🔍 Sessão ${index + 1}:`, {
          id: session.id,
          hasOutput: evaluation?.output !== undefined,
          hasSpinEval: evaluation?.spin_evaluation !== undefined
        })

        // Parse se necessário (formato N8N)
        if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
          console.log('📦 Parseando evaluation com output...')
          try {
            evaluation = JSON.parse(evaluation.output)
          } catch (e) {
            console.error('❌ Erro ao fazer parse de evaluation:', e)
            return
          }
        }

        // Somar scores de cada pilar
        if (evaluation?.spin_evaluation) {
          const spinEval = evaluation.spin_evaluation

          if (spinEval.S?.final_score !== undefined) {
            totals.S += spinEval.S.final_score
            counts.S += 1
          }
          if (spinEval.P?.final_score !== undefined) {
            totals.P += spinEval.P.final_score
            counts.P += 1
          }
          if (spinEval.I?.final_score !== undefined) {
            totals.I += spinEval.I.final_score
            counts.I += 1
          }
          if (spinEval.N?.final_score !== undefined) {
            totals.N += spinEval.N.final_score
            counts.N += 1
          }
        }

        // Usar overall_score REAL da avaliação (convertendo de 0-100 para 0-10)
        if (evaluation?.overall_score !== undefined) {
          let scoreValue = parseFloat(evaluation.overall_score)

          // Converter de 0-100 para 0-10 se necessário
          if (scoreValue > 10) {
            scoreValue = scoreValue / 10
          }

          console.log(`📊 Sessão ${index + 1}: overall_score = ${evaluation.overall_score} → ${scoreValue}/10`)
          totalOverallScore += scoreValue
          countOverallScore++

          const sessionDate = new Date(session.created_at)
          const label = `#${completedSessions.length - index}`
          evolutionPoints.push({
            label,
            score: scoreValue,
            date: sessionDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          })
        }
      })

      // Calcular médias
      setSpinAverages({
        S: counts.S > 0 ? totals.S / counts.S : 0,
        P: counts.P > 0 ? totals.P / counts.P : 0,
        I: counts.I > 0 ? totals.I / counts.I : 0,
        N: counts.N > 0 ? totals.N / counts.N : 0
      })

      // Calcular média geral
      const avgOverall = countOverallScore > 0 ? totalOverallScore / countOverallScore : 0
      console.log(`📈 Cálculo da média: Total = ${totalOverallScore}, Count = ${countOverallScore}, Média = ${avgOverall}`)
      setOverallAverage(avgOverall)
      setTotalSessions(countOverallScore)

      // Reverter para ordem cronológica
      const orderedData = evolutionPoints.reverse()
      setEvolutionData(orderedData)

      // Calcular melhoria da última sessão
      if (orderedData.length > 0) {
        const latest = orderedData[orderedData.length - 1]
        const previous = orderedData.length > 1 ? orderedData[orderedData.length - 2] : null
        const improvement = previous ? latest.score - previous.score : 0

        setLatestSession({
          label: latest.label,
          score: latest.score,
          improvement
        })
      }

      // Processar estatísticas por persona e objeção
      processPersonaStats(completedSessions)
      processObjectionStats(completedSessions)

      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar médias SPIN:', error)
      setLoading(false)
    }
  }

  // Função para processar estatísticas por persona
  const processPersonaStats = (sessions: RoleplaySession[]) => {
    const stats = new Map<string, PersonaStats>()
    console.log('🔍 Processando estatísticas de personas...')
    console.log('Total de sessões para processar:', sessions.length)

    // Debug: Ver estrutura das sessões
    if (sessions.length > 0) {
      console.log('📊 Exemplo de config da primeira sessão:', (sessions[0] as any).config)
    }

    sessions.forEach((session, index) => {
      const config = (session as any).config
      console.log(`Sessão ${index + 1} config:`, config)

      // Tentar pegar persona ou usar segment como fallback
      let persona = config?.persona || config?.selectedPersona // Pode estar em campos diferentes
      let personaId = persona?.id || persona?.persona_id

      // Debug detalhado da persona
      console.log(`Sessão ${index + 1} - Persona encontrada:`, {
        temPersona: !!persona,
        personaId: personaId,
        personaCompleta: persona
      })

      // Se não tem persona mas tem segment (sessões antigas), criar um objeto persona fictício
      if (!persona && config?.segment) {
        // Usar o segment como ID para agrupar sessões do mesmo segment
        persona = {
          id: `segment-${config.segment}`,
          cargo: config.segment,
          tipo_empresa_faturamento: 'Sessão Antiga (Segment)'
        }
        personaId = persona.id
        console.log(`Sessão ${index + 1}: Usando segment como persona:`, config.segment)
      }

      if (!personaId || !persona) {
        console.log(`Sessão ${index + 1}: Sem persona ou segment - IGNORANDO`)
        return
      }
      console.log(`Sessão ${index + 1}: AGRUPANDO persona ID "${personaId}" - Nome: "${persona.cargo || persona.job_title || 'Sem nome'}"`)

      let evaluation = (session as any).evaluation
      // Parse se necessário
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try {
          evaluation = JSON.parse(evaluation.output)
        } catch (e) {
          return
        }
      }

      if (!evaluation?.overall_score) return

      let score = evaluation.overall_score
      // Converter de 0-100 para 0-10 se necessário
      if (score > 10) {
        score = score / 10
      }

      if (!stats.has(personaId)) {
        stats.set(personaId, {
          persona: persona,
          count: 0,
          scores: [],
          average: 0,
          lastPractice: session.created_at
        })
      }

      const stat = stats.get(personaId)!
      stat.count++
      stat.scores.push(score)
      // Atualizar última prática se for mais recente
      if (new Date(session.created_at) > new Date(stat.lastPractice)) {
        stat.lastPractice = session.created_at
      }
    })

    // Calcular médias
    stats.forEach((stat, personaId) => {
      stat.average = stat.scores.length > 0
        ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length
        : 0

      console.log(`📈 Persona "${stat.persona.cargo || stat.persona.job_title}" (ID: ${personaId}):`, {
        praticas: stat.count,
        notas: stat.scores,
        media: stat.average.toFixed(1)
      })
    })

    console.log('📊 Total de personas agrupadas:', stats.size)
    console.log('📊 Estatísticas de personas finais:', Array.from(stats.entries()))
    setPersonaStats(stats)
  }

  // Função para processar estatísticas por objeção
  const processObjectionStats = (sessions: RoleplaySession[]) => {
    const stats = new Map<string, ObjectionStats>()
    console.log('🔍 Processando estatísticas de objeções...')

    sessions.forEach((session, index) => {
      const config = (session as any).config
      let evaluation = (session as any).evaluation
      // Parse se necessário
      if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
        try {
          evaluation = JSON.parse(evaluation.output)
        } catch (e) {
          return
        }
      }

      // Tentar pegar objections_analysis ou usar objections do config como fallback
      let objectionsToAnalyze = evaluation?.objections_analysis

      // Se não tem objections_analysis mas tem objections no config (para sessões com dados parciais)
      if (!objectionsToAnalyze && config?.objections && Array.isArray(config.objections)) {
        console.log(`Sessão ${index + 1}: Usando objections do config como fallback`)
        objectionsToAnalyze = config.objections.map((obj: any, objIdx: number) => ({
          objection: obj.name || obj.objection || `Objeção #${objIdx + 1}`,
          handling_score: 5 // Score padrão para objeções sem avaliação
        }))
      }

      if (!objectionsToAnalyze || !Array.isArray(objectionsToAnalyze)) {
        console.log(`Sessão ${index + 1}: Sem objections_analysis ou objections`)
        return
      }
      console.log(`Sessão ${index + 1}: objections encontrado:`, objectionsToAnalyze)

      objectionsToAnalyze.forEach((obj: any, objIdx: number) => {
        console.log(`Sessão ${index + 1}, Objeção ${objIdx + 1}:`, obj)

        // Primeiro verificar se tem objection_id válido
        let objId = obj.objection_id || obj.id || null

        // FILTRO: Só processar objeções com ID válido
        // Aceitar IDs reais (UUID), legacy-X, ou unknown-X
        // Ignorar apenas objeções sem ID ou com "não-configurada"
        if (!objId || objId === 'não-configurada') {
          console.log(`Sessão ${index + 1}, Objeção ${objIdx + 1}: Ignorando - sem objection_id válido`)
          return // Pular esta objeção
        }

        // Se tem objection_id válido, tentar encontrar o nome da objeção configurada
        let objName = ''
        if (config?.objections) {
          // Procurar a objeção pelo ID real
          const configuredObj = config.objections.find((o: any) => {
            // Comparar com o ID real do banco
            if (typeof o === 'object' && o.id === objId) {
              return true
            }
            // Para formato legacy, comparar pelo índice
            if (objId.startsWith('legacy-')) {
              const index = parseInt(objId.replace('legacy-', ''))
              return config.objections.indexOf(o) === index
            }
            return false
          })

          if (configuredObj) {
            objName = typeof configuredObj === 'string' ? configuredObj : (configuredObj.name || '')
            console.log(`Objeção mapeada pelo ID ${objId}: ${objName}`)
          }
        }

        // Se não conseguiu mapear, tentar usar o texto da objeção como fallback
        if (!objName) {
          objName = obj.objection_text || obj.objection || obj.name || `Objeção ${objId}`
          console.log(`Usando texto da objeção como fallback: ${objName}`)
        }

        const handlingScore = obj.handling_score || obj.score || 5
        console.log(`Processando: "${objName}", score: ${handlingScore}, ID: ${objId}`)

        if (!stats.has(objName)) {
          stats.set(objName, {
            name: objName,
            count: 0,
            scores: [],
            average: 0,
            bestScore: 0
          })
        }

        const stat = stats.get(objName)!
        stat.count++
        stat.scores.push(handlingScore)
        stat.bestScore = Math.max(stat.bestScore, handlingScore)
      })
    })

    // Calcular médias
    stats.forEach(stat => {
      stat.average = stat.scores.length > 0
        ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length
        : 0
    })

    console.log('📊 Estatísticas de objeções finais:', stats)
    setObjectionStats(stats)
  }

  // Processar evaluation antes de usar
  const getProcessedEvaluation = (session: RoleplaySession) => {
    let evaluation = (session as any).evaluation

    // Se evaluation tem estrutura N8N {output: "..."}, fazer parse
    if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
      try {
        evaluation = JSON.parse(evaluation.output)
      } catch (e) {
        return null
      }
    }

    return evaluation
  }

  const generateSummary = () => {
    const completedSessions = sessions.filter(s => s.status === 'completed' && (s as any).evaluation)

    if (completedSessions.length === 0) {
      alert('Nenhuma sessão avaliada para gerar resumo')
      return
    }

    // Processar todas as avaliações
    const allEvaluations = completedSessions.map(s => getProcessedEvaluation(s)).filter(e => e !== null)

    // Calcular médias gerais (usando todas as sessões)
    // Usar overall_score REAL da avaliação (não média SPIN)
    let totalScore = 0
    let countScore = 0

    allEvaluations.forEach(e => {
      if (e?.overall_score !== undefined) {
        let scoreValue = e.overall_score

        // Converter de 0-100 para 0-10 se necessário
        if (scoreValue > 10) {
          scoreValue = scoreValue / 10
        }

        totalScore += scoreValue
        countScore++
      }
    })

    const avgScore = countScore > 0 ? totalScore / countScore : 0

    // Médias SPIN (usando todas as sessões)
    const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
    const spinCounts = { S: 0, P: 0, I: 0, N: 0 }

    allEvaluations.forEach(e => {
      if (e?.spin_evaluation) {
        const spin = e.spin_evaluation
        if (spin.S?.final_score !== undefined) { spinTotals.S += spin.S.final_score; spinCounts.S++ }
        if (spin.P?.final_score !== undefined) { spinTotals.P += spin.P.final_score; spinCounts.P++ }
        if (spin.I?.final_score !== undefined) { spinTotals.I += spin.I.final_score; spinCounts.I++ }
        if (spin.N?.final_score !== undefined) { spinTotals.N += spin.N.final_score; spinCounts.N++ }
      }
    })

    const spinAveragesSummary = {
      S: spinCounts.S > 0 ? spinTotals.S / spinCounts.S : 0,
      P: spinCounts.P > 0 ? spinTotals.P / spinCounts.P : 0,
      I: spinCounts.I > 0 ? spinTotals.I / spinCounts.I : 0,
      N: spinCounts.N > 0 ? spinTotals.N / spinCounts.N : 0
    }

    // Para pontos fortes, gaps e melhorias, usar apenas os últimos 5 roleplays
    const last5Sessions = completedSessions.slice(-5) // Pegar os 5 mais recentes
    const last5Evaluations = last5Sessions.map((s, index) => ({
      evaluation: getProcessedEvaluation(s),
      sessionNumber: completedSessions.length - 4 + index // Número da sessão (ex: #3, #4, #5, #6, #7)
    })).filter(item => item.evaluation !== null)

    // Coletar pontos fortes e gaps dos últimos 5 roleplays com número da sessão
    const allStrengths: Array<{ text: string, session: number }> = []
    const allGaps: Array<{ text: string, session: number }> = []
    const allImprovements: any[] = []

    last5Evaluations.forEach(({ evaluation: e, sessionNumber }) => {
      if (e.top_strengths) {
        e.top_strengths.forEach((strength: string) => {
          allStrengths.push({ text: strength, session: sessionNumber })
        })
      }
      if (e.critical_gaps) {
        e.critical_gaps.forEach((gap: string) => {
          allGaps.push({ text: gap, session: sessionNumber })
        })
      }
      if (e.priority_improvements) {
        e.priority_improvements.forEach((imp: any) => {
          allImprovements.push({ ...imp, session: sessionNumber })
        })
      }
    })

    // Agrupar por texto e coletar sessões onde apareceu
    const strengthMap: { [key: string]: number[] } = {}
    const gapMap: { [key: string]: number[] } = {}

    allStrengths.forEach(({ text, session }) => {
      if (!strengthMap[text]) strengthMap[text] = []
      if (!strengthMap[text].includes(session)) strengthMap[text].push(session)
    })

    allGaps.forEach(({ text, session }) => {
      if (!gapMap[text]) gapMap[text] = []
      if (!gapMap[text].includes(session)) gapMap[text].push(session)
    })

    // Top 5 pontos fortes e gaps mais frequentes com sessões
    const topStrengths = Object.entries(strengthMap)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
      .map(([text, sessions]) => ({ text, count: sessions.length, sessions }))

    const topGaps = Object.entries(gapMap)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
      .map(([text, sessions]) => ({ text, count: sessions.length, sessions }))

    setSummaryData({
      totalSessions: completedSessions.length,
      avgScore,
      spinAverages: spinAveragesSummary,
      topStrengths,
      topGaps,
      allImprovements: allImprovements.slice(0, 10) // Top 10 melhorias
    })

    setShowSummary(true)
  }

  // Funções de navegação do gráfico
  const handlePrevious = () => {
    if (scrollIndex > 0) {
      setScrollIndex(scrollIndex - 1)
    }
  }

  const handleNext = () => {
    if (scrollIndex < evolutionData.length - maxVisibleSessions) {
      setScrollIndex(scrollIndex + 1)
    }
  }

  // Dados visíveis no gráfico
  const visibleData = evolutionData.slice(scrollIndex, scrollIndex + maxVisibleSessions)
  const canScrollLeft = scrollIndex > 0
  const canScrollRight = scrollIndex < evolutionData.length - maxVisibleSessions

  const spinMetrics = [
    { label: 'Situação', icon: Search, score: spinAverages.S, color: 'from-cyan-500 to-blue-500' },
    { label: 'Problema', icon: Settings, score: spinAverages.P, color: 'from-green-500 to-emerald-500' },
    { label: 'Implicação', icon: Zap, score: spinAverages.I, color: 'from-yellow-500 to-orange-500' },
    { label: 'Necessidade', icon: Target, score: spinAverages.N, color: 'from-green-500 to-pink-500' }
  ]


  return (
    <div className="min-h-screen py-20 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        {/* Header Card */}
        <div className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-green-500/30 mb-6 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <div className="flex items-center justify-between gap-6">
            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-1">{userName || 'Carregando...'}</h1>
              <p className="text-gray-400 text-lg">{userEmail || 'carregando@email.com'}</p>
            </div>

            {/* Média Geral e Botão Resumo */}
            <div className="flex items-center gap-4">
              {totalSessions > 0 && (
                <>
                  <div className="bg-gradient-to-br from-green-600/20 to-green-400/10 rounded-2xl p-6 border border-green-500/30">
                    <div className="text-center">
                      <p className="text-sm text-gray-400 mb-1">Nota Média Geral</p>
                      <div className="text-4xl font-bold text-green-400">
                        {overallAverage.toFixed(1)}
                        <span className="text-lg text-gray-400">/10</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{totalSessions} sessões</p>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex flex-col gap-3">
                    {/* Botão Resumo Geral */}
                    <button
                      onClick={generateSummary}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl font-medium hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-green-500/30"
                    >
                      <FileText className="w-5 h-5" />
                      <span>
                        Resumo<br />
                        <span className="text-xs opacity-90">Detalhado</span>
                      </span>
                    </button>

                    {/* Botão Histórico */}
                    <button
                      onClick={() => onViewChange?.('historico')}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-500 text-white rounded-xl font-medium hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/30"
                    >
                      <History className="w-5 h-5" />
                      <span>
                        Histórico<br />
                        <span className="text-xs opacity-90">Roleplays</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'geral'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('personas')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'personas'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Por Persona
          </button>
          <button
            onClick={() => setActiveTab('objecoes')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'objecoes'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            Por Objeção
          </button>
          <button
            onClick={() => setActiveTab('followups')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'followups'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            <span className="flex items-center gap-2">
              <FileSearch className="w-4 h-4" />
              Follow-ups
            </span>
          </button>
        </div>

        {/* Tab Content - Visão Geral */}
        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Evolution Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Evolution Card */}
            <div className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-green-500/30 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                    <h2 className="text-2xl font-bold">Evolução nos Roleplays</h2>
                  </div>
                  <p className="text-gray-400">Média geral das últimas simulações</p>
                </div>
                {latestSession && (
                  <div className="text-right">
                    <div className="text-sm text-gray-400 mb-1">Sessão {latestSession.label} - Nota: {latestSession.score.toFixed(1)}</div>
                    <div className={`text-3xl font-bold flex items-center gap-2 ${latestSession.improvement >= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                      <TrendingUp className="w-6 h-6" />
                      {latestSession.improvement >= 0 ? '+' : ''}{latestSession.improvement.toFixed(1)}
                    </div>
                  </div>
                )}
              </div>

              {/* Chart */}
              {loading ? (
                <div className="text-center text-gray-400 py-20">Carregando evolução...</div>
              ) : evolutionData.length === 0 ? (
                <div className="text-center text-gray-400 py-20">Nenhuma sessão avaliada ainda</div>
              ) : (
                <>
                  <div className="relative h-80">
                    <svg className="w-full h-full" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet">
                      {/* Grid lines - 10 linhas para escala 0-10 */}
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((line) => (
                        <line
                          key={line}
                          x1="70"
                          y1={260 - (line * 24)}
                          x2="580"
                          y2={260 - (line * 24)}
                          stroke={line === 0 ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.1)"}
                          strokeWidth={line === 0 ? "2" : "1"}
                        />
                      ))}

                      {/* Y-axis labels - 0 a 10 */}
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <text
                          key={num}
                          x="55"
                          y={264 - (num * 24)}
                          fill="rgba(156, 163, 175, 0.8)"
                          fontSize="13"
                          textAnchor="end"
                          fontWeight="500"
                        >
                          {num}
                        </text>
                      ))}

                      {/* Line path */}
                      {visibleData.length > 1 && (
                        <path
                          d={visibleData.map((point, i) => {
                            const totalWidth = 500
                            const spacing = visibleData.length > 1 ? totalWidth / (visibleData.length - 1) : 0
                            const x = 80 + (i * spacing)
                            const y = 260 - (point.score * 24)
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                          }).join(' ')}
                          fill="none"
                          stroke="url(#lineGradient)"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      )}

                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>

                      {/* Points */}
                      {visibleData.map((point, i) => {
                        const totalWidth = 500
                        const spacing = visibleData.length > 1 ? totalWidth / (visibleData.length - 1) : 0
                        const x = 80 + (i * spacing)
                        const y = 260 - (point.score * 24)
                        return (
                          <g key={i}>
                            {/* Glow */}
                            <circle cx={x} cy={y} r="10" fill="#8b5cf6" opacity="0.3" />
                            {/* Point */}
                            <circle cx={x} cy={y} r="6" fill="#8b5cf6" />
                            {/* X-axis label - session number */}
                            <text
                              x={x}
                              y="285"
                              fill="rgba(156, 163, 175, 0.8)"
                              fontSize="13"
                              textAnchor="middle"
                              fontWeight="600"
                            >
                              {point.label}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>

                  {/* Navigation Controls */}
                  {evolutionData.length > maxVisibleSessions && (
                    <div className="flex items-center justify-between mt-4 px-4">
                      <button
                        onClick={handlePrevious}
                        disabled={!canScrollLeft}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                          canScrollLeft
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </button>

                      <div className="text-sm text-gray-400">
                        Mostrando {scrollIndex + 1} - {Math.min(scrollIndex + maxVisibleSessions, evolutionData.length)} de {evolutionData.length} sessões
                      </div>

                      <button
                        onClick={handleNext}
                        disabled={!canScrollRight}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                          canScrollRight
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        Próximo
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>

          {/* Right Column - SPIN Metrics */}
          <div className="space-y-4">
            <div className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-6 border border-green-500/30 ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '150ms' }}>
              <h2 className="text-xl font-bold mb-6 text-center">Métricas SPIN Selling</h2>

              <div className="space-y-4">
                {loading ? (
                  <div className="text-center text-gray-400 py-8">Carregando métricas...</div>
                ) : (
                  spinMetrics.map((metric, i) => {
                    const Icon = metric.icon
                    return (
                      <div key={i} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-green-500/50 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-semibold text-gray-300">{metric.label}</span>
                          </div>
                          <span className="text-3xl font-bold text-white">
                            {metric.score > 0 ? metric.score.toFixed(1) : 'N/A'}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${metric.color} rounded-full transition-all duration-1000`}
                            style={{ width: mounted && metric.score > 0 ? `${(metric.score / 10) * 100}%` : '0%' }}
                          ></div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Tab Content - Por Persona */}
        {activeTab === 'personas' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {personaStats.size === 0 ? (
              <div className="col-span-full bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-12 border border-gray-500/30 text-center">
                <Users className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Nenhuma prática com personas ainda</p>
                <p className="text-gray-500 text-sm mt-2">Complete sessões de roleplay para ver estatísticas por persona</p>
              </div>
            ) : (
              Array.from(personaStats.values()).map((stat, i) => {
                const scoreColor = stat.average >= 7 ? 'text-green-400' : stat.average >= 5 ? 'text-yellow-400' : 'text-red-400'
                const borderColor = stat.average >= 7 ? 'border-green-500/30' : stat.average >= 5 ? 'border-yellow-500/30' : 'border-red-500/30'
                const bgGradient = stat.average >= 7 ? 'from-green-600/10 to-green-400/5' : stat.average >= 5 ? 'from-yellow-600/10 to-yellow-400/5' : 'from-red-600/10 to-red-400/5'

                return (
                  <div key={i} className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-6 border ${borderColor} ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                          {stat.persona.cargo || stat.persona.job_title || 'Cargo não especificado'}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {stat.persona.tipo_empresa_faturamento || stat.persona.company_type || 'Empresa não especificada'}
                        </p>
                      </div>
                      <div className={`bg-gradient-to-br ${bgGradient} rounded-xl px-3 py-1`}>
                        <div className="text-xs text-gray-400">Nota Média</div>
                        <div className={`text-2xl font-bold ${scoreColor}`}>
                          {stat.average.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Práticas realizadas</span>
                        <span className="font-semibold text-white">{stat.count}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Última prática</span>
                        <span className="text-sm text-gray-300">
                          {new Date(stat.lastPractice).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    {/* Score evolution line chart */}
                    <div className="mt-4 pt-4 border-t border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-2">Evolução das notas</div>
                      <div className="relative h-52 bg-gray-800/30 rounded-lg p-4">
                        <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
                          {/* Grid lines */}
                          <defs>
                            <linearGradient id={`gradient-persona-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor={stat.average >= 7 ? '#10b981' : stat.average >= 5 ? '#eab308' : '#ef4444'} stopOpacity="0.2" />
                              <stop offset="100%" stopColor={stat.average >= 7 ? '#10b981' : stat.average >= 5 ? '#eab308' : '#ef4444'} stopOpacity="0.02" />
                            </linearGradient>
                          </defs>

                          {/* Horizontal grid lines */}
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => {
                            const y = 180 - (value / 10) * 160
                            return (
                              <g key={value}>
                                <line
                                  x1="35"
                                  y1={y}
                                  x2="380"
                                  y2={y}
                                  stroke={value % 5 === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)"}
                                  strokeWidth={value % 5 === 0 ? "1" : "0.5"}
                                />
                                <text x="25" y={y + 4} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="end">
                                  {value}
                                </text>
                              </g>
                            )
                          })}

                          {/* Area under the line */}
                          {stat.scores.length > 0 && (
                            <path
                              d={
                                stat.scores.map((score, idx) => {
                                  const xSpacing = stat.scores.length === 1 ? 0 : (340 / (stat.scores.length - 1))
                                  const x = 40 + (idx * xSpacing)
                                  const y = 180 - (score / 10) * 160
                                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                                }).join(' ') +
                                ` L ${stat.scores.length === 1 ? 40 : 380} 180 L 40 180 Z`
                              }
                              fill={`url(#gradient-persona-${i})`}
                            />
                          )}

                          {/* Line path */}
                          {stat.scores.length > 0 && (
                            <path
                              d={stat.scores.map((score, idx) => {
                                const xSpacing = stat.scores.length === 1 ? 0 : (340 / (stat.scores.length - 1))
                                const x = 40 + (idx * xSpacing)
                                const y = 180 - (score / 10) * 160
                                return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                              }).join(' ')}
                              fill="none"
                              stroke={stat.average >= 7 ? '#10b981' : stat.average >= 5 ? '#eab308' : '#ef4444'}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* Points */}
                          {stat.scores.map((score, idx) => {
                            const xSpacing = stat.scores.length === 1 ? 0 : (340 / (stat.scores.length - 1))
                            const x = 40 + (idx * xSpacing)
                            const y = 180 - (score / 10) * 160
                            const color = score >= 7 ? '#10b981' : score >= 5 ? '#eab308' : '#ef4444'
                            return (
                              <g key={idx}>
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="5"
                                  fill={color}
                                  stroke="#1f2937"
                                  strokeWidth="2"
                                />
                                <title>Sessão {idx + 1}: {score.toFixed(1)}/10</title>
                              </g>
                            )
                          })}

                          {/* X-axis labels for sessions */}
                          {stat.scores.length <= 15 && stat.scores.map((_, idx) => {
                            const xSpacing = stat.scores.length === 1 ? 0 : (340 / (stat.scores.length - 1))
                            const x = 40 + (idx * xSpacing)
                            return (
                              <text key={idx} x={x} y={193} fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="middle">
                                S{idx + 1}
                              </text>
                            )
                          })}
                        </svg>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Tab Content - Por Objeção */}
        {activeTab === 'objecoes' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {objectionStats.size === 0 ? (
              <div className="col-span-full bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-12 border border-gray-500/30 text-center">
                <MessageSquare className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Nenhuma objeção enfrentada ainda</p>
                <p className="text-gray-500 text-sm mt-2">Complete sessões de roleplay para ver estatísticas por objeção</p>
              </div>
            ) : (
              Array.from(objectionStats.values()).map((stat, i) => {
                const scoreColor = stat.average >= 7 ? 'text-green-400' : stat.average >= 5 ? 'text-yellow-400' : 'text-red-400'
                const borderColor = stat.average >= 7 ? 'border-green-500/30' : stat.average >= 5 ? 'border-yellow-500/30' : 'border-red-500/30'
                const bgGradient = stat.average >= 7 ? 'from-green-600/10 to-green-400/5' : stat.average >= 5 ? 'from-yellow-600/10 to-yellow-400/5' : 'from-red-600/10 to-red-400/5'

                return (
                  <div key={i} className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-6 border ${borderColor} ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: `${i * 100}ms` }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 pr-4">
                        <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">
                          {stat.name}
                        </h3>
                      </div>
                      <div className={`bg-gradient-to-br ${bgGradient} rounded-xl px-3 py-1 text-center`}>
                        <div className="text-xs text-gray-400">Média</div>
                        <div className={`text-2xl font-bold ${scoreColor}`}>
                          {stat.average.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <span className="text-sm text-gray-400">Vezes enfrentada</span>
                        <div className="font-semibold text-white text-lg">{stat.count}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-400">Melhor nota</span>
                        <div className={`font-semibold text-lg ${stat.bestScore >= 7 ? 'text-green-400' : stat.bestScore >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {stat.bestScore.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar showing average */}
                    <div className="mt-4 pt-4 border-t border-gray-700/50">
                      <div className="text-xs text-gray-400 mb-2">Desempenho médio</div>
                      <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            stat.average >= 7 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                            stat.average >= 5 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                            'bg-gradient-to-r from-red-500 to-red-400'
                          }`}
                          style={{ width: `${(stat.average / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Modal de Resumo Geral */}
        {showSummary && summaryData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-24 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-6xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl border border-green-500/30 shadow-2xl">
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-green-500/20 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold flex items-center gap-3">
                    <FileText className="w-8 h-8 text-green-400" />
                    Resumo Geral de Performance - <span className="text-green-400">{userName}</span>
                  </h2>
                  <p className="text-gray-400 mt-1">
                    Análise consolidada de {summaryData.totalSessions} sessões completadas
                  </p>
                </div>
                <button
                  onClick={() => setShowSummary(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
                >
                  Fechar
                </button>
              </div>

              <div className="p-8 space-y-8">
                {/* Média Geral */}
                <div className="bg-gradient-to-br from-green-600/20 to-green-400/10 rounded-2xl p-8 border border-green-500/30">
                  <h3 className="text-2xl font-bold mb-4 text-center">Nota Média Geral</h3>
                  <div className="text-6xl font-bold text-center text-green-400">
                    {summaryData.avgScore.toFixed(1)}
                    <span className="text-2xl text-gray-400">/10</span>
                  </div>
                </div>

                {/* Médias SPIN */}
                <div>
                  <h3 className="text-2xl font-bold mb-4">Médias SPIN Selling</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(summaryData.spinAverages).map(([key, value]: [string, any]) => (
                      <div key={key} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                        <div className="text-sm text-gray-400 mb-2">
                          {key === 'S' && 'Situação'}
                          {key === 'P' && 'Problema'}
                          {key === 'I' && 'Implicação'}
                          {key === 'N' && 'Necessidade'}
                        </div>
                        <div className="text-3xl font-bold text-green-400">{value.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pontos Fortes Mais Frequentes */}
                {summaryData.topStrengths.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-green-400">🎯 Pontos Fortes Recorrentes</h3>
                    <div className="space-y-3">
                      {summaryData.topStrengths.map((strength: any, i: number) => (
                        <div key={i} className="bg-green-600/10 border border-green-500/30 rounded-xl p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              <p className="text-gray-300">{strength.text}</p>
                              <div className="flex gap-1 mt-2">
                                {strength.sessions?.map((session: number, idx: number) => (
                                  <span key={idx} className="text-xs px-2 py-0.5 bg-green-600/30 text-green-300 rounded">
                                    #{session}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gaps Críticos Mais Frequentes */}
                {summaryData.topGaps.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-orange-400">⚠️ Gaps Críticos Recorrentes</h3>
                    <div className="space-y-3">
                      {summaryData.topGaps.map((gap: any, i: number) => (
                        <div key={i} className="bg-orange-600/10 border border-orange-500/30 rounded-xl p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              <p className="text-gray-300">{gap.text}</p>
                              <div className="flex gap-1 mt-2">
                                {gap.sessions?.map((session: number, idx: number) => (
                                  <span key={idx} className="text-xs px-2 py-0.5 bg-orange-600/30 text-orange-300 rounded">
                                    #{session}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Melhorias Prioritárias */}
                {summaryData.allImprovements.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-blue-400">📈 Melhorias Prioritárias</h3>
                    <div className="space-y-3">
                      {summaryData.allImprovements.map((improvement: any, i: number) => (
                        <div key={i} className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className={`px-2 py-1 rounded text-xs font-bold ${
                              improvement.priority === 'critical' ? 'bg-red-600/20 text-red-400' :
                              improvement.priority === 'high' ? 'bg-orange-600/20 text-orange-400' :
                              'bg-blue-600/20 text-blue-400'
                            }`}>
                              {improvement.priority === 'critical' ? 'CRÍTICO' :
                               improvement.priority === 'high' ? 'ALTO' : 'MÉDIO'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="font-semibold text-white">{improvement.area}</p>
                                {improvement.session && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded">
                                    #{improvement.session}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-400 mb-2">{improvement.current_gap}</p>
                              <p className="text-sm text-blue-300">💡 {improvement.action_plan}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content - Follow-ups */}
        {activeTab === 'followups' && (
          <div className="space-y-6">
            {/* Estatísticas de Follow-ups */}
            {followUpStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl p-4 border border-green-500/30">
                  <div className="flex items-center gap-3">
                    <FileSearch className="w-8 h-8 text-green-400" />
                    <div>
                      <p className="text-xs text-gray-400">Total Análises</p>
                      <p className="text-2xl font-bold text-white">{followUpStats.totalAnalises}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/30">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-purple-400" />
                    <div>
                      <p className="text-xs text-gray-400">Média Geral</p>
                      <p className="text-2xl font-bold text-white">{followUpStats.mediaNota.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl p-4 border border-blue-500/30">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-blue-400" />
                    <div>
                      <p className="text-xs text-gray-400">Melhor Nota</p>
                      <p className="text-2xl font-bold text-green-400">{followUpStats.melhorNota.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl p-4 border border-orange-500/30">
                  <div className="flex items-center gap-3">
                    <Target className="w-8 h-8 text-orange-400" />
                    <div>
                      <p className="text-xs text-gray-400">Nota Mais Baixa</p>
                      <p className="text-2xl font-bold text-orange-400">{followUpStats.piorNota.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de Análises de Follow-up */}
            <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-6 border border-green-500/30">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <History className="w-6 h-6 text-green-400" />
                Histórico de Análises de Follow-up
              </h2>

              {loadingFollowUps ? (
                <div className="text-center text-gray-400 py-12">
                  Carregando análises...
                </div>
              ) : followUpAnalyses.length === 0 ? (
                <div className="text-center py-12">
                  <FileSearch className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">Nenhuma análise de follow-up ainda</p>
                  <p className="text-gray-500 text-sm mt-2">Faça sua primeira análise para ver o histórico aqui</p>
                  <button
                    onClick={() => onViewChange?.('followup')}
                    className="mt-4 px-6 py-2 bg-gradient-to-r from-green-600 to-lime-500 text-white rounded-xl font-medium hover:from-green-700 hover:to-lime-600 transition-all"
                  >
                    Analisar Follow-up
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {followUpAnalyses.map((analysis, index) => (
                    <div
                      key={analysis.id}
                      className="group relative bg-gradient-to-br from-gray-900/90 to-gray-800/90 rounded-3xl p-6 border border-gray-700 hover:border-green-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] backdrop-blur-xl animate-slide-up"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl pointer-events-none" />

                      <div className="relative">
                        {/* Header with score and classification */}
                        <div className="flex items-start justify-between mb-5">
                          <div className="flex items-center gap-4">
                            {/* Score Circle */}
                            <div className={`relative flex items-center justify-center w-20 h-20 rounded-2xl ${
                              analysis.nota_final >= 8 ? 'bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30' :
                              analysis.nota_final >= 6 ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30' :
                              analysis.nota_final >= 4 ? 'bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30' :
                              'bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30'
                            }`}>
                              <span className={`text-3xl font-bold ${
                                analysis.nota_final >= 8 ? 'text-green-400' :
                                analysis.nota_final >= 6 ? 'text-yellow-400' :
                                analysis.nota_final >= 4 ? 'text-orange-400' :
                                'text-red-400'
                              }`}>
                                {analysis.nota_final.toFixed(1)}
                              </span>
                              <div className="absolute -top-1 -right-1">
                                <div className={`w-3 h-3 rounded-full animate-pulse ${
                                  analysis.nota_final >= 8 ? 'bg-green-400' :
                                  analysis.nota_final >= 6 ? 'bg-yellow-400' :
                                  analysis.nota_final >= 4 ? 'bg-orange-400' :
                                  'bg-red-400'
                                }`} />
                              </div>
                            </div>

                            {/* Info section */}
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide ${
                                  analysis.classificacao === 'excelente' ? 'bg-gradient-to-r from-purple-600/20 to-purple-500/20 text-purple-400 border border-purple-500/30' :
                                  analysis.classificacao === 'bom' ? 'bg-gradient-to-r from-green-600/20 to-green-500/20 text-green-400 border border-green-500/30' :
                                  analysis.classificacao === 'medio' ? 'bg-gradient-to-r from-yellow-600/20 to-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                  analysis.classificacao === 'ruim' ? 'bg-gradient-to-r from-orange-600/20 to-orange-500/20 text-orange-400 border border-orange-500/30' :
                                  'bg-gradient-to-r from-red-600/20 to-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                  {analysis.classificacao}
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <span className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-lg text-xs font-medium border border-blue-500/20">
                                  {analysis.tipo_venda}
                                </span>
                                <span className="px-3 py-1 bg-green-900/30 text-green-400 rounded-lg text-xs font-medium border border-green-500/20">
                                  {analysis.canal}
                                </span>
                                <span className="px-3 py-1 bg-purple-900/30 text-purple-400 rounded-lg text-xs font-medium border border-purple-500/20">
                                  {analysis.fase_funil.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/50 rounded-lg px-3 py-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span>
                              {new Date(analysis.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span>
                              {new Date(analysis.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Context */}
                        <div className="mb-5 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50">
                          <p className="text-sm text-gray-300">
                            <span className="font-semibold text-gray-400 uppercase text-xs tracking-wide">Contexto: </span>
                            <span className="text-white">{analysis.contexto}</span>
                          </p>
                        </div>

                        {/* Scores Grid */}
                        <div className="grid grid-cols-6 gap-3">
                          {Object.entries(analysis.avaliacao.notas).map(([key, value]: [string, any]) => {
                            const labels: Record<string, string> = {
                              'valor_agregado': 'Valor',
                              'personalizacao': 'Person.',
                              'tom_consultivo': 'Tom',
                              'objetividade': 'Objetiv.',
                              'cta': 'CTA',
                              'timing': 'Timing'
                            }

                            const getScoreGradient = (nota: number) => {
                              if (nota >= 8) return 'from-green-500/20 to-green-600/10 border-green-500/30'
                              if (nota >= 6) return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30'
                              if (nota >= 4) return 'from-orange-500/20 to-orange-600/10 border-orange-500/30'
                              return 'from-red-500/20 to-red-600/10 border-red-500/30'
                            }

                            return (
                              <div
                                key={key}
                                className={`bg-gradient-to-br ${getScoreGradient(value.nota)} backdrop-blur-sm rounded-xl p-3 text-center border transition-all hover:scale-105`}
                              >
                                <p className="text-[10px] text-gray-400 mb-1 font-medium uppercase tracking-wide">
                                  {labels[key]}
                                </p>
                                <p className={`text-xl font-bold ${
                                  value.nota >= 8 ? 'text-green-400' :
                                  value.nota >= 6 ? 'text-yellow-400' :
                                  value.nota >= 4 ? 'text-orange-400' :
                                  'text-red-400'
                                }`}>
                                  {value.nota.toFixed(1)}
                                </p>
                                {/* Mini progress bar */}
                                <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      value.nota >= 8 ? 'bg-green-400' :
                                      value.nota >= 6 ? 'bg-yellow-400' :
                                      value.nota >= 4 ? 'bg-orange-400' :
                                      'bg-red-400'
                                    }`}
                                    style={{ width: `${value.nota * 10}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* View Details Button */}
                        <button
                          onClick={() => setSelectedFollowUpAnalysis(analysis)}
                          className="mt-5 w-full py-2.5 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-green-900/30 hover:to-green-800/30 text-gray-300 hover:text-white rounded-xl font-medium transition-all border border-gray-600 hover:border-green-500/50 group flex items-center justify-center gap-2"
                        >
                          <FileSearch className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          Ver Análise Completa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Análise Completa do Follow-up - Design EXATO do FollowUpView */}
        {selectedFollowUpAnalysis && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm overflow-y-auto">
            <div className="min-h-screen px-4 py-8 flex items-center justify-center">
              <div className="relative w-full max-w-5xl bg-gradient-to-br from-gray-900 to-gray-950 rounded-3xl shadow-2xl">
                {/* Close Button */}
                <button
                  onClick={() => setSelectedFollowUpAnalysis(null)}
                  className="absolute top-6 right-6 z-10 p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>

                {/* Content with EXACT design from FollowUpView */}
                <div className="p-8 space-y-8">
                  {/* Overall Score Card - Same as FollowUpView */}
                  <div className={`relative overflow-hidden rounded-2xl p-6 border ${
                    selectedFollowUpAnalysis.nota_final >= 8 ? 'bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30' :
                    selectedFollowUpAnalysis.nota_final >= 6 ? 'bg-gradient-to-br from-yellow-900/20 to-amber-900/20 border-yellow-500/30' :
                    selectedFollowUpAnalysis.nota_final >= 4 ? 'bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/30' :
                    'bg-gradient-to-br from-red-900/20 to-red-950/20 border-red-500/30'
                  }`}>
                    <div className="relative">
                      <div>
                        <p className={`text-xs font-medium mb-2 uppercase tracking-wider ${
                          selectedFollowUpAnalysis.nota_final >= 8 ? 'text-green-400/70' :
                          selectedFollowUpAnalysis.nota_final >= 6 ? 'text-yellow-400/70' :
                          selectedFollowUpAnalysis.nota_final >= 4 ? 'text-orange-400/70' :
                          'text-red-400/70'
                        }`}>Nota Final</p>
                        <div className="flex items-baseline gap-3">
                          <p className={`text-5xl font-bold ${
                            selectedFollowUpAnalysis.nota_final >= 8 ? 'text-green-400' :
                            selectedFollowUpAnalysis.nota_final >= 6 ? 'text-yellow-400' :
                            selectedFollowUpAnalysis.nota_final >= 4 ? 'text-orange-400' :
                            'text-red-400'
                          }`}>{selectedFollowUpAnalysis.nota_final.toFixed(1)}</p>
                          <div>
                            <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                              selectedFollowUpAnalysis.nota_final >= 8 ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              selectedFollowUpAnalysis.nota_final >= 6 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                              selectedFollowUpAnalysis.nota_final >= 4 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                              'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {selectedFollowUpAnalysis.classificacao.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Scores - Green Theme like FollowUpView */}
                  <div className="group relative bg-gradient-to-br from-green-900/30 to-emerald-900/30 backdrop-blur-sm rounded-3xl p-8 border border-green-500/40 hover:border-green-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(34,197,94,0.2)] overflow-hidden">
                    {/* Animated background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    {/* Animated dots pattern */}
                    <div className="absolute inset-0 opacity-5">
                      <div className="absolute top-10 left-10 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                      <div className="absolute bottom-10 right-10 w-3 h-3 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '200ms' }}></div>
                      <div className="absolute top-20 right-20 w-3 h-3 bg-green-400 rounded-full animate-ping" style={{ animationDelay: '400ms' }}></div>
                    </div>

                    <div className="relative">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="relative">
                          <div className="absolute inset-0 bg-green-500/30 blur-xl animate-pulse"></div>
                          <div className="relative w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/50">
                            <BarChart3 className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                            Análise Detalhada
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">Avaliação critério por critério</p>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        {Object.entries(selectedFollowUpAnalysis.avaliacao.notas).map(([key, value]: [string, any], index) => {
                          const fieldLabels: Record<string, string> = {
                            'valor_agregado': 'Agregação de Valor',
                            'personalizacao': 'Personalização',
                            'tom_consultivo': 'Tom Consultivo',
                            'objetividade': 'Objetividade',
                            'cta': 'Call to Action (CTA)',
                            'timing': 'Timing'
                          }

                          const getColorScheme = (nota: number) => {
                            if (nota >= 8) return {
                              bg: 'from-green-900/40 to-emerald-900/40',
                              border: 'border-green-500/30 hover:border-green-400/50',
                              text: 'text-green-400',
                              bar: 'from-green-400 to-emerald-500',
                              glow: 'shadow-green-500/20'
                            }
                            if (nota >= 6) return {
                              bg: 'from-yellow-900/40 to-amber-900/40',
                              border: 'border-yellow-500/30 hover:border-yellow-400/50',
                              text: 'text-yellow-400',
                              bar: 'from-yellow-400 to-amber-500',
                              glow: 'shadow-yellow-500/20'
                            }
                            if (nota >= 4) return {
                              bg: 'from-orange-900/40 to-amber-900/40',
                              border: 'border-orange-500/30 hover:border-orange-400/50',
                              text: 'text-orange-400',
                              bar: 'from-orange-400 to-amber-500',
                              glow: 'shadow-orange-500/20'
                            }
                            return {
                              bg: 'from-red-900/40 to-rose-900/40',
                              border: 'border-red-500/30 hover:border-red-400/50',
                              text: 'text-red-400',
                              bar: 'from-red-400 to-rose-500',
                              glow: 'shadow-red-500/20'
                            }
                          }

                          const colors = getColorScheme(value.nota)

                          return (
                            <div
                              key={key}
                              className={`group/item relative bg-gradient-to-br ${colors.bg} rounded-2xl p-5 border ${colors.border} transition-all duration-300 hover:shadow-lg hover:scale-[1.01]`}
                              style={{ animationDelay: `${index * 100}ms` }}
                            >
                              {/* Shine effect on hover */}
                              <div className="absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 rounded-2xl overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/item:translate-x-full transition-transform duration-1000" />
                              </div>

                              <div className="relative">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-start gap-3">
                                    <div>
                                      <span className="font-semibold text-white text-lg">
                                        {fieldLabels[key] || key.replace(/_/g, ' ')}
                                      </span>
                                      <span className="ml-2 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-full">
                                        {value.peso}% do peso
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className={`text-3xl font-black ${colors.text}`}>
                                      {value.nota.toFixed(1)}
                                    </span>
                                    <p className={`text-xs mt-1 ${colors.text} opacity-70`}>
                                      {value.nota >= 8 ? 'Excelente' :
                                       value.nota >= 6 ? 'Bom' :
                                       value.nota >= 4 ? 'Regular' : 'Precisa Melhorar'}
                                    </p>
                                  </div>
                                </div>

                                <div className="bg-gray-900/40 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50 mb-3">
                                  <p className="text-sm text-gray-200 leading-relaxed">{value.comentario}</p>
                                </div>

                                {/* Enhanced Progress bar */}
                                <div className="relative">
                                  <div className="bg-gray-900/60 h-3 rounded-full overflow-hidden backdrop-blur-sm">
                                    <div
                                      className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden bg-gradient-to-r ${colors.bar}`}
                                      style={{
                                        width: `${value.nota * 10}%`,
                                        animation: 'slideIn 1s ease-out'
                                      }}
                                    >
                                      <div className="absolute inset-0 bg-white/30 animate-pulse" />
                                    </div>
                                  </div>
                                  {/* Floating percentage */}
                                  <div
                                    className="absolute -top-8 transition-all duration-1000 ease-out"
                                    style={{ left: `calc(${value.nota * 10}% - 20px)` }}
                                  >
                                    <div className={`${colors.text} text-xs px-2 py-1 rounded-lg font-bold bg-gray-900/80 border ${colors.border} backdrop-blur-sm`}>
                                      {(value.nota * 10).toFixed(0)}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Positive Points - Modern Design */}
                  {selectedFollowUpAnalysis.avaliacao.pontos_positivos?.length > 0 && (
                    <div className="group relative bg-gradient-to-br from-green-900/30 to-emerald-900/30 backdrop-blur-sm rounded-3xl p-8 border border-green-500/40 hover:border-green-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(34,197,94,0.2)] overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                      <div className="relative">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="relative">
                            <div className="absolute inset-0 bg-green-500/30 blur-xl animate-pulse"></div>
                            <div className="relative w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/50">
                              <CheckCircle className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                              Pontos Positivos
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Você acertou nestes aspectos</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {selectedFollowUpAnalysis.avaliacao.pontos_positivos.map((ponto: string, idx: number) => (
                            <div key={idx} className="group/item flex items-start gap-3 p-3 rounded-xl hover:bg-green-500/10 transition-all duration-300">
                              <div className="mt-1 w-6 h-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg flex items-center justify-center group-hover/item:scale-110 transition-transform">
                                <span className="text-green-400 text-sm">✓</span>
                              </div>
                              <span className="text-gray-200 flex-1 leading-relaxed">{ponto}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Points to Improve - Modern Design */}
                  {selectedFollowUpAnalysis.avaliacao.pontos_melhorar?.length > 0 && (
                    <div className="group relative bg-gradient-to-br from-orange-900/30 to-amber-900/30 backdrop-blur-sm rounded-3xl p-8 border border-orange-500/40 hover:border-orange-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(251,146,60,0.2)] overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                      <div className="relative">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="relative">
                            <div className="absolute inset-0 bg-orange-500/30 blur-xl animate-pulse"></div>
                            <div className="relative w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/50">
                              <AlertCircle className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
                              Pontos para Melhorar
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Oportunidades de desenvolvimento</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {selectedFollowUpAnalysis.avaliacao.pontos_melhorar.map((item: any, idx: number) => (
                            <div key={idx} className="group/item bg-gradient-to-br from-gray-900/60 to-gray-800/60 rounded-2xl p-5 border border-gray-700 hover:border-orange-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10 hover:scale-[1.02]">
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg flex items-center justify-center">
                                  <span className="text-lg">⚠️</span>
                                </div>
                                <p className="font-semibold text-orange-300 flex-1">
                                  {item.problema}
                                </p>
                              </div>
                              <div className="flex items-start gap-3 ml-11">
                                <div className="w-6 h-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-md flex items-center justify-center mt-0.5">
                                  <span className="text-xs">💡</span>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Solução:</span>
                                  <p className="text-sm text-gray-200 mt-1 leading-relaxed">{item.como_resolver}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Tip - Modern Design */}
                  {selectedFollowUpAnalysis.avaliacao.dica_principal && (
                    <div className="group relative bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-sm rounded-3xl p-8 border border-purple-500/40 hover:border-purple-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(168,85,247,0.2)] overflow-hidden">
                      <div className="absolute inset-0">
                        <div className="absolute top-10 left-10 w-2 h-2 bg-purple-400 rounded-full animate-ping"></div>
                        <div className="absolute bottom-10 right-10 w-2 h-2 bg-pink-400 rounded-full animate-ping" style={{ animationDelay: '200ms' }}></div>
                        <div className="absolute top-20 right-20 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '400ms' }}></div>
                      </div>

                      <div className="relative">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="relative">
                            <div className="absolute inset-0 bg-purple-500/30 blur-xl animate-pulse"></div>
                            <div className="relative w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/50 animate-bounce">
                              <Sparkles className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                              Dica Principal
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Foque neste insight para melhorar rapidamente</p>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
                          <p className="text-gray-100 leading-relaxed text-lg">{selectedFollowUpAnalysis.avaliacao.dica_principal}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Improved Version - Modern Design */}
                  {selectedFollowUpAnalysis.avaliacao.versao_reescrita && (
                    <div className="group relative bg-gradient-to-br from-blue-900/30 to-cyan-900/30 backdrop-blur-sm rounded-3xl p-8 border border-blue-500/40 hover:border-blue-400/60 transition-all duration-500 hover:shadow-[0_0_40px_rgba(59,130,246,0.2)] overflow-hidden">
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 bg-[size:20px_20px] bg-repeat"
                             style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)' }}></div>
                      </div>

                      <div className="relative">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="relative">
                            <div className="absolute inset-0 bg-blue-500/30 blur-xl animate-pulse"></div>
                            <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/50">
                              <FileText className="w-6 h-6 text-white" />
                            </div>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                              Versão Melhorada
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">Exemplo otimizado do seu follow-up</p>
                          </div>
                        </div>

                        <div className="relative">
                          <div className="absolute -top-2 -left-2 text-6xl text-blue-500/20 font-serif">"</div>
                          <div className="absolute -bottom-2 -right-2 text-6xl text-blue-500/20 font-serif rotate-180">"</div>
                          <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-2xl p-6 border border-blue-500/20 backdrop-blur-sm">
                            <pre className="whitespace-pre-wrap text-gray-100 leading-relaxed font-sans">
                              {selectedFollowUpAnalysis.avaliacao.versao_reescrita}
                            </pre>
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span>Copie e adapte ao seu estilo</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons - Same as FollowUpView */}
                  <div className="flex gap-4 mt-8">
                    <button
                      onClick={() => onViewChange?.('followup')}
                      className="group flex-1 relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl py-4 px-8 font-bold hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-[1.02] shadow-xl shadow-green-500/30"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-green-400/30 to-emerald-400/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <span className="relative flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Fazer Nova Análise
                      </span>
                    </button>

                    <button
                      onClick={() => setSelectedFollowUpAnalysis(null)}
                      className="group px-8 py-4 relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm text-gray-300 rounded-2xl font-bold hover:from-gray-700/60 hover:to-gray-800/60 hover:text-white transition-all border border-gray-700 hover:border-gray-600 hover:shadow-lg"
                    >
                      <span className="relative flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Fechar
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
