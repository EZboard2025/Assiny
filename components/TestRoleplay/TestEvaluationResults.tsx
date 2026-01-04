'use client'

import { Trophy, Target, AlertTriangle, CheckCircle, ArrowRight, RotateCcw, Star } from 'lucide-react'

interface TestEvaluationResultsProps {
  evaluation: any
  onRestart: () => void
}

export default function TestEvaluationResults({
  evaluation,
  onRestart
}: TestEvaluationResultsProps) {
  if (!evaluation) {
    return (
      <div className="text-center text-gray-400">
        Erro ao carregar avaliação
      </div>
    )
  }

  // Extrair dados da avaliação
  const overallScore = evaluation.overall_score || 0
  const performanceLevel = evaluation.performance_level || 'unknown'
  const executiveSummary = evaluation.executive_summary || ''
  const spinEvaluation = evaluation.spin_evaluation || {}
  const topStrengths = evaluation.top_strengths || []
  const criticalGaps = evaluation.critical_gaps || []
  const priorityImprovements = evaluation.priority_improvements || []

  // Cor baseada no score
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'from-green-500/20 to-green-600/20 border-green-500/30'
    if (score >= 6) return 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30'
    return 'from-red-500/20 to-red-600/20 border-red-500/30'
  }

  const getLevelText = (level: string) => {
    const levels: Record<string, string> = {
      legendary: 'Lendário',
      excellent: 'Excelente',
      very_good: 'Muito Bom',
      good: 'Bom',
      needs_improvement: 'Precisa Melhorar',
      poor: 'Fraco'
    }
    return levels[level] || level
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-8 border border-green-500/20">
        {/* Header com score */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className={`w-8 h-8 ${getScoreColor(overallScore)}`} />
            <h2 className="text-2xl font-bold text-white">
              Sua Avaliação
            </h2>
          </div>

          {/* Score grande */}
          <div className={`inline-flex flex-col items-center p-6 rounded-2xl bg-gradient-to-br ${getScoreBgColor(overallScore)} border`}>
            <span className={`text-6xl font-bold ${getScoreColor(overallScore)}`}>
              {typeof overallScore === 'number' ? overallScore.toFixed(1) : overallScore}
            </span>
            <span className="text-gray-400 text-sm mt-1">de 10</span>
            <span className={`mt-2 px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(overallScore)} bg-black/30`}>
              {getLevelText(performanceLevel)}
            </span>
          </div>
        </div>

        {/* Resumo executivo */}
        {executiveSummary && (
          <div className="mb-8 p-4 bg-gray-800/50 rounded-xl border border-green-500/10">
            <p className="text-gray-300 text-sm leading-relaxed">
              {executiveSummary}
            </p>
          </div>
        )}

        {/* SPIN Scores */}
        {spinEvaluation && Object.keys(spinEvaluation).length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-green-400" />
              Avaliação SPIN
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {['S', 'P', 'I', 'N'].map((letter) => {
                const spinData = spinEvaluation[letter]
                const score = spinData?.final_score ?? 0
                const labels: Record<string, string> = {
                  S: 'Situação',
                  P: 'Problema',
                  I: 'Implicação',
                  N: 'Necessidade'
                }
                return (
                  <div
                    key={letter}
                    className="bg-gray-800/50 rounded-xl p-4 text-center border border-green-500/10"
                  >
                    <span className="text-2xl font-bold text-green-400">{letter}</span>
                    <p className="text-xs text-gray-500 mt-1">{labels[letter]}</p>
                    <p className={`text-xl font-bold mt-2 ${getScoreColor(score)}`}>
                      {typeof score === 'number' ? score.toFixed(1) : score}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pontos fortes */}
        {topStrengths.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Pontos Fortes
            </h3>
            <ul className="space-y-2">
              {topStrengths.slice(0, 5).map((strength: string, index: number) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-300"
                >
                  <Star className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gaps críticos */}
        {criticalGaps.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Áreas para Melhorar
            </h3>
            <ul className="space-y-2">
              {criticalGaps.slice(0, 5).map((gap: string, index: number) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-300"
                >
                  <ArrowRight className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Melhorias prioritárias */}
        {priorityImprovements.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              Próximos Passos
            </h3>
            <div className="space-y-3">
              {priorityImprovements.slice(0, 3).map((improvement: any, index: number) => (
                <div
                  key={index}
                  className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20"
                >
                  <p className="text-sm text-blue-400 font-medium">
                    {improvement.area || improvement}
                  </p>
                  {improvement.action_plan && (
                    <p className="text-xs text-gray-400 mt-1">
                      {improvement.action_plan}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="border-t border-green-500/10 pt-6">
          <div className="text-center mb-6">
            <p className="text-gray-400 text-sm mb-2">
              Gostou do teste? Com o Ramppy, você pode treinar quantas vezes quiser!
            </p>
            <p className="text-green-400 font-medium">
              Transforme seu time de vendas com IA
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onRestart}
              className="flex-1 py-3 bg-gray-700/50 text-white rounded-xl font-medium hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Fazer Outro Teste
            </button>
            <a
              href="https://ramppy.site"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-bold text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/50 transition-all flex items-center justify-center gap-2"
            >
              Conhecer o Ramppy
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
