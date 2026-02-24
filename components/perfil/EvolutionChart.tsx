'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TrendingUp, ArrowRight, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { ChartDataPoint } from '../PerfilView'

interface EvolutionChartProps {
  data: ChartDataPoint[]
  latestSession: { label: string; score: number; improvement: number } | null
  loading: boolean
}

type ViewMode = 'roleplay' | 'meet'

const MAX_VISIBLE = 10
const MODAL_PAGE_SIZE = 12

const LINE_CONFIG: Record<ViewMode, { key: string; name: string; color: string }> = {
  roleplay: { key: 'roleplay', name: 'Roleplay', color: '#22c55e' },
  meet: { key: 'meet', name: 'Meet Real', color: '#3b82f6' },
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 min-w-[160px]">
      <p className="text-xs text-gray-500 font-medium mb-2">Sessão {label}</p>
      {payload
        .filter((entry: any) => entry.value != null)
        .map((entry: any) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-xs text-gray-600">{entry.name}</span>
            </div>
            <span className="text-xs font-bold text-gray-900">{entry.value?.toFixed(1)}</span>
          </div>
        ))}
    </div>
  )
}

function ChartContent({ data, viewMode }: { data: ChartDataPoint[]; viewMode: ViewMode }) {
  const config = LINE_CONFIG[viewMode]
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={false}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 10]}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickCount={6}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey={config.key}
          name={config.name}
          stroke={config.color}
          strokeWidth={2.5}
          dot={{ fill: config.color, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, stroke: config.color, strokeWidth: 2, fill: '#fff' }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function EvolutionChart({ data, latestSession, loading }: EvolutionChartProps) {
  const [showModal, setShowModal] = useState(false)
  const [modalPage, setModalPage] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('roleplay')

  const hasRoleplay = data.some(d => d.roleplay !== null)
  const hasMeet = data.some(d => d.meet !== null)
  const hasData = hasRoleplay || hasMeet

  // Filter by type and number independently
  const filteredData = (viewMode === 'roleplay'
    ? data.filter(d => d.roleplay !== null)
    : data.filter(d => d.meet !== null)
  ).map((d, idx) => ({ ...d, label: `#${idx + 1}` }))

  // Mini chart: last MAX_VISIBLE points
  const visibleData = filteredData.length > MAX_VISIBLE ? filteredData.slice(-MAX_VISIBLE) : filteredData

  // Modal pagination
  const totalModalPages = Math.ceil(filteredData.length / MODAL_PAGE_SIZE)
  const modalData = filteredData.slice(modalPage * MODAL_PAGE_SIZE, (modalPage + 1) * MODAL_PAGE_SIZE)

  const openModal = () => {
    setModalPage(0)
    setShowModal(true)
  }

  const TOGGLE_OPTIONS: { value: ViewMode; label: string; color: string; available: boolean }[] = [
    { value: 'roleplay', label: 'Roleplay', color: 'bg-green-500 text-white', available: hasRoleplay },
    { value: 'meet', label: 'Meet Real', color: 'bg-blue-500 text-white', available: hasMeet },
  ]

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-5 bg-gray-200 rounded w-40 animate-pulse" />
        </div>
        <div className="h-72 bg-gray-50 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Evolução de Performance</h2>
              <p className="text-gray-500 text-sm">{filteredData.length} sessões</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle */}
            {hasData && (
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                {TOGGLE_OPTIONS.filter(o => o.available).map(option => (
                  <button
                    key={option.value}
                    onClick={() => { setViewMode(option.value); setModalPage(0) }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
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
            {latestSession && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="text-center">
                  <div className="text-[10px] font-bold text-green-600 mb-1 tracking-wider uppercase">
                    Ultima Simulacao
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="text-xs font-medium text-gray-500">Nota:</span>
                    <span className={`text-xl font-bold ${
                      latestSession.score >= 7 ? 'text-green-600' :
                      latestSession.score >= 5 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {latestSession.score.toFixed(1)}
                    </span>
                  </div>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-sm ${
                    latestSession.improvement >= 0
                      ? 'bg-green-50 text-green-600'
                      : 'bg-red-50 text-red-600'
                  }`}>
                    <TrendingUp className={`w-3.5 h-3.5 ${latestSession.improvement < 0 ? 'rotate-180' : ''}`} />
                    {latestSession.improvement >= 0 ? '+' : ''}{latestSession.improvement.toFixed(1)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!hasData ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-900 text-lg font-semibold mb-2">Nenhuma sessão avaliada ainda</p>
            <p className="text-gray-500 text-sm">Complete um roleplay para ver sua evolução</p>
          </div>
        ) : (
          <>
            <div className="h-80">
              <ChartContent data={visibleData} viewMode={viewMode} />
            </div>

            {/* Ver tudo */}
            <div className="flex items-center justify-end mt-3">
              {filteredData.length > MAX_VISIBLE && (
                <button
                  onClick={openModal}
                  className="flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 transition-colors cursor-pointer"
                >
                  Ver tudo
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Full Chart Modal (portal to body) */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Evolução Completa</h2>
                  <p className="text-gray-500 text-sm">{filteredData.length} sessões — {LINE_CONFIG[viewMode].name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Toggle in modal too */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                  {TOGGLE_OPTIONS.filter(o => o.available).map(option => (
                    <button
                      key={option.value}
                      onClick={() => { setViewMode(option.value); setModalPage(0) }}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        viewMode === option.value
                          ? option.color
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Chart */}
            <div className="p-6">
              <div className="h-96" key={`${viewMode}-${modalPage}`}>
                <ChartContent data={modalData} viewMode={viewMode} />
              </div>

              {/* Pagination */}
              {totalModalPages > 1 && (
                <div className="flex items-center justify-between mt-5">
                  <button
                    onClick={() => setModalPage(Math.max(0, modalPage - 1))}
                    disabled={modalPage === 0}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                      modalPage > 0
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer'
                        : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>

                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-500">Mostrando</span>
                    <span className="text-sm font-semibold text-green-600">
                      {modalPage * MODAL_PAGE_SIZE + 1} - {Math.min((modalPage + 1) * MODAL_PAGE_SIZE, filteredData.length)}
                    </span>
                    <span className="text-sm text-gray-500">de</span>
                    <span className="text-sm font-semibold text-green-600">{filteredData.length}</span>
                  </div>

                  <button
                    onClick={() => setModalPage(Math.min(totalModalPages - 1, modalPage + 1))}
                    disabled={modalPage >= totalModalPages - 1}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all ${
                      modalPage < totalModalPages - 1
                        ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer'
                        : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Proximo
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
