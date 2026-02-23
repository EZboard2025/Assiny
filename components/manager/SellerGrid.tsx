'use client'

import { useState, useEffect, useRef } from 'react'
import { Users, TrendingUp, Award, Search, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Types (from SalesDashboard)
interface SessionTimeline {
  session_id: string
  created_at: string
  overall_score: number
  spin_scores: { S: number; P: number; I: number; N: number }
}

interface FollowUpData {
  user_id: string
  user_name: string
  total_analyses: number
  average_score: number
  last_analysis_date: string | null
  classification_distribution: {
    excelente: number; bom: number; medio: number; ruim: number; pessimo: number
  }
  recent_analyses: Array<{
    id: string; created_at: string; nota_final: number; classificacao: string
    tipo_venda: string; fase_funil: string; transcricao_filtrada?: string
    contexto?: string; avaliacao?: any
  }>
}

export interface SellerPerformance {
  user_id: string
  user_name: string
  user_email: string
  total_sessions: number
  overall_average: number
  spin_s_average: number
  spin_p_average: number
  spin_i_average: number
  spin_n_average: number
  top_strengths: Array<{ text: string; count: number }>
  critical_gaps: Array<{ text: string; count: number }>
  trend: string
  timeline: SessionTimeline[]
  followup_data?: FollowUpData
}

// WhatsApp evaluation type (from ManagerDashboard)
interface WhatsAppEvaluation {
  id: string
  user_id: string
  nota_final: number
  classificacao: string
}

interface SellerGridProps {
  onSelectSeller: (seller: SellerPerformance, whatsappSummary: { count: number; avg: number }) => void
}

// Helper functions
const getScoreColor = (score: number | null) => {
  if (!score) return 'text-gray-400'
  if (score >= 8) return 'text-green-600'
  if (score >= 6) return 'text-yellow-600'
  return 'text-red-600'
}

export default function SellerGrid({ onSelectSeller }: SellerGridProps) {
  const [sellers, setSellers] = useState<SellerPerformance[]>([])
  const [whatsappEvalsByUser, setWhatsappEvalsByUser] = useState<Record<string, { count: number; avg: number }>>({})
  const [sellerConnections, setSellerConnections] = useState<Record<string, { google: boolean; whatsapp: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current = new AbortController()
    loadAllData()
    return () => { abortRef.current?.abort() }
  }, [])

  const loadAllData = async () => {
    const signal = abortRef.current?.signal
    try {
      setLoading(true)

      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) {
        setLoading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setLoading(false)
        return
      }

      const [roleplayRes, followupRes, whatsappRes, connectionsRes] = await Promise.all([
        fetch('/api/admin/sellers-performance', { headers: { 'x-company-id': companyId }, signal }),
        fetch('/api/admin/sellers-followup', { headers: { 'x-company-id': companyId }, signal }),
        fetch('/api/manager/evaluations?days=30', { headers: { 'Authorization': `Bearer ${session.access_token}` }, signal }),
        fetch('/api/admin/seller-connections', { headers: { 'x-company-id': companyId }, signal })
      ])

      const roleplayData = await roleplayRes.json()
      const followupData = await followupRes.json()
      const whatsappData = await whatsappRes.json()
      const connectionsData = await connectionsRes.json()

      setSellerConnections(connectionsData.data || {})

      // Merge followup data into sellers
      const mergedSellers = (roleplayData.data || []).map((seller: SellerPerformance) => {
        const followup = (followupData.data || []).find((f: any) => f.user_id === seller.user_id)
        return { ...seller, followup_data: followup?.followup_data || null }
      })

      setSellers(mergedSellers)

      // Aggregate WhatsApp evaluations by user_id
      const evalsByUser: Record<string, { count: number; sum: number }> = {}
      const evals: WhatsAppEvaluation[] = whatsappData.evaluations || whatsappData.data || []

      for (const ev of evals) {
        if (!ev.user_id) continue
        if (!evalsByUser[ev.user_id]) {
          evalsByUser[ev.user_id] = { count: 0, sum: 0 }
        }
        evalsByUser[ev.user_id].count += 1
        evalsByUser[ev.user_id].sum += ev.nota_final || 0
      }

      const aggregated: Record<string, { count: number; avg: number }> = {}
      for (const [userId, data] of Object.entries(evalsByUser)) {
        aggregated[userId] = {
          count: data.count,
          avg: data.count > 0 ? data.sum / data.count : 0
        }
      }

      setWhatsappEvalsByUser(aggregated)
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('Erro ao carregar dados dos vendedores:', error)
    } finally {
      setLoading(false)
    }
  }

  // Computed values
  const filteredSellers = sellers.filter(seller =>
    seller.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seller.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalSellers = sellers.length

  const sellersWithData = sellers.filter(s => s.total_sessions > 0)
  const avgGeneralPerformance = sellersWithData.length > 0
    ? sellersWithData.reduce((sum, s) => sum + (s.overall_average || 0), 0) / sellersWithData.length
    : 0

  const topPerformer = sellersWithData.length > 0 ? sellersWithData[0] : null

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-3" />
        <p className="text-gray-500 text-sm">Carregando dados dos vendedores...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Vendedores */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Vendedores</p>
              <p className="text-xl font-bold text-gray-900">{totalSellers}</p>
            </div>
          </div>
        </div>

        {/* Media Geral */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Media Geral</p>
              <p className={`text-xl font-bold ${getScoreColor(avgGeneralPerformance)}`}>
                {sellersWithData.length > 0 ? avgGeneralPerformance.toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Top Performer */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Top Performer</p>
              <p className="text-sm font-bold text-gray-900 truncate max-w-[140px]">
                {topPerformer?.user_name || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar vendedor..."
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-300 transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Seller cards grid */}
      {filteredSellers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSellers.map((seller) => {
            const waData = whatsappEvalsByUser[seller.user_id] || { count: 0, avg: 0 }
            const conn = sellerConnections[seller.user_id] || { google: false, whatsapp: false }

            return (
              <div
                key={seller.user_id}
                onClick={() => onSelectSeller(seller, waData)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-green-200 transition-all"
              >
                {/* Top section: avatar + name/email + score */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-600 font-semibold text-lg">
                        {seller.user_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{seller.user_name}</p>
                      <p className="text-xs text-gray-500 truncate">{seller.user_email}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    {seller.total_sessions > 0 ? (
                      <>
                        <span className={`text-xl font-bold ${getScoreColor(seller.overall_average)}`}>
                          {seller.overall_average ? seller.overall_average.toFixed(1) : 'N/A'}
                        </span>
                        {seller.overall_average > 0 && (
                          <span className="text-gray-400 text-sm">/10</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">Sem treinos</span>
                    )}
                  </div>
                </div>

                {/* Integration icons */}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Integrações</span>
                  <div className="flex items-center gap-2 ml-auto">
                    {/* Google Calendar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        conn.google ? 'bg-white ring-2 ring-green-200' : 'bg-gray-100'
                      }`}
                      title={conn.google ? 'Google Calendar conectado' : 'Google Calendar desconectado'}
                    >
                      <svg className={`w-4 h-4 ${conn.google ? '' : 'opacity-30'}`} viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>

                    {/* WhatsApp */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        conn.whatsapp ? 'bg-white ring-2 ring-green-200' : 'bg-gray-100'
                      }`}
                      title={conn.whatsapp ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
                    >
                      <svg className={`w-4 h-4 ${conn.whatsapp ? 'text-green-600' : 'text-gray-400 opacity-30'}`} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : sellers.length === 0 ? (
        /* No employees in this company */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Nenhum vendedor cadastrado nesta empresa</p>
          <p className="text-gray-400 text-xs mt-1">Adicione vendedores no ConfigHub para começar</p>
        </div>
      ) : (
        /* Search returned no results */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            Nenhum vendedor encontrado para &quot;{searchTerm}&quot;
          </p>
        </div>
      )}
    </div>
  )
}
