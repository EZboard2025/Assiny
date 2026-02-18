'use client'

import dynamic from 'next/dynamic'
import DashboardLayout from '@/components/DashboardLayout'

const FollowUpView = dynamic(() => import('@/components/FollowUpView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#111b21]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Carregando WhatsApp IA...</p>
      </div>
    </div>
  )
})

export default function FollowupPage() {
  return (
    <DashboardLayout>
      <FollowUpView />
    </DashboardLayout>
  )
}
