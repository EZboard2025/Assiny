'use client'

import { useState, useEffect } from 'react'
import { Clock, User, MessageCircle, Calendar, Trash2, Target, TrendingUp, AlertTriangle, Lightbulb, ChevronDown, History, CheckCircle, Video, Users, AlertCircle } from 'lucide-react'
import { getUserRoleplaySessions, deleteRoleplaySession, type RoleplaySession } from '@/lib/roleplay'
import FollowUpHistoryView from './FollowUpHistoryView'
import MeetHistoryContent from './MeetHistoryContent'
import ChallengeHistoryContent from './ChallengeHistoryContent'

interface HistoricoViewProps {
  onStartChallenge?: (challenge: any) => void
}

export default function HistoricoView({ onStartChallenge }: HistoricoViewProps) {
  const [sessions, setSessions] = useState<RoleplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'resumo' | 'spin' | 'playbook' | 'transcricao'>('resumo')
  const [historyType, setHistoryType] = useState<'simulacoes' | 'followups' | 'meet' | 'desafios'>('simulacoes')

  useEffect(() => {
    setMounted(true)
    loadSessions()

    // Listen for history type change event (from Dashboard)
    const handleSetHistoryType = (e: CustomEvent) => {
      if (e.detail === 'desafios') {
        setHistoryType('desafios')
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

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Card - Design Profissional */}
        <div className={`bg-white rounded-2xl p-6 border border-gray-200 mb-6 shadow-sm ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <History className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Histórico</h1>
                <p className="text-gray-500 text-sm">Analise suas sessões e acompanhe sua evolução</p>
              </div>
            </div>

            {/* Tabs for history type */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setHistoryType('simulacoes')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  historyType === 'simulacoes'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="w-4 h-4" />
                Simulações
              </button>
              <button
                onClick={() => setHistoryType('followups')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  historyType === 'followups'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                Follow-ups
              </button>
              <button
                onClick={() => setHistoryType('meet')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  historyType === 'meet'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Video className="w-4 h-4" />
                Google Meet
              </button>
              <button
                onClick={() => setHistoryType('desafios')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  historyType === 'desafios'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Target className="w-4 h-4" />
                Desafios
              </button>
            </div>
          </div>
        </div>

        {/* Render content based on selected history type */}
        {historyType === 'followups' ? (
          <FollowUpHistoryView />
        ) : historyType === 'meet' ? (
          <MeetHistoryContent />
        ) : historyType === 'desafios' ? (
          <ChallengeHistoryContent onStartChallenge={onStartChallenge} />
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
                        onClick={() => setSelectedSession(session)}
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-purple-600 font-medium uppercase tracking-wider">Temperamento</span>
                        <span className="text-gray-900 font-semibold block">{selectedSession.config.temperament}</span>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        <span className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Idade</span>
                        <span className="text-gray-900 font-semibold block">{selectedSession.config.age} anos</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 sm:col-span-1">
                        <span className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Persona</span>
                        <span className="text-gray-900 font-medium text-sm leading-snug block">{selectedSession.config.segment}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabs de navegação */}
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    {['resumo', 'spin', ...(getProcessedEvaluation(selectedSession)?.playbook_adherence ? ['playbook'] : []), 'transcricao'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as typeof activeTab)}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                          activeTab === tab
                            ? 'bg-green-500 text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                        }`}
                      >
                        {tab === 'resumo' && 'Resumo'}
                        {tab === 'spin' && 'Análise SPIN'}
                        {tab === 'playbook' && 'Playbook'}
                        {tab === 'transcricao' && 'Transcrição'}
                      </button>
                    ))}
                  </div>

                  {/* Conteúdo das tabs */}
                  {(() => {
                    const evaluation = getProcessedEvaluation(selectedSession)

                    if (activeTab === 'resumo') {
                      if (!evaluation) {
                        return (
                          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                              <AlertTriangle className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500">Esta sessão não possui avaliação</p>
                          </div>
                        )
                      }

                      const score = evaluation.overall_score !== undefined
                        ? (evaluation.overall_score > 10 ? evaluation.overall_score / 10 : evaluation.overall_score)
                        : null

                      return (
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
                      )
                    }

                    if (activeTab === 'spin') {
                      if (!evaluation?.spin_evaluation) {
                        return (
                          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                              <Target className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500">Esta sessão não possui análise SPIN</p>
                          </div>
                        )
                      }

                      const spin = evaluation.spin_evaluation

                      return (
                        <div className="space-y-4">
                          {/* Grid de scores SPIN */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                              { key: 'S', label: 'Situação', gradient: 'from-cyan-50 to-blue-50', border: 'border-cyan-200', color: 'text-cyan-700' },
                              { key: 'P', label: 'Problema', gradient: 'from-green-50 to-emerald-50', border: 'border-green-200', color: 'text-green-700' },
                              { key: 'I', label: 'Implicação', gradient: 'from-yellow-50 to-orange-50', border: 'border-yellow-200', color: 'text-yellow-700' },
                              { key: 'N', label: 'Necessidade', gradient: 'from-pink-50 to-rose-50', border: 'border-pink-200', color: 'text-pink-700' }
                            ].map(({ key, label, gradient, border, color }) => {
                              const score = spin[key]?.final_score || 0
                              return (
                                <div key={key} className={`bg-gradient-to-br ${gradient} rounded-xl border ${border} p-4 text-center`}>
                                  <div className={`text-3xl font-bold mb-1 ${color}`}>
                                    {score.toFixed(1)}
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

                          {/* Detalhes de cada pilar */}
                          {['S', 'P', 'I', 'N'].map((letter) => {
                            const data = spin[letter]
                            if (!data) return null

                            const labels: Record<string, string> = {
                              'S': 'Situação',
                              'P': 'Problema',
                              'I': 'Implicação',
                              'N': 'Necessidade'
                            }

                            const letterColors: Record<string, string> = {
                              'S': 'bg-cyan-100 text-cyan-700',
                              'P': 'bg-green-100 text-green-700',
                              'I': 'bg-yellow-100 text-yellow-700',
                              'N': 'bg-pink-100 text-pink-700'
                            }

                            return (
                              <details key={letter} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden group">
                                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${letterColors[letter]}`}>
                                      {letter}
                                    </span>
                                    <span className="font-semibold text-gray-900">{labels[letter]}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`text-lg font-bold ${getScoreColor(data.final_score || 0)}`}>
                                      {data.final_score?.toFixed(1)}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                                  </div>
                                </summary>
                                <div className="p-4 pt-0 space-y-3 border-t border-gray-100">
                                  {/* Feedback */}
                                  {data.technical_feedback && (
                                    <p className="text-sm text-gray-600 leading-relaxed pt-3">
                                      {data.technical_feedback}
                                    </p>
                                  )}

                                  {/* Indicadores */}
                                  {data.indicators && Object.keys(data.indicators).length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                      {Object.entries(data.indicators).map(([key, value]: [string, any]) => {
                                        const score = typeof value === 'number' ? value : 0
                                        const getIndicatorStyle = (s: number) => {
                                          if (s >= 8) return 'bg-green-50 border-green-200 text-green-700'
                                          if (s >= 6) return 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                          return 'bg-red-50 border-red-200 text-red-700'
                                        }
                                        const getScoreStyle = (s: number) => {
                                          if (s >= 8) return 'text-green-600 font-semibold'
                                          if (s >= 6) return 'text-yellow-600 font-semibold'
                                          return 'text-red-600 font-semibold'
                                        }
                                        return (
                                          <span
                                            key={key}
                                            className={`text-xs px-3 py-1.5 rounded-lg border transition-all hover:scale-105 ${getIndicatorStyle(score)}`}
                                          >
                                            {translateIndicator(key)}: <span className={getScoreStyle(score)}>{value}/10</span>
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}

                                  {/* Oportunidades perdidas */}
                                  {data.missed_opportunities?.length > 0 && (
                                    <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mt-3">
                                      <p className="text-xs font-semibold text-orange-600 mb-2 uppercase tracking-wider">Oportunidades Perdidas</p>
                                      <ul className="space-y-1">
                                        {data.missed_opportunities.map((opp: string, i: number) => (
                                          <li key={i} className="text-sm text-orange-700 flex items-start gap-2">
                                            <span className="text-orange-400 mt-0.5">•</span>
                                            {opp}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </details>
                            )
                          })}

                          {/* Análise de objeções */}
                          {evaluation.objections_analysis?.length > 0 && (
                            <details className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden group">
                              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                    <Target className="w-4 h-4 text-purple-600" />
                                  </span>
                                  <span className="font-semibold text-gray-900">Análise de Objeções</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-gray-500 font-medium">
                                    {evaluation.objections_analysis.length} objeções
                                  </span>
                                  <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                                </div>
                              </summary>
                              <div className="p-4 pt-0 space-y-3 border-t border-gray-100">
                                {evaluation.objections_analysis.map((obj: any, idx: number) => (
                                  <div key={idx} className="bg-gray-50 rounded-xl border border-gray-100 p-4 mt-3 first:mt-0">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs px-2.5 py-1 bg-gray-200 rounded-full text-gray-700 font-medium">
                                        {obj.objection_type}
                                      </span>
                                      <span className={`text-sm font-bold ${getScoreColor(obj.score)}`}>
                                        {obj.score}/10
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 italic mb-2">
                                      "{obj.objection_text}"
                                    </p>
                                    {obj.detailed_analysis && (
                                      <p className="text-sm text-gray-500">{obj.detailed_analysis}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      )
                    }

                    if (activeTab === 'playbook' && evaluation?.playbook_adherence) {
                      const pa = evaluation.playbook_adherence
                      return (
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
                      )
                    }

                    if (activeTab === 'transcricao') {
                      return (
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
                      )
                    }

                    return null
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
