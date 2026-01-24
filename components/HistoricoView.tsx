'use client'

import { useState, useEffect } from 'react'
import { Clock, User, MessageCircle, Calendar, Trash2, Target, TrendingUp, AlertTriangle, Lightbulb, ChevronDown } from 'lucide-react'
import { getUserRoleplaySessions, deleteRoleplaySession, type RoleplaySession } from '@/lib/roleplay'

export default function HistoricoView() {
  const [sessions, setSessions] = useState<RoleplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'resumo' | 'spin' | 'transcricao'>('resumo')

  useEffect(() => {
    setMounted(true)
    loadSessions()
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
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-green-500/20 border-green-500/30'
    if (score >= 6) return 'bg-yellow-500/20 border-yellow-500/30'
    return 'bg-red-500/20 border-red-500/30'
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
        {/* Header simples */}
        <div className={`mb-8 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <h1 className="text-3xl font-bold text-white mb-2">Histórico de Sessões</h1>
          <p className="text-gray-400">Analise suas sessões de roleplay e acompanhe sua evolução</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20">
            <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhuma sessão encontrada</p>
            <p className="text-gray-500 text-sm mt-2">Comece um roleplay para ver seu histórico aqui</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de sessões - Coluna estreita */}
            <div className="lg:col-span-4 xl:col-span-3">
              <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-4 border-b border-gray-800">
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                    {sessions.length} Sessões
                  </h2>
                </div>
                <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
                  {sessions.map((session) => {
                    const evaluation = getProcessedEvaluation(session)
                    const score = evaluation?.overall_score !== undefined
                      ? (evaluation.overall_score > 10 ? evaluation.overall_score / 10 : evaluation.overall_score)
                      : null

                    return (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`w-full text-left p-3 border-b border-gray-800/50 transition-colors ${
                          selectedSession?.id === session.id
                            ? 'bg-green-500/10 border-l-2 border-l-green-500'
                            : 'hover:bg-gray-800/50 border-l-2 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Nota em destaque */}
                          {score !== null ? (
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              score >= 8 ? 'bg-green-500/20' :
                              score >= 6 ? 'bg-yellow-500/20' :
                              'bg-red-500/20'
                            }`}>
                              <span className={`text-lg font-bold ${
                                score >= 8 ? 'text-green-400' :
                                score >= 6 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {score.toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-800/50 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs text-gray-500">--</span>
                            </div>
                          )}

                          {/* Info da sessão */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white mb-0.5">
                              {formatDuration(session.duration_seconds) || 'Sem duração'}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{session.messages.length} mensagens</span>
                              <span className="text-gray-700">•</span>
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
                <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center">
                  <p className="text-gray-500">Selecione uma sessão para ver os detalhes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Header da sessão */}
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                    {/* Linha superior: Data, tempo e ações */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-green-400" />
                          <span className="text-white font-medium">{formatDate(selectedSession.created_at)}</span>
                          <span className="text-gray-500">{formatTime(selectedSession.created_at)}</span>
                        </div>
                        {selectedSession.duration_seconds && (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-sm text-green-400 font-medium">{formatDuration(selectedSession.duration_seconds)}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(selectedSession.id)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Excluir sessão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Cards de configuração */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <span className="text-xs text-purple-400 block mb-1">Temperamento</span>
                        <span className="text-white">{selectedSession.config.temperament}</span>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <span className="text-xs text-blue-400 block mb-1">Idade</span>
                        <span className="text-white">{selectedSession.config.age} anos</span>
                      </div>
                      <div className="bg-gray-800/50 rounded-lg p-3 sm:col-span-1">
                        <span className="text-xs text-amber-400 block mb-1">Persona</span>
                        <span className="text-white text-sm leading-snug">{selectedSession.config.segment}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabs de navegação */}
                  <div className="flex gap-1 bg-gray-900/50 rounded-xl border border-gray-800 p-1">
                    {['resumo', 'spin', 'transcricao'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as typeof activeTab)}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                          activeTab === tab
                            ? 'bg-green-500/20 text-green-400'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        {tab === 'resumo' && 'Resumo'}
                        {tab === 'spin' && 'Análise SPIN'}
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
                          <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
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
                          <div className={`rounded-xl border p-6 text-center ${getScoreBg(score || 0)}`}>
                            <div className={`text-5xl font-bold mb-1 ${getScoreColor(score || 0)}`}>
                              {score?.toFixed(1) || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-400">
                              {evaluation.performance_level && getPerformanceLabel(evaluation.performance_level)}
                            </div>
                          </div>

                          {/* Resumo executivo */}
                          {evaluation.executive_summary && (
                            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                              <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                                Resumo Executivo
                              </h4>
                              <p className="text-gray-300 text-sm leading-relaxed">
                                {evaluation.executive_summary}
                              </p>
                            </div>
                          )}

                          {/* Grid de insights */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Pontos fortes */}
                            {evaluation.top_strengths?.length > 0 && (
                              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                                <h4 className="flex items-center gap-2 text-sm font-medium text-green-400 mb-3">
                                  <TrendingUp className="w-4 h-4" />
                                  Pontos Fortes
                                </h4>
                                <ul className="space-y-2">
                                  {evaluation.top_strengths.map((strength: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                      <span className="text-green-400 mt-0.5">•</span>
                                      {strength}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Gaps críticos */}
                            {evaluation.critical_gaps?.length > 0 && (
                              <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                                <h4 className="flex items-center gap-2 text-sm font-medium text-red-400 mb-3">
                                  <AlertTriangle className="w-4 h-4" />
                                  Pontos a Melhorar
                                </h4>
                                <ul className="space-y-2">
                                  {evaluation.critical_gaps.map((gap: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                      <span className="text-red-400 mt-0.5">•</span>
                                      {gap}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Prioridades de melhoria */}
                          {evaluation.priority_improvements?.length > 0 && (
                            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                              <h4 className="flex items-center gap-2 text-sm font-medium text-yellow-400 mb-3">
                                <Lightbulb className="w-4 h-4" />
                                Prioridades de Melhoria
                              </h4>
                              <div className="space-y-3">
                                {evaluation.priority_improvements.map((imp: any, i: number) => (
                                  <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        imp.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                        imp.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                        'bg-yellow-500/20 text-yellow-400'
                                      }`}>
                                        {imp.priority === 'critical' ? 'Crítico' :
                                         imp.priority === 'high' ? 'Alta' : 'Média'}
                                      </span>
                                      <span className="text-sm font-medium text-white">{imp.area}</span>
                                    </div>
                                    <p className="text-xs text-gray-400">{imp.action_plan}</p>
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
                          <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-8 text-center">
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
                              { key: 'S', label: 'Situação', color: 'text-blue-400' },
                              { key: 'P', label: 'Problema', color: 'text-purple-400' },
                              { key: 'I', label: 'Implicação', color: 'text-orange-400' },
                              { key: 'N', label: 'Necessidade', color: 'text-green-400' }
                            ].map(({ key, label, color }) => {
                              const score = spin[key]?.final_score || 0
                              return (
                                <div key={key} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 text-center">
                                  <div className={`text-3xl font-bold mb-1 ${color}`}>
                                    {score.toFixed(1)}
                                  </div>
                                  <div className="text-xs text-gray-500 uppercase tracking-wider">
                                    {label}
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Média SPIN */}
                          <div className="bg-green-500/10 rounded-xl border border-green-500/20 p-4 text-center">
                            <div className="text-2xl font-bold text-green-400 mb-1">
                              {(
                                ((spin.S?.final_score || 0) +
                                (spin.P?.final_score || 0) +
                                (spin.I?.final_score || 0) +
                                (spin.N?.final_score || 0)) / 4
                              ).toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-400 uppercase tracking-wider">
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

                            return (
                              <details key={letter} className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden group">
                                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold text-green-400">
                                      {letter}
                                    </span>
                                    <span className="font-medium text-white">{labels[letter]}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg font-bold text-white">
                                      {data.final_score?.toFixed(1)}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
                                  </div>
                                </summary>
                                <div className="p-4 pt-0 space-y-3">
                                  {/* Feedback */}
                                  {data.technical_feedback && (
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                      {data.technical_feedback}
                                    </p>
                                  )}

                                  {/* Indicadores */}
                                  {data.indicators && Object.keys(data.indicators).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(data.indicators).map(([key, value]: [string, any]) => {
                                        const score = typeof value === 'number' ? value : 0
                                        const getIndicatorStyle = (s: number) => {
                                          if (s >= 8) return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-300'
                                          if (s >= 6) return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-300'
                                          return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/30 text-red-300'
                                        }
                                        const getScoreStyle = (s: number) => {
                                          if (s >= 8) return 'text-green-400 font-semibold'
                                          if (s >= 6) return 'text-yellow-400 font-semibold'
                                          return 'text-red-400 font-semibold'
                                        }
                                        return (
                                          <span
                                            key={key}
                                            className={`text-xs px-3 py-1.5 rounded-lg border backdrop-blur-sm transition-all hover:scale-105 ${getIndicatorStyle(score)}`}
                                          >
                                            {translateIndicator(key)}: <span className={getScoreStyle(score)}>{value}/10</span>
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}

                                  {/* Oportunidades perdidas */}
                                  {data.missed_opportunities?.length > 0 && (
                                    <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                                      <p className="text-xs font-medium text-orange-400 mb-2">Oportunidades Perdidas</p>
                                      <ul className="space-y-1">
                                        {data.missed_opportunities.map((opp: string, i: number) => (
                                          <li key={i} className="text-xs text-orange-300">• {opp}</li>
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
                            <details className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden group">
                              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                                    <Target className="w-4 h-4 text-green-400" />
                                  </span>
                                  <span className="font-medium text-white">Análise de Objeções</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-gray-400">
                                    {evaluation.objections_analysis.length} objeções
                                  </span>
                                  <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
                                </div>
                              </summary>
                              <div className="p-4 pt-0 space-y-3">
                                {evaluation.objections_analysis.map((obj: any, idx: number) => (
                                  <div key={idx} className="bg-gray-800/50 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                                        {obj.objection_type}
                                      </span>
                                      <span className={`text-sm font-bold ${getScoreColor(obj.score)}`}>
                                        {obj.score}/10
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-300 italic mb-2">
                                      "{obj.objection_text}"
                                    </p>
                                    {obj.detailed_analysis && (
                                      <p className="text-xs text-gray-400">{obj.detailed_analysis}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      )
                    }

                    if (activeTab === 'transcricao') {
                      return (
                        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                          <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                            {selectedSession.messages.length} mensagens
                          </h4>
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                            {selectedSession.messages.map((msg, index) => (
                              <div
                                key={index}
                                className={`flex gap-3 ${msg.role === 'seller' ? 'flex-row-reverse' : ''}`}
                              >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  msg.role === 'client'
                                    ? 'bg-gray-800'
                                    : 'bg-green-500/20'
                                }`}>
                                  <User className={`w-4 h-4 ${
                                    msg.role === 'client' ? 'text-gray-400' : 'text-green-400'
                                  }`} />
                                </div>
                                <div className={`flex-1 max-w-[80%] ${msg.role === 'seller' ? 'text-right' : ''}`}>
                                  <div className="text-xs text-gray-500 mb-1">
                                    {msg.role === 'client' ? 'Cliente' : 'Você'} • {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                  <div className={`inline-block p-3 rounded-xl text-sm ${
                                    msg.role === 'client'
                                      ? 'bg-gray-800 text-gray-300 rounded-tl-none'
                                      : 'bg-green-500/20 text-green-100 rounded-tr-none'
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
