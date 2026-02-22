'use client'

import { BarChart3, Target, Users, MessageSquare } from 'lucide-react'

export type PerfilTabKey = 'geral' | 'spin' | 'personas' | 'objecoes'

interface PerfilTabsProps {
  activeTab: PerfilTabKey
  onTabChange: (tab: PerfilTabKey) => void
  mounted: boolean
}

const TABS: Array<{ key: PerfilTabKey; label: string; icon: any }> = [
  { key: 'geral', label: 'Visão Geral', icon: BarChart3 },
  { key: 'spin', label: 'Análise SPIN', icon: Target },
  { key: 'personas', label: 'Por Persona', icon: Users },
  { key: 'objecoes', label: 'Por Objeção', icon: MessageSquare },
]

export default function PerfilTabs({ activeTab, onTabChange, mounted }: PerfilTabsProps) {
  return (
    <div className={`flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
      {TABS.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2 text-sm">
              <Icon className="w-4 h-4" />
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
