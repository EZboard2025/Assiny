import { supabase } from '@/lib/supabase'

/**
 * Obtém o company_id do usuário autenticado
 * @returns company_id ou null se não encontrado
 */
export async function getCompanyIdFromUser(): Promise<string | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('[getCompanyId] Erro de autenticação:', authError)
      return null
    }

    if (!user) {
      console.error('[getCompanyId] Usuário não autenticado')
      return null
    }

    console.log('[getCompanyId] Buscando company_id para user:', user.id)

    const { data, error } = await supabase
      .from('employees')
      .select('company_id, user_id')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('[getCompanyId] Erro ao buscar company_id:', error)
      console.error('[getCompanyId] User ID:', user.id)
      return null
    }

    if (!data?.company_id) {
      console.error('[getCompanyId] company_id não encontrado para user:', user.id)
      console.error('[getCompanyId] Employee data:', data)
      return null
    }

    console.log('[getCompanyId] ✅ company_id encontrado:', data.company_id)
    return data.company_id
  } catch (error) {
    console.error('[getCompanyId] Erro inesperado:', error)
    return null
  }
}

/**
 * Obtém o company_id de um usuário específico (server-side)
 * @param userId - ID do usuário
 * @returns company_id ou null se não encontrado
 */
export async function getCompanyIdFromUserId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[getCompanyIdFromUserId] Erro ao buscar company_id:', error)
      return null
    }

    return data?.company_id || null
  } catch (error) {
    console.error('[getCompanyIdFromUserId] Erro inesperado:', error)
    return null
  }
}
