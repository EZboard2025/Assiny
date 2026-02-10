'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ManagerDashboard from '@/components/ManagerDashboard'

export default function ManagerPage() {
  const router = useRouter()
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordInput, setPasswordInput] = useState('')
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/')
        return
      }

      setAuthToken(session?.access_token || null)

      // Check if already authenticated via sessionStorage
      const stored = sessionStorage.getItem('manager_auth')
      if (stored === 'true') {
        setAuthenticated(true)
      }
    } catch {
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordInput === 'admin123') {
      setAuthenticated(true)
      sessionStorage.setItem('manager_auth', 'true')
    } else {
      alert('Senha incorreta')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
        <form onSubmit={handlePasswordSubmit} className="bg-[#111b21] rounded-xl border border-[#222d34] p-8 w-full max-w-sm">
          <h2 className="text-lg font-semibold text-[#e9edef] text-center mb-6">Dashboard do Gestor</h2>
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            placeholder="Senha de acesso"
            className="w-full bg-[#2a3942] text-[#e9edef] rounded-lg px-4 py-2.5 border border-[#3b4a54] outline-none mb-4 placeholder-[#8696a0]"
            autoFocus
          />
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            Acessar
          </button>
        </form>
      </div>
    )
  }

  if (!authToken) return null

  return <ManagerDashboard authToken={authToken} />
}
