import { useState, useEffect, useCallback } from 'react'
import {
  canCreatePersona,
  canCreateObjection,
  canAddRebuttal,
  canCreateRoleplay,
  hasAccessToChatIA,
  hasAccessToPDI,
  hasAccessToFollowUp,
  getPlanUsageSummary,
  getCompanyTrainingPlan,
  getCompanySelectionPlan,
  incrementRoleplayCount
} from '@/lib/utils/planLimitsChecker'
import { PlanType } from '@/lib/types/plans'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

export function usePlanLimits() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [trainingPlan, setTrainingPlan] = useState<PlanType | null>(null)
  const [selectionPlan, setSelectionPlan] = useState<PlanType | null>(null)
  const [planUsage, setPlanUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlanData()
  }, [])

  const loadPlanData = async () => {
    try {
      const id = await getCompanyId()
      if (id) {
        setCompanyId(id)

        // Buscar ambos os planos
        const [training, selection] = await Promise.all([
          getCompanyTrainingPlan(id),
          getCompanySelectionPlan(id)
        ])

        setTrainingPlan(training)
        setSelectionPlan(selection)

        const usage = await getPlanUsageSummary(id)
        setPlanUsage(usage)
      }
    } catch (error) {
      console.error('Erro ao carregar dados do plano:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkPersonaLimit = useCallback(async () => {
    if (!companyId) return { allowed: false, reason: 'Empresa não encontrada' }
    return await canCreatePersona(companyId)
  }, [companyId])

  const checkObjectionLimit = useCallback(async () => {
    if (!companyId) return { allowed: false, reason: 'Empresa não encontrada' }
    return await canCreateObjection(companyId)
  }, [companyId])

  const checkRebuttalLimit = useCallback(async (currentRebuttals: number) => {
    if (!trainingPlan) return { allowed: false, reason: 'Plano não encontrado' }
    return canAddRebuttal(currentRebuttals, trainingPlan)
  }, [trainingPlan])

  const checkRoleplayLimit = useCallback(async () => {
    if (!companyId) return { allowed: false, reason: 'Empresa não encontrada' }
    return await canCreateRoleplay(companyId)
  }, [companyId])

  const incrementRoleplay = useCallback(async () => {
    if (!companyId) return
    await incrementRoleplayCount(companyId)
    // Recarregar dados de uso
    const usage = await getPlanUsageSummary(companyId)
    setPlanUsage(usage)
  }, [companyId])

  const checkChatIAAccess = useCallback(async () => {
    if (!companyId) return false
    return await hasAccessToChatIA(companyId)
  }, [companyId])

  const checkPDIAccess = useCallback(async () => {
    if (!companyId) return false
    return await hasAccessToPDI(companyId)
  }, [companyId])

  const checkFollowUpAccess = useCallback(async () => {
    if (!companyId) return false
    return await hasAccessToFollowUp(companyId)
  }, [companyId])

  const refreshUsage = useCallback(async () => {
    if (!companyId) return
    const usage = await getPlanUsageSummary(companyId)
    setPlanUsage(usage)
  }, [companyId])

  return {
    companyId,
    trainingPlan,
    selectionPlan,
    planUsage,
    loading,
    checkPersonaLimit,
    checkObjectionLimit,
    checkRebuttalLimit,
    checkRoleplayLimit,
    incrementRoleplay,
    checkChatIAAccess,
    checkPDIAccess,
    checkFollowUpAccess,
    refreshUsage
  }
}