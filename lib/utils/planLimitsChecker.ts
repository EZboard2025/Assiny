import { supabase } from '@/lib/supabase'
import { PlanType, PLAN_CONFIGS, isTrainingPlan, isSelectionPlan } from '@/lib/types/plans'

// Interface para retorno das verificações
export interface PlanCheckResult {
  allowed: boolean
  reason?: string
  limit?: number
  currentUsage?: number
  remaining?: number
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

// Buscar o plano de seleção da empresa
export async function getCompanySelectionPlan(companyId: string): Promise<PlanType | null> {
  console.log('🔍 Buscando plano de seleção para empresa:', companyId)

  const { data, error } = await supabase
    .from('companies')
    .select('selection_plan')
    .eq('id', companyId)
    .single()

  console.log('📊 Resultado da busca selection_plan:', { data, error })

  if (error) {
    console.error('❌ Erro ao buscar selection_plan:', error)
    return null
  }

  if (!data) {
    console.log('⚠️ Nenhum dado retornado')
    return null
  }

  console.log('✅ Plano de seleção do banco:', data.selection_plan)
  return data.selection_plan as PlanType | null
}

// Verificar se precisa resetar o contador semanal
async function checkAndResetWeeklyCounter(companyId: string): Promise<void> {
  const { data: company } = await supabase
    .from('companies')
    .select('weekly_roleplay_reset_at')
    .eq('id', companyId)
    .single()

  if (!company) return

  const lastReset = new Date(company.weekly_roleplay_reset_at)
  const now = new Date()
  const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24))

  // Reset se passou mais de 7 dias
  if (daysSinceReset >= 7) {
    await supabase
      .from('companies')
      .update({
        weekly_roleplay_count: 0,
        weekly_roleplay_reset_at: now.toISOString()
      })
      .eq('id', companyId)
  }
}

// Verificar se pode criar um novo roleplay
export async function canCreateRoleplay(companyId: string, userId?: string): Promise<PlanCheckResult> {
  // Resetar contador se necessário
  await checkAndResetWeeklyCounter(companyId)

  // Buscar plano e contador atual
  const { data: company } = await supabase
    .from('companies')
    .select('training_plan, weekly_roleplay_count')
    .eq('id', companyId)
    .single()

  if (!company) {
    return { allowed: false, reason: 'Empresa não encontrada' }
  }

  const plan = company.training_plan as PlanType
  const currentCount = company.weekly_roleplay_count || 0
  const config = PLAN_CONFIGS[plan]

  // Planos ilimitados (OG e MAX)
  if (!config.maxRoleplaysPerWeek) {
    return { allowed: true }
  }

  // Verificar limite do plano PRO
  const limit = config.maxRoleplaysPerWeek
  const remaining = limit - currentCount

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: `Limite semanal de ${limit} simulações atingido. Resets às segundas-feiras.`,
      limit,
      currentUsage: currentCount,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit,
    currentUsage: currentCount,
    remaining
  }
}

// Incrementar contador de roleplay
export async function incrementRoleplayCount(companyId: string): Promise<void> {
  const { data: company } = await supabase
    .from('companies')
    .select('weekly_roleplay_count')
    .eq('id', companyId)
    .single()

  const currentCount = company?.weekly_roleplay_count || 0

  await supabase
    .from('companies')
    .update({ weekly_roleplay_count: currentCount + 1 })
    .eq('id', companyId)
}

// Verificar se pode criar uma nova persona
export async function canCreatePersona(companyId: string): Promise<PlanCheckResult> {
  const plan = await getCompanyTrainingPlan(companyId)
  if (!plan) return { allowed: false, reason: 'Plano não encontrado' }

  const config = PLAN_CONFIGS[plan]

  // Planos ilimitados
  if (!config.maxPersonas) {
    return { allowed: true }
  }

  // Contar personas atuais
  const { count } = await supabase
    .from('personas')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const currentCount = count || 0
  const limit = config.maxPersonas

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason: `Limite de ${limit} personas atingido para o plano ${plan.toUpperCase()}.`,
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

// Verificar se pode criar uma nova objeção
export async function canCreateObjection(companyId: string): Promise<PlanCheckResult> {
  const plan = await getCompanyTrainingPlan(companyId)
  if (!plan) return { allowed: false, reason: 'Plano não encontrado' }

  const config = PLAN_CONFIGS[plan]

  // Planos ilimitados
  if (!config.maxObjections) {
    return { allowed: true }
  }

  // Contar objeções atuais
  const { count } = await supabase
    .from('objections')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const currentCount = count || 0
  const limit = config.maxObjections

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason: `Limite de ${limit} objeções atingido para o plano ${plan.toUpperCase()}.`,
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

// Verificar limite de rebuttals por objeção
export function canAddRebuttal(currentRebuttals: number, plan: PlanType): PlanCheckResult {
  const config = PLAN_CONFIGS[plan]
  const limit = config.maxObjectionRebuttals

  if (currentRebuttals >= limit) {
    return {
      allowed: false,
      reason: `Limite de ${limit} formas de quebrar objeção atingido para o plano ${plan.toUpperCase()}.`,
      limit,
      currentUsage: currentRebuttals,
      remaining: 0
    }
  }

  return {
    allowed: true,
    limit,
    currentUsage: currentRebuttals,
    remaining: limit - currentRebuttals
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

// Verificar limite de candidatos para processo seletivo
export async function canCreateSelectionCandidate(companyId: string): Promise<PlanCheckResult> {
  const plan = await getCompanySelectionPlan(companyId)

  // Se não tem plano de seleção
  if (!plan) {
    return {
      allowed: false,
      reason: 'Sua empresa não possui um plano de processo seletivo ativo.'
    }
  }

  const config = PLAN_CONFIGS[plan]

  // Verificar se o plano expirou
  const { data: company } = await supabase
    .from('companies')
    .select('selection_plan_expires_at, selection_candidates_count')
    .eq('id', companyId)
    .single()

  if (!company) {
    return { allowed: false, reason: 'Empresa não encontrada' }
  }

  // Verificar expiração
  if (company.selection_plan_expires_at) {
    const expiresAt = new Date(company.selection_plan_expires_at)
    const now = new Date()

    if (now > expiresAt) {
      return {
        allowed: false,
        reason: 'Plano de processo seletivo expirado. Renove seu plano para continuar.'
      }
    }
  }

  // Planos ilimitados
  if (!config.maxSelectionCandidates) {
    return { allowed: true }
  }

  const currentCount = company.selection_candidates_count || 0
  const limit = config.maxSelectionCandidates

  if (currentCount >= limit) {
    return {
      allowed: false,
      reason: `Limite de ${limit} candidatos atingido para o plano atual.`,
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

// Incrementar contador de candidatos
export async function incrementSelectionCandidateCount(companyId: string): Promise<void> {
  const { data: company } = await supabase
    .from('companies')
    .select('selection_candidates_count')
    .eq('id', companyId)
    .single()

  const currentCount = company?.selection_candidates_count || 0

  await supabase
    .from('companies')
    .update({ selection_candidates_count: currentCount + 1 })
    .eq('id', companyId)
}

// Obter resumo de uso do plano
export async function getPlanUsageSummary(companyId: string) {
  const trainingPlan = await getCompanyTrainingPlan(companyId)
  const selectionPlan = await getCompanySelectionPlan(companyId)

  if (!trainingPlan) return null

  const { data: company } = await supabase
    .from('companies')
    .select('weekly_roleplay_count, selection_candidates_count, weekly_roleplay_reset_at, selection_plan_expires_at')
    .eq('id', companyId)
    .single()

  const { count: personasCount } = await supabase
    .from('personas')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const { count: objectionsCount } = await supabase
    .from('objections')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const trainingConfig = PLAN_CONFIGS[trainingPlan]
  const selectionConfig = selectionPlan ? PLAN_CONFIGS[selectionPlan] : null

  return {
    training: {
      plan: trainingPlan,
      roleplays: {
        used: company?.weekly_roleplay_count || 0,
        limit: trainingConfig.maxRoleplaysPerWeek,
        resetDate: company?.weekly_roleplay_reset_at
      },
      personas: {
        used: personasCount || 0,
        limit: trainingConfig.maxPersonas
      },
      objections: {
        used: objectionsCount || 0,
        limit: trainingConfig.maxObjections
      },
      features: {
        chatIA: trainingConfig.hasChatIA,
        pdi: trainingConfig.hasPDI,
        followUp: trainingConfig.hasFollowUp
      }
    },
    selection: selectionPlan ? {
      plan: selectionPlan,
      candidates: {
        used: company?.selection_candidates_count || 0,
        limit: selectionConfig?.maxSelectionCandidates,
        expiresAt: company?.selection_plan_expires_at
      }
    } : null
  }
}