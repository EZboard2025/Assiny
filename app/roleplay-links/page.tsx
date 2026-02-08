'use client'

import dynamic from 'next/dynamic'
import DashboardLayout from '@/components/DashboardLayout'

const RoleplayLinksView = dynamic(() => import('@/components/RoleplayLinksView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
    </div>
  )
})

export default function RoleplayLinksPage() {
  return (
    <DashboardLayout>
      <RoleplayLinksView />
    </DashboardLayout>
  )
}
