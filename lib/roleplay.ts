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
  objections: string[]
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

    const { data, error } = await supabase
      .from('roleplay_sessions')
      .insert({
        user_id: user.id,
        thread_id: threadId,
        config,
        messages: [],
        status: 'in_progress'
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
 * Buscar sessões do usuário
 */
export async function getUserRoleplaySessions(
  limit: number = 10
): Promise<RoleplaySession[]> {
  try {
    const { data, error } = await supabase
      .from('roleplay_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Erro ao buscar sessões:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Erro ao buscar sessões:', error)
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
