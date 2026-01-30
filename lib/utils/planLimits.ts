import { supabase } from '@/lib/supabase'
import { PlanType, PLAN_CONFIGS } from '@/lib/types/plans'

interface CompanyPlanData {
  id: string
  training_plan: PlanType
  monthly_credits_used: number
  monthly_credits_reset_at: string
  extra_monthly_credits: number
}

/**
 * Busca os dados do plano da empresa
 */
export async function getCompanyPlanData(companyId: string): Promise<CompanyPlanData | null> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('id, training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
      .eq('id', companyId)
      .single()

    if (error || !data) {
      console.error('Erro ao buscar dados do plano:', error)
      return null
    }

    // Verificar se precisa resetar o contador mensal
    const lastReset = new Date(data.monthly_credits_reset_at)
    const now = new Date()

    // Verifica se passou para um novo mês
    const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                       now.getFullYear() !== lastReset.getFullYear()

    // Se mudou o mês, resetar contador - zera créditos usados E créditos extras
    if (isNewMonth) {
      await supabase
        .from('companies')
        .update({
          monthly_credits_used: 0,
          extra_monthly_credits: 0, // Créditos extras também são zerados no reset mensal
          monthly_credits_reset_at: now.toISOString()
        })
        .eq('id', companyId)

      data.monthly_credits_used = 0
      data.extra_monthly_credits = 0
      data.monthly_credits_reset_at = now.toISOString()
    }

    return {
      ...data,
      extra_monthly_credits: data.extra_monthly_credits || 0
    } as CompanyPlanData
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
  limit?: number | null
  used?: number
  remaining?: number | null
}> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return { allowed: false, reason: 'Erro ao verificar plano' }
  }

  const config = PLAN_CONFIGS[planData.training_plan]

  // Verificar se tem acesso a roleplay
  if (!config.hasRoleplay) {
    return { allowed: false, reason: 'Seu plano não inclui simulações de roleplay' }
  }

  // Verificar limite mensal de créditos
  if (config.monthlyCredits === null) {
    return { allowed: true } // Ilimitado
  }

  // Calcular limite total (plano base + créditos extras)
  const baseLimit = config.monthlyCredits
  const totalLimit = baseLimit + planData.extra_monthly_credits
  const remaining = totalLimit - planData.monthly_credits_used

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Limite de ${totalLimit} créditos/mês atingido. Créditos renovam no próximo mês ou adquira pacotes extras.`,
      limit: totalLimit,
      used: planData.monthly_credits_used,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit: totalLimit,
    used: planData.monthly_credits_used,
    remaining
  }
}

/**
 * Incrementa o contador de créditos usados
 */
export async function incrementCreditsUsed(companyId: string): Promise<boolean> {
  try {
    const { data: current } = await supabase
      .from('companies')
      .select('monthly_credits_used')
      .eq('id', companyId)
      .single()

    if (current) {
      await supabase
        .from('companies')
        .update({ monthly_credits_used: (current.monthly_credits_used || 0) + 1 })
        .eq('id', companyId)
    }

    return true
  } catch (error) {
    console.error('Erro ao incrementar contador de créditos:', error)
    return false
  }
}

/**
 * Alias para compatibilidade - incrementa contador de roleplay
 */
export async function incrementRoleplayCount(companyId: string): Promise<boolean> {
  return incrementCreditsUsed(companyId)
}

/**
 * Verifica se pode adicionar um novo vendedor
 */
export async function canAddSeller(companyId: string, currentCount: number): Promise<{
  allowed: boolean
  reason?: string
  limit?: number | null
  remaining?: number | null
}> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return { allowed: false, reason: 'Erro ao verificar plano' }
  }

  const config = PLAN_CONFIGS[planData.training_plan]

  if (config.maxSellers === null) {
    return { allowed: true } // Ilimitado
  }

  const remaining = config.maxSellers - currentCount

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Limite de ${config.maxSellers} vendedor(es) atingido`,
      limit: config.maxSellers,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit: config.maxSellers,
    remaining
  }
}

/**
 * Verifica se pode usar Chat IA
 */
export async function canUseChatIA(companyId: string): Promise<boolean> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return false
  }

  return PLAN_CONFIGS[planData.training_plan].hasChatIA
}

/**
 * Verifica se pode usar Follow-up
 */
export async function canUseFollowUp(companyId: string): Promise<boolean> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return true // Por enquanto liberado para todos
  }

  return PLAN_CONFIGS[planData.training_plan].hasFollowUp
}

/**
 * Verifica se pode gerar PDI
 */
export async function canGeneratePDI(companyId: string): Promise<boolean> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return false
  }

  return PLAN_CONFIGS[planData.training_plan].hasPDI
}

/**
 * Verifica se pode acessar ConfigHub
 */
export async function canAccessConfigHub(companyId: string): Promise<boolean> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return false
  }

  return PLAN_CONFIGS[planData.training_plan].hasConfigHub
}

/**
 * Obter créditos restantes
 */
export async function getRemainingCredits(companyId: string): Promise<{
  remaining: number | null
  limit: number | null
  used: number
  resetDate: string | null
}> {
  const planData = await getCompanyPlanData(companyId)

  if (!planData) {
    return { remaining: null, limit: null, used: 0, resetDate: null }
  }

  const config = PLAN_CONFIGS[planData.training_plan]
  const baseLimit = config.monthlyCredits
  // Calcular limite total (plano base + créditos extras)
  const totalLimit = baseLimit !== null ? baseLimit + planData.extra_monthly_credits : null
  const used = planData.monthly_credits_used || 0

  return {
    remaining: totalLimit !== null ? Math.max(0, totalLimit - used) : null,
    limit: totalLimit,
    used,
    resetDate: planData.monthly_credits_reset_at
  }
}
