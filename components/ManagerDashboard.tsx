'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Users, TrendingUp, Filter } from 'lucide-react'

interface Evaluation {
  id: string
  user_id: string
  company_id: string
  contact_phone: string
  contact_name: string | null
  round_number: number
  round_messages: string
  round_start: string
  round_end: string
  message_count: number
  avaliacao: any
  nota_final: number
  classificacao: string
  created_at: string
  seller_name: string
}

interface Seller {
  id: string
  name: string
}

interface ManagerDashboardProps {
  authToken: string
}

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-400'
  if (score >= 6) return 'text-yellow-400'
  if (score >= 4) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreBg(score: number): string {
  if (score >= 8) return 'bg-green-500/20 border-green-500/30'
  if (score >= 6) return 'bg-yellow-500/20 border-yellow-500/30'
  if (score >= 4) return 'bg-orange-500/20 border-orange-500/30'
  return 'bg-red-500/20 border-red-500/30'
}

function getClassificacaoLabel(classificacao: string): string {
  const labels: Record<string, string> = {
    excelente: 'Excelente',
    bom: 'Bom',
    medio: 'Médio',
    ruim: 'Ruim',
    pessimo: 'Péssimo',
    indefinido: 'N/A'
  }
  return labels[classificacao] || classificacao
}

export default function ManagerDashboard({ authToken }: ManagerDashboardProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSeller, setSelectedSeller] = useState<string>('all')
  const [selectedDays, setSelectedDays] = useState<number>(7)
  const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null)
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchEvaluations()
  }, [authToken, selectedSeller, selectedDays])

  const fetchEvaluations = async () => {
    if (!authToken) return
    setLoading(true)

    try {
      const params = new URLSearchParams({ days: selectedDays.toString() })
      if (selectedSeller !== 'all') {
        params.set('seller', selectedSeller)
      }

      const response = await fetch(`/api/manager/evaluations?${params}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      setEvaluations(data.evaluations || [])
      setSellers(data.sellers || [])

      // Auto-expand all sellers
      const sellerIds = new Set<string>((data.evaluations || []).map((e: Evaluation) => e.user_id))
      setExpandedSellers(sellerIds)
    } catch (err) {
      console.error('Error fetching evaluations:', err)
    } finally {
      setLoading(false)
    }
  }

  // Group evaluations by seller
  const sellerGroups = evaluations.reduce<Record<string, { name: string; evals: Evaluation[] }>>((acc, ev) => {
    if (!acc[ev.user_id]) {
      acc[ev.user_id] = { name: ev.seller_name, evals: [] }
    }
    acc[ev.user_id].evals.push(ev)
    return acc
  }, {})

  const toggleSeller = (sellerId: string) => {
    setExpandedSellers(prev => {
      const next = new Set(prev)
      if (next.has(sellerId)) next.delete(sellerId)
      else next.add(sellerId)
      return next
    })
  }

  const getSellerAverage = (evals: Evaluation[]): number => {
    if (evals.length === 0) return 0
    return evals.reduce((sum, e) => sum + e.nota_final, 0) / evals.length
  }

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef]">
      {/* Header */}
      <div className="bg-[#202c33] px-6 py-4 border-b border-[#222d34]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-purple-400" />
            <h1 className="text-xl font-semibold">Dashboard do Gestor</h1>
            <span className="text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded-full">
              {evaluations.length} avaliações
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111b21] px-6 py-3 border-b border-[#222d34]">
        <div className="max-w-6xl mx-auto flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#8696a0]" />
            <span className="text-sm text-[#8696a0]">Filtros:</span>
          </div>

          <select
            value={selectedSeller}
            onChange={e => setSelectedSeller(e.target.value)}
            className="bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-1.5 border border-[#3b4a54] outline-none"
          >
            <option value="all">Todos vendedores</option>
            {sellers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={selectedDays}
            onChange={e => setSelectedDays(parseInt(e.target.value))}
            className="bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-1.5 border border-[#3b4a54] outline-none"
          >
            <option value={1}>Hoje</option>
            <option value={3}>Últimos 3 dias</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6 flex gap-6">
        {/* Left: Evaluation list */}
        <div className="flex-1 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : Object.keys(sellerGroups).length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-12 h-12 text-[#3b4a54] mx-auto mb-3" />
              <p className="text-[#8696a0]">Nenhuma avaliação encontrada</p>
              <p className="text-[#8696a0] text-sm mt-1">
                As avaliações aparecem automaticamente quando os vendedores conversam com clientes.
              </p>
            </div>
          ) : (
            Object.entries(sellerGroups).map(([sellerId, group]) => {
              const avg = getSellerAverage(group.evals)
              const isExpanded = expandedSellers.has(sellerId)

              return (
                <div key={sellerId} className="bg-[#111b21] rounded-xl border border-[#222d34] overflow-hidden">
                  {/* Seller header */}
                  <button
                    onClick={() => toggleSeller(sellerId)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#182229] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[#8696a0]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#8696a0]" />
                      )}
                      <span className="font-medium">{group.name}</span>
                      <span className="text-xs text-[#8696a0]">
                        {group.evals.length} avaliação(ões)
                      </span>
                    </div>
                    <div className={`text-sm font-semibold ${getScoreColor(avg)}`}>
                      Média: {avg.toFixed(1)}
                    </div>
                  </button>

                  {/* Evaluation list */}
                  {isExpanded && (
                    <div className="border-t border-[#222d34]">
                      {group.evals.map(ev => (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEval(ev)}
                          className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-[#182229] transition-colors text-left border-b border-[#222d34] last:border-b-0 ${
                            selectedEval?.id === ev.id ? 'bg-[#182229]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 pl-7">
                            <div>
                              <span className="text-sm">
                                {ev.contact_name || ev.contact_phone}
                              </span>
                              <span className="text-xs text-[#8696a0] ml-2">
                                Round {ev.round_number}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-semibold px-2 py-0.5 rounded border ${getScoreBg(ev.nota_final)} ${getScoreColor(ev.nota_final)}`}>
                              {ev.nota_final.toFixed(1)} {getClassificacaoLabel(ev.classificacao)}
                            </span>
                            <span className="text-xs text-[#8696a0]">
                              {new Date(ev.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                              {new Date(ev.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Right: Detail panel */}
        {selectedEval && (
          <div className="w-[400px] shrink-0">
            <div className="bg-[#111b21] rounded-xl border border-[#222d34] p-4 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-sm">
                  {selectedEval.contact_name || selectedEval.contact_phone} — Round {selectedEval.round_number}
                </h3>
                <button
                  onClick={() => setSelectedEval(null)}
                  className="text-[#8696a0] hover:text-[#e9edef] text-xs"
                >
                  Fechar
                </button>
              </div>

              {/* Score */}
              <div className={`text-center py-3 rounded-lg mb-4 border ${getScoreBg(selectedEval.nota_final)}`}>
                <div className={`text-3xl font-bold ${getScoreColor(selectedEval.nota_final)}`}>
                  {selectedEval.nota_final.toFixed(1)}
                </div>
                <div className={`text-sm ${getScoreColor(selectedEval.nota_final)}`}>
                  {getClassificacaoLabel(selectedEval.classificacao)}
                </div>
              </div>

              {/* Criteria scores */}
              {selectedEval.avaliacao?.notas && (
                <div className="space-y-2 mb-4">
                  {Object.entries(selectedEval.avaliacao.notas as Record<string, { nota: number; peso: number; comentario: string }>).map(([key, val]) => {
                    const labels: Record<string, string> = {
                      valor_agregado: 'Valor Agregado',
                      personalizacao: 'Personalização',
                      tom_consultivo: 'Tom Consultivo',
                      objetividade: 'Objetividade',
                      cta: 'CTA',
                      timing: 'Timing'
                    }
                    return (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-[#8696a0]">{labels[key] || key}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-[#2a3942] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                val.nota >= 8 ? 'bg-green-500' :
                                val.nota >= 6 ? 'bg-yellow-500' :
                                val.nota >= 4 ? 'bg-orange-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${(val.nota / 10) * 100}%` }}
                            />
                          </div>
                          <span className={`font-medium w-8 text-right ${getScoreColor(val.nota)}`}>
                            {val.nota?.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Positive points */}
              {selectedEval.avaliacao?.pontos_positivos?.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-green-400 mb-1">Pontos Positivos</h4>
                  <ul className="space-y-1">
                    {selectedEval.avaliacao.pontos_positivos.map((p: string, i: number) => (
                      <li key={i} className="text-xs text-[#8696a0] flex gap-1.5">
                        <span className="text-green-400 shrink-0">+</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Points to improve */}
              {selectedEval.avaliacao?.pontos_melhorar?.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-medium text-orange-400 mb-1">Pontos a Melhorar</h4>
                  <ul className="space-y-1">
                    {selectedEval.avaliacao.pontos_melhorar.map((p: any, i: number) => (
                      <li key={i} className="text-xs text-[#8696a0]">
                        <span className="text-orange-400">-</span>{' '}
                        {typeof p === 'string' ? p : `${p.problema}: ${p.como_resolver}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Main tip */}
              {selectedEval.avaliacao?.dica_principal && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-purple-300 mb-1">Dica Principal</h4>
                  <p className="text-xs text-[#8696a0]">{selectedEval.avaliacao.dica_principal}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="mt-4 pt-3 border-t border-[#222d34] text-xs text-[#8696a0] space-y-1">
                <p>Vendedor: {selectedEval.seller_name}</p>
                <p>{selectedEval.message_count} mensagens no round</p>
                <p>
                  Período: {new Date(selectedEval.round_start).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {' — '}
                  {new Date(selectedEval.round_end).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
