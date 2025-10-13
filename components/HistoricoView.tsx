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

        {/* Filtros */}
        <div className={`mb-8 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
          <div className="flex flex-wrap gap-3 justify-center">
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
                                {obj}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

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
