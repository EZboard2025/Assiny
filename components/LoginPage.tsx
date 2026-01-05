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
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Space Background Effects */}
      <div className="absolute inset-0">
        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-400/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl"></div>

        {/* Fixed Stars (no re-render) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '10%', left: '15%', animationDelay: '0s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '20%', left: '85%', animationDelay: '0.5s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '30%', left: '25%', animationDelay: '1s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '40%', left: '75%', animationDelay: '1.5s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '50%', left: '10%', animationDelay: '2s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '60%', left: '90%', animationDelay: '2.5s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '70%', left: '35%', animationDelay: '0.3s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '80%', left: '65%', animationDelay: '0.8s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '15%', left: '50%', animationDelay: '1.2s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '85%', left: '20%', animationDelay: '1.7s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '25%', left: '60%', animationDelay: '2.2s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '45%', left: '40%', animationDelay: '0.2s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '65%', left: '80%', animationDelay: '0.7s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '75%', left: '55%', animationDelay: '1.4s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '35%', left: '5%', animationDelay: '1.9s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '55%', left: '95%', animationDelay: '2.4s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '5%', left: '70%', animationDelay: '0.4s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '90%', left: '45%', animationDelay: '0.9s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '12%', left: '30%', animationDelay: '1.3s' }} />
          <div className="absolute w-1 h-1 bg-emerald-400/60 rounded-full animate-pulse" style={{ top: '95%', left: '75%', animationDelay: '1.8s' }} />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className={`w-full max-w-md ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          {/* Card de Login */}
          <div className="relative">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-green-400/10 rounded-3xl blur-2xl"></div>

            <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/30 shadow-2xl shadow-emerald-500/20">
              {/* Logo e Título */}
              <div className="text-center mb-6">
                {/* Logo Next.js Image */}
                <div className="flex items-center justify-center mb-2">
                  <div className="relative w-[350px] h-[120px] overflow-hidden">
                    <Image
                      src="/images/ramppy-logo.png"
                      alt="Ramppy Logo"
                      fill
                      className="object-contain object-center scale-[2.2]"
                      priority
                    />
                  </div>
                </div>

                <h1 className="text-2xl font-bold mb-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-500">
                    {companyLoading ? 'Carregando...' : currentCompany ? `Bem-vindo à ${currentCompany.name}!` : 'Bem-vindo!'}
                  </span>
                </h1>
                <p className="text-gray-400 text-sm">
                  Faça login para continuar
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <div className="relative group">
                    <Mail className="w-5 h-5 text-emerald-400 absolute left-3 top-3.5 group-focus-within:text-emerald-300 transition-colors" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:bg-gray-800/70 transition-all"
                      placeholder="seu@email.com"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Senha
                  </label>
                  <div className="relative group">
                    <Lock className="w-5 h-5 text-emerald-400 absolute left-3 top-3.5 group-focus-within:text-emerald-300 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 bg-gray-800/50 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 focus:bg-gray-800/70 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-emerald-400 transition-colors"
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
                  <a href="#" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors">
                    Esqueceu sua senha?
                  </a>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm backdrop-blur-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:scale-[1.02]"
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
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-500 mt-8">
            © 2025 Ramppy. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}