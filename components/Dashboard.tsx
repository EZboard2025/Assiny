'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
import MeetAnalysisView from './MeetAnalysisView'
import RepresentanteView from './RepresentanteView'
import Sidebar from './dashboard/Sidebar'
import StatsPanel from './dashboard/StatsPanel'
import TopBanner from './dashboard/TopBanner'
import FeatureCard from './dashboard/FeatureCard'
import StreakIndicator from './dashboard/StreakIndicator'
import DailyChallengeBanner from './dashboard/DailyChallengeBanner'
import ChallengeHistoryView from './dashboard/ChallengeHistoryView'
import { useTrainingStreak } from '@/hooks/useTrainingStreak'
import { Users, Target, Clock, User, Lock, FileSearch, History, Link2, Play, Video } from 'lucide-react'
import { useCompany } from '@/lib/contexts/CompanyContext'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { PlanType } from '@/lib/types/plans'
import { useCompanyConfig } from '@/lib/hooks/useCompanyConfig'
import ConfigurationRequired from './ConfigurationRequired'

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
  const router = useRouter()
  const { currentCompany, loading: companyLoading } = useCompany()
  const [showConfigHub, setShowConfigHub] = useState(false)
  const [showSalesDashboard, setShowSalesDashboard] = useState(false)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [currentView, setCurrentView] = useState<'home' | 'chat' | 'roleplay' | 'pdi' | 'historico' | 'perfil' | 'roleplay-links' | 'followup' | 'followup-history' | 'meet-analysis' | 'challenge-history'>('home')
  const [mounted, setMounted] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeChallenge, setActiveChallenge] = useState<any | null>(null)
  const [userDataLoading, setUserDataLoading] = useState(true)
  const chatRef = useRef<ChatInterfaceHandle>(null)

  // Performance data state
  const [performanceData, setPerformanceData] = useState<{
    overallAverage: number
    totalSessions: number
    spinScores: { S: number, P: number, I: number, N: number }
  } | null>(null)
  const [performanceLoading, setPerformanceLoading] = useState(true)

  // Training streak hook
  const { streak, loading: streakLoading } = useTrainingStreak(userId)

  // Hook para verificar limites do plano
  const {
    trainingPlan,
    planUsage,
    checkChatIAAccess,
    checkPDIAccess,
    checkFollowUpAccess
  } = usePlanLimits()

  // Hook para verificar configuração da empresa
  const {
    isLoading: configLoading,
    isConfigured,
    missingItems,
    details: configDetails,
    refetch: refetchConfig
  } = useCompanyConfig()

  // Estados para controlar acesso às features
  const [hasChatIA, setHasChatIA] = useState(true)
  const [hasPDI, setHasPDI] = useState(true)
  const [hasFollowUp, setHasFollowUp] = useState(true)

  // Scroll-based navigation
  const mainRef = useRef<HTMLElement>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const lastScrollTime = useRef<number>(0)

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

  // Scroll-based page navigation (DISABLED)
  // const accumulatedScroll = useRef(0)
  // const scrollThreshold = 500
  // useEffect disabled - scroll navigation temporarily turned off

  // Fetch performance data when userId is available
  useEffect(() => {
    if (userId) {
      fetchPerformanceData(userId)
    }
  }, [userId])

  // Fetch performance data directly from roleplay_sessions (same as PerfilView)
  const fetchPerformanceData = async (uid: string) => {
    setPerformanceLoading(true)
    try {
      const { supabase } = await import('@/lib/supabase')

      // Calculate directly from roleplay_sessions (matching PerfilView logic)
      const { data: sessions, error: sessionsError } = await supabase
        .from('roleplay_sessions')
        .select('evaluation, status')
        .eq('user_id', uid)
        .eq('status', 'completed')
        .not('evaluation', 'is', null)

      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError)
        setPerformanceData({ overallAverage: 0, totalSessions: 0, spinScores: { S: 0, P: 0, I: 0, N: 0 } })
        return
      }

      if (!sessions || sessions.length === 0) {
        setPerformanceData({ overallAverage: 0, totalSessions: 0, spinScores: { S: 0, P: 0, I: 0, N: 0 } })
        return
      }

      // Process evaluations
      const getProcessedEvaluation = (evaluation: any) => {
        if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
          try {
            return JSON.parse(evaluation.output)
          } catch {
            return evaluation
          }
        }
        return evaluation
      }

      const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
      const spinCounts = { S: 0, P: 0, I: 0, N: 0 }
      let totalOverallScore = 0
      let countOverallScore = 0

      sessions.forEach((session) => {
        const evaluation = getProcessedEvaluation(session.evaluation)

        // Use overall_score from evaluation (same as PerfilView)
        // Convert from 0-100 to 0-10 scale if necessary
        if (evaluation?.overall_score !== undefined) {
          let scoreValue = parseFloat(evaluation.overall_score)
          if (scoreValue > 10) {
            scoreValue = scoreValue / 10
          }
          totalOverallScore += scoreValue
          countOverallScore++
        }

        // Calculate SPIN averages
        if (evaluation?.spin_evaluation) {
          const spin = evaluation.spin_evaluation

          if (spin.S?.final_score !== undefined) {
            spinTotals.S += spin.S.final_score
            spinCounts.S++
          }
          if (spin.P?.final_score !== undefined) {
            spinTotals.P += spin.P.final_score
            spinCounts.P++
          }
          if (spin.I?.final_score !== undefined) {
            spinTotals.I += spin.I.final_score
            spinCounts.I++
          }
          if (spin.N?.final_score !== undefined) {
            spinTotals.N += spin.N.final_score
            spinCounts.N++
          }
        }
      })

      setPerformanceData({
        overallAverage: countOverallScore > 0 ? totalOverallScore / countOverallScore : 0,
        totalSessions: sessions.length,
        spinScores: {
          S: spinCounts.S > 0 ? spinTotals.S / spinCounts.S : 0,
          P: spinCounts.P > 0 ? spinTotals.P / spinCounts.P : 0,
          I: spinCounts.I > 0 ? spinTotals.I / spinCounts.I : 0,
          N: spinCounts.N > 0 ? spinTotals.N / spinCounts.N : 0
        }
      })

    } catch (error) {
      console.error('Error fetching performance:', error)
      setPerformanceData({ overallAverage: 0, totalSessions: 0, spinScores: { S: 0, P: 0, I: 0, N: 0 } })
    } finally {
      setPerformanceLoading(false)
    }
  }

  // Check if user is admin/gestor
  const checkUserRole = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setUserId(user.id)

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
    } finally {
      setUserDataLoading(false)
    }
  }

  const handleViewChange = async (newView: typeof currentView | string) => {
    // Se está saindo do chat, verificar se precisa confirmar
    if (currentView === 'chat' && newView !== 'chat' && chatRef.current) {
      await chatRef.current.requestLeave()
    }
    // Clear active challenge when navigating to roleplay via menu (not via handleStartChallenge)
    if (newView === 'roleplay') {
      setActiveChallenge(null)
    }
    setCurrentView(newView as typeof currentView)
  }

  const handleStartChallenge = (challenge: any) => {
    setActiveChallenge(challenge)
    setCurrentView('roleplay')
  }

  const renderContent = () => {
    if (currentView === 'chat') {
      if (!hasChatIA) {
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="bg-white rounded-2xl p-8 border border-yellow-200 max-w-md shadow-lg">
              <Lock className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Chat IA Bloqueado</h2>
              <p className="text-gray-600 text-center mb-4">
                O Chat IA não está disponível no plano {trainingPlan?.toUpperCase()}.
              </p>
              <p className="text-sm text-yellow-600 text-center">
                Faça upgrade para o plano MAX ou OG para acessar esta funcionalidade.
              </p>
            </div>
          </div>
        )
      }
      return <ChatInterface ref={chatRef} />
    }

    if (currentView === 'roleplay') {
      return (
        <RoleplayView
          onNavigateToHistory={() => handleViewChange('historico')}
          challengeConfig={activeChallenge?.challenge_config}
          challengeId={activeChallenge?.id}
          onChallengeComplete={() => setActiveChallenge(null)}
        />
      )
    }

    if (currentView === 'pdi') {
      if (!hasPDI) {
        return (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="bg-white rounded-2xl p-8 border border-yellow-200 max-w-md shadow-lg">
              <Lock className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 text-center mb-2">PDI Bloqueado</h2>
              <p className="text-gray-600 text-center mb-4">
                O Plano de Desenvolvimento Individual não está disponível no plano {trainingPlan?.toUpperCase()}.
              </p>
              <p className="text-sm text-yellow-600 text-center">
                Faça upgrade para o plano MAX ou OG para acessar esta funcionalidade.
              </p>
            </div>
          </div>
        )
      }
      return <PDIView />
    }

    if (currentView === 'historico') {
      return <HistoricoView onStartChallenge={handleStartChallenge} />
    }

    if (currentView === 'perfil') {
      return <PerfilView onViewChange={handleViewChange} />
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

    if (currentView === 'meet-analysis') {
      return <MeetAnalysisView />
    }

    if (currentView === 'challenge-history') {
      return (
        <ChallengeHistoryView
          userId={userId || ''}
          onStartChallenge={handleStartChallenge}
          onBack={() => handleViewChange('home')}
        />
      )
    }

    // Home view
    return (
      <div className="py-8 px-6 relative z-10">
        <div className="max-w-[1200px]">
          {/* Header with banner and greeting */}
          <div className={`mb-8 flex flex-col lg:flex-row gap-4 items-stretch ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            {/* Banner CTA with image */}
            <button
              onClick={() => router.push('/roleplay')}
              className="group relative overflow-hidden rounded-2xl bg-green-800 p-5 text-left transition-all hover:shadow-xl hover:scale-[1.01] lg:w-[280px] flex-shrink-0 min-h-[100px]"
            >
              {/* Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: 'url(/images/banner-training.jpg)',
                }}
              />
              {/* Green Overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-700/80 to-green-500/60" />
              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-end">
                <h2 className="text-lg font-bold text-white leading-tight">
                  Treinar vendas agora
                </h2>
              </div>
            </button>

            {/* Greeting */}
            <div className="flex-1 flex items-center">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                  Plataforma de Treinamento
                </p>
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                    Olá, {userName || 'Vendedor'}
                  </h1>
                  <StreakIndicator streak={streak} loading={streakLoading} />
                </div>
              </div>
            </div>
          </div>

          {/* Section Headers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-4">
            <div className="col-span-2">
              <h2 className="text-base font-semibold text-gray-900">Treinamento</h2>
              <p className="text-sm text-gray-500">Ferramentas para desenvolver suas habilidades</p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Follow-ups</h2>
              <p className="text-sm text-gray-500">Analise e gerencie seus follow-ups</p>
            </div>
            {(userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'gestor') && (
              <div>
                <h2 className="text-base font-semibold text-gray-900">Gestão</h2>
                <p className="text-sm text-gray-500">Ferramentas administrativas</p>
              </div>
            )}
          </div>

          {/* 4x2 Grid Layout */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {/* Row 1 */}
            <FeatureCard
              icon={Users}
              title="Simulação"
              subtitle="Treinamento ativo"
              description="Simule conversas reais de vendas com feedback SPIN."
              onClick={() => router.push('/roleplay')}
            />

            <FeatureCard
              icon={User}
              title="Meu Perfil"
              subtitle="Desempenho"
              description="Acompanhe sua evolução e métricas SPIN."
              onClick={() => router.push('/profile')}
            />

            <FeatureCard
              icon={FileSearch}
              title="Análise Follow-up"
              subtitle="WhatsApp"
              description="Análise detalhada do seu follow-up."
              onClick={() => router.push('/followup')}
              disabled
            />

            {(userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'gestor') ? (
              <FeatureCard
                icon={Link2}
                title="Roleplay Público"
                subtitle="Links externos"
                description="Links públicos para roleplays externos."
                onClick={() => router.push('/roleplay-links')}
                adminBadge
              />
            ) : (
              <div className="hidden md:block" />
            )}

            {/* Row 2 */}
            {hasPDI && (
              <FeatureCard
                icon={Target}
                title="PDI"
                subtitle="Plano de desenvolvimento"
                description="Plano de 7 dias baseado na sua performance."
                onClick={() => router.push('/pdi-page')}
              />
            )}

            <FeatureCard
              icon={Clock}
              title="Histórico"
              subtitle="Todas as sessões"
              description="Simulações, Follow-ups e análises de Meet."
              onClick={() => router.push('/history')}
            />

            <FeatureCard
              icon={Video}
              title="Análise Google Meet"
              subtitle="Transcrição em tempo real"
              description="Bot transcreve reuniões do Google Meet automaticamente."
              onClick={() => router.push('/meet-analysis')}
              betaBadge
            />

            {(userRole?.toLowerCase() === 'admin' || userRole?.toLowerCase() === 'gestor') &&
             userRole?.toLowerCase() === 'admin' && trainingPlan !== PlanType.INDIVIDUAL && (
              <FeatureCard
                icon={Users}
                title="Dashboard Vendedores"
                subtitle="Performance da equipe"
                description="Métricas e evolução dos vendedores."
                onClick={() => setShowSalesDashboard(true)}
                adminBadge
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Tela de carregamento enquanto dados do usuário são carregados
  if (userDataLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-green-500 animate-spin mx-auto" />
          </div>
          <p className="text-gray-600 text-lg font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  // Se o usuário é REPRESENTANTE, mostrar apenas a view de representante
  // Representantes não têm acesso às features de treinamento, apenas ao painel de parceiros
  if (userRole?.toLowerCase() === 'representante') {
    return <RepresentanteView userName={userName} onLogout={onLogout} />
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        userRole={userRole}
        hasChatIA={hasChatIA}
        hasPDI={hasPDI}
        onOpenConfig={() => setShowConfigHub(true)}
        onLogout={onLogout}
        isExpanded={isSidebarExpanded}
        onExpandChange={setIsSidebarExpanded}
      />

      {/* Main Content */}
      <main
        ref={mainRef}
        className={`flex-1 h-screen overflow-y-auto ${isSidebarExpanded ? 'ml-56' : 'ml-16'} ${currentView === 'home' ? 'xl:mr-80' : ''}`}
        style={{
          transition: 'margin 300ms ease-in-out, opacity 150ms ease-out',
          opacity: isTransitioning ? 0 : 1
        }}
      >
        {renderContent()}
      </main>

      {/* Stats Panel - only on home */}
      {currentView === 'home' && (
        <StatsPanel
          overallAverage={performanceData?.overallAverage || 0}
          totalSessions={performanceData?.totalSessions || 0}
          spinScores={performanceData?.spinScores || { S: 0, P: 0, I: 0, N: 0 }}
          streak={streak}
          onViewProfile={() => handleViewChange('perfil')}
          onViewHistory={() => handleViewChange('historico')}
          loading={performanceLoading}
          challengeComponent={userId && companyId ? (
            <DailyChallengeBanner
              userId={userId}
              companyId={companyId}
              onStartChallenge={handleStartChallenge}
              onViewHistory={() => {
                setCurrentView('historico')
                setTimeout(() => {
                  const event = new CustomEvent('setHistoryType', { detail: 'desafios' })
                  window.dispatchEvent(event)
                }, 100)
              }}
            />
          ) : undefined}
        />
      )}

      {/* Config Hub Modal */}
      {showConfigHub && (
        <ConfigHub onClose={() => {
          setShowConfigHub(false)
          refetchConfig()
        }} />
      )}

      {/* Sales Dashboard Modal */}
      {showSalesDashboard && (
        <SalesDashboard onClose={() => setShowSalesDashboard(false)} />
      )}

      {/* Configuration Required Overlay */}
      {!configLoading && !isConfigured && userRole !== null && currentView !== 'followup' && currentView !== 'followup-history' && (
        userRole?.toLowerCase() === 'admin' ? (
          <ConfigurationRequired
            isLoading={configLoading}
            missingItems={missingItems}
            details={configDetails}
            onOpenConfig={() => setShowConfigHub(true)}
            onLogout={async () => {
              const { supabase } = await import('@/lib/supabase')
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
          />
        ) : (
          <div className="fixed inset-0 z-[80] bg-white/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-lg w-full">
              <div className="bg-white rounded-2xl border border-yellow-200 shadow-xl p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-yellow-50 border border-yellow-200 flex items-center justify-center">
                  <Lock className="w-10 h-10 text-yellow-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Configuração Pendente
                </h1>
                <p className="text-gray-600 mb-6">
                  O administrador precisa configurar a empresa antes que você possa usar as funcionalidades de treinamento.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                  <p className="text-sm text-yellow-700 font-medium mb-2">Itens pendentes:</p>
                  <ul className="space-y-1">
                    {missingItems.map((item, idx) => (
                      <li key={idx} className="text-sm text-yellow-600 flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm text-gray-500">
                  Entre em contato com seu gestor para liberar o acesso.
                </p>
              </div>
            </div>
          </div>
        )
      )}

    </div>
  )
}
