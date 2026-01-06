'use client'

import { Trophy, Target, AlertTriangle, CheckCircle, ArrowRight, RotateCcw, Star, Zap, TrendingUp, Award, Sparkles, MessageCircle } from 'lucide-react'

interface TestEvaluationResultsProps {
  evaluation: any
  sessionId: string
  onRestart: () => void
}

export default function TestEvaluationResults({
  evaluation,
  sessionId,
  onRestart
}: TestEvaluationResultsProps) {
  // Função para registrar interesse e abrir WhatsApp
  const handleInterest = () => {
    // Registrar interesse no banco (fire and forget)
    fetch('/api/teste/interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    }).catch(() => {})

    // Redirecionar para WhatsApp do vendedor
    window.open(
      'https://wa.me/5531994713357?text=Olá!%20Acabei%20de%20testar%20a%20Ramppy%20e%20tenho%20interesse%20em%20conhecer%20mais%20para%20minha%20equipe%20de%20vendas.',
      '_blank'
    )
  }
  if (!evaluation) {
    return (
      <div className="text-center text-gray-400">
        Erro ao carregar avaliação
      </div>
    )
  }

  // Extrair dados da avaliação
  let overallScore = evaluation.overall_score || 0
  // Garantir escala 0-10 no frontend também
  if (overallScore > 10) {
    overallScore = overallScore / 10
  }

  const performanceLevel = evaluation.performance_level || 'unknown'
  const executiveSummary = evaluation.executive_summary || ''
  const spinEvaluation = evaluation.spin_evaluation || {}
  const topStrengths = evaluation.top_strengths || []
  const criticalGaps = evaluation.critical_gaps || []
  const priorityImprovements = evaluation.priority_improvements || []

  // Cor baseada no score
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-400'
    if (score >= 6) return 'text-yellow-400'
    if (score >= 4) return 'text-orange-400'
    return 'text-red-400'
  }

  const getScoreGradient = (score: number) => {
    if (score >= 8) return 'from-emerald-500 to-green-500'
    if (score >= 6) return 'from-yellow-500 to-amber-500'
    if (score >= 4) return 'from-orange-500 to-amber-500'
    return 'from-red-500 to-orange-500'
  }

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-emerald-500/10 border-emerald-500/30'
    if (score >= 6) return 'bg-yellow-500/10 border-yellow-500/30'
    if (score >= 4) return 'bg-orange-500/10 border-orange-500/30'
    return 'bg-red-500/10 border-red-500/30'
  }

  const getLevelText = (level: string) => {
    const levels: Record<string, string> = {
      legendary: 'Lendário',
      excellent: 'Excelente',
      very_good: 'Muito Bom',
      good: 'Bom',
      needs_improvement: 'Precisa Melhorar',
      poor: 'Iniciante'
    }
    return levels[level] || level
  }

  const getLevelEmoji = (level: string) => {
    const emojis: Record<string, string> = {
      legendary: '🏆',
      excellent: '🌟',
      very_good: '💪',
      good: '👍',
      needs_improvement: '📈',
      poor: '🎯'
    }
    return emojis[level] || '📊'
  }

  // Processar scores SPIN garantindo escala 0-10
  const getSpinScore = (letter: string) => {
    const spinData = spinEvaluation[letter]
    let score = spinData?.final_score ?? 0
    if (score > 10) score = score / 10
    return score
  }

  // Calcular média SPIN
  const spinScores = ['S', 'P', 'I', 'N'].map(getSpinScore)
  const spinAverage = spinScores.reduce((a, b) => a + b, 0) / 4

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      {/* CTA Principal - No topo */}
      <div className="relative overflow-hidden bg-gradient-to-br from-green-600/30 via-emerald-600/20 to-teal-600/30 backdrop-blur-xl rounded-3xl p-8 border border-green-500/40 shadow-2xl shadow-green-500/10 mb-8">
        {/* Brilho decorativo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          {/* Texto centralizado */}
          <div className="text-center mb-6">
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
              Imagine sua equipe{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
                treinando assim
              </span>{' '}
              todos os dias
            </h3>
            <p className="text-gray-300 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              Acelere o ramp-up, reduza erros em campo e acompanhe a evolução de cada vendedor em tempo real.
            </p>
          </div>

          {/* Botões centralizados */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://ramppy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-2xl font-semibold hover:bg-white/20 transition-all flex items-center justify-center gap-3 border border-white/20 hover:border-white/40"
            >
              Visitar Site
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <button
              onClick={handleInterest}
              className="group px-8 py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-emerald-400 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/40"
            >
              <MessageCircle className="w-5 h-5" />
              Tenho Interesse
            </button>
          </div>
        </div>
      </div>

      {/* Header Principal */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full border border-green-500/30 mb-4">
          <Sparkles className="w-4 h-4 text-green-400" />
          <span className="text-green-400 text-sm font-medium">Avaliação Completa</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Resultado do seu Roleplay
        </h1>
        <p className="text-gray-400">
          Veja como você se saiu e onde pode melhorar
        </p>
      </div>

      {/* Grid Principal */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Coluna 1: Score Principal + SPIN */}
        <div className="lg:col-span-1 space-y-6">
          {/* Score Card */}
          <div className="bg-gradient-to-br from-gray-900/90 to-gray-950/90 backdrop-blur-xl rounded-3xl p-6 border border-gray-700/50 shadow-2xl">
            <div className="text-center">
              <div className="relative inline-block">
                {/* Círculo de progresso */}
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-800"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="url(#scoreGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(overallScore / 10) * 440} 440`}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" className={overallScore >= 6 ? 'text-green-500' : 'text-orange-500'} stopColor="currentColor" />
                      <stop offset="100%" className={overallScore >= 6 ? 'text-emerald-400' : 'text-yellow-500'} stopColor="currentColor" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Score no centro */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
                    {overallScore.toFixed(1)}
                  </span>
                  <span className="text-gray-500 text-sm">de 10</span>
                </div>
              </div>

              {/* Badge de nível */}
              <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full ${getScoreBg(overallScore)} border`}>
                <span className="text-lg">{getLevelEmoji(performanceLevel)}</span>
                <span className={`font-semibold ${getScoreColor(overallScore)}`}>
                  {getLevelText(performanceLevel)}
                </span>
              </div>
            </div>
          </div>

          {/* SPIN Scores */}
          <div className="bg-gradient-to-br from-gray-900/90 to-gray-950/90 backdrop-blur-xl rounded-3xl p-6 border border-gray-700/50">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-green-400" />
              Metodologia SPIN
            </h3>

            <div className="space-y-4">
              {[
                { letter: 'S', name: 'Situação', desc: 'Perguntas de contexto' },
                { letter: 'P', name: 'Problema', desc: 'Identificar dores' },
                { letter: 'I', name: 'Implicação', desc: 'Consequências' },
                { letter: 'N', name: 'Necessidade', desc: 'Solução ideal' }
              ].map((spin) => {
                const score = getSpinScore(spin.letter)
                return (
                  <div key={spin.letter} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getScoreGradient(score)} flex items-center justify-center text-white font-bold text-sm`}>
                          {spin.letter}
                        </span>
                        <div>
                          <p className="text-white text-sm font-medium">{spin.name}</p>
                          <p className="text-gray-500 text-xs">{spin.desc}</p>
                        </div>
                      </div>
                      <span className={`text-lg font-bold ${getScoreColor(score)}`}>
                        {score.toFixed(1)}
                      </span>
                    </div>
                    {/* Barra de progresso */}
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getScoreGradient(score)} transition-all duration-1000`}
                        style={{ width: `${(score / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Média SPIN */}
            <div className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-between">
              <span className="text-gray-400 text-sm">Média SPIN</span>
              <span className={`text-xl font-bold ${getScoreColor(spinAverage)}`}>
                {spinAverage.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Coluna 2-3: Feedback Detalhado */}
        <div className="lg:col-span-2 space-y-6">
          {/* Resumo Executivo */}
          {executiveSummary && (
            <div className="bg-gradient-to-br from-gray-900/90 to-gray-950/90 backdrop-blur-xl rounded-3xl p-6 border border-gray-700/50">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                Análise Geral
              </h3>
              <p className="text-gray-300 leading-relaxed">
                {executiveSummary}
              </p>
            </div>
          )}

          {/* Grid de Pontos Fortes e Gaps */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pontos Fortes */}
            {topStrengths.length > 0 && (
              <div className="bg-gradient-to-br from-emerald-950/50 to-gray-950/90 backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/20">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Pontos Fortes
                </h3>
                <ul className="space-y-3">
                  {topStrengths.slice(0, 4).map((strength: string, index: number) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm"
                    >
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Star className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <span className="text-gray-300">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Áreas para Melhorar */}
            {criticalGaps.length > 0 && (
              <div className="bg-gradient-to-br from-amber-950/50 to-gray-950/90 backdrop-blur-xl rounded-3xl p-6 border border-amber-500/20">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Áreas para Melhorar
                </h3>
                <ul className="space-y-3">
                  {criticalGaps.slice(0, 4).map((gap: string, index: number) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm"
                    >
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <span className="text-gray-300">{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Próximos Passos */}
          {priorityImprovements.length > 0 && (
            <div className="bg-gradient-to-br from-blue-950/50 to-gray-950/90 backdrop-blur-xl rounded-3xl p-6 border border-blue-500/20">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-400" />
                Próximos Passos para Evolução
              </h3>
              <div className="space-y-4">
                {priorityImprovements.slice(0, 4).map((improvement: any, index: number) => {
                  // Extrair área e ações
                  const area = improvement.area || (typeof improvement === 'string' ? improvement.split('.')[0] : 'Melhoria')
                  const actionPlan = improvement.action_plan || ''

                  // Separar ações numeradas em lista
                  const actions = actionPlan
                    ? actionPlan.split(/\d+\.\s+/).filter((a: string) => a.trim())
                    : []

                  return (
                    <div
                      key={index}
                      className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                          <span className="text-white font-bold text-sm">{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-semibold mb-2">
                            {area}
                          </p>
                          {actions.length > 0 ? (
                            <ul className="space-y-2">
                              {actions.map((action: string, actionIndex: number) => (
                                <li key={actionIndex} className="flex items-start gap-2 text-sm text-gray-300">
                                  <span className="text-blue-400 font-medium mt-0.5">•</span>
                                  <span>{action.trim()}</span>
                                </li>
                              ))}
                            </ul>
                          ) : actionPlan ? (
                            <p className="text-sm text-gray-300 leading-relaxed">
                              {actionPlan}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
