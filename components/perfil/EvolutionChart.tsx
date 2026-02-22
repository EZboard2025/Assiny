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

const MAX_VISIBLE = 10
const MODAL_PAGE_SIZE = 12

const LINES = [
  { key: 'roleplay', name: 'Roleplay', color: '#22c55e', width: 2.5 },
  { key: 'meet', name: 'Meet Real', color: '#3b82f6', width: 2.5 },
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3 min-w-[160px]">
      <p className="text-xs text-gray-500 font-medium mb-2">{label}</p>
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

function ChartContent({ data }: { data: ChartDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
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
        {LINES.map(line => (
          <Line
            key={line.key}
            type="natural"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={line.width}
            dot={false}
            activeDot={{ r: 5, stroke: line.color, strokeWidth: 2, fill: '#fff' }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4">
      {LINES.map(line => (
        <div key={line.key} className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: line.color }} />
          {line.name}
        </div>
      ))}
    </div>
  )
}

export default function EvolutionChart({ data, latestSession, loading }: EvolutionChartProps) {
  const [showModal, setShowModal] = useState(false)
  const [modalPage, setModalPage] = useState(0)

  // Mini chart: last MAX_VISIBLE points
  const visibleData = data.length > MAX_VISIBLE ? data.slice(-MAX_VISIBLE) : data

  // Modal pagination
  const totalModalPages = Math.ceil(data.length / MODAL_PAGE_SIZE)
  const modalData = data.slice(modalPage * MODAL_PAGE_SIZE, (modalPage + 1) * MODAL_PAGE_SIZE)

  const openModal = () => {
    setModalPage(0)
    setShowModal(true)
  }

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
              <h2 className="text-lg font-bold text-gray-900">Evolucao Geral</h2>
              <p className="text-gray-500 text-sm">Roleplay + Meet real</p>
            </div>
          </div>
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

        {data.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-900 text-lg font-semibold mb-2">Nenhuma sessao avaliada ainda</p>
            <p className="text-gray-500 text-sm">Complete um roleplay para ver sua evolucao</p>
          </div>
        ) : (
          <>
            <div className="h-80">
              <ChartContent data={visibleData} />
            </div>

            {/* Legend + Ver tudo */}
            <div className="flex items-center justify-between mt-3">
              <Legend />

              {data.length > MAX_VISIBLE && (
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
                  <h2 className="text-lg font-bold text-gray-900">Evolucao Completa</h2>
                  <p className="text-gray-500 text-sm">{data.length} sessoes — Roleplay + Meet real</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Chart */}
            <div className="p-6">
              <div className="h-96" key={modalPage}>
                <ChartContent data={modalData} />
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center mt-2">
                <Legend />
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
                      {modalPage * MODAL_PAGE_SIZE + 1} - {Math.min((modalPage + 1) * MODAL_PAGE_SIZE, data.length)}
                    </span>
                    <span className="text-sm text-gray-500">de</span>
                    <span className="text-sm font-semibold text-green-600">{data.length}</span>
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
