'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'gestor' | 'vendedor' | 'representante'
  companyId: string
}

interface UserContextType {
  user: User | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  isGestor: boolean
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  isAdmin: false,
  isGestor: false,
  refreshUser: async () => {},
  signOut: async () => {}
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser()
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUser = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError || !authUser) {
        setUser(null)
        return
      }

      // Get company ID from subdomain
      const companyId = await getCompanyId()

      if (!companyId) {
        console.error('[UserContext] Company ID not found')
        setError('Empresa não encontrada')
        setUser(null)
        return
      }

      // Get employee data
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, name, role, company_id')
        .eq('user_id', authUser.id)
        .single()

      if (employeeError || !employee) {
        console.error('[UserContext] Employee not found:', employeeError)
        setError('Usuário não encontrado')
        setUser(null)
        return
      }

      // Verify employee belongs to current company
      if (employee.company_id !== companyId) {
        console.error('[UserContext] Company mismatch - signing out')
        await supabase.auth.signOut()
        setUser(null)
        return
      }

      setUser({
        id: authUser.id,
        name: employee.name,
        email: authUser.email || '',
        role: employee.role,
        companyId: employee.company_id
      })

    } catch (err) {
      console.error('[UserContext] Unexpected error:', err)
      setError('Erro ao carregar usuário')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = async () => {
    await loadUser()
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const isAuthenticated = !!user
  const isAdmin = user?.role === 'admin'
  const isGestor = user?.role === 'gestor'

  return (
    <UserContext.Provider value={{
      user,
      loading,
      error,
      isAuthenticated,
      isAdmin,
      isGestor,
      refreshUser,
      signOut
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
