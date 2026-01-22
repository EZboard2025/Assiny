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
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black relative overflow-hidden">
      {/* Subtle Grid Background */}
      <div className="absolute inset-0 opacity-[0.08]">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px'
        }}></div>
      </div>

      {/* Subtle Gradient Orbs (sem animação) */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-green-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className={`w-full max-w-md ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          {/* Card de Login - Estilo do Perfil */}
          <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-3xl p-8 border border-emerald-500/30 shadow-2xl">
            {/* Logo e Título */}
            <div className="text-center mb-8">
              {/* Logo com efeito sutil */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-[350px] h-[120px] overflow-hidden">
                  <Image
                    src="/images/ramppy-logo.png"
                    alt="Ramppy Logo"
                    fill
                    className="object-contain object-center scale-[2.2] drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                    priority
                  />
                </div>
              </div>

              <h1 className="text-3xl font-bold mb-3">
                <span className="bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-500 bg-clip-text text-transparent">
                  {companyLoading ? 'Carregando...' : currentCompany ? `Bem-vindo à ${currentCompany.name}!` : 'Bem-vindo!'}
                </span>
              </h1>
              <p className="text-gray-400 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                Faça login para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="w-5 h-5 text-emerald-400 absolute left-4 top-3.5 group-focus-within:text-emerald-300 transition-colors z-10" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="relative w-full pl-12 pr-4 py-3.5 bg-gray-800/60 border border-emerald-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400/60 focus:bg-gray-800/80 transition-all"
                    placeholder="seu@email.com"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Senha
                </label>
                <div className="relative group">
                  <Lock className="w-5 h-5 text-emerald-400 absolute left-4 top-3.5 group-focus-within:text-emerald-300 transition-colors z-10" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="relative w-full pl-12 pr-14 py-3.5 bg-gray-800/60 border border-emerald-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400/60 focus:bg-gray-800/80 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-gray-400 hover:text-emerald-400 transition-colors z-10"
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
                <a href="#" className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold transition-colors">
                  Esqueceu sua senha?
                </a>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm backdrop-blur-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02]"
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
          <p className="text-center text-xs text-gray-500 mt-8">
            © 2025 Ramppy. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
