import { supabase } from '@/lib/supabase'
import { PlanType, PLAN_CONFIGS, hasFeature, checkLimit } from '@/lib/types/plans'

interface CompanyPlanData {
  id: string
  plan: PlanType
  weekly_roleplay_count: number
  weekly_roleplay_reset_at: string
  selection_candidates_used: number
  selection_plan_expires_at: string | null
}

/**
 * Busca os dados do plano da empresa
 */
export async function getCompanyPlanData(companyId: string): Promise<CompanyPlanData | null> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, plan, weekly_roleplay_count, weekly_roleplay_reset_at, selection_candidates_used, selection_plan_expires_at')
      .eq('id', companyId)
      .single()

    if (error || !data) {
      console.error('Erro ao buscar dados do plano:', error)
      return null
    }

    // Verificar se precisa resetar o contador semanal
    const lastReset = new Date(data.weekly_roleplay_reset_at)
    const now = new Date()
    const daysSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)

    // Se passou mais de 7 dias, resetar contador
    if (daysSinceReset >= 7) {
      await supabase
        .from('companies')
        .update({
          weekly_roleplay_count: 0,
          weekly_roleplay_reset_at: now.toISOString()
        })
        .eq('id', companyId)

      data.weekly_roleplay_count = 0
      data.weekly_roleplay_reset_at = now.toISOString()
    }

    return data as CompanyPlanData
  } catch (error) {
    console.error('Erro ao obter dados do plano:', error)
    return null
  }
}

/**
 * Verifica se a empresa pode criar mais roleplays de treinamento
 */
export async function canCreateRoleplay(companyId: string): Promise<{
  allowed: boolean
  reason?: string
  limit?: number
  used?: number
  remaining?: number
}> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return { allowed: false, reason: 'Erro ao verificar plano' }
  }

  const config = PLAN_CONFIGS[planData.plan]

  // Se é plano de processo seletivo, não pode fazer roleplay de treinamento
  if (config.isSelectionPlan) {
    return { allowed: false, reason: 'Plano de processo seletivo não permite treinamento' }
  }

  // Verificar se tem acesso a roleplay
  if (!config.hasRoleplay) {
    return { allowed: false, reason: 'Seu plano não inclui simulações de roleplay' }
  }

  // Verificar limite semanal
  if (config.maxRoleplaysPerWeek === null) {
    return { allowed: true } // Ilimitado
  }

  const remaining = config.maxRoleplaysPerWeek - planData.weekly_roleplay_count

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Limite semanal de ${config.maxRoleplaysPerWeek} simulações atingido`,
      limit: config.maxRoleplaysPerWeek,
      used: planData.weekly_roleplay_count,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit: config.maxRoleplaysPerWeek,
    used: planData.weekly_roleplay_count,
    remaining
  }
}

/**
 * Incrementa o contador de roleplays usados
 */
export async function incrementRoleplayCount(companyId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('increment', {
      table_name: 'companies',
      column_name: 'weekly_roleplay_count',
      row_id: companyId
    })

    if (error) {
      // Se a função RPC não existir, fazer update manual
      const { data: current } = await supabase
        .from('companies')
        .select('weekly_roleplay_count')
        .eq('id', companyId)
        .single()

      if (current) {
        await supabase
          .from('companies')
          .update({ weekly_roleplay_count: (current.weekly_roleplay_count || 0) + 1 })
          .eq('id', companyId)
      }
    }

    return true
  } catch (error) {
    console.error('Erro ao incrementar contador de roleplay:', error)
    return false
  }
}

/**
 * Verifica se pode criar personas
 */
export async function canCreatePersona(companyId: string, currentCount: number): Promise<{
  allowed: boolean
  reason?: string
  limit?: number
  remaining?: number
}> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return { allowed: false, reason: 'Erro ao verificar plano' }
  }

  const config = PLAN_CONFIGS[planData.plan]

  if (!config.hasCustomPersonas) {
    return { allowed: false, reason: 'Seu plano não permite criar personas personalizadas' }
  }

  if (config.maxPersonas === null) {
    return { allowed: true } // Ilimitado
  }

  const remaining = config.maxPersonas - currentCount

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Limite de ${config.maxPersonas} personas atingido`,
      limit: config.maxPersonas,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit: config.maxPersonas,
    remaining
  }
}

/**
 * Verifica se pode criar objeções
 */
export async function canCreateObjection(companyId: string, currentCount: number): Promise<{
  allowed: boolean
  reason?: string
  limit?: number
  remaining?: number
}> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return { allowed: false, reason: 'Erro ao verificar plano' }
  }

  const config = PLAN_CONFIGS[planData.plan]

  if (!config.hasCustomObjections) {
    return { allowed: false, reason: 'Seu plano não permite criar objeções personalizadas' }
  }

  if (config.maxObjections === null) {
    return { allowed: true } // Ilimitado
  }

  const remaining = config.maxObjections - currentCount

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Limite de ${config.maxObjections} objeções atingido`,
      limit: config.maxObjections,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit: config.maxObjections,
    remaining
  }
}

/**
 * Verifica quantas formas de quebrar objeção o plano permite
 */
export async function getMaxRebuttals(companyId: string): Promise<number> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return 3 // Default
  }

  return PLAN_CONFIGS[planData.plan].maxObjectionRebuttals
}

/**
 * Verifica se pode usar Chat IA
 */
export async function canUseChatIA(companyId: string): Promise<boolean> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return false
  }

  return PLAN_CONFIGS[planData.plan].hasChatIA
}

/**
 * Verifica se pode usar Follow-up
 */
export async function canUseFollowUp(companyId: string): Promise<boolean> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return true // Por enquanto liberado para todos
  }

  return PLAN_CONFIGS[planData.plan].hasFollowUp
}

/**
 * Verifica se pode gerar PDI
 */
export async function canGeneratePDI(companyId: string): Promise<boolean> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return false
  }

  return PLAN_CONFIGS[planData.plan].hasPDI
}

/**
 * Verifica se pode acessar ConfigHub
 */
export async function canAccessConfigHub(companyId: string): Promise<boolean> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return false
  }

  return PLAN_CONFIGS[planData.plan].hasConfigHub
}

/**
 * Verifica se pode criar candidato em processo seletivo
 */
export async function canCreateSelectionCandidate(companyId: string): Promise<{
  allowed: boolean
  reason?: string
  limit?: number
  used?: number
  remaining?: number
}> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return { allowed: false, reason: 'Erro ao verificar plano' }
  }

  const config = PLAN_CONFIGS[planData.plan]

  // Verificar se é plano de processo seletivo
  if (!config.isSelectionPlan) {
    return { allowed: false, reason: 'Seu plano não é de processo seletivo' }
  }

  // Verificar se o plano ainda está válido (30 dias)
  if (planData.selection_plan_expires_at) {
    const expiryDate = new Date(planData.selection_plan_expires_at)
    const now = new Date()

    if (now > expiryDate) {
      return { allowed: false, reason: 'Plano de processo seletivo expirado' }
    }
  }

  // Verificar limite de candidatos
  if (config.maxSelectionCandidates === null) {
    return { allowed: true } // Ilimitado
  }

  const remaining = config.maxSelectionCandidates - (planData.selection_candidates_used || 0)

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Limite de ${config.maxSelectionCandidates} candidatos atingido`,
      limit: config.maxSelectionCandidates,
      used: planData.selection_candidates_used || 0,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit: config.maxSelectionCandidates,
    used: planData.selection_candidates_used || 0,
    remaining
  }
}

/**
 * Incrementa o contador de candidatos avaliados
 */
export async function incrementSelectionCandidateCount(companyId: string): Promise<boolean> {
  try {
    const { data: current } = await supabase
      .from('companies')
      .select('selection_candidates_used')
      .eq('id', companyId)
      .single()

    if (current) {
      await supabase
        .from('companies')
        .update({ selection_candidates_used: (current.selection_candidates_used || 0) + 1 })
        .eq('id', companyId)
    }

    return true
  } catch (error) {
    console.error('Erro ao incrementar contador de candidatos:', error)
    return false
  }
}