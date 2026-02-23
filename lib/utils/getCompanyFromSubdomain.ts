import { supabase } from '@/lib/supabase'

// Cache to avoid redundant getCompanyId calls (each call = 2 Supabase queries)
let _cachedCompanyId: string | null = null
let _cacheTs = 0
const CACHE_TTL = 60_000 // 60 seconds

export function clearCompanyIdCache() {
  _cachedCompanyId = null
  _cacheTs = 0
}

/**
 * NOVA VERSÃO: Sistema unificado sem subdomínios
 * Obtém o company_id do usuário logado
 * @returns company_id ou null se não encontrado
 */
export async function getUserCompanyId(): Promise<string | null> {
  try {
    // Verificar se estamos em uma página pública
    if (typeof window !== 'undefined' && window.location.pathname.includes('roleplay-publico')) {
      console.log('[getUserCompanyId] Chamada de página pública - retornando null')
      return null
    }

    // Obter o usuário logado
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log('[getUserCompanyId] Usuário não autenticado')
      return null
    }

    // Buscar o company_id do usuário na tabela employees
    const { data, error } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('[getUserCompanyId] Erro ao buscar company_id do usuário:', error)
      return null
    }

    if (!data?.company_id) {
      console.error('[getUserCompanyId] Usuário não tem company_id associado')
      return null
    }

    console.log('[getUserCompanyId] ✅ Company ID encontrado:', data.company_id, 'para usuário:', user.email)
    return data.company_id
  } catch (error) {
    console.error('[getUserCompanyId] Erro inesperado:', error)
    return null
  }
}

/**
 * VERSÃO LEGADA: Mantida temporariamente para compatibilidade
 * Obtém o company_id baseado no subdomínio atual
 * @deprecated Usar getUserCompanyId() ao invés
 */
export async function getCompanyIdFromSubdomain(): Promise<string | null> {
  // Verificar se estamos em modo unificado (sem subdomínios)
  const USE_UNIFIED_SYSTEM = process.env.NEXT_PUBLIC_USE_UNIFIED_SYSTEM === 'true'

  if (USE_UNIFIED_SYSTEM) {
    // No modo unificado, usar company_id do usuário
    return getUserCompanyId()
  }

  // CÓDIGO ORIGINAL MANTIDO PARA COMPATIBILIDADE
  try {
    // Só funciona no cliente (browser)
    if (typeof window === 'undefined') {
      console.error('[getCompanyIdFromSubdomain] Executando no servidor')
      return null
    }

    const hostname = window.location.hostname
    let subdomain = ''

    // Detectar subdomínio baseado no ambiente
    if (hostname.includes('.ramppy.local')) {
      // Desenvolvimento: assiny.ramppy.local -> "assiny"
      subdomain = hostname.split('.')[0]
    } else if (hostname.includes('.ramppy.site')) {
      // Produção: assiny.ramppy.site -> "assiny"
      subdomain = hostname.split('.')[0]
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Localhost puro - usar query param ou default
      const params = new URLSearchParams(window.location.search)
      subdomain = params.get('company') || 'assiny'
    } else {
      // Domínio principal ou outro
      console.log('[getCompanyIdFromSubdomain] Domínio principal ou não reconhecido:', hostname)
      return null
    }

    console.log('[getCompanyIdFromSubdomain] Hostname:', hostname)
    console.log('[getCompanyIdFromSubdomain] Subdomínio detectado:', subdomain)

    // Se não tem subdomínio válido
    if (!subdomain || subdomain === 'www' || subdomain === 'ramppy') {
      console.log('[getCompanyIdFromSubdomain] Sem subdomínio válido')
      return null
    }

    // Buscar empresa pelo subdomínio
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .eq('subdomain', subdomain)
      .single()

    if (error) {
      console.error('[getCompanyIdFromSubdomain] Erro ao buscar empresa:', error)
      return null
    }

    if (!data?.id) {
      console.error('[getCompanyIdFromSubdomain] Empresa não encontrada para subdomínio:', subdomain)
      return null
    }

    console.log('[getCompanyIdFromSubdomain] ✅ Company ID encontrado:', data.id, 'para subdomínio:', subdomain)
    return data.id
  } catch (error) {
    console.error('[getCompanyIdFromSubdomain] Erro inesperado:', error)
    return null
  }
}

/**
 * Função principal - usa sistema unificado ou subdomínios baseado na configuração
 * @returns company_id ou null se não encontrado
 */
export async function getCompanyId(): Promise<string | null> {
  // Return cached value if fresh
  if (_cachedCompanyId && Date.now() - _cacheTs < CACHE_TTL) {
    return _cachedCompanyId
  }

  // Verificar se estamos em uma página pública
  if (typeof window !== 'undefined' && window.location.pathname.includes('roleplay-publico')) {
    return null
  }

  // Verificar se estamos em modo unificado
  const USE_UNIFIED_SYSTEM = process.env.NEXT_PUBLIC_USE_UNIFIED_SYSTEM === 'true'

  if (USE_UNIFIED_SYSTEM) {
    const companyId = await getUserCompanyId()
    if (companyId) {
      _cachedCompanyId = companyId
      _cacheTs = Date.now()
      return companyId
    }
    return null
  }

  // SISTEMA LEGADO: Priorizar subdomínio
  const companyIdFromSubdomain = await getCompanyIdFromSubdomain()

  if (companyIdFromSubdomain) {
    _cachedCompanyId = companyIdFromSubdomain
    _cacheTs = Date.now()
    return companyIdFromSubdomain
  }

  // Fallback para usuário
  const { getCompanyIdFromUser } = await import('./getCompanyId')
  const companyIdFromUser = await getCompanyIdFromUser()

  if (companyIdFromUser) {
    _cachedCompanyId = companyIdFromUser
    _cacheTs = Date.now()
    return companyIdFromUser
  }

  return null
}