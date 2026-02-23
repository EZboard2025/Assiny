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
        const response = await fetch(`/api/invite/validate?companyId=${empresa}`)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Verificando empresa...</p>
        </div>
      </div>
    )
  }

  // Invalid state
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-100 rounded-full opacity-50 blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-50 rounded-full opacity-50 blur-3xl"></div>
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-fade-in">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Empresa Não Encontrada</h1>
              <p className="text-gray-500 mb-6">{errorMessage}</p>
              <a
                href="/"
                className="inline-block px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors"
              >
                Voltar ao início
              </a>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              © 2025 Ramppy. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-100 rounded-full opacity-50 blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-50 rounded-full opacity-50 blur-3xl"></div>
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-fade-in">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Solicitação Enviada!</h1>
              <p className="text-gray-500 mb-2">
                Sua solicitação de cadastro foi enviada para <span className="text-green-600 font-semibold">{companyName}</span>.
              </p>
              <p className="text-gray-400 text-sm mb-6">
                Aguarde a aprovação do gestor. Você poderá fazer login assim que sua conta for aprovada.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left">
                <p className="text-sm text-gray-600">
                  <span className="text-green-600 font-medium">Dica:</span> Guarde suas credenciais. Ao ser aprovado, você poderá fazer login com o email e senha que cadastrou.
                </p>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              © 2025 Ramppy. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Form state
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
          {/* Card de Cadastro */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl">
            {/* Logo e Título */}
            <div className="text-center mb-8">
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
                Cadastro - {companyName}
              </h1>
              <p className="text-gray-500 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Preencha seus dados para solicitar acesso
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome completo
                </label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-16 pr-4 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                    placeholder="Seu nome"
                    autoFocus
                  />
                </div>
              </div>

              {/* Email */}
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
                  />
                </div>
              </div>

              {/* Senha */}
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

              {/* Confirmar Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar senha
                </label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <Lock className="w-5 h-5 text-green-600" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-16 pr-4 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                    placeholder="••••••••"
                  />
                </div>
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
                    Enviando...
                  </>
                ) : (
                  'Solicitar Acesso'
                )}
              </button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-6">
              Já tem uma conta?{' '}
              <a href="/" className="text-green-600 hover:text-green-700 font-medium transition-colors">
                Faça login
              </a>
            </p>
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
