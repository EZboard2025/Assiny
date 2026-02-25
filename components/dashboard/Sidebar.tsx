'use client'

import { Home, User, Link2, Settings, LogOut, Users, Target, Clock, MessageSquare, Video, TrendingUp, Download } from 'lucide-react'

interface SidebarProps {
  currentView: string
  onViewChange: (view: string) => void
  userRole: string | null
  hasChatIA: boolean
  hasPDI: boolean
  onOpenConfig: () => void
  onLogout: () => void
  isExpanded: boolean
  onExpandChange: (expanded: boolean) => void
  meetNotificationCount?: number
}

export default function Sidebar({
  currentView,
  onViewChange,
  userRole,
  hasChatIA,
  hasPDI,
  onOpenConfig,
  onLogout,
  isExpanded,
  onExpandChange,
  meetNotificationCount = 0
}: SidebarProps) {
  const isAdmin = userRole?.toLowerCase() === 'admin'
  const isGestor = userRole?.toLowerCase() === 'gestor'

  const navItems = [
    { icon: Home, view: 'home', label: 'Home', show: true },
    { icon: User, view: 'perfil', label: 'Meu Perfil', show: true },
    { icon: Users, view: 'roleplay', label: 'Simulação', show: true },
    { icon: MessageSquare, view: 'followup', label: 'WhatsApp IA', show: true },
    { icon: Video, view: 'meet-analysis', label: 'Análise Meet', show: true },
    { icon: Clock, view: 'historico', label: 'Histórico', show: true },
    // { icon: Target, view: 'pdi', label: 'PDI', show: hasPDI }, // temporarily hidden
    { icon: TrendingUp, view: 'manager', label: 'Gestão', show: isAdmin || isGestor },
    { icon: Link2, view: 'roleplay-links', label: 'Processo Seletivo', show: isAdmin || isGestor },
    { icon: Download, view: 'download', label: 'Download', show: true },
  ]

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#0D4A3A] z-[60] flex flex-col transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-56' : 'w-16'
      }`}
      onMouseEnter={() => onExpandChange(true)}
      onMouseLeave={() => onExpandChange(false)}
    >
      {/* Logo */}
      <div
        className="p-2 border-b border-white/10 cursor-pointer h-14 flex items-center justify-center relative"
        onClick={() => onViewChange('home')}
      >
        {/* Logo icon only (collapsed) */}
        <img
          src="/images/logo-ramppy.png"
          alt="Ramppy"
          className={`h-8 object-contain absolute transition-all duration-300 ease-in-out ${
            isExpanded ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
          }`}
        />
        {/* Full logo with name (expanded) */}
        <img
          src="/images/logotipo-nome.png"
          alt="Ramppy Treinamento"
          className={`h-8 object-contain absolute transition-all duration-300 ease-in-out ${
            isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
        />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto overflow-x-hidden">
        <div className="space-y-1">
          {navItems.map((item) => {
            if (!item.show) return null

            const isActive = currentView === item.view
            const isDisabled = 'disabled' in item && (item as any).disabled
            const Icon = item.icon

            return (
              <button
                key={item.view}
                onClick={() => !isDisabled && onViewChange(item.view)}
                title={!isExpanded ? item.label : undefined}
                disabled={!!isDisabled}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 text-left ${
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed text-gray-500'
                    : isActive
                      ? 'bg-green-500/20 text-white font-semibold'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {/* Active indicator */}
                {isActive && !isDisabled && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-green-500 rounded-r-full" />
                )}
                <div className="relative flex-shrink-0">
                  <Icon className="w-5 h-5" />
                  {item.view === 'historico' && meetNotificationCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                      {meetNotificationCount}
                    </span>
                  )}
                </div>
                <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
                }`}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-white/10 space-y-1">
        {/* Config - Admin only */}
        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpenConfig()
            }}
            title={!isExpanded ? 'Configurações' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200 text-left relative z-10 ${
              currentView === 'followup' ? 'hidden' : ''
            }`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
              isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
            }`}>
              Configurações
            </span>
          </button>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          title={!isExpanded ? 'Sair' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 text-left"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
          }`}>
            Sair
          </span>
        </button>
      </div>
    </aside>
  )
}
