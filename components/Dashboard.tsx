'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { ChatInterfaceHandle } from './ChatInterface'
import Sidebar from './dashboard/Sidebar'
import StreakIndicator from './dashboard/StreakIndicator'
import DailyChallengeBanner from './dashboard/DailyChallengeBanner'
import KPICard from './dashboard/KPICard'
import EvolutionChart from './dashboard/EvolutionChart'
import AgendaWidget from './dashboard/AgendaWidget'
import SpinBars from './dashboard/SpinBars'
import QuickNav from './dashboard/QuickNav'
import { useTrainingStreak } from '@/hooks/useTrainingStreak'
import { BarChart3, Target, TrendingUp, Activity, Lock } from 'lucide-react'
import { useCompany } from '@/lib/contexts/CompanyContext'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { useCompanyConfig } from '@/lib/hooks/useCompanyConfig'
import ConfigurationRequired from './ConfigurationRequired'
import SavedSimulationCard from './dashboard/SavedSimulationCard'
import { useNotifications } from '@/hooks/useNotifications'
import SellerAgentChat from './SellerAgentChat'

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

// Loading skeleton for lazy-loaded views
const ViewLoadingSkeleton = () => (
  <div className="flex items-center justify-center h-[60vh]">
    <div className="w-12 h-12 rounded-full border-4 border-gray-200 border-t-green-500 animate-spin mx-auto" />
  </div>
)

// Lazy-load all heavy view components (only loaded when user navigates to them)
const ChatInterface = dynamic(() => import('./ChatInterface'), { ssr: false, loading: ViewLoadingSkeleton })
const ConfigHub = dynamic(() => import('./ConfigHub'), { ssr: false, loading: ViewLoadingSkeleton })
const RoleplayView = dynamic(() => import('./RoleplayView'), { ssr: false, loading: ViewLoadingSkeleton })
const HistoricoView = dynamic(() => import('./HistoricoView'), { ssr: false, loading: ViewLoadingSkeleton })
const PerfilView = dynamic(() => import('./PerfilView'), { ssr: false, loading: ViewLoadingSkeleton })
const PDIView = dynamic(() => import('./PDIView'), { ssr: false, loading: ViewLoadingSkeleton })
const FollowUpView = dynamic(() => import('./FollowUpView'), { ssr: false, loading: ViewLoadingSkeleton })
const FollowUpHistoryView = dynamic(() => import('./FollowUpHistoryView'), { ssr: false, loading: ViewLoadingSkeleton })
const MeetAnalysisView = dynamic(() => import('./MeetAnalysisView'), { ssr: false, loading: ViewLoadingSkeleton })
const RepresentanteView = dynamic(() => import('./RepresentanteView'), { ssr: false, loading: ViewLoadingSkeleton })
const ChallengeHistoryView = dynamic(() => import('./dashboard/ChallengeHistoryView'), { ssr: false, loading: ViewLoadingSkeleton })
const RoleplayLinksView = dynamic(() => import('./RoleplayLinksView'), { ssr: false, loading: ViewLoadingSkeleton })

interface DashboardProps {
  onLogout: () => void
}

// Prefetch map: pre-load component on hover so it's ready when clicked
const prefetchMap: Record<string, () => void> = {
  roleplay: () => { import('./RoleplayView') },
  perfil: () => { import('./PerfilView') },
  historico: () => { import('./HistoricoView') },
  pdi: () => { import('./PDIView') },
  followup: () => { import('./FollowUpView') },
  'meet-analysis': () => { import('./MeetAnalysisView') },
  'roleplay-links': () => { import('./RoleplayLinksView') },
  'followup-history': () => { import('./FollowUpHistoryView') },
  'challenge-history': () => { import('./dashboard/ChallengeHistoryView') },
  chat: () => { import('./ChatInterface') },
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const router = useRouter()
  const { currentCompany, loading: companyLoading } = useCompany()
  const [showConfigHub, setShowConfigHub] = useState(false)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [currentView, setCurrentView] = useState<'home' | 'chat' | 'roleplay' | 'pdi' | 'historico' | 'perfil' | 'roleplay-links' | 'followup' | 'followup-history' | 'meet-analysis' | 'challenge-history' | 'manager'>('home')
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

  // Dashboard extra data
  const [performanceSummary, setPerformanceSummary] = useState<{
    trend: string | null
    score_improvement: number | null
    latest_session_score: number | null
  } | null>(null)
  const [evolutionData, setEvolutionData] = useState<Array<{ label: string; score: number }>>([])
  const [challengeStatus, setChallengeStatus] = useState<{ pending: boolean; title: string } | null>(null)

  // Training streak hook
  const { streak, loading: streakLoading } = useTrainingStreak(userId)

  // Notifications hook
  const { notifications, unreadCount, markAsRead } = useNotifications(userId)

  // Count meet-specific notifications for sidebar badge
  const meetNotificationCount = notifications.filter(n =>
    n.type === 'meet_evaluation_ready' || n.type === 'meet_evaluation_error'
  ).length

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

  // Fetch all dashboard data when userId is available
  useEffect(() => {
    if (!userId) return

    fetchPerformanceData(userId)

    // Fetch extras: performance summary, evolution chart data, challenge status
    const fetchExtras = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')

        const [summaryResult, sessionsResult, challengeResult] = await Promise.allSettled([
          supabase
            .from('user_performance_summaries')
            .select('trend, latest_session_score, score_improvement')
            .eq('user_id', userId)
            .single(),
          supabase
            .from('roleplay_sessions')
            .select('evaluation, created_at')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .not('evaluation', 'is', null)
            .order('created_at', { ascending: true })
            .limit(15),
          supabase
            .from('daily_challenges')
            .select('id, status, challenge_config')
            .eq('user_id', userId)
            .eq('challenge_date', new Date().toISOString().split('T')[0])
            .in('status', ['pending', 'in_progress'])
            .limit(1)
            .single()
        ])

        // Performance summary
        if (summaryResult.status === 'fulfilled' && summaryResult.value.data) {
          setPerformanceSummary(summaryResult.value.data)
        }

        // Evolution chart data
        if (sessionsResult.status === 'fulfilled' && sessionsResult.value.data) {
          const getProcessedEval = (evaluation: any) => {
            if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
              try { return JSON.parse(evaluation.output) } catch { return evaluation }
            }
            return evaluation
          }

          const chartData = sessionsResult.value.data
            .map((s: any) => {
              const ev = getProcessedEval(s.evaluation)
              let score = ev?.overall_score !== undefined ? parseFloat(ev.overall_score) : null
              if (score !== null && score > 10) score = score / 10
              const d = new Date(s.created_at)
              return score !== null ? {
                label: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`,
                score
              } : null
            })
            .filter(Boolean) as Array<{ label: string; score: number }>

          setEvolutionData(chartData)
        }

        // Challenge status
        if (challengeResult.status === 'fulfilled' && challengeResult.value.data) {
          const ch = challengeResult.value.data
          const config = ch.challenge_config as any
          setChallengeStatus({
            pending: true,
            title: config?.title || 'Desafio do dia'
          })
        }
      } catch (err) {
        console.error('Error fetching dashboard extras:', err)
      }
    }

    fetchExtras()
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
    // Manager is a separate page, navigate directly
    if (newView === 'manager') {
      router.push('/manager')
      return
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
    const overallAvg = performanceData?.overallAverage ?? 0
    const totalSessions = performanceData?.totalSessions ?? 0
    const trend = performanceSummary?.trend
    const scoreImprovement = performanceSummary?.score_improvement

    return (
      <div className="py-8 px-6 relative z-10">
        <div className="max-w-[1400px]">
          {/* Header: Greeting + Streak */}
          <div className={`mb-14 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {getTimeGreeting()}, {userName || 'Vendedor'}
              </h1>
              <StreakIndicator streak={streak} loading={streakLoading} />
            </div>
          </div>

          {/* 3-Column Layout: Left | Center | Right (KPIs) */}
          <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            {/* Left Column (5/12) */}
            <div className="lg:col-span-5 space-y-4">
              {userId && companyId && (
                <DailyChallengeBanner
                  userId={userId}
                  companyId={companyId}
                  onStartChallenge={handleStartChallenge}
                  onViewHistory={() => handleViewChange('challenge-history')}
                />
              )}

              <EvolutionChart
                data={evolutionData}
                loading={performanceLoading}
                onClick={() => handleViewChange('perfil')}
              />

              <SpinBars
                scores={performanceData?.spinScores || { S: 0, P: 0, I: 0, N: 0 }}
                loading={performanceLoading}
                onClick={() => handleViewChange('perfil')}
              />
            </div>

            {/* Center Column (4/12) */}
            <div className="lg:col-span-4 space-y-4">
              {userId && (
                <SavedSimulationCard userId={userId} />
              )}

              {userId && (
                <AgendaWidget
                  userId={userId}
                  onNavigateToCalendar={() => handleViewChange('meet-analysis')}
                />
              )}

              <QuickNav
                onNavigate={handleViewChange}
                userRole={userRole}
                hasPDI={hasPDI}
              />
            </div>

            {/* Right Column (3/12) - KPI Cards stacked */}
            <div className="lg:col-span-3 space-y-4">
              <KPICard
                icon={Activity}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                label="Sessões"
                value={totalSessions > 0 ? totalSessions.toString() : '0'}
                subtitle="sessões avaliadas"
                onClick={() => handleViewChange('historico')}
                loading={performanceLoading}
              />

              <KPICard
                icon={Target}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                label="Desafio do Dia"
                value={challengeStatus?.pending ? 'Pendente' : 'Concluído'}
                subtitle={challengeStatus?.title || 'Nenhum desafio hoje'}
                onClick={() => handleViewChange('challenge-history')}
                loading={performanceLoading}
              />

              <KPICard
                icon={TrendingUp}
                iconBg={trend === 'improving' ? 'bg-green-50' : trend === 'declining' ? 'bg-red-50' : 'bg-gray-50'}
                iconColor={trend === 'improving' ? 'text-green-600' : trend === 'declining' ? 'text-red-500' : 'text-gray-500'}
                label="Tendência"
                value={trend === 'improving' ? 'Melhorando' : trend === 'declining' ? 'Caindo' : totalSessions > 0 ? 'Estável' : '—'}
                subtitle={scoreImprovement != null && totalSessions > 0 ? `${scoreImprovement > 0 ? '+' : ''}${scoreImprovement.toFixed(1)} vs anterior` : 'Treine para ver tendência'}
                delta={scoreImprovement != null && totalSessions > 1 ? {
                  value: `${scoreImprovement > 0 ? '+' : ''}${scoreImprovement.toFixed(1)}`,
                  positive: scoreImprovement >= 0
                } : undefined}
                onClick={() => handleViewChange('perfil')}
                loading={performanceLoading}
              />

              <KPICard
                icon={BarChart3}
                iconBg="bg-green-50"
                iconColor="text-green-600"
                label="Nota Média"
                value={totalSessions > 0 ? overallAvg.toFixed(1) : '—'}
                subtitle={totalSessions > 0 ? `de ${totalSessions} sessões` : 'Sem sessões ainda'}
                delta={scoreImprovement != null && totalSessions > 0 ? {
                  value: `${scoreImprovement > 0 ? '+' : ''}${scoreImprovement.toFixed(1)}`,
                  positive: scoreImprovement >= 0
                } : undefined}
                onClick={() => handleViewChange('perfil')}
                loading={performanceLoading}
              />
            </div>
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
    <div className={`min-h-screen text-gray-900 flex ${currentView === 'followup' ? 'bg-[#111b21]' : 'bg-white'}`}>
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        userRole={userRole}
        hasChatIA={hasChatIA}
        hasPDI={hasPDI}
        onOpenConfig={() => {
          console.log('[Dashboard] Opening ConfigHub, currentView:', currentView)
          setShowConfigHub(true)
        }}
        onLogout={onLogout}
        isExpanded={isSidebarExpanded}
        onExpandChange={setIsSidebarExpanded}
        meetNotificationCount={meetNotificationCount}
      />

      {/* Main Content */}
      <main
        ref={mainRef}
        className={`flex-1 h-screen overflow-y-auto ${isSidebarExpanded ? 'ml-56' : 'ml-16'}`}
        style={{
          transition: 'margin 300ms ease-in-out, opacity 150ms ease-out',
          opacity: isTransitioning ? 0 : 1
        }}
      >
        {renderContent()}
      </main>

      {/* Config Hub Modal */}
      {showConfigHub && (
        <ConfigHub onClose={() => {
          setShowConfigHub(false)
          refetchConfig()
        }} />
      )}

      {/* Seller Agent Chat - only on home */}
      {currentView === 'home' && (
        <SellerAgentChat userName={userName || undefined} />
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
