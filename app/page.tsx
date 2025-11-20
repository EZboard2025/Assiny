'use client'

import { useState, useEffect } from 'react'
import LoginPage from '@/components/LoginPage'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [checking, setChecking] = useState(true)

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
    setIsLoggedIn(true)
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

  // Se estiver logado, mostra o Dashboard
  if (isLoggedIn) {
    return <Dashboard onLogout={handleLogout} />
  }

  // Caso contrário, mostra a tela de login
  return <LoginPage onLogin={handleLogin} />
}