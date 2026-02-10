'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, Award, Target, ArrowLeft, Loader2, MessageSquare, Activity, TrendingDown, X, FileText, Sparkles, AlertTriangle, AlertCircle, Calendar, CheckCircle, Zap, Search, Video, BookOpen, Trophy, Brain, ChevronDown, ChevronUp, ChevronRight, Phone, Clock, Percent, Mic, Lightbulb, Eye } from 'lucide-react'

// Helper para traduzir termos de performance
const translatePerformanceLevel = (level: string | null): string => {
  if (!level) return 'N/A'
  const translations: Record<string, string> = {
    'excellent': 'Excelente',
    'excelente': 'Excelente',
    'very_good': 'Muito Bom',
    'good': 'Bom',
    'bom': 'Bom',
    'regular': 'Regular',
    'needs_improvement': 'Precisa Melhorar',
    'poor': 'Fraco',
    'legendary': 'Lendário',
    'critico': 'Crítico'
  }
  return translations[level.toLowerCase()] || level
}

const translateClassification = (classification: string | null): string => {
  if (!classification) return 'N/A'
  const translations: Record<string, string> = {
    'excelente': 'Excelente',
    'bom': 'Bom',
    'medio': 'Médio',
    'ruim': 'Ruim',
    'pessimo': 'Péssimo'
  }
  return translations[classification.toLowerCase()] || classification
}

// Helper para parsear mensagens de transcrição de follow-up
interface ParsedMessage {
  time: string
  sender: string
  text: string
  isVendedor: boolean
}

const parseTranscriptionMessages = (transcription: string): ParsedMessage[] => {
  if (!transcription) return []

  const messages: ParsedMessage[] = []

  // Primeiro, tenta parsear linha por linha com formato [HH:MM] Nome: Mensagem
  const lines = transcription.split('\n').filter(line => line.trim())

  for (const line of lines) {
    // Formato: [HH:MM] Nome: Mensagem
    const timeMatch = line.match(/^\[(\d{2}:\d{2})\]\s*([^:]+):\s*(.+)$/)
    if (timeMatch) {
      const [, time, sender, text] = timeMatch
      const senderTrimmed = sender.trim()
      messages.push({
        time,
        sender: senderTrimmed,
        text: text.trim(),
        isVendedor: senderTrimmed.toLowerCase().includes('vendedor') ||
                    senderTrimmed.toLowerCase().includes('seller') ||
                    senderTrimmed.toLowerCase().includes('rep')
      })
      continue
    }

    // Formato simples: Nome: Mensagem
    const simpleMatch = line.match(/^([^:]+):\s*(.+)$/)
    if (simpleMatch) {
      const [, sender, text] = simpleMatch
      const senderTrimmed = sender.trim()
      // Evita falsas detecções (ex: URLs com ":")
      if (senderTrimmed.length < 30 && !senderTrimmed.includes('http')) {
        messages.push({
          time: '',
          sender: senderTrimmed,
          text: text.trim(),
          isVendedor: senderTrimmed.toLowerCase().includes('vendedor') ||
                      senderTrimmed.toLowerCase().includes('seller') ||
                      senderTrimmed.toLowerCase().includes('rep')
        })
      }
    }
  }

  return messages
}

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
  playbook_aptitude?: {
    score: number
    percentage: number
    level: string
    summary: string
    dimension_analysis?: {
      opening?: string
      closing?: string
      conduct?: string
      required_scripts?: string
      process?: string
    }
    strengths: string[]
    gaps: string[]
    priority_actions?: string[]
  }
  real_calls_summary?: string
}

interface SavedAnalysis {
  id: string
  ai_summary: AISummary
  raw_metrics: {
    total_roleplay_sessions?: number
    total_meet_evaluations?: number
    total_challenges?: number
  }
  created_at: string
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
  onClose?: () => void
  embedded?: boolean
}

interface Playbook {
  id: string
  title: string
  content: string
  version: number
  is_active: boolean
}

export default function SalesDashboard({ onClose, embedded = false }: SalesDashboardProps) {
  const [initialLoading, setInitialLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [sellers, setSellers] = useState<SellerPerformance[]>([])
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // AI Summary states
  const [aiSummaries, setAiSummaries] = useState<Record<string, AISummary>>({})
  const [aiSummaryLoading, setAiSummaryLoading] = useState<string | null>(null)
  const [savedAnalysisMetrics, setSavedAnalysisMetrics] = useState<Record<string, SavedAnalysis['raw_metrics']>>({})

  // Comprehensive data states
  const [comprehensiveData, setComprehensiveData] = useState<Record<string, ComprehensiveData>>({})
  const [comprehensiveLoading, setComprehensiveLoading] = useState<string | null>(null)

  // Playbook state
  const [playbook, setPlaybook] = useState<Playbook | null>(null)

  // Modal states
  const [selectedSellerForPDI, setSelectedSellerForPDI] = useState<{userId: string, userName: string} | null>(null)
  const [pdiData, setPdiData] = useState<any>(null)
  const [pdiLoading, setPdiLoading] = useState(false)
  const [selectedFollowUp, setSelectedFollowUp] = useState<any>(null)
  const [selectedMeet, setSelectedMeet] = useState<any>(null)
  const [selectedRoleplay, setSelectedRoleplay] = useState<any>(null)
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null)

  useEffect(() => {
    loadSellersData()
    loadPlaybook()
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

  const loadPlaybook = async () => {
    try {
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) return

      const response = await fetch(`/api/playbook/save?companyId=${companyId}`)
      const result = await response.json()

      if (response.ok && result.success && result.playbook) {
        setPlaybook(result.playbook)
      }
    } catch (error) {
      console.error('Erro ao carregar playbook:', error)
    }
  }

  const loadComprehensiveData = async (sellerId: string): Promise<ComprehensiveData | null> => {
    if (comprehensiveData[sellerId]) return comprehensiveData[sellerId]

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
        return data as ComprehensiveData
      }
      return null
    } catch (error) {
      console.error('Erro ao carregar dados detalhados:', error)
      return null
    } finally {
      setComprehensiveLoading(null)
    }
  }

  // Load saved AI analysis for a seller
  const loadSavedAISummary = async (sellerId: string): Promise<SavedAnalysis | null> => {
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
          // Store raw_metrics for delta comparison
          if (data.latest.raw_metrics) {
            setSavedAnalysisMetrics(prev => ({ ...prev, [sellerId]: data.latest.raw_metrics }))
          }
          return data.latest as SavedAnalysis
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
      const [compData, savedAnalysis] = await Promise.all([
        loadComprehensiveData(sellerId),
        loadSavedAISummary(sellerId)
      ])

      if (!savedAnalysis) {
        // No analysis exists - auto-generate
        console.log(`📊 Auto-gerando análise IA para vendedor ${sellerId} (sem análise anterior)`)
        await generateAISummary(sellerId, false)
      } else if (compData) {
        // Check interaction delta
        const currentTotal =
          (compData.meets?.total || 0) +
          (compData.challenges?.total || 0) +
          (compData.roleplay?.total || 0)

        const savedTotal =
          (savedAnalysis.raw_metrics?.total_meet_evaluations || 0) +
          (savedAnalysis.raw_metrics?.total_challenges || 0) +
          (savedAnalysis.raw_metrics?.total_roleplay_sessions || 0)

        const delta = currentTotal - savedTotal

        console.log(`📊 Delta de interações: ${delta} (atual: ${currentTotal}, salvo: ${savedTotal})`)

        if (delta >= 10) {
          // Auto-regenerate
          console.log(`📊 Auto-regenerando análise IA (delta >= 10)`)
          await generateAISummary(sellerId, true)
        }
      }
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
    if (embedded) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Carregando dados dos vendedores...</p>
          </div>
        </div>
      )
    }
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
    <div className={embedded ? '' : 'fixed inset-0 z-[100] bg-gray-50 overflow-y-auto'}>
      <div className={embedded ? '' : 'max-w-7xl mx-auto px-6 py-8'}>
        {/* Header - only in overlay mode */}
        {!embedded && (
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
        )}

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
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-gray-600" />
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
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-gray-600" />
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
                          <p className="text-lg font-bold text-gray-900">{seller.followup_data?.total_analyses || 0}</p>
                        </div>
                        <div className="text-center p-2.5 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">Pontos Fortes</p>
                          <p className="text-lg font-bold text-gray-900">{seller.top_strengths.length}</p>
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
                              {sellerAISummary && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    generateAISummary(seller.user_id, true)
                                  }}
                                  disabled={aiSummaryLoading === seller.user_id}
                                  className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                  {aiSummaryLoading === seller.user_id ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Regenerando...
                                    </>
                                  ) : (
                                    <>
                                      <Brain className="w-4 h-4" />
                                      Regenerar Análise IA
                                    </>
                                  )}
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedSellerForPDI({ userId: seller.user_id, userName: seller.user_name })
                                }}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                Ver PDI
                              </button>
                            </div>

                            {/* Auto-generating indicator */}
                            {aiSummaryLoading === seller.user_id && !sellerAISummary && (
                              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-center gap-3">
                                <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">Gerando análise IA automaticamente...</p>
                                  <p className="text-xs text-gray-500">Isso pode levar alguns segundos</p>
                                </div>
                              </div>
                            )}

                            {/* Unified Content - All Data in One View */}
                            <div className="space-y-6">
                              {/* SECTION 1: Quick Stats Overview */}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
                                  <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Nota Geral</p>
                                  <p className={`text-2xl font-bold ${getScoreColor(seller.overall_average)}`}>
                                    {seller.overall_average?.toFixed(1) || '0.0'}
                                  </p>
                                </div>
                                <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
                                  <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Sessões Roleplay</p>
                                  <p className="text-2xl font-bold text-gray-900">{seller.total_sessions}</p>
                                </div>
                                <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
                                  <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Reuniões Reais</p>
                                  <p className="text-2xl font-bold text-gray-900">{sellerCompData?.meets?.total || 0}</p>
                                </div>
                                <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
                                  <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Follow-ups</p>
                                  <p className="text-2xl font-bold text-gray-900">{seller.followup_data?.total_analyses || 0}</p>
                                </div>
                                <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
                                  <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">SPIN Média</p>
                                  <p className={`text-2xl font-bold ${getScoreColor(
                                    (seller.spin_s_average + seller.spin_p_average + seller.spin_i_average + seller.spin_n_average) / 4
                                  )}`}>
                                    {((seller.spin_s_average + seller.spin_p_average + seller.spin_i_average + seller.spin_n_average) / 4).toFixed(1)}
                                  </p>
                                </div>
                              </div>

                              {/* SECTION 2: AI Summary (if generated) */}
                              {sellerAISummary && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200">
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                      <Brain className="w-4 h-4 text-green-600" />
                                      Análise IA
                                    </h4>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                      sellerAISummary.performance_level === 'excelente' ? 'bg-green-100 text-green-700' :
                                      sellerAISummary.performance_level === 'bom' ? 'bg-green-50 text-green-600' :
                                      sellerAISummary.performance_level === 'regular' ? 'bg-yellow-100 text-yellow-700' :
                                      sellerAISummary.performance_level === 'precisa_atencao' ? 'bg-yellow-50 text-yellow-600' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {sellerAISummary.performance_level?.replace('_', ' ').toUpperCase() || 'N/A'}
                                    </span>
                                  </div>

                                  <p className="text-gray-600 text-sm mb-4 leading-relaxed">{sellerAISummary.summary}</p>

                                  <div className="grid md:grid-cols-3 gap-3 mb-4">
                                    <div className="bg-gray-50 rounded-lg p-3">
                                      <h5 className="text-xs font-semibold text-green-700 mb-2">Destaques</h5>
                                      <ul className="space-y-1.5">
                                        {sellerAISummary.highlights.slice(0, 3).map((h, i) => (
                                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                            <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{h}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-3">
                                      <h5 className="text-xs font-semibold text-yellow-700 mb-2">Atenção</h5>
                                      <ul className="space-y-1.5">
                                        {sellerAISummary.concerns.slice(0, 3).map((c, i) => (
                                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                            <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                                            <span>{c}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-3">
                                      <h5 className="text-xs font-semibold text-gray-700 mb-2">Recomendações</h5>
                                      <ul className="space-y-1.5">
                                        {sellerAISummary.recommendations.slice(0, 3).map((r, i) => (
                                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                                            <Sparkles className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>{r}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>

                                  {sellerAISummary.priority_action && (
                                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                      <p className="text-xs text-green-700 font-semibold mb-1 flex items-center gap-1.5">
                                        <Zap className="w-3 h-3" />
                                        Ação Prioritária
                                      </p>
                                      <p className="text-sm text-gray-700">{sellerAISummary.priority_action}</p>
                                    </div>
                                  )}

                                  {sellerAISummary.playbook_aptitude && (
                                    <div className="mt-3 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                                      {/* Header with score */}
                                      <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm text-emerald-800 font-semibold flex items-center gap-2">
                                          <FileText className="w-4 h-4 text-emerald-600" />
                                          Aptidão ao Playbook
                                        </p>
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                            (sellerAISummary.playbook_aptitude.percentage || sellerAISummary.playbook_aptitude.score * 10) >= 80 ? 'bg-green-100 text-green-700' :
                                            (sellerAISummary.playbook_aptitude.percentage || sellerAISummary.playbook_aptitude.score * 10) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                          }`}>
                                            {sellerAISummary.playbook_aptitude.percentage
                                              ? `${sellerAISummary.playbook_aptitude.percentage.toFixed(0)}%`
                                              : `${(sellerAISummary.playbook_aptitude.score * 10).toFixed(0)}%`
                                            }
                                          </span>
                                        </div>
                                      </div>

                                      {/* Summary text */}
                                      {sellerAISummary.playbook_aptitude.summary && (
                                        <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                                          {sellerAISummary.playbook_aptitude.summary}
                                        </p>
                                      )}

                                      {/* Strengths and Gaps in two columns */}
                                      <div className="grid grid-cols-2 gap-3 mb-3">
                                        {/* Strengths */}
                                        {sellerAISummary.playbook_aptitude.strengths && sellerAISummary.playbook_aptitude.strengths.length > 0 && (
                                          <div className="bg-white/70 rounded-lg p-3">
                                            <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                                              <CheckCircle className="w-3 h-3" />
                                              Pontos Fortes
                                            </p>
                                            <ul className="space-y-1">
                                              {sellerAISummary.playbook_aptitude.strengths.slice(0, 4).map((strength, i) => (
                                                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                                  <span className="text-green-500 mt-0.5">•</span>
                                                  {strength}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* Gaps */}
                                        {sellerAISummary.playbook_aptitude.gaps && sellerAISummary.playbook_aptitude.gaps.length > 0 && (
                                          <div className="bg-white/70 rounded-lg p-3">
                                            <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
                                              <AlertCircle className="w-3 h-3" />
                                              Precisa Melhorar
                                            </p>
                                            <ul className="space-y-1">
                                              {sellerAISummary.playbook_aptitude.gaps.slice(0, 4).map((gap, i) => (
                                                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                                  <span className="text-orange-500 mt-0.5">•</span>
                                                  {gap}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>

                                      {/* Priority Actions */}
                                      {sellerAISummary.playbook_aptitude.priority_actions && sellerAISummary.playbook_aptitude.priority_actions.length > 0 && (
                                        <div className="bg-emerald-100/50 rounded-lg p-3 mt-2">
                                          <p className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1">
                                            <Zap className="w-3 h-3" />
                                            Ações Prioritárias
                                          </p>
                                          <ul className="space-y-1">
                                            {sellerAISummary.playbook_aptitude.priority_actions.map((action, i) => (
                                              <li key={i} className="text-xs text-emerald-700 flex items-start gap-1">
                                                <span className="font-bold">{i + 1}.</span>
                                                {action}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* SECTION 2.5: Real Calls Performance Summary */}
                              {sellerAISummary?.real_calls_summary && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200">
                                  <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                                    <Video className="w-4 h-4 text-green-600" />
                                    Performance em Reuniões Reais
                                  </h4>
                                  <p className="text-gray-600 text-sm leading-relaxed">
                                    {sellerAISummary.real_calls_summary}
                                  </p>
                                </div>
                              )}

                              {/* Playbook Available Badge */}
                              {playbook && !sellerAISummary && (
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                                      <FileText className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">Playbook Disponível</p>
                                      <p className="text-xs text-gray-500">A análise IA será gerada automaticamente</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* SECTION 3: SPIN Scores + Strengths/Gaps */}
                              <div className="grid md:grid-cols-2 gap-4">
                                {/* SPIN Scores */}
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Target className="w-4 h-4" />
                                    Scores SPIN (Treinamento)
                                  </h4>
                                  <div className="grid grid-cols-4 gap-2">
                                    {[
                                      { key: 'S', label: 'Situação', value: seller.spin_s_average },
                                      { key: 'P', label: 'Problema', value: seller.spin_p_average },
                                      { key: 'I', label: 'Implicação', value: seller.spin_i_average },
                                      { key: 'N', label: 'Necessidade', value: seller.spin_n_average }
                                    ].map(spin => (
                                      <div key={spin.key} className={`${getScoreBgColor(spin.value)} rounded-lg p-3 text-center`}>
                                        <p className="text-[10px] text-gray-500 mb-1">{spin.key}</p>
                                        <p className={`text-xl font-bold ${getScoreColor(spin.value)}`}>
                                          {spin.value?.toFixed(1) || '0'}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Strengths & Gaps Combined */}
                                <div className="bg-white rounded-xl p-4 border border-gray-200">
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Activity className="w-4 h-4" />
                                    Pontos Fortes & Gaps
                                  </h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-[10px] font-medium text-green-600 uppercase mb-2">Fortes ({seller.top_strengths.length})</p>
                                      {seller.top_strengths.length > 0 ? (
                                        <ul className="space-y-1">
                                          {seller.top_strengths.slice(0, 3).map((s, i) => (
                                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                              <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                              <span className="line-clamp-1">{s.text}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-xs text-gray-400">Nenhum ainda</p>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-medium text-yellow-600 uppercase mb-2">Gaps ({seller.critical_gaps.length})</p>
                                      {seller.critical_gaps.length > 0 ? (
                                        <ul className="space-y-1">
                                          {seller.critical_gaps.slice(0, 3).map((g, i) => (
                                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                              <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                                              <span className="line-clamp-1">{g.text}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-xs text-gray-400">Nenhum ainda</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* SECTION 4: Histórico de Avaliações (4 tipos) */}
                              <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-green-600" />
                                    Histórico de Avaliações
                                  </h4>
                                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    Clique para ver detalhes
                                  </span>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                  {/* Treinos (Roleplays) */}
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                        <Mic className="w-3 h-3" />
                                        Treinos
                                      </span>
                                      <span className="text-lg font-bold text-gray-900">{sellerCompData?.roleplay?.total || 0}</span>
                                    </div>
                                    {sellerCompData?.roleplay?.sessions && sellerCompData.roleplay.sessions.length > 0 ? (
                                      <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {sellerCompData.roleplay.sessions.filter((s: any) => s.status === 'completed').slice(0, 3).map((session: any) => (
                                          <div
                                            key={session.id}
                                            className="group flex items-center justify-between p-2.5 bg-white rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-200 transition-all border border-gray-100 hover:shadow-sm"
                                            onClick={(e) => { e.stopPropagation(); setSelectedRoleplay(session); }}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                                                session.performance_level === 'excellent' || session.performance_level === 'excelente' || session.performance_level === 'legendary' ? 'bg-green-100 text-green-700' :
                                                session.performance_level === 'very_good' || session.performance_level === 'good' || session.performance_level === 'bom' ? 'bg-green-50 text-green-600' :
                                                session.performance_level === 'poor' || session.performance_level === 'needs_improvement' ? 'bg-red-50 text-red-600' :
                                                'bg-yellow-100 text-yellow-700'
                                              }`}>
                                                {translatePerformanceLevel(session.performance_level)}
                                              </span>
                                              <span className="text-xs text-gray-500">{new Date(session.created_at).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <span className={`text-sm font-bold ${getScoreColor(session.overall_score)}`}>{session.overall_score?.toFixed(1) || 'N/A'}</span>
                                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 text-center py-3">Nenhum treino avaliado</p>
                                    )}
                                  </div>

                                  {/* Desafios */}
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                        <Lightbulb className="w-3 h-3" />
                                        Desafios
                                      </span>
                                      <span className="text-lg font-bold text-gray-900">{sellerCompData?.challenges?.total || 0}</span>
                                    </div>
                                    {sellerCompData?.challenges?.items && sellerCompData.challenges.items.length > 0 ? (
                                      <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {sellerCompData.challenges.items.filter((c: any) => c.completed).slice(0, 3).map((challenge: any) => (
                                          <div
                                            key={challenge.id}
                                            className="group flex items-center justify-between p-2.5 bg-white rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-200 transition-all border border-gray-100 hover:shadow-sm"
                                            onClick={(e) => { e.stopPropagation(); setSelectedChallenge(challenge); }}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className="text-xs text-gray-600 truncate">{new Date(challenge.created_at).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <span className={`text-sm font-bold ${getScoreColor(challenge.score)}`}>{challenge.score?.toFixed(1) || 'N/A'}</span>
                                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 text-center py-3">Nenhum desafio completado</p>
                                    )}
                                  </div>

                                  {/* Reuniões */}
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                        <Video className="w-3 h-3" />
                                        Reuniões
                                      </span>
                                      <span className="text-lg font-bold text-gray-900">{sellerCompData?.meets?.total || 0}</span>
                                    </div>
                                    {sellerCompData?.meets?.evaluations && sellerCompData.meets.evaluations.length > 0 ? (
                                      <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {sellerCompData.meets.evaluations.slice(0, 3).map((meet: any) => (
                                          <div
                                            key={meet.id}
                                            className="group flex items-center justify-between p-2.5 bg-white rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-200 transition-all border border-gray-100 hover:shadow-sm"
                                            onClick={(e) => { e.stopPropagation(); setSelectedMeet(meet); }}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className="text-xs text-gray-600">{new Date(meet.created_at).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <span className={`text-sm font-bold ${getScoreColor(meet.overall_score)}`}>
                                                {meet.overall_score?.toFixed(1) || 'N/A'}
                                              </span>
                                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 text-center py-3">Nenhuma reunião avaliada</p>
                                    )}
                                  </div>

                                  {/* Mensagens Analisadas (Follow-ups) */}
                                  <div className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                                        <MessageSquare className="w-3 h-3" />
                                        Mensagens Analisadas
                                      </span>
                                      <span className="text-lg font-bold text-gray-900">{seller.followup_data?.total_analyses || 0}</span>
                                    </div>
                                    {seller.followup_data && seller.followup_data.total_analyses > 0 ? (
                                      <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {seller.followup_data.recent_analyses.slice(0, 3).map(analysis => (
                                          <div
                                            key={analysis.id}
                                            className="group flex items-center justify-between p-2.5 bg-white rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-200 transition-all border border-gray-100 hover:shadow-sm"
                                            onClick={(e) => { e.stopPropagation(); setSelectedFollowUp(analysis); }}
                                          >
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                                                analysis.classificacao === 'excelente' ? 'bg-green-100 text-green-700' :
                                                analysis.classificacao === 'bom' ? 'bg-green-50 text-green-600' :
                                                analysis.classificacao === 'medio' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-50 text-red-600'
                                              }`}>
                                                {translateClassification(analysis.classificacao)}
                                              </span>
                                              <span className="text-xs text-gray-500 truncate">{analysis.tipo_venda}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <span className={`text-sm font-bold ${getScoreColor(analysis.nota_final)}`}>{analysis.nota_final.toFixed(1)}</span>
                                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 text-center py-3">Nenhuma mensagem analisada</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
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
            <div className="bg-gray-50 p-5 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Análise de Mensagem</h2>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${
                      selectedFollowUp.classificacao === 'excelente' ? 'bg-green-100 text-green-700' :
                      selectedFollowUp.classificacao === 'bom' ? 'bg-green-50 text-green-600' :
                      selectedFollowUp.classificacao === 'medio' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {translateClassification(selectedFollowUp.classificacao)}
                    </span>
                    <span className={`text-xl font-bold ${getScoreColor(selectedFollowUp.nota_final)}`}>{selectedFollowUp.nota_final.toFixed(1)}/10</span>
                  </div>
                </div>
                <button onClick={() => setSelectedFollowUp(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
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
                  <h3 className="font-semibold text-gray-900 mb-2">Conversa</h3>
                  <div className="bg-gray-100 rounded-lg p-4 border border-gray-200 max-h-72 overflow-y-auto">
                    {(() => {
                      const messages = parseTranscriptionMessages(selectedFollowUp.transcricao_filtrada)
                      if (messages.length === 0) {
                        return <p className="text-gray-700 text-sm whitespace-pre-wrap">{selectedFollowUp.transcricao_filtrada}</p>
                      }
                      return (
                        <div className="space-y-3">
                          {messages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex ${msg.isVendedor ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                  msg.isVendedor
                                    ? 'bg-emerald-500 text-white rounded-br-md'
                                    : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-200'
                                }`}
                              >
                                <div className={`text-xs font-medium mb-1 ${msg.isVendedor ? 'text-emerald-100' : 'text-gray-500'}`}>
                                  {msg.sender} {msg.time && <span className="opacity-75">• {msg.time}</span>}
                                </div>
                                <p className="text-sm leading-relaxed">{msg.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
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
            <div className="bg-gray-50 p-5 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Avaliação de Reunião</h2>
                  <div className="flex items-center gap-2">
                    {selectedMeet.performance_level && (
                      <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${
                        selectedMeet.performance_level === 'excellent' || selectedMeet.performance_level === 'legendary' ? 'bg-green-100 text-green-700' :
                        selectedMeet.performance_level === 'very_good' || selectedMeet.performance_level === 'good' ? 'bg-green-50 text-green-600' :
                        selectedMeet.performance_level === 'needs_improvement' || selectedMeet.performance_level === 'poor' ? 'bg-red-50 text-red-600' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {translatePerformanceLevel(selectedMeet.performance_level)}
                      </span>
                    )}
                    <span className={`text-xl font-bold ${getScoreColor(selectedMeet.overall_score)}`}>
                      {selectedMeet.overall_score?.toFixed(1) || 'N/A'}/10
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedMeet(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="mb-5">
                <p className="text-xs text-gray-500 mb-1">Data</p>
                <p className="font-medium text-gray-900">{new Date(selectedMeet.created_at).toLocaleDateString('pt-BR')}</p>
              </div>

              {/* SPIN Scores */}
              {selectedMeet.spin_scores && (selectedMeet.spin_scores.S > 0 || selectedMeet.spin_scores.P > 0 || selectedMeet.spin_scores.I > 0 || selectedMeet.spin_scores.N > 0) && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Scores SPIN</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { key: 'S', label: 'Situação', value: selectedMeet.spin_scores?.S },
                      { key: 'P', label: 'Problema', value: selectedMeet.spin_scores?.P },
                      { key: 'I', label: 'Implicação', value: selectedMeet.spin_scores?.I },
                      { key: 'N', label: 'Necessidade', value: selectedMeet.spin_scores?.N }
                    ].map(spin => (
                      <div key={spin.key} className={`${getScoreBgColor(spin.value)} rounded-lg p-3 text-center`}>
                        <p className="text-[10px] text-gray-500 mb-1">{spin.key}</p>
                        <p className={`text-xl font-bold ${getScoreColor(spin.value)}`}>
                          {spin.value?.toFixed(1) || '0'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SPIN Feedback */}
              {selectedMeet.spin_feedback && (selectedMeet.spin_feedback.S || selectedMeet.spin_feedback.P || selectedMeet.spin_feedback.I || selectedMeet.spin_feedback.N) && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Feedback SPIN</h3>
                  <div className="space-y-3">
                    {[
                      { key: 'S', label: 'Situação', feedback: selectedMeet.spin_feedback?.S },
                      { key: 'P', label: 'Problema', feedback: selectedMeet.spin_feedback?.P },
                      { key: 'I', label: 'Implicação', feedback: selectedMeet.spin_feedback?.I },
                      { key: 'N', label: 'Necessidade', feedback: selectedMeet.spin_feedback?.N }
                    ].filter(item => item.feedback).map(item => (
                      <div key={item.key} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-1">{item.label} ({item.key})</p>
                        <p className="text-sm text-gray-700">{item.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedMeet.summary && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Resumo Executivo</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 text-sm">{selectedMeet.summary}</p>
                  </div>
                </div>
              )}

              {/* Strengths & Gaps */}
              <div className="grid md:grid-cols-2 gap-4 mb-5">
                {selectedMeet.strengths && selectedMeet.strengths.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-green-700 mb-2">Pontos Fortes</h3>
                    <ul className="space-y-2">
                      {selectedMeet.strengths.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedMeet.critical_gaps && selectedMeet.critical_gaps.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-yellow-700 mb-2">Gaps Críticos</h3>
                    <ul className="space-y-2">
                      {selectedMeet.critical_gaps.map((g: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Priority Improvements */}
              {selectedMeet.priority_improvements && selectedMeet.priority_improvements.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Melhorias Prioritárias</h3>
                  <ul className="space-y-2">
                    {selectedMeet.priority_improvements.map((imp: any, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <Zap className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {typeof imp === 'string' ? imp : imp.area || imp.action_plan || JSON.stringify(imp)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Objections Analysis */}
              {selectedMeet.objections_analysis && selectedMeet.objections_analysis.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Análise de Objeções</h3>
                  <div className="space-y-3">
                    {selectedMeet.objections_analysis.map((obj: any, i: number) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600 bg-gray-200 px-2 py-0.5 rounded">
                            {obj.objection_type || 'Objeção'}
                          </span>
                          <span className={`text-sm font-bold ${getScoreColor(obj.score)}`}>
                            {obj.score?.toFixed(1) || 'N/A'}/10
                          </span>
                        </div>
                        {obj.objection_text && (
                          <p className="text-xs text-gray-500 italic mb-2">"{obj.objection_text}"</p>
                        )}
                        {obj.detailed_analysis && (
                          <p className="text-sm text-gray-700">{obj.detailed_analysis}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Playbook Adherence */}
              {selectedMeet.playbook_adherence && (
                <div className="border-t border-gray-200 pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-green-600" />
                      Aderência ao Playbook
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${
                        selectedMeet.playbook_adherence.adherence_level === 'exemplary' ? 'bg-green-100 text-green-700' :
                        selectedMeet.playbook_adherence.adherence_level === 'compliant' ? 'bg-green-50 text-green-600' :
                        selectedMeet.playbook_adherence.adherence_level === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {selectedMeet.playbook_adherence.adherence_level === 'exemplary' ? 'Exemplar' :
                         selectedMeet.playbook_adherence.adherence_level === 'compliant' ? 'Conforme' :
                         selectedMeet.playbook_adherence.adherence_level === 'partial' ? 'Parcial' : 'Não Conforme'}
                      </span>
                      <span className={`text-lg font-bold ${
                        selectedMeet.playbook_adherence.overall_adherence_score >= 70 ? 'text-green-600' :
                        selectedMeet.playbook_adherence.overall_adherence_score >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {selectedMeet.playbook_adherence.overall_adherence_score}%
                      </span>
                    </div>
                  </div>

                  {/* Dimensions */}
                  {selectedMeet.playbook_adherence.dimensions && (
                    <div className="grid grid-cols-5 gap-2 mb-4">
                      {[
                        { key: 'opening', label: 'Abertura' },
                        { key: 'closing', label: 'Fechamento' },
                        { key: 'conduct', label: 'Conduta' },
                        { key: 'required_scripts', label: 'Scripts' },
                        { key: 'process', label: 'Processo' }
                      ].map(dim => {
                        const dimData = selectedMeet.playbook_adherence.dimensions[dim.key]
                        if (!dimData || dimData.status === 'not_evaluated') return null
                        return (
                          <div key={dim.key} className={`text-center p-2 rounded-lg ${
                            dimData.score >= 70 ? 'bg-green-50' :
                            dimData.score >= 50 ? 'bg-yellow-50' : 'bg-red-50'
                          }`}>
                            <p className="text-[9px] text-gray-500 mb-1">{dim.label}</p>
                            <p className={`text-sm font-bold ${
                              dimData.score >= 70 ? 'text-green-600' :
                              dimData.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {dimData.score}%
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Violations */}
                  {selectedMeet.playbook_adherence.violations && selectedMeet.playbook_adherence.violations.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-red-700 mb-2">Violações</h4>
                      <div className="space-y-2">
                        {selectedMeet.playbook_adherence.violations.map((v: any, i: number) => (
                          <div key={i} className="bg-red-50 rounded-lg p-3 border border-red-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-red-700">{v.criterion}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                v.severity === 'critical' ? 'bg-red-200 text-red-800' :
                                v.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {v.severity === 'critical' ? 'Crítico' : v.severity === 'high' ? 'Alto' : 'Médio'}
                              </span>
                            </div>
                            {v.evidence && <p className="text-xs text-gray-600 italic mb-1">"{v.evidence}"</p>}
                            {v.recommendation && <p className="text-xs text-gray-700">{v.recommendation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missed Requirements */}
                  {selectedMeet.playbook_adherence.missed_requirements && selectedMeet.playbook_adherence.missed_requirements.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-yellow-700 mb-2">Requisitos Não Cumpridos</h4>
                      <div className="space-y-2">
                        {selectedMeet.playbook_adherence.missed_requirements.map((m: any, i: number) => (
                          <div key={i} className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                            <p className="text-xs font-medium text-yellow-800 mb-1">{m.criterion}</p>
                            {m.expected && <p className="text-xs text-gray-600 mb-1">Esperado: {m.expected}</p>}
                            {m.recommendation && <p className="text-xs text-gray-700">{m.recommendation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exemplary Moments */}
                  {selectedMeet.playbook_adherence.exemplary_moments && selectedMeet.playbook_adherence.exemplary_moments.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-green-700 mb-2">Momentos Exemplares</h4>
                      <div className="space-y-2">
                        {selectedMeet.playbook_adherence.exemplary_moments.map((m: any, i: number) => (
                          <div key={i} className="bg-green-50 rounded-lg p-3 border border-green-100">
                            <p className="text-xs font-medium text-green-800 mb-1">{m.criterion}</p>
                            {m.evidence && <p className="text-xs text-gray-600 italic mb-1">"{m.evidence}"</p>}
                            {m.why_exemplary && <p className="text-xs text-gray-700">{m.why_exemplary}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coaching Notes */}
                  {selectedMeet.playbook_adherence.coaching_notes && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 mb-1">Notas de Coaching</h4>
                      <p className="text-sm text-gray-700">{selectedMeet.playbook_adherence.coaching_notes}</p>
                    </div>
                  )}
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
                                  <div className="inline-block px-2.5 py-1 bg-gray-100 rounded-md border border-gray-200">
                                    <span className="text-gray-600 text-xs font-medium">Persona: </span>
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

      {/* Modal Roleplay */}
      {selectedRoleplay && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-xl">
            <div className="bg-gray-50 p-5 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Avaliação de Treino</h2>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${
                      selectedRoleplay.performance_level === 'excellent' || selectedRoleplay.performance_level === 'excelente' || selectedRoleplay.performance_level === 'legendary' ? 'bg-green-100 text-green-700' :
                      selectedRoleplay.performance_level === 'very_good' || selectedRoleplay.performance_level === 'good' || selectedRoleplay.performance_level === 'bom' ? 'bg-green-50 text-green-600' :
                      selectedRoleplay.performance_level === 'regular' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {translatePerformanceLevel(selectedRoleplay.performance_level)}
                    </span>
                    <span className={`text-xl font-bold ${getScoreColor(selectedRoleplay.overall_score)}`}>
                      {selectedRoleplay.overall_score?.toFixed(1) || 'N/A'}/10
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedRoleplay(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="mb-5">
                <p className="text-xs text-gray-500 mb-1">Data</p>
                <p className="font-medium text-gray-900">{new Date(selectedRoleplay.created_at).toLocaleDateString('pt-BR')}</p>
              </div>

              {/* SPIN Scores */}
              <div className="mb-5">
                <h3 className="font-semibold text-gray-900 mb-3">Scores SPIN</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { key: 'S', label: 'Situação', value: selectedRoleplay.spin_scores?.S },
                    { key: 'P', label: 'Problema', value: selectedRoleplay.spin_scores?.P },
                    { key: 'I', label: 'Implicação', value: selectedRoleplay.spin_scores?.I },
                    { key: 'N', label: 'Necessidade', value: selectedRoleplay.spin_scores?.N }
                  ].map(spin => (
                    <div key={spin.key} className={`${getScoreBgColor(spin.value)} rounded-lg p-3 text-center`}>
                      <p className="text-[10px] text-gray-500 mb-1">{spin.key}</p>
                      <p className={`text-xl font-bold ${getScoreColor(spin.value)}`}>
                        {spin.value?.toFixed(1) || '0'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SPIN Feedback */}
              {selectedRoleplay.spin_feedback && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Feedback SPIN</h3>
                  <div className="space-y-3">
                    {[
                      { key: 'S', label: 'Situação', feedback: selectedRoleplay.spin_feedback?.S },
                      { key: 'P', label: 'Problema', feedback: selectedRoleplay.spin_feedback?.P },
                      { key: 'I', label: 'Implicação', feedback: selectedRoleplay.spin_feedback?.I },
                      { key: 'N', label: 'Necessidade', feedback: selectedRoleplay.spin_feedback?.N }
                    ].filter(item => item.feedback).map(item => (
                      <div key={item.key} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-1">{item.label} ({item.key})</p>
                        <p className="text-sm text-gray-700">{item.feedback}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              {selectedRoleplay.executive_summary && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Resumo Executivo</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 text-sm">{selectedRoleplay.executive_summary}</p>
                  </div>
                </div>
              )}

              {/* Strengths & Gaps */}
              <div className="grid md:grid-cols-2 gap-4 mb-5">
                {selectedRoleplay.top_strengths && selectedRoleplay.top_strengths.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-green-700 mb-2">Pontos Fortes</h3>
                    <ul className="space-y-2">
                      {selectedRoleplay.top_strengths.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedRoleplay.critical_gaps && selectedRoleplay.critical_gaps.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-yellow-700 mb-2">Gaps Críticos</h3>
                    <ul className="space-y-2">
                      {selectedRoleplay.critical_gaps.map((g: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Priority Improvements */}
              {selectedRoleplay.priority_improvements && selectedRoleplay.priority_improvements.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Melhorias Prioritárias</h3>
                  <ul className="space-y-2">
                    {selectedRoleplay.priority_improvements.map((imp: any, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <Zap className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {typeof imp === 'string' ? imp : imp.area || imp.action_plan || JSON.stringify(imp)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Playbook Adherence */}
              {selectedRoleplay.playbook_adherence && (
                <div className="border-t border-gray-200 pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-green-600" />
                      Aderência ao Playbook
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${
                        selectedRoleplay.playbook_adherence.adherence_level === 'exemplary' ? 'bg-green-100 text-green-700' :
                        selectedRoleplay.playbook_adherence.adherence_level === 'compliant' ? 'bg-green-50 text-green-600' :
                        selectedRoleplay.playbook_adherence.adherence_level === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {selectedRoleplay.playbook_adherence.adherence_level === 'exemplary' ? 'Exemplar' :
                         selectedRoleplay.playbook_adherence.adherence_level === 'compliant' ? 'Conforme' :
                         selectedRoleplay.playbook_adherence.adherence_level === 'partial' ? 'Parcial' : 'Não Conforme'}
                      </span>
                      <span className={`text-lg font-bold ${
                        selectedRoleplay.playbook_adherence.overall_adherence_score >= 70 ? 'text-green-600' :
                        selectedRoleplay.playbook_adherence.overall_adherence_score >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {selectedRoleplay.playbook_adherence.overall_adherence_score}%
                      </span>
                    </div>
                  </div>

                  {/* Dimensions */}
                  {selectedRoleplay.playbook_adherence.dimensions && (
                    <div className="grid grid-cols-5 gap-2 mb-4">
                      {[
                        { key: 'opening', label: 'Abertura' },
                        { key: 'closing', label: 'Fechamento' },
                        { key: 'conduct', label: 'Conduta' },
                        { key: 'required_scripts', label: 'Scripts' },
                        { key: 'process', label: 'Processo' }
                      ].map(dim => {
                        const dimData = selectedRoleplay.playbook_adherence.dimensions[dim.key]
                        if (!dimData || dimData.status === 'not_evaluated') return null
                        return (
                          <div key={dim.key} className={`text-center p-2 rounded-lg ${
                            dimData.score >= 70 ? 'bg-green-50' :
                            dimData.score >= 50 ? 'bg-yellow-50' : 'bg-red-50'
                          }`}>
                            <p className="text-[9px] text-gray-500 mb-1">{dim.label}</p>
                            <p className={`text-sm font-bold ${
                              dimData.score >= 70 ? 'text-green-600' :
                              dimData.score >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {dimData.score}%
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Violations */}
                  {selectedRoleplay.playbook_adherence.violations && selectedRoleplay.playbook_adherence.violations.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-red-700 mb-2">Violações</h4>
                      <div className="space-y-2">
                        {selectedRoleplay.playbook_adherence.violations.map((v: any, i: number) => (
                          <div key={i} className="bg-red-50 rounded-lg p-3 border border-red-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-red-700">{v.criterion}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                v.severity === 'critical' ? 'bg-red-200 text-red-800' :
                                v.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {v.severity === 'critical' ? 'Crítico' : v.severity === 'high' ? 'Alto' : 'Médio'}
                              </span>
                            </div>
                            {v.evidence && <p className="text-xs text-gray-600 italic mb-1">"{v.evidence}"</p>}
                            {v.recommendation && <p className="text-xs text-gray-700">{v.recommendation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missed Requirements */}
                  {selectedRoleplay.playbook_adherence.missed_requirements && selectedRoleplay.playbook_adherence.missed_requirements.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-yellow-700 mb-2">Requisitos Não Cumpridos</h4>
                      <div className="space-y-2">
                        {selectedRoleplay.playbook_adherence.missed_requirements.map((m: any, i: number) => (
                          <div key={i} className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                            <p className="text-xs font-medium text-yellow-800 mb-1">{m.criterion}</p>
                            {m.expected && <p className="text-xs text-gray-600 mb-1">Esperado: {m.expected}</p>}
                            {m.recommendation && <p className="text-xs text-gray-700">{m.recommendation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exemplary Moments */}
                  {selectedRoleplay.playbook_adherence.exemplary_moments && selectedRoleplay.playbook_adherence.exemplary_moments.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-green-700 mb-2">Momentos Exemplares</h4>
                      <div className="space-y-2">
                        {selectedRoleplay.playbook_adherence.exemplary_moments.map((m: any, i: number) => (
                          <div key={i} className="bg-green-50 rounded-lg p-3 border border-green-100">
                            <p className="text-xs font-medium text-green-800 mb-1">{m.criterion}</p>
                            {m.evidence && <p className="text-xs text-gray-600 italic mb-1">"{m.evidence}"</p>}
                            {m.why_exemplary && <p className="text-xs text-gray-700">{m.why_exemplary}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coaching Notes */}
                  {selectedRoleplay.playbook_adherence.coaching_notes && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <h4 className="text-xs font-semibold text-gray-600 mb-1">Notas de Coaching</h4>
                      <p className="text-sm text-gray-700">{selectedRoleplay.playbook_adherence.coaching_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Challenge */}
      {selectedChallenge && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-xl">
            <div className="bg-gray-50 p-5 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Avaliação de Desafio</h2>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {selectedChallenge.challenge_type}
                    </span>
                    <span className={`text-xl font-bold ${getScoreColor(selectedChallenge.score)}`}>
                      {selectedChallenge.score?.toFixed(1) || 'N/A'}/10
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedChallenge(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Data</p>
                  <p className="font-medium text-gray-900">{new Date(selectedChallenge.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <p className={`font-medium ${selectedChallenge.completed ? 'text-green-600' : 'text-yellow-600'}`}>
                    {selectedChallenge.completed ? 'Concluído' : 'Pendente'}
                  </p>
                </div>
              </div>

              {/* Challenge Title/Description */}
              {selectedChallenge.challenge_title && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Título do Desafio</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 text-sm">{selectedChallenge.challenge_title}</p>
                  </div>
                </div>
              )}

              {selectedChallenge.challenge_description && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Descrição</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{selectedChallenge.challenge_description}</p>
                  </div>
                </div>
              )}

              {/* User Response */}
              {selectedChallenge.response && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Resposta do Vendedor</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-48 overflow-y-auto">
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{selectedChallenge.response}</p>
                  </div>
                </div>
              )}

              {/* Feedback */}
              {selectedChallenge.feedback && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Feedback da Avaliação</h3>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{selectedChallenge.feedback}</p>
                  </div>
                </div>
              )}

              {/* Strengths & Improvements */}
              <div className="grid md:grid-cols-2 gap-4">
                {selectedChallenge.pontos_fortes && selectedChallenge.pontos_fortes.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-green-700 mb-2">Pontos Fortes</h3>
                    <ul className="space-y-2">
                      {selectedChallenge.pontos_fortes.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedChallenge.areas_melhoria && selectedChallenge.areas_melhoria.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-yellow-700 mb-2">Áreas de Melhoria</h3>
                    <ul className="space-y-2">
                      {selectedChallenge.areas_melhoria.map((a: string, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
