'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, ThumbsUp, ThumbsDown, MessageSquare, Target, Calendar, Loader2 } from 'lucide-react'

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

                {/* Preview do follow-up */}
                <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-300 line-clamp-3">
                    {analysis.transcricao_filtrada}
                  </p>
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
