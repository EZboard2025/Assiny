'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'
import ConfigHub from '@/components/ConfigHub'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'gestor' | 'vendedor' | 'representante'
  companyId: string
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const { checkPDIAccess } = usePlanLimits()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [showConfigHub, setShowConfigHub] = useState(false)
  const [hasPDI, setHasPDI] = useState(true)

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    const loadPlanLimits = async () => {
      if (checkPDIAccess) {
        const pdi = await checkPDIAccess()
        setHasPDI(pdi)
      }
    }
    loadPlanLimits()
  }, [checkPDIAccess])

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/')
        return
      }

      const companyId = await getCompanyId()

      if (!companyId) {
        router.push('/')
        return
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id, name, role, company_id')
        .eq('user_id', authUser.id)
        .single()

      if (!employee || employee.company_id !== companyId) {
        await supabase.auth.signOut()
        router.push('/')
        return
      }

      setUser({
        id: authUser.id,
        name: employee.name,
        email: authUser.email || '',
        role: employee.role,
        companyId: employee.company_id
      })
    } catch (error) {
      console.error('Error loading user:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const isAdmin = user.role === 'admin'

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Sidebar */}
      <DashboardSidebar
        userRole={user.role}
        hasPDI={hasPDI}
        onOpenConfig={() => setShowConfigHub(true)}
        onLogout={handleLogout}
        isExpanded={isSidebarExpanded}
        onExpandChange={setIsSidebarExpanded}
      />

      {/* Main Content */}
      <main
        className={`transition-all duration-300 min-h-screen ${
          isSidebarExpanded ? 'ml-56' : 'ml-16'
        }`}
      >
        {children}
      </main>

      {/* Config Hub Modal */}
      {showConfigHub && isAdmin && (
        <ConfigHub onClose={() => setShowConfigHub(false)} />
      )}
    </div>
  )
}
