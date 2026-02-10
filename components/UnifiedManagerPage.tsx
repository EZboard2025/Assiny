'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, MessageSquare, Users } from 'lucide-react'
import ManagerDashboard from './ManagerDashboard'
import SalesDashboard from './SalesDashboard'

type TabType = 'whatsapp' | 'performance'

export default function UnifiedManagerPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('whatsapp')

  return (
    <div className="min-h-screen py-8 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard da Equipe</h1>
                <p className="text-gray-500 text-sm">Acompanhe o desempenho da sua equipe</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex items-center gap-1 bg-gray-100 p-1 rounded-xl inline-flex">
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'whatsapp'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Avaliações WhatsApp
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'performance'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              Performance Vendedores
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'whatsapp' ? (
          <ManagerDashboard embedded />
        ) : (
          <SalesDashboard embedded />
        )}
      </div>
    </div>
  )
}
