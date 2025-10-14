'use client'

import { useState, useEffect } from 'react'
import { User, TrendingUp, Target, Zap, Search, Settings, BarChart3, Play, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { getUserRoleplaySessions, type RoleplaySession } from '@/lib/roleplay'

export default function PerfilView() {
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
  const maxVisibleSessions = 8

  useEffect(() => {
    setMounted(true)
    loadUserData()
    loadSpinAverages()
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

  const loadSpinAverages = async () => {
    try {
      setLoading(true)
      const allSessions = await getUserRoleplaySessions(1000) // Buscar todas as sessões
      setSessions(allSessions) // Salvar todas as sessões para o resumo

      // Filtrar apenas sessões completadas com avaliação
      const completedSessions = allSessions.filter(session =>
        session.status === 'completed' && (session as any).evaluation
      )

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

        // Parse se necessário (formato N8N)
        if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
          try {
            evaluation = JSON.parse(evaluation.output)
          } catch (e) {
            console.error('Erro ao fazer parse de evaluation:', e)
            return
          }
        }

        // Somar scores de cada pilar
        if (evaluation?.spin_evaluation) {
          const spinEval = evaluation.spin_evaluation

          if (spinEval.S?.final_score) {
            totals.S += spinEval.S.final_score
            counts.S += 1
          }
          if (spinEval.P?.final_score) {
            totals.P += spinEval.P.final_score
            counts.P += 1
          }
          if (spinEval.I?.final_score) {
            totals.I += spinEval.I.final_score
            counts.I += 1
          }
          if (spinEval.N?.final_score) {
            totals.N += spinEval.N.final_score
            counts.N += 1
          }
        }

        // Adicionar ponto de evolução (overall_score da sessão)
        if (evaluation?.overall_score) {
          totalOverallScore += evaluation.overall_score
          countOverallScore++

          const sessionDate = new Date(session.created_at)
          const label = `#${completedSessions.length - index}`
          evolutionPoints.push({
            label,
            score: evaluation.overall_score,
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

      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar médias SPIN:', error)
      setLoading(false)
    }
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
    const totalScore = allEvaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0)
    const avgScore = totalScore / allEvaluations.length

    // Médias SPIN (usando todas as sessões)
    const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
    const spinCounts = { S: 0, P: 0, I: 0, N: 0 }

    allEvaluations.forEach(e => {
      if (e?.spin_evaluation) {
        const spin = e.spin_evaluation
        if (spin.S?.final_score) { spinTotals.S += spin.S.final_score; spinCounts.S++ }
        if (spin.P?.final_score) { spinTotals.P += spin.P.final_score; spinCounts.P++ }
        if (spin.I?.final_score) { spinTotals.I += spin.I.final_score; spinCounts.I++ }
        if (spin.N?.final_score) { spinTotals.N += spin.N.final_score; spinCounts.N++ }
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
    const last5Evaluations = last5Sessions.map(s => getProcessedEvaluation(s)).filter(e => e !== null)

    // Coletar pontos fortes e gaps dos últimos 5 roleplays
    const allStrengths: string[] = []
    const allGaps: string[] = []
    const allImprovements: any[] = []

    last5Evaluations.forEach(e => {
      if (e.top_strengths) allStrengths.push(...e.top_strengths)
      if (e.critical_gaps) allGaps.push(...e.critical_gaps)
      if (e.priority_improvements) allImprovements.push(...e.priority_improvements)
    })

    // Contar frequência de pontos fortes e gaps
    const strengthCounts: { [key: string]: number } = {}
    const gapCounts: { [key: string]: number } = {}

    allStrengths.forEach(s => strengthCounts[s] = (strengthCounts[s] || 0) + 1)
    allGaps.forEach(g => gapCounts[g] = (gapCounts[g] || 0) + 1)

    // Top 5 pontos fortes e gaps mais frequentes
    const topStrengths = Object.entries(strengthCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }))

    const topGaps = Object.entries(gapCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }))

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
    { label: 'Necessidade', icon: Target, score: spinAverages.N, color: 'from-purple-500 to-pink-500' }
  ]


  return (
    <div className="min-h-screen py-20 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        {/* Header Card */}
        <div className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30 mb-6 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
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
                  <div className="bg-gradient-to-br from-purple-600/20 to-purple-400/10 rounded-2xl p-6 border border-purple-500/30">
                    <div className="text-center">
                      <p className="text-sm text-gray-400 mb-1">Nota Média Geral</p>
                      <div className="text-4xl font-bold text-purple-400">
                        {overallAverage.toFixed(1)}
                        <span className="text-lg text-gray-400">/10</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{totalSessions} sessões</p>
                    </div>
                  </div>

                  {/* Botão Resumo Geral */}
                  <button
                    onClick={generateSummary}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl font-medium hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-green-500/30 h-fit"
                  >
                    <FileText className="w-5 h-5" />
                    <span>
                      Resumo<br />
                      <span className="text-xs opacity-90">Detalhado</span>
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Evolution Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Evolution Card */}
            <div className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                    <h2 className="text-2xl font-bold">Evolução nos Roleplays</h2>
                  </div>
                  <p className="text-gray-400">Média geral das últimas simulações</p>
                </div>
                {latestSession && (
                  <div className="text-right">
                    <div className="text-sm text-gray-400 mb-1">Sessão {latestSession.label} - Nota: {latestSession.score.toFixed(1)}</div>
                    <div className={`text-3xl font-bold flex items-center gap-2 ${latestSession.improvement >= 0 ? 'text-purple-400' : 'text-orange-400'}`}>
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
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
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
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
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

            {/* AI Feedback Card */}
            <div className={`bg-gradient-to-br from-purple-900/30 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/40 ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '200ms' }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold">AI</span>
                </div>
                <div className="flex-1">
                  <p className="text-gray-300 leading-relaxed mb-4">
                    Sua curva de aprendizado está estável. Continue fortereno perguntas de Implicação e treinino objeções de Confiança. Recomendamos um novo roleplay com foco em fechamento.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium flex items-center gap-2 transition-colors">
                      <Play className="w-4 h-4" />
                      Iniciar Roleplay
                    </button>
                    <button className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium flex items-center gap-2 transition-colors">
                      <BarChart3 className="w-4 h-4" />
                      Ver Avaliações Detalhadas
                    </button>
                    <button className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium flex items-center gap-2 transition-colors">
                      <Target className="w-4 h-4" />
                      Gerar PDI
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - SPIN Metrics */}
          <div className="space-y-4">
            <div className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/30 ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '150ms' }}>
              <h2 className="text-xl font-bold mb-6 text-center">Métricas SPIN Selling</h2>

              <div className="space-y-4">
                {loading ? (
                  <div className="text-center text-gray-400 py-8">Carregando métricas...</div>
                ) : (
                  spinMetrics.map((metric, i) => {
                    const Icon = metric.icon
                    return (
                      <div key={i} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-purple-500/50 transition-all">
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

        {/* Modal de Resumo Geral */}
        {showSummary && summaryData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl border border-purple-500/30 shadow-2xl">
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-purple-500/20 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold flex items-center gap-3">
                    <FileText className="w-8 h-8 text-green-400" />
                    Resumo Geral de Performance
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
                <div className="bg-gradient-to-br from-purple-600/20 to-purple-400/10 rounded-2xl p-8 border border-purple-500/30">
                  <h3 className="text-2xl font-bold mb-4 text-center">Nota Média Geral</h3>
                  <div className="text-6xl font-bold text-center text-purple-400">
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
                        <div className="text-3xl font-bold text-purple-400">{value.toFixed(1)}</div>
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
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-gray-300 flex-1">{strength.text}</p>
                            <div className="px-3 py-1 bg-green-600/20 rounded-full text-sm font-semibold text-green-400">
                              {strength.count}x
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
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-gray-300 flex-1">{gap.text}</p>
                            <div className="px-3 py-1 bg-orange-600/20 rounded-full text-sm font-semibold text-orange-400">
                              {gap.count}x
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
                              <p className="font-semibold text-white mb-1">{improvement.area}</p>
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
      </div>
    </div>
  )
}
