'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import ChatInterface, { ChatInterfaceHandle } from './ChatInterface'
import ConfigHub from './ConfigHub'
import RoleplayView from './RoleplayView'
import HistoricoView from './HistoricoView'
import PerfilView from './PerfilView'
import PDIView from './PDIView'
import SalesDashboard from './SalesDashboard'
import FollowUpView from './FollowUpView'
import FollowUpHistoryView from './FollowUpHistoryView'
import { MessageCircle, Users, BarChart3, Target, Clock, User, Sparkles, Settings, LogOut, Link2, Home, Zap, Lock, FileSearch, History } from 'lucide-react'
import { useCompany } from '@/lib/contexts/CompanyContext'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { PlanType } from '@/lib/types/plans'

// Lazy load RoleplayLinksView to prevent it from executing on public pages
const RoleplayLinksView = dynamic(() => import('./RoleplayLinksView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
    </div>
  )
})

interface DashboardProps {
  onLogout: () => void
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const { currentCompany, loading: companyLoading } = useCompany()
  const [showConfigHub, setShowConfigHub] = useState(false)
  const [showSalesDashboard, setShowSalesDashboard] = useState(false)
  const [currentView, setCurrentView] = useState<'home' | 'chat' | 'roleplay' | 'pdi' | 'historico' | 'perfil' | 'roleplay-links' | 'followup' | 'followup-history'>('home')
  const [mounted, setMounted] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const chatRef = useRef<ChatInterfaceHandle>(null)

  // Hook para verificar limites do plano
  const {
    trainingPlan,
    planUsage,
    checkChatIAAccess,
    checkPDIAccess,
    checkFollowUpAccess
  } = usePlanLimits()

  // Estados para controlar acesso às features
  const [hasChatIA, setHasChatIA] = useState(true)
  const [hasPDI, setHasPDI] = useState(true)
  const [hasFollowUp, setHasFollowUp] = useState(true)

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

      // Abrir ConfigHub se parâmetro estiver presente
      const openConfigHub = params.get('openConfigHub')
      if (openConfigHub === 'true') {
        setShowConfigHub(true)
      }
    }
  }, [])

  // Verificar acesso às features baseado no plano
  useEffect(() => {
    const checkFeatureAccess = async () => {
      if (checkChatIAAccess && checkPDIAccess && checkFollowUpAccess) {
        const chatIA = await checkChatIAAccess()
        const pdi = await checkPDIAccess()
        const followUp = await checkFollowUpAccess()

        setHasChatIA(chatIA)
        setHasPDI(pdi)
        setHasFollowUp(followUp)
      }
    }
    checkFeatureAccess()
  }, [checkChatIAAccess, checkPDIAccess, checkFollowUpAccess])

  // Check if user is admin/gestor
  const checkUserRole = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check user's role and name from employees table
        const { data: employee } = await supabase
          .from('employees')
          .select('role, name')
          .eq('user_id', user.id)
          .single()

        if (employee) {
          setUserRole(employee.role)
          setUserName(employee.name)
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
      if (!hasChatIA) {
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/60 backdrop-blur-sm rounded-2xl p-8 border border-yellow-500/30 max-w-md">
              <Lock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white text-center mb-2">Chat IA Bloqueado</h2>
              <p className="text-gray-400 text-center mb-4">
                O Chat IA não está disponível no plano {trainingPlan?.toUpperCase()}.
              </p>
              <p className="text-sm text-yellow-400 text-center">
                Faça upgrade para o plano MAX ou OG para acessar esta funcionalidade.
              </p>
            </div>
          </div>
        )
      }
      return <ChatInterface ref={chatRef} />
    }

    if (currentView === 'roleplay') {
      return <RoleplayView onNavigateToHistory={() => handleViewChange('historico')} />
    }

    if (currentView === 'pdi') {
      if (!hasPDI) {
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/60 backdrop-blur-sm rounded-2xl p-8 border border-yellow-500/30 max-w-md">
              <Lock className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white text-center mb-2">PDI Bloqueado</h2>
              <p className="text-gray-400 text-center mb-4">
                O Plano de Desenvolvimento Individual não está disponível no plano {trainingPlan?.toUpperCase()}.
              </p>
              <p className="text-sm text-yellow-400 text-center">
                Faça upgrade para o plano MAX ou OG para acessar esta funcionalidade.
              </p>
            </div>
          </div>
        )
      }
      return <PDIView />
    }

    if (currentView === 'historico') {
      return <HistoricoView />
    }

    if (currentView === 'perfil') {
      return <PerfilView key={Date.now()} onViewChange={handleViewChange} />
    }

    if (currentView === 'roleplay-links') {
      return <RoleplayLinksView />
    }

    if (currentView === 'followup') {
      return <FollowUpView />
    }

    if (currentView === 'followup-history') {
      return <FollowUpHistoryView />
    }

    // Home view
    return (
      <div className="py-16 px-6 relative z-10">
        <div className="max-w-[1400px] mx-auto">
          {/* Welcome Section - Modern Hero */}
          <div className="mb-16 text-center">
            <div className={`${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
              <p className="text-green-400/80 text-sm font-medium tracking-widest uppercase mb-3">
                Plataforma de Treinamento
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                <span className="text-white">Olá, </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-400 to-lime-400">
                  {userName || 'Vendedor'}
                </span>
              </h1>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">
                Aprimore suas habilidades de vendas com IA
              </p>
            </div>
          </div>


          {/* Setor 1: Treinamento */}
          <div className="mb-16">
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent"></div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  Treinamento
                </span>
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent"></div>
            </div>

            <div className="flex flex-wrap justify-center gap-6 max-w-[1200px] mx-auto">
            {/* Roleplay Card */}
            <button
              onClick={() => handleViewChange('roleplay')}
              className={`group text-left w-full md:w-[calc(50%-12px)] lg:w-[360px] ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '100ms' }}
            >
              <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 hover:border-green-400/60 transition-all duration-300 h-full hover:bg-gray-900/70 shadow-[0_0_25px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] group-hover:-translate-y-2">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center group-hover:from-green-500/30 group-hover:to-emerald-500/20 transition-colors border border-green-500/20">
                    <Users className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Roleplay</h3>
                    <span className="text-xs text-green-400/70">Treinamento ativo</span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Simule conversas reais de vendas e receba feedback baseado na metodologia SPIN.
                </p>
                <div className="mt-5 flex items-center text-green-400 text-sm font-semibold group-hover:text-green-300 transition-colors">
                  <span>Iniciar treino</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Meu Perfil Card */}
            <button
              onClick={() => handleViewChange('perfil')}
              className={`group text-left w-full md:w-[calc(50%-12px)] lg:w-[360px] ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '150ms' }}
            >
              <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 hover:border-green-400/60 transition-all duration-300 h-full hover:bg-gray-900/70 shadow-[0_0_25px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] group-hover:-translate-y-2">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center group-hover:from-green-500/30 group-hover:to-emerald-500/20 transition-colors border border-green-500/20">
                    <User className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Meu Perfil</h3>
                    <span className="text-xs text-green-400/70">Análise de desempenho</span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Acompanhe sua evolução, métricas SPIN e performance geral nas vendas.
                </p>
                <div className="mt-5 flex items-center text-green-400 text-sm font-semibold group-hover:text-green-300 transition-colors">
                  <span>Ver perfil</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Histórico Card */}
            <button
              onClick={() => handleViewChange('historico')}
              className={`group text-left w-full md:w-[calc(50%-12px)] lg:w-[360px] ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '200ms' }}
            >
              <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 hover:border-green-400/60 transition-all duration-300 h-full hover:bg-gray-900/70 shadow-[0_0_25px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] group-hover:-translate-y-2">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center group-hover:from-green-500/30 group-hover:to-emerald-500/20 transition-colors border border-green-500/20">
                    <Clock className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Histórico</h3>
                    <span className="text-xs text-green-400/70">Sessões anteriores</span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Revise sessões anteriores com transcrições completas e análises detalhadas.
                </p>
                <div className="mt-5 flex items-center text-green-400 text-sm font-semibold group-hover:text-green-300 transition-colors">
                  <span>Ver histórico</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>

            {/* PDI Card */}
            {hasPDI && (
              <button
                onClick={() => handleViewChange('pdi')}
                className={`group text-left w-full md:w-[calc(50%-12px)] lg:w-[360px] ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
                style={{ animationDelay: '250ms' }}
              >
                <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 hover:border-green-400/60 transition-all duration-300 h-full hover:bg-gray-900/70 shadow-[0_0_25px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] group-hover:-translate-y-2">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center group-hover:from-green-500/30 group-hover:to-emerald-500/20 transition-colors border border-green-500/20">
                      <Target className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">PDI</h3>
                      <span className="text-xs text-green-400/70">Plano de desenvolvimento</span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Plano personalizado de 7 dias baseado na sua performance SPIN.
                  </p>
                  <div className="mt-5 flex items-center text-green-400 text-sm font-semibold group-hover:text-green-300 transition-colors">
                    <span>Ver PDI</span>
                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            )}
            </div>
          </div>

          {/* Setor 2: Follow-ups */}
          <div className="mb-16">
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent"></div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  Follow-ups
                </span>
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent"></div>
            </div>

            <div className="flex flex-wrap justify-center gap-6 max-w-[1200px] mx-auto">
            {/* Follow-up Analysis Card */}
            <button
              onClick={() => handleViewChange('followup')}
              className={`group text-left w-full md:w-[calc(50%-12px)] lg:w-[360px] ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '300ms' }}
            >
              <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 hover:border-green-400/60 transition-all duration-300 h-full hover:bg-gray-900/70 shadow-[0_0_25px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] group-hover:-translate-y-2">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center group-hover:from-green-500/30 group-hover:to-emerald-500/20 transition-colors border border-green-500/20">
                    <FileSearch className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Análise de Follow-up</h3>
                    <span className="text-xs text-green-400/70">WhatsApp</span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Envie prints do WhatsApp e receba análise detalhada do seu follow-up.
                </p>
                <div className="mt-5 flex items-center text-green-400 text-sm font-semibold group-hover:text-green-300 transition-colors">
                  <span>Analisar follow-up</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Histórico de Follow-ups Card */}
            <button
              onClick={() => handleViewChange('followup-history')}
              className={`group text-left w-full md:w-[calc(50%-12px)] lg:w-[360px] ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
              style={{ animationDelay: '350ms' }}
            >
              <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 hover:border-green-400/60 transition-all duration-300 h-full hover:bg-gray-900/70 shadow-[0_0_25px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] group-hover:-translate-y-2">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center group-hover:from-green-500/30 group-hover:to-emerald-500/20 transition-colors border border-green-500/20">
                    <History className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Histórico de Follow-ups</h3>
                    <span className="text-xs text-green-400/70">Feedback & Aprendizado</span>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Revise seus follow-ups e marque resultados para melhorar a IA.
                </p>
                <div className="mt-5 flex items-center text-green-400 text-sm font-semibold group-hover:text-green-300 transition-colors">
                  <span>Ver histórico</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
            </div>
          </div>

          {/* Setor 3: Gestão - Only for Admin and Gestor */}
          {(userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'gestor') && (
          <div className="mb-16">
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent"></div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  Gestão
                </span>
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/30 to-transparent"></div>
            </div>

            <div className="flex flex-wrap justify-center gap-6 max-w-[1200px] mx-auto">
            {/* Roleplay Público Card - Admin/Gestor only */}
            {(userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'gestor') && (
              <button
                onClick={() => handleViewChange('roleplay-links')}
                className={`group text-left w-full md:w-[calc(50%-12px)] lg:w-[360px] ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
                style={{ animationDelay: '400ms' }}
              >
                <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 hover:border-green-400/60 transition-all duration-300 h-full hover:bg-gray-900/70 shadow-[0_0_25px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] group-hover:-translate-y-2">
                  <div className="absolute top-4 right-4">
                    <span className="px-2.5 py-1 bg-green-500/20 text-green-400 text-[10px] font-semibold rounded-full border border-green-500/30">
                      Admin
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-4 pr-12">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center group-hover:from-green-500/30 group-hover:to-emerald-500/20 transition-colors border border-green-500/20">
                      <Link2 className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Roleplay Público</h3>
                      <span className="text-xs text-green-400/70">Links externos</span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Gere links públicos para roleplays externos e acompanhe os resultados.
                  </p>
                  <div className="mt-5 flex items-center text-green-400 text-sm font-semibold group-hover:text-green-300 transition-colors">
                    <span>Gerenciar links</span>
                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            )}

            {/* Dashboard dos Vendedores Card - Admin only */}
            {userRole?.toLowerCase() === 'admin' && (
              <button
                onClick={() => setShowSalesDashboard(true)}
                className={`group text-left w-full md:w-[calc(50%-12px)] lg:w-[360px] ${mounted ? 'animate-slide-up' : 'opacity-0'}`}
                style={{ animationDelay: '450ms' }}
              >
                <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 hover:border-green-400/60 transition-all duration-300 h-full hover:bg-gray-900/70 shadow-[0_0_25px_rgba(34,197,94,0.15)] hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] group-hover:-translate-y-2">
                  <div className="absolute top-4 right-4">
                    <span className="px-2.5 py-1 bg-green-500/20 text-green-400 text-[10px] font-semibold rounded-full border border-green-500/30">
                      Admin
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-xl flex items-center justify-center group-hover:from-green-500/30 group-hover:to-emerald-500/20 transition-colors border border-green-500/20">
                      <Users className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Dashboard Vendedores</h3>
                      <span className="text-xs text-green-400/70">Performance da equipe</span>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Visualize métricas, performance SPIN e evolução de todos os vendedores.
                  </p>
                  <div className="mt-5 flex items-center text-green-400 text-sm font-semibold group-hover:text-green-300 transition-colors">
                    <span>Ver dashboard</span>
                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            )}
            </div>
          </div>
          )}
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
        <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-center h-20">
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

      {/* Sales Dashboard Modal */}
      {showSalesDashboard && (
        <SalesDashboard onClose={() => setShowSalesDashboard(false)} />
      )}
    </div>
  )
}