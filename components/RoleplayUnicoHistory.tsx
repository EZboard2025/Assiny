'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Calendar,
  Clock,
  Award,
  TrendingUp,
  AlertCircle,
  FileText,
  Filter,
  Download,
  Eye,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  BarChart3
} from 'lucide-react'

interface RoleplayUnico {
  id: string
  participant_name: string
  participant_email?: string
  participant_phone?: string
  link_name?: string
  link_code?: string
  status: 'in_progress' | 'completed' | 'abandoned'
  overall_score?: number
  performance_level?: string
  duration_seconds?: number
  message_count: {
    total: number
    client: number
    seller: number
  }
  created_at: string
  ended_at?: string
}

interface RoleplayUnicoHistoryProps {
  companyId: string
}

export default function RoleplayUnicoHistory({ companyId }: RoleplayUnicoHistoryProps) {
  const [roleplays, setRoleplays] = useState<RoleplayUnico[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoleplay, setSelectedRoleplay] = useState<RoleplayUnico | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [roleplayDetails, setRoleplayDetails] = useState<any>(null)

  // Filtros
  const [filters, setFilters] = useState({
    status: '',
    linkId: '',
    startDate: '',
    endDate: ''
  })

  // Estatísticas
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    abandoned: 0,
    avg_score: 0
  })

  useEffect(() => {
    loadRoleplays()
  }, [companyId, filters])

  const loadRoleplays = async () => {
    try {
      setLoading(true)

      // Montar query string com filtros
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.linkId) params.append('linkId', filters.linkId)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await fetch(`/api/roleplays-unicos/list?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setRoleplays(data.data || [])
        setStats(data.stats || {
          total: 0,
          completed: 0,
          in_progress: 0,
          abandoned: 0,
          avg_score: 0
        })
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRoleplayDetails = async (roleplayId: string) => {
    try {
      setLoadingDetails(true)

      const response = await fetch(`/api/roleplays-unicos/details?id=${roleplayId}`)
      const data = await response.json()

      if (data.success) {
        setRoleplayDetails(data.data)
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-'
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400'
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'abandoned':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completo'
      case 'in_progress':
        return 'Em Progresso'
      case 'abandoned':
        return 'Abandonado'
      default:
        return status
    }
  }

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400'
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const handleViewDetails = async (roleplay: RoleplayUnico) => {
    setSelectedRoleplay(roleplay)
    await loadRoleplayDetails(roleplay.id)
  }

  const exportToCSV = () => {
    const headers = [
      'Nome',
      'Email',
      'Telefone',
      'Link',
      'Status',
      'Score',
      'Duração',
      'Mensagens',
      'Data'
    ]

    const rows = roleplays.map(r => [
      r.participant_name,
      r.participant_email || '',
      r.participant_phone || '',
      r.link_name || '',
      getStatusLabel(r.status),
      r.overall_score?.toString() || '',
      formatDuration(r.duration_seconds),
      r.message_count.total.toString(),
      formatDate(r.created_at)
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roleplays-unicos-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com Estatísticas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Histórico de Roleplays Únicos</h3>
            <p className="text-sm text-gray-400">
              Acompanhe todos os roleplays feitos através dos links
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="text-2xl font-bold text-white">{stats.total}</span>
            </div>
            <p className="text-xs text-gray-400">Total</p>
          </div>

          <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-2xl font-bold text-white">{stats.completed}</span>
            </div>
            <p className="text-xs text-gray-400">Completos</p>
          </div>

          <div className="bg-gray-900/50 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <span className="text-2xl font-bold text-white">{stats.in_progress}</span>
            </div>
            <p className="text-xs text-gray-400">Em Progresso</p>
          </div>

          <div className="bg-gray-900/50 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-2xl font-bold text-white">{stats.abandoned}</span>
            </div>
            <p className="text-xs text-gray-400">Abandonados</p>
          </div>

          <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-2xl font-bold text-white">
                {stats.avg_score ? stats.avg_score.toFixed(1) : '-'}
              </span>
            </div>
            <p className="text-xs text-gray-400">Média Score</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">Filtros</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 bg-gray-800/50 border border-purple-500/20 rounded-lg text-sm text-white focus:border-purple-500/50 focus:outline-none"
            >
              <option value="">Todos os Status</option>
              <option value="completed">Completos</option>
              <option value="in_progress">Em Progresso</option>
              <option value="abandoned">Abandonados</option>
            </select>

            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="px-3 py-2 bg-gray-800/50 border border-purple-500/20 rounded-lg text-sm text-white focus:border-purple-500/50 focus:outline-none"
              placeholder="Data Início"
            />

            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="px-3 py-2 bg-gray-800/50 border border-purple-500/20 rounded-lg text-sm text-white focus:border-purple-500/50 focus:outline-none"
              placeholder="Data Fim"
            />

            <button
              onClick={() => setFilters({ status: '', linkId: '', startDate: '', endDate: '' })}
              className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-sm font-medium transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Roleplays */}
      {roleplays.length === 0 ? (
        <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-20 text-center">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum roleplay único realizado ainda</p>
        </div>
      ) : (
        <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Participante
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Link Usado
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Duração
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Mensagens
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {roleplays.map(roleplay => (
                  <tr key={roleplay.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{roleplay.participant_name}</p>
                        {roleplay.participant_email && (
                          <p className="text-xs text-gray-400">{roleplay.participant_email}</p>
                        )}
                        {roleplay.participant_phone && (
                          <p className="text-xs text-gray-400">{roleplay.participant_phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-white">{roleplay.link_name || '-'}</p>
                        {roleplay.link_code && (
                          <p className="text-xs text-gray-400 font-mono">{roleplay.link_code}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(roleplay.status)}`}>
                        {getStatusLabel(roleplay.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-lg font-bold ${getScoreColor(roleplay.overall_score ? roleplay.overall_score / 10 : undefined)}`}>
                        {roleplay.overall_score ? (roleplay.overall_score / 10).toFixed(1) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-300">
                      {formatDuration(roleplay.duration_seconds)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm text-gray-300">
                        <p>{roleplay.message_count.total}</p>
                        <p className="text-xs text-gray-500">
                          {roleplay.message_count.client}C / {roleplay.message_count.seller}V
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {formatDate(roleplay.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleViewDetails(roleplay)}
                        className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Detalhes */}
      {selectedRoleplay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-purple-500/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                Detalhes do Roleplay
              </h2>
              <button
                onClick={() => {
                  setSelectedRoleplay(null)
                  setRoleplayDetails(null)
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            ) : roleplayDetails ? (
              <div className="space-y-6">
                {/* Informações do Participante */}
                <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">Participante</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Nome</p>
                      <p className="text-sm text-white">{roleplayDetails.participant_name}</p>
                    </div>
                    {roleplayDetails.participant_email && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Email</p>
                        <p className="text-sm text-white">{roleplayDetails.participant_email}</p>
                      </div>
                    )}
                    {roleplayDetails.participant_phone && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Telefone</p>
                        <p className="text-sm text-white">{roleplayDetails.participant_phone}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Configuração Usada */}
                <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">Configuração</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Idade</p>
                      <p className="text-sm text-white">{roleplayDetails.config?.age}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Temperamento</p>
                      <p className="text-sm text-white">{roleplayDetails.config?.temperament}</p>
                    </div>
                  </div>
                </div>

                {/* Transcrição */}
                {roleplayDetails.messages && roleplayDetails.messages.length > 0 && (
                  <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Transcrição</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {roleplayDetails.messages.map((msg: any, index: number) => (
                        <div key={index} className={`flex ${msg.role === 'seller' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] p-3 rounded-xl ${
                            msg.role === 'seller'
                              ? 'bg-purple-600/20 text-white'
                              : 'bg-gray-700/50 text-gray-200'
                          }`}>
                            <p className="text-xs font-medium mb-1 opacity-70">
                              {msg.role === 'seller' ? 'Vendedor' : 'Cliente'}
                            </p>
                            <p className="text-sm">{msg.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Avaliação */}
                {roleplayDetails.evaluation && (
                  <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">Avaliação</h3>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Score Geral</p>
                      <p className="text-5xl font-bold text-purple-400">
                        {roleplayDetails.overall_score ? (roleplayDetails.overall_score / 10).toFixed(1) : '-'}/10
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-10">
                Detalhes não disponíveis
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}