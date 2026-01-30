import { useState, useEffect, useCallback } from 'react'
import {
  canCreateRoleplay,
  canAddSeller,
  hasAccessToChatIA,
  hasAccessToPDI,
  hasAccessToFollowUp,
  getPlanUsageSummary,
  getCompanyTrainingPlan,
  incrementCreditsUsed,
  getRemainingCredits
} from '@/lib/utils/planLimitsChecker'
import { PlanType } from '@/lib/types/plans'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

export function usePlanLimits() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [trainingPlan, setTrainingPlan] = useState<PlanType | null>(null)
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

        const training = await getCompanyTrainingPlan(id)
        setTrainingPlan(training)

        const usage = await getPlanUsageSummary(id)
        setPlanUsage(usage)
      }
    } catch (error) {
      console.error('Erro ao carregar dados do plano:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkRoleplayLimit = useCallback(async () => {
    if (!companyId) return { allowed: false, reason: 'Empresa não encontrada' }
    return await canCreateRoleplay(companyId)
  }, [companyId])

  const checkSellerLimit = useCallback(async () => {
    if (!companyId) return { allowed: false, reason: 'Empresa não encontrada' }
    return await canAddSeller(companyId)
  }, [companyId])

  const incrementCredits = useCallback(async () => {
    if (!companyId) return
    await incrementCreditsUsed(companyId)
    // Recarregar dados de uso
    const usage = await getPlanUsageSummary(companyId)
    setPlanUsage(usage)
  }, [companyId])

  const getCredits = useCallback(async () => {
    if (!companyId) return { remaining: null, limit: null, used: 0, resetDate: null }
    return await getRemainingCredits(companyId)
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
    planUsage,
    loading,
    checkRoleplayLimit,
    checkSellerLimit,
    incrementCredits,
    incrementRoleplay: incrementCredits, // Alias for backwards compatibility
    getCredits,
    checkChatIAAccess,
    checkPDIAccess,
    checkFollowUpAccess,
    refreshUsage
  }
}
