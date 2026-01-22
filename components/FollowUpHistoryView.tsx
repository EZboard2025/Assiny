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
        <div className="relative mb-8">
          <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30 shadow-[0_0_40px_rgba(34,197,94,0.15)] hover:shadow-[0_0_60px_rgba(34,197,94,0.25)] transition-all duration-500 overflow-hidden group">
            {/* Efeito de brilho animado */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-full blur-3xl"></div>

            <div className="relative flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/30 rounded-2xl blur-2xl animate-pulse"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                  <MessageSquare className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black mb-2 bg-gradient-to-r from-white via-green-50 to-white bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                  Histórico de Follow-ups
                </h1>
                <p className="text-gray-400 text-lg">
                  Revise suas análises e marque se os follow-ups funcionaram para melhorar o aprendizado da IA
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de análises */}
        {analyses.length === 0 ? (
          <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-12 border border-green-500/30 text-center overflow-hidden group hover:border-green-500/50 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative">
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse"></div>
                <MessageSquare className="relative w-16 h-16 mx-auto text-green-400" />
              </div>
              <h3 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                Nenhum follow-up ainda
              </h3>
              <p className="text-gray-400">
                Faça sua primeira análise de follow-up para começar a construir seu histórico
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 hover:border-green-500/50 transition-all duration-500 shadow-[0_0_30px_rgba(34,197,94,0.1)] hover:shadow-[0_0_50px_rgba(34,197,94,0.2)] group"
              >
                {/* Efeito de brilho animado */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-green-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                {/* Header do card */}
                <div className="relative flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg blur-lg animate-pulse"></div>
                        <span className={`relative px-4 py-1.5 rounded-lg text-xs font-bold uppercase border-2 ${getClassificationColor(analysis.classificacao)} shadow-lg backdrop-blur-sm`}>
                          {analysis.classificacao}
                        </span>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-400/30 to-emerald-400/30 rounded-full blur-xl"></div>
                        <span className={`relative text-3xl font-black ${getScoreColor(analysis.nota_final)} drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]`}>
                          {analysis.nota_final.toFixed(1)}
                        </span>
                      </div>
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
                  <div className="relative flex items-center gap-2">
                    {analysis.result ? (
                      <div className="relative group/badge">
                        <div className={`absolute inset-0 ${
                          analysis.result.funcionou
                            ? 'bg-green-500/30'
                            : 'bg-red-500/30'
                        } rounded-xl blur-xl group-hover/badge:blur-2xl transition-all`}></div>
                        <div className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 backdrop-blur-sm shadow-lg ${
                          analysis.result.funcionou
                            ? 'bg-gradient-to-r from-green-900/40 to-green-800/30 border-green-500/60 text-green-300'
                            : 'bg-gradient-to-r from-red-900/40 to-red-800/30 border-red-500/60 text-red-300'
                        }`}>
                          {analysis.result.funcionou ? (
                            <>
                              <ThumbsUp className="w-5 h-5 animate-pulse" />
                              <span className="font-bold">Funcionou</span>
                            </>
                          ) : (
                            <>
                              <ThumbsDown className="w-5 h-5" />
                              <span className="font-bold">Não Funcionou</span>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="relative group/badge">
                        <div className="absolute inset-0 bg-yellow-500/30 rounded-xl blur-xl group-hover/badge:blur-2xl transition-all animate-pulse"></div>
                        <div className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 bg-gradient-to-r from-yellow-900/40 to-orange-900/30 border-yellow-500/60 text-yellow-300 backdrop-blur-sm shadow-lg">
                          <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                          <span className="font-bold">Aguardando Feedback</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview do follow-up em formato de chat */}
                <div className="relative bg-gradient-to-br from-gray-800/60 to-gray-900/40 rounded-xl mb-4 overflow-hidden border border-gray-700/50 hover:border-green-500/30 transition-all duration-300 shadow-inner">
                  {/* Header do chat com botão de expandir */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-sm">
                    <span className="text-xs font-bold text-gray-300 flex items-center gap-2 uppercase tracking-wider">
                      <MessageSquare className="w-4 h-4 text-green-400" />
                      Conversa do Follow-up
                    </span>
                    <button
                      onClick={() => toggleChatExpansion(analysis.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-green-400 transition-all px-3 py-1.5 rounded-lg hover:bg-gray-700/50 border border-transparent hover:border-green-500/30"
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

                {/* Detalhes da Avaliação */}
                <div className="relative bg-gradient-to-br from-gray-800/60 to-gray-900/40 rounded-xl mb-4 overflow-hidden border border-gray-700/50 hover:border-green-500/30 transition-all duration-300 shadow-inner">
                  {/* Header dos detalhes */}
                  <button
                    onClick={() => toggleDetailsExpansion(analysis.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gradient-to-r hover:from-gray-700/50 hover:to-gray-800/50 transition-all duration-300 group/details"
                  >
                    <span className="text-sm font-bold text-gray-300 flex items-center gap-2 uppercase tracking-wider group-hover/details:text-green-400 transition-colors">
                      <Eye className="w-5 h-5 text-green-400 group-hover/details:scale-110 transition-transform" />
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
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-700/50 pt-4">
                      {/* Notas por Critério */}
                      {analysis.avaliacao.notas && (
                        <div className="bg-gray-900/40 rounded-lg p-4 border border-gray-700/30">
                          <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                            <Award className="w-4 h-4 text-yellow-400" />
                            Notas Detalhadas por Critério
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(analysis.avaliacao.notas).map(([criterio, dados]: [string, any]) => {
                              const getNoteColor = (nota: number) => {
                                if (nota >= 8) return 'text-green-400'
                                if (nota >= 6) return 'text-yellow-400'
                                if (nota >= 4) return 'text-orange-400'
                                return 'text-red-400'
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
                                <div key={criterio} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                      {criterioLabels[criterio] || criterio}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-lg font-bold ${getNoteColor(dados.nota)}`}>
                                        {dados.nota.toFixed(1)}
                                      </span>
                                      <span className="text-[10px] text-gray-500">
                                        (peso {dados.peso})
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-gray-400 leading-relaxed">{dados.comentario}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Pontos Positivos */}
                      {analysis.avaliacao.pontos_positivos && analysis.avaliacao.pontos_positivos.length > 0 && (
                        <div className="bg-green-900/10 rounded-lg p-4 border border-green-500/20">
                          <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                            <Star className="w-4 h-4" />
                            Pontos Positivos
                          </h4>
                          <ul className="space-y-2">
                            {analysis.avaliacao.pontos_positivos.map((ponto: string, idx: number) => (
                              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-green-400 mt-1 flex-shrink-0">✓</span>
                                <span>{ponto}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Pontos a Melhorar */}
                      {analysis.avaliacao.pontos_melhorar && analysis.avaliacao.pontos_melhorar.length > 0 && (
                        <div className="bg-orange-900/10 rounded-lg p-4 border border-orange-500/20">
                          <h4 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Pontos a Melhorar
                          </h4>
                          <div className="space-y-3">
                            {analysis.avaliacao.pontos_melhorar.map((item: any, idx: number) => (
                              <div key={idx} className="bg-gray-800/30 rounded-lg p-3 border border-orange-500/10">
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="text-orange-400 mt-1 flex-shrink-0">⚠</span>
                                  <p className="text-sm text-gray-300 font-medium">{item.problema}</p>
                                </div>
                                <div className="ml-5 flex items-start gap-2">
                                  <Lightbulb className="w-3 h-3 text-yellow-400 mt-1 flex-shrink-0" />
                                  <p className="text-xs text-gray-400 leading-relaxed">
                                    <span className="text-yellow-400 font-medium">Como resolver:</span> {item.como_resolver}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Versão Reescrita */}
                      {analysis.avaliacao.versao_reescrita && (
                        <div className="bg-blue-900/10 rounded-lg p-4 border border-blue-500/20">
                          <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                            <Edit3 className="w-4 h-4" />
                            Versão Reescrita Sugerida
                          </h4>
                          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                              {analysis.avaliacao.versao_reescrita}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Dica Principal */}
                      {analysis.avaliacao.dica_principal && (
                        <div className="bg-purple-900/10 rounded-lg p-4 border border-purple-500/20">
                          <h4 className="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Dica Principal
                          </h4>
                          <p className="text-sm text-gray-300 leading-relaxed italic">
                            "{analysis.avaliacao.dica_principal}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Ações */}
                {!analysis.result && (
                  <div className="relative flex gap-4">
                    <button
                      onClick={() => handleMarkResult(analysis.id, true)}
                      disabled={isSubmitting}
                      className="group/success relative flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_50px_rgba(34,197,94,0.5)] hover:scale-105 disabled:hover:scale-100"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover/success:opacity-100 transition-opacity rounded-xl"></div>
                      <ThumbsUp className="relative w-5 h-5 group-hover/success:scale-110 transition-transform" />
                      <span className="relative">Follow-up Funcionou</span>
                    </button>
                    <button
                      onClick={() => handleMarkResult(analysis.id, false)}
                      disabled={isSubmitting}
                      className="group/fail relative flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:shadow-[0_0_50px_rgba(239,68,68,0.5)] hover:scale-105 disabled:hover:scale-100"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover/fail:opacity-100 transition-opacity rounded-xl"></div>
                      <ThumbsDown className="relative w-5 h-5 group-hover/fail:scale-110 transition-transform" />
                      <span className="relative">Não Funcionou</span>
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
