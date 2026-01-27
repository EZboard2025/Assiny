'use client'

import { useState, useEffect } from 'react'
import LoginPage from '@/components/LoginPage'
import Dashboard from '@/components/Dashboard'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [checking, setChecking] = useState(true)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Verificar se o usuário pertence à empresa do subdomínio
        const subdomainCompanyId = await getCompanyId()

        const { data: employee } = await supabase
          .from('employees')
          .select('company_id')
          .eq('user_id', user.id)
          .single()

        // Validar company_id
        if (employee && subdomainCompanyId && employee.company_id === subdomainCompanyId) {
          setIsLoggedIn(true)
        } else {
          // Company_id não corresponde, deslogar
          await supabase.auth.signOut()
          setIsLoggedIn(false)
        }
      }
    } catch (error) {
      console.error('Error checking session:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleLogin = () => {
    console.log('Login clicked')
    setIsLoggingIn(true)
    // Pequeno delay para transição suave
    setTimeout(() => {
      setIsLoggedIn(true)
      setIsLoggingIn(false)
    }, 800)
  }

  const handleLogout = async () => {
    console.log('Logout clicked')
    const { supabase } = await import('@/lib/supabase')
    await supabase.auth.signOut()
    setIsLoggedIn(false)
  }

  // Aguarda o mount e verificação de sessão
  if (!mounted || checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Carregando...</div>
      </div>
    )
  }

  // Tela de carregamento após login
  if (isLoggingIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border-4 border-green-500/20 border-t-green-500 animate-spin mx-auto" />
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-green-500/10 blur-xl mx-auto" />
          </div>
          <p className="text-gray-400 text-lg font-medium">Entrando...</p>
          <p className="text-gray-600 text-sm mt-1">Preparando seu ambiente</p>
        </div>
      </div>
    )
  }

  // Se estiver logado, mostra o Dashboard
  if (isLoggedIn) {
    return <Dashboard onLogout={handleLogout} />
  }

  // Caso contrário, mostra a tela de login
  return <LoginPage onLogin={handleLogin} />
}