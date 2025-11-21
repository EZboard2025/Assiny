'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import ChatInterface, { ChatInterfaceHandle } from './ChatInterface'
import ConfigHub from './ConfigHub'
import RoleplayView from './RoleplayView'
import HistoricoView from './HistoricoView'
import PerfilView from './PerfilView'
import PDIView from './PDIView'
import RoleplayLinksView from './RoleplayLinksView'
import { MessageCircle, Users, BarChart3, Target, Clock, User, Sparkles, Settings, LogOut, Link2, Home } from 'lucide-react'
import { useCompany } from '@/lib/contexts/CompanyContext'

interface DashboardProps {
  onLogout: () => void
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const { currentCompany, loading: companyLoading } = useCompany()
  const [showConfigHub, setShowConfigHub] = useState(false)
  const [currentView, setCurrentView] = useState<'home' | 'chat' | 'roleplay' | 'pdi' | 'historico' | 'perfil' | 'roleplay-links'>('home')
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
      if (view && ['home', 'chat', 'roleplay', 'pdi', 'historico', 'perfil', 'roleplay-links'].includes(view)) {
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

    if (currentView === 'roleplay-links') {
      return <RoleplayLinksView />
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
          <div className="relative mb-16">
            {/* Glow effect behind title */}
            <div className="absolute inset-0 flex items-center justify-center -top-10">
              <div className="w-96 h-32 bg-green-500/20 rounded-full blur-3xl"></div>
            </div>

            <div className="text-center mb-12 relative">
              <span className="text-green-400 text-sm font-semibold tracking-widest uppercase mb-3 block">
                Explore a plataforma
              </span>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                O que você pode fazer
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Roleplay Card - Featured */}
            <button
              onClick={() => handleViewChange('roleplay')}
              className={`feature-card group text-left md:col-span-2 lg:col-span-1 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '100ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/30 via-lime-500/20 to-transparent rounded-3xl blur-xl group-hover:blur-2xl group-hover:from-green-500/40 transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-green-500/40 hover:border-green-400/80 transition-all duration-300 h-full overflow-hidden">
                {/* Decorative corner glow */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/30 rounded-full blur-3xl group-hover:bg-green-400/40 transition-all"></div>

                <div className="relative">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-lime-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:shadow-green-500/50 group-hover:scale-110 transition-all duration-300">
                      <Users className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Roleplay</h3>
                      <span className="text-green-400 text-sm font-medium">Treine agora</span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-base leading-relaxed">
                    Simule conversas reais de vendas com clientes gerados por IA. Receba feedback instantâneo baseado na metodologia SPIN.
                  </p>
                  <div className="mt-6 flex items-center text-green-400 font-medium group-hover:text-green-300 transition-colors">
                    <span>Iniciar treino</span>
                    <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {/* Meu Perfil Card */}
            <button
              onClick={() => handleViewChange('perfil')}
              className={`feature-card group text-left ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '200ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/30 via-lime-500/20 to-transparent rounded-3xl blur-xl group-hover:blur-2xl group-hover:from-green-500/40 transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-green-500/40 hover:border-green-400/80 transition-all duration-300 h-full overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/30 rounded-full blur-3xl group-hover:bg-green-400/40 transition-all"></div>
                <div className="relative">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-lime-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:shadow-green-500/50 group-hover:scale-110 transition-all duration-300">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Meu Perfil</h3>
                      <span className="text-green-400 text-sm font-medium">Suas métricas</span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-base leading-relaxed">
                    Acompanhe sua evolução, métricas SPIN e performance geral nas vendas.
                  </p>
                  <div className="mt-6 flex items-center text-green-400 font-medium group-hover:text-green-300 transition-colors">
                    <span>Ver perfil</span>
                    <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {/* Histórico Card */}
            <button
              onClick={() => handleViewChange('historico')}
              className={`feature-card group text-left ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '300ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/30 via-lime-500/20 to-transparent rounded-3xl blur-xl group-hover:blur-2xl group-hover:from-green-500/40 transition-all duration-500"></div>
              <div className="relative bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-green-500/40 hover:border-green-400/80 transition-all duration-300 h-full overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/30 rounded-full blur-3xl group-hover:bg-green-400/40 transition-all"></div>
                <div className="relative">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-lime-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:shadow-green-500/50 group-hover:scale-110 transition-all duration-300">
                      <Clock className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">Histórico</h3>
                      <span className="text-green-400 text-sm font-medium">Sessões anteriores</span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-base leading-relaxed">
                    Revise sessões anteriores com transcrições completas e análises detalhadas.
                  </p>
                  <div className="mt-6 flex items-center text-green-400 font-medium group-hover:text-green-300 transition-colors">
                    <span>Ver histórico</span>
                    <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {/* PDI Card - Em breve */}
            <div
              className={`feature-card group text-left ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '400ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-600/20 via-gray-500/10 to-transparent rounded-3xl blur-xl"></div>
              <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-xl rounded-3xl p-8 border border-gray-600/40 h-full overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-gray-600/20 rounded-full blur-3xl"></div>
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded-full border border-yellow-500/30">
                    Em breve
                  </span>
                </div>
                <div className="relative">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg shadow-gray-600/20">
                      <Target className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-400">PDI</h3>
                      <span className="text-gray-500 text-sm font-medium">Plano personalizado</span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-base leading-relaxed">
                    Plano de Desenvolvimento Individual personalizado baseado na sua performance.
                  </p>
                  <div className="mt-6 flex items-center text-gray-500 font-medium">
                    <span>Disponível em breve</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Roleplay Público Card - Admin/Gestor only */}
            {(userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'gestor') && (
              <button
                onClick={() => handleViewChange('roleplay-links')}
                className={`feature-card group text-left ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
                style={{ animationDelay: '500ms' }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/30 via-lime-500/20 to-transparent rounded-3xl blur-xl group-hover:blur-2xl group-hover:from-green-500/40 transition-all duration-500"></div>
                <div className="relative bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-green-500/40 hover:border-green-400/80 transition-all duration-300 h-full overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/30 rounded-full blur-3xl group-hover:bg-green-400/40 transition-all"></div>
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full border border-green-500/30">
                      Admin
                    </span>
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-lime-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:shadow-green-500/50 group-hover:scale-110 transition-all duration-300">
                        <Link2 className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">Roleplay Público</h3>
                        <span className="text-green-400 text-sm font-medium">Links externos</span>
                      </div>
                    </div>
                    <p className="text-gray-300 text-base leading-relaxed">
                      Gere links públicos para roleplays externos e acompanhe os resultados.
                    </p>
                    <div className="mt-6 flex items-center text-green-400 font-medium group-hover:text-green-300 transition-colors">
                      <span>Gerenciar links</span>
                      <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            )}
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

            {/* Empty nav spacer */}
            <nav className="hidden md:flex items-center"></nav>

            {/* Right side buttons */}
            <div className="flex items-center gap-3">
              {/* Home button */}
              <button
                onClick={() => handleViewChange('home')}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-lime-500 text-white rounded-full font-medium shadow-lg shadow-green-500/50 hover:shadow-green-500/70 hover:scale-105 transition-all flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>

              {/* Meu Perfil button */}
              <button
                onClick={() => handleViewChange('perfil')}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-lime-500 text-white rounded-full font-medium shadow-lg shadow-green-500/50 hover:shadow-green-500/70 hover:scale-105 transition-all flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                <span>Meu Perfil</span>
              </button>

              {/* Config button - Admin only */}
              {userRole?.toLowerCase() === 'admin' && (
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