'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, ThumbsUp, ThumbsDown, MessageSquare, Target, Calendar, Loader2, ChevronDown, ChevronUp, Eye, AlertCircle, TrendingUp, Award, Star, Lightbulb, Edit3, Zap } from 'lucide-react'

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
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())

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

      // Buscar resultados (com fallback caso a tabela não exista)
      let resultsData: any[] = []
      try {
        const analysisIds = analysesData?.map(a => a.id) || []
        const { data, error: resultsError } = await supabase
          .from('followup_results')
          .select('*')
          .in('followup_analysis_id', analysisIds)

        if (resultsError) {
          console.warn('⚠️ Tabela followup_results não encontrada. Execute o SQL primeiro:', resultsError.message)
        } else {
          resultsData = data || []
        }
      } catch (resultsError) {
        console.warn('⚠️ Erro ao buscar resultados (não crítico):', resultsError)
      }

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

  const toggleDetailsExpansion = (analysisId: string) => {
    setExpandedDetails(prev => {
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

      // Salvar exemplo na tabela correta (sucesso ou falha) com embedding
      try {
        console.log('🔄 Salvando exemplo para aprendizado da IA...')
        const saveExampleResponse = await fetch('/api/followup/save-example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisId, funcionou })
        })

        if (saveExampleResponse.ok) {
          const result = await saveExampleResponse.json()
          console.log('✅ Exemplo salvo com sucesso em:', result.tableName)
        } else {
          const errorData = await saveExampleResponse.json()
          console.warn('⚠️ Falha ao salvar exemplo:', errorData.error)
        }
      } catch (saveError) {
        console.warn('⚠️ Erro ao salvar exemplo (não crítico):', saveError)
        // Não bloquear o fluxo se falhar
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
      'pessimo': 'text-red-700 bg-red-100 border-red-200',
      'ruim': 'text-orange-700 bg-orange-100 border-orange-200',
      'medio': 'text-yellow-700 bg-yellow-100 border-yellow-200',
      'bom': 'text-green-700 bg-green-100 border-green-200',
      'excelente': 'text-purple-700 bg-purple-100 border-purple-200'
    }
    return colors[classification] || 'text-gray-700 bg-gray-100 border-gray-200'
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    if (score >= 4) return 'text-orange-600'
    return 'text-red-600'
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
        <p className="text-sm text-gray-600 line-clamp-2">
          {transcription}
        </p>
      )
    }

    // Mostrar apenas 2 mensagens quando colapsado, todas quando expandido
    const displayMessages = isExpanded ? messages : messages.slice(0, 2)
    const containerClass = isExpanded
      ? 'max-h-[600px] overflow-y-auto'
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
                    msg.role === 'Vendedor' ? 'text-green-600' : 'text-blue-600'
                  }`}>
                    {msg.role}
                  </span>
                  <span className="text-[10px] text-gray-400">{msg.time}</span>
                </div>
                <div className={`rounded-2xl px-4 py-2 ${
                  msg.role === 'Vendedor'
                    ? 'bg-green-50 border border-green-100 text-gray-700'
                    : 'bg-gray-100 border border-gray-200 text-gray-700'
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
      <div className="flex-1 p-4 md:p-6 overflow-y-auto min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-green-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-medium">Carregando histórico...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Histórico de Follow-ups</h1>
              <p className="text-gray-500 text-sm">Revise suas análises e marque se os follow-ups funcionaram</p>
            </div>
          </div>
        </div>

        {/* Lista de análises */}
        {analyses.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-200 shadow-sm text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum follow-up ainda
            </h3>
            <p className="text-gray-500">
              Faça sua primeira análise de follow-up para começar a construir seu histórico
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header do card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase border ${getClassificationColor(analysis.classificacao)}`}>
                        {analysis.classificacao}
                      </span>
                      <span className={`text-2xl font-bold ${getScoreColor(analysis.nota_final)}`}>
                        {analysis.nota_final.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
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
                  <div className="flex items-center">
                    {analysis.result ? (
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                        analysis.result.funcionou
                          ? 'bg-green-100 border-green-200 text-green-700'
                          : 'bg-red-100 border-red-200 text-red-700'
                      }`}>
                        {analysis.result.funcionou ? (
                          <>
                            <ThumbsUp className="w-4 h-4" />
                            <span className="font-medium text-sm">Funcionou</span>
                          </>
                        ) : (
                          <>
                            <ThumbsDown className="w-4 h-4" />
                            <span className="font-medium text-sm">Não Funcionou</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-100 border border-yellow-200 text-yellow-700">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium text-sm">Aguardando Feedback</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview do follow-up em formato de chat */}
                <div className="bg-gray-50 rounded-xl mb-4 overflow-hidden border border-gray-200">
                  {/* Header do chat com botão de expandir */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
                    <span className="text-xs font-semibold text-gray-600 flex items-center gap-2 uppercase tracking-wider">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                      Conversa do Follow-up
                    </span>
                    <button
                      onClick={() => toggleChatExpansion(analysis.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-green-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
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
                  <div className="p-4 bg-white">
                    {renderChatMessages(analysis.transcricao_filtrada, expandedChats.has(analysis.id))}
                  </div>
                </div>

                {/* Detalhes da Avaliação */}
                <div className="bg-gray-50 rounded-xl mb-4 overflow-hidden border border-gray-200">
                  {/* Header dos detalhes */}
                  <button
                    onClick={() => toggleDetailsExpansion(analysis.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-600 flex items-center gap-2 uppercase tracking-wider">
                      <Eye className="w-4 h-4 text-green-600" />
                      Detalhes da Avaliação
                    </span>
                    {expandedDetails.has(analysis.id) ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {/* Conteúdo expandido */}
                  {expandedDetails.has(analysis.id) && analysis.avaliacao && (
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4 bg-white">
                      {/* Notas por Critério */}
                      {analysis.avaliacao.notas && (
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                          <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Award className="w-4 h-4 text-yellow-500" />
                            Notas Detalhadas por Critério
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(analysis.avaliacao.notas).map(([criterio, dados]: [string, any]) => {
                              const getNoteColor = (nota: number) => {
                                if (nota >= 8) return 'text-green-600'
                                if (nota >= 6) return 'text-yellow-600'
                                if (nota >= 4) return 'text-orange-600'
                                return 'text-red-600'
                              }

                              const criterioLabels: Record<string, string> = {
                                valor_agregado: 'Valor Agregado',
                                personalizacao: 'Personalização',
                                tom_consultivo: 'Tom Consultivo',
                                objetividade: 'Objetividade',
                                cta: 'Call-to-Action',
                                timing: 'Timing'
                              }

                              return (
                                <div key={criterio} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                                      {criterioLabels[criterio] || criterio}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-lg font-bold ${getNoteColor(dados.nota)}`}>
                                        {dados.nota.toFixed(1)}
                                      </span>
                                      <span className="text-[10px] text-gray-400">
                                        (peso {dados.peso})
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-600 leading-relaxed">{dados.comentario}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pontos Positivos */}
                      {analysis.avaliacao.pontos_positivos && analysis.avaliacao.pontos_positivos.length > 0 && (
                        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                          <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                            <Star className="w-4 h-4" />
                            Pontos Positivos
                          </h4>
                          <ul className="space-y-2">
                            {analysis.avaliacao.pontos_positivos.map((ponto: string, idx: number) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                <span className="text-green-600 mt-1 flex-shrink-0">✓</span>
                                <span>{ponto}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Pontos a Melhorar */}
                      {analysis.avaliacao.pontos_melhorar && analysis.avaliacao.pontos_melhorar.length > 0 && (
                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                          <h4 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Pontos a Melhorar
                          </h4>
                          <div className="space-y-3">
                            {analysis.avaliacao.pontos_melhorar.map((item: any, idx: number) => (
                              <div key={idx} className="bg-white rounded-lg p-3 border border-orange-100">
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="text-orange-600 mt-1 flex-shrink-0">⚠</span>
                                  <p className="text-sm text-gray-900 font-medium">{item.problema}</p>
                                </div>
                                <div className="ml-5 flex items-start gap-2">
                                  <Lightbulb className="w-3 h-3 text-green-600 mt-1 flex-shrink-0" />
                                  <p className="text-xs text-gray-600 leading-relaxed">
                                    <span className="text-green-600 font-medium">Como resolver:</span> {item.como_resolver}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Versão Reescrita */}
                      {analysis.avaliacao.versao_reescrita && (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                          <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                            <Edit3 className="w-4 h-4" />
                            Versão Reescrita Sugerida
                          </h4>
                          <div className="bg-white rounded-lg p-4 border border-blue-100">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {analysis.avaliacao.versao_reescrita}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Dica Principal */}
                      {analysis.avaliacao.dica_principal && (
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                          <h4 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Dica Principal
                          </h4>
                          <p className="text-sm text-gray-700 leading-relaxed italic">
                            "{analysis.avaliacao.dica_principal}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Ações */}
                {!analysis.result && (
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleMarkResult(analysis.id, true)}
                      disabled={isSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ThumbsUp className="w-5 h-5" />
                      <span>Follow-up Funcionou</span>
                    </button>
                    <button
                      onClick={() => handleMarkResult(analysis.id, false)}
                      disabled={isSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ThumbsDown className="w-5 h-5" />
                      <span>Não Funcionou</span>
                    </button>
                  </div>
                )}

                {/* Permite alterar resultado */}
                {analysis.result && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Resultado marcado em {new Date(analysis.result.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    <button
                      onClick={() => handleMarkResult(analysis.id, !analysis.result!.funcionou)}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-green-600 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
