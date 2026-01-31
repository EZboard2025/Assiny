'use client'

import { useState, useEffect } from 'react'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/lib/contexts/CompanyContext'
import Image from 'next/image'

interface LoginPageProps {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { currentCompany, loading: companyLoading } = useCompany()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validação básica
    if (!email || !password) {
      setError('Por favor, preencha todos os campos')
      setLoading(false)
      return
    }

    try {
      // Login com Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError('Email ou senha incorretos')
        setLoading(false)
        return
      }

      if (data.user) {
        // Verificar se o usuário pertence à empresa do subdomínio
        const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
        const subdomainCompanyId = await getCompanyId()

        // Buscar company_id do usuário
        const { data: employee, error: employeeError } = await supabase
          .from('employees')
          .select('company_id')
          .eq('user_id', data.user.id)
          .single()

        if (employeeError || !employee) {
          await supabase.auth.signOut()
          setError('Usuário não encontrado no sistema')
          setLoading(false)
          return
        }

        // Validar se o company_id do usuário corresponde ao subdomínio
        if (subdomainCompanyId && employee.company_id !== subdomainCompanyId) {
          await supabase.auth.signOut()
          setError('Este usuário não tem acesso a esta empresa')
          setLoading(false)
          return
        }

        // Login bem-sucedido
        onLogin()
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Subtle decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-100 rounded-full opacity-50 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-50 rounded-full opacity-50 blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className={`w-full max-w-md ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          {/* Card de Login */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl">
            {/* Logo e Título */}
            <div className="text-center mb-8">
              {/* Logo */}
              <div className="flex items-center justify-center mb-6">
                <div className="relative w-[280px] h-[80px]">
                  <Image
                    src="/images/logo-preta.png"
                    alt="Ramppy Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {companyLoading ? 'Carregando...' : currentCompany ? `Bem-vindo à ${currentCompany.name}!` : 'Bem-vindo!'}
              </h1>
              <p className="text-gray-500 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Faça login para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-green-600" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-16 pr-4 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                    placeholder="seu@email.com"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha
                </label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <Lock className="w-5 h-5 text-green-600" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-16 pr-14 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <a href="#" className="text-green-600 hover:text-green-700 text-sm font-medium transition-colors">
                  Esqueceu sua senha?
                </a>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            © 2025 Ramppy. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
