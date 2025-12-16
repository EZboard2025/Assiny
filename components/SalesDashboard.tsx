'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, Award, Target, ArrowLeft, Loader2, MessageSquare, Activity, TrendingDown, Eye, X, FileText, ChevronRight, Sparkles, BarChart3 } from 'lucide-react'

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

interface SalesDashboardProps {
  onClose: () => void
}

export default function SalesDashboard({ onClose }: SalesDashboardProps) {
  const [initialLoading, setInitialLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [sellers, setSellers] = useState<SellerPerformance[]>([])
  const [selectedSeller, setSelectedSeller] = useState<SellerPerformance | null>(null)
  const [viewMode, setViewMode] = useState<'roleplay' | 'followup'>('roleplay')
  const [selectedFollowUp, setSelectedFollowUp] = useState<any>(null)

  useEffect(() => {
    if (viewMode === 'roleplay') {
      loadSellersData()
    } else {
      loadFollowupData()
    }
  }, [viewMode])

  const loadSellersData = async () => {
    try {
      setDataLoading(true)

      // Obter company_id usando a função utilitária
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) {
        console.error('Company ID não encontrado')
        setDataLoading(false)
        setInitialLoading(false)
        return
      }

      // Usar API route com company_id no header
      const response = await fetch('/api/admin/sellers-performance', {
        headers: {
          'x-company-id': companyId
        }
      })

      if (!response.ok) {
        console.error('Erro ao buscar dados:', response.statusText)
        setDataLoading(false)
        setInitialLoading(false)
        return
      }

      const { data: performanceData } = await response.json()

      if (!performanceData || performanceData.length === 0) {
        setSellers([])
        setDataLoading(false)
        setInitialLoading(false)
        return
      }

      setSellers(performanceData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setDataLoading(false)
      setInitialLoading(false)
    }
  }

  const loadFollowupData = async () => {
    try {
      setDataLoading(true)

      // Obter company_id usando a função utilitária
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) {
        console.error('Company ID não encontrado')
        setDataLoading(false)
        return
      }

      // Usar API route para buscar dados de follow-up
      const response = await fetch('/api/admin/sellers-followup', {
        headers: {
          'x-company-id': companyId
        }
      })

      if (!response.ok) {
        console.error('Erro ao buscar dados de follow-up:', response.statusText)
        setDataLoading(false)
        return
      }

      const { data: followupData } = await response.json()

      if (!followupData || followupData.length === 0) {
        setSellers([])
        setDataLoading(false)
        return
      }

      setSellers(followupData)
    } catch (error) {
      console.error('Erro ao carregar dados de follow-up:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const getPerformanceColor = (score: number | null) => {
    if (!score) return 'text-gray-400'
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getPerformanceBadge = (score: number | null) => {
    if (!score) return { text: 'Sem Dados', color: 'bg-gray-600' }
    if (score >= 8) return { text: 'Excelente', color: 'bg-green-600' }
    if (score >= 6) return { text: 'Bom', color: 'bg-yellow-600' }
    return { text: 'Precisa Melhorar', color: 'bg-red-600' }
  }

  // Calcular estatísticas gerais
  const totalSellers = sellers.length
  const avgGeneralPerformance = sellers.length > 0
    ? viewMode === 'roleplay'
      ? sellers.reduce((sum, s) => sum + (s.overall_average || 0), 0) / sellers.length
      : sellers.reduce((sum, s) => sum + (s.followup_data?.average_score || 0), 0) / sellers.length
    : 0
  const topPerformer = sellers.length > 0 ? sellers[0] : null

  // Estatísticas específicas de follow-up
  const totalFollowupAnalyses = sellers.reduce((sum, s) => sum + (s.followup_data?.total_analyses || 0), 0)
  const activeFollowupUsers = sellers.filter(s => s.followup_data && s.followup_data.total_analyses > 0).length

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        {/* Starfield background */}
        <div className="fixed inset-0 z-0">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
        </div>
        <div className="text-center relative z-10">
          <Loader2 className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando dados dos vendedores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black p-6 overflow-y-auto">
      {/* Starfield background */}
      <div className="fixed inset-0 z-0">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar ao Dashboard
          </button>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-purple-500 mb-2">
            Dashboard dos Vendedores
          </h1>
          <p className="text-gray-400">Visão geral do desempenho de toda a equipe</p>
        </div>

        {/* Toggle de Visualização com Design Melhorado */}
        <div className="flex gap-3 mb-8 p-1.5 bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-green-500/10">
          <button
            onClick={() => setViewMode('roleplay')}
            className={`flex-1 px-6 py-3.5 rounded-xl font-medium transition-all duration-300 ${
              viewMode === 'roleplay'
                ? 'bg-gradient-to-r from-green-600 to-lime-500 text-white shadow-lg shadow-green-500/25 scale-[1.02]'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Users className="w-5 h-5" />
              <span className="font-semibold">Treinamento Roleplay</span>
              {viewMode === 'roleplay' && <Sparkles className="w-4 h-4 animate-pulse" />}
            </div>
          </button>
          <button
            onClick={() => setViewMode('followup')}
            className={`flex-1 px-6 py-3.5 rounded-xl font-medium transition-all duration-300 ${
              viewMode === 'followup'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/25 scale-[1.02]'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <span className="font-semibold">Análise Follow-up</span>
              {viewMode === 'followup' && <Sparkles className="w-4 h-4 animate-pulse" />}
            </div>
          </button>
        </div>

        {/* Loading Indicator for Data Changes */}
        {dataLoading && (
          <div className="flex items-center justify-center gap-2 mb-6 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Carregando dados...</span>
          </div>
        )}

        {/* Cards de Estatísticas Gerais com Design Aprimorado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="group relative bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-green-500/30 to-green-600/20 rounded-xl shadow-lg shadow-green-500/20">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400 font-medium">Total de Vendedores</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-400 to-lime-400 bg-clip-text text-transparent">
                  {totalSellers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-green-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                {viewMode === 'roleplay' ? (
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                ) : (
                  <Activity className="w-6 h-6 text-purple-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-400">
                  {viewMode === 'roleplay' ? 'Média Geral do Time' : 'Total de Análises'}
                </p>
                <p className="text-3xl font-bold text-white">
                  {viewMode === 'roleplay'
                    ? `${avgGeneralPerformance.toFixed(1)}/10`
                    : totalFollowupAnalyses
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-green-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/20 rounded-xl">
                <Award className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">
                  {viewMode === 'roleplay' ? 'Top Performer' : 'Vendedores Ativos'}
                </p>
                <p className="text-lg font-bold text-white truncate">
                  {viewMode === 'roleplay'
                    ? (topPerformer?.user_name || 'N/A')
                    : `${activeFollowupUsers} de ${totalSellers}`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Vendedores */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-green-500/20 overflow-hidden">
          <div className="p-6 border-b border-green-500/20">
            <h2 className="text-xl font-bold text-white">
              {viewMode === 'roleplay' ? 'Performance Individual - Roleplay' : 'Performance Individual - Follow-up'}
            </h2>
          </div>

          {sellers.length === 0 ? (
            <div className="p-12 text-center">
              <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhum vendedor com dados de performance ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-green-500/10">
              {sellers.map((seller) => {
                const score = viewMode === 'roleplay' ? seller.overall_average : seller.followup_data?.average_score || 0
                const badge = getPerformanceBadge(score)

                return (
                  <div
                    key={seller.user_id}
                    className="p-6 hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedSeller(selectedSeller?.user_id === seller.user_id ? null : seller)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-1">{seller.user_name}</h3>
                        <p className="text-sm text-gray-400">{seller.user_email}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getPerformanceColor(score)}`}>
                          {score ? score.toFixed(1) : 'N/A'}/10
                        </div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white ${badge.color} mt-2`}>
                          {badge.text}
                        </span>
                      </div>
                    </div>

                    {/* Métricas baseadas no modo */}
                    {viewMode === 'roleplay' ? (
                      <div className="mb-4">
                        <p className="text-sm text-green-400 font-semibold uppercase tracking-wider mb-3">Detalhamento SPIN</p>
                        <div className="grid grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 text-center hover:scale-105 transition-transform">
                          <p className="text-sm text-green-400 mb-2 font-bold">Situação</p>
                          <p className="text-2xl font-bold text-white">
                            {seller.spin_s_average ? seller.spin_s_average.toFixed(1) : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 text-center hover:scale-105 transition-transform">
                          <p className="text-sm text-green-400 mb-2 font-bold">Problema</p>
                          <p className="text-2xl font-bold text-white">
                            {seller.spin_p_average ? seller.spin_p_average.toFixed(1) : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 text-center hover:scale-105 transition-transform">
                          <p className="text-sm text-green-400 mb-2 font-bold">Implicação</p>
                          <p className="text-2xl font-bold text-white">
                            {seller.spin_i_average ? seller.spin_i_average.toFixed(1) : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-green-500/20 to-green-500/10 border border-green-500/30 rounded-xl p-4 text-center hover:scale-105 transition-transform">
                          <p className="text-sm text-green-400 mb-2 font-bold">Necessidade</p>
                          <p className="text-2xl font-bold text-white">
                            {seller.spin_n_average ? seller.spin_n_average.toFixed(1) : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-center text-sm">
                        <span className="text-gray-400">Total de Sessões: <span className="text-white font-medium">{seller.total_sessions}</span></span>
                      </div>
                    </div>
                  ) : (
                    // Métricas de Follow-up
                    <div className="mb-4">
                      <p className="text-sm text-purple-400 font-semibold uppercase tracking-wider mb-3">Estatísticas de Follow-up</p>

                      {seller.followup_data && seller.followup_data.total_analyses > 0 ? (
                        <>
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-purple-500/10 rounded-lg p-3 text-center">
                              <p className="text-xs text-purple-300 mb-1">Análises</p>
                              <p className="text-xl font-bold text-white">{seller.followup_data.total_analyses}</p>
                            </div>
                            <div className="bg-purple-500/10 rounded-lg p-3 text-center">
                              <p className="text-xs text-purple-300 mb-1">Média</p>
                              <p className="text-xl font-bold text-white">{seller.followup_data.average_score.toFixed(1)}</p>
                            </div>
                            <div className="bg-purple-500/10 rounded-lg p-3 text-center">
                              <p className="text-xs text-purple-300 mb-1">Último</p>
                              <p className="text-sm font-medium text-white">
                                {seller.followup_data.last_analysis_date
                                  ? new Date(seller.followup_data.last_analysis_date).toLocaleDateString('pt-BR')
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Distribuição de Classificação */}
                          <div className="bg-gray-800/30 rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-2 font-medium">Distribuição de Performance</p>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">Excelente</span>
                                <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-green-500 h-full"
                                    style={{width: `${(seller.followup_data.classification_distribution.excelente / seller.followup_data.total_analyses) * 100}%`}}
                                  />
                                </div>
                                <span className="text-xs text-white w-6 text-right">{seller.followup_data.classification_distribution.excelente}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">Bom</span>
                                <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-blue-500 h-full"
                                    style={{width: `${(seller.followup_data.classification_distribution.bom / seller.followup_data.total_analyses) * 100}%`}}
                                  />
                                </div>
                                <span className="text-xs text-white w-6 text-right">{seller.followup_data.classification_distribution.bom}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">Médio</span>
                                <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-yellow-500 h-full"
                                    style={{width: `${(seller.followup_data.classification_distribution.medio / seller.followup_data.total_analyses) * 100}%`}}
                                  />
                                </div>
                                <span className="text-xs text-white w-6 text-right">{seller.followup_data.classification_distribution.medio}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">Ruim</span>
                                <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-orange-500 h-full"
                                    style={{width: `${(seller.followup_data.classification_distribution.ruim / seller.followup_data.total_analyses) * 100}%`}}
                                  />
                                </div>
                                <span className="text-xs text-white w-6 text-right">{seller.followup_data.classification_distribution.ruim}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 w-16">Péssimo</span>
                                <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-red-500 h-full"
                                    style={{width: `${(seller.followup_data.classification_distribution.pessimo / seller.followup_data.total_analyses) * 100}%`}}
                                  />
                                </div>
                                <span className="text-xs text-white w-6 text-right">{seller.followup_data.classification_distribution.pessimo}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Nenhuma análise de follow-up ainda</p>
                        </div>
                      )}
                    </div>
                  )}

                    {/* Detalhes expandidos */}
                    {selectedSeller?.user_id === seller.user_id && (
                      <div className="mt-6 pt-6 border-t border-green-500/20 space-y-6">
                        {/* Timeline de Evolução (Roleplay) */}
                        {viewMode === 'roleplay' && seller.timeline && seller.timeline.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-green-400">Timeline de Evolução</h4>
                              <span className="text-xs text-gray-500">
                                {seller.timeline.length} {seller.timeline.length === 1 ? 'sessão' : 'sessões'} no total
                              </span>
                            </div>

                            {/* Container scrollável */}
                            <div className="relative max-h-[400px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
                              {/* Linha de conexão - ajustada para não sobrepor os círculos */}
                              <div className="absolute left-5 top-6 bottom-0 w-0.5 bg-gradient-to-b from-green-500/50 via-green-500/30 to-transparent"></div>

                              {/* Sessões */}
                              <div className="space-y-4 pt-2 pb-4 pl-1">
                                {seller.timeline.map((session, idx) => (
                                  <div key={session.session_id} className="flex items-start gap-4">
                                    {/* Indicador */}
                                    <div className="relative z-10 flex-shrink-0">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                        session.overall_score >= 8 ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/50' :
                                        session.overall_score >= 6 ? 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500/50' :
                                        'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                                      }`}>
                                        {session.overall_score.toFixed(1)}
                                      </div>
                                    </div>

                                    {/* Informações da sessão */}
                                    <div className="flex-1 bg-gray-800/30 rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-400">
                                          {new Date(session.created_at).toLocaleDateString('pt-BR', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                          session.overall_score >= 8 ? 'bg-green-500/20 text-green-400' :
                                          session.overall_score >= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                                          'bg-red-500/20 text-red-400'
                                        }`}>
                                          Sessão #{seller.timeline.length - idx}
                                        </span>
                                      </div>

                                      {/* SPIN Scores em miniatura */}
                                      <div className="grid grid-cols-4 gap-2 text-center">
                                        <div className="bg-gray-900/50 rounded p-1">
                                          <p className="text-[10px] text-gray-500 mb-0.5">S</p>
                                          <p className="text-xs font-bold text-green-400">
                                            {session.spin_scores.S.toFixed(1)}
                                          </p>
                                        </div>
                                        <div className="bg-gray-900/50 rounded p-1">
                                          <p className="text-[10px] text-gray-500 mb-0.5">P</p>
                                          <p className="text-xs font-bold text-green-400">
                                            {session.spin_scores.P.toFixed(1)}
                                          </p>
                                        </div>
                                        <div className="bg-gray-900/50 rounded p-1">
                                          <p className="text-[10px] text-gray-500 mb-0.5">I</p>
                                          <p className="text-xs font-bold text-green-400">
                                            {session.spin_scores.I.toFixed(1)}
                                          </p>
                                        </div>
                                        <div className="bg-gray-900/50 rounded p-1">
                                          <p className="text-[10px] text-gray-500 mb-0.5">N</p>
                                          <p className="text-xs font-bold text-green-400">
                                            {session.spin_scores.N.toFixed(1)}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Análises Recentes de Follow-up */}
                        {viewMode === 'followup' && seller.followup_data && seller.followup_data.recent_analyses.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-purple-400">Análises Recentes de Follow-up</h4>
                              <span className="text-xs text-gray-500">
                                {seller.followup_data.recent_analyses.length} análises recentes
                              </span>
                            </div>

                            <div className="space-y-3">
                              {seller.followup_data.recent_analyses.map((analysis) => (
                                <div key={analysis.id} className="group bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-xl p-4 hover:from-purple-900/20 hover:to-gray-900/40 transition-all duration-300 border border-purple-500/10 hover:border-purple-500/30">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg ${
                                        analysis.classificacao === 'excelente' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                        analysis.classificacao === 'bom' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                                        analysis.classificacao === 'medio' ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                                        analysis.classificacao === 'ruim' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                                        'bg-gradient-to-r from-red-600 to-red-800'
                                      }`}>
                                        {analysis.classificacao.charAt(0).toUpperCase() + analysis.classificacao.slice(1)}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                      {new Date(analysis.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                                    <div>
                                      <p className="text-gray-500 mb-1">Nota</p>
                                      <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        {analysis.nota_final.toFixed(1)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 mb-1">Tipo</p>
                                      <p className="text-white font-medium">{analysis.tipo_venda}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 mb-1">Funil</p>
                                      <p className="text-white font-medium truncate">{analysis.fase_funil}</p>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => setSelectedFollowUp(analysis)}
                                    className="w-full px-4 py-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 border border-purple-500/30 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                                  >
                                    <Eye className="w-4 h-4 text-purple-400" />
                                    <span className="text-sm font-medium text-purple-300">Ver Transcrição Completa</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Pontos Fortes (apenas para roleplay) */}
                          {viewMode === 'roleplay' && seller.top_strengths && seller.top_strengths.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-green-400 mb-3">✅ Pontos Fortes</h4>
                              <ul className="space-y-2">
                                {seller.top_strengths.map((strength, idx) => (
                                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                    <span className="text-green-400 mt-0.5">•</span>
                                    <span>{strength.text} <span className="text-xs text-gray-500">({strength.count}x)</span></span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Gaps Críticos (apenas para roleplay) */}
                          {viewMode === 'roleplay' && seller.critical_gaps && seller.critical_gaps.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-yellow-400 mb-3">Gaps Críticos</h4>
                              <ul className="space-y-2">
                                {seller.critical_gaps.map((gap, idx) => (
                                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                    <span className="text-yellow-400 mt-0.5">•</span>
                                    <span>{gap.text} <span className="text-xs text-gray-500">({gap.count}x)</span></span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Transcrição do Follow-up */}
      {selectedFollowUp && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-purple-500/30 shadow-2xl shadow-purple-500/20">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6 border-b border-purple-500/30">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                    Análise Detalhada do Follow-up
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white ${
                      selectedFollowUp.classificacao === 'excelente' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                      selectedFollowUp.classificacao === 'bom' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                      selectedFollowUp.classificacao === 'medio' ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                      selectedFollowUp.classificacao === 'ruim' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                      'bg-gradient-to-r from-red-600 to-red-800'
                    }`}>
                      {selectedFollowUp.classificacao.charAt(0).toUpperCase() + selectedFollowUp.classificacao.slice(1)}
                    </span>
                    <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {selectedFollowUp.nota_final.toFixed(1)}/10
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFollowUp(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Informações Básicas */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <p className="text-xs text-gray-400 mb-1">Tipo de Venda</p>
                  <p className="text-lg font-bold text-white">{selectedFollowUp.tipo_venda}</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <p className="text-xs text-gray-400 mb-1">Fase do Funil</p>
                  <p className="text-lg font-bold text-white">{selectedFollowUp.fase_funil}</p>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <p className="text-xs text-gray-400 mb-1">Data da Análise</p>
                  <p className="text-lg font-bold text-white">
                    {new Date(selectedFollowUp.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Contexto */}
              {selectedFollowUp.contexto && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Contexto da Conversa
                  </h3>
                  <div className="bg-gray-800/30 rounded-xl p-4 border border-purple-500/20">
                    <p className="text-gray-300 whitespace-pre-wrap">{selectedFollowUp.contexto}</p>
                  </div>
                </div>
              )}

              {/* Transcrição */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Transcrição do Follow-up
                </h3>
                <div className="bg-gradient-to-br from-purple-900/10 to-pink-900/10 rounded-xl p-6 border border-purple-500/20">
                  <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {selectedFollowUp.transcricao_filtrada || 'Transcrição não disponível'}
                  </p>
                </div>
              </div>

              {/* Avaliação Detalhada */}
              {selectedFollowUp.avaliacao && (
                <div>
                  <h3 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Avaliação Detalhada
                  </h3>

                  {/* Notas por Critério */}
                  {selectedFollowUp.avaliacao.notas && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                      {Object.entries(selectedFollowUp.avaliacao.notas).map(([key, value]: [string, any]) => (
                        <div key={key} className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                          <p className="text-xs text-gray-400 mb-1 capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-bold text-white">{value.nota?.toFixed(1) || 0}</span>
                            <span className="text-xs text-gray-500">peso: {value.peso}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pontos Positivos */}
                  {selectedFollowUp.avaliacao.pontos_positivos && (
                    <div className="mb-4">
                      <h4 className="text-sm font-bold text-green-400 mb-2">✅ Pontos Positivos</h4>
                      <div className="bg-gray-800/30 rounded-xl p-3">
                        <ul className="space-y-1">
                          {selectedFollowUp.avaliacao.pontos_positivos.map((ponto: string, idx: number) => (
                            <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                              <ChevronRight className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                              <span>{ponto}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Pontos a Melhorar */}
                  {selectedFollowUp.avaliacao.pontos_melhorar && (
                    <div className="mb-4">
                      <h4 className="text-sm font-bold text-yellow-400 mb-2">⚠️ Pontos a Melhorar</h4>
                      <div className="bg-gray-800/30 rounded-xl p-3">
                        <ul className="space-y-2">
                          {selectedFollowUp.avaliacao.pontos_melhorar.map((item: any, idx: number) => (
                            <li key={idx} className="text-sm text-gray-300">
                              <div className="flex items-start gap-2">
                                <ChevronRight className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-medium text-yellow-300">{item.problema || item}</p>
                                  {item.como_resolver && (
                                    <p className="text-xs text-gray-400 mt-1">💡 {item.como_resolver}</p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Dica Principal */}
                  {selectedFollowUp.avaliacao.dica_principal && (
                    <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-4 border border-purple-500/30">
                      <p className="text-sm font-bold text-purple-400 mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Dica Principal
                      </p>
                      <p className="text-gray-200">{selectedFollowUp.avaliacao.dica_principal}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
