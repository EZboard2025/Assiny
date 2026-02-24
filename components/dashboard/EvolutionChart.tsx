'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type ViewMode = 'roleplay' | 'meet'

interface EvolutionChartProps {
  data: Array<{ label: string; roleplay: number | null; meet: number | null }>
  loading?: boolean
  onClick?: () => void
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const validEntries = payload.filter((entry: any) => entry.value != null)
  if (validEntries.length === 0) return null
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 min-w-[140px]">
      <p className="text-xs text-gray-500 mb-1">Sessão {label}</p>
      {validEntries.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-gray-600">{entry.name}</span>
          </div>
          <span className="text-xs font-bold text-gray-900">{entry.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

export default function EvolutionChart({ data, loading, onClick }: EvolutionChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('roleplay')

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-40 mb-4" />
        <div className="h-[200px] bg-gray-100 rounded" />
      </div>
    )
  }

  const hasRoleplay = data.some(d => d.roleplay !== null)
  const hasM = data.some(d => d.meet !== null)
  const hasData = hasRoleplay || hasM

  // Filter data based on view mode and number independently
  const filteredData = (viewMode === 'roleplay'
    ? data.filter(d => d.roleplay !== null)
    : data.filter(d => d.meet !== null)
  ).map((d, idx) => ({ ...d, label: `#${idx + 1}` }))

  const TOGGLE_OPTIONS: { value: ViewMode; label: string; color: string; available: boolean }[] = [
    { value: 'roleplay', label: 'Roleplay', color: 'bg-green-500 text-white', available: hasRoleplay },
    { value: 'meet', label: 'Meet Real', color: 'bg-blue-500 text-white', available: hasM },
  ]

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-5 ${onClick ? 'cursor-pointer hover:border-green-300 hover:shadow-sm transition-all' : ''}`}
      onClick={onClick}
    >
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Evolução de Performance</h3>
        {hasData && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5" onClick={e => e.stopPropagation()}>
            {TOGGLE_OPTIONS.filter(o => o.available).map(option => (
              <button
                key={option.value}
                onClick={() => setViewMode(option.value)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  viewMode === option.value
                    ? option.color
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-sm text-gray-400">Sem sessões avaliadas ainda</p>
        </div>
      ) : (
        /* Single series — AreaChart */
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="scoreGradientRoleplay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="scoreGradientMeet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="label"
                tick={false}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickCount={6}
              />
              <Tooltip content={<CustomTooltip />} />
              {viewMode === 'roleplay' ? (
                <Area
                  type="monotone"
                  dataKey="roleplay"
                  name="Roleplay"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#scoreGradientRoleplay)"
                  dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: '#22c55e', strokeWidth: 2, fill: '#fff' }}
                  connectNulls
                />
              ) : (
                <Area
                  type="monotone"
                  dataKey="meet"
                  name="Meet Real"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#scoreGradientMeet)"
                  dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                  connectNulls
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
