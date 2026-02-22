'use client'

import { useState, useEffect, lazy, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Clock, User, MessageCircle, Calendar, Trash2, Target, TrendingUp, AlertTriangle, Lightbulb, ChevronDown, ChevronUp, History, CheckCircle, Video, Users, AlertCircle, ArrowLeft, FileText } from 'lucide-react'
import { getUserRoleplaySessions, deleteRoleplaySession, type RoleplaySession } from '@/lib/roleplay'
import { useNotifications } from '@/hooks/useNotifications'
import { supabase } from '@/lib/supabase'

const FollowUpHistoryView = lazy(() => import('./FollowUpHistoryView'))
const MeetHistoryContent = lazy(() => import('./MeetHistoryContent'))
const ChallengeHistoryContent = lazy(() => import('./ChallengeHistoryContent'))
const CorrectionHistoryContent = lazy(() => import('./CorrectionHistoryContent'))

function LazySpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-green-100 border-t-green-500 rounded-full animate-spin"></div>
    </div>
  )
}

interface HistoricoViewProps {
  onStartChallenge?: (challenge: any) => void
  initialMeetEvaluationId?: string | null
  initialHistoryTab?: string | null
  onMeetEvaluationLoaded?: () => void
}

export default function HistoricoView({ onStartChallenge, initialMeetEvaluationId, initialHistoryTab, onMeetEvaluationLoaded }: HistoricoViewProps) {
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab')
  const urlEvaluationId = searchParams.get('evaluationId')

  const [sessions, setSessions] = useState<RoleplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null)
  const [mounted, setMounted] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [historyType, setHistoryType] = useState<'simulacoes' | 'followups' | 'meet' | 'correcoes' | 'desafios' | null>(
    (initialHistoryTab as any) || (urlTab === 'meet' ? 'meet' : null)
  )
  const [userId, setUserId] = useState<string | null>(null)

  // Notifications for meet glow effect
  const { notifications, markAsRead } = useNotifications(userId)
  const meetNotifications = notifications.filter(n =>
    n.type === 'meet_evaluation_ready' || n.type === 'meet_evaluation_error'
  )
  const newEvaluationIds = meetNotifications
    .map(n => n.data?.evaluationId)
    .filter(Boolean) as string[]

  useEffect(() => {
    setMounted(true)
    loadSessions()

    // Get user ID for notifications
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })

    // Listen for history type change event (from Dashboard)
    const handleSetHistoryType = (e: CustomEvent) => {
      if (e.detail === 'desafios' || e.detail === 'meet' || e.detail === 'simulacoes' || e.detail === 'correcoes') {
        setHistoryType(e.detail)
      }
    }
    window.addEventListener('setHistoryType', handleSetHistoryType as EventListener)
    return () => window.removeEventListener('setHistoryType', handleSetHistoryType as EventListener)
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    const data = await getUserRoleplaySessions(50)
    setSessions(data)
    if (data.length > 0) {
      setSelectedSession(data[0])
    }
    setLoading(false)
  }

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return

    const success = await deleteRoleplaySession(sessionId)
    if (success) {
      setSessions(sessions.filter(s => s.id !== sessionId))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(sessions.length > 1 ? sessions.find(s => s.id !== sessionId) || null : null)
      }
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}min ${secs}s`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getProcessedEvaluation = (session: RoleplaySession) => {
    let evaluation = (session as any).evaluation
    if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
      try {
        evaluation = JSON.parse(evaluation.output)
      } catch (e) {
        return null
      }
    }
    return evaluation
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    if (score >= 4) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
    if (score >= 6) return 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'
    if (score >= 4) return 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200'
    return 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
  }

  const getScoreListBg = (score: number) => {
    if (score >= 8) return 'bg-green-50'
    if (score >= 6) return 'bg-blue-50'
    if (score >= 4) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  const getPerformanceLabel = (level: string) => {
    const labels: Record<string, string> = {
      'legendary': 'Lendário',
      'excellent': 'Excelente',
      'very_good': 'Muito Bom',
      'good': 'Bom',
      'needs_improvement': 'Precisa Melhorar',
      'poor': 'Em Desenvolvimento'
    }
    return labels[level] || level
  }

  const translateIndicator = (key: string) => {
    const translations: Record<string, string> = {
      // Indicadores SPIN - Situação (S)
      'adaptability_score': 'Adaptabilidade',
      'open_questions_score': 'Perguntas Abertas',
      'scenario_mapping_score': 'Mapeamento de Cenário',
      'depth_score': 'Profundidade',
      'relevance_score': 'Relevância',
      'context_score': 'Contexto',
      'discovery_score': 'Descoberta',
      'exploration_score': 'Exploração',
      'investigation_score': 'Investigação',

      // Indicadores SPIN - Problema (P)
      'problem_identification_score': 'Identificação de Problemas',
      'empathy_score': 'Empatia',
      'consequences_exploration_score': 'Exploração de Consequências',
      'impact_understanding_score': 'Compreensão de Impacto',
      'pain_identification_score': 'Identificação de Dores',
      'challenge_discovery_score': 'Descoberta de Desafios',

      // Indicadores SPIN - Implicação (I)
      'emotional_impact_score': 'Impacto Emocional',
      'logical_flow_score': 'Fluxo Lógico',
      'quantification_score': 'Quantificação',
      'future_projection_score': 'Projeção Futura',
      'business_impact_score': 'Impacto no Negócio',
      'consequence_development_score': 'Desenvolvimento de Consequências',
      'amplification_score': 'Amplificação',
      'concrete_risks': 'Riscos Concretos',
      'inaction_consequences': 'Consequências da Inação',
      'urgency_amplification': 'Amplificação de Urgência',
      'non_aggressive_urgency': 'Urgência Não Agressiva',

      // Indicadores SPIN - Necessidade (N)
      'value_articulation_score': 'Articulação de Valor',
      'solution_fit_score': 'Adequação da Solução',
      'commitment_score': 'Comprometimento',
      'benefit_clarity_score': 'Clareza de Benefícios',
      'roi_demonstration_score': 'Demonstração de ROI',
      'outcome_score': 'Resultado',
      'value_proposition_score': 'Proposta de Valor',
      'credibility': 'Credibilidade',
      'personalization': 'Personalização',
      'benefits_clarity': 'Clareza de Benefícios',
      'solution_clarity': 'Clareza da Solução',
      'cta_effectiveness': 'Eficácia do CTA',

      // Indicadores gerais de vendas (com _score)
      'timing_score': 'Timing',
      'impact_score': 'Impacto',
      'clarity_score': 'Clareza',
      'connection_score': 'Conexão',
      'rapport_score': 'Rapport',
      'listening_score': 'Escuta Ativa',
      'active_listening_score': 'Escuta Ativa',
      'questioning_score': 'Questionamento',
      'probing_score': 'Investigação',
      'urgency_score': 'Urgência',
      'pain_exploration_score': 'Exploração de Dores',
      'need_development_score': 'Desenvolvimento de Necessidade',
      'solution_presentation_score': 'Apresentação de Solução',
      'objection_handling_score': 'Tratamento de Objeções',
      'closing_score': 'Fechamento',
      'engagement_score': 'Engajamento',
      'trust_score': 'Confiança',
      'persuasion_score': 'Persuasão',
      'negotiation_score': 'Negociação',
      'presentation_score': 'Apresentação',
      'communication_score': 'Comunicação',
      'responsiveness_score': 'Responsividade',
      'strategy_score': 'Estratégia',
      'tactics_score': 'Táticas',
      'alignment_score': 'Alinhamento',
      'qualification_score': 'Qualificação',
      'follow_up_score': 'Acompanhamento',
      'handling_score': 'Manejo',
      'recovery_score': 'Recuperação',
      'flexibility_score': 'Flexibilidade',
      'confidence_score': 'Confiança',
      'assertiveness_score': 'Assertividade',
      'patience_score': 'Paciência',
      'persistence_score': 'Persistência',
      'creativity_score': 'Criatividade',
      'knowledge_score': 'Conhecimento',
      'preparation_score': 'Preparação',
      'professionalism_score': 'Profissionalismo',

      // Indicadores sem sufixo _score (formato N8N)
      'timing': 'Timing',
      'impact': 'Impacto',
      'clarity': 'Clareza',
      'connection': 'Conexão',
      'rapport': 'Rapport',
      'listening': 'Escuta Ativa',
      'active_listening': 'Escuta Ativa',
      'questioning': 'Questionamento',
      'probing': 'Investigação',
      'urgency': 'Urgência',
      'engagement': 'Engajamento',
      'trust': 'Confiança',
      'persuasion': 'Persuasão',
      'negotiation': 'Negociação',
      'presentation': 'Apresentação',
      'communication': 'Comunicação',
      'flexibility': 'Flexibilidade',
      'confidence': 'Confiança',
      'assertiveness': 'Assertividade',
      'patience': 'Paciência',
      'persistence': 'Persistência',
      'creativity': 'Criatividade',
      'knowledge': 'Conhecimento',
      'preparation': 'Preparação',
      'professionalism': 'Profissionalismo',
      'depth': 'Profundidade',
      'relevance': 'Relevância',
      'context': 'Contexto',
      'discovery': 'Descoberta',
      'exploration': 'Exploração',
      'investigation': 'Investigação',
      'empathy': 'Empatia',
      'adaptability': 'Adaptabilidade',
      'outcome': 'Resultado',
      'commitment': 'Comprometimento',
      'qualification': 'Qualificação',
      'alignment': 'Alinhamento',
      'strategy': 'Estratégia',
      'tactics': 'Táticas',
      'handling': 'Manejo',
      'recovery': 'Recuperação',
      'follow_up': 'Acompanhamento',
      'responsiveness': 'Responsividade',
      'quantification': 'Quantificação',
      'amplification': 'Amplificação',
    }
    // Normaliza: lowercase e substitui espaços por underscores
    const normalized = key.toLowerCase().replace(/\s+/g, '_')
    if (translations[normalized]) return translations[normalized]
    if (translations[key]) return translations[key]

    // Tenta sem o sufixo _score
    const withoutScore = normalized.replace(/_score$/, '')
    if (translations[withoutScore]) return translations[withoutScore]

    // Fallback: formata a chave em formato legível
    const cleaned = key
      .replace(/_score$/i, '')
      .replace(/\s+score$/i, '')
      .replace(/_/g, ' ')
      .trim()
    // Capitaliza primeira letra
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  const historyOptions = [
    {
      key: 'simulacoes' as const,
      label: 'Simulações',
      description: 'Revise seus roleplays de vendas e avaliações SPIN',
      icon: Users,
      color: 'green',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200',
      hoverBg: 'hover:bg-green-50',
      hoverBorder: 'hover:border-green-300',
    },
    {
      key: 'meet' as const,
      label: 'Google Meet',
      description: 'Avaliações de reuniões reais gravadas pelo bot',
      icon: Video,
      color: 'blue',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      hoverBg: 'hover:bg-blue-50',
      hoverBorder: 'hover:border-blue-300',
    },
    {
      key: 'correcoes' as const,
      label: 'Correções',
      description: 'Simulações de correção baseadas nos seus erros',
      icon: Lightbulb,
      color: 'amber',
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-200',
      hoverBg: 'hover:bg-amber-50',
      hoverBorder: 'hover:border-amber-300',
    },
    {
      key: 'desafios' as const,
      label: 'Desafios',
      description: 'Desafios diários personalizados para suas fraquezas',
      icon: Target,
      color: 'purple',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      hoverBg: 'hover:bg-purple-50',
      hoverBorder: 'hover:border-purple-300',
    },
  ]

  const currentOption = historyOptions.find(o => o.key === historyType)

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`bg-white rounded-2xl p-6 border border-gray-200 mb-6 shadow-sm ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <div className="flex items-center gap-4">
            {historyType !== null && (
              <button
                onClick={() => setHistoryType(null)}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentOption ? currentOption.bgColor : 'bg-green-50'}`}>
              {currentOption ? (
                <currentOption.icon className={`w-6 h-6 ${currentOption.iconColor}`} />
              ) : (
                <History className="w-6 h-6 text-green-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentOption ? currentOption.label : 'Histórico'}
              </h1>
              <p className="text-gray-500 text-sm">
                {currentOption ? currentOption.description : 'Escolha qual histórico deseja acessar'}
              </p>
            </div>
          </div>
        </div>

        {/* Selector Screen */}
        {historyType === null ? (
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            {historyOptions.map((option) => {
              const hasMeetGlow = option.key === 'meet' && meetNotifications.length > 0

              return (
                <div key={option.key} className="relative">
                  {/* Glow effect behind card when there are new meet evaluations */}
                  {hasMeetGlow && (
                    <div className="absolute -inset-1 rounded-3xl bg-blue-400/30 blur-md animate-pulse pointer-events-none" />
                  )}
                  <button
                    onClick={() => {
                      setHistoryType(option.key)
                      if (hasMeetGlow) {
                        meetNotifications.forEach(n => markAsRead(n.id))
                      }
                    }}
                    className={`relative w-full group bg-white rounded-2xl p-6 border-2 transition-all text-left shadow-sm hover:shadow-md ${
                      hasMeetGlow
                        ? 'border-blue-300 ring-1 ring-blue-200'
                        : `border-gray-200 ${option.hoverBg} ${option.hoverBorder}`
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${option.bgColor} group-hover:scale-110 transition-transform`}>
                        <option.icon className={`w-7 h-7 ${option.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{option.label}</h3>
                          {hasMeetGlow && (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-100 rounded-full animate-pulse">
                              {meetNotifications.length} NOVA{meetNotifications.length > 1 ? 'S' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed">{option.description}</p>
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>

        ) : historyType === 'meet' ? (
          <Suspense fallback={<LazySpinner />}>
            <MeetHistoryContent newEvaluationIds={newEvaluationIds} initialEvaluationId={initialMeetEvaluationId || urlEvaluationId} onInitialEvaluationLoaded={onMeetEvaluationLoaded} />
          </Suspense>
        ) : historyType === 'correcoes' ? (
          <Suspense fallback={<LazySpinner />}>
            <CorrectionHistoryContent />
          </Suspense>
        ) : historyType === 'desafios' ? (
          <Suspense fallback={<LazySpinner />}>
            <ChallengeHistoryContent onStartChallenge={onStartChallenge} />
          </Suspense>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-green-100 border-t-green-500 rounded-full animate-spin"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <History className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-900 font-semibold text-lg mb-2">Nenhuma sessão encontrada</p>
            <p className="text-gray-500 text-sm">Complete um roleplay para ver seu histórico aqui</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de sessões - Coluna estreita */}
            <div className="lg:col-span-4 xl:col-span-3">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    {sessions.length} Sessões
                  </h2>
                </div>
                <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
                  {sessions.map((session) => {
                    const evaluation = getProcessedEvaluation(session)
                    const score = evaluation?.overall_score !== undefined
                      ? (evaluation.overall_score > 10 ? evaluation.overall_score / 10 : evaluation.overall_score)
                      : null

                    return (
                      <button
                        key={session.id}
                        onClick={() => { setSelectedSession(session); setExpandedSection(null) }}
                        className={`w-full text-left p-4 border-b border-gray-100 transition-all ${
                          selectedSession?.id === session.id
                            ? 'bg-green-50 border-l-4 border-l-green-500'
                            : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Nota em destaque */}
                          {score !== null ? (
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getScoreListBg(score)}`}>
                              <span className={`text-lg font-bold ${getScoreColor(score)}`}>
                                {score.toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs text-gray-400 font-medium">--</span>
                            </div>
                          )}

                          {/* Info da sessão */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 mb-0.5">
                              {formatDuration(session.duration_seconds) || 'Sem duração'}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{session.messages.length} mensagens</span>
                              <span className="text-gray-300">•</span>
                              <span>{formatDate(session.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Detalhes da sessão - Coluna larga */}
            <div className="lg:col-span-8 xl:col-span-9">
              {!selectedSession ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <MessageCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500">Selecione uma sessão para ver os detalhes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Header da sessão */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    {/* Linha superior: Data, tempo e ações */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-green-600" />
                          <span className="text-gray-900 font-semibold">{formatDate(selectedSession.created_at)}</span>
                          <span className="text-gray-500">{formatTime(selectedSession.created_at)}</span>
                        </div>
                        {selectedSession.duration_seconds && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-sm text-green-700 font-medium">{formatDuration(selectedSession.duration_seconds)}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(selectedSession.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir sessão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Cards de configuração */}
                    <div className="flex flex-wrap gap-2">
                      <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-purple-600 font-medium uppercase tracking-wider">Temperamento</span>
                        <span className="text-gray-900 font-semibold block">{selectedSession.config.temperament}</span>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Idade</span>
                        <span className="text-gray-900 font-semibold block">{selectedSession.config.age} anos</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex-1 min-w-0">
                        <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Persona</span>
                        <span className="text-gray-900 font-medium text-sm leading-snug block line-clamp-2">{selectedSession.config.segment}</span>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible detail cards */}
                  {(() => {
                    const evaluation = getProcessedEvaluation(selectedSession)
                    const score = evaluation?.overall_score !== undefined
                      ? (evaluation.overall_score > 10 ? evaluation.overall_score / 10 : evaluation.overall_score)
                      : null
                    const spin = evaluation?.spin_evaluation
                    const pa = evaluation?.playbook_adherence

                    return (
                      <div className="space-y-3">
                        {/* Card: Resumo */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedSection(expandedSection === 'resumo' ? null : 'resumo')}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                              </div>
                              <div className="text-left">
                                <h3 className="text-sm font-semibold text-gray-900">Resumo</h3>
                                <p className="text-xs text-gray-500">
                                  {score !== null && evaluation?.performance_level
                                    ? `Nota ${score.toFixed(1)} - ${getPerformanceLabel(evaluation.performance_level)}`
                                    : 'Sem avaliação'}
                                </p>
                              </div>
                            </div>
                            {expandedSection === 'resumo' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </button>
                          {expandedSection === 'resumo' && (
                            <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                              {!evaluation ? (
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                                  <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                                    <AlertTriangle className="w-8 h-8 text-gray-400" />
                                  </div>
                                  <p className="text-gray-500">Esta sessão não possui avaliação</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {/* Score principal */}
                                  <div className={`rounded-2xl border p-8 text-center ${getScoreBg(score || 0)}`}>
                                    <div className={`text-6xl font-bold mb-2 ${getScoreColor(score || 0)}`}>
                                      {score?.toFixed(1) || 'N/A'}
                                    </div>
                                    <div className={`text-sm font-medium ${getScoreColor(score || 0)} opacity-80`}>
                                      {evaluation.performance_level && getPerformanceLabel(evaluation.performance_level)}
                                    </div>
                                  </div>

                                  {/* Resumo executivo */}
                                  {evaluation.executive_summary && (
                                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                        Resumo Executivo
                                      </h4>
                                      <p className="text-gray-700 leading-relaxed">
                                        {evaluation.executive_summary}
                                      </p>
                                    </div>
                                  )}

                                  {/* Grid de insights */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Pontos fortes */}
                                    {evaluation.top_strengths?.length > 0 && (
                                      <div className="bg-green-50 rounded-2xl border border-green-100 p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                          <CheckCircle className="w-5 h-5 text-green-600" />
                                          <h4 className="text-sm font-semibold text-green-700">Pontos Fortes</h4>
                                        </div>
                                        <ul className="space-y-2">
                                          {evaluation.top_strengths.map((strength: string, i: number) => (
                                            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                              <span className="text-green-500 mt-1 flex-shrink-0">•</span>
                                              {strength}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Gaps críticos */}
                                    {evaluation.critical_gaps?.length > 0 && (
                                      <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
                                        <div className="flex items-center gap-2 mb-4">
                                          <AlertTriangle className="w-5 h-5 text-red-600" />
                                          <h4 className="text-sm font-semibold text-red-700">Pontos a Melhorar</h4>
                                        </div>
                                        <ul className="space-y-2">
                                          {evaluation.critical_gaps.map((gap: string, i: number) => (
                                            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                              <span className="text-red-500 mt-1 flex-shrink-0">•</span>
                                              {gap}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>

                                  {/* Prioridades de melhoria */}
                                  {evaluation.priority_improvements?.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                                      <div className="flex items-center gap-2 mb-4">
                                        <Lightbulb className="w-5 h-5 text-amber-500" />
                                        <h4 className="text-sm font-semibold text-gray-900">Prioridades de Melhoria</h4>
                                      </div>
                                      <div className="space-y-3">
                                        {evaluation.priority_improvements.map((imp: any, i: number) => (
                                          <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                                imp.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                                imp.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                                'bg-yellow-100 text-yellow-700'
                                              }`}>
                                                {imp.priority === 'critical' ? 'Crítico' :
                                                 imp.priority === 'high' ? 'Alta' : 'Média'}
                                              </span>
                                              <span className="text-sm font-semibold text-gray-900">{imp.area}</span>
                                            </div>
                                            <p className="text-sm text-gray-600">{imp.action_plan}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Card: Análise SPIN */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedSection(expandedSection === 'spin' ? null : 'spin')}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                                <Target className="w-5 h-5 text-cyan-600" />
                              </div>
                              <div className="text-left">
                                <h3 className="text-sm font-semibold text-gray-900">Análise SPIN</h3>
                                {spin ? (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {[
                                      { key: 'S', label: 'S', color: 'cyan' },
                                      { key: 'P', label: 'P', color: 'green' },
                                      { key: 'I', label: 'I', color: 'amber' },
                                      { key: 'N', label: 'N', color: 'pink' },
                                    ].map(({ key, label, color }) => {
                                      const s = spin[key]?.final_score || 0
                                      return (
                                        <span key={key} className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                                          s >= 7 ? 'bg-green-100 text-green-700' :
                                          s >= 5 ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-red-100 text-red-700'
                                        }`}>
                                          {label}: {s.toFixed(1)}
                                        </span>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-500">Sem análise SPIN</p>
                                )}
                              </div>
                            </div>
                            {expandedSection === 'spin' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </button>
                          {expandedSection === 'spin' && (
                            <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                              {!spin ? (
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                                  <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                                    <Target className="w-8 h-8 text-gray-400" />
                                  </div>
                                  <p className="text-gray-500">Esta sessão não possui análise SPIN</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {/* Grid de scores SPIN */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                      { key: 'S', label: 'Situação', gradient: 'from-cyan-50 to-blue-50', border: 'border-cyan-200', color: 'text-cyan-700' },
                                      { key: 'P', label: 'Problema', gradient: 'from-green-50 to-emerald-50', border: 'border-green-200', color: 'text-green-700' },
                                      { key: 'I', label: 'Implicação', gradient: 'from-yellow-50 to-orange-50', border: 'border-yellow-200', color: 'text-yellow-700' },
                                      { key: 'N', label: 'Necessidade', gradient: 'from-pink-50 to-rose-50', border: 'border-pink-200', color: 'text-pink-700' }
                                    ].map(({ key, label, gradient, border, color }) => {
                                      const spinScore = spin[key]?.final_score || 0
                                      return (
                                        <div key={key} className={`bg-gradient-to-br ${gradient} rounded-xl border ${border} p-4 text-center`}>
                                          <div className={`text-3xl font-bold mb-1 ${color}`}>
                                            {spinScore.toFixed(1)}
                                          </div>
                                          <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                                            {label}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Média SPIN */}
                                  <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                                    <div className="text-2xl font-bold text-green-600 mb-1">
                                      {(
                                        ((spin.S?.final_score || 0) +
                                        (spin.P?.final_score || 0) +
                                        (spin.I?.final_score || 0) +
                                        (spin.N?.final_score || 0)) / 4
                                      ).toFixed(1)}
                                    </div>
                                    <div className="text-xs text-green-600 uppercase tracking-wider font-medium">
                                      Média Geral SPIN
                                    </div>
                                  </div>

                                  {/* SPIN Detailed breakdown - 2 columns, always visible */}
                                  <div className="grid grid-cols-2 gap-4">
                                    {['S', 'P', 'I', 'N'].map((letter) => {
                                      const data = spin[letter]
                                      if (!data) return null

                                      const labels: Record<string, string> = {
                                        'S': 'Situação',
                                        'P': 'Problema',
                                        'I': 'Implicação',
                                        'N': 'Necessidade'
                                      }

                                      const letterScore = data.final_score || 0

                                      return (
                                        <div key={letter} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                          {/* Card header */}
                                          <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-sm ${
                                              letterScore >= 7 ? 'bg-green-500' :
                                              letterScore >= 5 ? 'bg-yellow-500' :
                                              'bg-red-500'
                                            }`}>
                                              {letter}
                                            </div>
                                            <div>
                                              <div className="text-sm font-semibold text-gray-900">{labels[letter]}</div>
                                              <div className={`text-xs font-medium ${
                                                letterScore >= 7 ? 'text-green-600' :
                                                letterScore >= 5 ? 'text-yellow-600' :
                                                'text-red-600'
                                              }`}>
                                                {letterScore.toFixed(1)}/10
                                              </div>
                                            </div>
                                          </div>

                                          {/* Indicators with progress bars */}
                                          {data.indicators && Object.keys(data.indicators).length > 0 && (
                                            <div className="space-y-2 mb-3">
                                              {Object.entries(data.indicators).map(([key, value]: [string, any]) => (
                                                <div key={key}>
                                                  <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-xs text-gray-600">{translateIndicator(key)}</span>
                                                    <span className={`text-xs font-semibold ${
                                                      Number(value) >= 7 ? 'text-green-600' :
                                                      Number(value) >= 5 ? 'text-yellow-600' : 'text-red-600'
                                                    }`}>{value}/10</span>
                                                  </div>
                                                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                      className={`h-full rounded-full transition-all ${
                                                        Number(value) >= 7 ? 'bg-green-500' :
                                                        Number(value) >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                                                      }`}
                                                      style={{ width: `${(Number(value) / 10) * 100}%` }}
                                                    />
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {/* Technical feedback */}
                                          {data.technical_feedback && (
                                            <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-200 pt-3 mb-3">
                                              {data.technical_feedback}
                                            </p>
                                          )}

                                          {/* Missed opportunities */}
                                          {data.missed_opportunities?.length > 0 && (
                                            <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
                                              <p className="text-[11px] font-semibold text-orange-700 mb-1.5">Oportunidades perdidas</p>
                                              <ul className="space-y-1">
                                                {data.missed_opportunities.map((opp: string, i: number) => (
                                                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                                                    <span className="text-orange-400 mt-0.5 flex-shrink-0">•</span>
                                                    {opp}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Análise de objeções - always visible */}
                                  {evaluation?.objections_analysis?.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Análise de Objeções</h4>
                                      <div className="space-y-4">
                                        {evaluation.objections_analysis.map((obj: any, idx: number) => (
                                          <div key={idx} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                                            <div className="flex items-start justify-between mb-3">
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                                                    obj.objection_type === 'preço' || obj.objection_type === 'preco' ? 'bg-red-100 text-red-700' :
                                                    obj.objection_type === 'timing' ? 'bg-blue-100 text-blue-700' :
                                                    obj.objection_type === 'autoridade' ? 'bg-purple-100 text-purple-700' :
                                                    obj.objection_type === 'concorrência' || obj.objection_type === 'concorrencia' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-100 text-gray-700'
                                                  }`}>
                                                    {obj.objection_type}
                                                  </span>
                                                </div>
                                                <p className="text-sm text-gray-700 italic leading-relaxed">&ldquo;{obj.objection_text}&rdquo;</p>
                                              </div>
                                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ml-4 ${
                                                obj.score >= 7 ? 'bg-green-100' :
                                                obj.score >= 5 ? 'bg-yellow-100' : 'bg-red-100'
                                              }`}>
                                                <span className={`text-xl font-bold ${
                                                  obj.score >= 7 ? 'text-green-600' :
                                                  obj.score >= 5 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                  {obj.score}
                                                </span>
                                              </div>
                                            </div>

                                            {obj.detailed_analysis && (
                                              <p className="text-sm text-gray-600 leading-relaxed mb-3">{obj.detailed_analysis}</p>
                                            )}

                                            {obj.critical_errors && obj.critical_errors.length > 0 && (
                                              <div className="mb-3">
                                                <p className="text-xs font-semibold text-red-600 mb-1.5">Erros criticos:</p>
                                                <ul className="space-y-1">
                                                  {obj.critical_errors.map((err: string, i: number) => (
                                                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                                      <span className="text-red-400 mt-1">•</span>
                                                      {err}
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}

                                            {obj.ideal_response && (
                                              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                                <p className="text-xs font-semibold text-green-700 mb-1">Resposta ideal:</p>
                                                <p className="text-sm text-gray-700 leading-relaxed">{obj.ideal_response}</p>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Card: Playbook */}
                        {pa && (
                          <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <button
                              onClick={() => setExpandedSection(expandedSection === 'playbook' ? null : 'playbook')}
                              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="text-left">
                                  <h3 className="text-sm font-semibold text-gray-900">Playbook</h3>
                                  <p className="text-xs text-gray-500">
                                    {pa.overall_adherence_score}% de aderência - {
                                      pa.adherence_level === 'exemplary' ? 'Exemplar' :
                                      pa.adherence_level === 'compliant' ? 'Conforme' :
                                      pa.adherence_level === 'partial' ? 'Parcial' : 'Não Conforme'
                                    }
                                  </p>
                                </div>
                              </div>
                              {expandedSection === 'playbook' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </button>
                            {expandedSection === 'playbook' && (
                              <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                                <div className="space-y-4">
                                  {/* Score Geral do Playbook */}
                                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-sm font-medium text-purple-700 uppercase tracking-wider">
                                        Aderência ao Playbook
                                      </h4>
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        pa.adherence_level === 'exemplary' ? 'bg-green-100 text-green-700' :
                                        pa.adherence_level === 'compliant' ? 'bg-blue-100 text-blue-700' :
                                        pa.adherence_level === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                      }`}>
                                        {pa.adherence_level === 'exemplary' ? 'Exemplar' :
                                         pa.adherence_level === 'compliant' ? 'Conforme' :
                                         pa.adherence_level === 'partial' ? 'Parcial' : 'Não Conforme'}
                                      </span>
                                    </div>
                                    <div className="flex items-end gap-2">
                                      <span className="text-4xl font-bold text-purple-600">
                                        {pa.overall_adherence_score}%
                                      </span>
                                      <span className="text-sm text-gray-500 mb-1">de aderência</span>
                                    </div>
                                  </div>

                                  {/* Dimensões do Playbook */}
                                  {pa.dimensions && (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                      {[
                                        { key: 'opening', label: 'Abertura', icon: '🎯' },
                                        { key: 'closing', label: 'Fechamento', icon: '🤝' },
                                        { key: 'conduct', label: 'Conduta', icon: '👔' },
                                        { key: 'required_scripts', label: 'Scripts', icon: '📝' },
                                        { key: 'process', label: 'Processo', icon: '⚙️' }
                                      ].map(({ key, label, icon }) => {
                                        const dim = pa.dimensions?.[key as keyof typeof pa.dimensions]
                                        if (!dim || dim.status === 'not_evaluated') return null
                                        return (
                                          <div key={key} className="bg-white rounded-xl border border-gray-200 p-3 text-center shadow-sm">
                                            <div className="text-xl mb-1">{icon}</div>
                                            <div className={`text-2xl font-bold ${
                                              (dim.score || 0) >= 70 ? 'text-green-600' :
                                              (dim.score || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                                            }`}>
                                              {dim.score || 0}%
                                            </div>
                                            <div className="text-xs text-gray-500">{label}</div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}

                                  {/* Violações */}
                                  <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                                    <h4 className="flex items-center gap-2 text-sm font-medium text-red-700 mb-3">
                                      <AlertTriangle className="w-4 h-4" />
                                      Violações Detectadas
                                    </h4>
                                    {pa.violations && pa.violations.length > 0 ? (
                                      <ul className="space-y-2">
                                        {pa.violations.map((v: any, i: number) => (
                                          <li key={i} className="text-sm text-gray-700 bg-white/50 rounded-lg p-3 border border-red-100">
                                            <div className="font-medium text-red-700">{v.criterion}</div>
                                            {v.evidence && <p className="text-xs text-gray-500 mt-1 italic">"{v.evidence}"</p>}
                                            {v.recommendation && <p className="text-xs text-red-600 mt-1">{v.recommendation}</p>}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-green-600 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        Nenhuma violação detectada
                                      </p>
                                    )}
                                  </div>

                                  {/* Requisitos Não Cumpridos */}
                                  <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
                                    <h4 className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-3">
                                      <AlertCircle className="w-4 h-4" />
                                      Requisitos Não Cumpridos
                                    </h4>
                                    {pa.missed_requirements && pa.missed_requirements.length > 0 ? (
                                      <ul className="space-y-2">
                                        {pa.missed_requirements.map((m: any, i: number) => (
                                          <li key={i} className="text-sm text-gray-700 bg-white/50 rounded-lg p-3 border border-amber-100">
                                            <div className="font-medium text-amber-700">{m.criterion}</div>
                                            {m.expected && <p className="text-xs text-gray-500 mt-1">Esperado: {m.expected}</p>}
                                            {m.recommendation && <p className="text-xs text-amber-600 mt-1">{m.recommendation}</p>}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-sm text-green-600 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        Todos os requisitos foram cumpridos
                                      </p>
                                    )}
                                  </div>

                                  {/* Notas de Coaching */}
                                  {pa.coaching_notes && (
                                    <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
                                      <h4 className="flex items-center gap-2 text-sm font-medium text-blue-700 mb-3">
                                        <Lightbulb className="w-4 h-4" />
                                        Orientações para Melhorar
                                      </h4>
                                      <p className="text-sm text-gray-700 leading-relaxed">
                                        {pa.coaching_notes}
                                      </p>
                                    </div>
                                  )}

                                  {/* Resumo de Critérios */}
                                  {pa.playbook_summary && (
                                    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
                                      <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                                        Resumo dos Critérios
                                      </h4>
                                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
                                        <div className="bg-white rounded-lg p-2 border border-gray-200">
                                          <div className="font-bold text-gray-700">{pa.playbook_summary.total_criteria_extracted}</div>
                                          <div className="text-gray-500">Total</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 border border-green-200">
                                          <div className="font-bold text-green-600">{pa.playbook_summary.criteria_compliant}</div>
                                          <div className="text-gray-500">Conforme</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 border border-yellow-200">
                                          <div className="font-bold text-yellow-600">{pa.playbook_summary.criteria_partial}</div>
                                          <div className="text-gray-500">Parcial</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 border border-orange-200">
                                          <div className="font-bold text-orange-600">{pa.playbook_summary.criteria_missed}</div>
                                          <div className="text-gray-500">Perdido</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 border border-red-200">
                                          <div className="font-bold text-red-600">{pa.playbook_summary.criteria_violated}</div>
                                          <div className="text-gray-500">Violado</div>
                                        </div>
                                        <div className="bg-white rounded-lg p-2 border border-purple-200">
                                          <div className="font-bold text-purple-600">{pa.playbook_summary.compliance_rate}</div>
                                          <div className="text-gray-500">Taxa</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Card: Transcrição */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedSection(expandedSection === 'transcricao' ? null : 'transcricao')}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                <MessageCircle className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="text-left">
                                <h3 className="text-sm font-semibold text-gray-900">Transcrição</h3>
                                <p className="text-xs text-gray-500">{selectedSession.messages.length} mensagens</p>
                              </div>
                            </div>
                            {expandedSection === 'transcricao' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </button>
                          {expandedSection === 'transcricao' && (
                            <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                                  {selectedSession.messages.length} mensagens
                                </h4>
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                  {selectedSession.messages.map((msg, index) => (
                                    <div
                                      key={index}
                                      className={`flex gap-3 ${msg.role === 'seller' ? 'flex-row-reverse' : ''}`}
                                    >
                                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        msg.role === 'client'
                                          ? 'bg-gray-200'
                                          : 'bg-green-100'
                                      }`}>
                                        <User className={`w-4 h-4 ${
                                          msg.role === 'client' ? 'text-gray-600' : 'text-green-600'
                                        }`} />
                                      </div>
                                      <div className={`flex-1 max-w-[80%] ${msg.role === 'seller' ? 'text-right' : ''}`}>
                                        <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-2">
                                          <span className={`font-medium ${msg.role === 'client' ? 'text-gray-600' : 'text-green-600'}`}>
                                            {msg.role === 'client' ? 'Cliente' : 'Você'}
                                          </span>
                                          <span>•</span>
                                          <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}</span>
                                        </div>
                                        <div className={`inline-block p-4 rounded-2xl text-sm leading-relaxed ${
                                          msg.role === 'client'
                                            ? 'bg-gray-100 text-gray-700 rounded-tl-sm'
                                            : 'bg-green-50 text-gray-700 border border-green-100 rounded-tr-sm'
                                        }`}>
                                          {msg.text}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
