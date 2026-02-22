'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Share2, Lightbulb, TrendingUp, FileText, MessageCircle, CheckCircle, AlertTriangle,
  Loader2, Copy, Check, User, Building, DollarSign, CreditCard, TrendingDown,
  Shield, Target, Clock, Calendar, BarChart, Briefcase, Globe, Phone, Mail,
  MessageSquare, XCircle, HelpCircle, Settings, Zap, Award, Heart, Star, Flag,
  Bookmark, Package, Truck, ShoppingCart, Percent, PieChart, Activity, Layers,
  Database, Lock, Unlock, Eye, Search, Filter, Tag, Hash, ArrowUpRight,
  ArrowDownRight, Video
} from 'lucide-react'

const ICON_MAP: Record<string, any> = {
  User, Building, DollarSign, CreditCard, TrendingUp, TrendingDown, AlertTriangle,
  Shield, Target, Clock, Calendar, FileText, BarChart, Briefcase, Globe, Phone,
  Mail, MessageSquare, CheckCircle, XCircle, HelpCircle, Settings, Zap, Award,
  Heart, Star, Flag, Bookmark, Package, Truck, ShoppingCart, Percent, PieChart,
  Activity, Layers, Database, Lock, Unlock, Eye, Search, Filter, Tag, Hash,
  ArrowUpRight, ArrowDownRight, Video
}

function getIcon(name: string) {
  return ICON_MAP[name] || FileText
}

interface SharedEvaluationModalProps {
  shareId: string
  userId: string
  onClose: () => void
}

function cleanGptText(text: string): string {
  return text?.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\s*—\s*/g, ': ').replace(/\s*–\s*/g, ': ').trim() || ''
}

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(getText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
    >
      {copied ? <><Check className="w-3 h-3 text-green-500" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
    </button>
  )
}

function formatSmartNotesText(notes: any): string {
  const lines: string[] = []
  if (notes.lead_name) lines.push(`Lead: ${notes.lead_name}`)
  if (notes.lead_role) lines.push(`Cargo: ${notes.lead_role}`)
  if (notes.lead_company) lines.push(`Empresa: ${notes.lead_company}`)
  if (lines.length) lines.push('')

  notes.sections?.forEach((s: any) => {
    lines.push(`## ${s.title}`)
    if (s.insight) lines.push(s.insight)
    s.items?.forEach((item: any) => {
      lines.push(`- ${item.label}: ${item.value}`)
      item.sub_items?.forEach((sub: string) => lines.push(`  - ${sub}`))
    })
    lines.push('')
  })

  if (notes.next_steps?.length) {
    lines.push('## Próximos Passos')
    notes.next_steps.forEach((step: any, i: number) => {
      lines.push(`${i + 1}. ${step.action}${step.deadline ? ` (${step.deadline})` : ''}`)
    })
    lines.push('')
  }

  if (notes.deal_status) {
    lines.push('## Status da Oportunidade')
    if (notes.deal_status.summary) lines.push(notes.deal_status.summary)
    if (notes.deal_status.temperature) lines.push(`Temperatura: ${notes.deal_status.temperature}`)
    if (notes.deal_status.probability) lines.push(`Probabilidade: ${notes.deal_status.probability}`)
  }

  return lines.join('\n')
}

function formatTranscriptText(transcript: any[]): string {
  return transcript.map(seg => `${seg.speaker}: ${seg.text}`).join('\n\n')
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

  const notes = shared?.evaluation?.smart_notes
  const transcript = shared?.evaluation?.transcript

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

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
              {/* Smart Notes - Rich Rendering */}
              {shared.shared_sections?.includes('smart_notes') && notes && typeof notes === 'object' && notes.sections && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" /> Notas Inteligentes
                    </h3>
                    <CopyButton getText={() => formatSmartNotesText(notes)} />
                  </div>

                  {/* Lead Profile */}
                  {(notes.lead_name || notes.lead_company || notes.lead_role) && (
                    <div className="bg-cyan-50/50 border border-cyan-100 rounded-xl p-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-cyan-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-cyan-700" />
                        </div>
                        <div>
                          {notes.lead_name && <p className="text-sm font-semibold text-gray-900">{notes.lead_name}</p>}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {notes.lead_role && <span className="text-xs text-gray-600">{notes.lead_role}</span>}
                            {notes.lead_role && notes.lead_company && <span className="text-xs text-gray-400">|</span>}
                            {notes.lead_company && <span className="text-xs text-gray-600">{notes.lead_company}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Sections */}
                  <div className="space-y-3">
                    {notes.sections?.map((section: any) => {
                      const IconComp = getIcon(section.icon)
                      return (
                        <div key={section.id} className="bg-white rounded-lg p-3 border border-gray-100">
                          <div className="flex items-center gap-2 mb-2">
                            <IconComp className="w-3.5 h-3.5 text-gray-500" />
                            <h4 className="text-xs font-semibold text-gray-800">{section.title}</h4>
                            {section.priority === 'high' && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700">Importante</span>
                            )}
                          </div>
                          {section.insight && (
                            <p className="text-xs text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-lg px-2.5 py-1.5 mb-2 leading-relaxed">
                              {section.insight}
                            </p>
                          )}
                          <div className="space-y-1.5">
                            {section.items?.map((item: any, idx: number) => (
                              <div key={idx}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[11px] text-gray-500">{item.label}</span>
                                    <p className="text-xs text-gray-900 font-medium">{item.value}</p>
                                    {item.transcript_ref && (
                                      <p className="text-[10px] text-gray-400 italic mt-0.5">&ldquo;{item.transcript_ref}&rdquo;</p>
                                    )}
                                  </div>
                                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                                    item.source === 'explicit' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {item.source === 'explicit' ? 'citado' : 'inferido'}
                                  </span>
                                </div>
                                {item.sub_items?.length > 0 && (
                                  <div className="ml-2 mt-1 space-y-0.5">
                                    {item.sub_items.map((sub: string, si: number) => (
                                      <div key={si} className="flex items-start gap-1.5">
                                        <div className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 flex-shrink-0" />
                                        <p className="text-[11px] text-gray-600">{sub}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Next Steps */}
                  {notes.next_steps?.length > 0 && (
                    <div className="bg-green-50/50 border border-green-100 rounded-lg p-3 mt-3">
                      <h4 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Próximos Passos
                      </h4>
                      <div className="space-y-1.5">
                        {notes.next_steps.map((step: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="w-4 h-4 bg-green-100 text-green-700 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <p className="text-xs text-gray-800">{step.action}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${
                                  step.owner === 'seller' ? 'bg-blue-100 text-blue-700' :
                                  step.owner === 'client' ? 'bg-purple-100 text-purple-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {step.owner === 'seller' ? 'Vendedor' : step.owner === 'client' ? 'Cliente' : 'Ambos'}
                                </span>
                                {step.deadline && (
                                  <span className="text-[9px] text-gray-500 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" /> {step.deadline}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deal Status */}
                  {notes.deal_status && (
                    <div className="bg-white rounded-lg p-3 border border-gray-100 mt-3">
                      <h4 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-gray-600" /> Status da Oportunidade
                      </h4>
                      {notes.deal_status.summary && (
                        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 mb-2 leading-relaxed">
                          {notes.deal_status.summary}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <span className="text-[10px] text-gray-500">Temperatura</span>
                          <p className={`text-xs font-semibold ${
                            notes.deal_status.temperature === 'hot' ? 'text-green-600' :
                            notes.deal_status.temperature === 'warm' ? 'text-yellow-600' : 'text-blue-600'
                          }`}>
                            {notes.deal_status.temperature === 'hot' ? 'Quente' :
                             notes.deal_status.temperature === 'warm' ? 'Morno' : 'Frio'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-500">Probabilidade</span>
                          <p className="text-xs font-semibold text-gray-900">{notes.deal_status.probability || '-'}</p>
                        </div>
                      </div>
                      {notes.deal_status.buying_signals?.length > 0 && (
                        <div className="mb-1.5">
                          <span className="text-[10px] font-medium text-green-700">Sinais de compra</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {notes.deal_status.buying_signals.map((s: string, i: number) => (
                              <span key={i} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {notes.deal_status.risk_factors?.length > 0 && (
                        <div className="mb-1.5">
                          <span className="text-[10px] font-medium text-red-700">Riscos</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {notes.deal_status.risk_factors.map((r: string, i: number) => (
                              <span key={i} className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full border border-red-200">{r}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {notes.deal_status.blockers?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-medium text-orange-700">Bloqueios</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {notes.deal_status.blockers.map((b: string, i: number) => (
                              <span key={i} className="text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full border border-orange-200">{b}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Observations */}
                  {notes.custom_observations?.length > 0 && (
                    <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-3 mt-3">
                      <h4 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5 text-purple-600" /> Observações Personalizadas
                      </h4>
                      <div className="space-y-1.5">
                        {notes.custom_observations.map((obs: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2">
                            {obs.found ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="text-xs text-gray-800">{obs.observation}</p>
                              {obs.details && <p className="text-[11px] text-gray-500 mt-0.5">{obs.details}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Smart Notes - Fallback for string format */}
              {shared.shared_sections?.includes('smart_notes') && notes && (typeof notes === 'string' || (typeof notes === 'object' && !notes.sections)) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" /> Notas Inteligentes
                    </h3>
                    <CopyButton getText={() => typeof notes === 'string' ? notes : JSON.stringify(notes, null, 2)} />
                  </div>
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">
                    {typeof notes === 'string' ? notes : JSON.stringify(notes, null, 2)}
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
              {shared.shared_sections?.includes('transcript') && transcript?.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-purple-500" /> Transcrição ({transcript.length} segmentos)
                    </h3>
                    <CopyButton getText={() => formatTranscriptText(transcript)} />
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {transcript.map((seg: any, i: number) => (
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
