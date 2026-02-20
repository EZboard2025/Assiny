'use client'

import { useState, useEffect } from 'react'
import { Target, Trophy, TrendingUp, Calendar, CheckCircle, XCircle, ChevronDown, ChevronUp, Play, Lightbulb, AlertTriangle, Bot, Clock, AlertCircle, FileText } from 'lucide-react'

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
}

interface Stats {
  total: number
  completed: number
  pending: number
  successRate: number
  avgImprovement: number
}

interface Props {
  onStartChallenge?: (challenge: Challenge) => void
}

export default function ChallengeHistoryContent({ onStartChallenge }: Props) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        fetchHistory(user.id)
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error('Error loading user:', err)
      setLoading(false)
    }
  }

  const fetchHistory = async (uid: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/challenges/history?userId=${uid}`)
      const data = await response.json()

      if (data.success) {
        setChallenges(data.challenges)
        setStats(data.stats)
        if (data.challenges.length > 0) {
          setSelectedChallenge(data.challenges[0])
        }
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

  const getStatusBadge = (challenge: Challenge) => {
    if (challenge.status === 'completed') {
      return challenge.success ? (
        <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg border border-green-100 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          Sucesso
        </span>
      ) : (
        <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg border border-gray-200 flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" />
          Não atingiu
        </span>
      )
    }
    return (
      <span className="px-2.5 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg border border-gray-200 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        Pendente
      </span>
    )
  }

  // Barras de dificuldade ao invés de estrelas
  const getDifficultyBars = (level: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-2 h-3 rounded-sm ${
              i <= level ? 'bg-green-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    )
  }

  const extractSpinLetter = (input: string): string => {
    if (!input) return ''
    const upper = input.toUpperCase()
    if (upper.startsWith('SPIN_')) {
      return upper.replace('SPIN_', '')
    }
    if (['S', 'P', 'I', 'N'].includes(upper)) {
      return upper
    }
    return input
  }

  const getSpinLetterLabel = (letter: string) => {
    const extracted = extractSpinLetter(letter)
    const labels: Record<string, string> = {
      'S': 'Situação',
      'P': 'Problema',
      'I': 'Implicação',
      'N': 'Necessidade',
    }
    return labels[extracted] || letter
  }

  const cleanSpinText = (text: string): string => {
    if (!text) return ''
    return text
      .replace(/SPIN_S/gi, 'Situação (S)')
      .replace(/SPIN_P/gi, 'Problema (P)')
      .replace(/SPIN_I/gi, 'Implicação (I)')
      .replace(/SPIN_N/gi, 'Necessidade (N)')
      .replace(/spin selling/gi, 'SPIN Selling')
  }

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-green-600'
    if (score >= 5) return 'text-yellow-600'
    return 'text-gray-500'
  }

  const canDoChallenge = (challenge: Challenge) => {
    return challenge.status === 'pending' || challenge.status === 'in_progress'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-gray-100 border-t-green-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (challenges.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-gray-50 rounded-xl mx-auto mb-4 flex items-center justify-center border border-gray-200">
          <Target className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-900 font-semibold text-lg mb-2">Nenhum desafio encontrado</p>
        <p className="text-gray-500 text-sm">Seus desafios diários aparecerão aqui</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Lista de desafios */}
      <div className="lg:col-span-4 xl:col-span-3">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Concluídos</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Taxa Sucesso</p>
              <p className="text-2xl font-bold text-green-600">{stats.successRate.toFixed(0)}%</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {challenges.length} Desafios
            </h2>
          </div>
          <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
            {challenges.map((challenge) => {
              const config = challenge.challenge_config
              return (
                <button
                  key={challenge.id}
                  onClick={() => { setSelectedChallenge(challenge); setExpandedSection(null) }}
                  className={`w-full text-left p-4 border-b border-gray-100 transition-all ${
                    selectedChallenge?.id === challenge.id
                      ? 'bg-green-50 border-l-4 border-l-green-500'
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Score ou Play */}
                    {challenge.status === 'completed' && challenge.result_score != null ? (
                      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className={`text-lg font-bold ${getScoreColor(challenge.result_score)}`}>
                          {challenge.result_score.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                        <Play className="w-5 h-5 text-green-600" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate mb-1">
                        {cleanSpinText(config.title)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatDate(challenge.challenge_date)}</span>
                        <span className="text-gray-300">|</span>
                        {getDifficultyBars(challenge.difficulty_level)}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detalhes do desafio */}
      <div className="lg:col-span-8 xl:col-span-9">
        {!selectedChallenge ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-xl mx-auto mb-4 flex items-center justify-center border border-gray-200">
              <Target className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-gray-500">Selecione um desafio para ver os detalhes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900">{cleanSpinText(selectedChallenge.challenge_config.title)}</h2>
                    </div>
                    {getStatusBadge(selectedChallenge)}
                  </div>
                  <p className="text-gray-600 text-sm ml-[52px]">{cleanSpinText(selectedChallenge.challenge_config.description)}</p>
                </div>
                {canDoChallenge(selectedChallenge) && onStartChallenge && (
                  <button
                    onClick={() => onStartChallenge(selectedChallenge)}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5 ml-4"
                  >
                    <Play className="w-4 h-4" />
                    Fazer
                  </button>
                )}
              </div>

              {/* Meta e Info */}
              <div className="flex flex-wrap gap-3 text-sm ml-[52px]">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
                  <Target className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 font-medium">
                    Meta: {selectedChallenge.challenge_config.success_criteria.spin_min_score}+ em {getSpinLetterLabel(selectedChallenge.challenge_config.success_criteria.spin_letter_target)}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">{formatDate(selectedChallenge.challenge_date)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                  {getDifficultyBars(selectedChallenge.difficulty_level)}
                </div>
              </div>
            </div>

            {/* Completed challenge cards */}
            {selectedChallenge.status === 'completed' && (
              <>
                {/* Card: Resultado */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'resultado' ? null : 'resultado')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-gray-900">Resultado</h3>
                        <p className="text-xs text-gray-500">
                          Score: {selectedChallenge.result_score?.toFixed(1) || 'N/A'} - {selectedChallenge.success ? 'Sucesso' : 'Não atingiu'}
                        </p>
                      </div>
                    </div>
                    {expandedSection === 'resultado' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </button>
                  {expandedSection === 'resultado' && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Score */}
                        <div className={`rounded-xl p-4 border ${
                          (selectedChallenge.result_score || 0) >= selectedChallenge.challenge_config.success_criteria.spin_min_score
                            ? 'bg-green-50 border-green-100'
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <p className="text-xs text-gray-600 mb-1 uppercase tracking-wider font-medium">Score Final</p>
                          <p className={`text-3xl font-bold ${getScoreColor(selectedChallenge.result_score || 0)}`}>
                            {selectedChallenge.result_score?.toFixed(1) || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Meta: {selectedChallenge.challenge_config.success_criteria.spin_min_score}
                          </p>
                        </div>

                        {/* Status */}
                        <div className={`rounded-xl p-4 border ${
                          selectedChallenge.success
                            ? 'bg-green-50 border-green-100'
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <p className="text-xs text-gray-600 mb-1 uppercase tracking-wider font-medium">Status</p>
                          <div className="flex items-center gap-2">
                            {selectedChallenge.success ? (
                              <>
                                <CheckCircle className="w-6 h-6 text-green-500" />
                                <span className="text-lg font-bold text-green-600">Sucesso!</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-6 h-6 text-gray-400" />
                                <span className="text-lg font-bold text-gray-600">Não atingiu</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Melhoria */}
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <p className="text-xs text-gray-600 mb-1 uppercase tracking-wider font-medium">Melhoria</p>
                          <div className="flex items-center gap-2">
                            {selectedChallenge.improvement_from_baseline != null ? (
                              <>
                                <TrendingUp className={`w-6 h-6 ${
                                  selectedChallenge.improvement_from_baseline > 0 ? 'text-green-500' :
                                  selectedChallenge.improvement_from_baseline < 0 ? 'text-red-500' : 'text-gray-400'
                                }`} />
                                <span className={`text-2xl font-bold ${
                                  selectedChallenge.improvement_from_baseline > 0 ? 'text-green-600' :
                                  selectedChallenge.improvement_from_baseline < 0 ? 'text-red-600' : 'text-gray-500'
                                }`}>
                                  {selectedChallenge.improvement_from_baseline > 0 ? '+' : ''}{selectedChallenge.improvement_from_baseline.toFixed(1)}
                                </span>
                              </>
                            ) : (
                              <>
                                <Target className="w-6 h-6 text-gray-400" />
                                <div>
                                  <span className="text-lg font-bold text-gray-600">Referência</span>
                                  <p className="text-xs text-gray-500">Primeira medição</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card: Análise SPIN */}
                {selectedChallenge.evaluation?.spin_evaluation && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'spin' ? null : 'spin')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                          <Target className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-gray-900">Análise SPIN</h3>
                          <p className="text-xs text-gray-500">
                            {['S', 'P', 'I', 'N'].map((letter) => {
                              const score = selectedChallenge.evaluation?.spin_evaluation?.[letter]?.final_score
                              return score !== undefined ? `${letter}: ${score.toFixed(1)}` : null
                            }).filter(Boolean).join(' | ') || 'Sem análise SPIN'}
                          </p>
                        </div>
                      </div>
                      {expandedSection === 'spin' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSection === 'spin' && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                        <div className="grid grid-cols-4 gap-2 mb-4">
                          {['S', 'P', 'I', 'N'].map((letter) => {
                            const score = selectedChallenge.evaluation.spin_evaluation[letter]?.final_score
                            const isTarget = extractSpinLetter(selectedChallenge.challenge_config.success_criteria.spin_letter_target) === letter
                            return (
                              <div
                                key={letter}
                                className={`rounded-xl p-3 text-center ${
                                  isTarget
                                    ? 'bg-green-50 border-2 border-green-200'
                                    : 'bg-gray-50 border border-gray-200'
                                }`}
                              >
                                <p className={`text-xs font-medium mb-1 ${isTarget ? 'text-green-600' : 'text-gray-500'}`}>
                                  {getSpinLetterLabel(letter)}
                                  {isTarget && ' (Meta)'}
                                </p>
                                <p className={`text-xl font-bold ${getScoreColor(score || 0)}`}>
                                  {score?.toFixed(1) || 'N/A'}
                                </p>
                              </div>
                            )
                          })}
                        </div>

                        {/* SPIN Detailed breakdown - 2 columns */}
                        <div className="grid grid-cols-2 gap-4">
                          {['S', 'P', 'I', 'N'].map((letter) => {
                            const spinDetail = selectedChallenge.evaluation.spin_evaluation[letter]
                            if (!spinDetail) return null
                            const score = spinDetail.final_score
                            const isTarget = extractSpinLetter(selectedChallenge.challenge_config.success_criteria.spin_letter_target) === letter
                            return (
                              <div key={letter} className={`rounded-xl p-4 ${isTarget ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                                {/* Card header */}
                                <div className="flex items-center gap-3 mb-3">
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm ${
                                    score >= 7 ? 'bg-green-500' :
                                    score >= 5 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  }`}>
                                    {letter}
                                  </div>
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900">
                                      {getSpinLetterLabel(letter)}
                                      {isTarget && <span className="text-green-600 text-xs ml-1">(Meta)</span>}
                                    </div>
                                    <div className={`text-xs font-medium ${
                                      score >= 7 ? 'text-green-600' :
                                      score >= 5 ? 'text-yellow-600' :
                                      'text-red-600'
                                    }`}>
                                      {score?.toFixed(1) || '--'}/10
                                    </div>
                                  </div>
                                </div>

                                {/* Indicators */}
                                {spinDetail.indicators && (
                                  <div className="space-y-2 mb-3">
                                    {Object.entries(spinDetail.indicators).map(([key, value]: [string, any]) => {
                                      const indicatorLabels: Record<string, string> = {
                                        open_questions_score: 'Perguntas Abertas',
                                        scenario_mapping_score: 'Mapeamento de Cenário',
                                        adaptability_score: 'Adaptabilidade',
                                        problem_identification_score: 'Identificação de Problemas',
                                        consequences_exploration_score: 'Exploração de Consequências',
                                        depth_score: 'Profundidade',
                                        empathy_score: 'Empatia',
                                        impact_understanding_score: 'Compreensão de Impacto',
                                        inaction_consequences_score: 'Consequências da Inação',
                                        urgency_amplification_score: 'Amplificação de Urgência',
                                        concrete_risks_score: 'Riscos Concretos',
                                        non_aggressive_urgency_score: 'Urgência Não Agressiva',
                                        solution_clarity_score: 'Clareza da Solução',
                                        personalization_score: 'Personalização',
                                        benefits_clarity_score: 'Clareza dos Benefícios',
                                        credibility_score: 'Credibilidade',
                                        cta_effectiveness_score: 'Efetividade do CTA',
                                      }
                                      const indicatorLabel = indicatorLabels[key] || key
                                        .replace(/_score$/, '')
                                        .replace(/_/g, ' ')
                                        .replace(/\b\w/g, (c: string) => c.toUpperCase())
                                      return (
                                        <div key={key}>
                                          <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-xs text-gray-600">{indicatorLabel}</span>
                                            <span className={`text-xs font-semibold ${
                                              Number(value) >= 7 ? 'text-green-600' :
                                              Number(value) >= 5 ? 'text-yellow-600' : 'text-red-600'
                                            }`}>{value}/10</span>
                                          </div>
                                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all ${
                                                Number(value) >= 7 ? 'bg-green-500' :
                                                Number(value) >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                                              }`}
                                              style={{ width: `${(Number(value) / 10) * 100}%` }}
                                            />
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* Technical feedback */}
                                {spinDetail.technical_feedback && (
                                  <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-200 pt-3 mb-3">
                                    {spinDetail.technical_feedback}
                                  </p>
                                )}

                                {/* Missed opportunities */}
                                {spinDetail.missed_opportunities && spinDetail.missed_opportunities.length > 0 && (
                                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                                    <p className="text-[11px] font-semibold text-orange-700 mb-1.5">Oportunidades perdidas</p>
                                    <ul className="space-y-1">
                                      {spinDetail.missed_opportunities.map((opp: string, idx: number) => (
                                        <li key={idx} className="text-xs text-gray-700 flex items-start gap-1.5">
                                          <span className="text-orange-400 mt-0.5 flex-shrink-0">•</span>
                                          {opp}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Card: Avaliação */}
                {(selectedChallenge.evaluation?.executive_summary || selectedChallenge.evaluation?.top_strengths?.length > 0 || selectedChallenge.evaluation?.critical_gaps?.length > 0) && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'avaliacao' ? null : 'avaliacao')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-gray-900">Avaliação</h3>
                          <p className="text-xs text-gray-500">
                            {selectedChallenge.evaluation?.executive_summary
                              ? selectedChallenge.evaluation.executive_summary.substring(0, 80) + (selectedChallenge.evaluation.executive_summary.length > 80 ? '...' : '')
                              : 'Resumo e pontos fortes/fracos'}
                          </p>
                        </div>
                      </div>
                      {expandedSection === 'avaliacao' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSection === 'avaliacao' && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                        {/* Resumo */}
                        {selectedChallenge.evaluation?.executive_summary && (
                          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Resumo</h4>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {selectedChallenge.evaluation.executive_summary}
                            </p>
                          </div>
                        )}

                        {/* Pontos fortes e fracos */}
                        {(selectedChallenge.evaluation?.top_strengths?.length > 0 || selectedChallenge.evaluation?.critical_gaps?.length > 0) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedChallenge.evaluation?.top_strengths?.length > 0 && (
                              <div className="bg-green-50/50 rounded-xl p-4 border border-green-100">
                                <div className="flex items-center gap-2 mb-3">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <h4 className="text-sm font-semibold text-gray-900">Pontos Fortes</h4>
                                </div>
                                <ul className="space-y-1.5">
                                  {selectedChallenge.evaluation.top_strengths.map((strength: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                      <span className="text-green-500 mt-1">•</span>
                                      {strength}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {selectedChallenge.evaluation?.critical_gaps?.length > 0 && (
                              <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100">
                                <div className="flex items-center gap-2 mb-3">
                                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                                  <h4 className="text-sm font-semibold text-gray-900">A Melhorar</h4>
                                </div>
                                <ul className="space-y-1.5">
                                  {selectedChallenge.evaluation.critical_gaps.map((gap: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                      <span className="text-orange-500 mt-1">•</span>
                                      {gap}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Card: Objeções */}
                {selectedChallenge.evaluation?.objections_analysis && selectedChallenge.evaluation.objections_analysis.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'objecoes' ? null : 'objecoes')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-gray-900">Objeções</h3>
                          <p className="text-xs text-gray-500">
                            {selectedChallenge.evaluation.objections_analysis.length} objeções analisadas
                          </p>
                        </div>
                      </div>
                      {expandedSection === 'objecoes' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSection === 'objecoes' && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                        <div className="space-y-4">
                          {selectedChallenge.evaluation.objections_analysis.map((obj: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 rounded-xl p-5">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                                      obj.objection_type === 'preço' || obj.objection_type === 'preco' ? 'bg-red-100 text-red-700' :
                                      obj.objection_type === 'timing' ? 'bg-blue-100 text-blue-700' :
                                      obj.objection_type === 'autoridade' ? 'bg-purple-100 text-purple-700' :
                                      obj.objection_type === 'concorrência' || obj.objection_type === 'concorrencia' ? 'bg-orange-100 text-orange-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>
                                      {obj.objection_type}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 italic leading-relaxed">&ldquo;{obj.objection_text}&rdquo;</p>
                                </div>
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-4 ${
                                  obj.score >= 7 ? 'bg-green-100' :
                                  obj.score >= 5 ? 'bg-yellow-100' : 'bg-red-100'
                                }`}>
                                  <span className={`text-xl font-bold ${
                                    obj.score >= 7 ? 'text-green-600' :
                                    obj.score >= 5 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {obj.score}
                                  </span>
                                </div>
                              </div>

                              {obj.detailed_analysis && (
                                <p className="text-sm text-gray-600 leading-relaxed mb-3">{obj.detailed_analysis}</p>
                              )}

                              {obj.critical_errors && obj.critical_errors.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-xs font-semibold text-red-600 mb-1.5">Erros criticos:</p>
                                  <ul className="space-y-1">
                                    {obj.critical_errors.map((err: string, i: number) => (
                                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                        <span className="text-red-400 mt-1">•</span>
                                        {err}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {obj.ideal_response && (
                                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                  <p className="text-xs font-semibold text-green-700 mb-1">Resposta ideal:</p>
                                  <p className="text-sm text-gray-700 leading-relaxed">{obj.ideal_response}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Card: Melhorias Prioritárias */}
                {selectedChallenge.evaluation?.priority_improvements && selectedChallenge.evaluation.priority_improvements.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'melhorias' ? null : 'melhorias')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                          <Lightbulb className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-gray-900">Melhorias Prioritárias</h3>
                          <p className="text-xs text-gray-500">
                            {selectedChallenge.evaluation.priority_improvements.length} melhorias identificadas
                          </p>
                        </div>
                      </div>
                      {expandedSection === 'melhorias' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSection === 'melhorias' && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                        <ul className="space-y-2">
                          {selectedChallenge.evaluation.priority_improvements.map((improvement: any, idx: number) => (
                            <li key={idx} className="text-sm text-gray-700">
                              <span className="font-medium">{improvement.area || improvement}:</span>{' '}
                              {improvement.action_plan || ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Card: Aderência ao Playbook */}
                {selectedChallenge.evaluation?.playbook_adherence && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'playbook' ? null : 'playbook')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-gray-900">Aderência ao Playbook</h3>
                          <p className="text-xs text-gray-500">
                            {selectedChallenge.evaluation.playbook_adherence.overall_adherence_score}% de aderência
                          </p>
                        </div>
                      </div>
                      {expandedSection === 'playbook' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSection === 'playbook' && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                        {/* Dimensões */}
                        {selectedChallenge.evaluation.playbook_adherence.dimensions && (
                          <div className="grid grid-cols-5 gap-2">
                            {[
                              { key: 'opening', label: 'Abertura', icon: '🎯' },
                              { key: 'closing', label: 'Fechamento', icon: '🤝' },
                              { key: 'conduct', label: 'Conduta', icon: '👔' },
                              { key: 'required_scripts', label: 'Scripts', icon: '📝' },
                              { key: 'process', label: 'Processo', icon: '⚙️' }
                            ].map(({ key, label, icon }) => {
                              const dim = selectedChallenge.evaluation.playbook_adherence?.dimensions?.[key]
                              if (!dim || dim.status === 'not_evaluated') return null
                              return (
                                <div key={key} className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                                  <div className="text-lg">{icon}</div>
                                  <div className={`text-lg font-bold ${
                                    (dim.score || 0) >= 70 ? 'text-green-600' :
                                    (dim.score || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {dim.score || 0}%
                                  </div>
                                  <div className="text-[10px] text-gray-500">{label}</div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Violações */}
                        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                          <h5 className="flex items-center gap-2 text-xs font-semibold text-red-700 mb-2">
                            <AlertTriangle className="w-3 h-3" />
                            Violações
                          </h5>
                          {selectedChallenge.evaluation.playbook_adherence.violations?.length > 0 ? (
                            <ul className="space-y-1">
                              {selectedChallenge.evaluation.playbook_adherence.violations.map((v: any, i: number) => (
                                <li key={i} className="text-xs text-gray-700">{v.criterion}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Nenhuma violação
                            </p>
                          )}
                        </div>

                        {/* Requisitos não cumpridos */}
                        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                          <h5 className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
                            <AlertCircle className="w-3 h-3" />
                            Requisitos Não Cumpridos
                          </h5>
                          {selectedChallenge.evaluation.playbook_adherence.missed_requirements?.length > 0 ? (
                            <ul className="space-y-1">
                              {selectedChallenge.evaluation.playbook_adherence.missed_requirements.map((m: any, i: number) => (
                                <li key={i} className="text-xs text-gray-700">{m.criterion}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Todos cumpridos
                            </p>
                          )}
                        </div>

                        {/* Orientações */}
                        {selectedChallenge.evaluation.playbook_adherence.coaching_notes && (
                          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                            <h5 className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-2">
                              <Lightbulb className="w-3 h-3" />
                              Orientações
                            </h5>
                            <p className="text-xs text-gray-700">{selectedChallenge.evaluation.playbook_adherence.coaching_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Cards shown for all challenges */}

            {/* Card: Dicas de Coaching */}
            {selectedChallenge.challenge_config.coaching_tips?.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'coaching' ? null : 'coaching')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-gray-900">Dicas de Coaching</h3>
                      <p className="text-xs text-gray-500">
                        {selectedChallenge.challenge_config.coaching_tips.length} dicas disponíveis
                      </p>
                    </div>
                  </div>
                  {expandedSection === 'coaching' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {expandedSection === 'coaching' && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <ul className="space-y-2">
                      {selectedChallenge.challenge_config.coaching_tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                          <span className="w-6 h-6 bg-green-50 text-green-700 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 border border-green-100">
                            {i + 1}
                          </span>
                          <span className="pt-0.5">{cleanSpinText(tip)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Card: Por que este desafio? */}
            {selectedChallenge.ai_reasoning && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'reasoning' ? null : 'reasoning')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                      <Bot className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-gray-900">Por que este desafio?</h3>
                      <p className="text-xs text-gray-500">
                        {selectedChallenge.ai_reasoning.substring(0, 60)}{selectedChallenge.ai_reasoning.length > 60 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                  {expandedSection === 'reasoning' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {expandedSection === 'reasoning' && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {selectedChallenge.ai_reasoning}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* CTA para desafios pendentes */}
            {canDoChallenge(selectedChallenge) && onStartChallenge && (
              <div className="bg-green-50 rounded-xl border border-green-100 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Pronto para o desafio?</h3>
                    <p className="text-sm text-gray-600">
                      {selectedChallenge.challenge_date < new Date().toISOString().split('T')[0]
                        ? 'Este desafio é de um dia anterior, mas você ainda pode completá-lo!'
                        : 'Complete este desafio e melhore suas habilidades de vendas.'}
                    </p>
                  </div>
                  <button
                    onClick={() => onStartChallenge(selectedChallenge)}
                    className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg flex items-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Fazer Desafio
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
