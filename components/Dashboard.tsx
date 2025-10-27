'use client'

import { useState, useEffect, useRef } from 'react'
import ChatInterface, { ChatInterfaceHandle } from './ChatInterface'
import ConfigHub from './ConfigHub'
import RoleplayView from './RoleplayView'
import HistoricoView from './HistoricoView'
import PerfilView from './PerfilView'
import PDIView from './PDIView'
import { MessageCircle, Users, BarChart3, Target, Clock, User, Sparkles, Settings, LogOut } from 'lucide-react'
import { useCompany } from '@/lib/contexts/CompanyContext'

interface DashboardProps {
  onLogout: () => void
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const { currentCompany, loading: companyLoading } = useCompany()
  const [showConfigHub, setShowConfigHub] = useState(false)
  const [currentView, setCurrentView] = useState<'home' | 'chat' | 'roleplay' | 'pdi' | 'historico' | 'perfil'>('home')
  const [mounted, setMounted] = useState(false)
  const chatRef = useRef<ChatInterfaceHandle>(null)

  useEffect(() => {
    setMounted(true)

    // Ler query string da URL para navegação direta
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const view = params.get('view')
      if (view && ['home', 'chat', 'roleplay', 'pdi', 'historico', 'perfil'].includes(view)) {
        setCurrentView(view as typeof currentView)
      }
    }
  }, [])

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

    // Home view
    return (
      <div className="py-20 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className={`space-y-6 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
              <h1 className="text-5xl md:text-6xl font-bold leading-tight">
                Aumente suas vendas com
                <br />
                e evolua com <span className="text-gradient-purple">Roleplay inteligente</span>
              </h1>

              {/* Main CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
                <button
                  onClick={() => handleViewChange('roleplay')}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-500 rounded-2xl font-semibold text-lg flex items-center gap-3 hover:scale-105 transition-transform glow-purple"
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
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30 hover:border-purple-500/60 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-purple-600/20 rounded-2xl flex items-center justify-center">
                    <Users className="w-7 h-7 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold">Roleplay</h3>
                </div>
                <p className="text-gray-400 text-lg">
                  Roleplays interativos simulando vendas com clientes reais de IA.
                </p>
              </div>
            </button>

            {/* PDI Card */}
            <button
              onClick={() => handleViewChange('pdi')}
              className={`feature-card group text-left ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '200ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30 hover:border-purple-500/60 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-purple-600/20 rounded-2xl flex items-center justify-center">
                    <Target className="w-7 h-7 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold">PDI</h3>
                </div>
                <p className="text-gray-400 text-lg">
                  Plano de Desenvolvimento Individual personalizado para sua evolução.
                </p>
              </div>
            </button>

            {/* Meu Perfil Card */}
            <button
              onClick={() => handleViewChange('perfil')}
              className={`feature-card group text-left ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '300ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent rounded-3xl blur-xl group-hover:blur-2xl transition-all"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30 hover:border-purple-500/60 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-purple-600/20 rounded-2xl flex items-center justify-center">
                    <User className="w-7 h-7 text-purple-400" />
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
      <header className="fixed top-0 w-full bg-black/50 backdrop-blur-xl z-50 border-b border-purple-900/20">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-center h-20">
          <div className="w-full flex items-center justify-between">
            {/* Logo */}
            <div className="text-3xl font-bold tracking-tight cursor-pointer" onClick={() => handleViewChange('home')}>
              {companyLoading ? 'Loading...' : (currentCompany?.name || 'Ramppy')}<span className="text-purple-500">.</span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8 text-gray-300">
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
                className={`hover:text-white transition-colors ${currentView === 'pdi' ? 'text-white' : ''}`}
              >
                PDI
              </button>
              <button
                onClick={() => handleViewChange('historico')}
                className={`hover:text-white transition-colors ${currentView === 'historico' ? 'text-white' : ''}`}
              >
                Histórico
              </button>
              <button
                onClick={() => handleViewChange('perfil')}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-full font-medium shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 hover:scale-105 transition-all"
              >
                Meu Perfil
              </button>
            </nav>

            {/* Right side buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfigHub(true)}
                className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm text-white rounded-full font-medium hover:bg-gray-700/50 transition-colors flex items-center gap-2 border border-purple-500/30"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Config</span>
              </button>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm text-white rounded-full font-medium hover:bg-gray-700/50 transition-colors flex items-center gap-2 border border-purple-500/30"
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