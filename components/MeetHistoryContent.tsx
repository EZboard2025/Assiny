'use client'

import { useState, useEffect } from 'react'
import { Video, Clock, Target, TrendingUp, Calendar, ChevronDown, ChevronUp, User, AlertTriangle, Lightbulb, CheckCircle, Trash2 } from 'lucide-react'

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

export default function MeetHistoryContent() {
  const [evaluations, setEvaluations] = useState<MeetEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvaluation, setSelectedEvaluation] = useState<MeetEvaluation | null>(null)
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
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
    } catch (error) {
      console.error('Erro ao carregar histórico de Meet:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta avaliação?')) return

    try {
      const { supabase } = await import('@/lib/supabase')
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

  const getFunnelStageLabel = (stage: string | null) => {
    const labels: Record<string, string> = {
      'prospeccao': 'Prospecção',
      'discovery': 'Discovery',
      'demo': 'Demo',
      'negociacao': 'Negociação',
      'fechamento': 'Fechamento',
      'follow_up': 'Follow-up'
    }
    return labels[stage || ''] || stage || 'N/A'
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-100'
    if (score >= 80) return 'bg-green-50'
    if (score >= 60) return 'bg-blue-50'
    if (score >= 40) return 'bg-yellow-50'
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
            {evaluations.map((evaluation) => (
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
                    <div className="text-sm font-medium text-gray-900 mb-0.5 truncate">
                      {evaluation.seller_name || 'Sem nome'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{getFunnelStageLabel(evaluation.funnel_stage)}</span>
                      <span className="text-gray-300">•</span>
                      <span>{formatDate(evaluation.created_at)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
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
                    <span className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {getFunnelStageLabel(selectedEvaluation.funnel_stage)}
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

            {/* SPIN Scores */}
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Scores SPIN</h3>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { letter: 'S', label: 'Situação', score: selectedEvaluation.spin_s_score },
                  { letter: 'P', label: 'Problema', score: selectedEvaluation.spin_p_score },
                  { letter: 'I', label: 'Implicação', score: selectedEvaluation.spin_i_score },
                  { letter: 'N', label: 'Necessidade', score: selectedEvaluation.spin_n_score },
                ].map(({ letter, label, score }) => (
                  <div key={letter} className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {score !== null ? score.toFixed(1) : '--'}
                    </div>
                    <div className="text-xs text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Avaliação detalhada */}
            {selectedEvaluation.evaluation && (
              <div className="p-6">
                <button
                  onClick={() => toggleDetails(selectedEvaluation.id)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 mb-4"
                >
                  <span>Avaliação Detalhada</span>
                  {expandedDetails.has(selectedEvaluation.id) ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>

                {expandedDetails.has(selectedEvaluation.id) && (
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
                  </div>
                )}
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
