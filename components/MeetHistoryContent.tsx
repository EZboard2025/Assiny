'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Video, Clock, TrendingUp, Calendar, ChevronDown, ChevronUp, User, AlertTriangle, Lightbulb, CheckCircle, Trash2, AlertCircle, FileText, Play, Target, MessageCircle, CheckCheck, Shield, ScrollText, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface MeetEvaluation {
  id: string
  meeting_id: string
  seller_name: string
  call_objective: string | null
  funnel_stage: string | null
  transcript: any[]
  evaluation: any
  overall_score: number | null
  performance_level: string | null
  spin_s_score: number | null
  spin_p_score: number | null
  spin_i_score: number | null
  spin_n_score: number | null
  created_at: string
}

function cleanGptText(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\s*—\s*/g, ': ')
    .replace(/\s*–\s*/g, ': ')
    .replace(/^Tecnica:\s*/i, '')
    .trim()
}

function mapAreaToSpinLetter(area: string): string | null {
  const n = area.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (n.includes('situac')) return 'S'
  if (n.includes('problema')) return 'P'
  if (n.includes('implicac')) return 'I'
  if (n.includes('necessidade') || n.includes('need')) return 'N'
  return null
}

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

function translateIndicator(key: string): string {
  if (indicatorLabels[key]) return indicatorLabels[key]
  return key
    .replace(/_score$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
}

export default function MeetHistoryContent() {
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<MeetEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvaluation, setSelectedEvaluation] = useState<MeetEvaluation | null>(null)
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())
  const [simulations, setSimulations] = useState<Record<string, any>>({})
  const [correctionScores, setCorrectionScores] = useState<Record<string, number | null>>({})
  const [correctionSessions, setCorrectionSessions] = useState<Record<string, any>>({})
  const [expandedCorrectionSection, setExpandedCorrectionSection] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        console.error('Usuário não autenticado')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('meet_evaluations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao carregar histórico:', error)
        setLoading(false)
        return
      }

      setEvaluations(data || [])
      if (data && data.length > 0) {
        setSelectedEvaluation(data[0])
      }

      // Load saved simulations linked to evaluations
      if (data && data.length > 0) {
        const evalIds = data.map((e: MeetEvaluation) => e.id)
        const { data: sims } = await supabase
          .from('saved_simulations')
          .select('*')
          .in('meet_evaluation_id', evalIds)

        if (sims) {
          const simMap: Record<string, any> = {}
          sims.forEach((s: any) => {
            if (s.meet_evaluation_id) {
              simMap[s.meet_evaluation_id] = s
            }
          })
          setSimulations(simMap)

          // Load full roleplay session data for completed simulations
          const completedSims = sims.filter((s: any) => s.status === 'completed' && s.roleplay_session_id)
          if (completedSims.length > 0) {
            const sessionIds = completedSims.map((s: any) => s.roleplay_session_id)
            const { data: sessions } = await supabase
              .from('roleplay_sessions')
              .select('*')
              .in('id', sessionIds)

            if (sessions) {
              const scores: Record<string, number | null> = {}
              const sessionMap: Record<string, any> = {}
              completedSims.forEach((sim: any) => {
                const session = sessions.find((s: any) => s.id === sim.roleplay_session_id)
                if (session) {
                  let evalData = session.evaluation
                  if (evalData && typeof evalData === 'object' && 'output' in evalData) {
                    try { evalData = JSON.parse(evalData.output) } catch {}
                  }
                  const score = evalData?.overall_score
                  scores[sim.meet_evaluation_id] = score !== undefined ? (score > 10 ? score / 10 : score) : null
                  sessionMap[sim.meet_evaluation_id] = { ...session, evaluation: evalData }
                }
              })
              setCorrectionScores(scores)
              setCorrectionSessions(sessionMap)
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de Meet:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartSimulation = async (sim: any) => {
    if (!sim) return
    sessionStorage.setItem('meetSimulation', JSON.stringify({
      simulation_config: sim.simulation_config,
      simulation_id: sim.id,
    }))

    router.push('/roleplay')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta avaliação?')) return

    try {
      const { error } = await supabase
        .from('meet_evaluations')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Erro ao excluir:', error)
        return
      }

      setEvaluations(evaluations.filter(e => e.id !== id))
      if (selectedEvaluation?.id === id) {
        setSelectedEvaluation(evaluations.length > 1 ? evaluations.find(e => e.id !== id) || null : null)
      }
    } catch (error) {
      console.error('Erro ao excluir avaliação:', error)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Normalize score to 0-10 scale (DB stores 0-100)
  const normalizeScore = (score: number | null): number => {
    if (score === null) return 0
    return score > 10 ? Math.round(score / 10) : score
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    const s = normalizeScore(score)
    if (s >= 8) return 'text-green-600'
    if (s >= 6) return 'text-yellow-600'
    if (s >= 4) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-100'
    const s = normalizeScore(score)
    if (s >= 8) return 'bg-green-50'
    if (s >= 6) return 'bg-blue-50'
    if (s >= 4) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  const getPerformanceLabel = (level: string | null) => {
    const labels: Record<string, string> = {
      'legendary': 'Lendário',
      'excellent': 'Excelente',
      'very_good': 'Muito Bom',
      'good': 'Bom',
      'needs_improvement': 'Precisa Melhorar',
      'poor': 'Em Desenvolvimento'
    }
    return labels[level || ''] || level || 'N/A'
  }

  const toggleDetails = (id: string) => {
    const newExpanded = new Set(expandedDetails)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedDetails(newExpanded)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-green-100 border-t-green-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (evaluations.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
          <Video className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-900 font-semibold text-lg mb-2">Nenhuma avaliação de Meet</p>
        <p className="text-gray-500 text-sm">Complete uma avaliação de Google Meet para ver o histórico</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Lista de avaliações - Coluna estreita */}
      <div className="lg:col-span-4 xl:col-span-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {evaluations.length} Avaliações
            </h2>
          </div>
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            {evaluations.map((evaluation) => {
              const sim = simulations[evaluation.id]
              const correctionScore = correctionScores[evaluation.id]
              const hasSim = !!sim
              const isCompleted = sim?.status === 'completed'

              return (
                <button
                  key={evaluation.id}
                  onClick={() => setSelectedEvaluation(evaluation)}
                  className={`w-full text-left p-4 border-b border-gray-100 transition-all ${
                    selectedEvaluation?.id === evaluation.id
                      ? 'bg-green-50 border-l-4 border-l-green-500'
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Score */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getScoreBg(evaluation.overall_score)}`}>
                      <span className={`text-lg font-bold ${getScoreColor(evaluation.overall_score)}`}>
                        {evaluation.overall_score !== null ? Math.round(evaluation.overall_score / 10) : '--'}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {evaluation.seller_name}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {formatDate(evaluation.created_at)}
                      </div>
                      {hasSim && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Target className="w-3 h-3 text-purple-500 flex-shrink-0" />
                          <span className={`text-[11px] font-medium ${isCompleted ? 'text-green-600' : 'text-purple-500'}`}>
                            {isCompleted ? 'Correção feita' : 'Correção pendente'}
                          </span>
                          {isCompleted && correctionScore !== undefined && correctionScore !== null && (
                            <span className={`text-[11px] font-bold ${getScoreColor(correctionScore)}`}>
                              ({correctionScore.toFixed(1)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detalhes da avaliação */}
      <div className="lg:col-span-8 xl:col-span-9">
        {selectedEvaluation ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${getScoreBg(selectedEvaluation.overall_score)}`}>
                      <span className={`text-2xl font-bold ${getScoreColor(selectedEvaluation.overall_score)}`}>
                        {selectedEvaluation.overall_score !== null ? Math.round(selectedEvaluation.overall_score / 10) : '--'}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedEvaluation.seller_name}</h2>
                      <p className="text-sm text-gray-500">{getPerformanceLabel(selectedEvaluation.performance_level)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(selectedEvaluation.created_at)} às {formatTime(selectedEvaluation.created_at)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(selectedEvaluation.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Seller Identification */}
            {selectedEvaluation.evaluation?.seller_identification && (
              <div className="px-6 pt-4 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>Vendedor: <strong>{selectedEvaluation.evaluation.seller_identification.name}</strong></span>
                  {selectedEvaluation.evaluation.seller_identification.speaking_time_percentage !== undefined && (
                    <span className="text-gray-400">
                      · {selectedEvaluation.evaluation.seller_identification.speaking_time_percentage}% do tempo falando
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* SPIN Scores - Compact overview */}
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Scores SPIN</h3>
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { letter: 'S', label: 'Situação', score: selectedEvaluation.spin_s_score },
                  { letter: 'P', label: 'Problema', score: selectedEvaluation.spin_p_score },
                  { letter: 'I', label: 'Implicação', score: selectedEvaluation.spin_i_score },
                  { letter: 'N', label: 'Necessidade', score: selectedEvaluation.spin_n_score },
                ].map(({ letter, label, score }) => (
                  <div key={letter} className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className={`text-3xl font-bold mb-1 ${
                      score !== null && score >= 7 ? 'text-green-600' :
                      score !== null && score >= 5 ? 'text-yellow-600' :
                      score !== null ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {score !== null ? score.toFixed(1) : '--'}
                    </div>
                    <div className="text-xs font-medium text-gray-500">{label}</div>
                  </div>
                ))}
              </div>

              {/* SPIN Detailed breakdown - 2 columns */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { letter: 'S', label: 'Situação', score: selectedEvaluation.spin_s_score },
                  { letter: 'P', label: 'Problema', score: selectedEvaluation.spin_p_score },
                  { letter: 'I', label: 'Implicação', score: selectedEvaluation.spin_i_score },
                  { letter: 'N', label: 'Necessidade', score: selectedEvaluation.spin_n_score },
                ].map(({ letter, label, score }) => {
                  const spinDetail = selectedEvaluation.evaluation?.spin_evaluation?.[letter]
                  if (!spinDetail) return null
                  return (
                    <div key={letter} className="bg-gray-50 rounded-xl p-4">
                      {/* Card header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm ${
                          score !== null && score >= 7 ? 'bg-green-500' :
                          score !== null && score >= 5 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}>
                          {letter}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{label}</div>
                          <div className={`text-xs font-medium ${
                            score !== null && score >= 7 ? 'text-green-600' :
                            score !== null && score >= 5 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {score !== null ? `${score.toFixed(1)}/10` : '--'}
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

            {/* Objections Analysis */}
            {selectedEvaluation.evaluation?.objections_analysis && selectedEvaluation.evaluation.objections_analysis.length > 0 && (
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Análise de Objeções</h3>
                <div className="space-y-4">
                  {selectedEvaluation.evaluation.objections_analysis.map((obj: any, idx: number) => (
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

            {/* Avaliação detalhada - always visible */}
            {selectedEvaluation.evaluation && (
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Avaliação Detalhada</h3>
                  <div className="space-y-4">
                    {/* Resumo executivo */}
                    {selectedEvaluation.evaluation.executive_summary && (
                      <div className="bg-blue-50 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-blue-700 mb-2">Resumo Executivo</h4>
                        <p className="text-sm text-gray-700">{selectedEvaluation.evaluation.executive_summary}</p>
                      </div>
                    )}

                    {/* Pontos fortes */}
                    {selectedEvaluation.evaluation.top_strengths && selectedEvaluation.evaluation.top_strengths.length > 0 && (
                      <div className="bg-green-50 rounded-xl p-4">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-green-700 mb-2">
                          <CheckCircle className="w-4 h-4" />
                          Pontos Fortes
                        </h4>
                        <ul className="space-y-1">
                          {selectedEvaluation.evaluation.top_strengths.map((strength: string, idx: number) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-green-500 mt-1">•</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Gaps críticos */}
                    {selectedEvaluation.evaluation.critical_gaps && selectedEvaluation.evaluation.critical_gaps.length > 0 && (
                      <div className="bg-orange-50 rounded-xl p-4">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-orange-700 mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          Gaps Críticos
                        </h4>
                        <ul className="space-y-1">
                          {selectedEvaluation.evaluation.critical_gaps.map((gap: string, idx: number) => (
                            <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-orange-500 mt-1">•</span>
                              {gap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Melhorias prioritárias */}
                    {selectedEvaluation.evaluation.priority_improvements && selectedEvaluation.evaluation.priority_improvements.length > 0 && (
                      <div className="bg-purple-50 rounded-xl p-4">
                        <h4 className="flex items-center gap-2 text-sm font-semibold text-purple-700 mb-2">
                          <Lightbulb className="w-4 h-4" />
                          Melhorias Prioritárias
                        </h4>
                        <ul className="space-y-2">
                          {selectedEvaluation.evaluation.priority_improvements.map((improvement: any, idx: number) => (
                            <li key={idx} className="text-sm text-gray-700">
                              <span className="font-medium">{improvement.area || improvement}:</span>{' '}
                              {improvement.action_plan || ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Playbook Adherence */}
                    {selectedEvaluation.evaluation.playbook_adherence && (
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-purple-700">Aderência ao Playbook</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-2xl font-bold text-purple-600">
                                  {selectedEvaluation.evaluation.playbook_adherence.overall_adherence_score}%
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                  selectedEvaluation.evaluation.playbook_adherence.adherence_level === 'exemplary' ? 'bg-green-100 text-green-700' :
                                  selectedEvaluation.evaluation.playbook_adherence.adherence_level === 'compliant' ? 'bg-blue-100 text-blue-700' :
                                  selectedEvaluation.evaluation.playbook_adherence.adherence_level === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {selectedEvaluation.evaluation.playbook_adherence.adherence_level === 'exemplary' ? 'Exemplar' :
                                   selectedEvaluation.evaluation.playbook_adherence.adherence_level === 'compliant' ? 'Conforme' :
                                   selectedEvaluation.evaluation.playbook_adherence.adherence_level === 'partial' ? 'Parcial' : 'Não Conforme'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Dimensões */}
                        {selectedEvaluation.evaluation.playbook_adherence.dimensions && (
                          <div className="grid grid-cols-5 gap-2 mb-4">
                            {[
                              { key: 'opening', label: 'Abertura', Icon: MessageCircle, color: 'text-blue-500' },
                              { key: 'closing', label: 'Fechamento', Icon: CheckCheck, color: 'text-emerald-500' },
                              { key: 'conduct', label: 'Conduta', Icon: Shield, color: 'text-purple-500' },
                              { key: 'required_scripts', label: 'Scripts', Icon: ScrollText, color: 'text-amber-500' },
                              { key: 'process', label: 'Processo', Icon: Settings, color: 'text-gray-500' }
                            ].map(({ key, label, Icon, color }) => {
                              const dim = selectedEvaluation.evaluation.playbook_adherence?.dimensions?.[key]
                              if (!dim || dim.status === 'not_evaluated') return null
                              return (
                                <div key={key} className="bg-white/70 rounded-lg p-2 text-center border border-purple-100">
                                  <div className="flex justify-center mb-1">
                                    <Icon className={`w-4 h-4 ${color}`} />
                                  </div>
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

                        <div className="grid grid-cols-2 gap-3">
                          {/* Violações */}
                          <div className="bg-red-50/80 rounded-lg p-3 border border-red-100">
                            <h5 className="flex items-center gap-2 text-xs font-semibold text-red-700 mb-2">
                              <AlertTriangle className="w-3 h-3" />
                              Violações
                            </h5>
                            {selectedEvaluation.evaluation.playbook_adherence.violations?.length > 0 ? (
                              <ul className="space-y-1">
                                {selectedEvaluation.evaluation.playbook_adherence.violations.slice(0, 3).map((v: any, i: number) => (
                                  <li key={i} className="text-xs text-gray-700">{typeof v === 'string' ? v : v?.criterion || v?.description || JSON.stringify(v)}</li>
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
                          <div className="bg-amber-50/80 rounded-lg p-3 border border-amber-100">
                            <h5 className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
                              <AlertCircle className="w-3 h-3" />
                              Não Cumpridos
                            </h5>
                            {selectedEvaluation.evaluation.playbook_adherence.missed_requirements?.length > 0 ? (
                              <ul className="space-y-1">
                                {selectedEvaluation.evaluation.playbook_adherence.missed_requirements.slice(0, 3).map((m: any, i: number) => (
                                  <li key={i} className="text-xs text-gray-700">{typeof m === 'string' ? m : m?.criterion || m?.description || JSON.stringify(m)}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Todos cumpridos
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Orientações */}
                        {selectedEvaluation.evaluation.playbook_adherence.coaching_notes && (
                          <div className="bg-blue-50/80 rounded-lg p-3 border border-blue-100 mt-3">
                            <h5 className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-2">
                              <Lightbulb className="w-3 h-3" />
                              Orientações para Melhorar
                            </h5>
                            <p className="text-xs text-gray-700 leading-relaxed">{selectedEvaluation.evaluation.playbook_adherence.coaching_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
              </div>
            )}

            {/* Prática Direcionada */}
            {simulations[selectedEvaluation.id] && (
              <div className="p-6 border-t border-gray-100">
                {(() => {
                  const sim = simulations[selectedEvaluation.id]
                  const config = sim.simulation_config
                  const coaching = config?.coaching_focus || []
                  const justification = sim.simulation_justification || config?.simulation_justification || null
                  const isCompleted = sim.status === 'completed'
                  const cScore = correctionScores[selectedEvaluation.id]
                  const meetScore = selectedEvaluation.overall_score !== null ? normalizeScore(selectedEvaluation.overall_score) : null
                  const corrSession = correctionSessions[selectedEvaluation.id]
                  const corrEval = corrSession?.evaluation
                  const isExpanded = expandedCorrectionSection === selectedEvaluation.id

                  return (
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCompleted ? 'bg-green-100' : 'bg-purple-100'}`}>
                            {isCompleted ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <Target className="w-5 h-5 text-purple-600" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">
                              {isCompleted ? 'Prática Concluída' : 'Prática Direcionada'}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {isCompleted ? 'Prática direcionada realizada' : 'Pratique com o mesmo cliente para corrigir os erros'}
                            </p>
                          </div>
                        </div>
                        {!isCompleted && (
                          <button
                            onClick={() => handleStartSimulation(sim)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <Play className="w-4 h-4" />
                            Iniciar Simulação
                          </button>
                        )}
                        {isCompleted && (
                          <button
                            onClick={() => setExpandedCorrectionSection(isExpanded ? null : selectedEvaluation.id)}
                            className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
                          >
                            {isExpanded ? 'Ocultar detalhes' : 'Ver detalhes'}
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Score comparison - Meet vs Correção */}
                      {isCompleted && cScore !== undefined && cScore !== null && meetScore !== null && (
                        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border border-blue-200 p-4">
                          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-3">Comparação de Performance</p>
                          <div className="grid grid-cols-3 gap-3 items-center">
                            <div className="text-center">
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Meet</div>
                              <div className={`text-2xl font-bold ${getScoreColor(selectedEvaluation.overall_score)}`}>
                                {meetScore.toFixed(1)}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className={`text-lg font-bold ${cScore > meetScore ? 'text-green-600' : cScore < meetScore ? 'text-red-500' : 'text-gray-400'}`}>
                                {cScore > meetScore ? '→' : cScore < meetScore ? '→' : '='}
                              </div>
                              <div className={`text-[10px] font-medium ${cScore > meetScore ? 'text-green-600' : cScore < meetScore ? 'text-red-500' : 'text-gray-400'}`}>
                                {cScore > meetScore ? `+${(cScore - meetScore).toFixed(1)}` : cScore < meetScore ? `${(cScore - meetScore).toFixed(1)}` : 'Igual'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Correção</div>
                              <div className={`text-2xl font-bold ${getScoreColor(cScore)}`}>
                                {cScore.toFixed(1)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Coaching focus area badges */}
                      {coaching.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {coaching.map((c: any, i: number) => {
                            const sevColor = c.severity === 'critical' ? 'bg-red-100 text-red-700 border-red-200' : c.severity === 'high' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                            return (
                              <span key={i} className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${sevColor}`}>
                                {c.area} {c.spin_score !== undefined ? `· ${c.spin_score.toFixed(1)}` : ''}
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* PENDING STATE: Show full config details */}
                      {!isCompleted && (
                        <div className="space-y-4">
                          {/* Justification */}
                          {justification && (
                            <div className="bg-purple-50 rounded-xl p-4 border-l-4 border-purple-400 border border-purple-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Target className="w-4 h-4 text-purple-600" />
                                <h4 className="text-sm font-bold text-gray-900">Por que esta prática?</h4>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed">{justification}</p>
                            </div>
                          )}

                          {/* Meeting Context */}
                          {config?.meeting_context && (
                            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                              <p className="text-sm text-gray-700 italic">{config.meeting_context}</p>
                            </div>
                          )}

                          {/* Persona */}
                          {config?.persona && (
                            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <User className="w-4 h-4 text-green-600" />
                                <h4 className="text-sm font-bold text-gray-900">Persona do Cliente</h4>
                                {config?.age && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{config.age} anos</span>
                                )}
                                {config?.temperament && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{config.temperament}</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {config.persona.cargo && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                                    <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Cargo</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{config.persona.cargo}</p>
                                  </div>
                                )}
                                {config.persona.profissao && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                                    <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Perfil</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{config.persona.profissao}</p>
                                  </div>
                                )}
                                {config.persona.tipo_empresa_faturamento && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                                    <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Empresa</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{config.persona.tipo_empresa_faturamento}</p>
                                  </div>
                                )}
                                {config.persona.perfil_socioeconomico && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                                    <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Perfil Socioeconômico</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{config.persona.perfil_socioeconomico}</p>
                                  </div>
                                )}
                                {config.persona.contexto && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-100 col-span-2">
                                    <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Contexto</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{config.persona.contexto}</p>
                                  </div>
                                )}
                                {config.persona.busca && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                                    <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">O que busca</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{config.persona.busca}</p>
                                  </div>
                                )}
                                {config.persona.dores && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                                    <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1">Dores</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{config.persona.dores}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Objective */}
                          {config?.objective && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Target className="w-4 h-4 text-green-600" />
                                <h4 className="text-sm font-bold text-gray-900">Objetivo</h4>
                              </div>
                              <p className="text-sm font-medium text-gray-900 mb-1">{config.objective.name}</p>
                              {config.objective.description && (
                                <p className="text-sm text-gray-600">{config.objective.description}</p>
                              )}
                            </div>
                          )}

                          {/* Objections with rebuttals */}
                          {config?.objections && config.objections.length > 0 && (
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                              <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <h4 className="text-sm font-bold text-gray-900">Objeções para Treinar</h4>
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{config.objections.length}</span>
                              </div>
                              <div className="space-y-2">
                                {config.objections.map((obj: any, idx: number) => (
                                  <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                    <div className="flex items-start gap-2 mb-1.5">
                                      <p className="text-xs font-medium text-gray-900 flex-1">{cleanGptText(obj.name)}</p>
                                      {obj.source && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                          obj.source === 'meeting' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                        }`}>
                                          {obj.source === 'meeting' ? 'Da reunião' : 'Coaching'}
                                        </span>
                                      )}
                                    </div>
                                    {obj.rebuttals && obj.rebuttals.length > 0 && (
                                      <div className="space-y-1 mt-2">
                                        <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Como quebrar:</p>
                                        {obj.rebuttals.map((r: string, ri: number) => (
                                          <p key={ri} className="text-[11px] text-green-700 flex items-start gap-1.5 bg-green-50 rounded px-2 py-1">
                                            <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                            {cleanGptText(r)}
                                          </p>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Coaching Focus - Full details */}
                          {coaching.length > 0 && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-amber-500" />
                                <h4 className="text-sm font-bold text-gray-900">Foco de Coaching</h4>
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                  {coaching.length} {coaching.length === 1 ? 'área' : 'áreas'}
                                </span>
                              </div>

                              {coaching.map((focus: any, idx: number) => {
                                const severityColors: Record<string, { border: string, badge: string, label: string, impact: string }> = {
                                  critical: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-700', label: 'Crítico', impact: 'bg-red-50 border-red-100' },
                                  high: { border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'Alto', impact: 'bg-amber-50 border-amber-100' },
                                  medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-700', label: 'Médio', impact: 'bg-yellow-50 border-yellow-100' }
                                }
                                const sev = severityColors[focus.severity as string] || severityColors.high
                                const phrases = focus.example_phrases || focus.tips || []
                                const diagnosisText = focus.diagnosis || focus.what_to_improve || ''

                                return (
                                  <div key={idx} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${sev.border} overflow-hidden`}>
                                    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                                      <div className="flex items-center gap-2">
                                        {focus.severity && (
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${sev.badge}`}>
                                            {sev.label}
                                          </span>
                                        )}
                                        <span className="text-sm font-bold text-gray-900">{focus.area}</span>
                                      </div>
                                      {focus.spin_score !== undefined && (
                                        <span className={`text-sm font-bold ${focus.spin_score < 4 ? 'text-red-600' : focus.spin_score < 6 ? 'text-amber-600' : 'text-yellow-600'}`}>
                                          {focus.spin_score.toFixed(1)}/10
                                        </span>
                                      )}
                                    </div>
                                    <div className="p-4 space-y-3">
                                      {diagnosisText && (
                                        <div>
                                          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Diagnóstico</p>
                                          <p className="text-sm text-gray-700 leading-relaxed">{cleanGptText(diagnosisText)}</p>
                                        </div>
                                      )}
                                      {focus.transcript_evidence && (
                                        <div className="bg-gray-50 rounded-lg p-3 border-l-[3px] border-l-gray-300 border border-gray-100">
                                          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Evidência da Reunião</p>
                                          <p className="text-xs text-gray-600 italic leading-relaxed">{cleanGptText(focus.transcript_evidence)}</p>
                                        </div>
                                      )}
                                      {focus.business_impact && (
                                        <div className={`rounded-lg p-3 border ${sev.impact}`}>
                                          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Por que importa</p>
                                          <p className="text-xs text-gray-700 leading-relaxed">{cleanGptText(focus.business_impact)}</p>
                                        </div>
                                      )}
                                      {focus.practice_goal && (
                                        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                          <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">O que praticar</p>
                                          <p className="text-xs text-green-800 leading-relaxed font-medium">{cleanGptText(focus.practice_goal)}</p>
                                        </div>
                                      )}
                                      {phrases.length > 0 && (
                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                          <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1.5">Frases para usar</p>
                                          <div className="space-y-1.5">
                                            {phrases.map((phrase: string, pi: number) => (
                                              <p key={pi} className="text-xs text-blue-800 flex items-start gap-1.5">
                                                <span className="text-blue-400 mt-0.5 flex-shrink-0">&ldquo;</span>
                                                <span className="leading-relaxed">{cleanGptText(phrase)}</span>
                                              </p>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* COMPLETED STATE: Full expanded details */}
                      {isCompleted && isExpanded && (
                        <div className="space-y-4 pt-2">
                          {/* Simulation Config */}
                          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Configuração da Simulação</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                              {config?.temperament && (
                                <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                                  <span className="text-[10px] text-purple-600 font-medium uppercase tracking-wider">Temperamento</span>
                                  <span className="text-gray-900 font-semibold block">{config.temperament}</span>
                                </div>
                              )}
                              {config?.age && (
                                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                                  <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Idade</span>
                                  <span className="text-gray-900 font-semibold block">{config.age} anos</span>
                                </div>
                              )}
                              {config?.objective && (
                                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                  <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Objetivo</span>
                                  <span className="text-gray-900 font-medium text-sm leading-snug block">{config.objective.name}</span>
                                </div>
                              )}
                            </div>

                            {/* Persona */}
                            {config?.persona && (
                              <div className="space-y-2">
                                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Persona</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {config.persona.cargo && (
                                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Cargo</p>
                                      <p className="text-xs text-gray-700 leading-relaxed">{config.persona.cargo}</p>
                                    </div>
                                  )}
                                  {config.persona.profissao && (
                                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Perfil</p>
                                      <p className="text-xs text-gray-700 leading-relaxed">{config.persona.profissao}</p>
                                    </div>
                                  )}
                                  {config.persona.tipo_empresa_faturamento && (
                                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Empresa</p>
                                      <p className="text-xs text-gray-700 leading-relaxed">{config.persona.tipo_empresa_faturamento}</p>
                                    </div>
                                  )}
                                  {config.persona.contexto && (
                                    <div className="bg-white rounded-lg p-3 border border-gray-100 col-span-2">
                                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Contexto</p>
                                      <p className="text-xs text-gray-700 leading-relaxed">{config.persona.contexto}</p>
                                    </div>
                                  )}
                                  {config.persona.busca && (
                                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                                      <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">O que busca</p>
                                      <p className="text-xs text-gray-700 leading-relaxed">{config.persona.busca}</p>
                                    </div>
                                  )}
                                  {config.persona.dores && (
                                    <div className="bg-white rounded-lg p-3 border border-gray-100">
                                      <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1">Dores</p>
                                      <p className="text-xs text-gray-700 leading-relaxed">{config.persona.dores}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Objections */}
                            {config?.objections && config.objections.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Objeções ({config.objections.length})</p>
                                <div className="space-y-2">
                                  {config.objections.map((obj: any, idx: number) => (
                                    <div key={idx} className="bg-white rounded-lg p-3 border border-gray-100">
                                      <p className="text-xs font-medium text-gray-900">{cleanGptText(obj.name)}</p>
                                      {obj.rebuttals && obj.rebuttals.length > 0 && (
                                        <div className="mt-1.5 space-y-1">
                                          {obj.rebuttals.map((r: string, ri: number) => (
                                            <p key={ri} className="text-[11px] text-green-700 flex items-start gap-1.5">
                                              <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                              {cleanGptText(r)}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Before/After SPIN comparison */}
                          {coaching.length > 0 && corrEval?.spin_evaluation && (
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                              <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                                <h4 className="text-sm font-semibold text-gray-900">Comparação Antes / Depois</h4>
                              </div>
                              <div className="space-y-3">
                                {coaching.map((c: any, idx: number) => {
                                  if (c.spin_score === undefined || c.spin_score === null) return null
                                  const letter = mapAreaToSpinLetter(c.area)
                                  const newScore = letter && corrEval.spin_evaluation[letter]?.final_score !== undefined
                                    ? corrEval.spin_evaluation[letter].final_score
                                    : null
                                  const delta = newScore !== null ? newScore - c.spin_score : null
                                  const deltaBg = delta !== null
                                    ? delta > 0 ? 'bg-green-100 text-green-700' : delta < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                    : 'bg-gray-100 text-gray-500'

                                  return (
                                    <div key={idx} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-gray-900">{c.area}</span>
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${deltaBg}`}>
                                          {delta !== null ? (delta > 0 ? `+${delta.toFixed(1)}` : delta < 0 ? delta.toFixed(1) : '=') : '--'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500">Reunião:</span>
                                        <span className={`font-semibold ${getScoreColor(c.spin_score)}`}>{c.spin_score.toFixed(1)}</span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-gray-500">Roleplay:</span>
                                        {newScore !== null ? (
                                          <span className={`font-semibold ${getScoreColor(newScore)}`}>{newScore.toFixed(1)}</span>
                                        ) : (
                                          <span className="text-gray-400 text-xs">sem avaliação</span>
                                        )}
                                      </div>
                                      {c.practice_goal && (
                                        <p className="text-xs text-gray-500 leading-relaxed mt-2">{cleanGptText(c.practice_goal)}</p>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Meet correction AI observations */}
                          {corrEval?.meet_correction && (
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                              <div className="flex items-center gap-2 mb-4">
                                <AlertCircle className="w-5 h-5 text-blue-600" />
                                <h4 className="text-sm font-semibold text-gray-900">Observações da IA</h4>
                              </div>
                              {corrEval.meet_correction.overall_feedback && (
                                <p className="text-sm text-gray-700 leading-relaxed mb-4">{cleanGptText(corrEval.meet_correction.overall_feedback)}</p>
                              )}
                              {corrEval.meet_correction.areas?.length > 0 && (
                                <div className="space-y-3">
                                  {corrEval.meet_correction.areas.map((area: any, idx: number) => {
                                    const borderColor = area.corrected ? 'border-green-200' : area.partially_corrected ? 'border-amber-200' : 'border-red-200'
                                    const bgColor = area.corrected ? 'bg-green-50' : area.partially_corrected ? 'bg-amber-50' : 'bg-red-50'
                                    const statusLabel = area.corrected ? 'Corrigido' : area.partially_corrected ? 'Parcialmente' : 'Não Corrigido'
                                    const statusBadge = area.corrected ? 'bg-green-100 text-green-700' : area.partially_corrected ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

                                    return (
                                      <div key={idx} className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-sm font-semibold text-gray-900">{area.area}</span>
                                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge}`}>{statusLabel}</span>
                                        </div>
                                        {area.what_seller_did && (
                                          <p className="text-sm text-gray-700 leading-relaxed">{cleanGptText(area.what_seller_did)}</p>
                                        )}
                                        {area.what_still_needs_work && (
                                          <p className="text-xs text-gray-500 leading-relaxed mt-2">
                                            <span className="font-medium text-gray-600">Ainda precisa melhorar: </span>
                                            {cleanGptText(area.what_still_needs_work)}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Executive Summary */}
                          {corrEval?.executive_summary && (
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Resumo Executivo</h4>
                              <p className="text-gray-700 text-sm leading-relaxed">{cleanGptText(corrEval.executive_summary)}</p>
                            </div>
                          )}

                          {/* SPIN Scores */}
                          {corrEval?.spin_evaluation && (
                            <div>
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Scores SPIN da Correção</h4>
                              <div className="grid grid-cols-4 gap-3 mb-4">
                                {[
                                  { letter: 'S', label: 'Situação' },
                                  { letter: 'P', label: 'Problema' },
                                  { letter: 'I', label: 'Implicação' },
                                  { letter: 'N', label: 'Necessidade' },
                                ].map(({ letter, label }) => {
                                  const spinScore = corrEval.spin_evaluation[letter]?.final_score
                                  return (
                                    <div key={letter} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                                      <div className={`text-3xl font-bold mb-1 ${
                                        spinScore !== null && spinScore !== undefined && spinScore >= 7 ? 'text-green-600' :
                                        spinScore !== null && spinScore !== undefined && spinScore >= 5 ? 'text-yellow-600' :
                                        spinScore !== null && spinScore !== undefined ? 'text-red-600' : 'text-gray-400'
                                      }`}>
                                        {spinScore !== null && spinScore !== undefined ? spinScore.toFixed(1) : '--'}
                                      </div>
                                      <div className="text-xs font-medium text-gray-500">{label}</div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* SPIN Detailed breakdown */}
                              <div className="grid grid-cols-2 gap-4">
                                {['S', 'P', 'I', 'N'].map((letter) => {
                                  const spinDetail = corrEval.spin_evaluation[letter]
                                  if (!spinDetail) return null
                                  const spinScore = spinDetail.final_score || 0
                                  const labels: Record<string, string> = { 'S': 'Situação', 'P': 'Problema', 'I': 'Implicação', 'N': 'Necessidade' }

                                  return (
                                    <div key={letter} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm ${
                                          spinScore >= 7 ? 'bg-green-500' : spinScore >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}>
                                          {letter}
                                        </div>
                                        <div>
                                          <div className="text-sm font-semibold text-gray-900">{labels[letter]}</div>
                                          <div className={`text-xs font-medium ${spinScore >= 7 ? 'text-green-600' : spinScore >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {spinScore.toFixed(1)}/10
                                          </div>
                                        </div>
                                      </div>

                                      {spinDetail.indicators && Object.keys(spinDetail.indicators).length > 0 && (
                                        <div className="space-y-2 mb-3">
                                          {Object.entries(spinDetail.indicators).map(([key, value]: [string, any]) => (
                                            <div key={key}>
                                              <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-xs text-gray-600">{translateIndicator(key)}</span>
                                                <span className={`text-xs font-semibold ${
                                                  Number(value) >= 7 ? 'text-green-600' : Number(value) >= 5 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>{value}/10</span>
                                              </div>
                                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full transition-all ${
                                                    Number(value) >= 7 ? 'bg-green-500' : Number(value) >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                                                  }`}
                                                  style={{ width: `${(Number(value) / 10) * 100}%` }}
                                                />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {spinDetail.technical_feedback && (
                                        <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-200 pt-3 mb-3">
                                          {cleanGptText(spinDetail.technical_feedback)}
                                        </p>
                                      )}

                                      {spinDetail.missed_opportunities?.length > 0 && (
                                        <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                                          <p className="text-[11px] font-semibold text-orange-700 mb-1.5">Oportunidades perdidas</p>
                                          <ul className="space-y-1">
                                            {spinDetail.missed_opportunities.map((opp: string, idx: number) => (
                                              <li key={idx} className="text-xs text-gray-700 flex items-start gap-1.5">
                                                <span className="text-orange-400 mt-0.5 flex-shrink-0">•</span>
                                                {cleanGptText(opp)}
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

                          {/* Strengths & Gaps */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {corrEval?.top_strengths?.length > 0 && (
                              <div className="bg-green-50 rounded-xl border border-green-100 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <h4 className="text-sm font-semibold text-green-700">Pontos Fortes</h4>
                                </div>
                                <ul className="space-y-1.5">
                                  {corrEval.top_strengths.map((s: string, i: number) => (
                                    <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                      <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                                      {cleanGptText(s)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {corrEval?.critical_gaps?.length > 0 && (
                              <div className="bg-red-50 rounded-xl border border-red-100 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <AlertCircle className="w-4 h-4 text-red-600" />
                                  <h4 className="text-sm font-semibold text-red-700">Pontos a Melhorar</h4>
                                </div>
                                <ul className="space-y-1.5">
                                  {corrEval.critical_gaps.map((g: string, i: number) => (
                                    <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                      <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                                      {cleanGptText(g)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Priority Improvements */}
                          {corrEval?.priority_improvements?.length > 0 && (
                            <div className="bg-purple-50 rounded-xl border border-purple-100 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Lightbulb className="w-4 h-4 text-purple-600" />
                                <h4 className="text-sm font-semibold text-purple-700">Melhorias Prioritárias</h4>
                              </div>
                              <div className="space-y-2">
                                {corrEval.priority_improvements.map((imp: any, i: number) => (
                                  <div key={i} className="bg-white/50 rounded-lg border border-purple-100 p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                      {imp.priority && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                          imp.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                          imp.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                          'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {imp.priority === 'critical' ? 'Crítico' : imp.priority === 'high' ? 'Alta' : 'Média'}
                                        </span>
                                      )}
                                      <span className="text-sm font-semibold text-gray-900">{imp.area || imp}</span>
                                    </div>
                                    {imp.action_plan && (
                                      <p className="text-xs text-gray-600 leading-relaxed">{cleanGptText(imp.action_plan)}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Transcription */}
                          {corrSession?.messages?.length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                                Transcrição ({corrSession.messages.length} mensagens)
                              </h4>
                              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                {corrSession.messages.map((msg: any, index: number) => (
                                  <div
                                    key={index}
                                    className={`flex gap-3 ${msg.role === 'seller' ? 'flex-row-reverse' : ''}`}
                                  >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      msg.role === 'client' ? 'bg-gray-200' : 'bg-green-100'
                                    }`}>
                                      <User className={`w-3.5 h-3.5 ${msg.role === 'client' ? 'text-gray-600' : 'text-green-600'}`} />
                                    </div>
                                    <div className={`flex-1 max-w-[80%] ${msg.role === 'seller' ? 'text-right' : ''}`}>
                                      <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1.5">
                                        <span className={`font-medium ${msg.role === 'client' ? 'text-gray-600' : 'text-green-600'}`}>
                                          {msg.role === 'client' ? 'Cliente' : 'Você'}
                                        </span>
                                      </div>
                                      <div className={`inline-block p-3 rounded-2xl text-xs leading-relaxed ${
                                        msg.role === 'client'
                                          ? 'bg-gray-100 text-gray-700 rounded-tl-sm'
                                          : 'bg-green-50 text-gray-700 border border-green-100 rounded-tr-sm'
                                      }`}>
                                        {msg.text}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <Video className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Selecione uma avaliação para ver os detalhes</p>
          </div>
        )}
      </div>
    </div>
  )
}
