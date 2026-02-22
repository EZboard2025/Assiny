'use client'

import { TrendingUp, TrendingDown, Search, Settings, Zap, Target } from 'lucide-react'

interface SpinMetricCardProps {
  pillar: 'S' | 'P' | 'I' | 'N'
  label: string
  score: number
  trend: number | null
}

const PILLAR_CONFIG: Record<string, { icon: any; bgColor: string; iconColor: string }> = {
  S: { icon: Search, bgColor: 'bg-cyan-50', iconColor: 'text-cyan-600' },
  P: { icon: Settings, bgColor: 'bg-green-50', iconColor: 'text-green-600' },
  I: { icon: Zap, bgColor: 'bg-amber-50', iconColor: 'text-amber-600' },
  N: { icon: Target, bgColor: 'bg-pink-50', iconColor: 'text-pink-600' },
}

function getScoreColor(score: number) {
  if (score >= 7) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-600'
}

function getBarColor(score: number) {
  if (score >= 7) return 'bg-green-500'
  if (score >= 5) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function SpinMetricCard({ pillar, label, score, trend }: SpinMetricCardProps) {
  const hasScore = score > 0
  const config = PILLAR_CONFIG[pillar]
  const Icon = config.icon

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${config.bgColor} rounded-xl flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">{pillar}</span>
            <p className="text-sm font-semibold text-gray-900">{label}</p>
          </div>
        </div>
        {trend !== null && trend !== 0 && (
          <div
            className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
              trend > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
            }`}
          >
            {trend > 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {trend > 0 ? '+' : ''}
            {trend.toFixed(1)}
          </div>
        )}
      </div>

      <div className={`text-4xl font-bold mb-3 ${hasScore ? getScoreColor(score) : 'text-gray-300'}`}>
        {hasScore ? score.toFixed(1) : '—'}
      </div>

      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${hasScore ? getBarColor(score) : ''}`}
          style={{ width: hasScore ? `${(score / 10) * 100}%` : '0%' }}
        />
      </div>
    </div>
  )
}
