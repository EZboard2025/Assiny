import { supabase } from './supabase'

export interface RoleplayMessage {
  role: 'client' | 'seller'
  text: string
  timestamp: string
}

export interface RoleplayConfig {
  age: number
  temperament: string
  segment: string
  objections: string[] | { name: string; rebuttals: string[] }[]
  client_name?: string // Nome do cliente virtual gerado
  objective?: { id: string; name: string; description: string | null } // Objetivo do roleplay
  is_meet_correction?: boolean // Flag para sessoes de correcao Meet
  meet_simulation_config?: any // Configuracao completa da simulacao de correcao
}

export interface RoleplaySession {
  id: string
  user_id: string
  thread_id: string
  config: RoleplayConfig
  messages: RoleplayMessage[]
  started_at: string
  ended_at?: string
  duration_seconds?: number
  status: 'in_progress' | 'completed' | 'abandoned'
  created_at: string
  updated_at: string
}

/**
 * Criar uma nova sessão de roleplay
 */
export async function createRoleplaySession(
  threadId: string,
  config: RoleplayConfig
): Promise<RoleplaySession | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('Usuário não autenticado')
      return null
    }

    // Obter company_id do employee
    const { data: employee } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const { data, error } = await supabase
      .from('roleplay_sessions')
      .insert({
        user_id: user.id,
        thread_id: threadId,
        config,
        messages: [],
        status: 'in_progress',
        company_id: employee?.company_id
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar sessão de roleplay:', error)
      return null
    }

    console.log('✅ Sessão de roleplay criada:', data.id)
    return data
  } catch (error) {
    console.error('Erro ao criar sessão de roleplay:', error)
    return null
  }
}

/**
 * Adicionar mensagem à sessão
 */
export async function addMessageToSession(
  sessionId: string,
  message: RoleplayMessage
): Promise<boolean> {
  try {
    // Buscar sessão atual
    const { data: session, error: fetchError } = await supabase
      .from('roleplay_sessions')
      .select('messages')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      console.error('Erro ao buscar sessão:', fetchError)
      return false
    }

    // Adicionar nova mensagem
    const updatedMessages = [...session.messages, message]

    // Atualizar sessão
    const { error: updateError } = await supabase
      .from('roleplay_sessions')
      .update({ messages: updatedMessages })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Erro ao adicionar mensagem:', updateError)
      return false
    }

    console.log('✅ Mensagem adicionada à sessão')
    return true
  } catch (error) {
    console.error('Erro ao adicionar mensagem:', error)
    return false
  }
}

/**
 * Finalizar sessão de roleplay
 */
export async function endRoleplaySession(
  sessionId: string,
  status: 'completed' | 'abandoned' = 'completed'
): Promise<boolean> {
  try {
    // Buscar sessão para calcular duração
    const { data: session, error: fetchError } = await supabase
      .from('roleplay_sessions')
      .select('started_at')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      console.error('Erro ao buscar sessão:', fetchError)
      return false
    }

    const startTime = new Date(session.started_at).getTime()
    const endTime = Date.now()
    const durationSeconds = Math.floor((endTime - startTime) / 1000)

    const { error: updateError } = await supabase
      .from('roleplay_sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        status
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('Erro ao finalizar sessão:', updateError)
      return false
    }

    console.log(`✅ Sessão finalizada (${status}) - Duração: ${durationSeconds}s`)
    return true
  } catch (error) {
    console.error('Erro ao finalizar sessão:', error)
    return false
  }
}

/**
 * Buscar sessões do usuário (exclui sessões de desafios)
 */
export async function getUserRoleplaySessions(): Promise<RoleplaySession[]> {
  try {
    // Obter o usuário atual
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('Usuário não autenticado')
      return []
    }

    // Buscar IDs de sessões que são de desafios (para excluir)
    const { data: challengeSessions } = await supabase
      .from('daily_challenges')
      .select('roleplay_session_id')
      .eq('user_id', user.id)
      .not('roleplay_session_id', 'is', null)

    const challengeSessionIds = (challengeSessions || [])
      .map(c => c.roleplay_session_id)
      .filter(Boolean)

    // Buscar sessões excluindo as de desafios (fetch mais para compensar filtro)
    let query = supabase
      .from('roleplay_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)

    // Se houver sessões de desafio, excluí-las
    if (challengeSessionIds.length > 0) {
      query = query.not('id', 'in', `(${challengeSessionIds.join(',')})`)
    }

    // Excluir sessões de correção Meet (usar contains para não filtrar sessões sem a chave)
    query = query.not('config', 'cs', '{"is_meet_correction":true}')

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar sessões:', error)
      return []
    }

    // Só mostrar sessões com avaliação
    const filtered = (data || []).filter(session => session.evaluation != null)

    console.log(`[getUserRoleplaySessions] ${data?.length || 0} sessões encontradas, ${filtered.length} após filtrar incompletas`)
    return filtered
  } catch (error) {
    console.error('Erro ao buscar sessões:', error)
    return []
  }
}

/**
 * Buscar sessões de correção Meet do usuário
 */
export async function getMeetCorrectionSessions(
  limit: number = 50
): Promise<RoleplaySession[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('roleplay_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('config->>is_meet_correction', 'true')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Erro ao buscar sessões de correção:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Erro ao buscar sessões de correção:', error)
    return []
  }
}

/**
 * Buscar sessão específica
 */
export async function getRoleplaySession(
  sessionId: string
): Promise<RoleplaySession | null> {
  try {
    const { data, error } = await supabase
      .from('roleplay_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) {
      console.error('Erro ao buscar sessão:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Erro ao buscar sessão:', error)
    return null
  }
}

/**
 * Deletar sessão
 */
export async function deleteRoleplaySession(
  sessionId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('roleplay_sessions')
      .delete()
      .eq('id', sessionId)

    if (error) {
      console.error('Erro ao deletar sessão:', error)
      return false
    }

    console.log('✅ Sessão deletada')
    return true
  } catch (error) {
    console.error('Erro ao deletar sessão:', error)
    return false
  }
}

/**
 * Buscar TODAS as sessões de roleplay do usuário (incluindo desafios)
 * Para uso no perfil onde queremos métricas consolidadas
 */
export async function getAllUserRoleplaySessions(
  limit: number = 1000
): Promise<RoleplaySession[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('Usuário não autenticado')
      return []
    }

    const { data, error } = await supabase
      .from('roleplay_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Erro ao buscar sessões:', error)
      return []
    }

    console.log(`[getAllUserRoleplaySessions] ${data?.length || 0} sessões encontradas (incluindo desafios)`)
    return data || []
  } catch (error) {
    console.error('Erro ao buscar sessões:', error)
    return []
  }
}

/**
 * Interface para Meet Evaluation
 */
export interface MeetEvaluation {
  id: string
  user_id: string
  company_id: string
  meeting_id?: string
  seller_name?: string
  call_objective?: string
  funnel_stage?: string
  transcript: any
  evaluation: any
  overall_score: number
  performance_level: string
  spin_s_score: number
  spin_p_score: number
  spin_i_score: number
  spin_n_score: number
  created_at: string
  updated_at: string
}

/**
 * Buscar avaliações de Google Meet do usuário
 */
export async function getUserMeetEvaluations(
  limit: number = 100
): Promise<MeetEvaluation[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('❌ [getUserMeetEvaluations] Usuário não autenticado')
      return []
    }

    console.log(`🔍 [getUserMeetEvaluations] Buscando para user_id: ${user.id}`)

    const { data, error } = await supabase
      .from('meet_evaluations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ [getUserMeetEvaluations] Erro ao buscar:', error)
      console.error('❌ Código do erro:', error.code)
      console.error('❌ Mensagem:', error.message)
      console.error('❌ Detalhes:', error.details)
      return []
    }

    console.log(`✅ [getUserMeetEvaluations] ${data?.length || 0} avaliações de Meet encontradas`)
    if (data && data.length > 0) {
      console.log(`📋 [getUserMeetEvaluations] Primeira avaliação:`, {
        id: data[0].id,
        overall_score: data[0].overall_score,
        spin_s_score: data[0].spin_s_score,
        created_at: data[0].created_at
      })
    }
    return data || []
  } catch (error) {
    console.error('❌ [getUserMeetEvaluations] Exceção:', error)
    return []
  }
}

/**
 * Interface unificada para dados de performance (roleplay, meet, challenge)
 */
export interface UnifiedPerformanceData {
  id: string
  source: 'roleplay' | 'meet' | 'challenge'
  overall_score: number
  spin_s: number
  spin_p: number
  spin_i: number
  spin_n: number
  created_at: string
  evaluation?: any
  challengeTitle?: string
}
