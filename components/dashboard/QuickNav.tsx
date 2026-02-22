'use client'

import { Users, MessageSquareMore, Video, Target, Link2, BarChart3 } from 'lucide-react'

interface QuickNavProps {
  onNavigate: (view: string) => void
  userRole: string | null
  hasPDI: boolean
}

const ITEMS = [
  { key: 'roleplay', icon: Users, label: 'Simulação', always: true },
  { key: 'followup', icon: MessageSquareMore, label: 'WhatsApp IA', always: true },
  { key: 'meet-analysis', icon: Video, label: 'Análise Meet', always: true },
  { key: 'pdi', icon: Target, label: 'PDI', needsPDI: true },
  { key: 'roleplay-links', icon: Link2, label: 'Processo Seletivo', adminOnly: true },
  { key: 'manager', icon: BarChart3, label: 'Gestão', adminOnly: true },
]

export default function QuickNav({ onNavigate, userRole, hasPDI }: QuickNavProps) {
  const isAdmin = userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'gestor'

  const visibleItems = ITEMS.filter(item => {
    if (item.adminOnly && !isAdmin) return false
    if (item.needsPDI && !hasPDI) return false
    return true
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Acesso Rápido</h3>
      <div className="grid grid-cols-2 gap-2">
        {visibleItems.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-100 hover:bg-green-50 hover:border-green-200 transition-colors text-left"
            >
              <Icon className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-xs font-medium text-gray-700">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
