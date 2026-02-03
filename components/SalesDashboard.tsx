'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, Award, Target, ArrowLeft, Loader2, MessageSquare, Activity, TrendingDown, X, FileText, Sparkles, AlertTriangle, Calendar, CheckCircle, Zap, Search, Video, BookOpen, Trophy, Brain, ChevronDown, ChevronUp, Phone, Clock, Percent } from 'lucide-react'

interface SessionTimeline {
  session_id: string
  created_at: string
  overall_score: number
  spin_scores: {
    S: number
    P: number
    I: number
    N: number
  }
}

interface FollowUpData {
  user_id: string
  user_name: string
  total_analyses: number
  average_score: number
  last_analysis_date: string | null
  classification_distribution: {
    excelente: number
    bom: number
    medio: number
    ruim: number
    pessimo: number
  }
  recent_analyses: Array<{
    id: string
    created_at: string
    nota_final: number
    classificacao: string
    tipo_venda: string
    fase_funil: string
    transcricao_filtrada?: string
    contexto?: string
    avaliacao?: any
  }>
}

interface SellerPerformance {
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

interface AISummary {
  summary: string
  highlights: string[]
  concerns: string[]
  recommendations: string[]
  performance_level: string
  priority_action: string
  spin_analysis?: {
    S: string
    P: string
    I: string
    N: string
  }
  evolution_trend?: string
  coaching_focus?: string
}

interface ComprehensiveData {
  seller: { id: string; name: string; email: string }
  summary: {
    overall_average: number
    total_roleplay_sessions: number
    total_meet_evaluations: number
    total_challenges: number
    completed_challenges: number
    total_followups: number
    avg_roleplay_score: number
    avg_meet_score: number
    avg_challenge_score: number
    avg_followup_score: number
    spin_averages: { S: number; P: number; I: number; N: number }
    top_strengths: Array<{ text: string; count: number }>
    critical_gaps: Array<{ text: string; count: number }>
    trend: string
  }
  roleplay: { sessions: any[]; total: number }
  meets: { evaluations: any[]; total: number }
  challenges: { items: any[]; total: number; completed: number; completion_rate: number }
  followups: { analyses: any[]; total: number }
  pdi: any
}

interface SalesDashboardProps {
  onClose: () => void
}

type TabType = 'overview' | 'training' | 'calls' | 'challenges'

export default function SalesDashboard({ onClose }: SalesDashboardProps) {
  const [initialLoading, setInitialLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [sellers, setSellers] = useState<SellerPerformance[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // AI Summary states
  const [aiSummaries, setAiSummaries] = useState<Record<string, AISummary>>({})
  const [aiSummaryLoading, setAiSummaryLoading] = useState<string | null>(null)

  // Comprehensive data states
  const [comprehensiveData, setComprehensiveData] = useState<Record<string, ComprehensiveData>>({})
  const [comprehensiveLoading, setComprehensiveLoading] = useState<string | null>(null)

  // Modal states
  const [selectedSellerForPDI, setSelectedSellerForPDI] = useState<{userId: string, userName: string} | null>(null)
  const [pdiData, setPdiData] = useState<any>(null)
  const [pdiLoading, setPdiLoading] = useState(false)
  const [selectedFollowUp, setSelectedFollowUp] = useState<any>(null)
  const [selectedMeet, setSelectedMeet] = useState<any>(null)

  useEffect(() => {
    loadSellersData()
  }, [])

  useEffect(() => {
    if (selectedSellerForPDI) {
      loadPDI(selectedSellerForPDI.userId)
    } else {
      setPdiData(null)
    }
  }, [selectedSellerForPDI])

  const loadPDI = async (userId: string) => {
    try {
      setPdiLoading(true)
      const { supabase } = await import('@/lib/supabase')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setPdiData(null)
        return
      }

      const response = await fetch(`/api/admin/get-pdi?userId=${userId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (!response.ok) {
        setPdiData(null)
        return
      }

      const result = await response.json()
      if (result.success && result.pdi) {
        let simulacoes = []
        if (result.pdi.pdi_json) {
          if (typeof result.pdi.pdi_json === 'string') {
            try {
              const parsed = JSON.parse(result.pdi.pdi_json)
              simulacoes = parsed.simulacoes || parsed.acoes || []
            } catch (e) {}
          } else {
            simulacoes = result.pdi.pdi_json.simulacoes || result.pdi.pdi_json.acoes || []
          }
        }

        if (simulacoes.length === 0 && result.pdi.acoes) {
          simulacoes = typeof result.pdi.acoes === 'string' ? JSON.parse(result.pdi.acoes) : result.pdi.acoes
        }

        const pdiContent = {
          gerado_em: result.pdi.created_at || result.pdi.gerado_em,
          periodo: result.pdi.periodo || '7 dias',
          diagnostico: {
            nota_geral: result.pdi.nota_geral || 0,
            resumo: result.pdi.resumo || 'Sem resumo disponível'
          },
          notas_spin: {
            situacao: result.pdi.nota_situacao || 0,
            problema: result.pdi.nota_problema || 0,
            implicacao: result.pdi.nota_implicacao || 0,
            necessidade: result.pdi.nota_necessidade || 0
          },
          foco_da_semana: result.pdi.pdi_json?.foco_da_semana || (result.pdi.meta_objetivo ? {
            area: result.pdi.meta_objetivo.split(' ')[0],
            objetivo: result.pdi.meta_objetivo
          } : null),
          meta_7_dias: result.pdi.meta_objetivo ? {
            objetivo: result.pdi.meta_objetivo,
            meta_numerica: result.pdi.meta_nota_meta || result.pdi.meta_nota_atual
          } : null,
          simulacoes: simulacoes,
          acoes: simulacoes,
          proximo_ciclo: result.pdi.proximo_ciclo || result.pdi.proximos_passos || null
        }

        setPdiData(pdiContent)
      } else {
        setPdiData(null)
      }
    } catch (error) {
      console.error('Erro ao carregar PDI:', error)
      setPdiData(null)
    } finally {
      setPdiLoading(false)
    }
  }

  const loadSellersData = async () => {
    try {
      setDataLoading(true)
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) {
        setDataLoading(false)
        setInitialLoading(false)
        return
      }

      const [roleplayRes, followupRes] = await Promise.all([
        fetch('/api/admin/sellers-performance', { headers: { 'x-company-id': companyId } }),
        fetch('/api/admin/sellers-followup', { headers: { 'x-company-id': companyId } })
      ])

      const roleplayData = await roleplayRes.json()
      const followupData = await followupRes.json()

      const mergedSellers = (roleplayData.data || []).map((seller: SellerPerformance) => {
        const followup = (followupData.data || []).find((f: any) => f.user_id === seller.user_id)
        return { ...seller, followup_data: followup?.followup_data || null }
      })

      setSellers(mergedSellers)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setDataLoading(false)
      setInitialLoading(false)
    }
  }

  const loadComprehensiveData = async (sellerId: string) => {
    if (comprehensiveData[sellerId]) return

    try {
      setComprehensiveLoading(sellerId)
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      const response = await fetch(`/api/admin/sellers-comprehensive?sellerId=${sellerId}`, {
        headers: { 'x-company-id': companyId || '' }
      })

      if (response.ok) {
        const data = await response.json()
        setComprehensiveData(prev => ({ ...prev, [sellerId]: data }))
      }
    } catch (error) {
      console.error('Erro ao carregar dados detalhados:', error)
    } finally {
      setComprehensiveLoading(null)
    }
  }

  // Load saved AI analysis for a seller
  const loadSavedAISummary = async (sellerId: string) => {
    try {
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) return null

      const response = await fetch(`/api/admin/seller-ai-summary?sellerId=${sellerId}`, {
        headers: { 'x-company-id': companyId }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.latest) {
          setAiSummaries(prev => ({ ...prev, [sellerId]: data.latest.ai_summary }))
          return data.latest
        }
      }
      return null
    } catch (error) {
      console.error('Erro ao carregar análise salva:', error)
      return null
    }
  }

  const generateAISummary = async (sellerId: string, forceRegenerate: boolean = false) => {
    if (aiSummaries[sellerId] && !forceRegenerate) return

    try {
      setAiSummaryLoading(sellerId)
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) {
        console.error('Company ID not found')
        return
      }

      const response = await fetch('/api/admin/seller-ai-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': companyId
        },
        body: JSON.stringify({ sellerId })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.ai_summary) {
          setAiSummaries(prev => ({ ...prev, [sellerId]: data.ai_summary }))
        } else {
          console.error('AI Summary response invalid:', data)
        }
      } else {
        const errorData = await response.json()
        console.error('Erro ao gerar resumo IA:', errorData.error)
      }
    } catch (error) {
      console.error('Erro ao gerar resumo IA:', error)
    } finally {
      setAiSummaryLoading(null)
    }
  }

  const toggleSellerExpand = async (sellerId: string) => {
    if (expandedSeller === sellerId) {
      setExpandedSeller(null)
    } else {
      setExpandedSeller(sellerId)
      // Load comprehensive data and saved AI summary in parallel
      await Promise.all([
        loadComprehensiveData(sellerId),
        !aiSummaries[sellerId] ? loadSavedAISummary(sellerId) : Promise.resolve()
      ])
    }
  }

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-400'
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number | null) => {
    if (!score) return 'bg-gray-100'
    if (score >= 8) return 'bg-green-50'
    if (score >= 6) return 'bg-yellow-50'
    return 'bg-red-50'
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

  const filteredSellers = sellers.filter(seller =>
    seller.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seller.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalSellers = sellers.length
  const avgGeneralPerformance = sellers.length > 0
    ? sellers.reduce((sum, s) => sum + (s.overall_average || 0), 0) / sellers.length
    : 0
  const topPerformer = sellers.length > 0 ? sellers[0] : null

  if (initialLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Carregando dados dos vendedores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Dashboard dos Vendedores
          </h1>
          <p className="text-gray-500 text-sm">Visão completa do desempenho de toda a equipe</p>
        </div>

        {/* 4 Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
          {[
            { key: 'overview' as TabType, label: 'Visão Geral', icon: Users },
            { key: 'training' as TabType, label: 'Treinamento', icon: BookOpen },
            { key: 'calls' as TabType, label: 'Calls Reais', icon: Video },
            { key: 'challenges' as TabType, label: 'Desafios', icon: Trophy }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Vendedores</p>
                <p className="text-2xl font-bold text-gray-900">{totalSellers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Média Geral</p>
                <p className={`text-2xl font-bold ${getScoreColor(avgGeneralPerformance)}`}>
                  {avgGeneralPerformance.toFixed(1)}/10
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Top Performer</p>
                <p className="text-lg font-bold text-gray-900 truncate">{topPerformer?.user_name || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Sessões</p>
                <p className="text-2xl font-bold text-gray-900">{sellers.reduce((sum, s) => sum + s.total_sessions, 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {dataLoading && (
          <div className="flex items-center justify-center gap-2 mb-6 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando dados...</span>
          </div>
        )}

        {/* Sellers List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {sellers.length === 0 ? (
            <div className="p-12 text-center">
              <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum vendedor com dados de performance ainda</p>
            </div>
          ) : filteredSellers.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum vendedor encontrado para "{searchTerm}"</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredSellers.map((seller) => {
                const badge = getPerformanceBadge(seller.overall_average)
                const isExpanded = expandedSeller === seller.user_id
                const sellerCompData = comprehensiveData[seller.user_id]
                const sellerAISummary = aiSummaries[seller.user_id]

                return (
                  <div key={seller.user_id}>
                    {/* Seller Header */}
                    <div
                      className="p-5 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => toggleSellerExpand(seller.user_id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-11 h-11 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
                            <span className="text-green-600 font-semibold text-lg">
                              {seller.user_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{seller.user_name}</h3>
                            <p className="text-sm text-gray-500">{seller.user_email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={`text-xl font-bold ${getScoreColor(seller.overall_average)}`}>
                              {seller.overall_average ? seller.overall_average.toFixed(1) : 'N/A'}/10
                            </div>
                            <div className="flex items-center gap-2 justify-end mt-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                                {badge.text}
                              </span>
                              {getTrendIcon(seller.trend)}
                            </div>
                          </div>

                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-4 gap-3 mt-4">
                        <div className="text-center p-2.5 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Sessões</p>
                          <p className="text-lg font-bold text-gray-900">{seller.total_sessions}</p>
                        </div>
                        <div className="text-center p-2.5 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">SPIN Média</p>
                          <p className="text-lg font-bold text-green-600">
                            {((seller.spin_s_average + seller.spin_p_average + seller.spin_i_average + seller.spin_n_average) / 4).toFixed(1)}
                          </p>
                        </div>
                        <div className="text-center p-2.5 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Follow-ups</p>
                          <p className="text-lg font-bold text-purple-600">{seller.followup_data?.total_analyses || 0}</p>
                        </div>
                        <div className="text-center p-2.5 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Pontos Fortes</p>
                          <p className="text-lg font-bold text-blue-600">{seller.top_strengths.length}</p>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-gray-100 bg-gray-50/50">
                        {comprehensiveLoading === seller.user_id ? (
                          <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
                          </div>
                        ) : (
                          <div className="pt-5 space-y-5">
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  generateAISummary(seller.user_id, !!sellerAISummary)
                                }}
                                disabled={aiSummaryLoading === seller.user_id}
                                className={`px-4 py-2 ${sellerAISummary ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'} text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50`}
                              >
                                {aiSummaryLoading === seller.user_id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Analisando dados...
                                  </>
                                ) : (
                                  <>
                                    <Brain className="w-4 h-4" />
                                    {sellerAISummary ? 'Regenerar Análise IA' : 'Gerar Análise IA'}
                                  </>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedSellerForPDI({ userId: seller.user_id, userName: seller.user_name })
                                }}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                Ver PDI
                              </button>
                            </div>

                            {/* AI Summary */}
                            {sellerAISummary && (
                              <div className="bg-purple-50 rounded-xl p-5 border border-purple-100">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-purple-700 flex items-center gap-2">
                                    <Brain className="w-4 h-4" />
                                    Análise IA Completa
                                  </h4>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                    sellerAISummary.performance_level === 'excelente' ? 'bg-green-100 text-green-700' :
                                    sellerAISummary.performance_level === 'bom' ? 'bg-blue-100 text-blue-700' :
                                    sellerAISummary.performance_level === 'regular' ? 'bg-yellow-100 text-yellow-700' :
                                    sellerAISummary.performance_level === 'precisa_atencao' ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {sellerAISummary.performance_level?.replace('_', ' ').toUpperCase() || 'N/A'}
                                  </span>
                                </div>

                                <p className="text-gray-700 text-sm mb-4 leading-relaxed whitespace-pre-line">{sellerAISummary.summary}</p>

                                {/* Evolution Trend */}
                                {sellerAISummary.evolution_trend && (
                                  <div className="mb-4 p-3 bg-white rounded-lg border border-purple-200">
                                    <h5 className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1.5">
                                      <TrendingUp className="w-3 h-3" />
                                      Tendência de Evolução
                                    </h5>
                                    <p className="text-xs text-gray-600">{sellerAISummary.evolution_trend}</p>
                                  </div>
                                )}

                                {/* SPIN Analysis */}
                                {sellerAISummary.spin_analysis && (
                                  <div className="mb-4">
                                    <h5 className="text-xs font-semibold text-purple-700 mb-2">Análise SPIN Detalhada</h5>
                                    <div className="grid md:grid-cols-2 gap-2">
                                      {[
                                        { key: 'S', label: 'Situação', color: 'blue' },
                                        { key: 'P', label: 'Problema', color: 'orange' },
                                        { key: 'I', label: 'Implicação', color: 'purple' },
                                        { key: 'N', label: 'Necessidade', color: 'green' }
                                      ].map(spin => (
                                        <div key={spin.key} className={`bg-white rounded-lg p-3 border border-${spin.color}-100`}>
                                          <h6 className={`text-[10px] font-semibold text-${spin.color}-700 uppercase mb-1`}>{spin.label} ({spin.key})</h6>
                                          <p className="text-xs text-gray-600">{sellerAISummary.spin_analysis![spin.key as keyof typeof sellerAISummary.spin_analysis]}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="grid md:grid-cols-3 gap-3">
                                  <div className="bg-white rounded-lg p-3 border border-green-100">
                                    <h5 className="text-xs font-semibold text-green-700 mb-2">Destaques ({sellerAISummary.highlights.length})</h5>
                                    <ul className="space-y-1">
                                      {sellerAISummary.highlights.map((h, i) => (
                                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                          <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                          {h}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="bg-white rounded-lg p-3 border border-yellow-100">
                                    <h5 className="text-xs font-semibold text-yellow-700 mb-2">Pontos de Atenção ({sellerAISummary.concerns.length})</h5>
                                    <ul className="space-y-1">
                                      {sellerAISummary.concerns.map((c, i) => (
                                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                          <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                                          {c}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                                    <h5 className="text-xs font-semibold text-blue-700 mb-2">Recomendações ({sellerAISummary.recommendations.length})</h5>
                                    <ul className="space-y-1">
                                      {sellerAISummary.recommendations.map((r, i) => (
                                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                          <Sparkles className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                                          {r}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>

                                {sellerAISummary.priority_action && (
                                  <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                                    <p className="text-xs text-green-700 font-semibold mb-1 flex items-center gap-1.5">
                                      <Zap className="w-3 h-3" />
                                      Ação Prioritária Imediata
                                    </p>
                                    <p className="text-sm text-gray-700">{sellerAISummary.priority_action}</p>
                                  </div>
                                )}

                                {sellerAISummary.coaching_focus && (
                                  <div className="mt-3 p-3 bg-purple-100 rounded-lg border border-purple-200">
                                    <p className="text-xs text-purple-700 font-semibold mb-1 flex items-center gap-1.5">
                                      <Target className="w-3 h-3" />
                                      Foco para Coaching/Gestão
                                    </p>
                                    <p className="text-sm text-gray-700">{sellerAISummary.coaching_focus}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Tab Content */}
                            {activeTab === 'overview' && (
                              <div className="space-y-5">
                                {/* SPIN Scores */}
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Scores SPIN</h4>
                                  <div className="grid grid-cols-4 gap-3">
                                    {[
                                      { key: 'S', label: 'Situação', value: seller.spin_s_average },
                                      { key: 'P', label: 'Problema', value: seller.spin_p_average },
                                      { key: 'I', label: 'Implicação', value: seller.spin_i_average },
                                      { key: 'N', label: 'Necessidade', value: seller.spin_n_average }
                                    ].map(spin => (
                                      <div key={spin.key} className={`${getScoreBgColor(spin.value)} rounded-xl p-4 text-center border border-gray-100`}>
                                        <p className="text-xs text-gray-500 mb-1">{spin.label}</p>
                                        <p className={`text-2xl font-bold ${getScoreColor(spin.value)}`}>
                                          {spin.value?.toFixed(1) || 'N/A'}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Strengths & Gaps */}
                                <div className="grid md:grid-cols-2 gap-4">
                                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-3">Pontos Fortes</h4>
                                    {seller.top_strengths.length > 0 ? (
                                      <ul className="space-y-2">
                                        {seller.top_strengths.map((s, i) => (
                                          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                                            <span>{s.text} <span className="text-xs text-gray-400">({s.count}x)</span></span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-gray-400">Nenhum identificado ainda</p>
                                    )}
                                  </div>

                                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                                    <h4 className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-3">Gaps Críticos</h4>
                                    {seller.critical_gaps.length > 0 ? (
                                      <ul className="space-y-2">
                                        {seller.critical_gaps.map((g, i) => (
                                          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                                            <span>{g.text} <span className="text-xs text-gray-400">({g.count}x)</span></span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-gray-400">Nenhum identificado ainda</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {activeTab === 'training' && (
                              <div className="space-y-5">
                                {/* Roleplay Sessions */}
                                <div>
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    Sessões de Roleplay ({seller.total_sessions})
                                  </h4>
                                  {seller.timeline && seller.timeline.length > 0 ? (
                                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                      {seller.timeline.slice(0, 10).map((session) => (
                                        <div key={session.session_id} className="bg-white rounded-lg p-4 border border-gray-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-500">
                                              {new Date(session.created_at).toLocaleDateString('pt-BR', {
                                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                              })}
                                            </span>
                                            <span className={`text-lg font-bold ${getScoreColor(session.overall_score)}`}>
                                              {session.overall_score.toFixed(1)}
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-4 gap-2">
                                            {['S', 'P', 'I', 'N'].map(key => (
                                              <div key={key} className="text-center bg-gray-50 rounded p-1.5">
                                                <p className="text-[10px] text-gray-400 uppercase">{key}</p>
                                                <p className="text-sm font-semibold text-gray-700">
                                                  {session.spin_scores[key as keyof typeof session.spin_scores].toFixed(1)}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400 text-center py-4">Nenhuma sessão de roleplay</p>
                                  )}
                                </div>

                                {/* Follow-up */}
                                {seller.followup_data && seller.followup_data.total_analyses > 0 && (
                                  <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                      <MessageSquare className="w-4 h-4" />
                                      Análises de Follow-up ({seller.followup_data.total_analyses})
                                    </h4>
                                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                      {seller.followup_data.recent_analyses.slice(0, 5).map(analysis => (
                                        <div
                                          key={analysis.id}
                                          className="bg-white rounded-lg p-4 border border-gray-200 cursor-pointer hover:border-purple-200 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setSelectedFollowUp(analysis)
                                          }}
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                              analysis.classificacao === 'excelente' ? 'bg-green-100 text-green-700' :
                                              analysis.classificacao === 'bom' ? 'bg-blue-100 text-blue-700' :
                                              analysis.classificacao === 'medio' ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-red-100 text-red-700'
                                            }`}>
                                              {analysis.classificacao}
                                            </span>
                                            <span className="text-purple-600 font-semibold">{analysis.nota_final.toFixed(1)}</span>
                                          </div>
                                          <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span>{analysis.tipo_venda}</span>
                                            <span>{analysis.fase_funil}</span>
                                            <span>{new Date(analysis.created_at).toLocaleDateString('pt-BR')}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {activeTab === 'calls' && (
                              <div className="space-y-5">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <Video className="w-4 h-4" />
                                  Avaliações de Reuniões (Meet)
                                </h4>

                                {sellerCompData?.meets?.evaluations && sellerCompData.meets.evaluations.length > 0 ? (
                                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                    {sellerCompData.meets.evaluations.map((meet: any) => (
                                      <div
                                        key={meet.id}
                                        className="bg-white rounded-lg p-4 border border-gray-200 cursor-pointer hover:border-blue-200 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSelectedMeet(meet)
                                        }}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-blue-500" />
                                            <span className="text-gray-700 font-medium">Reunião</span>
                                          </div>
                                          <span className={`text-lg font-bold ${getScoreColor(meet.overall_score)}`}>
                                            {meet.overall_score?.toFixed(1) || 'N/A'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          <Clock className="w-3 h-3" />
                                          {new Date(meet.created_at).toLocaleDateString('pt-BR')}
                                        </div>
                                        {meet.summary && (
                                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{meet.summary}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-8">
                                    <Video className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-400">Nenhuma avaliação de reunião ainda</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {activeTab === 'challenges' && (
                              <div className="space-y-5">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <Trophy className="w-4 h-4" />
                                  Desafios Diários
                                </h4>

                                {sellerCompData?.challenges ? (
                                  <>
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
                                        <p className="text-xs text-gray-500 mb-1">Total</p>
                                        <p className="text-2xl font-bold text-gray-900">{sellerCompData.challenges.total}</p>
                                      </div>
                                      <div className="bg-white rounded-lg p-4 text-center border border-green-100">
                                        <p className="text-xs text-gray-500 mb-1">Concluídos</p>
                                        <p className="text-2xl font-bold text-green-600">{sellerCompData.challenges.completed}</p>
                                      </div>
                                      <div className="bg-white rounded-lg p-4 text-center border border-blue-100">
                                        <p className="text-xs text-gray-500 mb-1">Taxa</p>
                                        <p className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-0.5">
                                          {sellerCompData.challenges.completion_rate?.toFixed(0) || 0}
                                          <Percent className="w-4 h-4" />
                                        </p>
                                      </div>
                                    </div>

                                    {sellerCompData.challenges.items && sellerCompData.challenges.items.length > 0 ? (
                                      <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                        {sellerCompData.challenges.items.map((challenge: any) => (
                                          <div key={challenge.id} className="bg-white rounded-lg p-4 border border-gray-200">
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                {challenge.completed ? (
                                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                                ) : (
                                                  <Clock className="w-4 h-4 text-yellow-500" />
                                                )}
                                                <span className="text-gray-700 font-medium">{challenge.challenge_type || 'Desafio'}</span>
                                              </div>
                                              <span className={`font-bold ${challenge.score >= 7 ? 'text-green-600' : challenge.score >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {challenge.score?.toFixed(1) || 'N/A'}
                                              </span>
                                            </div>
                                            <span className="text-xs text-gray-500">
                                              {new Date(challenge.created_at).toLocaleDateString('pt-BR')}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center py-8">
                                        <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                        <p className="text-sm text-gray-400">Nenhum desafio realizado ainda</p>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-center py-8">
                                    <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-400">Carregando dados de desafios...</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Follow-up */}
      {selectedFollowUp && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-xl">
            <div className="bg-purple-50 p-5 border-b border-purple-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-purple-700 mb-1">Análise de Follow-up</h2>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${
                      selectedFollowUp.classificacao === 'excelente' ? 'bg-green-100 text-green-700' :
                      selectedFollowUp.classificacao === 'bom' ? 'bg-blue-100 text-blue-700' :
                      selectedFollowUp.classificacao === 'medio' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {selectedFollowUp.classificacao}
                    </span>
                    <span className="text-xl font-bold text-purple-600">{selectedFollowUp.nota_final.toFixed(1)}/10</span>
                  </div>
                </div>
                <button onClick={() => setSelectedFollowUp(null)} className="p-1.5 hover:bg-purple-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Tipo</p>
                  <p className="font-medium text-gray-900">{selectedFollowUp.tipo_venda}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Funil</p>
                  <p className="font-medium text-gray-900">{selectedFollowUp.fase_funil}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Data</p>
                  <p className="font-medium text-gray-900">{new Date(selectedFollowUp.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {selectedFollowUp.contexto && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Contexto</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{selectedFollowUp.contexto}</p>
                  </div>
                </div>
              )}

              {selectedFollowUp.transcricao_filtrada && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Transcrição</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-48 overflow-y-auto">
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{selectedFollowUp.transcricao_filtrada}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Meet */}
      {selectedMeet && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-xl">
            <div className="bg-blue-50 p-5 border-b border-blue-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-blue-700 mb-1">Avaliação de Reunião</h2>
                  <span className={`text-xl font-bold ${getScoreColor(selectedMeet.overall_score)}`}>
                    {selectedMeet.overall_score?.toFixed(1) || 'N/A'}/10
                  </span>
                </div>
                <button onClick={() => setSelectedMeet(null)} className="p-1.5 hover:bg-blue-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="mb-5">
                <p className="text-xs text-gray-500 mb-1">Data</p>
                <p className="font-medium text-gray-900">{new Date(selectedMeet.created_at).toLocaleDateString('pt-BR')}</p>
              </div>

              {selectedMeet.summary && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Resumo</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 text-sm">{selectedMeet.summary}</p>
                  </div>
                </div>
              )}

              {selectedMeet.strengths && selectedMeet.strengths.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-semibold text-green-700 mb-2">Pontos Fortes</h3>
                  <ul className="space-y-2">
                    {selectedMeet.strengths.map((s: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedMeet.improvements && selectedMeet.improvements.length > 0 && (
                <div>
                  <h3 className="font-semibold text-yellow-700 mb-2">Áreas de Melhoria</h3>
                  <ul className="space-y-2">
                    {selectedMeet.improvements.map((i: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal PDI */}
      {selectedSellerForPDI && (
        <div className="fixed inset-0 z-[200] bg-black/50 overflow-y-auto p-4">
          <div className="min-h-screen flex items-start justify-center py-8">
            <div className="bg-white rounded-2xl max-w-4xl w-full shadow-xl">
              <div className="sticky top-0 z-20 bg-white border-b border-gray-200 flex justify-between items-center p-4 rounded-t-2xl">
                <h2 className="text-lg font-bold text-gray-900">PDI - {selectedSellerForPDI.userName}</h2>
                <button onClick={() => setSelectedSellerForPDI(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {pdiLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-3" />
                    <p className="text-gray-500 text-sm">Carregando PDI...</p>
                  </div>
                ) : !pdiData ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mb-3" />
                    <p className="text-lg text-gray-700 mb-1">PDI não encontrado</p>
                    <p className="text-sm text-gray-500">{selectedSellerForPDI.userName} ainda não gerou um PDI</p>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="bg-green-50 rounded-xl p-5 border border-green-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <Target className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">PDI - 7 Dias</h3>
                          <p className="text-sm text-gray-500">{selectedSellerForPDI.userName}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-3 border-t border-green-100">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Calendar className="w-4 h-4 text-green-600" />
                          <span>Gerado em {pdiData.gerado_em ? new Date(pdiData.gerado_em).toLocaleDateString('pt-BR') : 'N/A'}</span>
                        </div>
                        <span className="text-green-600 font-medium">{pdiData.periodo}</span>
                      </div>
                    </div>

                    {/* Diagnóstico */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-green-600" />
                        Diagnóstico Geral
                      </h4>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-600 text-sm">Nota Geral</span>
                          <span className={`text-3xl font-bold ${getScoreColor(pdiData.diagnostico?.nota_geral)}`}>
                            {pdiData.diagnostico?.nota_geral?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${((pdiData.diagnostico?.nota_geral || 0) / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm">{pdiData.diagnostico?.resumo || 'Sem resumo'}</p>
                    </div>

                    {/* SPIN + Foco */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-green-600" />
                          Notas SPIN
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Situação', value: pdiData.notas_spin?.situacao },
                            { label: 'Problema', value: pdiData.notas_spin?.problema },
                            { label: 'Implicação', value: pdiData.notas_spin?.implicacao },
                            { label: 'Necessidade', value: pdiData.notas_spin?.necessidade }
                          ].map(spin => (
                            <div key={spin.label} className={`text-center p-3 rounded-lg ${getScoreBgColor(spin.value)}`}>
                              <p className="text-xs text-gray-500 mb-1">{spin.label}</p>
                              <p className={`text-xl font-bold ${getScoreColor(spin.value)}`}>
                                {spin.value?.toFixed(1) || '0.0'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Zap className="w-5 h-5 text-green-600" />
                          Foco da Semana
                        </h4>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                          <p className="text-gray-700 font-medium">
                            {pdiData.foco_da_semana?.objetivo || pdiData.meta_7_dias?.objetivo || 'Definir objetivo'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Simulações */}
                    {pdiData.simulacoes && pdiData.simulacoes.length > 0 && (
                      <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          Simulações Recomendadas
                        </h4>
                        <div className="space-y-3">
                          {pdiData.simulacoes.map((sim: any, idx: number) => (
                            <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                              <div className="flex gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-100 border border-green-200 flex items-center justify-center flex-shrink-0">
                                  <span className="text-green-600 font-bold text-sm">{sim.quantidade}x</span>
                                </div>
                                <div className="flex-1">
                                  <p className="text-gray-700 font-medium mb-1">{sim.objetivo}</p>
                                  <div className="inline-block px-2.5 py-1 bg-blue-50 rounded-md border border-blue-100">
                                    <span className="text-blue-600 text-xs font-medium">Persona: </span>
                                    <span className="text-gray-700 text-xs">{sim.persona_sugerida}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
