'use client'

import { useState, useEffect } from 'react'
import { Target, TrendingUp, CheckCircle, AlertCircle, Clock, Calendar, MessageCircle, ChevronUp, ChevronDown, Video, History, User } from 'lucide-react'
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

export default function CorrectionHistoryContent() {
  const [sessions, setSessions] = useState<RoleplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null)
  const [activeTab, setActiveTab] = useState<'resumo' | 'transcricao'>('resumo')

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
        <p className="text-gray-900 font-semibold text-lg mb-2">Nenhuma sessao de correcao encontrada</p>
        <p className="text-gray-500 text-sm">Analise uma reuniao Meet e gere uma simulacao de correcao.</p>
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
                    setActiveTab('resumo')
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

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('resumo')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'resumo'
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                Resumo
              </button>
              <button
                onClick={() => setActiveTab('transcricao')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'transcricao'
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
              >
                Transcricao
              </button>
            </div>

            {/* Tab content */}
            {activeTab === 'resumo' ? (
              <div className="space-y-4">
                {/* Overall score */}
                {(() => {
                  const evaluation = getProcessedEvaluation(selectedSession)
                  if (!evaluation) {
                    return (
                      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                          <AlertCircle className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500">Esta sessao nao possui avaliacao</p>
                      </div>
                    )
                  }

                  const score = evaluation.overall_score !== undefined
                    ? (evaluation.overall_score > 10 ? evaluation.overall_score / 10 : evaluation.overall_score)
                    : null

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
                    <>
                      {/* Score card */}
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

                      {/* Before/After comparison */}
                      {renderBeforeAfterComparison(selectedSession)}

                      {/* Meet correction observations */}
                      {renderMeetCorrectionObservation(selectedSession)}

                      {/* Strengths & gaps */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {evaluation.top_strengths?.length > 0 && (
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

                        {evaluation.critical_gaps?.length > 0 && (
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
                    </>
                  )
                })()}
              </div>
            ) : (
              renderTranscription(selectedSession)
            )}
          </div>
        )}
      </div>
    </div>
  )
}
