import { supabase } from './supabase'
import { createClient } from '@supabase/supabase-js'

// Tipos
export interface RoleplayLink {
  id: string
  company_id: string
  link_code: string
  name: string
  description?: string
  config: {
    age: string
    temperament: string
    persona_id: string
    objection_ids: string[]
  }
  is_active: boolean
  usage_count: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface RoleplayUnico {
  id: string
  link_id?: string
  company_id: string
  participant_name: string
  participant_email?: string
  participant_phone?: string
  thread_id?: string
  session_id?: string
  messages: Array<{
    role: 'client' | 'seller'
    text: string
    timestamp: string
  }>
  config: {
    age: string
    temperament: string
    persona_id: string
    objection_ids: string[]
  }
  evaluation?: any
  overall_score?: number
  performance_level?: string
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  ended_at?: string
  duration_seconds?: number
  created_at: string
  updated_at: string
}

export interface RoleplayLinkStats {
  id: string
  company_id: string
  link_code: string
  name: string
  is_active: boolean
  usage_count: number
  total_sessions: number
  completed_sessions: number
  abandoned_sessions: number
  avg_score?: number
  max_score?: number
  min_score?: number
  avg_duration_seconds?: number
  last_used_at?: string
}

// Cliente service para operações sem autenticação
const getServiceClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ====================================
// FUNÇÕES PARA GESTORES (AUTENTICADAS)
// ====================================

/**
 * Criar um novo link de roleplay
 * Apenas admins podem criar
 */
export async function createRoleplayLink(
  name: string,
  description: string | undefined,
  config: RoleplayLink['config'],
  companyId: string
): Promise<{ data: RoleplayLink | null; error: Error | null }> {
  try {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      return { data: null, error: new Error('Usuário não autenticado') }
    }

    // Gerar código único (8 caracteres alfanuméricos)
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = ''
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return code
    }

    // Tentar até 10 vezes para garantir código único
    let linkCode = ''
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      linkCode = generateCode()

      // Verificar se já existe
      const { data: existing } = await supabase
        .from('roleplay_links')
        .select('id')
        .eq('link_code', linkCode)
        .single()

      if (!existing) break
      attempts++
    }

    if (attempts === maxAttempts) {
      return { data: null, error: new Error('Não foi possível gerar um código único') }
    }

    const { data, error } = await supabase
      .from('roleplay_links')
      .insert({
        company_id: companyId,
        link_code: linkCode,
        name,
        description,
        config,
        created_by: user.user.id
      })
      .select()
      .single()

    return { data, error }
  } catch (error: any) {
    return { data: null, error }
  }
}

/**
 * Listar links de roleplay da empresa
 * Apenas admins podem ver
 */
export async function listRoleplayLinks(
  companyId: string
): Promise<{ data: RoleplayLink[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('roleplay_links')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    return { data, error }
  } catch (error: any) {
    return { data: null, error }
  }
}

/**
 * Obter estatísticas dos links
 */
export async function getRoleplayLinkStats(
  companyId: string
): Promise<{ data: RoleplayLinkStats[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('roleplay_link_stats')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    return { data, error }
  } catch (error: any) {
    return { data: null, error }
  }
}

/**
 * Atualizar configuração de um link
 * Apenas admins podem atualizar
 */
export async function updateRoleplayLink(
  linkId: string,
  updates: Partial<{
    name: string
    description: string
    config: RoleplayLink['config']
    is_active: boolean
  }>
): Promise<{ data: RoleplayLink | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('roleplay_links')
      .update(updates)
      .eq('id', linkId)
      .select()
      .single()

    return { data, error }
  } catch (error: any) {
    return { data: null, error }
  }
}

/**
 * Deletar um link
 * Apenas admins podem deletar
 */
export async function deleteRoleplayLink(
  linkId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('roleplay_links')
      .delete()
      .eq('id', linkId)

    return { error }
  } catch (error: any) {
    return { error }
  }
}

/**
 * Listar histórico de roleplays únicos
 * Apenas admins podem ver
 */
export async function listRoleplaysUnicos(
  companyId: string,
  filters?: {
    linkId?: string
    status?: 'in_progress' | 'completed' | 'abandoned'
    startDate?: string
    endDate?: string
  }
): Promise<{ data: RoleplayUnico[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('roleplays_unicos')
      .select('*')
      .eq('company_id', companyId)

    if (filters?.linkId) {
      query = query.eq('link_id', filters.linkId)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate)
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    return { data, error }
  } catch (error: any) {
    return { data: null, error }
  }
}

/**
 * Obter detalhes de um roleplay único
 * Apenas admins podem ver
 */
export async function getRoleplayUnicoDetails(
  roleplayId: string
): Promise<{ data: RoleplayUnico | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('roleplays_unicos')
      .select('*')
      .eq('id', roleplayId)
      .single()

    return { data, error }
  } catch (error: any) {
    return { data: null, error }
  }
}

// ====================================
// FUNÇÕES PÚBLICAS (SEM AUTENTICAÇÃO)
// Usam service role para bypass do RLS
// ====================================

/**
 * Buscar configuração de um link pelo código (público)
 */
export async function getRoleplayLinkByCode(
  linkCode: string
): Promise<{ data: RoleplayLink | null; error: Error | null }> {
  try {
    const serviceClient = getServiceClient()

    const { data, error } = await serviceClient
      .from('roleplay_links')
      .select('*')
      .eq('link_code', linkCode)
      .eq('is_active', true)
      .single()

    return { data, error }
  } catch (error: any) {
    return { data: null, error }
  }
}

/**
 * Criar sessão de roleplay único (público)
 */
export async function createRoleplayUnico(
  linkId: string,
  companyId: string,
  participantName: string,
  config: RoleplayLink['config'],
  participantEmail?: string,
  participantPhone?: string
): Promise<{ data: RoleplayUnico | null; error: Error | null }> {
  try {
    const serviceClient = getServiceClient()

    // Gerar session_id único
    const sessionId = `unique_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const { data, error } = await serviceClient
      .from('roleplays_unicos')
      .insert({
        link_id: linkId,
        company_id: companyId,
        participant_name: participantName,
        participant_email: participantEmail,
        participant_phone: participantPhone,
        session_id: sessionId,
        config,
        messages: [],
        status: 'in_progress'
      })
      .select()
      .single()

    return { data, error }
  } catch (error: any) {
    return { data: null, error }
  }
}

/**
 * Atualizar sessão de roleplay único (público)
 */
export async function updateRoleplayUnico(
  sessionId: string,
  updates: Partial<{
    thread_id: string
    messages: RoleplayUnico['messages']
    evaluation: any
    overall_score: number
    performance_level: string
    status: 'in_progress' | 'completed' | 'abandoned'
    ended_at: string
    duration_seconds: number
  }>
): Promise<{ data: RoleplayUnico | null; error: Error | null }> {
  try {
    const serviceClient = getServiceClient()

    const { data, error } = await serviceClient
      .from('roleplays_unicos')
      .update(updates)
      .eq('session_id', sessionId)
      .select()
      .single()

    return { data, error }
  } catch (error: any) {
    return { data: null, error }
  }
}

/**
 * Adicionar mensagem ao roleplay único (público)
 */
export async function addMessageToRoleplayUnico(
  sessionId: string,
  message: {
    role: 'client' | 'seller'
    text: string
    timestamp: string
  }
): Promise<{ error: Error | null }> {
  try {
    const serviceClient = getServiceClient()

    // Buscar mensagens atuais
    const { data: session, error: fetchError } = await serviceClient
      .from('roleplays_unicos')
      .select('messages')
      .eq('session_id', sessionId)
      .single()

    if (fetchError) return { error: fetchError }

    // Adicionar nova mensagem
    const updatedMessages = [...(session.messages || []), message]

    // Atualizar no banco
    const { error } = await serviceClient
      .from('roleplays_unicos')
      .update({ messages: updatedMessages })
      .eq('session_id', sessionId)

    return { error }
  } catch (error: any) {
    return { error }
  }
}

/**
 * Finalizar roleplay único (público)
 */
export async function endRoleplayUnico(
  sessionId: string,
  evaluation?: any
): Promise<{ error: Error | null }> {
  try {
    const serviceClient = getServiceClient()

    // Buscar data de início
    const { data: session } = await serviceClient
      .from('roleplays_unicos')
      .select('started_at')
      .eq('session_id', sessionId)
      .single()

    const endedAt = new Date().toISOString()
    const durationSeconds = session
      ? Math.floor((new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1000)
      : 0

    // Extrair scores da avaliação se houver
    let updates: any = {
      status: 'completed',
      ended_at: endedAt,
      duration_seconds: durationSeconds
    }

    if (evaluation) {
      updates.evaluation = evaluation
      updates.overall_score = evaluation.overall_score || null
      updates.performance_level = evaluation.performance_level || null
    }

    const { error } = await serviceClient
      .from('roleplays_unicos')
      .update(updates)
      .eq('session_id', sessionId)

    return { error }
  } catch (error: any) {
    return { error }
  }
}