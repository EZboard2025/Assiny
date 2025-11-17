'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import ChatInterface, { ChatInterfaceHandle } from './ChatInterface'
import ConfigHub from './ConfigHub'
import RoleplayView from './RoleplayView'
import HistoricoView from './HistoricoView'
import PerfilView from './PerfilView'
import PDIView from './PDIView'
import RoleplayLinkManager from './RoleplayLinkManager'
import RoleplayUnicoHistory from './RoleplayUnicoHistory'
import { MessageCircle, Users, BarChart3, Target, Clock, User, Sparkles, Settings, LogOut, Link2, History } from 'lucide-react'
import { useCompany } from '@/lib/contexts/CompanyContext'

interface DashboardProps {
  onLogout: () => void
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const { currentCompany, loading: companyLoading } = useCompany()
  const [showConfigHub, setShowConfigHub] = useState(false)
  const [currentView, setCurrentView] = useState<'home' | 'chat' | 'roleplay' | 'pdi' | 'historico' | 'perfil' | 'roleplay-links' | 'roleplay-history'>('home')
  const [mounted, setMounted] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const chatRef = useRef<ChatInterfaceHandle>(null)

  // Sempre usar tema Ramppy (verde espacial) para TODAS as empresas
  const isRamppy = true

  useEffect(() => {
    setMounted(true)
    checkUserRole()

    // Ler query string da URL para navegação direta
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const view = params.get('view')
      if (view && ['home', 'chat', 'roleplay', 'pdi', 'historico', 'perfil', 'roleplay-links', 'roleplay-history'].includes(view)) {
        setCurrentView(view as typeof currentView)
      }
    }
  }, [])

  // Check if user is admin/gestor
  const checkUserRole = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check user's role from employees table
        const { data: employee } = await supabase
          .from('employees')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (employee) {
          setUserRole(employee.role)
        }
      }

      // Get company ID
      const compId = await getCompanyId()
      if (compId) {
        setCompanyId(compId)
      }
    } catch (error) {
      console.error('Error checking user role:', error)
    }
  }

  const handleViewChange = async (newView: typeof currentView) => {
    // Se está saindo do chat, verificar se precisa confirmar
    if (currentView === 'chat' && newView !== 'chat' && chatRef.current) {
      await chatRef.current.requestLeave()
    }
    setCurrentView(newView)
  }

  const renderContent = () => {
    if (currentView === 'chat') {
      return <ChatInterface ref={chatRef} />
    }

    if (currentView === 'roleplay') {
      return <RoleplayView onNavigateToHistory={() => handleViewChange('historico')} />
    }

    if (currentView === 'pdi') {
      return <PDIView />
    }

    if (currentView === 'historico') {
      return <HistoricoView />
    }

    if (currentView === 'perfil') {
      return <PerfilView key={Date.now()} />
    }

    if (currentView === 'roleplay-links' && companyId) {
      return (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <RoleplayLinkManager companyId={companyId} />
        </div>
      )
    }

    if (currentView === 'roleplay-history' && companyId) {
      return (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <RoleplayUnicoHistory companyId={companyId} />
        </div>
      )
    }

    // Home view
    return (
      <div className="py-20 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className={`space-y-6 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Aumente suas vendas com IA
                <br />
                e evolua com <span className="text-gradient-green">Roleplay inteligente</span>
              </h1>

              {/* Main CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
                <button
                  onClick={() => handleViewChange('roleplay')}
                  className="px-8 py-4 bg-gradient-to-r from-green-600 to-lime-500 rounded-2xl font-semibold text-lg flex items-center gap-3 hover:scale-105 transition-transform glow-green"
                >
                  <Users className="w-5 h-5" />
                  Treinar com Roleplay
                </button>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Sessão de funcionalidades
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Roleplay Card */}
            <button
              onClick={() => handleViewChange('roleplay')}
              className={`feature-card group text-left ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '100ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-green-500/30 hover:border-green-500/60 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-green-600/20 rounded-2xl flex items-center justify-center">
                    <Users className="w-7 h-7 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Roleplay</h3>
                </div>
                <p className="text-gray-400 text-lg">
                  Roleplays interativos simulando vendas com clientes reais de IA.
                </p>
              </div>
            </button>

            {/* PDI Card - Indisponível */}
            <div
              className={`feature-card group text-left opacity-50 cursor-not-allowed ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '200ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-600/20 to-transparent rounded-3xl blur-xl"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-gray-500/30">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gray-600/20 rounded-2xl flex items-center justify-center">
                    <Target className="w-7 h-7 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-300">PDI</h3>
                    <span className="text-xs text-yellow-500 font-semibold">Em breve</span>
                  </div>
                </div>
                <p className="text-gray-500 text-lg">
                  Plano de Desenvolvimento Individual personalizado para sua evolução.
                </p>
              </div>
            </div>

            {/* Meu Perfil Card */}
            <button
              onClick={() => handleViewChange('perfil')}
              className={`feature-card group text-left ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '300ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-green-500/30 hover:border-green-500/60 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-green-600/20 rounded-2xl flex items-center justify-center">
                    <User className="w-7 h-7 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Meu Perfil</h3>
                </div>
                <p className="text-gray-400 text-lg">
                  Acompanhe suas métricas, evolução e desempenho nas vendas.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      {/* Header Navigation */}
      <header className="fixed top-0 w-full bg-black/70 backdrop-blur-xl z-50">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-center h-20">
          <div className="w-full flex items-center justify-between">
            {/* Logo */}
            <div className="cursor-pointer" onClick={() => handleViewChange('home')}>
              <Image
                src="/images/ramppy-logo.png"
                alt="Ramppy"
                width={600}
                height={200}
                className="h-40 w-auto"
                priority
              />
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-6 text-gray-300">
              <button
                onClick={() => handleViewChange('home')}
                className={`hover:text-white transition-colors ${currentView === 'home' ? 'text-white' : ''}`}
              >
                Home
              </button>
              <button
                onClick={() => handleViewChange('roleplay')}
                className={`hover:text-white transition-colors ${currentView === 'roleplay' ? 'text-white' : ''}`}
              >
                Roleplays
              </button>
              <button
                onClick={() => handleViewChange('pdi')}
                className={`hover:text-white transition-colors flex items-center gap-1 ${currentView === 'pdi' ? 'text-white' : ''}`}
              >
                PDI
                <span className="text-xs text-yellow-400 font-normal ml-1">(em breve)</span>
              </button>
              <button
                onClick={() => handleViewChange('historico')}
                className={`hover:text-white transition-colors ${currentView === 'historico' ? 'text-white' : ''}`}
              >
                Histórico
              </button>

              {/* Admin/Gestor only menu items */}
              {(userRole === 'Admin' || userRole === 'Gestor') && (
                <>
                  {/* Separator */}
                  <div className="w-px h-6 bg-gray-600"></div>

                  <button
                    onClick={() => handleViewChange('roleplay-links')}
                    className={`hover:text-white transition-colors flex items-center gap-1.5 ${currentView === 'roleplay-links' ? 'text-white' : ''}`}
                  >
                    <Link2 className="w-4 h-4" />
                    <span>Links</span>
                  </button>
                  <button
                    onClick={() => handleViewChange('roleplay-history')}
                    className={`hover:text-white transition-colors flex items-center gap-1.5 ${currentView === 'roleplay-history' ? 'text-white' : ''}`}
                  >
                    <History className="w-4 h-4" />
                    <span>Histórico Público</span>
                  </button>
                </>
              )}
            </nav>

            {/* Right side buttons */}
            <div className="flex items-center gap-3">
              {/* Meu Perfil button */}
              <button
                onClick={() => handleViewChange('perfil')}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-lime-500 text-white rounded-full font-medium shadow-lg shadow-green-500/50 hover:shadow-green-500/70 hover:scale-105 transition-all flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                <span>Meu Perfil</span>
              </button>

              {/* Config button - Admin only */}
              {userRole === 'Admin' && (
                <button
                  onClick={() => setShowConfigHub(true)}
                  className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm text-white rounded-full font-medium hover:bg-gray-700/50 transition-colors flex items-center gap-2 border border-green-500/30"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Config</span>
                </button>
              )}
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm text-white rounded-full font-medium hover:bg-gray-700/50 transition-colors flex items-center gap-2 border border-green-500/30"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 min-h-screen relative z-10">
        {renderContent()}
      </main>

      {/* Config Hub Modal */}
      {showConfigHub && (
        <ConfigHub onClose={() => setShowConfigHub(false)} />
      )}
    </div>
  )
}