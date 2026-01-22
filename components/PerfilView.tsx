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
    <div className="min-h-screen py-20 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        {/* Header Card - Design Futurista */}
        <div className={`relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30 mb-8 shadow-[0_0_40px_rgba(34,197,94,0.15)] hover:shadow-[0_0_60px_rgba(34,197,94,0.25)] transition-all duration-500 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          {/* Efeito de brilho no background */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 rounded-2xl"></div>

          <div className="relative flex items-center justify-between gap-6 flex-wrap">
            {/* User Info com Avatar */}
            <div className="flex items-center gap-6 flex-1">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                <User className="w-10 h-10 text-green-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                  {userName || 'Carregando...'}
                </h1>
                <p className="text-gray-400 text-lg flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  {userEmail || 'carregando@email.com'}
                </p>
              </div>
            </div>

            {/* Stats e Ações */}
            <div className="flex items-center gap-4">
              {totalSessions > 0 && (
                <>
                  {/* Card de Média Geral - Design atualizado */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                    <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl p-6 border border-green-500/40 backdrop-blur-sm">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Award className="w-4 h-4 text-green-400" />
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Média Geral</p>
                        </div>
                        <div className="text-5xl font-bold bg-gradient-to-br from-green-400 via-emerald-300 to-green-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                          {overallAverage.toFixed(1)}
                        </div>
                        <div className="text-gray-400 text-sm mt-1">
                          <span className="text-green-400 font-semibold">{totalSessions}</span> sessões
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação - Design melhorado */}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={generateSummary}
                      className="group relative px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl font-medium transition-all hover:scale-105 hover:-translate-y-1 flex items-center gap-2 shadow-[0_0_25px_rgba(34,197,94,0.3)] hover:shadow-[0_0_40px_rgba(34,197,94,0.5)]"
                    >
                      <FileText className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                      <span>
                        Resumo<br />
                        <span className="text-xs opacity-90">Detalhado</span>
                      </span>
                    </button>

                    <button
                      onClick={() => onViewChange?.('historico')}
                      className="group relative px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-500 text-white rounded-xl font-medium transition-all hover:scale-105 hover:-translate-y-1 flex items-center gap-2 shadow-[0_0_25px_rgba(147,51,234,0.3)] hover:shadow-[0_0_40px_rgba(147,51,234,0.5)]"
                    >
                      <History className="w-5 h-5 group-hover:rotate-12 transition-transform" />
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

        {/* Tab Navigation - Design futurista */}
        <div className="flex gap-3 mb-8 p-2 bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
          <button
            onClick={() => setActiveTab('geral')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'geral'
                ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-105'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Visão Geral
            </span>
          </button>
          <button
            onClick={() => setActiveTab('personas')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'personas'
                ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-105'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Users className="w-4 h-4" />
              Por Persona
            </span>
          </button>
          <button
            onClick={() => setActiveTab('objecoes')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'objecoes'
                ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-105'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
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
            {/* Evolution Card - Design Futurista */}
            <div className={`relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.12)] hover:shadow-[0_0_50px_rgba(34,197,94,0.2)] transition-all duration-500 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
              {/* Efeito de grid futurista no fundo */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(34, 197, 94, .15) 25%, rgba(34, 197, 94, .15) 26%, transparent 27%, transparent 74%, rgba(34, 197, 94, .15) 75%, rgba(34, 197, 94, .15) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(34, 197, 94, .15) 25%, rgba(34, 197, 94, .15) 26%, transparent 27%, transparent 74%, rgba(34, 197, 94, .15) 75%, rgba(34, 197, 94, .15) 76%, transparent 77%, transparent)',
                  backgroundSize: '50px 50px'
                }}></div>
              </div>

              <div className="relative flex items-center justify-between mb-6 flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Evolução nos Roleplays</h2>
                      <p className="text-gray-400 text-sm">Média geral das últimas simulações</p>
                    </div>
                  </div>
                </div>
                {latestSession && (
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all"></div>
                    <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-xl rounded-xl p-3 border border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.12)]">
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-green-400 mb-1 tracking-wider uppercase">Sessão {latestSession.label.replace('#', '')}</div>
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                          <span className="text-xs font-semibold text-gray-300">Nota:</span>
                          <span className={`text-xl font-bold ${
                            latestSession.score <= 3 ? 'text-red-400' :
                            latestSession.score <= 5 ? 'text-yellow-400' :
                            latestSession.score <= 7 ? 'text-green-400' :
                            'text-emerald-400'
                          }`}>
                            {latestSession.score.toFixed(1)}
                          </span>
                        </div>
                        <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-2xl ${
                          latestSession.improvement >= 0
                            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                            : 'bg-orange-500/10 border border-orange-500/30 text-orange-400'
                        }`}>
                          <TrendingUp className={`w-4 h-4 ${latestSession.improvement < 0 ? 'rotate-180' : ''}`} />
                          {latestSession.improvement >= 0 ? '+' : ''}{latestSession.improvement.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chart */}
              {loading ? (
                <div className="relative text-center text-gray-400 py-20">
                  <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-300">Carregando evolução...</p>
                </div>
              ) : evolutionData.length === 0 ? (
                <div className="relative text-center py-20">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-700/20 to-gray-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-600/30">
                    <TrendingUp className="w-10 h-10 text-gray-500" />
                  </div>
                  <p className="text-gray-300 text-lg font-semibold mb-2">Nenhuma sessão avaliada ainda</p>
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
                    <div className="relative flex items-center justify-between mt-4 px-4 z-10">
                      <button
                        onClick={handlePrevious}
                        disabled={!canScrollLeft}
                        className={`relative z-20 flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                          canScrollLeft
                            ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </button>

                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-800/60 to-gray-900/60 backdrop-blur-xl rounded-xl border border-green-500/20">
                        <span className="text-sm text-gray-400">Mostrando</span>
                        <span className="text-sm font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                          {scrollIndex + 1} - {Math.min(scrollIndex + maxVisibleSessions, evolutionData.length)}
                        </span>
                        <span className="text-sm text-gray-400">de</span>
                        <span className="text-sm font-bold text-green-400">{evolutionData.length}</span>
                        <span className="text-sm text-gray-400">sessões</span>
                      </div>

                      <button
                        onClick={handleNext}
                        disabled={!canScrollRight}
                        className={`relative z-20 flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                          canScrollRight
                            ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
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
          <div className="space-y-6">
            <div className={`relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.12)] hover:shadow-[0_0_50px_rgba(34,197,94,0.2)] transition-all duration-500 ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '150ms' }}>
              {/* Título com ícone */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                  <Target className="w-5 h-5 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-green-50 bg-clip-text text-transparent">
                  Métricas SPIN Selling
                </h2>
              </div>

              <div className="space-y-4">
                {loading ? (
                  <div className="text-center text-gray-400 py-8">
                    <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-2"></div>
                    Carregando métricas...
                  </div>
                ) : (
                  spinMetrics.map((metric, i) => {
                    const Icon = metric.icon
                    return (
                      <div
                        key={i}
                        className="group relative bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50 hover:border-green-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                      >
                        {/* Glow effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>

                        <div className="relative">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${metric.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                                <Icon className="w-6 h-6 text-white drop-shadow-lg" />
                              </div>
                              <span className="font-bold text-gray-200 group-hover:text-white transition-colors">{metric.label}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-4xl font-bold bg-gradient-to-br from-white via-green-50 to-white bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                                {metric.score > 0 ? metric.score.toFixed(1) : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Progress bar melhorada */}
                          <div className="relative h-3 bg-gray-900/50 rounded-full overflow-hidden border border-gray-700/30">
                            <div
                              className={`h-full bg-gradient-to-r ${metric.color} rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(34,197,94,0.5)]`}
                              style={{ width: mounted && metric.score > 0 ? `${(metric.score / 10) * 100}%` : '0%' }}
                            >
                              {/* Efeito de brilho na barra */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                            </div>
                          </div>
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
              <div className="col-span-full relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-16 border border-gray-700/50 text-center shadow-[0_0_30px_rgba(34,197,94,0.08)]">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-700/20 to-gray-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-600/30">
                    <Users className="w-12 h-12 text-gray-500" />
                  </div>
                  <p className="text-gray-300 text-xl font-semibold mb-2">Nenhuma prática com personas ainda</p>
                  <p className="text-gray-500 text-sm">Complete sessões de roleplay para ver estatísticas por persona</p>
                </div>
              </div>
            ) : (
              Array.from(personaStats.values()).map((stat, i) => {
                const scoreColor = stat.average >= 7 ? 'text-green-400' : stat.average >= 5 ? 'text-yellow-400' : 'text-red-400'
                const borderColor = stat.average >= 7 ? 'border-green-500/30' : stat.average >= 5 ? 'border-yellow-500/30' : 'border-red-500/30'
                const bgGradient = stat.average >= 7 ? 'from-green-600/10 to-green-400/5' : stat.average >= 5 ? 'from-yellow-600/10 to-yellow-400/5' : 'from-red-600/10 to-red-400/5'

                return (
                  <div key={i} className={`group relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border ${borderColor} shadow-[0_0_25px_rgba(34,197,94,0.1)] hover:shadow-[0_0_45px_rgba(34,197,94,0.2)] transition-all duration-500 hover:-translate-y-2 ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: `${i * 100}ms` }}>
                    {/* Efeito de brilho no hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>

                    <div className="relative flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)] flex-shrink-0">
                          <User className="w-6 h-6 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-1 drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                            {stat.persona.cargo || stat.persona.job_title || 'Cargo não especificado'}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {stat.persona.tipo_empresa_faturamento || stat.persona.company_type || 'Empresa não especificada'}
                          </p>
                        </div>
                      </div>
                      <div className="relative group/badge">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur-md group-hover/badge:blur-lg transition-all"></div>
                        <div className={`relative bg-gradient-to-br ${bgGradient} backdrop-blur-sm rounded-xl px-4 py-2 border border-green-500/20`}>
                          <div className="text-xs text-gray-400 text-center">Média</div>
                          <div className={`text-3xl font-bold ${scoreColor} text-center`}>
                            {stat.average.toFixed(1)}
                          </div>
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
              <div className="col-span-full relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-16 border border-gray-700/50 text-center shadow-[0_0_30px_rgba(34,197,94,0.08)]">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-gray-700/20 to-gray-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-600/30">
                    <MessageSquare className="w-12 h-12 text-gray-500" />
                  </div>
                  <p className="text-gray-300 text-xl font-semibold mb-2">Nenhuma objeção enfrentada ainda</p>
                  <p className="text-gray-500 text-sm">Complete sessões de roleplay para ver estatísticas por objeção</p>
                </div>
              </div>
            ) : (
              Array.from(objectionStats.values()).map((stat, i) => {
                const scoreColor = stat.average >= 7 ? 'text-green-400' : stat.average >= 5 ? 'text-yellow-400' : 'text-red-400'
                const borderColor = stat.average >= 7 ? 'border-green-500/30' : stat.average >= 5 ? 'border-yellow-500/30' : 'border-red-500/30'
                const bgGradient = stat.average >= 7 ? 'from-green-600/10 to-green-400/5' : stat.average >= 5 ? 'from-yellow-600/10 to-yellow-400/5' : 'from-red-600/10 to-red-400/5'

                return (
                  <div key={i} className={`group relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border ${borderColor} shadow-[0_0_25px_rgba(34,197,94,0.1)] hover:shadow-[0_0_45px_rgba(34,197,94,0.2)] transition-all duration-500 hover:-translate-y-2 ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: `${i * 100}ms` }}>
                    {/* Efeito de brilho no hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>

                    <div className="relative flex items-start justify-between mb-4 gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)] flex-shrink-0">
                          <MessageSquare className="w-6 h-6 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">
                            {stat.name}
                          </h3>
                        </div>
                      </div>
                      <div className="relative group/badge flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur-md group-hover/badge:blur-lg transition-all"></div>
                        <div className={`relative bg-gradient-to-br ${bgGradient} backdrop-blur-sm rounded-xl px-4 py-2 border border-green-500/20`}>
                          <div className="text-xs text-gray-400 text-center">Média</div>
                          <div className={`text-3xl font-bold ${scoreColor} text-center`}>
                            {stat.average.toFixed(1)}
                          </div>
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

        {/* Modal de Resumo Geral - Design Futurista */}
        {showSummary && summaryData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-24 bg-black/90 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-6xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-xl rounded-2xl border border-green-500/30 shadow-[0_0_60px_rgba(34,197,94,0.3)] animate-scale-in custom-scrollbar">
              {/* Header com gradiente */}
              <div className="sticky top-0 bg-gradient-to-r from-gray-900/95 via-gray-900/98 to-gray-900/95 backdrop-blur-xl border-b border-green-500/30 p-8 z-10">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                      <FileText className="w-8 h-8 text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold mb-1">
                        Resumo Geral de Performance
                      </h2>
                      <p className="text-gray-400 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        <span className="text-green-400 font-semibold">{userName}</span>
                        <span className="text-gray-500">·</span>
                        <span>{summaryData.totalSessions} sessões completadas</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSummary(false)}
                    className="group px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 rounded-xl font-semibold transition-all hover:scale-105 flex items-center gap-2 border border-gray-600/50 shadow-lg"
                  >
                    <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                    Fechar
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Média Geral - Card destacado */}
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-2xl blur-2xl group-hover:blur-3xl transition-all"></div>
                  <div className="relative bg-gradient-to-br from-green-600/15 to-emerald-600/10 rounded-2xl p-10 border border-green-500/40 backdrop-blur-sm shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                    <div className="flex items-center justify-center gap-3 mb-6">
                      <Award className="w-8 h-8 text-green-400" />
                      <h3 className="text-3xl font-bold bg-gradient-to-r from-white to-green-50 bg-clip-text text-transparent">
                        Nota Média Geral
                      </h3>
                    </div>
                    <div className="text-7xl font-bold text-center bg-gradient-to-br from-green-400 via-emerald-300 to-green-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,197,94,0.6)]">
                      {summaryData.avgScore.toFixed(1)}
                      <span className="text-3xl text-gray-400">/10</span>
                    </div>
                  </div>
                </div>

                {/* Médias SPIN - Grid modernizado */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30">
                      <Target className="w-5 h-5 text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Médias SPIN Selling</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(summaryData.spinAverages).map(([key, value]: [string, any]) => (
                      <div key={key} className="group relative bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 hover:border-green-500/50 transition-all hover:-translate-y-1 shadow-lg hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                        <div className="relative">
                          <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                            {key === 'S' && 'Situação'}
                            {key === 'P' && 'Problema'}
                            {key === 'I' && 'Implicação'}
                            {key === 'N' && 'Necessidade'}
                          </div>
                          <div className="text-4xl font-bold bg-gradient-to-br from-green-400 to-emerald-400 bg-clip-text text-transparent">
                            {value.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pontos Fortes Mais Frequentes */}
                {summaryData.topStrengths.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                        <Target className="w-6 h-6 text-green-400" />
                      </div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-green-400 via-emerald-300 to-green-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                        Pontos Fortes Recorrentes
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {summaryData.topStrengths.map((strength: any, i: number) => (
                        <div key={i} className="group relative bg-gradient-to-br from-green-900/30 to-emerald-900/20 backdrop-blur-sm border border-green-500/30 rounded-xl p-5 hover:border-green-400/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(34,197,94,0.2)]">
                          {/* Glow effect on hover */}
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>

                          <div className="relative flex items-start gap-4">
                            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                              <span className="text-green-400 font-bold">{i + 1}</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-200 leading-relaxed group-hover:text-white transition-colors">{strength.text}</p>
                              <div className="flex gap-2 mt-3">
                                {strength.sessions?.map((session: number, idx: number) => (
                                  <span key={idx} className="text-xs px-3 py-1 bg-gradient-to-r from-green-600/40 to-emerald-600/30 text-green-300 rounded-lg border border-green-500/30 shadow-[0_0_8px_rgba(34,197,94,0.2)] font-medium">
                                    Sessão #{session}
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
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-xl flex items-center justify-center border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                        <AlertTriangle className="w-6 h-6 text-orange-400" />
                      </div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                        Gaps Críticos Recorrentes
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {summaryData.topGaps.map((gap: any, i: number) => (
                        <div key={i} className="group relative bg-gradient-to-br from-orange-900/30 to-amber-900/20 backdrop-blur-sm border border-orange-500/30 rounded-xl p-5 hover:border-orange-400/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(249,115,22,0.2)]">
                          {/* Glow effect on hover */}
                          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>

                          <div className="relative flex items-start gap-4">
                            <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0 border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]">
                              <AlertTriangle className="w-4 h-4 text-orange-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-200 leading-relaxed group-hover:text-white transition-colors">{gap.text}</p>
                              <div className="flex gap-2 mt-3">
                                {gap.sessions?.map((session: number, idx: number) => (
                                  <span key={idx} className="text-xs px-3 py-1 bg-gradient-to-r from-orange-600/40 to-amber-600/30 text-orange-300 rounded-lg border border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.2)] font-medium">
                                    Sessão #{session}
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
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-xl flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        <TrendingUp className="w-6 h-6 text-blue-400" />
                      </div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                        Melhorias Prioritárias
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {summaryData.allImprovements.map((improvement: any, i: number) => (
                        <div key={i} className="group relative bg-gradient-to-br from-blue-900/30 to-cyan-900/20 backdrop-blur-sm border border-blue-500/30 rounded-xl p-5 hover:border-blue-400/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)]">
                          {/* Glow effect on hover */}
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>

                          <div className="relative flex items-start gap-4">
                            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border shadow-lg ${
                              improvement.priority === 'critical'
                                ? 'bg-gradient-to-r from-red-600/40 to-rose-600/30 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.3)]' :
                              improvement.priority === 'high'
                                ? 'bg-gradient-to-r from-orange-600/40 to-amber-600/30 text-orange-300 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.3)]' :
                                'bg-gradient-to-r from-blue-600/40 to-cyan-600/30 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                            }`}>
                              {improvement.priority === 'critical' ? 'CRÍTICO' :
                               improvement.priority === 'high' ? 'ALTO' : 'MÉDIO'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <p className="font-bold text-lg text-white group-hover:text-blue-100 transition-colors">{improvement.area}</p>
                                {improvement.session && (
                                  <span className="text-xs px-3 py-1 bg-gradient-to-r from-blue-600/40 to-cyan-600/30 text-blue-300 rounded-lg border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)] font-medium whitespace-nowrap">
                                    Sessão #{improvement.session}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="text-gray-400 text-sm font-medium whitespace-nowrap">Gap:</span>
                                  <p className="text-sm text-gray-300 leading-relaxed">{improvement.current_gap}</p>
                                </div>
                                <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                  <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                  <p className="text-sm text-blue-200 leading-relaxed">{improvement.action_plan}</p>
                                </div>
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
