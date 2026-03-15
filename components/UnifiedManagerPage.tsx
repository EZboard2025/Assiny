'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import SellerGrid from './manager/SellerGrid'
import SellerDetailView from './manager/SellerDetailView'
import SellerAgentChat from './SellerAgentChat'
import type { SellerPerformance } from './manager/SellerGrid'

type ViewState =
  | { type: 'grid' }
  | { type: 'detail'; seller: SellerPerformance; whatsappSummary: { count: number; avg: number } }

export default function UnifiedManagerPage() {
  const router = useRouter()
  const [view, setView] = useState<ViewState>({ type: 'grid' })
  const [meetAgentContext, setMeetAgentContext] = useState<{ meetId: string; title: string; date: string } | null>(null)
  const [isDesktopApp, setIsDesktopApp] = useState(false)

  const handleOpenMeetAgent = useCallback((meetId: string, title: string, date: string) => {
    setMeetAgentContext({ meetId, title, date })
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      setIsDesktopApp(true)
    }
  }, [])

  return (
    <div className="min-h-screen py-8 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => view.type === 'detail' ? setView({ type: 'grid' }) : router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {view.type === 'grid' ? 'Dashboard da Equipe' : view.seller.user_name}
              </h1>
              <p className="text-gray-500 text-sm">
                {view.type === 'grid'
                  ? 'Clique em um vendedor para ver todos os dados'
                  : 'Visão completa do vendedor'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {view.type === 'grid' ? (
          <SellerGrid
            onSelectSeller={(seller, whatsappSummary) =>
              setView({ type: 'detail', seller, whatsappSummary })
            }
          />
        ) : (
          <SellerDetailView
            seller={view.seller}
            whatsappSummary={view.whatsappSummary}
            onBack={() => setView({ type: 'grid' })}
            onOpenMeetAgent={handleOpenMeetAgent}
          />
        )}
      </div>

      {/* Unified AI Assistant - context-aware (hidden in desktop app, except when meet agent is active) */}
      {(!isDesktopApp || meetAgentContext) && <SellerAgentChat
        currentView={view.type === 'detail' ? 'seller_detail' : 'manager'}
        viewingContext={view.type === 'detail' ? {
          sellerName: view.seller.user_name,
          sellerEmail: view.seller.user_email,
          overallAverage: view.seller.overall_average,
          totalSessions: view.seller.total_sessions,
          totalMeets: 0,
          spinS: view.seller.spin_s_average,
          spinP: view.seller.spin_p_average,
          spinI: view.seller.spin_i_average,
          spinN: view.seller.spin_n_average,
          trend: view.seller.trend,
        } : null}
        meetContext={meetAgentContext}
        onClearMeetContext={() => setMeetAgentContext(null)}
      />}
    </div>
  )
}
