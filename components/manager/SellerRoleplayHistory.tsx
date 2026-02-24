'use client'

import { useState, useEffect } from 'react'
import { History, Clock, Calendar, TrendingUp, Target, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Lightbulb, MessageCircle, X, Loader2 } from 'lucide-react'

interface RoleplaySession {
  id: string
  created_at: string
  status: string
  config: any
  messages: any[]
  evaluation: any
  duration_seconds: number | null
}

interface SellerRoleplayHistoryProps {
  sellerId: string
  sellerName: string
  onClose: () => void
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

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const formatDuration = (seconds?: number | null) => {
  if (!seconds) return null
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}min ${secs}s`
}

function getProcessedEvaluation(session: RoleplaySession) {
  let evaluation = session.evaluation
  if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
    try { evaluation = JSON.parse(evaluation.output) } catch { return null }
  }
  return evaluation
}

export default function SellerRoleplayHistory({ sellerId, sellerName, onClose }: SellerRoleplayHistoryProps) {
  const [sessions, setSessions] = useState<RoleplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [sellerId])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()
      const res = await fetch(`/api/admin/seller-roleplay-sessions?sellerId=${sellerId}`, {
        headers: { 'x-company-id': companyId || '' },
      })
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      const list = data.sessions || []
      setSessions(list)
      if (list.length > 0) setSelectedSession(list[0])
    } catch (e) {
      console.error('Erro ao carregar sessões:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
            <History className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Historico de Sessoes</h2>
            <p className="text-xs text-gray-500">{sellerName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      </div>
    )
  }

  const evaluation = selectedSession ? getProcessedEvaluation(selectedSession) : null
  const score = evaluation?.overall_score !== undefined
    ? (evaluation.overall_score > 10 ? evaluation.overall_score / 10 : evaluation.overall_score)
    : null
  const spin = evaluation?.spin_evaluation

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
          <History className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-gray-900">Historico de Sessoes</h2>
          <p className="text-xs text-gray-500">{sellerName} — {sessions.length} sessões</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <History className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-900 font-semibold mb-1">Nenhuma sessao encontrada</p>
          <p className="text-gray-500 text-sm">Este vendedor ainda nao completou nenhum roleplay</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 divide-x divide-gray-100" style={{ height: 'calc(100vh - 140px)' }}>
          {/* Session List */}
          <div className="col-span-3 overflow-y-auto">
            {sessions.map((session, idx) => {
              const eval_ = getProcessedEvaluation(session)
              const s = eval_?.overall_score !== undefined
                ? (eval_.overall_score > 10 ? eval_.overall_score / 10 : eval_.overall_score)
                : null
              return (
                <button
                  key={session.id}
                  onClick={() => { setSelectedSession(session); setExpandedSection(null) }}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-all ${
                    selectedSession?.id === session.id
                      ? 'bg-green-50 border-l-4 border-l-green-500'
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {s !== null ? (
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${getScoreBg(s)}`}>
                        <span className={`text-sm font-bold ${getScoreColor(s)}`}>{s.toFixed(1)}</span>
                      </div>
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] text-gray-400">--</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900">Sessao #{sessions.length - idx}</p>
                      <p className="text-[11px] text-gray-500">{formatDate(session.created_at)} — {formatDuration(session.duration_seconds) || 'Sem duração'}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Session Detail */}
          <div className="col-span-9 overflow-y-auto p-6 space-y-4">
            {!selectedSession ? (
              <div className="text-center py-20">
                <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Selecione uma sessao para ver os detalhes</p>
              </div>
            ) : (
              <>
                {/* Session Header */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{formatDate(selectedSession.created_at)}</span>
                    <span className="text-gray-400">{formatTime(selectedSession.created_at)}</span>
                  </div>
                  {selectedSession.duration_seconds && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-100 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs text-green-700 font-medium">{formatDuration(selectedSession.duration_seconds)}</span>
                    </div>
                  )}
                  <span className="text-xs text-gray-400">{selectedSession.messages?.length || 0} mensagens</span>
                </div>

                {/* Config Tags */}
                <div className="flex flex-wrap gap-2">
                  {selectedSession.config?.temperament && (
                    <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-lg font-medium">
                      {selectedSession.config.temperament}
                    </span>
                  )}
                  {selectedSession.config?.age && (
                    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-lg font-medium">
                      {selectedSession.config.age} anos
                    </span>
                  )}
                  {selectedSession.config?.segment && (
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-lg font-medium truncate max-w-[300px]">
                      {selectedSession.config.segment}
                    </span>
                  )}
                </div>

                {/* Resumo */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'resumo' ? null : 'resumo')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-4.5 h-4.5 text-green-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-gray-900">Resumo da Avaliacao</h3>
                        <p className="text-xs text-gray-500">
                          {score !== null ? `Nota ${score.toFixed(1)}` : 'Sem avaliação'}
                        </p>
                      </div>
                    </div>
                    {expandedSection === 'resumo' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {expandedSection === 'resumo' && evaluation && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                      {/* Score */}
                      <div className={`rounded-xl border p-5 text-center ${
                        score !== null ? (score >= 8 ? 'bg-green-50 border-green-200' : score >= 6 ? 'bg-blue-50 border-blue-200' : score >= 4 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200') : 'bg-gray-50 border-gray-200'
                      }`}>
                        <p className={`text-5xl font-bold ${score !== null ? getScoreColor(score) : 'text-gray-300'}`}>
                          {score?.toFixed(1) || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-medium">Nota Geral</p>
                      </div>

                      {/* Executive Summary */}
                      {evaluation.executive_summary && (
                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4">
                          {evaluation.executive_summary}
                        </p>
                      )}

                      {/* Strengths & Gaps */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {evaluation.top_strengths?.length > 0 && (
                          <div className="bg-green-50 rounded-xl border border-green-100 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <h4 className="text-xs font-semibold text-green-700">Pontos Fortes</h4>
                            </div>
                            <ul className="space-y-1.5">
                              {evaluation.top_strengths.map((s: string, i: number) => (
                                <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                                  <span className="text-green-500 mt-0.5">•</span>{s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {evaluation.critical_gaps?.length > 0 && (
                          <div className="bg-red-50 rounded-xl border border-red-100 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                              <h4 className="text-xs font-semibold text-red-700">Pontos a Melhorar</h4>
                            </div>
                            <ul className="space-y-1.5">
                              {evaluation.critical_gaps.map((g: string, i: number) => (
                                <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                                  <span className="text-red-500 mt-0.5">•</span>{g}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Priority Improvements */}
                      {evaluation.priority_improvements?.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            <h4 className="text-xs font-semibold text-gray-900">Prioridades de Melhoria</h4>
                          </div>
                          {evaluation.priority_improvements.map((imp: any, i: number) => (
                            <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  imp.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                  imp.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {imp.priority === 'critical' ? 'Crítico' : imp.priority === 'high' ? 'Alta' : 'Média'}
                                </span>
                                <span className="text-xs font-semibold text-gray-900">{imp.area}</span>
                              </div>
                              <p className="text-xs text-gray-600">{imp.action_plan}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SPIN Analysis */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'spin' ? null : 'spin')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-cyan-50 rounded-xl flex items-center justify-center">
                        <Target className="w-4.5 h-4.5 text-cyan-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-gray-900">Analise SPIN</h3>
                        {spin ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {['S', 'P', 'I', 'N'].map(key => {
                              const s = spin[key]?.final_score || 0
                              return (
                                <span key={key} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  s >= 7 ? 'bg-green-100 text-green-700' : s >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                }`}>{key}: {s.toFixed(1)}</span>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Sem analise</p>
                        )}
                      </div>
                    </div>
                    {expandedSection === 'spin' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {expandedSection === 'spin' && spin && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          { key: 'S', label: 'Situação', bg: 'bg-cyan-50', border: 'border-cyan-200', color: 'text-cyan-700' },
                          { key: 'P', label: 'Problema', bg: 'bg-green-50', border: 'border-green-200', color: 'text-green-700' },
                          { key: 'I', label: 'Implicação', bg: 'bg-amber-50', border: 'border-amber-200', color: 'text-amber-700' },
                          { key: 'N', label: 'Necessidade', bg: 'bg-pink-50', border: 'border-pink-200', color: 'text-pink-700' },
                        ].map(({ key, label, bg, border, color }) => {
                          const spinScore = spin[key]?.final_score || 0
                          return (
                            <div key={key} className={`${bg} rounded-xl border ${border} p-4 text-center`}>
                              <p className={`text-3xl font-bold ${color}`}>{spinScore.toFixed(1)}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">{label}</p>
                              {spin[key]?.technical_feedback && (
                                <p className="text-xs text-gray-600 mt-2 line-clamp-4 leading-relaxed text-left">{spin[key].technical_feedback}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Transcript */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'transcript' ? null : 'transcript')}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
                        <MessageCircle className="w-4.5 h-4.5 text-purple-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-semibold text-gray-900">Transcricao</h3>
                        <p className="text-xs text-gray-500">{selectedSession.messages?.length || 0} mensagens</p>
                      </div>
                    </div>
                    {expandedSection === 'transcript' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {expandedSection === 'transcript' && selectedSession.messages?.length > 0 && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-2.5 max-h-[500px] overflow-y-auto">
                      {selectedSession.messages.map((msg: any, i: number) => (
                        <div key={i} className={`rounded-xl p-3 ${
                          msg.role === 'seller' ? 'bg-green-50 border border-green-100 ml-8' : 'bg-gray-50 border border-gray-100 mr-8'
                        }`}>
                          <p className={`text-xs font-semibold mb-1 ${
                            msg.role === 'seller' ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {msg.role === 'seller' ? sellerName : 'Cliente IA'}
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
