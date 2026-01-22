'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, Award, Target, ArrowLeft, Loader2, MessageSquare, Activity, TrendingDown, Eye, X, FileText, ChevronRight, Sparkles, BarChart3, AlertTriangle, Calendar, CheckCircle, Zap } from 'lucide-react'

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
  const [selectedSellerForPDI, setSelectedSellerForPDI] = useState<{userId: string, userName: string} | null>(null)
  const [pdiData, setPdiData] = useState<any>(null)
  const [pdiLoading, setPdiLoading] = useState(false)

  useEffect(() => {
    if (viewMode === 'roleplay') {
      loadSellersData()
    } else {
      loadFollowupData()
    }
  }, [viewMode])

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

      // Obter o token de autenticação do usuário atual
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('Erro: Usuário não autenticado')
        setPdiData(null)
        return
      }

      // Chamar API route com service role para bypassar RLS
      const response = await fetch(`/api/admin/get-pdi?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Erro ao carregar PDI:', errorData)
        setPdiData(null)
        return
      }

      const result = await response.json()
      if (result.success && result.pdi) {
        console.log('✅ PDI carregado com sucesso:', result.pdi)

        // Tentar extrair simulações do pdi_json primeiro (se disponível)
        let simulacoes = []
        if (result.pdi.pdi_json) {
          // Se pdi_json existe, tenta pegar simulacoes de lá
          if (typeof result.pdi.pdi_json === 'string') {
            try {
              const parsed = JSON.parse(result.pdi.pdi_json)
              simulacoes = parsed.simulacoes || parsed.acoes || []
            } catch (e) {
              console.error('Erro ao parsear pdi_json:', e)
            }
          } else {
            simulacoes = result.pdi.pdi_json.simulacoes || result.pdi.pdi_json.acoes || []
          }
        }

        // Fallback: usar acoes da coluna direta
        if (simulacoes.length === 0 && result.pdi.acoes) {
          simulacoes = typeof result.pdi.acoes === 'string' ? JSON.parse(result.pdi.acoes) : result.pdi.acoes
        }

        // O PDI vem com os campos no nível raiz do objeto (não dentro de content)
        // Precisamos construir a estrutura esperada pela modal
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

        console.log('🎯 PDI formatado:', pdiContent)
        console.log('📋 Simulações extraídas:', pdiContent.simulacoes)
        setPdiData(pdiContent)
      } else {
        console.log('❌ Nenhum PDI retornado')
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
                ? 'bg-gradient-to-r from-green-600 to-lime-500 text-white shadow-lg shadow-green-500/25 scale-[1.02]'
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

          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:scale-[1.02]">
            <div className="flex items-center gap-4">
              <div className={`p-3 ${
                viewMode === 'followup' ? 'bg-green-500/20' : 'bg-blue-500/20'
              } rounded-xl`}>
                {viewMode === 'roleplay' ? (
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                ) : (
                  <Activity className="w-6 h-6 text-green-400" />
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

          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:scale-[1.02]">
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

                      <div className="flex items-center justify-between text-sm mt-4">
                        <span className="text-gray-400">Total de Sessões: <span className="text-white font-medium">{seller.total_sessions}</span></span>

                        {/* Botão Ver PDI */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedSellerForPDI({ userId: seller.user_id, userName: seller.user_name })
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white text-sm font-medium rounded-lg transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-green-500/25 hover:scale-105"
                        >
                          <FileText className="w-4 h-4" />
                          Ver PDI
                        </button>
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
                <div className="bg-gradient-to-br from-purple-900/10 to-pink-900/10 rounded-xl p-4 border border-purple-500/20 max-h-96 overflow-y-auto">
                  <div className="space-y-3">
                    {selectedFollowUp.transcricao_filtrada ? (
                      selectedFollowUp.transcricao_filtrada
                        .replace('=== CONVERSA COMPLETA ===', '')
                        .replace('=== CONTEXTO ANTERIOR ===', '')
                        .replace('=== INÍCIO DO FOLLOW-UP ===', '')
                        .replace('=== RESPOSTA DO CLIENTE (se houver) ===', '')
                        .trim()
                        .split('\n').map((line: string, index: number) => {
                        // Parse each line to identify timestamp, sender, and message
                        const match = line.match(/^\[(\d{2}:\d{2})\]\s*(Vendedor|Cliente|Remetente):\s*(.+)$/);

                        if (match) {
                          const [, timestamp, sender, message] = match;
                          const isVendedor = sender === 'Vendedor';

                          return (
                            <div key={index} className={`flex gap-3 ${isVendedor ? 'justify-end' : 'justify-start'}`}>
                              {!isVendedor && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-xs font-bold">C</span>
                                </div>
                              )}
                              <div className={`max-w-[70%] ${isVendedor ? 'items-end' : 'items-start'}`}>
                                <div className={`rounded-2xl px-4 py-2 ${
                                  isVendedor
                                    ? 'bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-500/30'
                                    : 'bg-gray-800/50 border border-gray-700/50'
                                }`}>
                                  <p className="text-sm text-gray-100">{message}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-1 px-1">
                                  <span className="text-[10px] text-gray-500">{timestamp}</span>
                                  <span className="text-[10px] text-gray-500">• {sender}</span>
                                </div>
                              </div>
                              {isVendedor && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-xs font-bold">V</span>
                                </div>
                              )}
                            </div>
                          );
                        } else if (line.trim()) {
                          // Fallback for lines that don't match the pattern
                          return (
                            <div key={index} className="text-gray-400 text-sm italic px-2">
                              {line}
                            </div>
                          );
                        }
                        return null;
                      }).filter(Boolean)
                    ) : (
                      <p className="text-gray-400 text-center py-4">Transcrição não disponível</p>
                    )}
                  </div>
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

      {/* Modal PDI do Vendedor */}
      {selectedSellerForPDI && (
        <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm overflow-y-auto p-4">
          <div className="min-h-screen flex items-start justify-center py-8">
            <div className="bg-black rounded-3xl max-w-6xl w-full">
              {/* Header com botão fechar */}
              <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm flex justify-end p-4 border-b border-gray-800/50">
                <button
                  onClick={() => setSelectedSellerForPDI(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Conteúdo PDI */}
              <div className="px-6 pb-12 space-y-6">
              {pdiLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-12 h-12 text-green-400 animate-spin mb-4" />
                  <p className="text-gray-400">Carregando PDI...</p>
                </div>
              ) : !pdiData ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />
                  <p className="text-xl text-gray-300 mb-2">PDI não encontrado</p>
                  <p className="text-sm text-gray-500">{selectedSellerForPDI.userName} ainda não gerou um PDI</p>
                </div>
              ) : (
                <>
                  {/* Header do PDI */}
                  <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl flex items-center justify-center border border-green-500/30">
                        <Target className="w-8 h-8 text-green-400" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent">
                          PDI • 7 Dias
                        </h1>
                        <p className="text-gray-400">{selectedSellerForPDI.userName}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-4 pt-4 border-t border-gray-700/50">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-4 h-4 text-green-400" />
                        <span>Gerado em {pdiData.gerado_em ? new Date(pdiData.gerado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Data não disponível'}</span>
                      </div>
                      <span className="text-green-400 font-semibold">{pdiData.periodo || '7 dias'}</span>
                    </div>
                  </div>

                  {/* Diagnóstico Geral */}
                  <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <Award className="w-6 h-6 text-green-400" />
                      Diagnóstico Geral
                    </h2>
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-300 font-medium">Nota Geral</span>
                        <span className="text-4xl font-black bg-gradient-to-br from-green-400 to-emerald-500 bg-clip-text text-transparent">
                          {pdiData.diagnostico?.nota_geral?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                      <div className="w-full bg-gray-900/50 rounded-full h-3 overflow-hidden border border-gray-700/50">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                          style={{ width: `${((pdiData.diagnostico?.nota_geral || 0) / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-gray-300 leading-relaxed">{pdiData.diagnostico?.resumo || 'Sem resumo disponível'}</p>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* SPIN com Radar Chart */}
                    <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
                      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-green-400" />
                        Notas SPIN
                      </h2>
                      <div className="aspect-square max-w-sm mx-auto">
                        {(() => {
                          const S = pdiData.notas_spin?.situacao || 0
                          const P = pdiData.notas_spin?.problema || 0
                          const I = pdiData.notas_spin?.implicacao || 0
                          const N = pdiData.notas_spin?.necessidade || 0

                          const sY = 120 - (S * 8)
                          const pX = 120 + (P * 8)
                          const iY = 120 + (I * 8)
                          const nX = 120 - (N * 8)

                          return (
                            <svg viewBox="0 0 240 240" className="w-full h-full drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                              <defs>
                                <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
                                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                                  <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                  </feMerge>
                                </filter>
                              </defs>

                              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => {
                                const size = level * 8
                                return (
                                  <polygon
                                    key={level}
                                    points={`120,${120-size} ${120+size},120 120,${120+size} ${120-size},120`}
                                    fill="none"
                                    stroke={level % 2 === 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.08)"}
                                    strokeWidth="0.5"
                                  />
                                )
                              })}

                              <line x1="120" y1="40" x2="120" y2="200" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />
                              <line x1="40" y1="120" x2="200" y2="120" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />

                              <polygon
                                points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
                                fill="rgba(34, 197, 94, 0.15)"
                                stroke="rgb(34, 197, 94)"
                                strokeWidth="3"
                                filter="url(#greenGlow)"
                              />
                              <polygon
                                points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
                                fill="rgba(34, 197, 94, 0.3)"
                                stroke="rgb(34, 197, 94)"
                                strokeWidth="2.5"
                              />

                              <circle cx="120" cy={sY} r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
                              <circle cx="120" cy={sY} r="4" fill="rgb(34, 197, 94)" />
                              <circle cx="120" cy={sY} r="2" fill="rgb(255, 255, 255)" />

                              <circle cx={pX} cy="120" r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
                              <circle cx={pX} cy="120" r="4" fill="rgb(34, 197, 94)" />
                              <circle cx={pX} cy="120" r="2" fill="rgb(255, 255, 255)" />

                              <circle cx="120" cy={iY} r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
                              <circle cx="120" cy={iY} r="4" fill="rgb(34, 197, 94)" />
                              <circle cx="120" cy={iY} r="2" fill="rgb(255, 255, 255)" />

                              <circle cx={nX} cy="120" r="7" fill="rgb(34, 197, 94)" opacity="0.4" />
                              <circle cx={nX} cy="120" r="4" fill="rgb(34, 197, 94)" />
                              <circle cx={nX} cy="120" r="2" fill="rgb(255, 255, 255)" />

                              <g>
                                <rect x="100" y="15" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
                                <text x="120" y="32" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">S</text>
                              </g>
                              <g>
                                <rect x="200" y="108" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
                                <text x="220" y="125" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">P</text>
                              </g>
                              <g>
                                <rect x="100" y="201" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
                                <text x="120" y="218" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">I</text>
                              </g>
                              <g>
                                <rect x="0" y="108" width="40" height="24" rx="6" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
                                <text x="20" y="125" textAnchor="middle" fill="rgb(34, 197, 94)" fontSize="14" fontWeight="bold">N</text>
                              </g>
                            </svg>
                          )
                        })()}
                      </div>
                      <div className="grid grid-cols-4 gap-3 mt-6">
                        <div className="text-center p-3 bg-green-900/20 rounded-xl border border-green-500/20">
                          <p className="text-gray-400 text-xs mb-1">Situação</p>
                          <p className="text-xl font-bold text-green-400">{pdiData.notas_spin?.situacao?.toFixed(1) || '0.0'}</p>
                        </div>
                        <div className="text-center p-3 bg-green-900/20 rounded-xl border border-green-500/20">
                          <p className="text-gray-400 text-xs mb-1">Problema</p>
                          <p className="text-xl font-bold text-green-400">{pdiData.notas_spin?.problema?.toFixed(1) || '0.0'}</p>
                        </div>
                        <div className="text-center p-3 bg-green-900/20 rounded-xl border border-green-500/20">
                          <p className="text-gray-400 text-xs mb-1">Implicação</p>
                          <p className="text-xl font-bold text-green-400">{pdiData.notas_spin?.implicacao?.toFixed(1) || '0.0'}</p>
                        </div>
                        <div className="text-center p-3 bg-green-900/20 rounded-xl border border-green-500/20">
                          <p className="text-gray-400 text-xs mb-1">Necessidade</p>
                          <p className="text-xl font-bold text-green-400">{pdiData.notas_spin?.necessidade?.toFixed(1) || '0.0'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Foco da Semana */}
                    <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
                      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        <Zap className="w-6 h-6 text-green-400" />
                        Foco da Semana
                      </h2>
                      <div className="p-5 bg-gradient-to-r from-green-900/40 to-blue-900/40 rounded-xl border border-green-500/30">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-lg">
                            <p className="text-green-300 font-bold text-2xl">
                              {pdiData.foco_da_semana?.area || pdiData.meta_7_dias?.objetivo?.split(' ')[0] || '?'}
                            </p>
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-semibold">
                              {pdiData.foco_da_semana?.objetivo || pdiData.meta_7_dias?.objetivo || 'Definir objetivo'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Simulações Recomendadas */}
                  <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                      Simulações Recomendadas
                    </h2>
                    <div className="space-y-4">
                      {pdiData.simulacoes && pdiData.simulacoes.length > 0 ? (
                        pdiData.simulacoes.map((sim: any, idx: number) => (
                          <div key={idx} className="p-5 bg-gray-900/40 rounded-xl border border-gray-700/50">
                            <div className="flex gap-4">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                                <span className="text-green-400 font-bold">{sim.quantidade}x</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-white font-semibold mb-2">{sim.objetivo}</p>
                                <div className="space-y-2 mb-2">
                                  <div className="px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20 inline-block">
                                    <span className="text-blue-400 text-xs font-semibold">Persona: </span>
                                    <span className="text-gray-200 text-sm">{sim.persona_sugerida}</span>
                                  </div>
                                  {sim.objecao_para_treinar && (
                                    <div className="px-3 py-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20 inline-block ml-2">
                                      <span className="text-orange-400 text-xs font-semibold">Objeção: </span>
                                      <span className="text-gray-200 text-sm">{sim.objecao_para_treinar}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3 bg-gradient-to-br from-green-900/20 to-emerald-900/10 rounded-lg border border-green-500/20">
                                  <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider font-semibold">Critério de Sucesso</p>
                                  <p className="text-green-300 text-sm">{sim.criterio_sucesso}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : pdiData.acoes && pdiData.acoes.length > 0 ? (
                        pdiData.acoes.map((acao: any, idx: number) => (
                          <div key={idx} className="p-5 bg-gray-900/40 rounded-xl border border-gray-700/50">
                            <p className="text-white font-semibold mb-2">{acao.acao}</p>
                            <p className="text-gray-400 text-sm">{acao.resultado_esperado}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-center py-4">Nenhuma simulação definida ainda</p>
                      )}
                    </div>
                  </div>

                  {/* Próximo Ciclo */}
                  <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-green-400" />
                      Próximo Ciclo
                    </h2>
                    <p className="text-gray-200 leading-relaxed">
                      {pdiData.proximo_ciclo || pdiData.proximos_passos || 'Orientações aparecerão aqui...'}
                    </p>
                  </div>
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
