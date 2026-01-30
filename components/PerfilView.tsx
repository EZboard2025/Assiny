'use client'

import { useState, useEffect } from 'react'
import { User, TrendingUp, Target, Zap, Search, Settings, BarChart3, Play, ChevronLeft, ChevronRight, FileText, History, Users, MessageSquare, FileSearch, Award, Calendar, CheckCircle, AlertCircle, Sparkles, X, AlertTriangle, Lightbulb } from 'lucide-react'
import { getUserRoleplaySessions, type RoleplaySession } from '@/lib/roleplay'
import { getFollowUpAnalyses, getFollowUpStats } from '@/lib/followup'

interface PerfilViewProps {
  onViewChange?: (view: 'home' | 'chat' | 'roleplay' | 'pdi' | 'historico' | 'perfil' | 'roleplay-links') => void | Promise<void>
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
  const [activeTab, setActiveTab] = useState<'geral' | 'personas' | 'objecoes'>('geral')
  const [personaStats, setPersonaStats] = useState<Map<string, PersonaStats>>(new Map())
  const [objectionStats, setObjectionStats] = useState<Map<string, ObjectionStats>>(new Map())

  // Estados para follow-ups
  const [followUpAnalyses, setFollowUpAnalyses] = useState<any[]>([])
  const [followUpStats, setFollowUpStats] = useState<any>(null)
  const [loadingFollowUps, setLoadingFollowUps] = useState(false)
  const [selectedFollowUpAnalysis, setSelectedFollowUpAnalysis] = useState<any>(null)

  const maxVisibleSessions = 8

  useEffect(() => {
    let isMounted = true

    const loadAllData = async () => {
      setMounted(true)

      // Load user data
      loadUserData()

      // Load SPIN averages with mounted check
      try {
        setLoading(true)
        const allSessions = await getUserRoleplaySessions(1000)

        if (!isMounted) return // Prevent state updates if unmounted

        console.log(`📊 PerfilView: Total de sessões carregadas: ${allSessions.length}`)
        setSessions(allSessions)

        // Filtrar apenas sessões completadas com avaliação
        const completedSessions = allSessions.filter(session =>
          session.status === 'completed' && (session as any).evaluation
        )

        console.log(`✅ Sessões completadas com avaliação: ${completedSessions.length}`)

        if (completedSessions.length === 0) {
          if (isMounted) setLoading(false)
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

          // Parse se necessário (formato N8N)
          if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
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

        if (!isMounted) return // Check again before setting state

        // Calcular médias
        setSpinAverages({
          S: counts.S > 0 ? totals.S / counts.S : 0,
          P: counts.P > 0 ? totals.P / counts.P : 0,
          I: counts.I > 0 ? totals.I / counts.I : 0,
          N: counts.N > 0 ? totals.N / counts.N : 0
        })

        // Calcular média geral
        const avgOverall = countOverallScore > 0 ? totalOverallScore / countOverallScore : 0
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

        if (isMounted) setLoading(false)
      } catch (error) {
        console.error('Erro ao carregar médias SPIN:', error)
        if (isMounted) setLoading(false)
      }

      // Load follow-up data
      loadFollowUpData()
    }

    loadAllData()

    return () => {
      isMounted = false // Cleanup: prevent state updates after unmount
    }
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
    const newIndex = Math.max(0, scrollIndex - maxVisibleSessions)
    setScrollIndex(newIndex)
  }

  const handleNext = () => {
    const newIndex = Math.min(evolutionData.length - maxVisibleSessions, scrollIndex + maxVisibleSessions)
    setScrollIndex(newIndex)
  }

  // Dados visíveis no gráfico
  const visibleData = evolutionData.slice(scrollIndex, scrollIndex + maxVisibleSessions)
  const canScrollLeft = scrollIndex > 0
  const canScrollRight = scrollIndex + maxVisibleSessions < evolutionData.length

  const spinMetrics = [
    { label: 'Situação', icon: Search, score: spinAverages.S, color: 'from-cyan-500 to-blue-500' },
    { label: 'Problema', icon: Settings, score: spinAverages.P, color: 'from-green-500 to-emerald-500' },
    { label: 'Implicação', icon: Zap, score: spinAverages.I, color: 'from-yellow-500 to-orange-500' },
    { label: 'Necessidade', icon: Target, score: spinAverages.N, color: 'from-green-500 to-pink-500' }
  ]


  return (
    <div className="min-h-screen py-8 px-6 relative z-10">
      <div className="max-w-6xl mx-auto">
        {/* Header Card - Design Profissional */}
        <div className={`bg-white rounded-2xl p-6 border border-gray-200 mb-6 shadow-sm ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <div className="flex items-center justify-between gap-6 flex-wrap">
            {/* User Info com Avatar */}
            <div className="flex items-center gap-4 flex-1">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border border-green-200">
                <User className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {userName || 'Carregando...'}
                </h1>
                <p className="text-gray-500 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  {userEmail || 'carregando@email.com'}
                </p>
              </div>
            </div>

            {/* Stats e Ações */}
            <div className="flex items-center gap-4">
              {totalSessions > 0 && (
                <>
                  {/* Card de Média Geral */}
                  <div className="text-center px-6 py-3 border-r border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Média Geral</p>
                    <div className={`text-4xl font-bold ${
                      overallAverage >= 7 ? 'text-green-600' :
                      overallAverage >= 5 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {overallAverage.toFixed(1)}
                    </div>
                    <p className="text-gray-500 text-sm">
                      {totalSessions} {totalSessions === 1 ? 'sessão' : 'sessões'}
                    </p>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex gap-2">
                    <button
                      onClick={generateSummary}
                      className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Resumo Detalhado
                    </button>

                    <button
                      onClick={() => onViewChange?.('historico')}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <History className="w-4 h-4" />
                      Histórico
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setActiveTab('geral')}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'geral'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Visão Geral
            </span>
          </button>
          <button
            onClick={() => setActiveTab('personas')}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'personas'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Users className="w-4 h-4" />
              Por Persona
            </span>
          </button>
          <button
            onClick={() => setActiveTab('objecoes')}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'objecoes'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Por Objeção
            </span>
          </button>
        </div>

        {/* Tab Content - Visão Geral */}
        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Evolution Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Evolution Card - Design Profissional */}
            <div className={`bg-white rounded-2xl p-6 border border-gray-200 shadow-sm ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Evolução nos Roleplays</h2>
                    <p className="text-gray-500 text-sm">Média geral das últimas simulações</p>
                  </div>
                </div>
                {latestSession && (
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-green-600 mb-1 tracking-wider uppercase">Sessão {latestSession.label.replace('#', '')}</div>
                      <div className="flex items-center justify-center gap-1.5 mb-2">
                        <span className="text-xs font-medium text-gray-500">Nota:</span>
                        <span className={`text-xl font-bold ${
                          latestSession.score <= 3 ? 'text-red-600' :
                          latestSession.score <= 5 ? 'text-yellow-600' :
                          latestSession.score <= 7 ? 'text-green-600' :
                          'text-green-600'
                        }`}>
                          {latestSession.score.toFixed(1)}
                        </span>
                      </div>
                      <div className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg font-bold text-lg ${
                        latestSession.improvement >= 0
                          ? 'bg-green-50 text-green-600'
                          : 'bg-red-50 text-red-600'
                      }`}>
                        <TrendingUp className={`w-4 h-4 ${latestSession.improvement < 0 ? 'rotate-180' : ''}`} />
                        {latestSession.improvement >= 0 ? '+' : ''}{latestSession.improvement.toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chart */}
              {loading ? (
                <div className="text-center py-20">
                  <div className="w-10 h-10 border-4 border-green-100 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">Carregando evolução...</p>
                </div>
              ) : evolutionData.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-900 text-lg font-semibold mb-2">Nenhuma sessão avaliada ainda</p>
                  <p className="text-gray-500 text-sm">Complete um roleplay para ver sua evolução</p>
                </div>
              ) : (
                <>
                  <div className="relative h-80 transition-all duration-500 ease-out" key={scrollIndex}>
                    <svg className="w-full h-full animate-fade-in" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet">
                      {/* Grid lines - estilo corporativo minimalista */}
                      {[0, 2, 4, 6, 8, 10].map((line) => (
                        <line
                          key={line}
                          x1="70"
                          y1={260 - (line * 24)}
                          x2="580"
                          y2={260 - (line * 24)}
                          stroke="rgba(75, 85, 99, 0.2)"
                          strokeWidth="1"
                          strokeDasharray={line === 0 || line === 10 ? "0" : "4 4"}
                        />
                      ))}

                      {/* Y-axis labels - estilo corporativo */}
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <text
                          key={num}
                          x="55"
                          y={264 - (num * 24)}
                          fill="#9CA3AF"
                          fontSize="12"
                          textAnchor="end"
                          fontWeight="600"
                        >
                          {num}
                        </text>
                      ))}

                      {/* Gradient definitions - baseado em notas */}
                      <defs>
                        {/* Filtro de glow */}
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Linha principal - estilo corporativo com toques sutis */}
                      {visibleData.length > 1 && (
                        <>
                          {/* Área preenchida suave sob a linha */}
                          <path
                            d={(() => {
                              const pathData = visibleData.map((point, i) => {
                                const totalWidth = 500
                                const spacing = visibleData.length > 1 ? totalWidth / (visibleData.length - 1) : 0
                                const x = 80 + (i * spacing)
                                const y = 260 - (point.score * 24)
                                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                              }).join(' ')

                              const totalWidth = 500
                              const spacing = visibleData.length > 1 ? totalWidth / (visibleData.length - 1) : 0
                              const lastX = 80 + ((visibleData.length - 1) * spacing)
                              const firstX = 80

                              return `${pathData} L ${lastX} 260 L ${firstX} 260 Z`
                            })()}
                            fill="rgba(16, 185, 129, 0.08)"
                          />

                          {/* Sombra leve da linha */}
                          <path
                            d={visibleData.map((point, i) => {
                              const totalWidth = 500
                              const spacing = visibleData.length > 1 ? totalWidth / (visibleData.length - 1) : 0
                              const x = 80 + (i * spacing)
                              const y = 260 - (point.score * 24)
                              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                            }).join(' ')}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.2"
                          />

                          {/* Linha principal */}
                          <path
                            d={visibleData.map((point, i) => {
                              const totalWidth = 500
                              const spacing = visibleData.length > 1 ? totalWidth / (visibleData.length - 1) : 0
                              const x = 80 + (i * spacing)
                              const y = 260 - (point.score * 24)
                              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                            }).join(' ')}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </>
                      )}

                      {/* Points - estilo corporativo minimalista */}
                      {visibleData.map((point, i) => {
                        const totalWidth = 500
                        const spacing = visibleData.length > 1 ? totalWidth / (visibleData.length - 1) : 0
                        const x = 80 + (i * spacing)
                        const y = 260 - (point.score * 24)

                        return (
                          <g key={i}>
                            {/* Ponto com borda */}
                            <circle cx={x} cy={y} r="5" fill="#10b981" stroke="#fff" strokeWidth="2" />

                            {/* X-axis label - session number */}
                            <text
                              x={x}
                              y="285"
                              fill="#9CA3AF"
                              fontSize="11"
                              textAnchor="middle"
                              fontWeight="600"
                            >
                              {point.label.replace('#', '')}
                            </text>

                            {/* Nota acima do ponto - simples */}
                            <text
                              x={x}
                              y={y - 10}
                              fill="#10b981"
                              fontSize="11"
                              textAnchor="middle"
                              fontWeight="700"
                            >
                              {point.score.toFixed(1)}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>

                  {/* Navigation Controls */}
                  {evolutionData.length > maxVisibleSessions && (
                    <div className="flex items-center justify-between mt-4">
                      <button
                        onClick={handlePrevious}
                        disabled={!canScrollLeft}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                          canScrollLeft
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer'
                            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </button>

                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-500">Mostrando</span>
                        <span className="text-sm font-semibold text-green-600">
                          {scrollIndex + 1} - {Math.min(scrollIndex + maxVisibleSessions, evolutionData.length)}
                        </span>
                        <span className="text-sm text-gray-500">de</span>
                        <span className="text-sm font-semibold text-green-600">{evolutionData.length}</span>
                        <span className="text-sm text-gray-500">sessões</span>
                      </div>

                      <button
                        onClick={handleNext}
                        disabled={!canScrollRight}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                          canScrollRight
                            ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
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
          <div className="space-y-6">
            <div className={`bg-white rounded-2xl p-6 border border-gray-200 shadow-sm ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
              {/* Título com ícone */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  Métricas SPIN Selling
                </h2>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-4 border-green-100 border-t-green-500 rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-gray-500 text-sm">Carregando métricas...</p>
                  </div>
                ) : (
                  spinMetrics.map((metric, i) => {
                    const score = metric.score
                    const hasScore = score > 0
                    const getScoreColor = (s: number) => {
                      if (s >= 7) return 'bg-green-500'
                      if (s >= 5) return 'bg-yellow-500'
                      return 'bg-red-500'
                    }
                    const getScoreTextColor = (s: number) => {
                      if (s >= 7) return 'text-green-600'
                      if (s >= 5) return 'text-yellow-600'
                      return 'text-red-600'
                    }

                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded-full ${hasScore ? getScoreColor(score) : 'bg-gray-300'}`} />
                          <div>
                            <span className="text-xs text-gray-500 uppercase tracking-wide">
                              {metric.label.charAt(0)}
                            </span>
                            <p className="text-sm font-medium text-gray-900">{metric.label}</p>
                          </div>
                        </div>
                        <span className={`text-xl font-bold ${hasScore ? getScoreTextColor(score) : 'text-gray-400'}`}>
                          {hasScore ? score.toFixed(1) : '—'}
                        </span>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {personaStats.size === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-12 border border-gray-200 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-900 text-lg font-semibold mb-2">Nenhuma prática com personas ainda</p>
                <p className="text-gray-500 text-sm">Complete sessões de roleplay para ver estatísticas por persona</p>
              </div>
            ) : (
              Array.from(personaStats.values()).map((stat, i) => {
                const scoreColor = stat.average >= 7 ? 'text-green-600' : stat.average >= 5 ? 'text-yellow-600' : 'text-red-600'
                const scoreBg = stat.average >= 7 ? 'bg-green-50' : stat.average >= 5 ? 'bg-yellow-50' : 'bg-red-50'

                return (
                  <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-900 mb-0.5">
                            {stat.persona.cargo || stat.persona.job_title || 'Cargo não especificado'}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">
                            {stat.persona.tipo_empresa_faturamento || stat.persona.company_type || 'Empresa não especificada'}
                          </p>
                        </div>
                      </div>
                      <div className={`${scoreBg} rounded-lg px-3 py-1.5`}>
                        <div className="text-[10px] text-gray-500 text-center uppercase">Média</div>
                        <div className={`text-2xl font-bold ${scoreColor} text-center`}>
                          {stat.average.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Práticas realizadas</span>
                        <span className="font-semibold text-gray-900">{stat.count}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Última prática</span>
                        <span className="text-sm text-gray-700">
                          {new Date(stat.lastPractice).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    {/* Score evolution line chart */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-2">Evolução das notas</div>
                      <div className="relative h-44 bg-gray-50 rounded-lg p-3">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {objectionStats.size === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-12 border border-gray-200 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-900 text-lg font-semibold mb-2">Nenhuma objeção enfrentada ainda</p>
                <p className="text-gray-500 text-sm">Complete sessões de roleplay para ver estatísticas por objeção</p>
              </div>
            ) : (
              Array.from(objectionStats.values()).map((stat, i) => {
                const scoreColor = stat.average >= 7 ? 'text-green-600' : stat.average >= 5 ? 'text-yellow-600' : 'text-red-600'
                const scoreBg = stat.average >= 7 ? 'bg-green-50' : stat.average >= 5 ? 'bg-yellow-50' : 'bg-red-50'
                const barColor = stat.average >= 7 ? 'bg-green-500' : stat.average >= 5 ? 'bg-yellow-500' : 'bg-red-500'

                return (
                  <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4 gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-900 line-clamp-2">
                            {stat.name}
                          </h3>
                        </div>
                      </div>
                      <div className={`${scoreBg} rounded-lg px-3 py-1.5 flex-shrink-0`}>
                        <div className="text-[10px] text-gray-500 text-center uppercase">Média</div>
                        <div className={`text-2xl font-bold ${scoreColor} text-center`}>
                          {stat.average.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <span className="text-sm text-gray-500">Vezes enfrentada</span>
                        <div className="font-semibold text-gray-900 text-lg">{stat.count}</div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Melhor nota</span>
                        <div className={`font-semibold text-lg ${stat.bestScore >= 7 ? 'text-green-600' : stat.bestScore >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {stat.bestScore.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar showing average */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-2">Desempenho médio</div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
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

        {/* Modal de Resumo Geral - Design Profissional */}
        {showSummary && summaryData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20 bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-5xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10 rounded-t-2xl">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Resumo Geral de Performance
                      </h2>
                      <p className="text-gray-500 text-sm flex items-center gap-2">
                        <span className="text-green-600 font-medium">{userName}</span>
                        <span>·</span>
                        <span>{summaryData.totalSessions} sessões completadas</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSummary(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Média Geral - Card destacado */}
                <div className="bg-green-50 rounded-xl p-8 border border-green-100 text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Award className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Nota Média Geral</h3>
                  </div>
                  <div className={`text-6xl font-bold ${
                    summaryData.avgScore >= 7 ? 'text-green-600' :
                    summaryData.avgScore >= 5 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {summaryData.avgScore.toFixed(1)}
                    <span className="text-2xl text-gray-400">/10</span>
                  </div>
                </div>

                {/* Médias SPIN */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Médias SPIN Selling</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(summaryData.spinAverages).map(([key, value]: [string, any]) => {
                      const scoreColor = value >= 7 ? 'text-green-600' : value >= 5 ? 'text-yellow-600' : 'text-red-600'
                      return (
                        <div key={key} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                            {key === 'S' && 'Situação'}
                            {key === 'P' && 'Problema'}
                            {key === 'I' && 'Implicação'}
                            {key === 'N' && 'Necessidade'}
                          </div>
                          <div className={`text-3xl font-bold ${scoreColor}`}>
                            {value.toFixed(1)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Pontos Fortes Mais Frequentes */}
                {summaryData.topStrengths.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Pontos Fortes Recorrentes</h3>
                    </div>
                    <div className="space-y-3">
                      {summaryData.topStrengths.map((strength: any, i: number) => (
                        <div key={i} className="bg-green-50 border border-green-100 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-green-600 font-semibold text-sm">{i + 1}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-700">{strength.text}</p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {strength.sessions?.map((session: number, idx: number) => (
                                  <span key={idx} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
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

                {/* Gaps Críticos */}
                {summaryData.topGaps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-gray-900">Gaps Críticos Recorrentes</h3>
                    </div>
                    <div className="space-y-3">
                      {summaryData.topGaps.map((gap: any, i: number) => (
                        <div key={i} className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <AlertTriangle className="w-3 h-3 text-orange-500" />
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-700">{gap.text}</p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {gap.sessions?.map((session: number, idx: number) => (
                                  <span key={idx} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
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
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="w-5 h-5 text-blue-500" />
                      <h3 className="text-lg font-semibold text-gray-900">Melhorias Prioritárias</h3>
                    </div>
                    <div className="space-y-3">
                      {summaryData.allImprovements.map((improvement: any, i: number) => (
                        <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className={`px-2 py-1 rounded text-xs font-semibold ${
                              improvement.priority === 'critical'
                                ? 'bg-red-100 text-red-700' :
                              improvement.priority === 'high'
                                ? 'bg-orange-100 text-orange-700' :
                                'bg-blue-100 text-blue-700'
                            }`}>
                              {improvement.priority === 'critical' ? 'Crítico' :
                               improvement.priority === 'high' ? 'Alto' : 'Médio'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="font-semibold text-gray-900">{improvement.area}</p>
                                {improvement.session && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                                    #{improvement.session}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{improvement.current_gap}</p>
                              <div className="flex items-start gap-2 p-2 bg-white rounded-lg">
                                <Lightbulb className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-gray-700">{improvement.action_plan}</p>
                              </div>
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
      </div>
    </div>
  )
}
