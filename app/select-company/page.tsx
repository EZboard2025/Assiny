'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Building2, ArrowRight } from 'lucide-react'

interface Company {
  id: string
  name: string
  subdomain: string
}

export default function SelectCompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    try {
      console.log('[SelectCompany] Carregando empresas...')
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, subdomain')
        .order('name', { ascending: true })

      console.log('[SelectCompany] Resposta:', { data, error })

      if (error) {
        console.error('[SelectCompany] Erro ao buscar empresas:', error)
        throw error
      }

      console.log('[SelectCompany] Empresas carregadas:', data?.length || 0)
      setCompanies(data || [])
    } catch (error) {
      console.error('[SelectCompany] Erro ao carregar empresas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company)
  }

  const handleContinue = () => {
    if (!selectedCompany) return

    // Detectar se está em localhost ou produção
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === 'ramppy.local'
    const port = window.location.port ? `:${window.location.port}` : ''

    let targetUrl = ''
    if (isLocalhost) {
      // Localhost: usar ramppy.local
      targetUrl = `http://${selectedCompany.subdomain}.ramppy.local${port}`
    } else {
      // Produção: usar ramppy.site
      targetUrl = `https://${selectedCompany.subdomain}.ramppy.site`
    }

    window.location.href = targetUrl
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {/* Logo */}
        <div className="mb-12 animate-fade-in">
          <Image
            src="/images/ramppy-logo.png"
            alt="Ramppy"
            width={300}
            height={100}
            className="h-24 w-auto"
            priority
          />
        </div>

        {/* Main Card */}
        <div className="max-w-2xl w-full animate-slide-up">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl"></div>
            <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-green-500/30">

              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  Bem-vindo ao <span className="text-gradient-green">Ramppy</span>
                </h1>
                <p className="text-gray-400 text-lg">
                  Selecione sua empresa para continuar
                </p>
              </div>

              {/* Companies List */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
                  <p className="mt-4 text-gray-400">Carregando empresas...</p>
                </div>
              ) : companies.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhuma empresa cadastrada</p>
                </div>
              ) : (
                <div className="space-y-3 mb-8">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => handleSelectCompany(company)}
                      className={`w-full text-left p-5 rounded-2xl border transition-all ${
                        selectedCompany?.id === company.id
                          ? 'bg-gradient-to-r from-green-600/30 to-green-500/20 border-green-500 shadow-lg shadow-green-500/20'
                          : 'bg-gray-800/50 border-gray-700 hover:border-green-500/50 hover:bg-gray-800/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            selectedCompany?.id === company.id
                              ? 'bg-green-600/30'
                              : 'bg-gray-700/50'
                          }`}>
                            <Building2 className={`w-6 h-6 ${
                              selectedCompany?.id === company.id
                                ? 'text-green-400'
                                : 'text-gray-400'
                            }`} />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">{company.name}</h3>
                            <p className="text-sm text-gray-400">
                              {company.subdomain}.ramppy.site
                            </p>
                          </div>
                        </div>
                        {selectedCompany?.id === company.id && (
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Continue Button */}
              <button
                onClick={handleContinue}
                disabled={!selectedCompany}
                className={`w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
                  selectedCompany
                    ? 'bg-gradient-to-r from-green-600 to-lime-500 text-white hover:scale-105 glow-green'
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                }`}
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm animate-fade-in" style={{ animationDelay: '200ms' }}>
          © 2024 Ramppy. Plataforma de treinamento de vendas com IA.
        </div>
      </div>
    </div>
  )
}
