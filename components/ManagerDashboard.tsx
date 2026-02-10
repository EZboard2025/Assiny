'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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

function getScoreColor(score: number): string {
  if (score >= 7) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreBg(score: number): string {
  if (score >= 7) return 'bg-green-50 border-green-200'
  if (score >= 5) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

function getScoreBarColor(score: number): string {
  if (score >= 7) return 'bg-green-500'
  if (score >= 5) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getClassificacaoLabel(classificacao: string): string {
  const labels: Record<string, string> = {
    excelente: 'Excelente',
    bom: 'Bom',
    medio: 'Medio',
    ruim: 'Ruim',
    pessimo: 'Pessimo',
    indefinido: 'N/A'
  }
  return labels[classificacao] || classificacao
}

interface ManagerDashboardProps {
  embedded?: boolean
}

export default function ManagerDashboard({ embedded = false }: ManagerDashboardProps) {
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [selectedSeller, setSelectedSeller] = useState<string>('all')
  const [selectedDays, setSelectedDays] = useState<number>(7)
  const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null)
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setAuthToken(session?.access_token || null)
    }
    loadAuth()
  }, [])

  useEffect(() => {
    if (authToken) fetchEvaluations()
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

      const sellerIds = new Set<string>((data.evaluations || []).map((e: Evaluation) => e.user_id))
      setExpandedSellers(sellerIds)
    } catch (err) {
      console.error('Error fetching evaluations:', err)
    } finally {
      setLoading(false)
    }
  }

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

  const content = (
    <>
      {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filtros</span>
            </div>

            <select
              value={selectedSeller}
              onChange={e => setSelectedSeller(e.target.value)}
              className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">Todos vendedores</option>
              {sellers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              value={selectedDays}
              onChange={e => setSelectedDays(parseInt(e.target.value))}
              className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
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
        <div className="flex gap-6">
          {/* Left: Evaluation list */}
          <div className="flex-1 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-green-100 border-t-green-500 rounded-full animate-spin" />
              </div>
            ) : Object.keys(sellerGroups).length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-gray-200 shadow-sm text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhuma avaliação encontrada
                </h3>
                <p className="text-gray-500 text-sm">
                  As avaliações aparecem automaticamente quando os vendedores conversam com clientes.
                </p>
              </div>
            ) : (
              Object.entries(sellerGroups).map(([sellerId, group]) => {
                const avg = getSellerAverage(group.evals)
                const isExpanded = expandedSellers.has(sellerId)

                return (
                  <div key={sellerId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Seller header */}
                    <button
                      onClick={() => toggleSeller(sellerId)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                          <Users className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="font-semibold text-gray-900">{group.name}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {group.evals.length} avaliação(ões)
                        </span>
                      </div>
                      <div className={`text-sm font-bold ${getScoreColor(avg)}`}>
                        Média: {avg.toFixed(1)}
                      </div>
                    </button>

                    {/* Evaluation list */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {group.evals.map(ev => (
                          <button
                            key={ev.id}
                            onClick={() => setSelectedEval(ev)}
                            className={`w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0 ${
                              selectedEval?.id === ev.id ? 'bg-green-50 border-l-2 border-l-green-500' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 pl-7">
                              <div>
                                <span className="text-sm font-medium text-gray-900">
                                  {ev.contact_name || ev.contact_phone}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">
                                  Round {ev.round_number}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg border ${getScoreBg(ev.nota_final)} ${getScoreColor(ev.nota_final)}`}>
                                {ev.nota_final.toFixed(1)} {getClassificacaoLabel(ev.classificacao)}
                              </span>
                              <span className="text-xs text-gray-400">
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
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {selectedEval.contact_name || selectedEval.contact_phone} — Round {selectedEval.round_number}
                  </h3>
                  <button
                    onClick={() => setSelectedEval(null)}
                    className="text-gray-400 hover:text-gray-600 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    Fechar
                  </button>
                </div>

                {/* Score */}
                <div className={`text-center py-4 rounded-xl mb-5 border ${getScoreBg(selectedEval.nota_final)}`}>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-4xl font-bold ${getScoreColor(selectedEval.nota_final)}`}>
                      {selectedEval.nota_final.toFixed(1)}
                    </span>
                    <span className="text-gray-400 text-lg">/10</span>
                  </div>
                  <div className={`text-sm font-medium mt-1 ${getScoreColor(selectedEval.nota_final)}`}>
                    {getClassificacaoLabel(selectedEval.classificacao)}
                  </div>
                </div>

                {/* Criteria scores */}
                {selectedEval.avaliacao?.notas && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Notas por Critério</p>
                    <div className="space-y-3">
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
                            <span className="text-gray-600">{labels[key] || key}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${getScoreBarColor(val.nota)}`}
                                  style={{ width: `${(val.nota / 10) * 100}%` }}
                                />
                              </div>
                              <span className={`font-semibold w-8 text-right ${getScoreColor(val.nota)}`}>
                                {val.nota?.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Positive points */}
                {selectedEval.avaliacao?.pontos_positivos?.length > 0 && (
                  <div className="mb-4">
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <h4 className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">Pontos Positivos</h4>
                      <ul className="space-y-1.5">
                        {selectedEval.avaliacao.pontos_positivos.map((p: string, i: number) => (
                          <li key={i} className="text-xs text-gray-700 flex gap-2">
                            <span className="text-green-600 shrink-0">+</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Points to improve */}
                {selectedEval.avaliacao?.pontos_melhorar?.length > 0 && (
                  <div className="mb-4">
                    <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                      <h4 className="text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wider">Pontos a Melhorar</h4>
                      <ul className="space-y-1.5">
                        {selectedEval.avaliacao.pontos_melhorar.map((p: any, i: number) => (
                          <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                            <span className="text-orange-600 shrink-0">-</span>
                            <span>{typeof p === 'string' ? p : `${p.problema}: ${p.como_resolver}`}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Main tip */}
                {selectedEval.avaliacao?.dica_principal && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <h4 className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">Dica Principal</h4>
                    <p className="text-xs text-gray-700 leading-relaxed">{selectedEval.avaliacao.dica_principal}</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                  <p>Vendedor: <span className="text-gray-700 font-medium">{selectedEval.seller_name}</span></p>
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
    </>
  )

  if (embedded) return content

  return (
    <div className="min-h-screen py-8 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard do Gestor</h1>
                <p className="text-gray-500 text-sm">Acompanhe o desempenho da sua equipe</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
              <span className="text-sm font-semibold text-green-600">{evaluations.length}</span>
              <span className="text-xs text-green-600">avaliações</span>
            </div>
          </div>
        </div>
        {content}
      </div>
    </div>
  )
}
