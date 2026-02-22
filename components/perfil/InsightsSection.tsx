'use client'

import { CheckCircle, AlertTriangle, Lightbulb } from 'lucide-react'

interface InsightItem {
  text: string
  count: number
  sessions: number[]
}

interface Improvement {
  area: string
  current_gap: string
  action_plan: string
  priority: string
  sessionNum?: number
}

interface InsightsSectionProps {
  topStrengths: InsightItem[]
  topGaps: InsightItem[]
  allImprovements: Improvement[]
}

export default function InsightsSection({
  topStrengths,
  topGaps,
  allImprovements,
}: InsightsSectionProps) {
  if (topStrengths.length === 0 && topGaps.length === 0 && allImprovements.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Pontos Fortes */}
      {topStrengths.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 p-5 pb-0">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Pontos Fortes Recorrentes</h3>
              <p className="text-xs text-gray-500">Últimas 5 sessões</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {topStrengths.map((item, i) => (
              <div key={i} className="bg-green-50 border border-green-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 font-semibold text-sm">{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{item.text}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.sessions?.map((sessionNum, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                          #{sessionNum}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps Críticos */}
      {topGaps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 p-5 pb-0">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Gaps Críticos Recorrentes</h3>
              <p className="text-xs text-gray-500">Áreas que precisam de atenção</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {topGaps.map((item, i) => (
              <div key={i} className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{item.text}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.sessions?.map((sessionNum, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                          #{sessionNum}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Melhorias Prioritárias */}
      {allImprovements.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 p-5 pb-0">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Melhorias Prioritárias</h3>
              <p className="text-xs text-gray-500">Ações recomendadas</p>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {allImprovements.map((imp, i) => (
              <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${
                    imp.priority === 'critical'
                      ? 'bg-red-100 text-red-700'
                      : imp.priority === 'high'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {imp.priority === 'critical' ? 'Crítico' :
                     imp.priority === 'high' ? 'Alto' : 'Médio'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm text-gray-900">{imp.area}</p>
                      {imp.sessionNum && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium flex-shrink-0">
                          #{imp.sessionNum}
                        </span>
                      )}
                    </div>
                    {imp.current_gap && (
                      <p className="text-sm text-gray-600 mb-2">{imp.current_gap}</p>
                    )}
                    {imp.action_plan && (
                      <div className="flex items-start gap-2 p-2 bg-white rounded-lg">
                        <Lightbulb className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700">{imp.action_plan}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
