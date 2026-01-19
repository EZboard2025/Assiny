'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface ChallengeLead {
  id: string
  name: string
  email: string
  session_id: string
  status: string
  started_at: string
  completed_at: string | null
  interested: boolean
  interested_at: string | null
  evaluation: {
    overall_score?: number
    score?: number
    performance_level?: string
    executive_summary?: string
    spin_evaluation?: {
      S?: { final_score?: number; technical_feedback?: string }
      P?: { final_score?: number; technical_feedback?: string }
      I?: { final_score?: number; technical_feedback?: string }
      N?: { final_score?: number; technical_feedback?: string }
    }
    top_strengths?: string[]
    critical_gaps?: string[]
    priority_improvements?: Array<{
      area?: string
      current_gap?: string
      action_plan?: string
    }>
  } | null
  transcription: string | null
  overall_score: number | null
  created_at: string
}

export default function ChallengeAdminPage() {
  const [leads, setLeads] = useState<ChallengeLead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<ChallengeLead | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')

  useEffect(() => {
    // Verificar se já está autenticado
    const auth = sessionStorage.getItem('challenge_admin_auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
      fetchLeads()
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogin = () => {
    if (password === 'admin123') {
      sessionStorage.setItem('challenge_admin_auth', 'true')
      setIsAuthenticated(true)
      fetchLeads()
    } else {
      alert('Senha incorreta')
    }
  }

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/challenge/leads')
      const data = await response.json()

      if (data.success) {
        setLeads(data.leads)
      }
    } catch (error) {
      console.error('Erro ao buscar leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    const normalizedScore = score > 10 ? score / 10 : score
    if (normalizedScore >= 7) return 'text-green-400'
    if (normalizedScore >= 4) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Concluído</span>
      case 'active':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">Em andamento</span>
      case 'abandoned':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Abandonado</span>
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">{status}</span>
    }
  }

  const normalizeScore = (score: number | null | undefined) => {
    if (score === null || score === undefined) return null
    return score > 10 ? score / 10 : score
  }

  // Tela de login
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0a2e] to-[#0f0720] flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-completa.png"
              alt="Ramppy Logo"
              width={200}
              height={57}
              className="object-contain"
            />
          </div>
          <h1 className="text-xl font-bold text-white text-center mb-6">Admin - Desafio Caneta</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Senha de administrador"
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-purple-500 mb-4"
          />
          <button
            onClick={handleLogin}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Entrar
          </button>
        </div>
      </div>
    )
  }

  // Tela de loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0a2e] to-[#0f0720] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0118] via-[#1a0a2e] to-[#0f0720] p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-completa.png"
              alt="Ramppy Logo"
              width={150}
              height={43}
              className="object-contain"
            />
            <h1 className="text-2xl font-bold text-white">Desafio "Venda uma Caneta"</h1>
          </div>
          <div className="text-white/60 text-sm">
            {leads.length} participante{leads.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="text-white/60 text-sm mb-1">Total de Participantes</div>
          <div className="text-3xl font-bold text-white">{leads.length}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="text-white/60 text-sm mb-1">Concluídos</div>
          <div className="text-3xl font-bold text-green-400">
            {leads.filter(l => l.status === 'completed').length}
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="text-white/60 text-sm mb-1">Nota Média</div>
          <div className="text-3xl font-bold text-purple-400">
            {(() => {
              const completedWithScore = leads.filter(l => l.overall_score !== null)
              if (completedWithScore.length === 0) return '-'
              const avg = completedWithScore.reduce((sum, l) => sum + (normalizeScore(l.overall_score) || 0), 0) / completedWithScore.length
              return avg.toFixed(1)
            })()}
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
          <div className="text-white/60 text-sm mb-1">Interessados</div>
          <div className="text-3xl font-bold text-pink-400">
            {leads.filter(l => l.interested).length}
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="max-w-7xl mx-auto bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-white/60 text-sm font-medium px-6 py-4">Nome</th>
                <th className="text-left text-white/60 text-sm font-medium px-6 py-4">Email</th>
                <th className="text-left text-white/60 text-sm font-medium px-6 py-4">Status</th>
                <th className="text-left text-white/60 text-sm font-medium px-6 py-4">Nota</th>
                <th className="text-left text-white/60 text-sm font-medium px-6 py-4">Data</th>
                <th className="text-left text-white/60 text-sm font-medium px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <td className="px-6 py-4">
                    <div className="text-white font-medium">{lead.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-white/70">{lead.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(lead.status)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-lg font-bold ${getScoreColor(lead.overall_score)}`}>
                      {lead.overall_score !== null ? normalizeScore(lead.overall_score)?.toFixed(1) : '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-white/60 text-sm">{formatDate(lead.created_at)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedLead(lead)
                      }}
                      className="px-3 py-1 text-sm bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors"
                    >
                      Ver detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-white/40">
                    Nenhum participante ainda
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLead && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="bg-gradient-to-br from-[#1a0a2e] to-[#0f0720] border border-white/20 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-br from-[#1a0a2e] to-[#0f0720] border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedLead.name}</h2>
                <p className="text-white/60 text-sm">{selectedLead.email}</p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-white/60 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Score Circle */}
              {selectedLead.overall_score !== null && (
                <div className="flex justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-white/10"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="58"
                        stroke="url(#gradient)"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${((normalizeScore(selectedLead.overall_score) || 0) / 10) * 364} 364`}
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#a855f7" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">
                        {normalizeScore(selectedLead.overall_score)?.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SPIN Scores */}
              {selectedLead.evaluation?.spin_evaluation && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['S', 'P', 'I', 'N'].map((letter) => {
                    const spinData = selectedLead.evaluation?.spin_evaluation?.[letter as 'S' | 'P' | 'I' | 'N']
                    const score = normalizeScore(spinData?.final_score ?? null)
                    return (
                      <div key={letter} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-purple-400 mb-1">{letter}</div>
                        <div className={`text-xl font-bold ${getScoreColor(score)}`}>
                          {score !== null ? score.toFixed(1) : '-'}
                        </div>
                        <div className="text-xs text-white/40 mt-1">
                          {letter === 'S' && 'Situação'}
                          {letter === 'P' && 'Problema'}
                          {letter === 'I' && 'Implicação'}
                          {letter === 'N' && 'Necessidade'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Executive Summary */}
              {selectedLead.evaluation?.executive_summary && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-2">Resumo Executivo</h3>
                  <p className="text-white/70 text-sm">{selectedLead.evaluation.executive_summary}</p>
                </div>
              )}

              {/* Strengths and Gaps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedLead.evaluation?.top_strengths && selectedLead.evaluation.top_strengths.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <h3 className="text-green-400 font-semibold mb-2">Pontos Fortes</h3>
                    <ul className="space-y-1">
                      {selectedLead.evaluation.top_strengths.map((strength, i) => (
                        <li key={i} className="text-white/70 text-sm flex items-start gap-2">
                          <span className="text-green-400">✓</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedLead.evaluation?.critical_gaps && selectedLead.evaluation.critical_gaps.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <h3 className="text-red-400 font-semibold mb-2">Gaps Críticos</h3>
                    <ul className="space-y-1">
                      {selectedLead.evaluation.critical_gaps.map((gap, i) => (
                        <li key={i} className="text-white/70 text-sm flex items-start gap-2">
                          <span className="text-red-400">!</span>
                          {gap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Priority Improvements */}
              {selectedLead.evaluation?.priority_improvements && selectedLead.evaluation.priority_improvements.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <h3 className="text-yellow-400 font-semibold mb-3">Melhorias Prioritárias</h3>
                  <div className="space-y-3">
                    {selectedLead.evaluation.priority_improvements.map((improvement, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-3">
                        {improvement.area && (
                          <div className="text-white font-medium text-sm mb-1">{improvement.area}</div>
                        )}
                        {improvement.current_gap && (
                          <div className="text-white/60 text-xs mb-1">Gap: {improvement.current_gap}</div>
                        )}
                        {improvement.action_plan && (
                          <div className="text-white/70 text-sm">{improvement.action_plan}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcription */}
              {selectedLead.transcription && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h3 className="text-white font-semibold mb-2">Transcrição</h3>
                  <div className="bg-black/30 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <pre className="text-white/70 text-sm whitespace-pre-wrap font-sans">
                      {selectedLead.transcription}
                    </pre>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/40 mb-1">Iniciado em</div>
                  <div className="text-white">{formatDate(selectedLead.started_at)}</div>
                </div>
                {selectedLead.completed_at && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-white/40 mb-1">Concluído em</div>
                    <div className="text-white">{formatDate(selectedLead.completed_at)}</div>
                  </div>
                )}
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/40 mb-1">Status</div>
                  <div>{getStatusBadge(selectedLead.status)}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-white/40 mb-1">Interessado</div>
                  <div className={selectedLead.interested ? 'text-green-400' : 'text-white/40'}>
                    {selectedLead.interested ? 'Sim' : 'Não'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
