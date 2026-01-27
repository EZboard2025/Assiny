'use client'

import { useState, useEffect } from 'react'
import { Mail, Lock, Eye, EyeOff, Loader2, User, XCircle, Clock } from 'lucide-react'
import Image from 'next/image'
import { useParams } from 'next/navigation'

type PageState = 'loading' | 'invalid' | 'form' | 'success'

export default function CadastroEmpresaPage() {
  const params = useParams()
  const empresa = params.empresa as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [companyName, setCompanyName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Validate company from URL param on mount
  useEffect(() => {
    async function validateCompany() {
      if (!empresa) {
        setErrorMessage('Empresa não especificada na URL.')
        setPageState('invalid')
        return
      }

      try {
        const response = await fetch(`/api/invite/validate?subdomain=${empresa}`)
        const data = await response.json()

        if (data.valid) {
          setCompanyName(data.companyName)
          setCompanyId(data.companyId)
          setPageState('form')
        } else {
          setErrorMessage(data.error || 'Empresa não encontrada')
          setPageState('invalid')
        }
      } catch (err) {
        setErrorMessage('Erro ao validar empresa')
        setPageState('invalid')
      }
    }

    if (mounted && empresa) {
      validateCompany()
    }
  }, [mounted, empresa])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validações
    if (!name || !email || !password || !confirmPassword) {
      setError('Por favor, preencha todos os campos')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/invite/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name,
          email,
          password
        })
      })

      const data = await response.json()

      if (data.success) {
        setPageState('success')
      } else {
        setError(data.error || 'Erro ao enviar solicitação')
      }
    } catch (err) {
      setError('Erro ao enviar solicitação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  // Invalid state
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08]">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }}></div>
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-fade-in">
            <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-3xl p-8 border border-red-500/30 shadow-2xl text-center">
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-4">Empresa Não Encontrada</h1>
              <p className="text-gray-400 mb-6">{errorMessage}</p>
              <a
                href="/"
                className="inline-block px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white transition-colors"
              >
                Voltar ao início
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08]">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px'
          }}></div>
        </div>

        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-green-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-fade-in">
            <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-3xl p-8 border border-emerald-500/30 shadow-2xl text-center">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Solicitação Enviada!</h1>
              <p className="text-gray-400 mb-2">
                Sua solicitação de cadastro foi enviada para <span className="text-emerald-400 font-semibold">{companyName}</span>.
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Aguarde a aprovação do gestor. Você poderá fazer login assim que sua conta for aprovada.
              </p>
              <div className="bg-gray-800/50 rounded-xl p-4 text-left">
                <p className="text-sm text-gray-400">
                  <span className="text-emerald-400">Dica:</span> Guarde suas credenciais. Ao ser aprovado, você poderá fazer login com o email e senha que cadastrou.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Form state
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

      {/* Subtle Gradient Orbs */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-green-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className={`w-full max-w-md ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-3xl p-8 border border-emerald-500/30 shadow-2xl">
            {/* Logo e Título */}
            <div className="text-center mb-8">
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

              <h1 className="text-2xl font-bold mb-3">
                <span className="bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-500 bg-clip-text text-transparent">
                  Cadastro - {companyName}
                </span>
              </h1>
              <p className="text-gray-400 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                Preencha seus dados para solicitar acesso
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nome */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Nome completo
                </label>
                <div className="relative group">
                  <User className="w-5 h-5 text-emerald-400 absolute left-4 top-3.5 group-focus-within:text-emerald-300 transition-colors z-10" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="relative w-full pl-12 pr-4 py-3.5 bg-gray-800/60 border border-emerald-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400/60 focus:bg-gray-800/80 transition-all"
                    placeholder="Seu nome"
                    autoFocus
                  />
                </div>
              </div>

              {/* Email */}
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
                  />
                </div>
              </div>

              {/* Senha */}
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

              {/* Confirmar Senha */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Confirmar senha
                </label>
                <div className="relative group">
                  <Lock className="w-5 h-5 text-emerald-400 absolute left-4 top-3.5 group-focus-within:text-emerald-300 transition-colors z-10" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="relative w-full pl-12 pr-4 py-3.5 bg-gray-800/60 border border-emerald-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400/60 focus:bg-gray-800/80 transition-all"
                    placeholder="••••••••"
                  />
                </div>
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
                    Enviando...
                  </>
                ) : (
                  'Solicitar Acesso'
                )}
              </button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-6">
              Já tem uma conta?{' '}
              <a href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                Faça login
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
