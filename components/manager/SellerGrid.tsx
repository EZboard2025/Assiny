'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, TrendingDown, Award, Activity, Target, Search, X, Loader2, MessageSquare } from 'lucide-react'
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

const getPerformanceBadge = (score: number | null) => {
  if (!score) return { text: 'Sem Dados', color: 'bg-gray-100 text-gray-600' }
  if (score >= 8) return { text: 'Excelente', color: 'bg-green-100 text-green-700' }
  if (score >= 6) return { text: 'Bom', color: 'bg-yellow-100 text-yellow-700' }
  return { text: 'Precisa Melhorar', color: 'bg-red-100 text-red-700' }
}

const getTrendIcon = (trend: string) => {
  if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />
  if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />
  return <Activity className="w-4 h-4 text-gray-400" />
}

export default function SellerGrid({ onSelectSeller }: SellerGridProps) {
  const [sellers, setSellers] = useState<SellerPerformance[]>([])
  const [whatsappEvalsByUser, setWhatsappEvalsByUser] = useState<Record<string, { count: number; avg: number }>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
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

      const [roleplayRes, followupRes, whatsappRes] = await Promise.all([
        fetch('/api/admin/sellers-performance', { headers: { 'x-company-id': companyId } }),
        fetch('/api/admin/sellers-followup', { headers: { 'x-company-id': companyId } }),
        fetch('/api/manager/evaluations?days=30', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
      ])

      const roleplayData = await roleplayRes.json()
      const followupData = await followupRes.json()
      const whatsappData = await whatsappRes.json()

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
    } catch (error) {
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

  const avgGeneralPerformance = sellers.length > 0
    ? sellers.reduce((sum, s) => sum + (s.overall_average || 0), 0) / sellers.length
    : 0

  const topPerformer = sellers.length > 0 ? sellers[0] : null

  const totalSessions = sellers.reduce((sum, s) => sum + (s.total_sessions || 0), 0)

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                {avgGeneralPerformance > 0 ? avgGeneralPerformance.toFixed(1) : 'N/A'}
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

        {/* Total Sessoes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Sessoes</p>
              <p className="text-xl font-bold text-gray-900">{totalSessions}</p>
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
            const badge = getPerformanceBadge(seller.overall_average)
            const spinAvg = (
              (seller.spin_s_average || 0) +
              (seller.spin_p_average || 0) +
              (seller.spin_i_average || 0) +
              (seller.spin_n_average || 0)
            ) / 4
            const waData = whatsappEvalsByUser[seller.user_id] || { count: 0, avg: 0 }

            return (
              <div
                key={seller.user_id}
                onClick={() => onSelectSeller(seller, waData)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-green-200 transition-all"
              >
                {/* Top section */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-lg">
                        {seller.user_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{seller.user_name}</p>
                      <p className="text-sm text-gray-500 truncate max-w-[160px]">{seller.user_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xl font-bold ${getScoreColor(seller.overall_average)}`}>
                      {seller.overall_average ? seller.overall_average.toFixed(1) : 'N/A'}
                    </span>
                    {seller.overall_average > 0 && (
                      <span className="text-gray-400 text-sm">/10</span>
                    )}
                  </div>
                </div>

                {/* Bottom stats grid */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-500 font-medium">Sessoes</p>
                    <p className="text-sm font-bold text-gray-900">{seller.total_sessions}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-500 font-medium">SPIN</p>
                    <p className="text-sm font-bold text-gray-900">{spinAvg > 0 ? spinAvg.toFixed(1) : '-'}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-500 font-medium">Conv. WhatsApp</p>
                    <p className="text-sm font-bold text-gray-900">{waData.count}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-500 font-medium">Follow-ups</p>
                    <p className="text-sm font-bold text-gray-900">{seller.followup_data?.total_analyses || 0}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : sellers.length === 0 ? (
        /* No sellers at all */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Nenhum vendedor com dados de performance ainda</p>
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
