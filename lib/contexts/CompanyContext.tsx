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
    loadCompany()
  }, [])

  const loadCompany = async () => {
    try {
      setLoading(true)
      setError(null)

      if (typeof window === 'undefined') return

      const USE_UNIFIED_SYSTEM = process.env.NEXT_PUBLIC_USE_UNIFIED_SYSTEM === 'true'

      if (USE_UNIFIED_SYSTEM) {
        // Sistema unificado: buscar empresa do usuário logado
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setCurrentCompany(null)
          return
        }

        const { data: employee } = await supabase
          .from('employees')
          .select('company_id')
          .eq('user_id', user.id)
          .single()

        if (!employee?.company_id) {
          setCurrentCompany(null)
          return
        }

        const { data: company, error: fetchError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', employee.company_id)
          .single()

        if (fetchError || !company) {
          setCurrentCompany(null)
        } else {
          setCurrentCompany(company)
        }
        return
      }

      // SISTEMA LEGADO: subdomínios
      const hostname = window.location.hostname
      let subdomain = ''

      if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
        const params = new URLSearchParams(window.location.search)
        subdomain = params.get('company') || 'assiny'
      } else if (hostname.includes('.ramppy.local')) {
        subdomain = hostname.split('.')[0]
      } else if (hostname.includes('.ramppy.site')) {
        subdomain = hostname.split('.')[0]
      } else {
        subdomain = hostname.split('.')[0]
      }

      if (subdomain === 'ramppy' || subdomain === 'www' || !subdomain) {
        setCurrentCompany(null)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('companies')
        .select('*')
        .eq('subdomain', subdomain)
        .single()

      if (fetchError) {
        setError(`Empresa não encontrada: ${subdomain}`)
        setCurrentCompany(null)
      } else {
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
    await loadCompany()
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
