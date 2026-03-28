'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  FileText, Loader2, ArrowLeft, ClipboardPaste, Send,
  ChevronDown, ChevronUp, Star, AlertTriangle, Target,
  TrendingUp, CheckCircle, XCircle, MinusCircle
} from 'lucide-react'

export default function AvaliarPage() {
  const router = useRouter()
  const [transcription, setTranscription] = useState('')
  const [loading, setLoading] = useState(false)
  const [evaluation, setEvaluation] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [expandedPlaybookDim, setExpandedPlaybookDim] = useState<string | null>(null)

  useEffect(() => {
    const loadCompanyId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', user.id)
        .single()
      if (data?.company_id) setCompanyId(data.company_id)
    }
    loadCompanyId()
  }, [])

  const handleEvaluate = async () => {
    if (!transcription.trim()) return

    setLoading(true)
    setError(null)
    setEvaluation(null)

    try {
      const response = await fetch('/api/evaluate-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription: transcription.trim(), companyId })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao avaliar')
      }

      if (result.success && result.evaluation) {
        setEvaluation(result.evaluation)
      } else {
        throw new Error('Resposta inesperada da API')
      }
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    if (score >= 4) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
    if (score >= 6) return 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'
    if (score >= 4) return 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
    return 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
  }

  const getPerformanceLabel = (level: string) => {
    const labels: Record<string, string> = {
      'legendary': 'Lendário',
      'excellent': 'Excelente',
      'very_good': 'Muito Bom',
      'good': 'Bom',
      'needs_improvement': 'Precisa Melhorar',
      'poor': 'Em Desenvolvimento'
    }
    return labels[level] || level
  }

  const translateIndicator = (key: string) => {
    const translations: Record<string, string> = {
      'adaptability_score': 'Adaptabilidade',
      'open_questions_score': 'Perguntas Abertas',
      'scenario_mapping_score': 'Mapeamento de Cenário',
      'problem_identification_score': 'Identificação de Problemas',
      'consequences_exploration_score': 'Exploração de Consequências',
      'depth_score': 'Profundidade',
      'empathy_score': 'Empatia',
      'impact_understanding_score': 'Compreensão de Impacto',
      'inaction_consequences_score': 'Consequências da Inação',
      'urgency_amplification_score': 'Amplificação de Urgência',
      'concrete_risks_score': 'Riscos Concretos',
      'non_aggressive_urgency_score': 'Urgência Não-Agressiva',
      'solution_clarity_score': 'Clareza da Solução',
      'personalization_score': 'Personalização',
      'benefits_clarity_score': 'Clareza de Benefícios',
      'credibility_score': 'Credibilidade',
      'cta_effectiveness_score': 'Eficácia do CTA'
    }
    return translations[key] || key.replace(/_/g, ' ').replace(/score/i, '').trim()
  }

  const spinLabels: Record<string, string> = { S: 'Situação', P: 'Problema', I: 'Implicação', N: 'Necessidade' }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <ClipboardPaste className="w-5 h-5 text-green-600" />
            <h1 className="text-lg font-semibold text-gray-900">Avaliar Transcrição</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Input Area */}
        {!evaluation && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-600" />
                Cole a transcrição
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Formato: &quot;Vendedor: ...&quot; e &quot;Cliente: ...&quot; em linhas separadas. Ou cole qualquer formato de conversa.
              </p>
            </div>
            <div className="p-4">
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder={`Vendedor: Olá, tudo bem? Aqui é o João da Ramppy...\nCliente: Oi João, tudo bem sim.\nVendedor: Que bom! Então, eu vi que vocês estão...`}
                className="w-full h-80 p-4 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none font-mono"
                disabled={loading}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">
                  {transcription.length.toLocaleString()} caracteres
                </span>
                <button
                  onClick={handleEvaluate}
                  disabled={loading || !transcription.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Avaliando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Avaliar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600 font-medium">Avaliando transcrição...</p>
            <p className="text-xs text-gray-400 mt-1">Isso pode levar até 30 segundos</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">Erro na avaliação</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
            <button
              onClick={() => { setError(null); setEvaluation(null) }}
              className="ml-auto px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Results */}
        {evaluation && (
          <div className="space-y-4">
            {/* Back to input */}
            <button
              onClick={() => { setEvaluation(null); setExpandedSection(null); setExpandedPlaybookDim(null) }}
              className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Avaliar outra transcrição
            </button>

            {/* Overall Score */}
            <div className={`rounded-2xl border p-6 ${getScoreBg(evaluation.overall_score)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Nota Geral</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-5xl font-bold ${getScoreColor(evaluation.overall_score)}`}>
                      {evaluation.overall_score?.toFixed(1)}
                    </span>
                    <span className="text-lg text-gray-400">/10</span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  evaluation.overall_score >= 8 ? 'bg-green-100 text-green-700' :
                  evaluation.overall_score >= 6 ? 'bg-blue-100 text-blue-700' :
                  evaluation.overall_score >= 4 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {getPerformanceLabel(evaluation.performance_level)}
                </span>
              </div>
            </div>

            {/* Executive Summary */}
            {evaluation.executive_summary && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'resumo' ? null : 'resumo')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-xl">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-gray-900">Resumo</h3>
                    </div>
                  </div>
                  {expandedSection === 'resumo' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {expandedSection === 'resumo' && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{evaluation.executive_summary}</p>

                    {evaluation.top_strengths?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Pontos Fortes</h4>
                        <ul className="space-y-1">
                          {evaluation.top_strengths.map((s: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-green-50 rounded-lg p-2">
                              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.critical_gaps?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Gaps Críticos</h4>
                        <ul className="space-y-1">
                          {evaluation.critical_gaps.map((g: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-red-50 rounded-lg p-2">
                              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.priority_improvements?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">Melhorias Prioritárias</h4>
                        <ul className="space-y-2">
                          {evaluation.priority_improvements.map((imp: any, i: number) => (
                            <li key={i} className="text-sm text-gray-700 bg-orange-50 rounded-lg p-3">
                              <div className="font-medium text-orange-700">{imp.area}</div>
                              <p className="text-xs text-gray-600 mt-1">{imp.current_gap}</p>
                              <p className="text-xs text-gray-500 mt-1 italic">{imp.action_plan}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SPIN Evaluation */}
            {evaluation.spin_evaluation && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'spin' ? null : 'spin')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-xl">
                      <Target className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-gray-900">Análise SPIN</h3>
                      <div className="flex gap-3 mt-1">
                        {(['S', 'P', 'I', 'N'] as const).map(letter => {
                          const score = evaluation.spin_evaluation?.[letter]?.final_score
                          return score !== undefined ? (
                            <span key={letter} className={`text-xs font-semibold ${getScoreColor(score)}`}>
                              {letter}: {score.toFixed(1)}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                  </div>
                  {expandedSection === 'spin' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {expandedSection === 'spin' && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                    {(['S', 'P', 'I', 'N'] as const).map(letter => {
                      const spin = evaluation.spin_evaluation?.[letter]
                      if (!spin) return null
                      return (
                        <div key={letter} className={`rounded-xl border p-4 ${getScoreBg(spin.final_score)}`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-900">
                              {letter} — {spinLabels[letter]}
                            </h4>
                            <span className={`text-lg font-bold ${getScoreColor(spin.final_score)}`}>
                              {spin.final_score.toFixed(1)}
                            </span>
                          </div>

                          {/* Indicators */}
                          {spin.indicators && (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {Object.entries(spin.indicators).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between bg-white/60 rounded-lg p-2">
                                  <span className="text-xs text-gray-600">{translateIndicator(key)}</span>
                                  <span className={`text-xs font-semibold ${getScoreColor(value as number)}`}>
                                    {(value as number).toFixed(1)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {spin.technical_feedback && (
                            <p className="text-xs text-gray-600 leading-relaxed bg-white/40 rounded-lg p-2">{spin.technical_feedback}</p>
                          )}

                          {spin.missed_opportunities?.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-orange-600 mb-1">Oportunidades perdidas:</p>
                              <ul className="space-y-1">
                                {spin.missed_opportunities.map((opp: string, i: number) => (
                                  <li key={i} className="text-xs text-gray-600 bg-orange-50/50 rounded p-1.5 flex items-start gap-1">
                                    <MinusCircle className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
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
                )}
              </div>
            )}

            {/* Objections Analysis */}
            {evaluation.objections_analysis?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'objections' ? null : 'objections')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-gray-900">Objeções</h3>
                      <p className="text-xs text-gray-500">{evaluation.objections_analysis.length} objeção(ões) analisada(s)</p>
                    </div>
                  </div>
                  {expandedSection === 'objections' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {expandedSection === 'objections' && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-3">
                    {evaluation.objections_analysis.map((obj: any, i: number) => (
                      <div key={i} className={`rounded-xl border p-3 ${getScoreBg(obj.score)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-800">{obj.objection_text || obj.objection_type}</span>
                          <span className={`text-sm font-bold ${getScoreColor(obj.score)}`}>{obj.score.toFixed(1)}</span>
                        </div>
                        {obj.detailed_analysis && (
                          <p className="text-xs text-gray-600 leading-relaxed">{obj.detailed_analysis}</p>
                        )}
                        {obj.critical_errors?.length > 0 && (
                          <div className="mt-2">
                            {obj.critical_errors.map((err: string, j: number) => (
                              <p key={j} className="text-xs text-red-600 bg-red-50 rounded p-1.5 mt-1">{err}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Playbook Adherence */}
            {evaluation.playbook_adherence && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <button
                  onClick={() => setExpandedSection(expandedSection === 'playbook' ? null : 'playbook')}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-gray-900">Playbook</h3>
                      <p className="text-xs text-gray-500">
                        {evaluation.playbook_adherence.overall_adherence_score}% de aderência
                      </p>
                    </div>
                  </div>
                  {expandedSection === 'playbook' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {expandedSection === 'playbook' && (() => {
                  const pa = evaluation.playbook_adherence
                  return (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                      {/* Score header */}
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-purple-600 uppercase tracking-wider font-semibold">Aderência ao Playbook</p>
                            <div className="flex items-end gap-2 mt-1">
                              <span className="text-4xl font-bold text-purple-600">{pa.overall_adherence_score}%</span>
                              <span className="text-sm text-gray-500 mb-1">de aderência</span>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            pa.adherence_level === 'exemplary' ? 'bg-green-100 text-green-700' :
                            pa.adherence_level === 'compliant' ? 'bg-blue-100 text-blue-700' :
                            pa.adherence_level === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {pa.adherence_level === 'exemplary' ? 'Exemplar' :
                             pa.adherence_level === 'compliant' ? 'Conforme' :
                             pa.adherence_level === 'partial' ? 'Parcial' : 'Não Conforme'}
                          </span>
                        </div>
                      </div>

                      {/* Dimensions */}
                      {pa.dimensions && (
                        <div className="space-y-2">
                          {[
                            { key: 'opening', label: 'Abertura', icon: '🎯' },
                            { key: 'closing', label: 'Fechamento', icon: '🤝' },
                            { key: 'conduct', label: 'Conduta', icon: '👔' },
                            { key: 'required_scripts', label: 'Scripts', icon: '📝' },
                            { key: 'process', label: 'Processo', icon: '⚙️' }
                          ].map(({ key, label, icon }) => {
                            const dim = pa.dimensions?.[key as keyof typeof pa.dimensions] as any
                            if (!dim || dim.status === 'not_evaluated') return null
                            const isExpanded = expandedPlaybookDim === key
                            return (
                              <div key={key} className="border border-gray-200 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setExpandedPlaybookDim(isExpanded ? null : key)}
                                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">{icon}</span>
                                    <span className="text-sm font-medium text-gray-800">{label}</span>
                                    <span className={`text-lg font-bold ${
                                      (dim.score || 0) >= 70 ? 'text-green-600' :
                                      (dim.score || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                      {dim.score || 0}%
                                    </span>
                                  </div>
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </button>
                                {isExpanded && (
                                  <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-2">
                                    {dim.dimension_feedback && (
                                      <p className="text-xs text-gray-600 italic bg-gray-50 rounded-lg p-2 leading-relaxed">{dim.dimension_feedback}</p>
                                    )}
                                    {dim.criteria_evaluated?.map((c: any, ci: number) => (
                                      <div key={ci} className={`text-sm rounded-lg p-3 border ${
                                        c.result === 'compliant' ? 'bg-green-50/50 border-green-200' :
                                        c.result === 'partial' ? 'bg-yellow-50/50 border-yellow-200' :
                                        c.result === 'violated' ? 'bg-red-50/50 border-red-200' :
                                        c.result === 'missed' ? 'bg-orange-50/50 border-orange-200' :
                                        'bg-gray-50/50 border-gray-200'
                                      }`}>
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className={`text-xs font-semibold ${
                                            c.result === 'compliant' ? 'text-green-600' :
                                            c.result === 'partial' ? 'text-yellow-600' :
                                            c.result === 'violated' ? 'text-red-600' :
                                            c.result === 'missed' ? 'text-orange-600' :
                                            'text-gray-400'
                                          }`}>
                                            {c.result === 'compliant' ? '✓ Conforme' :
                                             c.result === 'partial' ? '⚠ Parcial' :
                                             c.result === 'violated' ? '✗ Violado' :
                                             c.result === 'missed' ? '✗ Perdido' :
                                             '○ N/A'}
                                          </span>
                                          <span className="text-gray-800 font-medium">{c.criterion}</span>
                                        </div>
                                        {c.evidence && c.result !== 'not_applicable' && (
                                          <p className="text-xs text-gray-500 italic mt-1 bg-white/60 rounded p-1.5 leading-relaxed">&ldquo;{c.evidence}&rdquo;</p>
                                        )}
                                        {c.notes && (
                                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{c.notes}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Exemplary Moments */}
                      {pa.exemplary_moments?.length > 0 && (
                        <div className="bg-green-50 rounded-2xl border border-green-200 p-4">
                          <h4 className="flex items-center gap-2 text-sm font-medium text-green-700 mb-3">
                            <Star className="w-4 h-4" />
                            Acertos do Vendedor
                          </h4>
                          <ul className="space-y-2">
                            {pa.exemplary_moments.map((em: any, i: number) => (
                              <li key={i} className="text-sm text-gray-700 bg-white/50 rounded-lg p-3 border border-green-100">
                                <div className="font-medium text-green-700">{em.criterion}</div>
                                {em.evidence && <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{em.evidence}&rdquo;</p>}
                                {em.why_exemplary && <p className="text-xs text-green-600 mt-1">{em.why_exemplary}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Violations */}
                      {pa.violations?.length > 0 && (
                        <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
                          <h4 className="flex items-center gap-2 text-sm font-medium text-red-700 mb-3">
                            <AlertTriangle className="w-4 h-4" />
                            Violações Detectadas
                          </h4>
                          <ul className="space-y-2">
                            {pa.violations.map((v: any, i: number) => (
                              <li key={i} className="text-sm text-gray-700 bg-white/50 rounded-lg p-3 border border-red-100">
                                <div className="font-medium text-red-700">{v.criterion}</div>
                                {v.evidence && <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{v.evidence}&rdquo;</p>}
                                {v.recommendation && <p className="text-xs text-red-600 mt-1">{v.recommendation}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Coaching Notes */}
                      {pa.coaching_notes && (
                        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
                          <h4 className="text-sm font-medium text-blue-700 mb-2">Orientações</h4>
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{pa.coaching_notes}</p>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
