'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Globe, Users, Calendar, Trash2, Loader2,
  PlayCircle, CheckCircle, AlertCircle, Package, MessageSquare,
  Lock, LockOpen, Zap, Video, Plus, ChevronDown, ChevronUp,
  Mail, Shield, User
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast, ToastContainer } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'
import { PlanType, PLAN_CONFIGS, PLAN_NAMES } from '@/lib/types/plans'

interface Company {
  id: string
  name: string
  subdomain: string
  created_at: string
  employee_limit: number | null
  training_plan?: PlanType
  locked?: boolean
  monthly_credits_used?: number
  monthly_credits_reset_at?: string
  extra_monthly_credits?: number
}

interface CompanyUser {
  user_id: string
  name: string
  email: string
  role: string
}

interface RoleplaySession {
  id: string
  user_id: string
  created_at: string
  status: string
  messages: any[]
  config: any
  evaluation?: any
  employee_name?: string
  employee_email?: string
}

interface MeetEvaluation {
  id: string
  user_id: string
  meeting_id: string
  seller_name: string
  call_objective: string | null
  funnel_stage: string | null
  transcript: any
  evaluation: any
  overall_score: number | null
  performance_level: string | null
  spin_s_score: number | null
  spin_p_score: number | null
  spin_i_score: number | null
  spin_n_score: number | null
  created_at: string
  smart_notes?: any
  meeting_category?: string | null
  meeting_summary?: any | null
  employee_name?: string
  employee_email?: string
}

const INDICATOR_LABELS: Record<string, string> = {
  open_questions_score: 'Perguntas Abertas',
  scenario_mapping_score: 'Mapeamento de Cenário',
  adaptability_score: 'Adaptabilidade',
  problem_identification_score: 'Identificação de Problemas',
  consequences_exploration_score: 'Exploração de Consequências',
  depth_score: 'Profundidade',
  empathy_score: 'Empatia',
  impact_understanding_score: 'Compreensão de Impacto',
  inaction_consequences_score: 'Consequências da Inação',
  urgency_amplification_score: 'Amplificação de Urgência',
  concrete_risks_score: 'Riscos Concretos',
  non_aggressive_urgency_score: 'Urgência Não Agressiva',
  solution_clarity_score: 'Clareza da Solução',
  personalization_score: 'Personalização',
  benefits_clarity_score: 'Clareza dos Benefícios',
  credibility_score: 'Credibilidade',
  cta_effectiveness_score: 'Efetividade do CTA',
}

const SPIN_NAMES: Record<string, string> = { S: 'Situação', P: 'Problema', I: 'Implicação', N: 'Necessidade' }
const SPIN_COLORS: Record<string, string> = { S: 'blue', P: 'orange', I: 'yellow', N: 'green' }

interface ConfigStatus {
  hasPersonas: boolean
  hasObjections: boolean
  hasCompanyData: boolean
  hasBusinessType: boolean
  personasCount: number
  objectionsCount: number
}

type Tab = 'overview' | 'employees' | 'roleplays' | 'meetings'

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.id as string
  const { toasts, showToast, removeToast } = useToast()

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')

  // Company data
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Overview
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [employeeCount, setEmployeeCount] = useState(0)
  const [roleplayCount, setRoleplayCount] = useState({ training: 0, public: 0, total: 0 })

  // Live meeting status
  const [activeMeetings, setActiveMeetings] = useState<Array<{ status: string; recall_status: string; user_id: string; created_at: string }>>([])


  // Employees
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [creatingUser, setCreatingUser] = useState(false)

  // Roleplays
  const [roleplays, setRoleplays] = useState<RoleplaySession[]>([])
  const [loadingRoleplays, setLoadingRoleplays] = useState(false)
  const [expandedRoleplay, setExpandedRoleplay] = useState<string | null>(null)

  // Meetings
  const [meetings, setMeetings] = useState<MeetEvaluation[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null)

  // Actions
  const [togglingLock, setTogglingLock] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanType | ''>('')
  const [savingPlan, setSavingPlan] = useState(false)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [creditsToAdd, setCreditsToAdd] = useState('')
  const [addingCredits, setAddingCredits] = useState(false)

  // Auth check
  useEffect(() => {
    const auth = sessionStorage.getItem('admin-companies-auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  // Load company data
  useEffect(() => {
    if (isAuthenticated && companyId) {
      loadCompany()
    }
  }, [isAuthenticated, companyId])

  // Load tab data when tab changes
  useEffect(() => {
    if (!isAuthenticated || !companyId) return
    if (activeTab === 'employees' && users.length === 0) loadUsers()
    if (activeTab === 'roleplays' && roleplays.length === 0) loadRoleplays()
    if (activeTab === 'meetings' && meetings.length === 0) loadMeetings()
  }, [activeTab, isAuthenticated])

  // Poll active meetings every 15s
  useEffect(() => {
    if (!isAuthenticated || !companyId) return
    const checkActiveMeetings = async () => {
      const { data } = await supabase
        .from('meet_bot_sessions')
        .select('status, recall_status, user_id, created_at')
        .eq('company_id', companyId)
        .in('status', ['joining', 'recording', 'processing', 'created'])
      setActiveMeetings(data || [])
    }
    checkActiveMeetings()
    const interval = setInterval(checkActiveMeetings, 15000)
    return () => clearInterval(interval)
  }, [isAuthenticated, companyId])

  const handleLogin = () => {
    if (password === 'admin123') {
      setIsAuthenticated(true)
      sessionStorage.setItem('admin-companies-auth', 'true')
    }
  }

  const loadCompany = async () => {
    setLoading(true)
    try {
      // Fetch company
      const { data: companyData, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single()

      if (error || !companyData) {
        showToast('error', 'Empresa não encontrada')
        router.push('/admin/companies')
        return
      }
      setCompany(companyData)

      // Fetch employee count
      const { count } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
      setEmployeeCount(count || 0)

      // Fetch metrics
      const metricsRes = await fetch(`/api/admin/companies/metrics`)
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        const companyMetric = metricsData.metrics?.find((m: any) => m.companyId === companyId)
        if (companyMetric) {
          setConfigStatus(companyMetric.configStatus)
          setRoleplayCount(companyMetric.roleplays)
        }
      }
    } catch (err) {
      console.error('Error loading company:', err)
      showToast('error', 'Erro ao carregar empresa')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch(`/api/admin/companies/users?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      showToast('error', 'Erro ao carregar funcionários')
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadRoleplays = async () => {
    setLoadingRoleplays(true)
    try {
      const res = await fetch(`/api/admin/companies/roleplays?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setRoleplays(data.sessions || [])
      }
    } catch (err) {
      showToast('error', 'Erro ao carregar roleplays')
    } finally {
      setLoadingRoleplays(false)
    }
  }

  const loadMeetings = async () => {
    setLoadingMeetings(true)
    try {
      const res = await fetch(`/api/admin/companies/meet-evaluations?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setMeetings(data.evaluations || [])
      }
    } catch (err) {
      showToast('error', 'Erro ao carregar reuniões')
    } finally {
      setLoadingMeetings(false)
    }
  }

  const toggleLock = async () => {
    if (!company) return
    setTogglingLock(true)
    try {
      const res = await fetch('/api/admin/companies/toggle-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id })
      })
      if (res.ok) {
        const data = await res.json()
        setCompany(prev => prev ? { ...prev, locked: data.locked } : null)
        showToast('success', data.locked ? 'Empresa bloqueada' : 'Empresa desbloqueada')
      }
    } catch (err) {
      showToast('error', 'Erro ao alterar bloqueio')
    } finally {
      setTogglingLock(false)
    }
  }

  const handleDelete = async () => {
    if (!company) return
    try {
      const res = await fetch(`/api/admin/companies/delete?companyId=${company.id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('success', 'Empresa deletada')
        router.push('/admin/companies')
      } else {
        const data = await res.json()
        showToast('error', 'Erro ao deletar', data.error)
      }
    } catch (err) {
      showToast('error', 'Erro ao deletar empresa')
    }
  }

  const handleSavePlan = async () => {
    if (!company || !selectedPlan) return
    setSavingPlan(true)
    try {
      const planConfig = PLAN_CONFIGS[selectedPlan as PlanType]
      const { error } = await supabase
        .from('companies')
        .update({
          training_plan: selectedPlan,
          employee_limit: planConfig?.maxSellers || null
        })
        .eq('id', company.id)

      if (!error) {
        setCompany(prev => prev ? { ...prev, training_plan: selectedPlan as PlanType, employee_limit: planConfig?.maxSellers || null } : null)
        showToast('success', 'Plano atualizado')
        setShowPlanModal(false)
      }
    } catch (err) {
      showToast('error', 'Erro ao salvar plano')
    } finally {
      setSavingPlan(false)
    }
  }

  const handleAddCredits = async () => {
    if (!company || !creditsToAdd) return
    setAddingCredits(true)
    try {
      const res = await fetch('/api/admin/companies/add-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company.id, credits: parseInt(creditsToAdd) })
      })
      if (res.ok) {
        const data = await res.json()
        setCompany(prev => prev ? { ...prev, extra_monthly_credits: data.newExtra } : null)
        showToast('success', `${creditsToAdd} créditos adicionados`)
        setShowCreditsModal(false)
        setCreditsToAdd('')
      }
    } catch (err) {
      showToast('error', 'Erro ao adicionar créditos')
    } finally {
      setAddingCredits(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newUserName || !newUserEmail || !newUserPassword) return
    setCreatingUser(true)
    try {
      const res = await fetch('/api/employees/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          companyId: companyId
        })
      })
      if (res.ok) {
        showToast('success', 'Funcionário criado')
        setShowCreateUser(false)
        setNewUserName('')
        setNewUserEmail('')
        setNewUserPassword('')
        loadUsers()
        setEmployeeCount(prev => prev + 1)
      } else {
        const data = await res.json()
        showToast('error', 'Erro ao criar', data.error)
      }
    } catch (err) {
      showToast('error', 'Erro ao criar funcionário')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/companies/update-role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      })
      if (res.ok) {
        setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u))
        showToast('success', 'Role atualizada')
      }
    } catch (err) {
      showToast('error', 'Erro ao alterar role')
    }
  }

  const getScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-gray-400'
    if (score >= 70) return 'text-green-500'
    if (score >= 40) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getScoreBg = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'bg-gray-100'
    if (score >= 70) return 'bg-green-50'
    if (score >= 40) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  // Auth screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Admin - Senha</h2>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full px-4 py-2 border rounded-lg mb-3 text-gray-900"
            placeholder="Senha"
          />
          <button onClick={handleLogin} className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Entrar
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    )
  }

  if (!company) return null

  const planConfig = company.training_plan ? PLAN_CONFIGS[company.training_plan] : null
  const totalCredits = (planConfig?.monthlyCredits || 0) + (company.extra_monthly_credits || 0)

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'overview', label: 'Visão Geral', icon: Building2 },
    { id: 'employees', label: 'Funcionários', icon: Users, count: employeeCount },
    { id: 'roleplays', label: 'Roleplays', icon: MessageSquare, count: roleplayCount.total },
    { id: 'meetings', label: 'Reuniões', icon: Video, count: meetings.length },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/companies')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para empresas
          </button>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center">
                <Building2 className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
                  {company.locked && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 rounded-full text-xs font-semibold text-orange-700">
                      <Lock className="w-3 h-3" /> BLOQUEADA
                    </span>
                  )}
                  {activeMeetings.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 rounded-full text-xs font-semibold text-red-700 animate-pulse">
                      <span className="w-2 h-2 bg-red-500 rounded-full" />
                      {activeMeetings.length === 1 ? '1 reunião ao vivo' : `${activeMeetings.length} reuniões ao vivo`}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <Globe className="w-4 h-4" />
                  {company.subdomain}.ramppy.site
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Plan badge */}
              {company.training_plan && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 rounded-full text-sm font-medium text-green-700">
                  <Package className="w-4 h-4" />
                  {PLAN_NAMES[company.training_plan]}
                </span>
              )}
              {/* Credits badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 rounded-full text-sm font-medium text-yellow-700">
                <Zap className="w-4 h-4" />
                {company.monthly_credits_used || 0}/{totalCredits || '∞'} créditos
              </span>
              {/* Lock toggle */}
              <button
                onClick={toggleLock}
                disabled={togglingLock}
                className={`p-2.5 rounded-lg transition-colors ${
                  company.locked ? 'text-orange-500 bg-orange-50 hover:bg-orange-100' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                }`}
                title={company.locked ? 'Desbloquear' : 'Bloquear'}
              >
                {togglingLock ? <Loader2 className="w-5 h-5 animate-spin" /> :
                  company.locked ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
              </button>
              {/* Delete */}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2.5 text-gray-400 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                title="Deletar empresa"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* === VISÃO GERAL === */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Meeting Status Banner */}
              {activeMeetings.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">
                        {activeMeetings.length === 1 ? '1 reunião ao vivo agora' : `${activeMeetings.length} reuniões ao vivo agora`}
                      </p>
                      <div className="flex gap-3 mt-1">
                        {activeMeetings.map((m, i) => (
                          <span key={i} className="text-xs text-red-600">
                            {m.recall_status === 'in_call_recording' ? '🎙️ Gravando' :
                             m.recall_status === 'joining_call' ? '🔗 Entrando' :
                             m.recall_status === 'in_waiting_room' ? '⏳ Sala de espera' :
                             `📡 ${m.status}`}
                            {' — iniciada ' + new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 bg-gray-300 rounded-full" />
                    <p className="text-sm text-gray-400">Nenhuma reunião ao vivo no momento</p>
                  </div>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Plano</p>
                  <p className="text-lg font-semibold text-gray-900">{company.training_plan ? PLAN_NAMES[company.training_plan] : 'Nenhum'}</p>
                  <button onClick={() => { setSelectedPlan(company.training_plan || ''); setShowPlanModal(true) }}
                    className="text-xs text-green-600 hover:underline mt-1">Alterar plano</button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Créditos</p>
                  <p className="text-lg font-semibold text-gray-900">{company.monthly_credits_used || 0} / {totalCredits || '∞'}</p>
                  <button onClick={() => setShowCreditsModal(true)}
                    className="text-xs text-yellow-600 hover:underline mt-1">Adicionar créditos</button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Funcionários</p>
                  <p className="text-lg font-semibold text-gray-900">{employeeCount}{company.employee_limit ? ` / ${company.employee_limit}` : ''}</p>
                  <button onClick={() => setActiveTab('employees')}
                    className="text-xs text-blue-600 hover:underline mt-1">Ver todos</button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Criada em</p>
                  <p className="text-lg font-semibold text-gray-900">{new Date(company.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {/* Roleplays summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PlayCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Roleplays</span>
                </div>
                <div className="flex gap-6">
                  <div>
                    <span className="text-2xl font-bold text-gray-900">{roleplayCount.total}</span>
                    <span className="text-sm text-gray-500 ml-1">total</span>
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-gray-700">{roleplayCount.training}</span>
                    <span className="text-sm text-gray-500 ml-1">treino</span>
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-gray-700">{roleplayCount.public}</span>
                    <span className="text-sm text-gray-500 ml-1">público</span>
                  </div>
                </div>
              </div>

              {/* Config Status */}
              {configStatus && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Status de Configuração</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Personas', ok: configStatus.hasPersonas, detail: `(${configStatus.personasCount})` },
                      { label: 'Objeções', ok: configStatus.hasObjections, detail: `(${configStatus.objectionsCount})` },
                      { label: 'Dados da Empresa', ok: configStatus.hasCompanyData },
                      { label: 'Tipo de Negócio', ok: configStatus.hasBusinessType },
                    ].map(item => (
                      <div key={item.label} className={`flex items-center gap-2 p-3 rounded-lg ${item.ok ? 'bg-green-50' : 'bg-yellow-50'}`}>
                        {item.ok ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-yellow-500" />}
                        <span className="text-sm text-gray-700">{item.label} {item.detail || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === FUNCIONÁRIOS === */}
          {activeTab === 'employees' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Funcionários ({users.length})</h3>
                <button
                  onClick={() => setShowCreateUser(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  <Plus className="w-4 h-4" /> Novo funcionário
                </button>
              </div>

              {/* Create user form */}
              {showCreateUser && (
                <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="text-sm font-medium text-green-800 mb-3">Criar funcionário</h4>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <input value={newUserName} onChange={e => setNewUserName(e.target.value)}
                      placeholder="Nome" className="px-3 py-2 border rounded-lg text-sm text-gray-900" />
                    <input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
                      placeholder="Email" className="px-3 py-2 border rounded-lg text-sm text-gray-900" />
                    <input value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)}
                      placeholder="Senha" type="password" className="px-3 py-2 border rounded-lg text-sm text-gray-900" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCreateUser} disabled={creatingUser}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
                      {creatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
                    </button>
                    <button onClick={() => setShowCreateUser(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">Cancelar</button>
                  </div>
                </div>
              )}

              {loadingUsers ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : users.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Nenhum funcionário encontrado</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 pb-3 pl-2">Nome</th>
                      <th className="text-left text-xs font-medium text-gray-500 pb-3">Email</th>
                      <th className="text-left text-xs font-medium text-gray-500 pb-3">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.user_id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 pl-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{user.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-sm text-gray-600">{user.email}</td>
                        <td className="py-3">
                          <select
                            value={user.role}
                            onChange={e => handleChangeRole(user.user_id, e.target.value)}
                            className="text-sm border rounded-lg px-2 py-1 text-gray-700 bg-white"
                          >
                            <option value="admin">Admin</option>
                            <option value="vendedor">Vendedor</option>
                            <option value="representante">Representante</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* === ROLEPLAYS === */}
          {activeTab === 'roleplays' && (
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Roleplays ({roleplays.length})</h3>
              {loadingRoleplays ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : roleplays.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Nenhum roleplay encontrado</p>
              ) : (
                <div className="space-y-2">
                  {roleplays.map(rp => {
                    const score = rp.evaluation?.overall_score
                    const displayScore = score !== undefined ? (score <= 10 ? (score * 10).toFixed(0) : score.toFixed(0)) : null
                    return (
                      <div key={rp.id} className="border border-gray-100 rounded-lg">
                        <button
                          onClick={() => setExpandedRoleplay(expandedRoleplay === rp.id ? null : rp.id)}
                          className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex-1 flex items-center gap-4">
                            <span className="text-sm text-gray-500 w-24">{new Date(rp.created_at).toLocaleDateString('pt-BR')}</span>
                            <span className="text-sm font-medium text-gray-900">{rp.employee_name || 'Desconhecido'}</span>
                            <span className="text-xs text-gray-400">{rp.employee_email}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {displayScore && (
                              <span className={`text-sm font-bold ${getScoreColor(Number(displayScore))}`}>
                                {displayScore}/100
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              rp.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>{rp.status}</span>
                            {expandedRoleplay === rp.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </button>
                        {expandedRoleplay === rp.id && (
                          <div className="px-4 pb-4 border-t border-gray-100">
                            {rp.evaluation && (
                              <div className="mt-3 space-y-2">
                                <p className="text-sm text-gray-600">{rp.evaluation.executive_summary}</p>
                                {rp.evaluation.spin_evaluation && (
                                  <div className="flex gap-4 mt-2">
                                    {['S', 'P', 'I', 'N'].map(letter => {
                                      const s = rp.evaluation?.spin_evaluation?.[letter]?.final_score
                                      return (
                                        <div key={letter} className={`px-3 py-1.5 rounded-lg ${getScoreBg(s ? s * 10 : null)}`}>
                                          <span className="text-xs text-gray-500">{letter}</span>
                                          <span className={`text-sm font-bold ml-1 ${getScoreColor(s ? s * 10 : null)}`}>
                                            {s !== undefined ? s.toFixed(1) : '-'}
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                            {rp.messages && rp.messages.length > 0 && (
                              <details className="mt-3">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                  Ver transcrição ({rp.messages.length} mensagens)
                                </summary>
                                <div className="mt-2 max-h-60 overflow-y-auto space-y-1.5 text-xs">
                                  {rp.messages.map((msg: any, i: number) => (
                                    <div key={i} className={`p-2 rounded ${msg.role === 'client' ? 'bg-gray-50' : 'bg-green-50'}`}>
                                      <span className="font-medium">{msg.role === 'client' ? 'Cliente' : 'Vendedor'}:</span> {msg.text}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* === REUNIÕES === */}
          {activeTab === 'meetings' && (
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Reuniões ({meetings.length})</h3>
              {loadingMeetings ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : meetings.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Nenhuma reunião encontrada</p>
              ) : (
                <div className="space-y-3">
                  {meetings.map(meet => {
                    const eval_ = meet.evaluation
                    const isSales = meet.meeting_category !== 'non_sales'
                    const isExpanded = expandedMeeting === meet.id
                    return (
                      <div key={meet.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Header row */}
                        <button
                          onClick={() => setExpandedMeeting(isExpanded ? null : meet.id)}
                          className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex-1 flex items-center gap-4">
                            <span className="text-sm text-gray-500 w-24 flex-shrink-0">{new Date(meet.created_at).toLocaleDateString('pt-BR')}</span>
                            <span className="text-sm font-medium text-gray-900">{meet.seller_name || meet.employee_name || 'Desconhecido'}</span>
                            {meet.call_objective && <span className="text-xs text-gray-400 truncate max-w-[250px]">{meet.call_objective}</span>}
                            {!isSales && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Não-vendas</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            {/* SPIN mini badges */}
                            {isSales && (
                              <div className="flex gap-1">
                                {(['S','P','I','N'] as const).map(l => {
                                  const key = `spin_${l.toLowerCase()}_score` as keyof MeetEvaluation
                                  const s = meet[key] as number | null
                                  return (
                                    <span key={l} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      s === null ? 'bg-gray-100 text-gray-400' :
                                      (s >= 7 ? 'bg-green-100 text-green-700' : s >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')
                                    }`}>{l} {s !== null ? s.toFixed(1) : '-'}</span>
                                  )
                                })}
                              </div>
                            )}
                            {meet.overall_score !== null && (
                              <span className={`text-sm font-bold ${getScoreColor(meet.overall_score)}`}>
                                {meet.overall_score.toFixed(0)}/100
                              </span>
                            )}
                            {meet.performance_level && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{meet.performance_level}</span>
                            )}
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 p-5 space-y-5 bg-gray-50/50">

                            {/* Smart Notes */}
                            {meet.smart_notes && (
                              <div className="bg-white rounded-xl border border-emerald-200 p-4">
                                <h4 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                                  📋 Notas Inteligentes
                                  {meet.smart_notes.deal_status?.temperature && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      meet.smart_notes.deal_status.temperature === 'hot' ? 'bg-green-100 text-green-700' :
                                      meet.smart_notes.deal_status.temperature === 'warm' ? 'bg-amber-100 text-amber-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {meet.smart_notes.deal_status.temperature === 'hot' ? '🔥 Quente' :
                                       meet.smart_notes.deal_status.temperature === 'warm' ? '🌤️ Morno' : '❄️ Frio'}
                                    </span>
                                  )}
                                </h4>
                                {meet.smart_notes.lead_name && (
                                  <p className="text-xs text-gray-500 mb-3">
                                    Lead: <strong>{meet.smart_notes.lead_name}</strong>
                                    {meet.smart_notes.lead_role && ` — ${meet.smart_notes.lead_role}`}
                                    {meet.smart_notes.lead_company && ` @ ${meet.smart_notes.lead_company}`}
                                  </p>
                                )}
                                {meet.smart_notes.sections?.map((section: any, i: number) => (
                                  <div key={i} className="mb-3">
                                    <h5 className="text-xs font-semibold text-gray-700 mb-1">{section.title}</h5>
                                    {section.insight && <p className="text-xs text-emerald-700 italic mb-1">{section.insight}</p>}
                                    <ul className="space-y-0.5">
                                      {section.items?.map((item: any, j: number) => (
                                        <li key={j} className="text-xs text-gray-600">
                                          <strong>{item.label}:</strong> {item.value}
                                          {item.source !== 'explicit' && <span className="text-gray-400 ml-1">(inferido)</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                                {meet.smart_notes.deal_status && (
                                  <div className="mt-3 pt-3 border-t border-emerald-100">
                                    <p className="text-xs text-gray-700"><strong>Status:</strong> {meet.smart_notes.deal_status.summary}</p>
                                    {meet.smart_notes.deal_status.risk_factors?.length > 0 && (
                                      <div className="mt-1">
                                        <span className="text-xs text-red-600 font-medium">Riscos: </span>
                                        {meet.smart_notes.deal_status.risk_factors.map((r: string, i: number) => (
                                          <span key={i} className="text-xs text-red-600">{r}{i < meet.smart_notes.deal_status.risk_factors.length - 1 ? ', ' : ''}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* SPIN Analysis */}
                            {isSales && eval_ && (
                              <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <h4 className="text-sm font-semibold text-gray-800 mb-4">📊 Análise SPIN</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {(['S','P','I','N'] as const).map(letter => {
                                    const spinDetail = eval_?.spin_evaluation?.[letter]
                                    if (!spinDetail) return null
                                    const score = spinDetail.final_score
                                    return (
                                      <div key={letter} className="border border-gray-100 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${
                                            score >= 7 ? 'bg-green-500' : score >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                                          }`}>{letter}</span>
                                          <span className="text-sm font-medium text-gray-800">{SPIN_NAMES[letter]}</span>
                                          <span className={`ml-auto text-lg font-bold ${getScoreColor(score * 10)}`}>{score.toFixed(1)}/10</span>
                                        </div>

                                        {/* Indicators */}
                                        {spinDetail.indicators && (
                                          <div className="space-y-2 mb-3">
                                            {Object.entries(spinDetail.indicators).map(([key, value]: [string, any]) => (
                                              <div key={key}>
                                                <div className="flex justify-between text-xs mb-0.5">
                                                  <span className="text-gray-600">{INDICATOR_LABELS[key] || key}</span>
                                                  <span className={`font-medium ${getScoreColor(value * 10)}`}>{value}/10</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                  <div className={`h-1.5 rounded-full ${
                                                    value >= 7 ? 'bg-green-500' : value >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                                                  }`} style={{ width: `${(value / 10) * 100}%` }} />
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* Feedback */}
                                        {spinDetail.technical_feedback && (
                                          <p className="text-xs text-gray-500 italic">{spinDetail.technical_feedback}</p>
                                        )}

                                        {/* Missed opportunities */}
                                        {spinDetail.missed_opportunities?.length > 0 && (
                                          <div className="mt-2 bg-orange-50 rounded-lg p-2">
                                            <p className="text-xs font-medium text-orange-700 mb-1">Oportunidades perdidas:</p>
                                            <ul className="space-y-0.5">
                                              {spinDetail.missed_opportunities.map((opp: string, i: number) => (
                                                <li key={i} className="text-xs text-orange-600">• {opp}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Objections Analysis */}
                            {isSales && eval_?.objections_analysis?.length > 0 && (
                              <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <h4 className="text-sm font-semibold text-gray-800 mb-3">🛡️ Análise de Objeções ({eval_.objections_analysis.length})</h4>
                                <div className="space-y-3">
                                  {eval_.objections_analysis.map((obj: any, idx: number) => (
                                    <div key={idx} className="border border-gray-100 rounded-lg p-3">
                                      <div className="flex items-start justify-between mb-2">
                                        <div>
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                            obj.objection_type?.includes('pre') ? 'bg-red-100 text-red-700' :
                                            obj.objection_type === 'timing' ? 'bg-blue-100 text-blue-700' :
                                            obj.objection_type?.includes('auto') ? 'bg-purple-100 text-purple-700' :
                                            obj.objection_type?.includes('conc') ? 'bg-orange-100 text-orange-700' :
                                            'bg-gray-100 text-gray-600'
                                          }`}>{obj.objection_type || 'outro'}</span>
                                          <p className="text-sm text-gray-600 italic mt-1">&ldquo;{obj.objection_text}&rdquo;</p>
                                        </div>
                                        <span className={`text-lg font-bold flex-shrink-0 ml-4 ${getScoreColor(obj.score * 10)}`}>{obj.score}</span>
                                      </div>
                                      <p className="text-xs text-gray-500">{obj.detailed_analysis}</p>
                                      {obj.critical_errors?.length > 0 && (
                                        <div className="mt-2">
                                          {obj.critical_errors.map((err: string, i: number) => (
                                            <p key={i} className="text-xs text-red-600">⚠ {err}</p>
                                          ))}
                                        </div>
                                      )}
                                      {obj.ideal_response && (
                                        <div className="mt-2 bg-green-50 rounded-lg p-2">
                                          <p className="text-xs text-green-700"><strong>Resposta ideal:</strong> {obj.ideal_response}</p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Executive Summary + Strengths + Gaps + Improvements */}
                            {eval_ && (
                              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                                <h4 className="text-sm font-semibold text-gray-800">📝 Avaliação Detalhada</h4>

                                {eval_.executive_summary && (
                                  <div className="bg-blue-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-blue-800 mb-1">Resumo Executivo</p>
                                    <p className="text-sm text-blue-900">{eval_.executive_summary}</p>
                                  </div>
                                )}

                                {eval_.top_strengths?.length > 0 && (
                                  <div className="bg-green-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-green-800 mb-1 flex items-center gap-1">
                                      <CheckCircle className="w-3.5 h-3.5" /> Pontos Fortes
                                    </p>
                                    <ul className="space-y-0.5">
                                      {eval_.top_strengths.map((s: string, i: number) => (
                                        <li key={i} className="text-xs text-green-700">• {s}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {eval_.critical_gaps?.length > 0 && (
                                  <div className="bg-orange-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-orange-800 mb-1 flex items-center gap-1">
                                      <AlertCircle className="w-3.5 h-3.5" /> Gaps Críticos
                                    </p>
                                    <ul className="space-y-0.5">
                                      {eval_.critical_gaps.map((g: string, i: number) => (
                                        <li key={i} className="text-xs text-orange-700">• {g}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {eval_.priority_improvements?.length > 0 && (
                                  <div className="bg-purple-50 rounded-lg p-3">
                                    <p className="text-xs font-medium text-purple-800 mb-1">💡 Melhorias Prioritárias</p>
                                    <ul className="space-y-0.5">
                                      {eval_.priority_improvements.map((imp: any, i: number) => (
                                        <li key={i} className="text-xs text-purple-700">
                                          • {typeof imp === 'string' ? imp : `${imp.area}: ${imp.action_plan}`}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Playbook Adherence */}
                                {eval_.playbook_adherence && (
                                  <div className="border border-gray-100 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-medium text-gray-800">Aderência ao Playbook</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-gray-900">{eval_.playbook_adherence.overall_adherence_score}%</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                          eval_.playbook_adherence.adherence_level === 'exemplary' ? 'bg-green-100 text-green-700' :
                                          eval_.playbook_adherence.adherence_level === 'compliant' ? 'bg-blue-100 text-blue-700' :
                                          eval_.playbook_adherence.adherence_level === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-red-100 text-red-700'
                                        }`}>{
                                          eval_.playbook_adherence.adherence_level === 'exemplary' ? 'Exemplar' :
                                          eval_.playbook_adherence.adherence_level === 'compliant' ? 'Conforme' :
                                          eval_.playbook_adherence.adherence_level === 'partial' ? 'Parcial' : 'Não Conforme'
                                        }</span>
                                      </div>
                                    </div>

                                    {eval_.playbook_adherence.violations?.length > 0 && (
                                      <div className="bg-red-50 rounded-lg p-2 mb-2">
                                        <p className="text-xs font-medium text-red-700 mb-1">Violações ({eval_.playbook_adherence.violations.length})</p>
                                        {eval_.playbook_adherence.violations.map((v: any, i: number) => (
                                          <div key={i} className="text-xs text-red-600 mb-1">
                                            <span className="font-medium">{v.criterion || v.description}</span>
                                            {v.evidence && <span className="italic text-red-500 ml-1">&ldquo;{v.evidence}&rdquo;</span>}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {eval_.playbook_adherence.coaching_notes && (
                                      <p className="text-xs text-gray-500 italic">{eval_.playbook_adherence.coaching_notes}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Transcript */}
                            {meet.transcript && (
                              <details className="bg-white rounded-xl border border-gray-200">
                                <summary className="p-4 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                                  💬 Transcrição da Reunião
                                  <span className="text-xs text-gray-400 ml-2">
                                    ({typeof meet.transcript === 'string' ? `${meet.transcript.split(' ').length} palavras` : `${meet.transcript.length} segmentos`})
                                  </span>
                                </summary>
                                <div className="px-4 pb-4 max-h-96 overflow-y-auto">
                                  {typeof meet.transcript === 'string' ? (
                                    <p className="text-xs text-gray-600 whitespace-pre-wrap">{meet.transcript}</p>
                                  ) : Array.isArray(meet.transcript) ? (
                                    <div className="space-y-1">
                                      {meet.transcript.map((seg: any, i: number) => (
                                        <div key={i} className="text-xs">
                                          <span className="font-medium text-gray-700">{seg.speaker || 'Speaker'}:</span>
                                          <span className="text-gray-600 ml-1">{seg.text}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </details>
                            )}

                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Alterar Plano</h3>
            <select
              value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value as PlanType)}
              className="w-full px-4 py-2 border rounded-lg mb-4 text-gray-900"
            >
              <option value="">Selecione...</option>
              {Object.entries(PLAN_NAMES).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={handleSavePlan} disabled={!selectedPlan || savingPlan}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {savingPlan ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setShowPlanModal(false)}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Créditos</h3>
            <input
              type="number"
              value={creditsToAdd}
              onChange={e => setCreditsToAdd(e.target.value)}
              placeholder="Quantidade"
              className="w-full px-4 py-2 border rounded-lg mb-4 text-gray-900"
              min="1"
            />
            <div className="flex gap-2">
              <button onClick={handleAddCredits} disabled={!creditsToAdd || addingCredits}
                className="flex-1 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50">
                {addingCredits ? 'Adicionando...' : 'Adicionar'}
              </button>
              <button onClick={() => setShowCreditsModal(false)}
                className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
        onConfirm={handleDelete}
        title="Deletar Empresa"
        message={`Tem certeza que deseja deletar "${company.name}"? Esta ação é irreversível e apagará todos os dados.`}
        confirmText="Deletar"
        cancelText="Cancelar"
        requireTyping={company.name}
        typedValue={deleteConfirmText}
        onTypedValueChange={setDeleteConfirmText}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}
