'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, TrendingUp, TrendingDown, Award, Target, Activity, Loader2, MessageSquare, Brain, CheckCircle, AlertTriangle, AlertCircle, Sparkles, Zap, FileText, Video, X, ChevronRight, ChevronDown, Calendar, Mic, Lightbulb, BookOpen, Eye, Filter } from 'lucide-react'
import type { SellerPerformance } from './SellerGrid'

// ── Types ───────────────────────────────────────────────────────────────────

interface AISummary {
  summary: string
  highlights: string[]
  concerns: string[]
  recommendations: string[]
  performance_level: string
  priority_action: string
  spin_analysis?: { S: string; P: string; I: string; N: string }
  evolution_trend?: string
  coaching_focus?: string
  playbook_aptitude?: {
    score: number; percentage: number; level: string; summary: string
    dimension_analysis?: { opening?: string; closing?: string; conduct?: string; required_scripts?: string; process?: string }
    strengths: string[]; gaps: string[]; priority_actions?: string[]
  }
  real_calls_summary?: string
}

interface SavedAnalysis {
  id: string
  ai_summary: AISummary
  raw_metrics: { total_roleplay_sessions?: number; total_meet_evaluations?: number; total_challenges?: number }
  created_at: string
}

interface ComprehensiveData {
  seller: { id: string; name: string; email: string }
  summary: {
    overall_average: number; total_roleplay_sessions: number; total_meet_evaluations: number
    total_challenges: number; completed_challenges: number; total_followups: number
    avg_roleplay_score: number; avg_meet_score: number; avg_challenge_score: number; avg_followup_score: number
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

interface Playbook { id: string; title: string; content: string; version: number; is_active: boolean }

interface WhatsAppEvaluation {
  id: string; user_id: string; company_id: string; contact_phone: string; contact_name: string | null
  round_number: number; round_messages: string; round_start: string; round_end: string
  message_count: number; avaliacao: any; nota_final: number; classificacao: string
  created_at: string; seller_name: string
}

interface SellerDetailViewProps {
  seller: SellerPerformance
  whatsappSummary: { count: number; avg: number }
  onBack: () => void
}

// ── Helper Functions ────────────────────────────────────────────────────────

const translatePerformanceLevel = (level: string | null): string => {
  if (!level) return 'N/A'
  const translations: Record<string, string> = {
    'excellent': 'Excelente', 'excelente': 'Excelente', 'very_good': 'Muito Bom',
    'good': 'Bom', 'bom': 'Bom', 'regular': 'Regular',
    'needs_improvement': 'Precisa Melhorar', 'poor': 'Fraco', 'legendary': 'Lendario', 'critico': 'Critico'
  }
  return translations[level.toLowerCase()] || level
}

const translateClassification = (classification: string | null): string => {
  if (!classification) return 'N/A'
  const translations: Record<string, string> = {
    'excelente': 'Excelente', 'bom': 'Bom', 'medio': 'Medio', 'ruim': 'Ruim', 'pessimo': 'Pessimo'
  }
  return translations[classification.toLowerCase()] || classification
}

interface ParsedMessage { time: string; sender: string; text: string; isVendedor: boolean }

const parseTranscriptionMessages = (transcription: string): ParsedMessage[] => {
  if (!transcription) return []
  const messages: ParsedMessage[] = []
  const lines = transcription.split('\n').filter(line => line.trim())
  for (const line of lines) {
    const timeMatch = line.match(/^\[(\d{2}:\d{2})\]\s*([^:]+):\s*(.+)$/)
    if (timeMatch) {
      const [, time, sender, text] = timeMatch
      const st = sender.trim()
      messages.push({ time, sender: st, text: text.trim(), isVendedor: st.toLowerCase().includes('vendedor') || st.toLowerCase().includes('seller') || st.toLowerCase().includes('rep') })
      continue
    }
    const simpleMatch = line.match(/^([^:]+):\s*(.+)$/)
    if (simpleMatch) {
      const [, sender, text] = simpleMatch
      const st = sender.trim()
      if (st.length < 30 && !st.includes('http')) {
        messages.push({ time: '', sender: st, text: text.trim(), isVendedor: st.toLowerCase().includes('vendedor') || st.toLowerCase().includes('seller') || st.toLowerCase().includes('rep') })
      }
    }
  }
  return messages
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

function getWAScoreColor(score: number): string {
  if (score >= 7) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-600'
}

function getWAScoreBg(score: number): string {
  if (score >= 7) return 'bg-green-50 border-green-200'
  if (score >= 5) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

function getWAScoreBarColor(score: number): string {
  if (score >= 7) return 'bg-green-500'
  if (score >= 5) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getClassificacaoLabel(classificacao: string): string {
  const labels: Record<string, string> = {
    excelente: 'Excelente', bom: 'Bom', medio: 'Medio', ruim: 'Ruim', pessimo: 'Pessimo', indefinido: 'N/A'
  }
  return labels[classificacao] || classificacao
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SellerDetailView({ seller, whatsappSummary, onBack }: SellerDetailViewProps) {
  // Lazy-loaded data
  const [loading, setLoading] = useState(true)
  const [comprehensiveData, setComprehensiveData] = useState<ComprehensiveData | null>(null)
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [savedAnalysisMetrics, setSavedAnalysisMetrics] = useState<SavedAnalysis['raw_metrics'] | null>(null)
  const [playbook, setPlaybook] = useState<Playbook | null>(null)

  // WhatsApp evaluations
  const [whatsappEvals, setWhatsappEvals] = useState<WhatsAppEvaluation[]>([])
  const [whatsappDays, setWhatsappDays] = useState(7)
  const [selectedWAEval, setSelectedWAEval] = useState<WhatsAppEvaluation | null>(null)

  // Modal states
  const [selectedFollowUp, setSelectedFollowUp] = useState<any>(null)
  const [selectedMeet, setSelectedMeet] = useState<any>(null)
  const [selectedRoleplay, setSelectedRoleplay] = useState<any>(null)
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null)
  const [selectedSellerForPDI, setSelectedSellerForPDI] = useState<{userId: string, userName: string} | null>(null)
  const [pdiData, setPdiData] = useState<any>(null)
  const [pdiLoading, setPdiLoading] = useState(false)

  // ── Data loading ────────────────────────────────────────────────────────

  useEffect(() => { loadSellerDetails() }, [seller.user_id])
  useEffect(() => { loadWhatsappEvals() }, [whatsappDays, seller.user_id])
  useEffect(() => {
    if (selectedSellerForPDI) { loadPDI(selectedSellerForPDI.userId) } else { setPdiData(null) }
  }, [selectedSellerForPDI])

  const loadSellerDetails = async () => {
    try {
      setLoading(true)

      const [compData, savedAnalysis, _playbook] = await Promise.all([
        loadComprehensiveData(),
        loadSavedAISummary(),
        loadPlaybook()
      ])

      // Auto-generate AI summary if needed
      if (!savedAnalysis) {
        console.log(`Auto-gerando analise IA para vendedor ${seller.user_id} (sem analise anterior)`)
        await generateAISummary(false)
      } else if (compData) {
        const currentTotal =
          (compData.meets?.total || 0) +
          (compData.challenges?.total || 0) +
          (compData.roleplay?.total || 0)

        const savedTotal =
          (savedAnalysis.raw_metrics?.total_meet_evaluations || 0) +
          (savedAnalysis.raw_metrics?.total_challenges || 0) +
          (savedAnalysis.raw_metrics?.total_roleplay_sessions || 0)

        const delta = currentTotal - savedTotal
        console.log(`Delta de interacoes: ${delta} (atual: ${currentTotal}, salvo: ${savedTotal})`)

        if (delta >= 10) {
          console.log(`Auto-regenerando analise IA (delta >= 10)`)
          await generateAISummary(true)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do vendedor:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWhatsappEvals = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(`/api/manager/evaluations?days=${whatsappDays}&seller=${seller.user_id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setWhatsappEvals(data.evaluations || [])
      }
    } catch (error) {
      console.error('Erro ao carregar avaliacoes WhatsApp:', error)
    }
  }

  const loadComprehensiveData = async (): Promise<ComprehensiveData | null> => {
    try {
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      const response = await fetch(`/api/admin/sellers-comprehensive?sellerId=${seller.user_id}`, {
        headers: { 'x-company-id': companyId || '' }
      })

      if (response.ok) {
        const data = await response.json()
        setComprehensiveData(data)
        return data as ComprehensiveData
      }
      return null
    } catch (error) {
      console.error('Erro ao carregar dados detalhados:', error)
      return null
    }
  }

  const loadSavedAISummary = async (): Promise<SavedAnalysis | null> => {
    try {
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) return null

      const response = await fetch(`/api/admin/seller-ai-summary?sellerId=${seller.user_id}`, {
        headers: { 'x-company-id': companyId }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.latest) {
          setAiSummary(data.latest.ai_summary)
          if (data.latest.raw_metrics) {
            setSavedAnalysisMetrics(data.latest.raw_metrics)
          }
          return data.latest as SavedAnalysis
        }
      }
      return null
    } catch (error) {
      console.error('Erro ao carregar analise salva:', error)
      return null
    }
  }

  const generateAISummary = async (forceRegenerate: boolean = false) => {
    if (aiSummary && !forceRegenerate) return

    try {
      setAiSummaryLoading(true)
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
        body: JSON.stringify({ sellerId: seller.user_id })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.ai_summary) {
          setAiSummary(data.ai_summary)
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
      setAiSummaryLoading(false)
    }
  }

  const loadPlaybook = async () => {
    try {
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()

      if (!companyId) return null

      const response = await fetch(`/api/playbook/save?companyId=${companyId}`)
      const result = await response.json()

      if (response.ok && result.success && result.playbook) {
        setPlaybook(result.playbook)
        return result.playbook
      }
      return null
    } catch (error) {
      console.error('Erro ao carregar playbook:', error)
      return null
    }
  }

  const loadPDI = async (userId: string) => {
    try {
      setPdiLoading(true)

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
        let simulacoes: any[] = []
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
            resumo: result.pdi.resumo || 'Sem resumo disponivel'
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

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Carregando dados do vendedor...</p>
        </div>
      </div>
    )
  }

  // ── Main Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* SECTION 1: Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Nota Geral</p>
          <p className={`text-2xl font-bold ${getScoreColor(seller.overall_average)}`}>
            {seller.overall_average?.toFixed(1) || '0.0'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Sessoes Roleplay</p>
          <p className="text-2xl font-bold text-gray-900">{seller.total_sessions}</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Reunioes</p>
          <p className="text-2xl font-bold text-gray-900">{comprehensiveData?.meets?.total || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Follow-ups</p>
          <p className="text-2xl font-bold text-gray-900">{seller.followup_data?.total_analyses || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">SPIN Media</p>
          <p className={`text-2xl font-bold ${getScoreColor(
            (seller.spin_s_average + seller.spin_p_average + seller.spin_i_average + seller.spin_n_average) / 4
          )}`}>
            {((seller.spin_s_average + seller.spin_p_average + seller.spin_i_average + seller.spin_n_average) / 4).toFixed(1)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
          <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">Avaliacoes WA</p>
          <p className="text-2xl font-bold text-gray-900">{whatsappSummary.count}</p>
        </div>
      </div>

      {/* SECTION 2: AI Summary */}
      {aiSummary && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Brain className="w-4 h-4 text-green-600" />
              Analise IA
            </h4>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              aiSummary.performance_level === 'excelente' ? 'bg-green-100 text-green-700' :
              aiSummary.performance_level === 'bom' ? 'bg-green-50 text-green-600' :
              aiSummary.performance_level === 'regular' ? 'bg-yellow-100 text-yellow-700' :
              aiSummary.performance_level === 'precisa_atencao' ? 'bg-yellow-50 text-yellow-600' :
              'bg-red-100 text-red-700'
            }`}>
              {aiSummary.performance_level?.replace('_', ' ').toUpperCase() || 'N/A'}
            </span>
          </div>

          <p className="text-gray-600 text-sm mb-4 leading-relaxed">{aiSummary.summary}</p>

          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <h5 className="text-xs font-semibold text-green-700 mb-2">Destaques</h5>
              <ul className="space-y-1.5">
                {aiSummary.highlights.slice(0, 3).map((h, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <h5 className="text-xs font-semibold text-yellow-700 mb-2">Atencao</h5>
              <ul className="space-y-1.5">
                {aiSummary.concerns.slice(0, 3).map((c, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <h5 className="text-xs font-semibold text-gray-700 mb-2">Recomendacoes</h5>
              <ul className="space-y-1.5">
                {aiSummary.recommendations.slice(0, 3).map((r, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <Sparkles className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {aiSummary.priority_action && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <p className="text-xs text-green-700 font-semibold mb-1 flex items-center gap-1.5">
                <Zap className="w-3 h-3" />
                Acao Prioritaria
              </p>
              <p className="text-sm text-gray-700">{aiSummary.priority_action}</p>
            </div>
          )}

          {aiSummary.playbook_aptitude && (
            <div className="mt-3 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              {/* Header with score */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-emerald-800 font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Aptidao ao Playbook
                </p>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    (aiSummary.playbook_aptitude.percentage || aiSummary.playbook_aptitude.score * 10) >= 80 ? 'bg-green-100 text-green-700' :
                    (aiSummary.playbook_aptitude.percentage || aiSummary.playbook_aptitude.score * 10) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {aiSummary.playbook_aptitude.percentage
                      ? `${aiSummary.playbook_aptitude.percentage.toFixed(0)}%`
                      : `${(aiSummary.playbook_aptitude.score * 10).toFixed(0)}%`
                    }
                  </span>
                </div>
              </div>

              {/* Summary text */}
              {aiSummary.playbook_aptitude.summary && (
                <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                  {aiSummary.playbook_aptitude.summary}
                </p>
              )}

              {/* Strengths and Gaps in two columns */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Strengths */}
                {aiSummary.playbook_aptitude.strengths && aiSummary.playbook_aptitude.strengths.length > 0 && (
                  <div className="bg-white/70 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Pontos Fortes
                    </p>
                    <ul className="space-y-1">
                      {aiSummary.playbook_aptitude.strengths.slice(0, 4).map((strength, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                          <span className="text-green-500 mt-0.5">•</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gaps */}
                {aiSummary.playbook_aptitude.gaps && aiSummary.playbook_aptitude.gaps.length > 0 && (
                  <div className="bg-white/70 rounded-lg p-3">
                    <p className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Precisa Melhorar
                    </p>
                    <ul className="space-y-1">
                      {aiSummary.playbook_aptitude.gaps.slice(0, 4).map((gap, i) => (
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
              {aiSummary.playbook_aptitude.priority_actions && aiSummary.playbook_aptitude.priority_actions.length > 0 && (
                <div className="bg-emerald-100/50 rounded-lg p-3 mt-2">
                  <p className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Acoes Prioritarias
                  </p>
                  <ul className="space-y-1">
                    {aiSummary.playbook_aptitude.priority_actions.map((action, i) => (
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

      {/* Real Calls Performance Summary */}
      {aiSummary?.real_calls_summary && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Video className="w-4 h-4 text-green-600" />
            Performance em Reunioes Reais
          </h4>
          <p className="text-gray-600 text-sm leading-relaxed">
            {aiSummary.real_calls_summary}
          </p>
        </div>
      )}

      {/* Playbook Available Badge */}
      {playbook && !aiSummary && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Playbook Disponivel</p>
              <p className="text-xs text-gray-500">A analise IA sera gerada automaticamente</p>
            </div>
          </div>
        </div>
      )}

      {/* Auto-generating indicator */}
      {aiSummaryLoading && !aiSummary && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
          <div>
            <p className="text-sm font-medium text-gray-900">Gerando analise IA automaticamente...</p>
            <p className="text-xs text-gray-500">Isso pode levar alguns segundos</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {aiSummary && (
          <button
            onClick={() => generateAISummary(true)}
            disabled={aiSummaryLoading}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {aiSummaryLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerando...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                Regenerar Analise IA
              </>
            )}
          </button>
        )}
        <button
          onClick={() => setSelectedSellerForPDI({ userId: seller.user_id, userName: seller.user_name })}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Ver PDI
        </button>
      </div>

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
              { key: 'S', label: 'Situacao', value: seller.spin_s_average },
              { key: 'P', label: 'Problema', value: seller.spin_p_average },
              { key: 'I', label: 'Implicacao', value: seller.spin_i_average },
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

      {/* SECTION 4: WhatsApp Evaluations */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-600" />
            Avaliacoes WhatsApp
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {whatsappEvals.length}
            </span>
          </h4>
          <select
            value={whatsappDays}
            onChange={(e) => { setWhatsappDays(parseInt(e.target.value)); setSelectedWAEval(null) }}
            className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value={1}>Hoje</option>
            <option value={3}>3 dias</option>
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={30}>30 dias</option>
          </select>
        </div>

        {whatsappEvals.length > 0 ? (
          <>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {whatsappEvals.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedWAEval(selectedWAEval?.id === ev.id ? null : ev)}
                  className={`w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-green-50 border transition-colors text-left ${
                    selectedWAEval?.id === ev.id ? 'bg-green-50 border-l-2 border-l-green-500 border-green-200' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {ev.contact_name || ev.contact_phone}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                      Round {ev.round_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold px-2.5 py-1 rounded-lg border ${getWAScoreBg(ev.nota_final)} ${getWAScoreColor(ev.nota_final)}`}>
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

            {/* Inline detail panel for selected WA eval */}
            {selectedWAEval && (
              <div className="bg-gray-50 rounded-xl p-5 mt-3 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="font-semibold text-gray-900 text-sm">
                    {selectedWAEval.contact_name || selectedWAEval.contact_phone} — Round {selectedWAEval.round_number}
                  </h5>
                  <button
                    onClick={() => setSelectedWAEval(null)}
                    className="text-gray-400 hover:text-gray-600 text-xs font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    Fechar
                  </button>
                </div>

                {/* Score */}
                <div className={`text-center py-4 rounded-xl mb-5 border ${getWAScoreBg(selectedWAEval.nota_final)}`}>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className={`text-4xl font-bold ${getWAScoreColor(selectedWAEval.nota_final)}`}>
                      {selectedWAEval.nota_final.toFixed(1)}
                    </span>
                    <span className="text-gray-400 text-lg">/10</span>
                  </div>
                  <div className={`text-sm font-medium mt-1 ${getWAScoreColor(selectedWAEval.nota_final)}`}>
                    {getClassificacaoLabel(selectedWAEval.classificacao)}
                  </div>
                </div>

                {/* Criteria scores */}
                {selectedWAEval.avaliacao?.notas && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Notas por Criterio</p>
                    <div className="space-y-3">
                      {Object.entries(selectedWAEval.avaliacao.notas as Record<string, { nota: number; peso: number; comentario: string }>).map(([key, val]) => {
                        const labels: Record<string, string> = {
                          valor_agregado: 'Valor Agregado',
                          personalizacao: 'Personalizacao',
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
                                  className={`h-full rounded-full ${getWAScoreBarColor(val.nota)}`}
                                  style={{ width: `${(val.nota / 10) * 100}%` }}
                                />
                              </div>
                              <span className={`font-semibold w-8 text-right ${getWAScoreColor(val.nota)}`}>
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
                {selectedWAEval.avaliacao?.pontos_positivos?.length > 0 && (
                  <div className="mb-4">
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <h4 className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">Pontos Positivos</h4>
                      <ul className="space-y-1.5">
                        {selectedWAEval.avaliacao.pontos_positivos.map((p: string, i: number) => (
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
                {selectedWAEval.avaliacao?.pontos_melhorar?.length > 0 && (
                  <div className="mb-4">
                    <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                      <h4 className="text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wider">Pontos a Melhorar</h4>
                      <ul className="space-y-1.5">
                        {selectedWAEval.avaliacao.pontos_melhorar.map((p: any, i: number) => (
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
                {selectedWAEval.avaliacao?.dica_principal && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <h4 className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">Dica Principal</h4>
                    <p className="text-xs text-gray-700 leading-relaxed">{selectedWAEval.avaliacao.dica_principal}</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                  <p>{selectedWAEval.message_count} mensagens no round</p>
                  <p>
                    Periodo: {new Date(selectedWAEval.round_start).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {' — '}
                    {new Date(selectedWAEval.round_end).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Nenhuma avaliacao WhatsApp neste periodo</p>
          </div>
        )}
      </div>

      {/* SECTION 5: Historico de Avaliacoes */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-600" />
            Historico de Avaliacoes
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
              <span className="text-lg font-bold text-gray-900">{comprehensiveData?.roleplay?.total || 0}</span>
            </div>
            {comprehensiveData?.roleplay?.sessions && comprehensiveData.roleplay.sessions.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {comprehensiveData.roleplay.sessions.filter((s: any) => s.status === 'completed').slice(0, 3).map((session: any) => (
                  <div
                    key={session.id}
                    className="group flex items-center justify-between p-2.5 bg-white rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-200 transition-all border border-gray-100 hover:shadow-sm"
                    onClick={() => setSelectedRoleplay(session)}
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
              <span className="text-lg font-bold text-gray-900">{comprehensiveData?.challenges?.total || 0}</span>
            </div>
            {comprehensiveData?.challenges?.items && comprehensiveData.challenges.items.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {comprehensiveData.challenges.items.filter((c: any) => c.completed).slice(0, 3).map((challenge: any) => (
                  <div
                    key={challenge.id}
                    className="group flex items-center justify-between p-2.5 bg-white rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-200 transition-all border border-gray-100 hover:shadow-sm"
                    onClick={() => setSelectedChallenge(challenge)}
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

          {/* Reunioes */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Video className="w-3 h-3" />
                Reunioes
              </span>
              <span className="text-lg font-bold text-gray-900">{comprehensiveData?.meets?.total || 0}</span>
            </div>
            {comprehensiveData?.meets?.evaluations && comprehensiveData.meets.evaluations.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {comprehensiveData.meets.evaluations.slice(0, 3).map((meet: any) => (
                  <div
                    key={meet.id}
                    className="group flex items-center justify-between p-2.5 bg-white rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-200 transition-all border border-gray-100 hover:shadow-sm"
                    onClick={() => setSelectedMeet(meet)}
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
              <p className="text-xs text-gray-400 text-center py-3">Nenhuma reuniao avaliada</p>
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
                    onClick={() => setSelectedFollowUp(analysis)}
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

      {/* ═══════════════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════════════ */}

      {/* Modal Follow-up */}
      {selectedFollowUp && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-xl">
            <div className="bg-gray-50 p-5 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Analise de Mensagem</h2>
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
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Avaliacao de Reuniao</h2>
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
                      { key: 'S', label: 'Situacao', value: selectedMeet.spin_scores?.S },
                      { key: 'P', label: 'Problema', value: selectedMeet.spin_scores?.P },
                      { key: 'I', label: 'Implicacao', value: selectedMeet.spin_scores?.I },
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
                      { key: 'S', label: 'Situacao', feedback: selectedMeet.spin_feedback?.S },
                      { key: 'P', label: 'Problema', feedback: selectedMeet.spin_feedback?.P },
                      { key: 'I', label: 'Implicacao', feedback: selectedMeet.spin_feedback?.I },
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
                    <h3 className="font-semibold text-yellow-700 mb-2">Gaps Criticos</h3>
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
                  <h3 className="font-semibold text-gray-900 mb-2">Melhorias Prioritarias</h3>
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
                  <h3 className="font-semibold text-gray-900 mb-2">Analise de Objecoes</h3>
                  <div className="space-y-3">
                    {selectedMeet.objections_analysis.map((obj: any, i: number) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-600 bg-gray-200 px-2 py-0.5 rounded">
                            {obj.objection_type || 'Objecao'}
                          </span>
                          <span className={`text-sm font-bold ${getScoreColor(obj.score)}`}>
                            {obj.score?.toFixed(1) || 'N/A'}/10
                          </span>
                        </div>
                        {obj.objection_text && (
                          <p className="text-xs text-gray-500 italic mb-2">&quot;{obj.objection_text}&quot;</p>
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
                      Aderencia ao Playbook
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
                         selectedMeet.playbook_adherence.adherence_level === 'partial' ? 'Parcial' : 'Nao Conforme'}
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
                      <h4 className="text-xs font-semibold text-red-700 mb-2">Violacoes</h4>
                      <div className="space-y-2">
                        {selectedMeet.playbook_adherence.violations.map((v: any, i: number) => (
                          <div key={i} className="bg-red-50 rounded-lg p-3 border border-red-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-red-700">{v.criterion}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                v.severity === 'critical' ? 'bg-red-200 text-red-800' :
                                v.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {v.severity === 'critical' ? 'Critico' : v.severity === 'high' ? 'Alto' : 'Medio'}
                              </span>
                            </div>
                            {v.evidence && <p className="text-xs text-gray-600 italic mb-1">&quot;{v.evidence}&quot;</p>}
                            {v.recommendation && <p className="text-xs text-gray-700">{v.recommendation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missed Requirements */}
                  {selectedMeet.playbook_adherence.missed_requirements && selectedMeet.playbook_adherence.missed_requirements.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-yellow-700 mb-2">Requisitos Nao Cumpridos</h4>
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
                            {m.evidence && <p className="text-xs text-gray-600 italic mb-1">&quot;{m.evidence}&quot;</p>}
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
                    <p className="text-lg text-gray-700 mb-1">PDI nao encontrado</p>
                    <p className="text-sm text-gray-500">{selectedSellerForPDI.userName} ainda nao gerou um PDI</p>
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

                    {/* Diagnostico */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-green-600" />
                        Diagnostico Geral
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
                            { label: 'Situacao', value: pdiData.notas_spin?.situacao },
                            { label: 'Problema', value: pdiData.notas_spin?.problema },
                            { label: 'Implicacao', value: pdiData.notas_spin?.implicacao },
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

                    {/* Simulacoes */}
                    {pdiData.simulacoes && pdiData.simulacoes.length > 0 && (
                      <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          Simulacoes Recomendadas
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
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Avaliacao de Treino</h2>
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
                    { key: 'S', label: 'Situacao', value: selectedRoleplay.spin_scores?.S },
                    { key: 'P', label: 'Problema', value: selectedRoleplay.spin_scores?.P },
                    { key: 'I', label: 'Implicacao', value: selectedRoleplay.spin_scores?.I },
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
                      { key: 'S', label: 'Situacao', feedback: selectedRoleplay.spin_feedback?.S },
                      { key: 'P', label: 'Problema', feedback: selectedRoleplay.spin_feedback?.P },
                      { key: 'I', label: 'Implicacao', feedback: selectedRoleplay.spin_feedback?.I },
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
                    <h3 className="font-semibold text-yellow-700 mb-2">Gaps Criticos</h3>
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
                  <h3 className="font-semibold text-gray-900 mb-2">Melhorias Prioritarias</h3>
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
                      Aderencia ao Playbook
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
                         selectedRoleplay.playbook_adherence.adherence_level === 'partial' ? 'Parcial' : 'Nao Conforme'}
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
                      <h4 className="text-xs font-semibold text-red-700 mb-2">Violacoes</h4>
                      <div className="space-y-2">
                        {selectedRoleplay.playbook_adherence.violations.map((v: any, i: number) => (
                          <div key={i} className="bg-red-50 rounded-lg p-3 border border-red-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-red-700">{v.criterion}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                v.severity === 'critical' ? 'bg-red-200 text-red-800' :
                                v.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {v.severity === 'critical' ? 'Critico' : v.severity === 'high' ? 'Alto' : 'Medio'}
                              </span>
                            </div>
                            {v.evidence && <p className="text-xs text-gray-600 italic mb-1">&quot;{v.evidence}&quot;</p>}
                            {v.recommendation && <p className="text-xs text-gray-700">{v.recommendation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missed Requirements */}
                  {selectedRoleplay.playbook_adherence.missed_requirements && selectedRoleplay.playbook_adherence.missed_requirements.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-yellow-700 mb-2">Requisitos Nao Cumpridos</h4>
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
                            {m.evidence && <p className="text-xs text-gray-600 italic mb-1">&quot;{m.evidence}&quot;</p>}
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
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Avaliacao de Desafio</h2>
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
                    {selectedChallenge.completed ? 'Concluido' : 'Pendente'}
                  </p>
                </div>
              </div>

              {/* Challenge Title/Description */}
              {selectedChallenge.challenge_title && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Titulo do Desafio</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-700 text-sm">{selectedChallenge.challenge_title}</p>
                  </div>
                </div>
              )}

              {selectedChallenge.challenge_description && (
                <div className="mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2">Descricao</h3>
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
                  <h3 className="font-semibold text-gray-900 mb-2">Feedback da Avaliacao</h3>
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
                    <h3 className="font-semibold text-yellow-700 mb-2">Areas de Melhoria</h3>
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
