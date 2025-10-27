'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface Company {
  id: string
  name: string
  subdomain: string
  created_at?: string
  updated_at?: string
}

interface CompanyContextType {
  currentCompany: Company | null
  loading: boolean
  error: string | null
  refreshCompany: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextType>({
  currentCompany: null,
  loading: true,
  error: null,
  refreshCompany: async () => {}
})

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCompanyFromSubdomain()
  }, [])

  const loadCompanyFromSubdomain = async () => {
    try {
      setLoading(true)
      setError(null)

      if (typeof window === 'undefined') return

      const hostname = window.location.hostname
      let subdomain = ''

      // Detectar subdomínio baseado no ambiente
      if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
        // Localhost puro sem subdomínio - usar query param ou padrão
        const params = new URLSearchParams(window.location.search)
        subdomain = params.get('company') || 'assiny' // Default para desenvolvimento
      } else if (hostname.includes('.ramppy.local')) {
        // Formato: assiny.ramppy.local:3000 -> "assiny"
        subdomain = hostname.split('.')[0]
      } else if (hostname.includes('.ramppy.site')) {
        // Formato: assiny.ramppy.site -> "assiny"
        subdomain = hostname.split('.')[0]
      } else {
        // Fallback
        subdomain = hostname.split('.')[0]
      }

      console.log('[CompanyContext] Hostname:', hostname)
      console.log('[CompanyContext] Buscando empresa com subdomain:', subdomain)

      // Se for domínio principal (ramppy), não buscar empresa
      if (subdomain === 'ramppy' || subdomain === 'www' || !subdomain) {
        console.log('[CompanyContext] Domínio principal detectado, sem empresa específica')
        setCurrentCompany(null)
        return
      }

      // Buscar empresa pelo subdomínio
      const { data, error: fetchError } = await supabase
        .from('companies')
        .select('*')
        .eq('subdomain', subdomain)
        .single()

      if (fetchError) {
        console.error('[CompanyContext] Erro ao buscar empresa:', fetchError)
        setError(`Empresa não encontrada: ${subdomain}`)
        setCurrentCompany(null)
      } else {
        console.log('[CompanyContext] Empresa encontrada:', data)
        setCurrentCompany(data)
      }
    } catch (err) {
      console.error('[CompanyContext] Erro inesperado:', err)
      setError('Erro ao carregar empresa')
    } finally {
      setLoading(false)
    }
  }

  const refreshCompany = async () => {
    await loadCompanyFromSubdomain()
  }

  return (
    <CompanyContext.Provider value={{ currentCompany, loading, error, refreshCompany }}>
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider')
  }
  return context
}
