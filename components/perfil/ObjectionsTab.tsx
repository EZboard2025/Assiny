'use client'

import { MessageSquare } from 'lucide-react'

interface ObjectionStats {
  name: string
  count: number
  scores: number[]
  average: number
  bestScore: number
}

interface ObjectionsTabProps {
  objectionStats: Map<string, ObjectionStats>
  loading: boolean
}

function getScoreColor(score: number) {
  if (score >= 7) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreBg(score: number) {
  if (score >= 7) return 'bg-green-50'
  if (score >= 5) return 'bg-yellow-50'
  return 'bg-red-50'
}

function getBarColor(score: number) {
  if (score >= 7) return 'bg-green-500'
  if (score >= 5) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function ObjectionsTab({ objectionStats, loading }: ObjectionsTabProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl" />
              <div>
                <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  if (objectionStats.size === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-gray-200 shadow-sm text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-900 text-lg font-semibold mb-2">Nenhuma objeção enfrentada ainda</p>
        <p className="text-gray-500 text-sm">Complete sessões de roleplay para ver estatísticas por objeção</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from(objectionStats.values()).map((stat, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900 line-clamp-2">
                  {stat.name}
                </h3>
              </div>
            </div>
            <div className={`${getScoreBg(stat.average)} rounded-lg px-3 py-1.5 flex-shrink-0`}>
              <div className="text-[10px] text-gray-500 text-center uppercase">Média</div>
              <div className={`text-2xl font-bold ${getScoreColor(stat.average)} text-center`}>
                {stat.average.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-sm text-gray-500">Vezes enfrentada</span>
              <div className="font-semibold text-gray-900 text-lg">{stat.count}</div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Melhor nota</span>
              <div className={`font-semibold text-lg ${getScoreColor(stat.bestScore)}`}>
                {stat.bestScore.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2">Desempenho médio</div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${getBarColor(stat.average)}`}
                style={{ width: `${(stat.average / 10) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
