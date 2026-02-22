'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Share2, Lightbulb, TrendingUp, FileText, MessageCircle, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

interface SharedEvaluationModalProps {
  shareId: string
  userId: string
  onClose: () => void
}

function cleanGptText(text: string): string {
  return text?.replace(/^\*\*|\*\*$/g, '').replace(/\*\*/g, '') || ''
}

export default function SharedEvaluationModal({ shareId, userId, onClose }: SharedEvaluationModalProps) {
  const [loading, setLoading] = useState(true)
  const [shared, setShared] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchShared = async () => {
      try {
        const res = await fetch(`/api/meet/shared?userId=${userId}`)
        if (!res.ok) throw new Error('Erro ao buscar dados')

        const data = await res.json()
        const found = (data.shares || []).find((s: any) => s.id === shareId)
        if (!found) throw new Error('Compartilhamento não encontrado')

        setShared(found)

        // Mark as viewed
        await fetch('/api/meet/shared', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareId, userId })
        })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchShared()
  }, [shareId, userId])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
          {loading ? (
            <div className="h-12" />
          ) : shared ? (
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-blue-600 font-medium">Compartilhado por {shared.shared_by_name}</span>
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  {shared.evaluation?.seller_name || 'Reunião'}
                </h2>
                <div className="text-sm text-gray-500 mt-0.5">
                  Score: {shared.evaluation?.overall_score ? Math.round(shared.evaluation.overall_score / 10) : '--'}/10
                  {shared.evaluation?.created_at && (
                    <span className="ml-2">
                      · {new Date(shared.evaluation.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
                {shared.message && (
                  <p className="text-sm text-gray-600 mt-2 italic bg-blue-50 rounded-lg px-3 py-1.5">&ldquo;{shared.message}&rdquo;</p>
                )}
              </div>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-500">{error}</span>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Carregando dados compartilhados...</p>
            </div>
          )}

          {!loading && shared && (
            <>
              {/* Smart Notes */}
              {shared.shared_sections?.includes('smart_notes') && shared.evaluation?.smart_notes && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" /> Notas Inteligentes
                  </h3>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">
                    {typeof shared.evaluation.smart_notes === 'string'
                      ? shared.evaluation.smart_notes
                      : JSON.stringify(shared.evaluation.smart_notes, null, 2)}
                  </pre>
                </div>
              )}

              {/* SPIN */}
              {shared.shared_sections?.includes('spin') && shared.evaluation?.spin_s_score !== null && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" /> Análise SPIN
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'S', value: shared.evaluation.spin_s_score, color: 'bg-cyan-500' },
                      { label: 'P', value: shared.evaluation.spin_p_score, color: 'bg-emerald-500' },
                      { label: 'I', value: shared.evaluation.spin_i_score, color: 'bg-amber-500' },
                      { label: 'N', value: shared.evaluation.spin_n_score, color: 'bg-pink-500' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center">
                        <div className="text-lg font-bold text-gray-800">{value ?? '--'}</div>
                        <div className={`h-1.5 rounded-full ${color} mt-1`} style={{ width: `${Math.min((value || 0) * 10, 100)}%`, margin: '0 auto' }} />
                        <div className="text-[11px] text-gray-500 mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evaluation */}
              {shared.shared_sections?.includes('evaluation') && shared.evaluation?.evaluation && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" /> Avaliação Detalhada
                  </h3>
                  {shared.evaluation.evaluation.executive_summary && (
                    <p className="text-sm text-gray-600 mb-3">{shared.evaluation.evaluation.executive_summary}</p>
                  )}
                  {shared.evaluation.evaluation.top_strengths?.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs font-semibold text-green-600">Pontos Fortes:</span>
                      <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                        {shared.evaluation.evaluation.top_strengths.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-1"><CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />{cleanGptText(s)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {shared.evaluation.evaluation.critical_gaps?.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-red-600">Gaps Críticos:</span>
                      <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                        {shared.evaluation.evaluation.critical_gaps.map((g: string, i: number) => (
                          <li key={i} className="flex items-start gap-1"><AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />{cleanGptText(g)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Transcript */}
              {shared.shared_sections?.includes('transcript') && shared.evaluation?.transcript?.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-purple-500" /> Transcrição ({shared.evaluation.transcript.length} segmentos)
                  </h3>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {shared.evaluation.transcript.map((seg: any, i: number) => (
                      <div key={i} className={`text-xs p-2 rounded-lg ${seg.speaker?.toLowerCase().includes('seller') || seg.speaker?.toLowerCase().includes('vendedor') ? 'bg-green-50 text-green-800' : 'bg-white text-gray-700'}`}>
                        <span className="font-semibold">{seg.speaker}: </span>
                        {seg.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
