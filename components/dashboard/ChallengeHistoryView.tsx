'use client'

import { useState, useEffect } from 'react'
import { Target, Trophy, Clock, ChevronRight, Star, TrendingUp, CheckCircle, XCircle, Play, Calendar, ArrowLeft } from 'lucide-react'

interface ChallengeConfig {
  title: string
  description: string
  target_weakness: string
  confidence_score: number
  roleplay_config: {
    persona_id: string
    objection_ids: string[]
    age_range: string
    temperament: string
    objective_id?: string
  }
  success_criteria: {
    spin_letter_target: string
    spin_min_score: number
    primary_indicator: string
    primary_min_score: number
    objection_handling_min: number
  }
  coaching_tips: string[]
  analysis_summary: {
    pattern_detected: string
    roleplay_evidence?: { avg_score: number; sessions_count: number }
    meet_evidence?: { avg_score: number; calls_count: number }
  }
}

interface Challenge {
  id: string
  challenge_date: string
  status: 'pending' | 'in_progress' | 'completed'
  difficulty_level: number
  challenge_config: ChallengeConfig
  ai_reasoning: string
  roleplay_session_id?: string
  result_score?: number
  success?: boolean
  improvement_from_baseline?: number
  created_at: string
  completed_at?: string
  evaluation?: any
  session_date?: string
}

interface Stats {
  total: number
  completed: number
  pending: number
  successRate: number
  avgImprovement: number
}

interface Props {
  userId: string
  onStartChallenge: (challenge: Challenge) => void
  onBack: () => void
}

export default function ChallengeHistoryView({ userId, onStartChallenge, onBack }: Props) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all')

  useEffect(() => {
    fetchHistory()
  }, [userId])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/challenges/history?userId=${userId}`)
      const data = await response.json()

      if (data.success) {
        setChallenges(data.challenges)
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Error fetching challenge history:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Concluído
          </span>
        )
      case 'in_progress':
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-medium rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Em andamento
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full flex items-center gap-1">
            <Target className="w-3 h-3" />
            Pendente
          </span>
        )
    }
  }

  const getDifficultyStars = (level: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i <= level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
          />
        ))}
      </div>
    )
  }

  const getTargetWeaknessLabel = (target: string) => {
    const labels: Record<string, string> = {
      'advanced_skill': 'Avançado',
      'spin_s': 'SPIN S',
      'spin_p': 'SPIN P',
      'spin_i': 'SPIN I',
      'spin_n': 'SPIN N',
      'objection_handling': 'Objeções',
      'closing': 'Fechamento',
      'rapport': 'Rapport',
      'discovery': 'Discovery',
      'negotiation': 'Negociação'
    }
    return labels[target] || target.replace('spin_', 'SPIN ').replace(/_/g, ' ')
  }

  const filteredChallenges = challenges.filter(c => {
    if (filter === 'all') return true
    if (filter === 'pending') return c.status === 'pending' || c.status === 'in_progress'
    return c.status === filter
  })

  const canDoChallenge = (challenge: Challenge) => {
    // Permitir fazer qualquer desafio que ainda não foi concluído
    // Novos desafios chegam todo dia às 10h, mas os antigos podem ser feitos a qualquer momento
    return challenge.status === 'pending' || challenge.status === 'in_progress'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  // Challenge detail view
  if (selectedChallenge) {
    const config = selectedChallenge.challenge_config
    const evaluation = selectedChallenge.evaluation

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <button
            onClick={() => setSelectedChallenge(null)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar ao histórico
          </button>

          {/* Challenge Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">🎯</span>
                  <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
                </div>
                <p className="text-gray-600">{config.description}</p>
              </div>
              {getStatusBadge(selectedChallenge.status)}
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{formatDate(selectedChallenge.challenge_date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Dificuldade:</span>
                {getDifficultyStars(selectedChallenge.difficulty_level)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Foco:</span>
                <span className="text-purple-600 font-medium">
                  {getTargetWeaknessLabel(config.target_weakness)}
                </span>
              </div>
            </div>
          </div>

          {/* Result Section (for completed challenges) */}
          {selectedChallenge.status === 'completed' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Resultado do Desafio
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Score */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                  <p className="text-sm text-gray-600 mb-1">Score Final</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {selectedChallenge.result_score?.toFixed(1) || 'N/A'}
                  </p>
                </div>

                {/* Success */}
                <div className={`rounded-xl p-4 border ${
                  selectedChallenge.success
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
                    : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-100'
                }`}>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    {selectedChallenge.success ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        <span className="text-xl font-bold text-green-600">Sucesso!</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-6 h-6 text-red-500" />
                        <span className="text-xl font-bold text-red-600">Não atingiu meta</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Improvement */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-sm text-gray-600 mb-1">Melhoria</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className={`w-6 h-6 ${
                      (selectedChallenge.improvement_from_baseline || 0) > 0 ? 'text-green-500' : 'text-gray-400'
                    }`} />
                    <span className={`text-2xl font-bold ${
                      (selectedChallenge.improvement_from_baseline || 0) > 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {selectedChallenge.improvement_from_baseline !== undefined
                        ? `${selectedChallenge.improvement_from_baseline > 0 ? '+' : ''}${selectedChallenge.improvement_from_baseline.toFixed(1)}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SPIN Evaluation */}
              {evaluation?.spin_evaluation && (
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-800 mb-3">Avaliação SPIN</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {['S', 'P', 'I', 'N'].map((letter) => {
                      const score = evaluation.spin_evaluation[letter]?.final_score
                      const isTarget = config.success_criteria.spin_letter_target === letter
                      return (
                        <div
                          key={letter}
                          className={`rounded-xl p-3 text-center ${
                            isTarget
                              ? 'bg-purple-100 border-2 border-purple-300'
                              : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <p className={`text-xs font-medium mb-1 ${isTarget ? 'text-purple-600' : 'text-gray-500'}`}>
                            {letter === 'S' ? 'Situação' : letter === 'P' ? 'Problema' : letter === 'I' ? 'Implicação' : 'Necessidade'}
                            {isTarget && ' (Meta)'}
                          </p>
                          <p className={`text-2xl font-bold ${
                            score >= 7 ? 'text-green-600' : score >= 5 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {score?.toFixed(1) || 'N/A'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              {evaluation?.executive_summary && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-md font-semibold text-gray-800 mb-2">Resumo da IA</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{evaluation.executive_summary}</p>
                </div>
              )}

              {/* Strengths and Gaps */}
              {(evaluation?.top_strengths?.length > 0 || evaluation?.critical_gaps?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {evaluation?.top_strengths?.length > 0 && (
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <h3 className="text-sm font-semibold text-green-800 mb-2">Pontos Fortes</h3>
                      <ul className="space-y-1">
                        {evaluation.top_strengths.slice(0, 3).map((strength: string, i: number) => (
                          <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evaluation?.critical_gaps?.length > 0 && (
                    <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                      <h3 className="text-sm font-semibold text-red-800 mb-2">Pontos a Melhorar</h3>
                      <ul className="space-y-1">
                        {evaluation.critical_gaps.slice(0, 3).map((gap: string, i: number) => (
                          <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Challenge Config Details */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuração do Desafio</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Temperamento</p>
                <p className="text-gray-900 font-medium">{config.roleplay_config.temperament}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Faixa Etária</p>
                <p className="text-gray-900 font-medium">{config.roleplay_config.age_range}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Critérios de Sucesso</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full">
                  {config.success_criteria.spin_letter_target} ≥ {config.success_criteria.spin_min_score}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                  Objeções ≥ {config.success_criteria.objection_handling_min}
                </span>
              </div>
            </div>

            {config.coaching_tips?.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Dicas de Coaching</p>
                <ul className="space-y-2">
                  {config.coaching_tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-purple-500 font-bold">{i + 1}.</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* AI Reasoning */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Raciocínio da IA</h2>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-4 border border-gray-200">
              {selectedChallenge.ai_reasoning}
            </pre>
          </div>

          {/* Action button for pending challenges */}
          {canDoChallenge(selectedChallenge) && (
            <div className="mt-6">
              <button
                onClick={() => onStartChallenge(selectedChallenge)}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Play className="w-5 h-5" />
                Iniciar Este Desafio
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main list view
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-7 h-7 text-purple-600" />
                Histórico de Desafios
              </h1>
              <p className="text-gray-500 text-sm">Veja seus desafios anteriores e resultados</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-green-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Concluídos</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-yellow-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Taxa de Sucesso</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.successRate.toFixed(0)}%</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Melhoria Média</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.avgImprovement > 0 ? '+' : ''}{stats.avgImprovement.toFixed(1)}
              </p>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'completed', label: 'Concluídos' },
            { key: 'pending', label: 'Pendentes' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === tab.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Challenge List */}
        {filteredChallenges.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum desafio encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredChallenges.map((challenge) => (
              <div
                key={challenge.id}
                onClick={() => setSelectedChallenge(challenge)}
                className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0">
                      {challenge.status === 'completed' ? (
                        challenge.success ? (
                          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                            <Trophy className="w-6 h-6 text-green-600" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                            <Target className="w-6 h-6 text-orange-600" />
                          </div>
                        )
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                          <Target className="w-6 h-6 text-purple-600" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {challenge.challenge_config.title}
                        </h3>
                        {getStatusBadge(challenge.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{formatDate(challenge.challenge_date)}</span>
                        <span className="text-purple-600 font-medium">
                          {getTargetWeaknessLabel(challenge.challenge_config.target_weakness)}
                        </span>
                        {getDifficultyStars(challenge.difficulty_level)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {challenge.status === 'completed' && challenge.result_score !== undefined && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Score</p>
                        <p className={`text-xl font-bold ${
                          challenge.result_score >= 7 ? 'text-green-600' :
                          challenge.result_score >= 5 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {challenge.result_score.toFixed(1)}
                        </p>
                      </div>
                    )}

                    {canDoChallenge(challenge) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onStartChallenge(challenge)
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all flex items-center gap-1"
                      >
                        <Play className="w-4 h-4" />
                        Fazer
                      </button>
                    )}

                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
