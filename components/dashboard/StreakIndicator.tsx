'use client'

import { Flame } from 'lucide-react'

interface StreakIndicatorProps {
  streak: number
  loading?: boolean
}

export default function StreakIndicator({ streak, loading }: StreakIndicatorProps) {
  if (loading) {
    return (
      <div className="animate-pulse flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full" />
        <div className="w-6 h-6 bg-gray-200 rounded" />
      </div>
    )
  }

  if (streak <= 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 group relative">
      <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full shadow-lg shadow-orange-500/30">
        <Flame className="w-4 h-4 text-white" />
      </div>
      <span className="text-xl font-bold text-orange-500">{streak}</span>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {streak === 1
          ? '1 dia consecutivo de treino!'
          : `${streak} dias consecutivos de treino!`}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  )
}
