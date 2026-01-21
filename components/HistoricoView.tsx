'use client'

import { useState, useEffect } from 'react'
import { Clock, User, MessageCircle, Calendar, ChevronRight, Trash2, Eye, Download, Settings, BarChart3, FileText, Target } from 'lucide-react'
import { getUserRoleplaySessions, deleteRoleplaySession, type RoleplaySession } from '@/lib/roleplay'

export default function HistoricoView() {
  const [sessions, setSessions] = useState<RoleplaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<RoleplaySession | null>(null)
  const [mounted, setMounted] = useState(false)

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

  const filteredSessions = sessions

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
        {/* Header - Design Futurista */}
        <div className={`text-center mb-12 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
            Histórico de Roleplays
          </h1>
          <p className="text-xl text-gray-400">
            Revise suas sessões de treinamento e acompanhe sua evolução.
          </p>
        </div>


        {/* Grid de Sessões vs Detalhes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Lista de Sessões */}
          <div className={`${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '100ms' }}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl blur-2xl"></div>
              <div className="relative bg-gradient-to-br from-gray-900/70 to-gray-800/50 backdrop-blur-xl rounded-3xl p-6 border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                    <MessageCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">
                    Sessões <span className="text-green-400">({filteredSessions.length})</span>
                  </h2>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin shadow-[0_0_20px_rgba(34,197,94,0.3)]"></div>
                      <p className="text-gray-300 font-medium">Carregando sessões...</p>
                    </div>
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gradient-to-br from-gray-700/20 to-gray-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-600/30">
                      <MessageCircle className="w-10 h-10 text-gray-500" />
                    </div>
                    <p className="text-gray-300 text-lg font-semibold mb-2">Nenhuma sessão encontrada</p>
                    <p className="text-sm text-gray-500">
                      Comece um roleplay para ver seu histórico aqui
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredSessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={`relative w-full text-left p-5 rounded-2xl transition-all duration-300 group overflow-hidden ${
                          selectedSession?.id === session.id
                            ? 'bg-gradient-to-r from-green-600/30 to-emerald-600/20 border-2 border-green-400/60 shadow-[0_0_30px_rgba(34,197,94,0.3)] scale-[1.02]'
                            : 'bg-gradient-to-br from-gray-800/40 to-gray-900/30 border border-green-500/20 hover:border-green-400/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)] hover:-translate-y-1'
                        }`}
                      >
                        {/* Glow effect */}
                        <div className={`absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl ${
                          selectedSession?.id === session.id ? 'opacity-100' : ''
                        }`}></div>

                        <div className="relative flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                                selectedSession?.id === session.id
                                  ? 'bg-gradient-to-br from-green-500/40 to-emerald-500/30 border-green-400/40 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                                  : 'bg-gradient-to-br from-green-500/15 to-emerald-500/10 border-green-500/20 group-hover:from-green-500/25 group-hover:to-emerald-500/15 group-hover:border-green-400/30'
                              }`}>
                                <MessageCircle className={`w-6 h-6 transition-colors ${
                                  selectedSession?.id === session.id ? 'text-green-300 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'text-green-400'
                                }`} />
                              </div>
                              <div>
                                <p className={`font-bold text-base transition-colors ${
                                  selectedSession?.id === session.id ? 'text-white' : 'text-gray-200 group-hover:text-white'
                                }`}>
                                  {session.messages.length} mensagens
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {formatDuration(session.duration_seconds) !== 'N/A'
                                    ? `⏱️ ${formatDuration(session.duration_seconds)}`
                                    : '📝 Sessão de treino'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm ml-[60px]">
                              <Calendar className={`w-4 h-4 ${
                                selectedSession?.id === session.id ? 'text-green-400' : 'text-green-500/50'
                              }`} />
                              <span className={`${
                                selectedSession?.id === session.id ? 'text-gray-200' : 'text-gray-400'
                              }`}>
                                {formatDate(session.created_at)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className={`w-5 h-5 transition-all duration-300 flex-shrink-0 ${
                            selectedSession?.id === session.id
                              ? 'text-green-300 translate-x-1 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]'
                              : 'text-gray-500 group-hover:text-green-400 group-hover:translate-x-1'
                          }`} />
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
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-3xl blur-2xl"></div>
              <div className="relative bg-gradient-to-br from-gray-900/70 to-gray-800/50 backdrop-blur-xl rounded-3xl p-6 border border-green-500/30 min-h-[600px] shadow-[0_0_40px_rgba(34,197,94,0.15)]">
                {!selectedSession ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-gray-700/20 to-gray-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-600/30">
                        <Eye className="w-12 h-12 text-gray-500" />
                      </div>
                      <p className="text-gray-300 text-lg font-semibold">Selecione uma sessão para ver os detalhes</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Header da Sessão */}
                    <div className="flex items-start justify-between pb-4 border-b border-green-500/30">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                          <Eye className="w-5 h-5 text-green-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white">Detalhes da Sessão</h3>
                      </div>
                      <button
                        onClick={() => handleDelete(selectedSession.id)}
                        className="group p-2.5 text-red-400 hover:bg-red-500/15 rounded-xl transition-all border border-red-500/20 hover:border-red-500/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                        title="Excluir sessão"
                      >
                        <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>

                    {/* Configurações */}
                    <div className="relative bg-gradient-to-br from-gray-800/40 to-gray-900/30 rounded-xl p-5 border border-green-500/20 shadow-lg">
                      <div className="flex items-center gap-2 mb-4">
                        <Settings className="w-5 h-5 text-green-400" />
                        <h4 className="font-bold text-white">Configurações</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-400 min-w-[100px]">Idade:</span>
                          <span className="text-sm font-medium text-gray-200">{selectedSession.config.age} anos</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-400 min-w-[100px]">Temperamento:</span>
                          <span className="text-sm font-medium text-gray-200">{selectedSession.config.temperament}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-400 min-w-[100px]">Persona:</span>
                          <span className="text-sm font-medium text-gray-200">{selectedSession.config.segment}</span>
                        </div>
                        {selectedSession.config.objections && selectedSession.config.objections.length > 0 && (
                          <div>
                            <span className="text-sm text-gray-400 block mb-2">Objeções:</span>
                            <div className="flex flex-wrap gap-2">
                              {selectedSession.config.objections.map((obj: string | { name: string }, i: number) => (
                                <span key={i} className="px-3 py-1.5 bg-gradient-to-r from-green-600/30 to-emerald-600/20 text-green-300 rounded-lg text-xs font-medium border border-green-500/30">
                                  {typeof obj === 'string' ? obj : obj.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Avaliação de Performance */}
                    {(() => {
                      const evaluation = selectedSession ? getProcessedEvaluation(selectedSession) : null
                      if (!evaluation) return null

                      return (
                        <div className="mb-6">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                              <BarChart3 className="w-5 h-5 text-green-400" />
                            </div>
                            <h4 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                              Avaliação de Performance
                            </h4>
                          </div>

                          {/* Score Geral */}
                          <div className="relative group mb-6">
                            <div className="absolute inset-0 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
                            <div className="relative bg-gradient-to-br from-green-600/20 to-green-400/10 border border-green-500/40 rounded-2xl p-6 text-center shadow-lg">
                              <div className="text-6xl font-bold bg-gradient-to-br from-green-400 via-emerald-300 to-green-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,197,94,0.5)] mb-2">
                                {evaluation.overall_score !== undefined && evaluation.overall_score !== null
                                  ? `${(evaluation.overall_score / 10).toFixed(1)}`
                                  : 'N/A'}
                              </div>
                              <div className="text-sm text-green-300 uppercase tracking-wider font-bold">
                                {evaluation.performance_level === 'legendary' && '🏆 Lendário'}
                                {evaluation.performance_level === 'excellent' && '⭐ Excelente'}
                                {evaluation.performance_level === 'very_good' && '✨ Muito Bom'}
                                {evaluation.performance_level === 'good' && '👍 Bom'}
                                {evaluation.performance_level === 'needs_improvement' && '📈 Precisa Melhorar'}
                                {evaluation.performance_level === 'poor' && '📚 Em Desenvolvimento'}
                              </div>
                            </div>
                          </div>

                          {/* Resumo Executivo */}
                          {evaluation.executive_summary && (
                            <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/30 border border-green-500/20 rounded-xl p-5 mb-4 shadow-lg">
                              <h5 className="font-bold text-white mb-3 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-green-400" />
                                Resumo Executivo
                              </h5>
                              <p className="text-sm text-gray-300 leading-relaxed">
                                {evaluation.executive_summary}
                              </p>
                            </div>
                          )}

                          {/* Avaliação SPIN com Gráfico Radar */}
                          {evaluation.spin_evaluation && (
                            <div className="relative bg-gradient-to-br from-gray-800/40 to-gray-900/30 border border-green-500/30 rounded-2xl p-6 mb-4 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                              {/* Grid futurista no fundo */}
                              <div className="absolute inset-0 opacity-5 rounded-2xl overflow-hidden">
                                <div className="absolute inset-0" style={{
                                  backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(34, 197, 94, .15) 25%, rgba(34, 197, 94, .15) 26%, transparent 27%, transparent 74%, rgba(34, 197, 94, .15) 75%, rgba(34, 197, 94, .15) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(34, 197, 94, .15) 25%, rgba(34, 197, 94, .15) 26%, transparent 27%, transparent 74%, rgba(34, 197, 94, .15) 75%, rgba(34, 197, 94, .15) 76%, transparent 77%, transparent)',
                                  backgroundSize: '30px 30px'
                                }}></div>
                              </div>

                              <div className="relative flex items-center justify-center gap-3 mb-8">
                                <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                                  <Target className="w-5 h-5 text-green-400" />
                                </div>
                                <h5 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                                  Metodologia SPIN
                                </h5>
                              </div>

                              {/* Radar Chart - Diamond Shape */}
                              <div className="relative w-full aspect-square max-w-md mx-auto mb-6">
                                <svg viewBox="0 0 240 240" className="w-full h-full drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                                  {/* Filtro de glow verde */}
                                  <defs>
                                    <filter id="greenGlow" x="-50%" y="-50%" width="200%" height="200%">
                                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                                      <feMerge>
                                        <feMergeNode in="coloredBlur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                      </feMerge>
                                    </filter>
                                  </defs>

                                  {/* Background diamonds (losangos) - 10 níveis */}
                                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => {
                                    const size = level * 8;
                                    return (
                                      <polygon
                                        key={level}
                                        points={`120,${120-size} ${120+size},120 120,${120+size} ${120-size},120`}
                                        fill="none"
                                        stroke={level % 2 === 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.08)"}
                                        strokeWidth="0.5"
                                      />
                                    );
                                  })}

                                  {/* Diagonal lines - verde tech */}
                                  <line x1="120" y1="40" x2="120" y2="200" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />
                                  <line x1="40" y1="120" x2="200" y2="120" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="0.5" />

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
                                        {/* Glow effect verde */}
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
                                        {/* Data points com efeito tech */}
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
                                      </>
                                    )
                                  })()}

                                  {/* Labels tech com borda verde */}
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
                              </div>

                              {/* SPIN Scores Grid - Destacado */}
                              <div className="grid grid-cols-4 gap-3 mb-4">
                                <div className="text-center bg-gradient-to-br from-green-600/20 to-green-400/10 rounded-lg p-3 border border-green-500/20">
                                  <div className="text-xs text-green-300 mb-1 font-semibold">Situação</div>
                                  <div className="text-2xl font-bold text-white">{evaluation.spin_evaluation.S?.final_score?.toFixed(1) || '0'}</div>
                                </div>
                                <div className="text-center bg-gradient-to-br from-green-600/20 to-green-400/10 rounded-lg p-3 border border-green-500/20">
                                  <div className="text-xs text-green-300 mb-1 font-semibold">Problema</div>
                                  <div className="text-2xl font-bold text-white">{evaluation.spin_evaluation.P?.final_score?.toFixed(1) || '0'}</div>
                                </div>
                                <div className="text-center bg-gradient-to-br from-green-600/20 to-green-400/10 rounded-lg p-3 border border-green-500/20">
                                  <div className="text-xs text-green-300 mb-1 font-semibold">Implicação</div>
                                  <div className="text-2xl font-bold text-white">{evaluation.spin_evaluation.I?.final_score?.toFixed(1) || '0'}</div>
                                </div>
                                <div className="text-center bg-gradient-to-br from-green-600/20 to-green-400/10 rounded-lg p-3 border border-green-500/20">
                                  <div className="text-xs text-green-300 mb-1 font-semibold">Necessidade</div>
                                  <div className="text-2xl font-bold text-white">{evaluation.spin_evaluation.N?.final_score?.toFixed(1) || '0'}</div>
                                </div>
                              </div>

                              {/* Média Geral SPIN */}
                              <div className="relative group mt-6">
                                <div className="absolute inset-0 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-xl blur-lg group-hover:blur-xl transition-all"></div>
                                <div className="relative bg-gradient-to-r from-green-600 to-emerald-500 rounded-xl px-6 py-5 text-center shadow-[0_0_25px_rgba(34,197,94,0.3)]">
                                  <div className="text-sm text-white/80 mb-1 font-semibold uppercase tracking-wider">Média Geral SPIN</div>
                                  <div className="text-4xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                                    {(() => {
                                      const avg = (
                                        (evaluation.spin_evaluation.S?.final_score || 0) +
                                        (evaluation.spin_evaluation.P?.final_score || 0) +
                                        (evaluation.spin_evaluation.I?.final_score || 0) +
                                        (evaluation.spin_evaluation.N?.final_score || 0)
                                      ) / 4;
                                      return avg.toFixed(1);
                                    })()}<span className="text-xl text-white/70">/10</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Feedback Detalhado SPIN */}
                        {evaluation.spin_evaluation && (
                          <details className="group relative bg-gradient-to-br from-gray-800/40 to-gray-900/30 border border-green-500/20 rounded-xl p-5 mb-4 shadow-lg hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all">
                            <summary className="flex items-center gap-3 font-bold text-white cursor-pointer hover:text-green-400 transition-colors">
                              <div className="w-8 h-8 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-lg flex items-center justify-center border border-green-500/30">
                                <ChevronRight className="w-4 h-4 text-green-400 group-open:rotate-90 transition-transform" />
                              </div>
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
                                  <div key={letter} className="bg-gray-900/50 rounded-lg p-4 border border-green-500/10">
                                    {/* Header com nome e score */}
                                    <div className="flex items-center justify-between mb-3">
                                      <h6 className="font-semibold text-green-400">
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
                          <details className="group relative bg-gradient-to-br from-gray-800/40 to-gray-900/30 border border-green-500/20 rounded-xl p-5 mb-4 shadow-lg hover:shadow-[0_0_20px_rgba(34,197,94,0.1)] transition-all">
                            <summary className="flex items-center gap-3 font-bold text-white cursor-pointer hover:text-green-400 transition-colors">
                              <div className="w-8 h-8 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-lg flex items-center justify-center border border-green-500/30">
                                <ChevronRight className="w-4 h-4 text-green-400 group-open:rotate-90 transition-transform" />
                              </div>
                              Análise Detalhada de Objeções
                              <span className="ml-auto text-sm px-3 py-1 bg-green-500/20 text-green-400 rounded-lg border border-green-500/30">
                                {evaluation.objections_analysis.length}
                              </span>
                            </summary>
                            <div className="mt-4 space-y-4">
                              {evaluation.objections_analysis.map((obj: any, idx: number) => (
                                <div key={idx} className="bg-gray-900/50 rounded-lg p-4 border border-green-500/10">
                                  {/* Header com tipo e score */}
                                  <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-semibold text-green-400 uppercase bg-green-500/10 px-2 py-1 rounded">
                                      {obj.objection_type}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-2xl font-bold text-white">{obj.score}</span>
                                      <span className="text-gray-400">/10</span>
                                    </div>
                                  </div>

                                  {/* Texto da objeção */}
                                  <div className="bg-gray-800/50 rounded-lg p-3 mb-3 border-l-2 border-green-500/30">
                                    <p className="text-sm text-gray-300 italic">
                                      <span className="text-green-400 mr-1">Cliente:</span>
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
                      <h4 className="font-semibold mb-3 text-green-400">
                        Transcrição ({selectedSession.messages.length} mensagens)
                      </h4>
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                        {selectedSession.messages.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex gap-3 ${msg.role === 'seller' ? 'justify-end' : ''}`}
                          >
                            {msg.role === 'client' && (
                              <div className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-green-400" />
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
                                    : 'bg-green-600/20 rounded-2xl rounded-tr-none max-w-md'
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
