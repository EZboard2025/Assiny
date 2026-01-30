import { supabase } from '@/lib/supabase'
import { PlanType, PLAN_CONFIGS } from '@/lib/types/plans'

// Interface para retorno das verificações
export interface PlanCheckResult {
  allowed: boolean
  reason?: string
  limit?: number | null
  currentUsage?: number
  remaining?: number | null
}

// Buscar o plano de treinamento da empresa
export async function getCompanyTrainingPlan(companyId: string): Promise<PlanType | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('training_plan')
    .eq('id', companyId)
    .single()

  if (error || !data) return null
  return data.training_plan as PlanType
}

// Verificar se precisa resetar o contador mensal de créditos
async function checkAndResetMonthlyCredits(companyId: string): Promise<void> {
  const { data: company } = await supabase
    .from('companies')
    .select('monthly_credits_reset_at')
    .eq('id', companyId)
    .single()

  if (!company) return

  const lastReset = new Date(company.monthly_credits_reset_at)
  const now = new Date()

  // Verifica se passou para um novo mês
  const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                     now.getFullYear() !== lastReset.getFullYear()

  // Reset se mudou o mês
  if (isNewMonth) {
    await supabase
      .from('companies')
      .update({
        monthly_credits_used: 0,
        monthly_credits_reset_at: now.toISOString()
      })
      .eq('id', companyId)
  }
}

// Verificar se pode criar uma nova simulação (roleplay)
export async function canCreateRoleplay(companyId: string, userId?: string): Promise<PlanCheckResult> {
  // Resetar contador se necessário
  await checkAndResetMonthlyCredits(companyId)

  // Buscar plano e contador atual
  const { data: company } = await supabase
    .from('companies')
    .select('training_plan, monthly_credits_used')
    .eq('id', companyId)
    .single()

  if (!company) {
    return { allowed: false, reason: 'Empresa não encontrada' }
  }

  const plan = company.training_plan as PlanType
  const currentUsage = company.monthly_credits_used || 0
  const config = PLAN_CONFIGS[plan]

  // Planos ilimitados (Enterprise)
  if (config.monthlyCredits === null) {
    return { allowed: true }
  }

  // Verificar limite de créditos mensais
  const limit = config.monthlyCredits
  const remaining = limit - currentUsage

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Limite de ${limit} créditos/mês atingido. Créditos renovam no próximo mês ou adquira pacotes extras.`,
      limit,
      currentUsage,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit,
    currentUsage,
    remaining
  }
}

// Incrementar contador de créditos usados
export async function incrementCreditsUsed(companyId: string): Promise<void> {
  const { data: company } = await supabase
    .from('companies')
    .select('monthly_credits_used')
    .eq('id', companyId)
    .single()

  const currentUsage = company?.monthly_credits_used || 0

  await supabase
    .from('companies')
    .update({ monthly_credits_used: currentUsage + 1 })
    .eq('id', companyId)
}

// Alias para compatibilidade - incrementar contador de roleplay
export async function incrementRoleplayCount(companyId: string): Promise<void> {
  return incrementCreditsUsed(companyId)
}

// Verificar se pode adicionar um novo vendedor
export async function canAddSeller(companyId: string): Promise<PlanCheckResult> {
  const plan = await getCompanyTrainingPlan(companyId)
  if (!plan) return { allowed: false, reason: 'Plano não encontrado' }

  const config = PLAN_CONFIGS[plan]

  // Planos ilimitados
  if (config.maxSellers === null) {
    return { allowed: true }
  }

  // Contar vendedores atuais
  const { count } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const currentCount = count || 0
  const limit = config.maxSellers

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason: `Limite de ${limit} vendedor(es) atingido para o plano ${plan.toUpperCase()}.`,
      limit,
      currentUsage: currentCount,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit,
    currentUsage: currentCount,
    remaining: limit - currentCount
  }
}

// Verificar se tem acesso ao Chat IA
export async function hasAccessToChatIA(companyId: string): Promise<boolean> {
  const plan = await getCompanyTrainingPlan(companyId)
  if (!plan) return false

  return PLAN_CONFIGS[plan].hasChatIA
}

// Verificar se tem acesso ao PDI
export async function hasAccessToPDI(companyId: string): Promise<boolean> {
  const plan = await getCompanyTrainingPlan(companyId)
  if (!plan) return false

  return PLAN_CONFIGS[plan].hasPDI
}

// Verificar se tem acesso ao Follow-up
export async function hasAccessToFollowUp(companyId: string): Promise<boolean> {
  const plan = await getCompanyTrainingPlan(companyId)
  if (!plan) return false

  return PLAN_CONFIGS[plan].hasFollowUp
}

// Obter resumo de uso do plano
export async function getPlanUsageSummary(companyId: string) {
  const trainingPlan = await getCompanyTrainingPlan(companyId)

  if (!trainingPlan) return null

  const { data: company } = await supabase
    .from('companies')
    .select('monthly_credits_used, monthly_credits_reset_at')
    .eq('id', companyId)
    .single()

  const { count: sellersCount } = await supabase
    .from('employees')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const trainingConfig = PLAN_CONFIGS[trainingPlan]

  return {
    plan: trainingPlan,
    credits: {
      used: company?.monthly_credits_used || 0,
      limit: trainingConfig.monthlyCredits,
      resetDate: company?.monthly_credits_reset_at
    },
    sellers: {
      count: sellersCount || 0,
      limit: trainingConfig.maxSellers
    },
    features: {
      chatIA: trainingConfig.hasChatIA,
      pdi: trainingConfig.hasPDI,
      followUp: trainingConfig.hasFollowUp
    },
    extraCreditsPackages: trainingConfig.extraCreditsPackages
  }
}

// Obter créditos restantes
export async function getRemainingCredits(companyId: string): Promise<{
  remaining: number | null
  limit: number | null
  used: number
  resetDate: string | null
}> {
  await checkAndResetMonthlyCredits(companyId)

  const { data: company } = await supabase
    .from('companies')
    .select('training_plan, monthly_credits_used, monthly_credits_reset_at')
    .eq('id', companyId)
    .single()

  if (!company) {
    return { remaining: null, limit: null, used: 0, resetDate: null }
  }

  const plan = company.training_plan as PlanType
  const config = PLAN_CONFIGS[plan]
  const used = company.monthly_credits_used || 0
  const limit = config.monthlyCredits

  return {
    remaining: limit !== null ? Math.max(0, limit - used) : null,
    limit,
    used,
    resetDate: company.monthly_credits_reset_at
  }
}
