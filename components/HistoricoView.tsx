'use client'

import { useState, useEffect } from 'react'
import { Clock, User, MessageCircle, Calendar, ChevronRight, Trash2, Eye, Download, Filter } from 'lucide-react'
import { getUserRoleplaySessions, deleteRoleplaySession, type RoleplaySession } from '@/lib/roleplay'

export default function HistoricoView() {
  const [sessions, setSessions] = useState<RoleplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null)
  const [mounted, setMounted] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'in_progress' | 'abandoned'>('all')

  useEffect(() => {
    setMounted(true)
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    const data = await getUserRoleplaySessions(50) // Carregar últimas 50 sessões
    setSessions(data)
    setLoading(false)
  }

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return

    const success = await deleteRoleplaySession(sessionId)
    if (success) {
      setSessions(sessions.filter(s => s.id !== sessionId))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null)
      }
      alert('Sessão excluída com sucesso!')
    } else {
      alert('Erro ao excluir sessão')
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}min ${secs}s`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      completed: { text: 'Concluído', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      in_progress: { text: 'Em andamento', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      abandoned: { text: 'Abandonado', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
    }
    const badge = badges[status as keyof typeof badges] || badges.completed
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const filteredSessions = filterStatus === 'all'
    ? sessions
    : sessions.filter(s => s.status === filterStatus)

  // Processar evaluation antes de usar
  const getProcessedEvaluation = (session: RoleplaySession) => {
    let evaluation = (session as any).evaluation

    // Se evaluation tem estrutura N8N {output: "..."}, fazer parse
    if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
      console.log('🔄 Parseando evaluation do histórico...')
      try {
        evaluation = JSON.parse(evaluation.output)
      } catch (e) {
        console.error('❌ Erro ao parsear evaluation:', e)
        return null
      }
    }

    return evaluation
  }


  return (
    <div className="min-h-screen py-20 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-12 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            Histórico de Roleplays
          </h1>
          <p className="text-xl text-gray-400">
            Revise suas sessões de treinamento e acompanhe sua evolução.
          </p>
        </div>

        {/* Filtros e Resumo */}
        <div className={`mb-8 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
          <div className="flex flex-wrap gap-3 justify-center items-center">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                filterStatus === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                  : 'bg-gray-800/50 text-gray-400 border border-purple-500/20 hover:border-purple-500/40'
              }`}
            >
              Todas ({sessions.length})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                filterStatus === 'completed'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                  : 'bg-gray-800/50 text-gray-400 border border-purple-500/20 hover:border-purple-500/40'
              }`}
            >
              Concluídas ({sessions.filter(s => s.status === 'completed').length})
            </button>
            <button
              onClick={() => setFilterStatus('in_progress')}
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                filterStatus === 'in_progress'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                  : 'bg-gray-800/50 text-gray-400 border border-purple-500/20 hover:border-purple-500/40'
              }`}
            >
              Em andamento ({sessions.filter(s => s.status === 'in_progress').length})
            </button>

          </div>
        </div>

        {/* Grid de Sessões vs Detalhes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Lista de Sessões */}
          <div className={`${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '100ms' }}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent rounded-3xl blur-xl"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/30">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <MessageCircle className="w-6 h-6 text-purple-400" />
                  Sessões ({filteredSessions.length})
                </h2>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400">Carregando sessões...</p>
                    </div>
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Nenhuma sessão encontrada</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Comece um roleplay para ver seu histórico aqui
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {filteredSessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`w-full text-left p-4 rounded-xl transition-all ${
                          selectedSession?.id === session.id
                            ? 'bg-purple-600/20 border-2 border-purple-500/60'
                            : 'bg-gray-800/50 border-2 border-purple-500/20 hover:border-purple-500/40'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusBadge(session.status)}
                              <span className="text-xs text-gray-500">
                                {session.messages.length} mensagens
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {formatDate(session.created_at)}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          Duração: {formatDuration(session.duration_seconds)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detalhes da Sessão */}
          <div className={`${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '200ms' }}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent rounded-3xl blur-xl"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/30 min-h-[600px]">
                {!selectedSession ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Eye className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Selecione uma sessão para ver os detalhes</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Header da Sessão */}
                    <div className="flex items-start justify-between pb-4 border-b border-purple-500/20">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Detalhes da Sessão</h3>
                        {getStatusBadge(selectedSession.status)}
                      </div>
                      <button
                        onClick={() => handleDelete(selectedSession.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Excluir sessão"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Configurações */}
                    <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
                      <h4 className="font-semibold mb-3 text-purple-400">Configurações</h4>
                      <p className="text-sm text-gray-300">
                        <span className="text-gray-500">Idade:</span> {selectedSession.config.age} anos
                      </p>
                      <p className="text-sm text-gray-300">
                        <span className="text-gray-500">Temperamento:</span> {selectedSession.config.temperament}
                      </p>
                      <p className="text-sm text-gray-300">
                        <span className="text-gray-500">Persona:</span> {selectedSession.config.segment}
                      </p>
                      {selectedSession.config.objections.length > 0 && (
                        <div className="text-sm text-gray-300">
                          <span className="text-gray-500">Objeções:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedSession.config.objections.map((obj, i) => (
                              <span key={i} className="px-2 py-1 bg-purple-500/20 rounded text-xs">
                                {typeof obj === 'string' ? obj : obj.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Avaliação de Performance */}
                    {(() => {
                      const evaluation = selectedSession ? getProcessedEvaluation(selectedSession) : null
                      if (!evaluation) return null

                      return (
                        <div className="mb-6">
                          <h4 className="font-semibold mb-3 text-purple-400 text-lg">
                            📊 Avaliação de Performance
                          </h4>

                          {/* Score Geral */}
                          <div className="bg-gradient-to-br from-purple-600/20 to-purple-400/10 border border-purple-500/30 rounded-xl p-4 text-center mb-4">
                            <div className="text-4xl font-bold text-white mb-1">
                              {evaluation.overall_score !== undefined && evaluation.overall_score !== null
                                ? `${(evaluation.overall_score / 10).toFixed(1)}/10`
                                : 'N/A'}
                            </div>
                            <div className="text-sm text-purple-300 uppercase tracking-wider">
                              {evaluation.performance_level === 'legendary' && '🏆 Lendário'}
                              {evaluation.performance_level === 'excellent' && '⭐ Excelente'}
                              {evaluation.performance_level === 'very_good' && '✨ Muito Bom'}
                              {evaluation.performance_level === 'good' && '👍 Bom'}
                              {evaluation.performance_level === 'needs_improvement' && '📈 Precisa Melhorar'}
                              {evaluation.performance_level === 'poor' && '📚 Em Desenvolvimento'}
                            </div>
                          </div>

                          {/* Resumo Executivo */}
                          {evaluation.executive_summary && (
                            <div className="bg-gray-800/30 border border-purple-500/20 rounded-xl p-4 mb-4">
                              <h5 className="font-semibold text-white mb-2">Resumo Executivo</h5>
                              <p className="text-sm text-gray-300 leading-relaxed">
                                {evaluation.executive_summary}
                              </p>
                            </div>
                          )}

                          {/* Avaliação SPIN com Gráfico Radar */}
                          {evaluation.spin_evaluation && (
                            <div className="bg-gradient-to-br from-gray-800/50 to-purple-900/20 border border-purple-500/30 rounded-2xl p-6 mb-4 shadow-lg shadow-purple-500/10">
                              <h5 className="font-bold text-white mb-6 text-center text-xl">Metodologia SPIN</h5>

                              {/* Radar Chart - Diamond Shape */}
                              <div className="relative w-full aspect-square max-w-md mx-auto mb-6">
                                <svg viewBox="0 0 240 240" className="w-full h-full drop-shadow-2xl">
                                  {/* Background diamonds (losangos) - 10 níveis */}
                                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => {
                                    const size = level * 8; // Cada nível representa 8 pixels
                                    return (
                                      <polygon
                                        key={level}
                                        points={`120,${120-size} ${120+size},120 120,${120+size} ${120-size},120`}
                                        fill="none"
                                        stroke={level % 2 === 0 ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.08)"}
                                        strokeWidth="1"
                                      />
                                    );
                                  })}

                                  {/* Diagonal lines connecting opposite vertices (forming X inside diamond) */}
                                  <line x1="120" y1="40" x2="120" y2="200" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="0.5" />
                                  <line x1="40" y1="120" x2="200" y2="120" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="0.5" />

                                  {/* Data polygon */}
                                  {(() => {
                                    const S = evaluation.spin_evaluation.S?.final_score || 0
                                    const P = evaluation.spin_evaluation.P?.final_score || 0
                                    const I = evaluation.spin_evaluation.I?.final_score || 0
                                    const N = evaluation.spin_evaluation.N?.final_score || 0

                                    // Calculate positions for diamond (4 vertices)
                                    const sY = 120 - (S * 8)  // Top (S)
                                    const pX = 120 + (P * 8)  // Right (P)
                                    const iY = 120 + (I * 8)  // Bottom (I)
                                    const nX = 120 - (N * 8)  // Left (N)

                                    return (
                                      <>
                                        {/* Glow effect behind polygon */}
                                        <polygon
                                          points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
                                          fill="rgba(168, 85, 247, 0.2)"
                                          stroke="rgb(168, 85, 247)"
                                          strokeWidth="3"
                                          filter="url(#glow)"
                                        />
                                        <polygon
                                          points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
                                          fill="rgba(168, 85, 247, 0.4)"
                                          stroke="rgb(168, 85, 247)"
                                          strokeWidth="2"
                                        />
                                        {/* Data points with glow */}
                                        <circle cx="120" cy={sY} r="6" fill="rgb(168, 85, 247)" opacity="0.5" />
                                        <circle cx="120" cy={sY} r="4" fill="rgb(255, 255, 255)" />

                                        <circle cx={pX} cy="120" r="6" fill="rgb(168, 85, 247)" opacity="0.5" />
                                        <circle cx={pX} cy="120" r="4" fill="rgb(255, 255, 255)" />

                                        <circle cx="120" cy={iY} r="6" fill="rgb(168, 85, 247)" opacity="0.5" />
                                        <circle cx="120" cy={iY} r="4" fill="rgb(255, 255, 255)" />

                                        <circle cx={nX} cy="120" r="6" fill="rgb(168, 85, 247)" opacity="0.5" />
                                        <circle cx={nX} cy="120" r="4" fill="rgb(255, 255, 255)" />
                                      </>
                                    )
                                  })()}

                                  {/* Labels with background */}
                                  <g>
                                    <rect x="105" y="20" width="30" height="20" rx="4" fill="rgba(139, 92, 246, 0.3)" />
                                    <text x="120" y="33" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">S</text>
                                  </g>
                                  <g>
                                    <rect x="200" y="110" width="30" height="20" rx="4" fill="rgba(139, 92, 246, 0.3)" />
                                    <text x="215" y="123" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">P</text>
                                  </g>
                                  <g>
                                    <rect x="105" y="200" width="30" height="20" rx="4" fill="rgba(139, 92, 246, 0.3)" />
                                    <text x="120" y="213" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">I</text>
                                  </g>
                                  <g>
                                    <rect x="10" y="110" width="30" height="20" rx="4" fill="rgba(139, 92, 246, 0.3)" />
                                    <text x="25" y="123" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">N</text>
                                  </g>
                                </svg>
                              </div>

                              {/* SPIN Scores Grid - Destacado */}
                              <div className="grid grid-cols-4 gap-3 mb-4">
                                <div className="text-center bg-gradient-to-br from-purple-600/20 to-purple-400/10 rounded-lg p-3 border border-purple-500/20">
                                  <div className="text-xs text-purple-300 mb-1 font-semibold">Situação</div>
                                  <div className="text-2xl font-bold text-white">{evaluation.spin_evaluation.S?.final_score?.toFixed(1) || '0'}</div>
                                </div>
                                <div className="text-center bg-gradient-to-br from-purple-600/20 to-purple-400/10 rounded-lg p-3 border border-purple-500/20">
                                  <div className="text-xs text-purple-300 mb-1 font-semibold">Problema</div>
                                  <div className="text-2xl font-bold text-white">{evaluation.spin_evaluation.P?.final_score?.toFixed(1) || '0'}</div>
                                </div>
                                <div className="text-center bg-gradient-to-br from-purple-600/20 to-purple-400/10 rounded-lg p-3 border border-purple-500/20">
                                  <div className="text-xs text-purple-300 mb-1 font-semibold">Implicação</div>
                                  <div className="text-2xl font-bold text-white">{evaluation.spin_evaluation.I?.final_score?.toFixed(1) || '0'}</div>
                                </div>
                                <div className="text-center bg-gradient-to-br from-purple-600/20 to-purple-400/10 rounded-lg p-3 border border-purple-500/20">
                                  <div className="text-xs text-purple-300 mb-1 font-semibold">Necessidade</div>
                                  <div className="text-2xl font-bold text-white">{evaluation.spin_evaluation.N?.final_score?.toFixed(1) || '0'}</div>
                                </div>
                              </div>

                              {/* Média Geral SPIN */}
                              <div className="mt-4 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl px-6 py-4 text-center shadow-lg">
                                <div className="text-sm text-purple-100 mb-1 font-semibold">Média Geral SPIN</div>
                                <div className="text-3xl font-bold text-white">
                                  {(() => {
                                    const avg = (
                                      (evaluation.spin_evaluation.S?.final_score || 0) +
                                      (evaluation.spin_evaluation.P?.final_score || 0) +
                                      (evaluation.spin_evaluation.I?.final_score || 0) +
                                      (evaluation.spin_evaluation.N?.final_score || 0)
                                    ) / 4;
                                    return avg.toFixed(1);
                                  })()}/10
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Feedback Detalhado SPIN */}
                        {evaluation.spin_evaluation && (
                          <details className="bg-gray-800/30 border border-purple-500/20 rounded-xl p-4 mb-4">
                            <summary className="font-semibold text-white cursor-pointer hover:text-purple-400 transition-colors">
                              Análise Detalhada SPIN
                            </summary>
                            <div className="mt-4 space-y-6">
                              {['S', 'P', 'I', 'N'].map((letter) => {
                                const spinData = evaluation.spin_evaluation[letter]
                                if (!spinData) return null

                                const letterNames: any = {
                                  'S': 'Situação',
                                  'P': 'Problema',
                                  'I': 'Implicação',
                                  'N': 'Necessidade'
                                }

                                return (
                                  <div key={letter} className="bg-gray-900/50 rounded-lg p-4 border border-purple-500/10">
                                    {/* Header com nome e score */}
                                    <div className="flex items-center justify-between mb-3">
                                      <h6 className="font-semibold text-purple-400">
                                        {letterNames[letter]} ({letter})
                                      </h6>
                                      <span className="text-xl font-bold text-white">
                                        {spinData.final_score?.toFixed(1)}
                                      </span>
                                    </div>

                                    {/* Indicadores detalhados */}
                                    {spinData.indicators && Object.keys(spinData.indicators).length > 0 && (
                                      <div className="grid grid-cols-2 gap-2 mb-3">
                                        {Object.entries(spinData.indicators).map(([key, value]: [string, any]) => (
                                          <div key={key} className="bg-gray-800/50 rounded px-2 py-1">
                                            <span className="text-xs text-gray-400">
                                              {key.replace(/_/g, ' ').replace('score', '')}:
                                            </span>
                                            <span className="text-xs font-semibold text-gray-300 ml-1">
                                              {value}/10
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Feedback técnico */}
                                    <div className="mb-3">
                                      <p className="text-sm text-gray-300 leading-relaxed">
                                        {spinData.technical_feedback}
                                      </p>
                                    </div>

                                    {/* Oportunidades perdidas */}
                                    {spinData.missed_opportunities?.length > 0 && (
                                      <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2">
                                        <h6 className="text-xs font-semibold text-orange-400 mb-1">
                                          Oportunidades Perdidas:
                                        </h6>
                                        <ul className="space-y-1">
                                          {spinData.missed_opportunities.map((opp: string, i: number) => (
                                            <li key={i} className="text-xs text-orange-300 flex items-start">
                                              <span className="text-orange-400 mr-1">•</span>
                                              <span>{opp}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </details>
                        )}

                        {/* Análise de Objeções */}
                        {evaluation.objections_analysis?.length > 0 && (
                          <details className="bg-gray-800/30 border border-purple-500/20 rounded-xl p-4 mb-4">
                            <summary className="font-semibold text-white cursor-pointer hover:text-purple-400 transition-colors">
                              Análise Detalhada de Objeções ({evaluation.objections_analysis.length})
                            </summary>
                            <div className="mt-4 space-y-4">
                              {evaluation.objections_analysis.map((obj: any, idx: number) => (
                                <div key={idx} className="bg-gray-900/50 rounded-lg p-4 border border-purple-500/10">
                                  {/* Header com tipo e score */}
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold text-purple-400 uppercase bg-purple-500/10 px-2 py-1 rounded">
                                      {obj.objection_type}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-2xl font-bold text-white">{obj.score}</span>
                                      <span className="text-gray-400">/10</span>
                                    </div>
                                  </div>

                                  {/* Texto da objeção */}
                                  <div className="bg-gray-800/50 rounded-lg p-3 mb-3 border-l-2 border-purple-500/30">
                                    <p className="text-sm text-gray-300 italic">
                                      <span className="text-purple-400 mr-1">Cliente:</span>
                                      "{obj.objection_text}"
                                    </p>
                                  </div>

                                  {/* Análise detalhada */}
                                  <div className="mb-3">
                                    <h6 className="text-xs font-semibold text-gray-400 uppercase mb-1">Análise</h6>
                                    <p className="text-sm text-gray-300 leading-relaxed">{obj.detailed_analysis}</p>
                                  </div>

                                  {/* Erros críticos */}
                                  {obj.critical_errors?.length > 0 && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
                                      <h6 className="text-xs font-semibold text-red-400 uppercase mb-2">⚠️ Erros Críticos</h6>
                                      <ul className="space-y-1">
                                        {obj.critical_errors.map((error: string, i: number) => (
                                          <li key={i} className="text-sm text-red-300 flex items-start">
                                            <span className="text-red-400 mr-2">•</span>
                                            <span>{error}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Resposta ideal */}
                                  {obj.ideal_response && (
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                      <h6 className="text-xs font-semibold text-green-400 uppercase mb-2">✅ Resposta Ideal</h6>
                                      <p className="text-sm text-green-300 italic leading-relaxed">"{obj.ideal_response}"</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}

                        {/* Plano de Melhorias */}
                        {evaluation.priority_improvements?.length > 0 && (
                          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                            <h5 className="font-semibold text-orange-400 mb-3">🎯 Prioridades de Melhoria</h5>
                            <div className="space-y-3">
                              {evaluation.priority_improvements.map((imp: any, idx: number) => (
                                <div key={idx} className="bg-gray-900/50 rounded-lg p-3">
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                      imp.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                      imp.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                      'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                      {imp.priority.toUpperCase()}
                                    </span>
                                    <span className="text-sm font-semibold text-white">{imp.area}</span>
                                  </div>
                                  <p className="text-xs text-gray-400 mb-2">{imp.current_gap}</p>
                                  <p className="text-xs text-gray-300">{imp.action_plan}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        </div>
                      )
                    })()}

                    {/* Transcrição */}
                    <div>
                      <h4 className="font-semibold mb-3 text-purple-400">
                        Transcrição ({selectedSession.messages.length} mensagens)
                      </h4>
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                        {selectedSession.messages.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex gap-3 ${msg.role === 'seller' ? 'justify-end' : ''}`}
                          >
                            {msg.role === 'client' && (
                              <div className="w-8 h-8 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-purple-400" />
                              </div>
                            )}
                            <div className={`flex-1 ${msg.role === 'seller' ? 'flex flex-col items-end' : ''}`}>
                              <div className="text-xs text-gray-500 mb-1">
                                {msg.role === 'client' ? 'Cliente (IA)' : 'Você'}
                              </div>
                              <div
                                className={`${
                                  msg.role === 'client'
                                    ? 'bg-gray-800/50 rounded-2xl rounded-tl-none'
                                    : 'bg-purple-600/20 rounded-2xl rounded-tr-none max-w-md'
                                } p-3 text-sm text-gray-300`}
                              >
                                {msg.text}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
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
          </div>
        </div>
      </div>
    </div>
  )
}
