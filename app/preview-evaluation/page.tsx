'use client'

import { useState } from 'react'
import { X, ChevronDown, User, Target, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react'

// Mock data para preview
const mockEvaluation = {
  overall_score: 7.8,
  performance_level: 'very_good',
  executive_summary: 'O vendedor demonstrou boa capacidade de identificação de necessidades e construção de rapport. A abordagem foi consultiva e focada em entender o contexto do cliente. Houve oportunidades perdidas na exploração de implicações e no fechamento.',
  spin_evaluation: {
    S: {
      final_score: 8.0,
      technical_feedback: 'Excelente mapeamento do cenário atual do cliente. Perguntas abertas bem formuladas que permitiram entender o contexto completo.',
      indicators: {
        adaptability_score: 8.5,
        open_questions_score: 8.0,
        scenario_mapping_score: 7.5,
        depth_score: 8.0
      },
      missed_opportunities: ['Poderia ter explorado mais o histórico de soluções anteriores']
    },
    P: {
      final_score: 8.0,
      technical_feedback: 'Boa identificação dos problemas principais. Demonstrou empatia ao reconhecer as dores do cliente.',
      indicators: {
        problem_identification_score: 8.5,
        empathy_score: 8.0,
        pain_identification_score: 7.5
      },
      missed_opportunities: []
    },
    I: {
      final_score: 7.0,
      technical_feedback: 'As implicações foram parcialmente exploradas. Faltou quantificar o impacto financeiro dos problemas identificados.',
      indicators: {
        emotional_impact_score: 7.0,
        logical_flow_score: 7.5,
        quantification_score: 6.0,
        business_impact_score: 7.5
      },
      missed_opportunities: ['Não quantificou o custo do problema atual', 'Poderia ter criado mais urgência']
    },
    N: {
      final_score: 8.0,
      technical_feedback: 'Apresentação de valor clara e alinhada com as necessidades identificadas. Boa articulação dos benefícios.',
      indicators: {
        value_articulation_score: 8.5,
        solution_fit_score: 8.0,
        benefit_clarity_score: 7.5
      },
      missed_opportunities: []
    }
  },
  top_strengths: [
    'Excelente capacidade de escuta ativa e rapport',
    'Perguntas de situação bem estruturadas',
    'Apresentação de valor alinhada com necessidades'
  ],
  critical_gaps: [
    'Faltou explorar implicações financeiras',
    'Poderia ter criado mais senso de urgência',
    'Fechamento poderia ser mais assertivo'
  ],
  priority_improvements: [
    {
      area: 'Implicação',
      priority: 'high',
      current_gap: 'Baixa quantificação de impacto',
      action_plan: 'Sempre perguntar "quanto isso custa para vocês?" ao identificar um problema'
    },
    {
      area: 'Fechamento',
      priority: 'medium',
      current_gap: 'Fechamento passivo',
      action_plan: 'Propor próximos passos concretos ao final de cada conversa'
    }
  ],
  objections_analysis: [
    {
      objection_type: 'Preço',
      objection_text: 'Está muito caro para nossa realidade atual',
      score: 7.5,
      detailed_analysis: 'Boa resposta focando em ROI, mas poderia ter explorado mais o custo de não resolver o problema'
    },
    {
      objection_type: 'Timing',
      objection_text: 'Agora não é um bom momento',
      score: 6.5,
      detailed_analysis: 'Resposta adequada, mas faltou criar urgência sobre o custo de adiar a decisão'
    }
  ]
}

const mockMessages = [
  { role: 'client' as const, text: 'Olá, vi que vocês oferecem soluções de automação. Estou curioso para saber mais.' },
  { role: 'seller' as const, text: 'Olá! Fico feliz em ajudar. Para eu entender melhor sua situação, pode me contar um pouco sobre como funciona o processo atual na sua empresa?' },
  { role: 'client' as const, text: 'Bom, hoje fazemos tudo manualmente. Temos uma equipe de 5 pessoas que gastam cerca de 4 horas por dia só em tarefas repetitivas.' },
  { role: 'seller' as const, text: 'Entendo. E como isso tem impactado os resultados da equipe? Conseguem focar nas atividades estratégicas?' },
  { role: 'client' as const, text: 'Honestamente, não. A equipe está sobrecarregada e isso afeta a qualidade do trabalho.' },
  { role: 'seller' as const, text: 'Imagino que isso gere frustração. Nossa solução pode automatizar essas tarefas repetitivas, liberando sua equipe para o que realmente importa. Posso te mostrar como funciona?' },
]

export default function PreviewEvaluationPage() {
  const [activeTab, setActiveTab] = useState<'evaluation' | 'feedback' | 'conversation'>('evaluation')
  const evaluation = mockEvaluation
  const messages = mockMessages

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-green-500/20 border-green-500/30'
    if (score >= 6) return 'bg-yellow-500/20 border-yellow-500/30'
    return 'bg-red-500/20 border-red-500/30'
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
      'depth_score': 'Profundidade',
      'problem_identification_score': 'Identificação de Problemas',
      'empathy_score': 'Empatia',
      'pain_identification_score': 'Identificação de Dores',
      'emotional_impact_score': 'Impacto Emocional',
      'logical_flow_score': 'Fluxo Lógico',
      'quantification_score': 'Quantificação',
      'business_impact_score': 'Impacto no Negócio',
      'value_articulation_score': 'Articulação de Valor',
      'solution_fit_score': 'Adequação da Solução',
      'benefit_clarity_score': 'Clareza de Benefícios',
    }
    const normalized = key.toLowerCase().replace(/\s+/g, '_')
    if (translations[normalized]) return translations[normalized]
    if (translations[key]) return translations[key]
    const cleaned = key.replace(/_score$/i, '').replace(/_/g, ' ').trim()
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  const overallScore = evaluation.overall_score

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="min-h-screen py-8 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Resultado da Sessão</h1>
              <p className="text-gray-400 text-sm">Análise detalhada do seu desempenho (Preview)</p>
            </div>
            <a
              href="/"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </a>
          </div>

          {/* Score Principal */}
          <div className={`rounded-xl border p-6 text-center mb-6 ${getScoreBg(overallScore)}`}>
            <div className={`text-5xl font-bold mb-2 ${getScoreColor(overallScore)}`}>
              {overallScore.toFixed(1)}
            </div>
            <div className="text-gray-400 text-sm">
              {getPerformanceLabel(evaluation.performance_level)}
            </div>
          </div>

          {/* Tabs de navegação */}
          <div className="flex gap-1 bg-gray-900/50 rounded-xl border border-gray-800 p-1 mb-6">
            {['resumo', 'spin', 'transcricao'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab === 'resumo' ? 'evaluation' : tab === 'spin' ? 'feedback' : 'conversation')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  (tab === 'resumo' && activeTab === 'evaluation') ||
                  (tab === 'spin' && activeTab === 'feedback') ||
                  (tab === 'transcricao' && activeTab === 'conversation')
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {tab === 'resumo' && 'Resumo'}
                {tab === 'spin' && 'Análise SPIN'}
                {tab === 'transcricao' && 'Transcrição'}
              </button>
            ))}
          </div>

          {/* Tab Resumo */}
          {activeTab === 'evaluation' && (
            <div className="space-y-4">
              {/* Resumo executivo */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Resumo Executivo
                </h4>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {evaluation.executive_summary}
                </p>
              </div>

              {/* Grid de insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pontos fortes */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-green-400 mb-3">
                    <TrendingUp className="w-4 h-4" />
                    Pontos Fortes
                  </h4>
                  <ul className="space-y-2">
                    {evaluation.top_strengths.map((strength, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Gaps críticos */}
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-red-400 mb-3">
                    <AlertTriangle className="w-4 h-4" />
                    Pontos a Melhorar
                  </h4>
                  <ul className="space-y-2">
                    {evaluation.critical_gaps.map((gap, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Prioridades de melhoria */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <h4 className="flex items-center gap-2 text-sm font-medium text-yellow-400 mb-3">
                  <Lightbulb className="w-4 h-4" />
                  Prioridades de Melhoria
                </h4>
                <div className="space-y-3">
                  {evaluation.priority_improvements.map((imp, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          imp.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                          imp.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {imp.priority === 'critical' ? 'Crítico' :
                           imp.priority === 'high' ? 'Alta' : 'Média'}
                        </span>
                        <span className="text-sm font-medium text-white">{imp.area}</span>
                      </div>
                      <p className="text-xs text-gray-400">{imp.action_plan}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab Análise SPIN */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              {/* Grid de scores SPIN */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'S', label: 'Situação', color: 'text-blue-400' },
                  { key: 'P', label: 'Problema', color: 'text-purple-400' },
                  { key: 'I', label: 'Implicação', color: 'text-orange-400' },
                  { key: 'N', label: 'Necessidade', color: 'text-green-400' }
                ].map(({ key, label, color }) => {
                  const score = evaluation.spin_evaluation[key as keyof typeof evaluation.spin_evaluation]?.final_score || 0
                  return (
                    <div key={key} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 text-center">
                      <div className={`text-3xl font-bold mb-1 ${color}`}>
                        {score.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 uppercase tracking-wider">
                        {label}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Média SPIN */}
              <div className="bg-green-500/10 rounded-xl border border-green-500/20 p-4 text-center">
                <div className="text-2xl font-bold text-green-400 mb-1">
                  {(
                    ((evaluation.spin_evaluation.S?.final_score || 0) +
                    (evaluation.spin_evaluation.P?.final_score || 0) +
                    (evaluation.spin_evaluation.I?.final_score || 0) +
                    (evaluation.spin_evaluation.N?.final_score || 0)) / 4
                  ).toFixed(1)}
                </div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">
                  Média Geral SPIN
                </div>
              </div>

              {/* Detalhes de cada pilar */}
              {(['S', 'P', 'I', 'N'] as const).map((letter) => {
                const data = evaluation.spin_evaluation[letter]
                if (!data) return null

                const labels: Record<string, string> = {
                  'S': 'Situação',
                  'P': 'Problema',
                  'I': 'Implicação',
                  'N': 'Necessidade'
                }

                return (
                  <details key={letter} className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden group">
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold text-green-400">
                          {letter}
                        </span>
                        <span className="font-medium text-white">{labels[letter]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-white">
                          {data.final_score?.toFixed(1)}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
                      </div>
                    </summary>
                    <div className="p-4 pt-0 space-y-3">
                      {/* Feedback */}
                      {data.technical_feedback && (
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {data.technical_feedback}
                        </p>
                      )}

                      {/* Indicadores */}
                      {data.indicators && Object.keys(data.indicators).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(data.indicators).map(([key, value]) => {
                            const score = typeof value === 'number' ? value : 0
                            const getIndicatorStyle = (s: number) => {
                              if (s >= 8) return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-300'
                              if (s >= 6) return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-300'
                              return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/30 text-red-300'
                            }
                            const getIndicatorScoreStyle = (s: number) => {
                              if (s >= 8) return 'text-green-400 font-semibold'
                              if (s >= 6) return 'text-yellow-400 font-semibold'
                              return 'text-red-400 font-semibold'
                            }
                            return (
                              <span
                                key={key}
                                className={`text-xs px-3 py-1.5 rounded-lg border backdrop-blur-sm transition-all hover:scale-105 ${getIndicatorStyle(score)}`}
                              >
                                {translateIndicator(key)}: <span className={getIndicatorScoreStyle(score)}>{value}/10</span>
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* Oportunidades perdidas */}
                      {data.missed_opportunities?.length > 0 && (
                        <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                          <p className="text-xs font-medium text-orange-400 mb-2">Oportunidades Perdidas</p>
                          <ul className="space-y-1">
                            {data.missed_opportunities.map((opp, i) => (
                              <li key={i} className="text-xs text-orange-300">• {opp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                )
              })}

              {/* Análise de objeções */}
              <details className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden group">
                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                      <Target className="w-4 h-4 text-green-400" />
                    </span>
                    <span className="font-medium text-white">Análise de Objeções</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      {evaluation.objections_analysis.length} objeções
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
                  </div>
                </summary>
                <div className="p-4 pt-0 space-y-3">
                  {evaluation.objections_analysis.map((obj, idx) => (
                    <div key={idx} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                          {obj.objection_type}
                        </span>
                        <span className={`text-sm font-bold ${getScoreColor(obj.score)}`}>
                          {obj.score}/10
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 italic mb-2">
                        "{obj.objection_text}"
                      </p>
                      <p className="text-xs text-gray-400">{obj.detailed_analysis}</p>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Tab Transcrição */}
          {activeTab === 'conversation' && (
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
              <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                {messages.length} mensagens
              </h4>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${msg.role === 'seller' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'client'
                        ? 'bg-gray-800'
                        : 'bg-green-500/20'
                    }`}>
                      <User className={`w-4 h-4 ${
                        msg.role === 'client' ? 'text-gray-400' : 'text-green-400'
                      }`} />
                    </div>
                    <div className={`flex-1 max-w-[80%] ${msg.role === 'seller' ? 'text-right' : ''}`}>
                      <div className="text-xs text-gray-500 mb-1">
                        {msg.role === 'client' ? 'Cliente' : 'Você'}
                      </div>
                      <div className={`inline-block p-3 rounded-xl text-sm ${
                        msg.role === 'client'
                          ? 'bg-gray-800 text-gray-300 rounded-tl-none'
                          : 'bg-green-500/20 text-green-100 rounded-tr-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <a
              href="/"
              className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl font-medium hover:bg-gray-800 transition-colors text-gray-300 text-sm text-center"
            >
              Voltar
            </a>
            <button
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-medium transition-colors text-white text-sm"
            >
              Ver Análise Completa no Histórico
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
