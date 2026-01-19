'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, ThumbsUp, ThumbsDown, MessageSquare, Target, Calendar, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface FollowUpAnalysis {
  id: string
  tipo_venda: string
  canal: string
  fase_funil: string
  transcricao_filtrada: string
  nota_final: number
  classificacao: string
  created_at: string
  avaliacao: any
  result?: FollowUpResult | null
}

interface FollowUpResult {
  id: string
  funcionou: boolean
  lead_respondeu: boolean | null
  lead_avancou_fase: boolean | null
  observacoes: string | null
  created_at: string
}

export default function FollowUpHistoryView() {
  const [analyses, setAnalyses] = useState<FollowUpAnalysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        console.error('Usuário não autenticado')
        return
      }

      // Buscar análises do usuário
      const { data: analysesData, error: analysesError } = await supabase
        .from('followup_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (analysesError) {
        console.error('Erro ao carregar histórico:', analysesError)
        return
      }

      // Buscar resultados
      const analysisIds = analysesData?.map(a => a.id) || []
      const { data: resultsData } = await supabase
        .from('followup_results')
        .select('*')
        .in('followup_analysis_id', analysisIds)

      // Mapear resultados para análises
      const analysesWithResults = analysesData?.map(analysis => ({
        ...analysis,
        result: resultsData?.find(r => r.followup_analysis_id === analysis.id) || null
      })) || []

      setAnalyses(analysesWithResults)
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleChatExpansion = (analysisId: string) => {
    setExpandedChats(prev => {
      const newSet = new Set(prev)
      if (newSet.has(analysisId)) {
        newSet.delete(analysisId)
      } else {
        newSet.add(analysisId)
      }
      return newSet
    })
  }

  const handleMarkResult = async (analysisId: string, funcionou: boolean) => {
    setIsSubmitting(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('Erro: Usuário não autenticado')
        return
      }

      const companyId = await getCompanyId()
      if (!companyId) {
        alert('Erro: Company ID não encontrado')
        return
      }

      // Verificar se já existe resultado
      const analysis = analyses.find(a => a.id === analysisId)
      if (analysis?.result) {
        // Atualizar resultado existente
        const { error } = await supabase
          .from('followup_results')
          .update({ funcionou, updated_at: new Date().toISOString() })
          .eq('id', analysis.result.id)

        if (error) {
          console.error('Erro ao atualizar resultado:', error)
          alert('Erro ao atualizar resultado')
          return
        }
      } else {
        // Criar novo resultado
        const { error } = await supabase
          .from('followup_results')
          .insert({
            followup_analysis_id: analysisId,
            user_id: user.id,
            company_id: companyId,
            funcionou
          })

        if (error) {
          console.error('Erro ao salvar resultado:', error)
          alert('Erro ao salvar resultado')
          return
        }
      }

      // Recarregar histórico
      await loadHistory()
      setSelectedAnalysis(null)
    } catch (error) {
      console.error('Erro ao marcar resultado:', error)
      alert('Erro ao marcar resultado')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getClassificationColor = (classification: string) => {
    const colors: Record<string, string> = {
      'pessimo': 'text-red-400 bg-red-900/20 border-red-500/30',
      'ruim': 'text-orange-400 bg-orange-900/20 border-orange-500/30',
      'medio': 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30',
      'bom': 'text-green-400 bg-green-900/20 border-green-500/30',
      'excelente': 'text-purple-400 bg-purple-900/20 border-purple-500/30'
    }
    return colors[classification] || 'text-gray-400 bg-gray-900/20 border-gray-500/30'
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    if (score >= 4) return 'text-orange-400'
    return 'text-red-400'
  }

  // Função para parsear e formatar a transcrição como chat
  const parseTranscriptionToChat = (transcription: string) => {
    // Regex para encontrar padrões como [10:03] Vendedor: texto ou [10:03] Cliente: texto
    const messageRegex = /\[(\d{2}:\d{2})\]\s+(Vendedor|Cliente):\s+([^[]+)/g
    const messages: { time: string; role: 'Vendedor' | 'Cliente'; text: string }[] = []

    let match
    while ((match = messageRegex.exec(transcription)) !== null) {
      messages.push({
        time: match[1],
        role: match[2] as 'Vendedor' | 'Cliente',
        text: match[3].trim()
      })
    }

    return messages
  }

  const renderChatMessages = (transcription: string, isExpanded: boolean) => {
    const messages = parseTranscriptionToChat(transcription)

    if (messages.length === 0) {
      // Fallback: mostrar texto sem formatação
      return (
        <p className="text-sm text-gray-300 line-clamp-2">
          {transcription}
        </p>
      )
    }

    // Mostrar apenas 2 mensagens quando colapsado, todas quando expandido
    const displayMessages = isExpanded ? messages : messages.slice(0, 2)
    const containerClass = isExpanded
      ? 'max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent'
      : 'max-h-[180px] overflow-hidden'

    return (
      <div className={`space-y-3 ${containerClass} pr-2 transition-all duration-300`}>
        <div className="space-y-3">
          {displayMessages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'Vendedor' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] min-w-[200px] ${msg.role === 'Vendedor' ? 'order-2' : 'order-1'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${
                    msg.role === 'Vendedor' ? 'text-green-400' : 'text-blue-400'
                  }`}>
                    {msg.role}
                  </span>
                  <span className="text-[10px] text-gray-500">{msg.time}</span>
                </div>
                <div className={`rounded-2xl px-4 py-2 ${
                  msg.role === 'Vendedor'
                    ? 'bg-green-600/20 border border-green-500/30 text-gray-200'
                    : 'bg-gray-700/50 border border-gray-600/30 text-gray-300'
                }`}>
                  <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!isExpanded && messages.length > 2 && (
          <div className="text-center">
            <span className="text-xs text-gray-500">
              +{messages.length - 2} mensagens
            </span>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-black min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-green-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Carregando histórico...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-black min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Histórico de Follow-ups
          </h1>
          <p className="text-gray-400">
            Revise suas análises e marque se os follow-ups funcionaram para melhorar o aprendizado da IA
          </p>
        </div>

        {/* Lista de análises */}
        {analyses.length === 0 ? (
          <div className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-12 border border-green-500/20 text-center">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">Nenhum follow-up ainda</h3>
            <p className="text-gray-500">
              Faça sua primeira análise de follow-up para começar a construir seu histórico
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="bg-gray-900/60 backdrop-blur-sm rounded-2xl p-6 border border-green-500/20 hover:border-green-500/40 transition-all"
              >
                {/* Header do card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${getClassificationColor(analysis.classificacao)}`}>
                        {analysis.classificacao.toUpperCase()}
                      </span>
                      <span className={`text-2xl font-bold ${getScoreColor(analysis.nota_final)}`}>
                        {analysis.nota_final.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(analysis.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {analysis.canal}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {analysis.tipo_venda}
                      </span>
                    </div>
                  </div>

                  {/* Status do resultado */}
                  <div className="flex items-center gap-2">
                    {analysis.result ? (
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                        analysis.result.funcionou
                          ? 'bg-green-900/20 border-green-500/50 text-green-400'
                          : 'bg-red-900/20 border-red-500/50 text-red-400'
                      }`}>
                        {analysis.result.funcionou ? (
                          <>
                            <ThumbsUp className="w-5 h-5" />
                            <span className="font-medium">Funcionou</span>
                          </>
                        ) : (
                          <>
                            <ThumbsDown className="w-5 h-5" />
                            <span className="font-medium">Não Funcionou</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-yellow-500/50 bg-yellow-900/20 text-yellow-400">
                        <Clock className="w-5 h-5" />
                        <span className="font-medium">Aguardando Feedback</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview do follow-up em formato de chat */}
                <div className="bg-gray-800/50 rounded-lg mb-4 overflow-hidden transition-all duration-300">
                  {/* Header do chat com botão de expandir */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50">
                    <span className="text-xs font-medium text-gray-400 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Conversa do Follow-up
                    </span>
                    <button
                      onClick={() => toggleChatExpansion(analysis.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-400 transition-colors px-2 py-1 rounded hover:bg-gray-700/30"
                    >
                      {expandedChats.has(analysis.id) ? (
                        <>
                          <span>Recolher</span>
                          <ChevronUp className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <span>Expandir</span>
                          <ChevronDown className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Conteúdo do chat */}
                  <div className="p-4">
                    {renderChatMessages(analysis.transcricao_filtrada, expandedChats.has(analysis.id))}
                  </div>
                </div>

                {/* Ações */}
                {!analysis.result && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleMarkResult(analysis.id, true)}
                      disabled={isSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ThumbsUp className="w-5 h-5" />
                      Follow-up Funcionou
                    </button>
                    <button
                      onClick={() => handleMarkResult(analysis.id, false)}
                      disabled={isSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ThumbsDown className="w-5 h-5" />
                      Não Funcionou
                    </button>
                  </div>
                )}

                {/* Permite alterar resultado */}
                {analysis.result && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-500">
                      Resultado marcado em {new Date(analysis.result.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    <button
                      onClick={() => handleMarkResult(analysis.id, !analysis.result!.funcionou)}
                      disabled={isSubmitting}
                      className="text-xs text-gray-400 hover:text-green-400 transition-colors disabled:opacity-50"
                    >
                      Alterar resultado
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
