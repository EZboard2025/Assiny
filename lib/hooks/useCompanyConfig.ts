'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

export interface ConfigStatus {
  isLoading: boolean
  isConfigured: boolean
  missingItems: string[]
  details: {
    hasCompanyData: boolean
    hasPersonas: boolean
    hasObjections: boolean
  }
}

export function useCompanyConfig() {
  const [status, setStatus] = useState<ConfigStatus>({
    isLoading: true,
    isConfigured: false,
    missingItems: [],
    details: {
      hasCompanyData: false,
      hasPersonas: false,
      hasObjections: false
    }
  })

  useEffect(() => {
    checkConfiguration()
  }, [])

  const checkConfiguration = async () => {
    try {
      const companyId = await getCompanyId()

      if (!companyId) {
        setStatus({
          isLoading: false,
          isConfigured: false,
          missingItems: ['Empresa não identificada'],
          details: {
            hasCompanyData: false,
            hasPersonas: false,
            hasObjections: false
          }
        })
        return
      }

      // Verificar dados da empresa
      const { data: companyData } = await supabase
        .from('company_data')
        .select('id, nome, descricao, produtos_servicos')
        .eq('company_id', companyId)
        .single()

      // Verificar se os campos essenciais estão preenchidos
      const hasCompanyData = !!(
        companyData?.nome &&
        companyData?.descricao &&
        companyData?.produtos_servicos
      )

      // Verificar personas
      const { data: personas, count: personasCount } = await supabase
        .from('personas')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .limit(1)

      const hasPersonas = (personasCount || 0) > 0

      // Verificar objeções
      const { data: objections, count: objectionsCount } = await supabase
        .from('objections')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .limit(1)

      const hasObjections = (objectionsCount || 0) > 0

      // Construir lista de itens faltantes
      const missingItems: string[] = []
      if (!hasCompanyData) missingItems.push('Dados da Empresa')
      if (!hasPersonas) missingItems.push('Personas')
      if (!hasObjections) missingItems.push('Objeções')

      const isConfigured = hasCompanyData && hasPersonas && hasObjections

      setStatus({
        isLoading: false,
        isConfigured,
        missingItems,
        details: {
          hasCompanyData,
          hasPersonas,
          hasObjections
        }
      })
    } catch (error) {
      console.error('Erro ao verificar configuração:', error)
      setStatus({
        isLoading: false,
        isConfigured: false,
        missingItems: ['Erro ao verificar configuração'],
        details: {
          hasCompanyData: false,
          hasPersonas: false,
          hasObjections: false
        }
      })
    }
  }

  return { ...status, refetch: checkConfiguration }
}
