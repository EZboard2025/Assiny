'use client'

import { User, Users } from 'lucide-react'

interface PersonaStats {
  persona: any
  count: number
  scores: number[]
  average: number
  lastPractice: string
}

interface PersonasTabProps {
  personaStats: Map<string, PersonaStats>
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

function getLineColor(score: number) {
  if (score >= 7) return '#10b981'
  if (score >= 5) return '#eab308'
  return '#ef4444'
}

export default function PersonasTab({ personaStats, loading }: PersonasTabProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl" />
              <div>
                <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-48" />
              </div>
            </div>
            <div className="h-36 bg-gray-50 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  if (personaStats.size === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-gray-200 shadow-sm text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-900 text-lg font-semibold mb-2">Nenhuma prática com personas ainda</p>
        <p className="text-gray-500 text-sm">Complete sessões de roleplay para ver estatísticas por persona</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {Array.from(personaStats.values()).map((stat, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900 mb-0.5">
                  {stat.persona.cargo || stat.persona.job_title || 'Cargo não especificado'}
                </h3>
                <p className="text-sm text-gray-500 truncate">
                  {stat.persona.tipo_empresa_faturamento || stat.persona.company_type || 'Empresa não especificada'}
                </p>
              </div>
            </div>
            <div className={`${getScoreBg(stat.average)} rounded-lg px-3 py-1.5`}>
              <div className="text-[10px] text-gray-500 text-center uppercase">Média</div>
              <div className={`text-2xl font-bold ${getScoreColor(stat.average)} text-center`}>
                {stat.average.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Práticas realizadas</span>
              <span className="font-semibold text-gray-900">{stat.count}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Última prática</span>
              <span className="text-sm text-gray-700">
                {new Date(stat.lastPractice).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Mini evolution chart - Fixed colors for white bg */}
          <div className="pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2">Evolução das notas</div>
            <div className="relative h-44 bg-gray-50 rounded-xl p-3">
              <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
                {/* Grid lines - proper colors for light bg */}
                <defs>
                  <linearGradient id={`gradient-persona-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={getLineColor(stat.average)} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={getLineColor(stat.average)} stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => {
                  const y = 180 - (value / 10) * 160
                  return (
                    <g key={value}>
                      <line
                        x1="35"
                        y1={y}
                        x2="380"
                        y2={y}
                        stroke={value % 5 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.03)'}
                        strokeWidth={value % 5 === 0 ? '1' : '0.5'}
                      />
                      <text x="25" y={y + 4} fill="#9CA3AF" fontSize="10" textAnchor="end">
                        {value}
                      </text>
                    </g>
                  )
                })}

                {/* Area */}
                {stat.scores.length > 1 && (
                  <path
                    d={
                      stat.scores.map((score, idx) => {
                        const xSpacing = 340 / (stat.scores.length - 1)
                        const x = 40 + idx * xSpacing
                        const y = 180 - (score / 10) * 160
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                      }).join(' ') + ` L ${stat.scores.length === 1 ? 40 : 380} 180 L 40 180 Z`
                    }
                    fill={`url(#gradient-persona-${i})`}
                  />
                )}

                {/* Line */}
                {stat.scores.length > 1 && (
                  <path
                    d={stat.scores.map((score, idx) => {
                      const xSpacing = 340 / (stat.scores.length - 1)
                      const x = 40 + idx * xSpacing
                      const y = 180 - (score / 10) * 160
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                    }).join(' ')}
                    fill="none"
                    stroke={getLineColor(stat.average)}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Points */}
                {stat.scores.map((score, idx) => {
                  const xSpacing = stat.scores.length === 1 ? 0 : 340 / (stat.scores.length - 1)
                  const x = 40 + idx * xSpacing
                  const y = 180 - (score / 10) * 160
                  const color = getLineColor(score)
                  return (
                    <g key={idx}>
                      <circle cx={x} cy={y} r="5" fill={color} stroke="#fff" strokeWidth="2" />
                      <title>Sessão {idx + 1}: {score.toFixed(1)}/10</title>
                    </g>
                  )
                })}

                {/* X-axis labels */}
                {stat.scores.length <= 15 && stat.scores.map((_, idx) => {
                  const xSpacing = stat.scores.length === 1 ? 0 : 340 / (stat.scores.length - 1)
                  const x = 40 + idx * xSpacing
                  return (
                    <text key={idx} x={x} y={195} fill="#9CA3AF" fontSize="10" textAnchor="middle">
                      S{idx + 1}
                    </text>
                  )
                })}
              </svg>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
