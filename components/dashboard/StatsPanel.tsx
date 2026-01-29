'use client'

import { Flame, ChevronRight } from 'lucide-react'

interface StatsPanelProps {
  overallAverage: number
  totalSessions: number
  spinScores: { S: number, P: number, I: number, N: number }
  streak: number
  onViewProfile: () => void
  onViewHistory: () => void
  loading: boolean
}

export default function StatsPanel({
  overallAverage,
  totalSessions,
  spinScores,
  streak,
  onViewProfile,
  onViewHistory,
  loading
}: StatsPanelProps) {

  // Função para determinar cor baseada no score
  const getScoreColor = (score: number) => {
    if (score >= 7) return 'bg-green-500'
    if (score >= 5) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getScoreTextColor = (score: number) => {
    if (score >= 7) return 'text-green-600'
    if (score >= 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const spinItems = [
    { label: 'Situação', key: 'S' as const, color: 'green' },
    { label: 'Problema', key: 'P' as const, color: 'green' },
    { label: 'Implicação', key: 'I' as const, color: 'green' },
    { label: 'Necessidade', key: 'N' as const, color: 'green' },
  ]

  if (loading) {
    return (
      <aside className="fixed right-0 top-0 h-screen w-80 bg-white border-l border-gray-200 z-40 overflow-y-auto py-8 px-6 hidden xl:block">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-16 bg-gray-200 rounded w-24 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-20 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="fixed right-0 top-0 h-screen w-80 bg-white border-l border-gray-200 z-40 overflow-y-auto py-8 px-6 hidden xl:block">
      {/* Streak Badge */}
      {streak > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold text-orange-600">{streak}</span>
          </div>
          <span className="text-xs text-gray-500">dias seguidos</span>
        </div>
      )}

      {/* Média Geral */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Média Geral
        </p>
        <div className="flex items-baseline gap-2">
          <span className={`text-5xl font-bold ${getScoreTextColor(overallAverage)}`}>
            {overallAverage > 0 ? overallAverage.toFixed(1) : '—'}
          </span>
          {overallAverage > 0 && (
            <span className="text-gray-400 text-lg">/10</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {totalSessions} {totalSessions === 1 ? 'sessão' : 'sessões'}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={onViewProfile}
          className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Resumo Detalhado
        </button>
        <button
          onClick={onViewHistory}
          className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
        >
          Histórico Roleplays
        </button>
      </div>

      {/* SPIN Scores */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Métricas SPIN
        </p>

        {spinItems.map((item) => {
          const score = spinScores[item.key]
          const hasScore = score > 0

          return (
            <div
              key={item.key}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-8 rounded-full ${hasScore ? getScoreColor(score) : 'bg-gray-300'}`} />
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    {item.key}
                  </span>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                </div>
              </div>
              <span className={`text-xl font-bold ${hasScore ? getScoreTextColor(score) : 'text-gray-400'}`}>
                {hasScore ? score.toFixed(1) : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Dica se não houver sessões */}
      {totalSessions === 0 && (
        <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100">
          <p className="text-sm text-green-800">
            Complete sua primeira simulação para ver suas métricas aqui!
          </p>
        </div>
      )}
    </aside>
  )
}
