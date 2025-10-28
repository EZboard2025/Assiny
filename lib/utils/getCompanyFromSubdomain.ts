import { supabase } from '@/lib/supabase'

/**
 * Obtém o company_id baseado no subdomínio atual
 * @returns company_id ou null se não encontrado
 */
export async function getCompanyIdFromSubdomain(): Promise<string | null> {
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
 * Obtém o company_id correto - prioriza subdomínio sobre usuário
 * @returns company_id ou null se não encontrado
 */
export async function getCompanyId(): Promise<string | null> {
  // Primeiro tenta pegar pelo subdomínio
  const companyIdFromSubdomain = await getCompanyIdFromSubdomain()

  if (companyIdFromSubdomain) {
    console.log('[getCompanyId] Usando company_id do subdomínio:', companyIdFromSubdomain)
    return companyIdFromSubdomain
  }

  // Se não conseguir pelo subdomínio, pega do usuário (fallback)
  const { getCompanyIdFromUser } = await import('./getCompanyId')
  const companyIdFromUser = await getCompanyIdFromUser()

  if (companyIdFromUser) {
    console.log('[getCompanyId] Usando company_id do usuário (fallback):', companyIdFromUser)
    return companyIdFromUser
  }

  console.error('[getCompanyId] Não foi possível obter company_id')
  return null
}