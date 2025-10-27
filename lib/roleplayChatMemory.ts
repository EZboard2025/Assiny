import { supabase } from './supabase'

/**
 * Salva mensagem na tabela roleplay_chat_memory (formato LangChain)
 */
export async function saveRoleplayChatMessage(
  sessionId: string,
  message: string,
  type: 'human' | 'ai',
  userId: string,
  companyId: string,
  context?: any
) {
  try {
    const messageData = {
      session_id: sessionId,
      message: {
        type: type,
        data: {
          content: message
        }
      },
      context: context || null,
      user_id: userId,
      company_id: companyId
    }

    const { error } = await supabase
      .from('roleplay_chat_memory')
      .insert(messageData)

    if (error) {
      console.error('❌ Erro ao salvar mensagem no roleplay_chat_memory:', error)
      throw error
    }

    console.log('✅ Mensagem salva no roleplay_chat_memory:', { sessionId, type })
  } catch (error) {
    console.error('❌ Erro inesperado ao salvar mensagem:', error)
    throw error
  }
}

/**
 * Busca histórico de mensagens de uma sessão
 */
export async function getRoleplayChatHistory(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('roleplay_chat_memory')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ Erro ao buscar histórico:', error)
      throw error
    }

    return data || []
  } catch (error) {
    console.error('❌ Erro inesperado ao buscar histórico:', error)
    throw error
  }
}
