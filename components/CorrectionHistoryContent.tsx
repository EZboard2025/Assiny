'use client'

import { useState, useEffect } from 'react'
import { Target, TrendingUp, CheckCircle, AlertCircle, Clock, Calendar, MessageCircle, ChevronUp, ChevronDown, Video, History, User, Lightbulb, AlertTriangle } from 'lucide-react'
import { getMeetCorrectionSessions, type RoleplaySession } from '@/lib/roleplay'

const stripMarkdown = (text: string): string => {
  if (!text) return ''
  return text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/—/g, '-')
}

const mapAreaToSpinLetter = (area: string): string | null => {
  const n = area.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (n.includes('situac')) return 'S'
  if (n.includes('problema')) return 'P'
  if (n.includes('implicac')) return 'I'
  if (n.includes('necessidade') || n.includes('need')) return 'N'
  return null
}

const getProcessedEvaluation = (session: RoleplaySession) => {
  let evaluation = (session as any).evaluation
  if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
    try {
      evaluation = JSON.parse(evaluation.output)
    } catch (e) {
      return null
    }
  }
  return evaluation
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

const formatDuration = (seconds?: number) => {
  if (!seconds) return null
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}min ${secs}s`
}

const getScoreColor = (score: number) => {
  if (score >= 8) return 'text-green-600'
  if (score >= 6) return 'text-yellow-600'
  if (score >= 4) return 'text-orange-600'
  return 'text-red-600'
}

const getScoreBg = (score: number) => {
  if (score >= 8) return 'bg-green-50'
  if (score >= 6) return 'bg-blue-50'
  if (score >= 4) return 'bg-yellow-50'
  return 'bg-red-50'
}

const getSeverityColor = (severity?: string) => {
  if (severity === 'critical') return 'bg-red-500'
  if (severity === 'high') return 'bg-amber-500'
  return 'bg-yellow-400'
}

const getSeverityTextColor = (severity?: string) => {
  if (severity === 'critical') return 'text-red-600'
  if (severity === 'high') return 'text-amber-600'
  return 'text-yellow-600'
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

const translateIndicator = (key: string): string => {
  if (indicatorLabels[key]) return indicatorLabels[key]
  return key
    .replace(/_score$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
}

export default function CorrectionHistoryContent() {
  const [sessions, setSessions] = useState<RoleplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    const data = await getMeetCorrectionSessions(50)
    setSessions(data)
    if (data.length > 0) {
      setSelectedSession(data[0])
    }
    setLoading(false)
  }

  const renderBeforeAfterComparison = (session: RoleplaySession) => {
    const evaluation = getProcessedEvaluation(session)
    const coachingFocus = session.config.meet_simulation_config?.coaching_focus || []

    const comparisons: Array<{
      area: string
      oldScore: number
      newScore: number | null
      delta: number | null
      practiceGoal?: string
      severity?: string
    }> = []

    for (const focus of coachingFocus) {
      if (focus.spin_score === undefined || focus.spin_score === null) continue

      const letter = mapAreaToSpinLetter(focus.area)
      let newScore: number | null = null

      if (letter && evaluation?.spin_evaluation?.[letter]?.final_score !== undefined) {
        newScore = evaluation.spin_evaluation[letter].final_score
      }

      const delta = newScore !== null ? newScore - focus.spin_score : null

      comparisons.push({
        area: focus.area,
        oldScore: focus.spin_score,
        newScore,
        delta,
        practiceGoal: focus.practice_goal,
        severity: focus.severity
      })
    }

    if (comparisons.length === 0) return null

    const improved = comparisons.filter(c => c.delta !== null && c.delta > 0).length

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <h4 className="text-sm font-semibold text-gray-900">Comparacao Antes / Depois</h4>
        </div>

        <div className="space-y-3">
          {comparisons.map((comp, idx) => {
            const deltaLabel = comp.delta !== null
              ? comp.delta > 0
                ? `+${comp.delta.toFixed(1)}`
                : comp.delta < 0
                  ? comp.delta.toFixed(1)
                  : '='
              : '--'

            const deltaBg = comp.delta !== null
              ? comp.delta > 0
                ? 'bg-green-100 text-green-700'
                : comp.delta < 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
              : 'bg-gray-100 text-gray-500'

            return (
              <div key={idx} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{comp.area}</span>
                    {comp.severity && (
                      <span className={`w-2 h-2 rounded-full ${getSeverityColor(comp.severity)}`} />
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${deltaBg}`}>
                    {deltaLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm mb-2">
                  <span className="text-gray-500">Reuniao:</span>
                  <span className={`font-semibold ${getScoreColor(comp.oldScore)}`}>
                    {comp.oldScore.toFixed(1)}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="text-gray-500">Roleplay:</span>
                  {comp.newScore !== null ? (
                    <span className={`font-semibold ${getScoreColor(comp.newScore)}`}>
                      {comp.newScore.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">sem avaliacao</span>
                  )}
                </div>

                {comp.practiceGoal && (
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {stripMarkdown(comp.practiceGoal)}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-green-600">Melhorou em {improved} de {comparisons.length} areas</span>
          </p>
        </div>
      </div>
    )
  }

  const renderMeetCorrectionObservation = (session: RoleplaySession) => {
    const evaluation = getProcessedEvaluation(session)
    const meetCorrection = evaluation?.meet_correction

    if (!meetCorrection) return null

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">Observacoes da IA</h4>
        </div>

        {meetCorrection.overall_feedback && (
          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            {stripMarkdown(meetCorrection.overall_feedback)}
          </p>
        )}

        {meetCorrection.areas && meetCorrection.areas.length > 0 && (
          <div className="space-y-3">
            {meetCorrection.areas.map((area: any, idx: number) => {
              const isCorrected = area.corrected
              const isPartial = area.partially_corrected

              const borderColor = isCorrected
                ? 'border-green-200'
                : isPartial
                  ? 'border-amber-200'
                  : 'border-red-200'

              const bgColor = isCorrected
                ? 'bg-green-50'
                : isPartial
                  ? 'bg-amber-50'
                  : 'bg-red-50'

              const statusLabel = isCorrected
                ? 'Corrigido'
                : isPartial
                  ? 'Parcialmente Corrigido'
                  : 'Nao Corrigido'

              const statusBadgeBg = isCorrected
                ? 'bg-green-100 text-green-700'
                : isPartial
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-red-100 text-red-700'

              return (
                <div key={idx} className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900">{area.area}</span>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadgeBg}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {area.what_seller_did && (
                    <p className="text-sm text-gray-700 leading-relaxed mb-1">
                      {stripMarkdown(area.what_seller_did)}
                    </p>
                  )}

                  {area.what_still_needs_work && (
                    <p className="text-xs text-gray-500 leading-relaxed mt-2">
                      <span className="font-medium text-gray-600">Ainda precisa melhorar: </span>
                      {stripMarkdown(area.what_still_needs_work)}
                    </p>
                  )}

                  {area.key_moment && (
                    <p className="text-xs text-blue-600 leading-relaxed mt-2 italic">
                      {stripMarkdown(area.key_moment)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderTranscription = (session: RoleplaySession) => {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          {session.messages.length} mensagens
        </h4>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {session.messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3 ${msg.role === 'seller' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'client'
                  ? 'bg-gray-200'
                  : 'bg-green-100'
              }`}>
                <User className={`w-4 h-4 ${
                  msg.role === 'client' ? 'text-gray-600' : 'text-green-600'
                }`} />
              </div>
              <div className={`flex-1 max-w-[80%] ${msg.role === 'seller' ? 'text-right' : ''}`}>
                <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-2">
                  <span className={`font-medium ${msg.role === 'client' ? 'text-gray-600' : 'text-green-600'}`}>
                    {msg.role === 'client' ? (session.config.client_name || 'Cliente') : 'Voce'}
                  </span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
                <div className={`inline-block p-4 rounded-2xl text-sm leading-relaxed ${
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
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-green-100 border-t-green-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
          <Video className="w-10 h-10 text-gray-400" />
        </div>
        <p className="text-gray-900 font-semibold text-lg mb-2">Nenhuma sessão de prática direcionada encontrada</p>
        <p className="text-gray-500 text-sm">Analise uma reunião Meet e gere uma prática direcionada.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left column - Session list */}
      <div className="lg:col-span-4 xl:col-span-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {sessions.length} Correcoes
            </h2>
          </div>
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            {sessions.map((session) => {
              const evaluation = getProcessedEvaluation(session)
              const score = evaluation?.overall_score !== undefined
                ? (evaluation.overall_score > 10 ? evaluation.overall_score / 10 : evaluation.overall_score)
                : null
              const coachingFocus = session.config.meet_simulation_config?.coaching_focus || []

              return (
                <button
                  key={session.id}
                  onClick={() => {
                    setSelectedSession(session)
                    setExpandedSection(null)
                  }}
                  className={`w-full text-left p-4 border-b border-gray-100 transition-all ${
                    selectedSession?.id === session.id
                      ? 'bg-green-50 border-l-4 border-l-green-500'
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Score badge */}
                    {score !== null ? (
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getScoreBg(score)}`}>
                        <span className={`text-lg font-bold ${getScoreColor(score)}`}>
                          {score.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-gray-400 font-medium">--</span>
                      </div>
                    )}

                    {/* Session info */}
                    <div className="flex-1 min-w-0">
                      {session.config.client_name && (
                        <div className="text-sm font-medium text-gray-900 mb-0.5 truncate">
                          {session.config.client_name}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatDate(session.created_at)}</span>
                        <span className="text-gray-300">•</span>
                        <span>{formatTime(session.created_at)}</span>
                      </div>

                      {/* Coaching area dots */}
                      {coachingFocus.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {coachingFocus.slice(0, 4).map((focus: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className={`w-2 h-2 rounded-full ${getSeverityColor(focus.severity)}`} />
                              <span className="text-[10px] text-gray-400 truncate max-w-[60px]">
                                {mapAreaToSpinLetter(focus.area) || focus.area.slice(0, 4)}
                              </span>
                            </div>
                          ))}
                          {coachingFocus.length > 4 && (
                            <span className="text-[10px] text-gray-400">+{coachingFocus.length - 4}</span>
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

      {/* Right column - Detail */}
      <div className="lg:col-span-8 xl:col-span-9">
        {!selectedSession ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">Selecione uma sessao para ver os detalhes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Session header */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Video className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Correcao de Reuniao</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(selectedSession.created_at)}</span>
                      <span>{formatTime(selectedSession.created_at)}</span>
                    </div>
                  </div>
                </div>
                {selectedSession.duration_seconds && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-sm text-green-700 font-medium">
                      {formatDuration(selectedSession.duration_seconds)}
                    </span>
                  </div>
                )}
              </div>

              {/* Meeting context */}
              {selectedSession.config.meet_simulation_config?.meeting_context && (
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 mb-3">
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Contexto da Reuniao</span>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                    {stripMarkdown(selectedSession.config.meet_simulation_config.meeting_context)}
                  </p>
                </div>
              )}

              {/* Config cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                  <span className="text-[10px] text-purple-600 font-medium uppercase tracking-wider">Temperamento</span>
                  <span className="text-gray-900 font-semibold block">{selectedSession.config.temperament}</span>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Idade</span>
                  <span className="text-gray-900 font-semibold block">{selectedSession.config.age} anos</span>
                </div>
                {selectedSession.config.meet_simulation_config?.objective && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Objetivo</span>
                    <span className="text-gray-900 font-medium text-sm leading-snug block">
                      {selectedSession.config.meet_simulation_config.objective.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Collapsible detail cards */}
            {(() => {
              const evaluation = getProcessedEvaluation(selectedSession)
              const score = evaluation?.overall_score !== undefined
                ? (evaluation.overall_score > 10 ? evaluation.overall_score / 10 : evaluation.overall_score)
                : null
              const spin = evaluation?.spin_evaluation

              const hasComparison = (selectedSession.config.meet_simulation_config?.coaching_focus || []).some(
                (f: any) => f.spin_score !== undefined && f.spin_score !== null
              )
              const hasObservation = !!evaluation?.meet_correction
              const hasObjections = evaluation?.objections_analysis?.length > 0
              const hasInsights = evaluation?.top_strengths?.length > 0 || evaluation?.critical_gaps?.length > 0 || evaluation?.priority_improvements?.length > 0

              return (
                <div className="space-y-3">
                  {/* Card: Avaliacao */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'avaliacao' ? null : 'avaliacao')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-gray-900">Avaliacao</h3>
                          <p className="text-xs text-gray-500">
                            {score !== null
                              ? `${score.toFixed(1)}/10 - ${
                                  evaluation?.performance_level === 'legendary' ? 'Lendario' :
                                  evaluation?.performance_level === 'excellent' ? 'Excelente' :
                                  evaluation?.performance_level === 'very_good' ? 'Muito Bom' :
                                  evaluation?.performance_level === 'good' ? 'Bom' :
                                  evaluation?.performance_level === 'needs_improvement' ? 'Precisa Melhorar' :
                                  evaluation?.performance_level === 'poor' ? 'Em Desenvolvimento' :
                                  evaluation?.performance_level || ''
                                }`
                              : 'Sem avaliacao'}
                          </p>
                        </div>
                      </div>
                      {expandedSection === 'avaliacao' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSection === 'avaliacao' && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                        {!evaluation ? (
                          <div className="text-center py-6">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                              <AlertCircle className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500">Esta sessao nao possui avaliacao</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Score card */}
                            {(() => {
                              const scoreBgGradient = score !== null
                                ? score >= 8
                                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                                  : score >= 6
                                    ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'
                                    : score >= 4
                                      ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
                                      : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
                                : 'bg-gray-50 border-gray-200'
                              return (
                                <div className={`rounded-2xl border p-6 text-center ${scoreBgGradient}`}>
                                  <div className={`text-5xl font-bold mb-1 ${score !== null ? getScoreColor(score) : 'text-gray-400'}`}>
                                    {score !== null ? score.toFixed(1) : 'N/A'}
                                  </div>
                                  {evaluation.performance_level && (
                                    <div className={`text-sm font-medium ${score !== null ? getScoreColor(score) : 'text-gray-400'} opacity-80`}>
                                      {evaluation.performance_level === 'legendary' ? 'Lendario' :
                                       evaluation.performance_level === 'excellent' ? 'Excelente' :
                                       evaluation.performance_level === 'very_good' ? 'Muito Bom' :
                                       evaluation.performance_level === 'good' ? 'Bom' :
                                       evaluation.performance_level === 'needs_improvement' ? 'Precisa Melhorar' :
                                       evaluation.performance_level === 'poor' ? 'Em Desenvolvimento' :
                                       evaluation.performance_level}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}

                            {/* Executive summary */}
                            {evaluation.executive_summary && (
                              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                  Resumo Executivo
                                </h4>
                                <p className="text-gray-700 text-sm leading-relaxed">
                                  {stripMarkdown(evaluation.executive_summary)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card: Comparacao Antes/Depois */}
                  {hasComparison && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === 'comparacao' ? null : 'comparacao')}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-sm font-semibold text-gray-900">Comparacao Antes/Depois</h3>
                            <p className="text-xs text-gray-500">Evolucao das areas de foco</p>
                          </div>
                        </div>
                        {expandedSection === 'comparacao' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </button>
                      {expandedSection === 'comparacao' && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                          {renderBeforeAfterComparison(selectedSession)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card: Observacoes da Correcao */}
                  {hasObservation && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === 'observacoes' ? null : 'observacoes')}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-sm font-semibold text-gray-900">Observacoes da Correcao</h3>
                            <p className="text-xs text-gray-500">Analise da IA sobre a pratica</p>
                          </div>
                        </div>
                        {expandedSection === 'observacoes' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </button>
                      {expandedSection === 'observacoes' && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                          {renderMeetCorrectionObservation(selectedSession)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card: Analise SPIN */}
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
                          <h3 className="text-sm font-semibold text-gray-900">Analise SPIN</h3>
                          <p className="text-xs text-gray-500">
                            {spin
                              ? `S: ${spin.S?.final_score !== undefined ? spin.S.final_score.toFixed(1) : '--'} | P: ${spin.P?.final_score !== undefined ? spin.P.final_score.toFixed(1) : '--'} | I: ${spin.I?.final_score !== undefined ? spin.I.final_score.toFixed(1) : '--'} | N: ${spin.N?.final_score !== undefined ? spin.N.final_score.toFixed(1) : '--'}`
                              : 'Sem analise SPIN'}
                          </p>
                        </div>
                      </div>
                      {expandedSection === 'spin' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSection === 'spin' && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                        {spin ? (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Scores SPIN</h4>
                            <div className="grid grid-cols-4 gap-3 mb-4">
                              {[
                                { letter: 'S', label: 'Situacao' },
                                { letter: 'P', label: 'Problema' },
                                { letter: 'I', label: 'Implicacao' },
                                { letter: 'N', label: 'Necessidade' },
                              ].map(({ letter, label }) => {
                                const spinScore = spin[letter]?.final_score
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

                            {/* SPIN Detailed breakdown - 2 columns */}
                            <div className="grid grid-cols-2 gap-4">
                              {['S', 'P', 'I', 'N'].map((letter) => {
                                const spinDetail = spin[letter]
                                if (!spinDetail) return null
                                const spinScore = spinDetail.final_score || 0
                                const labels: Record<string, string> = { 'S': 'Situacao', 'P': 'Problema', 'I': 'Implicacao', 'N': 'Necessidade' }

                                return (
                                  <div key={letter} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <div className="flex items-center gap-3 mb-3">
                                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm ${
                                        spinScore >= 7 ? 'bg-green-500' :
                                        spinScore >= 5 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`}>
                                        {letter}
                                      </div>
                                      <div>
                                        <div className="text-sm font-semibold text-gray-900">{labels[letter]}</div>
                                        <div className={`text-xs font-medium ${
                                          spinScore >= 7 ? 'text-green-600' :
                                          spinScore >= 5 ? 'text-yellow-600' :
                                          'text-red-600'
                                        }`}>
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
                                        ))}
                                      </div>
                                    )}

                                    {spinDetail.technical_feedback && (
                                      <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-200 pt-3 mb-3">
                                        {stripMarkdown(spinDetail.technical_feedback)}
                                      </p>
                                    )}

                                    {spinDetail.missed_opportunities?.length > 0 && (
                                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                                        <p className="text-[11px] font-semibold text-orange-700 mb-1.5">Oportunidades perdidas</p>
                                        <ul className="space-y-1">
                                          {spinDetail.missed_opportunities.map((opp: string, idx: number) => (
                                            <li key={idx} className="text-xs text-gray-700 flex items-start gap-1.5">
                                              <span className="text-orange-400 mt-0.5 flex-shrink-0">•</span>
                                              {stripMarkdown(opp)}
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
                        ) : (
                          <p className="text-gray-500 text-sm text-center py-4">Sem analise SPIN disponivel</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card: Objecoes */}
                  {hasObjections && (
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
                            <h3 className="text-sm font-semibold text-gray-900">Objecoes</h3>
                            <p className="text-xs text-gray-500">{evaluation.objections_analysis.length} objecoes analisadas</p>
                          </div>
                        </div>
                        {expandedSection === 'objecoes' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </button>
                      {expandedSection === 'objecoes' && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                          <div className="space-y-4">
                            {evaluation.objections_analysis.map((obj: any, idx: number) => (
                              <div key={idx} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                                        obj.objection_type === 'preco' || obj.objection_type === 'preco' ? 'bg-red-100 text-red-700' :
                                        obj.objection_type === 'timing' ? 'bg-blue-100 text-blue-700' :
                                        obj.objection_type === 'autoridade' ? 'bg-purple-100 text-purple-700' :
                                        obj.objection_type === 'concorrencia' || obj.objection_type === 'concorrencia' ? 'bg-orange-100 text-orange-700' :
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
                                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{stripMarkdown(obj.detailed_analysis)}</p>
                                )}

                                {obj.critical_errors && obj.critical_errors.length > 0 && (
                                  <div className="mb-3">
                                    <p className="text-xs font-semibold text-red-600 mb-1.5">Erros criticos:</p>
                                    <ul className="space-y-1">
                                      {obj.critical_errors.map((err: string, i: number) => (
                                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                          <span className="text-red-400 mt-1">•</span>
                                          {stripMarkdown(err)}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {obj.ideal_response && (
                                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                    <p className="text-xs font-semibold text-green-700 mb-1">Resposta ideal:</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{stripMarkdown(obj.ideal_response)}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card: Pontos Fortes & Melhorias */}
                  {hasInsights && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === 'insights' ? null : 'insights')}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-sm font-semibold text-gray-900">Pontos Fortes & Melhorias</h3>
                            <p className="text-xs text-gray-500">
                              {[
                                evaluation?.top_strengths?.length ? `${evaluation.top_strengths.length} pontos fortes` : null,
                                evaluation?.critical_gaps?.length ? `${evaluation.critical_gaps.length} gaps` : null,
                                evaluation?.priority_improvements?.length ? `${evaluation.priority_improvements.length} melhorias` : null,
                              ].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </div>
                        {expandedSection === 'insights' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </button>
                      {expandedSection === 'insights' && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                          {/* Strengths & gaps */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {evaluation?.top_strengths?.length > 0 && (
                              <div className="bg-green-50 rounded-2xl border border-green-100 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                  <h4 className="text-sm font-semibold text-green-700">Pontos Fortes</h4>
                                </div>
                                <ul className="space-y-2">
                                  {evaluation.top_strengths.map((strength: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                      <span className="text-green-500 mt-1 flex-shrink-0">•</span>
                                      {stripMarkdown(strength)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {evaluation?.critical_gaps?.length > 0 && (
                              <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                  <AlertCircle className="w-5 h-5 text-red-600" />
                                  <h4 className="text-sm font-semibold text-red-700">Pontos a Melhorar</h4>
                                </div>
                                <ul className="space-y-2">
                                  {evaluation.critical_gaps.map((gap: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                      <span className="text-red-500 mt-1 flex-shrink-0">•</span>
                                      {stripMarkdown(gap)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Priority Improvements */}
                          {evaluation?.priority_improvements?.length > 0 && (
                            <div className="bg-purple-50 rounded-2xl border border-purple-100 p-5">
                              <div className="flex items-center gap-2 mb-4">
                                <Lightbulb className="w-5 h-5 text-purple-600" />
                                <h4 className="text-sm font-semibold text-purple-700">Melhorias Prioritarias</h4>
                              </div>
                              <div className="space-y-3">
                                {evaluation.priority_improvements.map((imp: any, i: number) => (
                                  <div key={i} className="bg-white/50 rounded-xl border border-purple-100 p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      {imp.priority && (
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                          imp.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                          imp.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                          'bg-yellow-100 text-yellow-700'
                                        }`}>
                                          {imp.priority === 'critical' ? 'Critico' :
                                           imp.priority === 'high' ? 'Alta' : 'Media'}
                                        </span>
                                      )}
                                      <span className="text-sm font-semibold text-gray-900">{imp.area || imp}</span>
                                    </div>
                                    {imp.action_plan && (
                                      <p className="text-sm text-gray-600">{stripMarkdown(imp.action_plan)}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card: Transcricao */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'transcricao' ? null : 'transcricao')}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                          <MessageCircle className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-semibold text-gray-900">Transcricao</h3>
                          <p className="text-xs text-gray-500">Transcricao da sessao</p>
                        </div>
                      </div>
                      {expandedSection === 'transcricao' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSection === 'transcricao' && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                        {renderTranscription(selectedSession)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
