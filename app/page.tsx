'use client'

import { useState, useEffect } from 'react'
import LoginPage from '@/components/LoginPage'
import Dashboard from '@/components/Dashboard'

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Debug
    console.log('Page mounted, isLoggedIn:', isLoggedIn)
  }, [])

  const handleLogin = () => {
    console.log('Login clicked')
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    console.log('Logout clicked')
    setIsLoggedIn(false)
  }

  // Aguarda o mount para evitar problemas de hidratação
  if (!mounted) {
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