'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Link2, Settings, LogOut, Users, Target, Clock, MessageSquare, Video, TrendingUp } from 'lucide-react'

interface DashboardSidebarProps {
  userRole: string | null
  hasPDI: boolean
  onOpenConfig: () => void
  onLogout: () => void
  isExpanded: boolean
  onExpandChange: (expanded: boolean) => void
}

export default function DashboardSidebar({
  userRole,
  hasPDI,
  onOpenConfig,
  onLogout,
  isExpanded,
  onExpandChange
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const isAdmin = userRole?.toLowerCase() === 'admin'
  const isGestor = userRole?.toLowerCase() === 'gestor'

  const navItems = [
    { icon: Home, href: '/', label: 'Home', show: true },
    { icon: Users, href: '/roleplay', label: 'Simulação', show: true },
    { icon: User, href: '/profile', label: 'Meu Perfil', show: true },
    { icon: Clock, href: '/history', label: 'Histórico', show: true },
    { icon: Target, href: '/pdi-page', label: 'PDI', show: hasPDI },
    { icon: TrendingUp, href: '/manager', label: 'Gestão', show: isAdmin || isGestor },
    { icon: MessageSquare, href: '/followup', label: 'WhatsApp IA+', show: true },
    { icon: Video, href: '/meet-analysis', label: 'Análise Meet', show: true },
    { icon: Link2, href: '/roleplay-links', label: 'Links Públicos', show: isAdmin || isGestor },
  ]

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#0D4A3A] z-50 flex flex-col transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-56' : 'w-16'
      }`}
      onMouseEnter={() => onExpandChange(true)}
      onMouseLeave={() => onExpandChange(false)}
    >
      {/* Logo */}
      <Link
        href="/"
        className="p-2 border-b border-white/10 cursor-pointer h-14 flex items-center justify-center relative"
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
      </Link>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto overflow-x-hidden">
        <div className="space-y-1">
          {navItems.map((item) => {
            if (!item.show) return null

            const active = isActive(item.href)
            const isDisabled = 'disabled' in item && item.disabled
            const Icon = item.icon

            if (isDisabled) {
              return (
                <div
                  key={item.href}
                  title={!isExpanded ? item.label : undefined}
                  className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-40 cursor-not-allowed text-gray-500"
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
                    isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
                  }`}>
                    {item.label}
                  </span>
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                title={!isExpanded ? item.label : undefined}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  active
                    ? 'bg-green-500/20 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {/* Active indicator */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-green-500 rounded-r-full" />
                )}
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
                  isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
                }`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-white/10 space-y-1">
        {/* Config - Admin only */}
        {isAdmin && (
          <button
            onClick={onOpenConfig}
            title={!isExpanded ? 'Configurações' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200 text-left"
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
