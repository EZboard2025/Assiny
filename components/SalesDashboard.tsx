'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, Award, Target, ArrowLeft, Loader2 } from 'lucide-react'

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
}

interface SalesDashboardProps {
  onClose: () => void
}

export default function SalesDashboard({ onClose }: SalesDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [sellers, setSellers] = useState<SellerPerformance[]>([])
  const [selectedSeller, setSelectedSeller] = useState<SellerPerformance | null>(null)

  useEffect(() => {
    loadSellersData()
  }, [])

  const loadSellersData = async () => {
    try {
      setLoading(true)

      // Obter company_id usando a função utilitária
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) {
        console.error('Company ID não encontrado')
        setLoading(false)
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
        setLoading(false)
        return
      }

      const { data: performanceData } = await response.json()

      if (!performanceData || performanceData.length === 0) {
        setSellers([])
        setLoading(false)
        return
      }

      setSellers(performanceData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
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
    ? sellers.reduce((sum, s) => sum + (s.overall_average || 0), 0) / sellers.length
    : 0
  const topPerformer = sellers.length > 0 ? sellers[0] : null

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando dados dos vendedores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar ao Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white mb-2">
            📊 Dashboard dos Vendedores
          </h1>
          <p className="text-gray-400">Visão geral do desempenho de toda a equipe</p>
        </div>

        {/* Cards de Estatísticas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-green-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total de Vendedores</p>
                <p className="text-3xl font-bold text-white">{totalSellers}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-green-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Média Geral do Time</p>
                <p className="text-3xl font-bold text-white">{avgGeneralPerformance.toFixed(1)}/10</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-green-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/20 rounded-xl">
                <Award className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Top Performer</p>
                <p className="text-lg font-bold text-white truncate">
                  {topPerformer?.user_name || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Vendedores */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl border border-green-500/20 overflow-hidden">
          <div className="p-6 border-b border-green-500/20">
            <h2 className="text-xl font-bold text-white">Performance Individual</h2>
          </div>

          {sellers.length === 0 ? (
            <div className="p-12 text-center">
              <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhum vendedor com dados de performance ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-green-500/10">
              {sellers.map((seller) => {
                const badge = getPerformanceBadge(seller.overall_average)

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
                        <div className={`text-3xl font-bold ${getPerformanceColor(seller.overall_average)}`}>
                          {seller.overall_average ? seller.overall_average.toFixed(1) : 'N/A'}/10
                        </div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white ${badge.color} mt-2`}>
                          {badge.text}
                        </span>
                      </div>
                    </div>

                    {/* Métricas SPIN */}
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-400 mb-1 font-bold">S</p>
                        <p className="text-lg font-bold text-white">
                          {seller.spin_s_average ? seller.spin_s_average.toFixed(1) : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-400 mb-1 font-bold">P</p>
                        <p className="text-lg font-bold text-white">
                          {seller.spin_p_average ? seller.spin_p_average.toFixed(1) : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-400 mb-1 font-bold">I</p>
                        <p className="text-lg font-bold text-white">
                          {seller.spin_i_average ? seller.spin_i_average.toFixed(1) : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-400 mb-1 font-bold">N</p>
                        <p className="text-lg font-bold text-white">
                          {seller.spin_n_average ? seller.spin_n_average.toFixed(1) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Total de Sessões: <span className="text-white font-medium">{seller.total_sessions}</span></span>
                      <span className="text-gray-400">Tendência: <span className="text-white font-medium capitalize">{seller.trend || 'N/A'}</span></span>
                    </div>

                    {/* Detalhes expandidos */}
                    {selectedSeller?.user_id === seller.user_id && (
                      <div className="mt-6 pt-6 border-t border-green-500/20 space-y-6">
                        {/* Timeline de Evolução */}
                        {seller.timeline && seller.timeline.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-purple-400">📊 Timeline de Evolução</h4>
                              <span className="text-xs text-gray-500">
                                {seller.timeline.length} {seller.timeline.length === 1 ? 'sessão' : 'sessões'} no total
                              </span>
                            </div>

                            {/* Container scrollável */}
                            <div className="relative max-h-[400px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
                              {/* Linha de conexão - ajustada para não sobrepor os círculos */}
                              <div className="absolute left-5 top-6 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/50 via-purple-500/30 to-transparent"></div>

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
                                          <p className="text-xs font-bold text-blue-400">
                                            {session.spin_scores.S.toFixed(1)}
                                          </p>
                                        </div>
                                        <div className="bg-gray-900/50 rounded p-1">
                                          <p className="text-[10px] text-gray-500 mb-0.5">P</p>
                                          <p className="text-xs font-bold text-purple-400">
                                            {session.spin_scores.P.toFixed(1)}
                                          </p>
                                        </div>
                                        <div className="bg-gray-900/50 rounded p-1">
                                          <p className="text-[10px] text-gray-500 mb-0.5">I</p>
                                          <p className="text-xs font-bold text-pink-400">
                                            {session.spin_scores.I.toFixed(1)}
                                          </p>
                                        </div>
                                        <div className="bg-gray-900/50 rounded p-1">
                                          <p className="text-[10px] text-gray-500 mb-0.5">N</p>
                                          <p className="text-xs font-bold text-orange-400">
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Pontos Fortes */}
                          {seller.top_strengths && seller.top_strengths.length > 0 && (
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

                          {/* Gaps Críticos */}
                          {seller.critical_gaps && seller.critical_gaps.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-red-400 mb-3">⚠️ Gaps Críticos</h4>
                              <ul className="space-y-2">
                                {seller.critical_gaps.map((gap, idx) => (
                                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                    <span className="text-red-400 mt-0.5">•</span>
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
    </div>
  )
}
