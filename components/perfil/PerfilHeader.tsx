'use client'

import { User, Award, TrendingUp, TrendingDown } from 'lucide-react'
import ConnectionsCard from './ConnectionsCard'
import MeetingsCard from './MeetingsCard'

interface PerfilHeaderProps {
  userName: string
  userEmail: string
  overallAverage: number
  totalSessions: number
  bestScore: number
  trend: number
  onViewHistory: () => void
  mounted: boolean
}

export default function PerfilHeader({
  userName,
  userEmail,
  overallAverage,
  totalSessions,
  bestScore,
  trend,
  onViewHistory,
  mounted,
}: PerfilHeaderProps) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
      {/* Column 1 — User Info */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {userName || 'Carregando...'}
        </h1>
        <p className="text-gray-500 text-sm flex items-center gap-2 mb-6">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          {userEmail || 'carregando@email.com'}
        </p>
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center">
            <User className="w-12 h-12 text-green-600" />
          </div>
        </div>
      </div>

      {/* Column 2 — Connections + KPI Stats */}
      <div className="space-y-4">
        <ConnectionsCard />

        {/* KPI Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm text-center">
            <Award className="w-5 h-5 text-green-600 mx-auto mb-2" />
            <p className={`text-2xl font-bold ${
              bestScore >= 7 ? 'text-green-600' :
              bestScore >= 5 ? 'text-yellow-600' : 'text-gray-900'
            }`}>
              {totalSessions > 0 ? bestScore.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Melhor Nota</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm text-center">
            {trend >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-2" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-2" />
            )}
            <p className={`text-2xl font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {totalSessions > 0 ? `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}` : '—'}
            </p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Tendencia</p>
          </div>
        </div>
      </div>

      {/* Column 3 — Meetings */}
      <MeetingsCard />
    </div>
  )
}
