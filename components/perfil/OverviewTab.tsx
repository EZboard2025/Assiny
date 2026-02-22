'use client'

import { Zap } from 'lucide-react'
import EvolutionChart from './EvolutionChart'
import type { ChartDataPoint } from '../PerfilView'

interface EvolutionPoint {
  label: string
  score: number
  date: string
}

interface OverviewTabProps {
  evolutionData: EvolutionPoint[]
  multiSeriesData: ChartDataPoint[]
  latestSession: { label: string; score: number; improvement: number } | null
  loading: boolean
  overallAverage: number
  totalSessions: number
  bestScore: number
  trend: number
  spinAverages: { S: number; P: number; I: number; N: number }
}

function getScoreColor(s: number) {
  if (s >= 7) return 'text-green-600'
  if (s >= 5) return 'text-yellow-600'
  return 'text-red-600'
}

function getBarColor(s: number) {
  if (s >= 7) return 'bg-green-500'
  if (s >= 5) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function OverviewTab({
  multiSeriesData,
  latestSession,
  loading,
  spinAverages,
}: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Evolution Chart */}
      <div className="lg:col-span-2">
        <EvolutionChart data={multiSeriesData} latestSession={latestSession} loading={loading} />
      </div>

      {/* Right Column - SPIN Metrics */}
      <div>
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Metricas SPIN</h3>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { key: 'S', label: 'Situacao', score: spinAverages.S },
                { key: 'P', label: 'Problema', score: spinAverages.P },
                { key: 'I', label: 'Implicacao', score: spinAverages.I },
                { key: 'N', label: 'Necessidade', score: spinAverages.N },
              ].map(metric => {
                const hasScore = metric.score > 0
                return (
                  <div key={metric.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full ${hasScore ? getBarColor(metric.score) : 'bg-gray-300'}`} />
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">{metric.key}</span>
                        <p className="text-sm font-medium text-gray-900">{metric.label}</p>
                      </div>
                    </div>
                    <span className={`text-xl font-bold ${hasScore ? getScoreColor(metric.score) : 'text-gray-400'}`}>
                      {hasScore ? metric.score.toFixed(1) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
