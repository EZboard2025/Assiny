'use client'

import { Target } from 'lucide-react'
import SpinMetricCard from './SpinMetricCard'
import InsightsSection from './InsightsSection'

interface SpinTabProps {
  spinAverages: { S: number; P: number; I: number; N: number }
  spinTrends: { S: number | null; P: number | null; I: number | null; N: number | null }
  summaryData: {
    topStrengths: Array<{ text: string; count: number; sessions: number[] }>
    topGaps: Array<{ text: string; count: number; sessions: number[] }>
    allImprovements: any[]
  } | null
  loading: boolean
}

export default function SpinTab({ spinAverages, spinTrends, summaryData, loading }: SpinTabProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
              <div className="h-10 bg-gray-200 rounded w-16 mb-3" />
              <div className="h-2.5 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 4 SPIN Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SpinMetricCard pillar="S" label="Situação" score={spinAverages.S} trend={spinTrends.S} />
        <SpinMetricCard pillar="P" label="Problema" score={spinAverages.P} trend={spinTrends.P} />
        <SpinMetricCard pillar="I" label="Implicação" score={spinAverages.I} trend={spinTrends.I} />
        <SpinMetricCard pillar="N" label="Necessidade" score={spinAverages.N} trend={spinTrends.N} />
      </div>

      {/* Insights */}
      {summaryData ? (
        <InsightsSection
          topStrengths={summaryData.topStrengths}
          topGaps={summaryData.topGaps}
          allImprovements={summaryData.allImprovements}
        />
      ) : (
        <div className="bg-white rounded-2xl p-12 border border-gray-200 shadow-sm text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-900 text-lg font-semibold mb-2">Nenhum insight disponível</p>
          <p className="text-gray-500 text-sm">Complete sessões de roleplay para ver sua análise SPIN</p>
        </div>
      )}
    </div>
  )
}
