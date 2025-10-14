'use client'

import { useState, useEffect } from 'react'
import { User, TrendingUp, Target, Zap, Search, Settings, BarChart3, Play } from 'lucide-react'
import { getUserRoleplaySessions } from '@/lib/roleplay'

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
      const sessions = await getUserRoleplaySessions(1000) // Buscar todas as sessões

      // Filtrar apenas sessões completadas com avaliação
      const completedSessions = sessions.filter(session =>
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

          // Adicionar ponto de evolução (overall_score da sessão)
          if (evaluation.overall_score) {
            const sessionDate = new Date(session.created_at)
            const label = `#${completedSessions.length - index}`
            evolutionPoints.push({
              label,
              score: evaluation.overall_score,
              date: sessionDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            })
          }
        }
      })

      // Calcular médias
      setSpinAverages({
        S: counts.S > 0 ? totals.S / counts.S : 0,
        P: counts.P > 0 ? totals.P / counts.P : 0,
        I: counts.I > 0 ? totals.I / counts.I : 0,
        N: counts.N > 0 ? totals.N / counts.N : 0
      })

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
          <div className="flex items-center gap-6">
            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-1">{userName || 'Carregando...'}</h1>
              <p className="text-gray-400 text-lg">{userEmail || 'carregando@email.com'}</p>
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
                <div className="relative h-64">
                  <svg className="w-full h-full" viewBox="0 0 600 250" preserveAspectRatio="xMidYMid meet">
                    {/* Grid lines */}
                    {[0, 2, 4, 6, 8, 10].map((line) => (
                      <line
                        key={line}
                        x1="60"
                        y1={220 - (line * 20)}
                        x2="580"
                        y2={220 - (line * 20)}
                        stroke="rgba(139, 92, 246, 0.1)"
                        strokeWidth="1"
                      />
                    ))}

                    {/* Y-axis labels */}
                    {[0, 2, 4, 6, 8, 10].map((num, i) => (
                      <text
                        key={num}
                        x="40"
                        y={225 - (i * 20)}
                        fill="rgba(156, 163, 175, 0.6)"
                        fontSize="14"
                        textAnchor="end"
                      >
                        {num}
                      </text>
                    ))}

                    {/* Line path */}
                    {evolutionData.length > 1 && (
                      <path
                        d={evolutionData.map((point, i) => {
                          const totalWidth = 520
                          const spacing = evolutionData.length > 1 ? totalWidth / (evolutionData.length - 1) : 0
                          const x = 60 + (i * spacing)
                          const y = 220 - (point.score * 20)
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
                    {evolutionData.map((point, i) => {
                      const totalWidth = 520
                      const spacing = evolutionData.length > 1 ? totalWidth / (evolutionData.length - 1) : 0
                      const x = 60 + (i * spacing)
                      const y = 220 - (point.score * 20)
                      return (
                        <g key={i}>
                          {/* Glow */}
                          <circle cx={x} cy={y} r="10" fill="#8b5cf6" opacity="0.3" />
                          {/* Point */}
                          <circle cx={x} cy={y} r="6" fill="#8b5cf6" />
                          {/* X-axis label - session number */}
                          <text
                            x={x}
                            y="242"
                            fill="rgba(156, 163, 175, 0.8)"
                            fontSize="12"
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
      </div>
    </div>
  )
}
