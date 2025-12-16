import { supabase } from '@/lib/supabase'

export interface FollowUpAnalysis {
  id: string
  user_id: string
  tipo_venda: 'B2B' | 'B2C'
  canal: string
  fase_funil: string
  contexto: string
  transcricao_original: string
  transcricao_filtrada: string
  avaliacao: {
    notas: {
      valor_agregado: { nota: number; peso: number; comentario: string }
      personalizacao: { nota: number; peso: number; comentario: string }
      tom_consultivo: { nota: number; peso: number; comentario: string }
      objetividade: { nota: number; peso: number; comentario: string }
      cta: { nota: number; peso: number; comentario: string }
      timing: { nota: number; peso: number; comentario: string }
    }
    nota_final: number
    classificacao: string
    pontos_positivos: string[]
    pontos_melhorar: Array<{
      problema: string
      como_resolver: string
    }>
    versao_reescrita: string
    dica_principal: string
  }
  nota_final: number
  classificacao: string
  created_at: string
  updated_at: string
}

/**
 * Busca o histórico de análises de follow-up do usuário
 */
export async function getFollowUpAnalyses(userId?: string) {

  // Se não passou userId, pega do usuário logado
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Usuário não autenticado' }
    userId = user.id
  }

  const { data, error } = await supabase
    .from('followup_analyses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar análises:', error)
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/**
 * Busca uma análise específica por ID
 */
export async function getFollowUpAnalysis(analysisId: string) {

  const { data, error } = await supabase
    .from('followup_analyses')
    .select('*')
    .eq('id', analysisId)
    .single()

  if (error) {
    console.error('Erro ao buscar análise:', error)
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/**
 * Exclui uma análise de follow-up
 */
export async function deleteFollowUpAnalysis(analysisId: string) {

  const { error } = await supabase
    .from('followup_analyses')
    .delete()
    .eq('id', analysisId)

  if (error) {
    console.error('Erro ao excluir análise:', error)
    return { success: false, error: error.message }
  }

  return { success: true, error: null }
}

/**
 * Obtém estatísticas das análises do usuário
 */
export async function getFollowUpStats(userId?: string) {

  // Se não passou userId, pega do usuário logado
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    userId = user.id
  }

  const { data, error } = await supabase
    .from('followup_analyses')
    .select('nota_final, classificacao')
    .eq('user_id', userId)

  if (error || !data) return null

  // Calcular estatísticas
  const totalAnalises = data.length
  const mediaNota = data.length > 0
    ? data.reduce((acc, curr) => acc + curr.nota_final, 0) / data.length
    : 0

  // Contar classificações
  const classificacoes = data.reduce((acc, curr) => {
    acc[curr.classificacao] = (acc[curr.classificacao] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    totalAnalises,
    mediaNota: parseFloat(mediaNota.toFixed(2)),
    classificacoes,
    melhorNota: data.length > 0 ? Math.max(...data.map(d => d.nota_final)) : 0,
    piorNota: data.length > 0 ? Math.min(...data.map(d => d.nota_final)) : 0
  }
}