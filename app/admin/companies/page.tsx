'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Globe, Users, Mail, Calendar, Trash2, Edit, Check, X, Loader2, BarChart3, PlayCircle, Settings, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Package, Clock, MessageSquare, FileText, Star, ChevronRight, Lock, LockOpen, Zap, Search, Target } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast, ToastContainer } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'
import { PlanType, PLAN_CONFIGS, PLAN_NAMES } from '@/lib/types/plans'
import { getTimeUntilReset } from '@/lib/utils/resetTimer'

interface Company {
  id: string
  name: string
  subdomain: string
  created_at: string
  updated_at: string
  employee_limit: number | null
  training_plan?: PlanType
  locked?: boolean
  monthly_credits_used?: number
  monthly_credits_reset_at?: string
  extra_monthly_credits?: number
  _count?: {
    employees: number
  }
}

interface UserWithRoleplays {
  id: string
  name: string
  email: string
  roleplayCount: number
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
  updated_at: string
  status: string
  messages: Array<{ role: string; text: string; timestamp?: string }>
  config: {
    age?: string
    temperament?: string
    persona?: string
    objections?: string[]
  }
  evaluation?: {
    overall_score?: number
    performance_level?: string
    executive_summary?: string
    spin_evaluation?: {
      S?: { final_score?: number }
      P?: { final_score?: number }
      I?: { final_score?: number }
      N?: { final_score?: number }
    }
    top_strengths?: string[]
    critical_gaps?: string[]
  }
  employee_name?: string
  employee_email?: string
}

interface CompanyMetrics {
  companyId: string
  companyName: string
  subdomain: string
  roleplays: {
    training: number
    public: number
    total: number
  }
  configStatus: {
    hasPersonas: boolean
    hasObjections: boolean
    hasCompanyData: boolean
    hasBusinessType: boolean
    personasCount: number
    objectionsCount: number
  }
  isFullyConfigured: boolean
  usersWithRoleplays: UserWithRoleplays[]
}

interface MetricsTotals {
  trainingRoleplays: number
  publicRoleplays: number
  totalRoleplays: number
  fullyConfiguredCompanies: number
  totalCompanies: number
}

export default function CompaniesAdmin() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Manage users modal states
  const [showManageUsersModal, setShowManageUsersModal] = useState(false)
  const [companyToManageUsers, setCompanyToManageUsers] = useState<Company | null>(null)
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Toast system
  const { toasts, showToast, removeToast } = useToast()

  // Toggle lock state
  const [togglingLock, setTogglingLock] = useState<string | null>(null)

  // Metrics states
  const [metrics, setMetrics] = useState<CompanyMetrics[]>([])
  const [metricsTotals, setMetricsTotals] = useState<MetricsTotals | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null)
  const [showUsersForCompany, setShowUsersForCompany] = useState<string | null>(null)

  // Timer state for weekly reset
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilReset())

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilReset(getTimeUntilReset())
    }, 1000) // Update every second

    return () => clearInterval(interval)
  }, [])

  // Load challenge generation info
  const loadChallengeGenInfo = async () => {
    try {
      const response = await fetch('/api/challenges/generate-all')
      const data = await response.json()
      if (response.ok) {
        setChallengeGenInfo(data)
      }
    } catch (error) {
      console.error('Erro ao carregar info de desafios:', error)
    }
  }

  // Generate challenges now (manual trigger)
  const generateChallengesNow = async () => {
    if (generatingChallenges) return

    setGeneratingChallenges(true)
    try {
      const response = await fetch('/api/admin/challenges/generate-now', {
        method: 'POST'
      })
      const data = await response.json()

      if (response.ok) {
        showToast(
          'success',
          'Desafios Gerados!',
          `${data.summary.generated} gerados, ${data.summary.skipped} pulados, ${data.deleted} deletados`
        )
        // Reload challenge info
        loadChallengeGenInfo()
      } else {
        showToast('error', 'Erro ao gerar desafios', data.error || 'Erro desconhecido')
      }
    } catch (error) {
      console.error('Erro ao gerar desafios:', error)
      showToast('error', 'Erro ao gerar desafios', 'Falha na requisição')
    } finally {
      setGeneratingChallenges(false)
    }
  }

  const loadMetrics = async () => {
    setLoadingMetrics(true)
    try {
      const response = await fetch('/api/admin/companies/metrics')
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setMetrics(data.metrics)
      setMetricsTotals(data.totals)
    } catch (error) {
      console.error('Erro ao carregar métricas:', error)
      showToast('error', 'Erro ao carregar métricas')
    } finally {
      setLoadingMetrics(false)
    }
  }

  const handleToggleMetrics = () => {
    if (!showMetrics && metrics.length === 0) {
      loadMetrics()
    }
    setShowMetrics(!showMetrics)
  }

  // Form fields
  const [companyName, setCompanyName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [businessType, setBusinessType] = useState<'B2B' | 'B2C'>('B2B')

  // Estados para criar novo usuário
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin' | 'vendedor' | 'representante'>('vendedor')
  const [creatingUser, setCreatingUser] = useState(false)
  const [selectedCompanyForNewUser, setSelectedCompanyForNewUser] = useState<Company | null>(null)

  // Estados para editar plano
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [companyToEditPlan, setCompanyToEditPlan] = useState<Company | null>(null)
  const [selectedTrainingPlan, setSelectedTrainingPlan] = useState<PlanType>(PlanType.INDIVIDUAL)
  const [updatingPlan, setUpdatingPlan] = useState(false)

  // Estados para adicionar créditos
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [companyToAddCredits, setCompanyToAddCredits] = useState<Company | null>(null)
  const [creditsToAdd, setCreditsToAdd] = useState('')
  const [addingCredits, setAddingCredits] = useState(false)

  // Estados para visualizar roleplays
  const [showRoleplaysModal, setShowRoleplaysModal] = useState(false)
  const [companyToViewRoleplays, setCompanyToViewRoleplays] = useState<Company | null>(null)
  const [roleplays, setRoleplays] = useState<RoleplaySession[]>([])
  const [loadingRoleplays, setLoadingRoleplays] = useState(false)
  const [selectedRoleplay, setSelectedRoleplay] = useState<RoleplaySession | null>(null)

  // Estados para desafios diários
  const [challengeGenInfo, setChallengeGenInfo] = useState<{
    lastGeneration: { timestamp: string; generated: number; skipped: number; errors: number; creditsUsed: number } | null
    nextGeneration: string
    enabledCompanies: number
    totalEmployees: number
  } | null>(null)
  const [generatingChallenges, setGeneratingChallenges] = useState(false)
  const [timeUntilChallengeGen, setTimeUntilChallengeGen] = useState({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    // Verificar se já tem senha salva no sessionStorage
    const savedAuth = sessionStorage.getItem('admin-companies-auth')
    if (savedAuth === 'admin123') {
      setIsAuthenticated(true)
      loadCompanies()
    }
  }, [])

  // Update challenge generation timer
  useEffect(() => {
    if (!challengeGenInfo?.nextGeneration) return

    const updateTimer = () => {
      const now = new Date()
      const next = new Date(challengeGenInfo.nextGeneration)
      const diff = next.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeUntilChallengeGen({ hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeUntilChallengeGen({ hours, minutes, seconds })
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [challengeGenInfo?.nextGeneration])

  // Load challenge info when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadChallengeGenInfo()
    }
  }, [isAuthenticated])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === 'admin123') {
      setIsAuthenticated(true)
      sessionStorage.setItem('admin-companies-auth', 'admin123')
      loadCompanies()
      showToast('success', 'Autenticado com sucesso!')
    } else {
      showToast('error', 'Senha incorreta', 'A senha informada está incorreta. Tente novamente.')
      setPassword('')
    }
  }

  const loadCompanies = async () => {
    try {
      setLoading(true)

      // Buscar empresas
      const { data: companiesData, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Para cada empresa, contar funcionários
      if (companiesData) {
        const companiesWithCounts = await Promise.all(
          companiesData.map(async (company) => {
            const { count } = await supabase
              .from('employees')
              .select('*', { count: 'exact', head: true })
              .eq('company_id', company.id)

            return {
              ...company,
              _count: {
                employees: count || 0
              }
            }
          })
        )

        setCompanies(companiesWithCounts)
      }
    } catch (error) {
      console.error('Erro ao carregar empresas:', error)
    } finally {
      setLoading(false)
    }
  }


  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setAdminPassword(password)
  }

  const handleCreateCompany = async () => {
    setError('')
    setSuccess('')

    // Validações
    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      setError('Todos os campos são obrigatórios')
      return
    }

    if (!adminEmail.includes('@')) {
      setError('Email inválido')
      return
    }

    if (adminPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setCreating(true)

    try {

      // Chamar API para criar empresa
      const response = await fetch('/api/admin/companies/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          adminName,
          adminEmail,
          adminPassword,
          businessType
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar empresa')
      }

      showToast('success', `Empresa "${companyName}" criada!`, 'Configure os dados da empresa no ConfigHub.')

      // Limpar formulário
      setCompanyName('')
      setAdminName('')
      setAdminEmail('')
      setAdminPassword('')
      setBusinessType('B2B')

      // Recarregar lista
      await loadCompanies()

      // Fechar modal
      setShowCreateModal(false)
      setSuccess('')
      setError('')

    } catch (error: any) {
      console.error('Erro ao criar empresa:', error)
      showToast('error', 'Erro ao criar empresa', error.message)
      setError(error.message || 'Erro ao criar empresa')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteClick = (company: Company) => {
    setCompanyToDelete(company)
    setDeleteConfirmText('')
    setShowDeleteModal(true)
  }

  const handleEditPlanClick = (company: Company) => {
    setCompanyToEditPlan(company)
    setSelectedTrainingPlan(company.training_plan || PlanType.INDIVIDUAL)
    setShowPlanModal(true)
  }

  const handleUpdatePlan = async () => {
    if (!companyToEditPlan) return

    setUpdatingPlan(true)
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          training_plan: selectedTrainingPlan
        })
        .eq('id', companyToEditPlan.id)

      if (error) throw error

      const trainingName = PLAN_NAMES[selectedTrainingPlan]

      showToast('success', 'Plano atualizado!', `Plano: ${trainingName}`)

      setShowPlanModal(false)
      setCompanyToEditPlan(null)
      await loadCompanies()
    } catch (error: any) {
      console.error('Erro ao atualizar planos:', error)
      showToast('error', 'Erro ao atualizar planos', error.message)
    } finally {
      setUpdatingPlan(false)
    }
  }

  // Funções para adicionar créditos
  const handleAddCreditsClick = (company: Company) => {
    setCompanyToAddCredits(company)
    setCreditsToAdd('')
    setShowCreditsModal(true)
  }

  const handleAddCredits = async () => {
    if (!companyToAddCredits || !creditsToAdd) return

    const credits = parseInt(creditsToAdd)
    if (isNaN(credits) || credits <= 0) {
      showToast('error', 'Valor inválido', 'Insira um número positivo de créditos')
      return
    }

    setAddingCredits(true)
    try {
      const response = await fetch('/api/admin/companies/add-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: companyToAddCredits.id,
          credits: credits
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      showToast('success', 'Créditos adicionados!', `+${credits} créditos para ${companyToAddCredits.name}`)
      setShowCreditsModal(false)
      setCompanyToAddCredits(null)
      setCreditsToAdd('')
      await loadCompanies()
    } catch (error: any) {
      console.error('Erro ao adicionar créditos:', error)
      showToast('error', 'Erro ao adicionar créditos', error.message)
    } finally {
      setAddingCredits(false)
    }
  }

  const handleManageUsersClick = async (company: Company) => {
    setCompanyToManageUsers(company)
    setShowManageUsersModal(true)
    await loadCompanyUsers(company.id)
  }

  const loadCompanyUsers = async (companyId: string) => {
    setLoadingUsers(true)
    try {
      const response = await fetch(`/api/admin/companies/users?companyId=${companyId}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setCompanyUsers(data.users || [])
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      showToast('error', 'Erro ao carregar usuários', 'Tente novamente')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleOpenCreateUser = (company: Company) => {
    setSelectedCompanyForNewUser(company)
    setShowCreateUserModal(true)
    setNewUserName('')
    setNewUserEmail('')
    setNewUserPassword('')
    setNewUserRole('vendedor')
  }

  const generateUserPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewUserPassword(password)
  }

  const handleCreateUser = async () => {
    if (!selectedCompanyForNewUser) return

    // Validações
    if (!newUserName || !newUserEmail || !newUserPassword) {
      showToast('error', 'Todos os campos são obrigatórios')
      return
    }

    if (!newUserEmail.includes('@')) {
      showToast('error', 'Email inválido')
      return
    }

    if (newUserPassword.length < 6) {
      showToast('error', 'A senha deve ter pelo menos 6 caracteres')
      return
    }

    setCreatingUser(true)

    try {
      const response = await fetch('/api/employees/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
          company_id: selectedCompanyForNewUser.id
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário')
      }

      showToast('success', 'Usuário criado com sucesso!', `${newUserName} foi adicionado à empresa ${selectedCompanyForNewUser.name}`)

      // Limpar formulário e fechar modal
      setShowCreateUserModal(false)
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserRole('vendedor')

      // Recarregar usuários se o modal de gerenciamento estiver aberto
      if (showManageUsersModal && companyToManageUsers?.id === selectedCompanyForNewUser.id) {
        await loadCompanyUsers(selectedCompanyForNewUser.id)
      }

      // Recarregar empresas para atualizar contadores
      await loadCompanies()
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error)
      showToast('error', 'Erro ao criar usuário', error.message || 'Tente novamente')
    } finally {
      setCreatingUser(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const response = await fetch('/api/admin/companies/update-role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error)

      // Atualizar localmente
      setCompanyUsers(users =>
        users.map(u => u.user_id === userId ? { ...u, role: newRole } : u)
      )

      showToast('success', 'Role atualizado!', `Novo role: ${newRole}`)
    } catch (error: any) {
      console.error('Erro ao atualizar role:', error)
      showToast('error', 'Erro ao atualizar role', error.message)
    }
  }

  // Função para carregar roleplays de uma empresa
  const handleViewRoleplays = async (company: Company) => {
    setCompanyToViewRoleplays(company)
    setShowRoleplaysModal(true)
    setLoadingRoleplays(true)
    setRoleplays([])
    setSelectedRoleplay(null)

    try {
      const response = await fetch(`/api/admin/companies/roleplays?companyId=${company.id}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setRoleplays(data.roleplays || [])
    } catch (error: any) {
      console.error('Erro ao carregar roleplays:', error)
      showToast('error', 'Erro ao carregar roleplays', error.message)
    } finally {
      setLoadingRoleplays(false)
    }
  }

  // Helper para formatar score
  const getScoreColor = (score: number | undefined) => {
    if (score === undefined) return 'text-gray-400'
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    if (score >= 4) return 'text-orange-500'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number | undefined) => {
    if (score === undefined) return 'bg-gray-100'
    if (score >= 8) return 'bg-green-50'
    if (score >= 6) return 'bg-yellow-50'
    if (score >= 4) return 'bg-orange-50'
    return 'bg-red-50'
  }

  const confirmDelete = async () => {
    if (!companyToDelete) return

    try {
      // Chamar API de deletar empresa
      const response = await fetch(`/api/admin/companies/delete?companyId=${companyToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao deletar empresa')
      }

      showToast('success', 'Empresa deletada!', result.message)

      // Fechar modal e limpar estados
      setShowDeleteModal(false)
      setCompanyToDelete(null)
      setDeleteConfirmText('')

      // Recarregar lista
      await loadCompanies()

    } catch (error: any) {
      console.error('Erro ao excluir empresa:', error)
      showToast('error', 'Erro ao excluir empresa', error.message)
    }
  }

  const toggleLock = async (company: Company) => {
    setTogglingLock(company.id)

    try {
      const response = await fetch('/api/admin/companies/toggle-lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyId: company.id })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao alterar bloqueio')
      }

      showToast('success', result.locked ? 'Empresa bloqueada!' : 'Empresa desbloqueada!', result.message)

      // Recarregar lista
      await loadCompanies()

    } catch (error: any) {
      console.error('Erro ao alterar bloqueio:', error)
      showToast('error', 'Erro ao alterar bloqueio', error.message)
    } finally {
      setTogglingLock(null)
    }
  }

  // Tela de senha
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-200">
                <Building2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Gerenciar Empresas</h1>
              <p className="text-gray-500">Digite a senha para acessar</p>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de acesso"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all mb-4"
                autoFocus
              />
              <button
                type="submit"
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
              >
                Acessar
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-4">
              Senha padrão: admin123
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Filtrar empresas baseado na busca
  const filteredCompanies = companies.filter(company =>
    searchQuery === '' ||
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.subdomain.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#F8F9FA] py-8 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gerenciar Empresas</h1>
                <p className="text-gray-500 text-sm">Administre as empresas do sistema multi-tenant</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleToggleMetrics}
                className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${showMetrics ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                <BarChart3 className="w-5 h-5" />
                {showMetrics ? 'Ocultar Métricas' : 'Ver Métricas'}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
              >
                <Plus className="w-5 h-5" />
                Nova Empresa
              </button>
            </div>
          </div>
        </div>

        {/* Timers */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6 shadow-sm overflow-hidden">
          {/* Monthly Reset Timer */}
          <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-100">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Reset mensal em:</span>
              <div className="flex items-center gap-3 font-mono">
                {timeUntilReset.days > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold text-gray-900">{timeUntilReset.days}</span>
                    <span className="text-xs text-gray-400">dias</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-gray-900">{String(timeUntilReset.hours).padStart(2, '0')}</span>
                  <span className="text-xs text-gray-400">h</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-gray-900">{String(timeUntilReset.minutes).padStart(2, '0')}</span>
                  <span className="text-xs text-gray-400">m</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-gray-900">{String(timeUntilReset.seconds).padStart(2, '0')}</span>
                  <span className="text-xs text-gray-400">s</span>
                </div>
              </div>
            </div>
            <div className="ml-auto text-xs text-gray-400">
              Dia 1 do próximo mês às 00:00
            </div>
          </div>

          {/* Challenge Generation Timer */}
          <div className="px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Próxima geração de desafios:</span>
              <div className="flex items-center gap-3 font-mono">
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-gray-900">{String(timeUntilChallengeGen.hours).padStart(2, '0')}</span>
                  <span className="text-xs text-gray-400">h</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-gray-900">{String(timeUntilChallengeGen.minutes).padStart(2, '0')}</span>
                  <span className="text-xs text-gray-400">m</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-gray-900">{String(timeUntilChallengeGen.seconds).padStart(2, '0')}</span>
                  <span className="text-xs text-gray-400">s</span>
                </div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-xs text-gray-500">
                <span className="text-purple-600 font-medium">{challengeGenInfo?.enabledCompanies || 0}</span> empresas |{' '}
                <span className="text-purple-600 font-medium">{challengeGenInfo?.totalEmployees || 0}</span> vendedores
              </div>
              <div className="text-xs text-gray-400">
                Todos os dias à meia-noite
              </div>
              <button
                onClick={generateChallengesNow}
                disabled={generatingChallenges}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {generatingChallenges ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3" />
                    Gerar Agora
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar empresa por nome ou subdomínio..."
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-300 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Metrics Section */}
        {showMetrics && (
          <div className="mb-8 space-y-6">
            {/* Totals Cards */}
            {loadingMetrics ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
              </div>
            ) : metricsTotals && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                        <PlayCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">Total de Roleplays</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{metricsTotals.totalRoleplays}</p>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">Treinamento</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{metricsTotals.trainingRoleplays}</p>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                        <Globe className="w-5 h-5 text-purple-600" />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">Públicos</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{metricsTotals.publicRoleplays}</p>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                        <Settings className="w-5 h-5 text-yellow-600" />
                      </div>
                      <span className="text-xs text-gray-500 font-medium">Empresas Configuradas</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {metricsTotals.fullyConfiguredCompanies}/{metricsTotals.totalCompanies}
                    </p>
                  </div>
                </div>

                {/* Per Company Metrics */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-green-600" />
                      Métricas por Empresa
                    </h3>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {metrics.map((metric) => (
                      <div key={metric.companyId} className="p-4">
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedMetricId(expandedMetricId === metric.companyId ? null : metric.companyId)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${metric.isFullyConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <div>
                              <p className="font-medium text-gray-900">{metric.companyName}</p>
                              <p className="text-sm text-gray-500">{metric.subdomain}.ramppy.site</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Roleplays</p>
                              <p className="font-semibold text-gray-900">{metric.roleplays.total}</p>
                            </div>
                            <div className="text-right hidden sm:block">
                              <p className="text-sm text-gray-500">Treinamento / Público</p>
                              <p className="font-semibold text-gray-900">{metric.roleplays.training} / {metric.roleplays.public}</p>
                            </div>
                            {expandedMetricId === metric.companyId ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedMetricId === metric.companyId && (
                          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="flex items-center gap-2">
                                {metric.configStatus.hasPersonas ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                                )}
                                <span className="text-sm text-gray-600">
                                  Personas: {metric.configStatus.personasCount}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {metric.configStatus.hasObjections ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                                )}
                                <span className="text-sm text-gray-600">
                                  Objeções: {metric.configStatus.objectionsCount}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {metric.configStatus.hasCompanyData ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                                )}
                                <span className="text-sm text-gray-600">
                                  Dados da Empresa
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {metric.configStatus.hasBusinessType ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                                )}
                                <span className="text-sm text-gray-600">
                                  Tipo de Negócio
                                </span>
                              </div>
                            </div>

                            {/* Botão Ver Usuários */}
                            {metric.usersWithRoleplays.length > 0 && (
                              <div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowUsersForCompany(showUsersForCompany === metric.companyId ? null : metric.companyId)
                                  }}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                  <Users className="w-4 h-4" />
                                  {showUsersForCompany === metric.companyId ? 'Ocultar' : 'Ver'} Usuários ({metric.usersWithRoleplays.length})
                                </button>

                                {/* Lista de Usuários */}
                                {showUsersForCompany === metric.companyId && (
                                  <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-2">
                                    {metric.usersWithRoleplays.map((user) => (
                                      <div key={user.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100">
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                          <p className="text-xs text-gray-500">{user.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <PlayCircle className="w-4 h-4 text-green-600" />
                                          <span className="text-sm font-semibold text-green-600">{user.roleplayCount}</span>
                                          <span className="text-xs text-gray-500">roleplays</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {metric.usersWithRoleplays.length === 0 && metric.roleplays.training > 0 && (
                              <p className="text-sm text-gray-500 italic">Nenhum usuário identificado nos roleplays</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Companies Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-white rounded-2xl p-20 text-center border border-gray-200 shadow-sm">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma empresa cadastrada</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="bg-white rounded-2xl p-20 text-center border border-gray-200 shadow-sm">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma empresa encontrada para &ldquo;{searchQuery}&rdquo;</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-4 text-green-600 hover:text-green-700 transition-colors text-sm font-medium"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-green-200 transition-all"
              >
                {/* Company Info */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{company.name}</h3>
                      {company.locked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 rounded-full text-xs font-semibold text-orange-700 flex-shrink-0">
                          <Lock className="w-3 h-3" />
                          BLOQUEADA
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      {company.subdomain}.ramppy.site
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {company.training_plan && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded-full">
                      <Package className="w-3 h-3 text-green-700" />
                      <span className="text-xs font-medium text-green-700">
                        {PLAN_NAMES[company.training_plan]}
                      </span>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 rounded-full">
                    <Zap className="w-3 h-3 text-yellow-700" />
                    <span className="text-xs font-medium text-yellow-700">
                      {company.monthly_credits_used || 0}/{(PLAN_CONFIGS[company.training_plan!]?.monthlyCredits || 0) + (company.extra_monthly_credits || 0)} créditos
                      {(company.extra_monthly_credits || 0) > 0 && (
                        <span className="text-green-600"> (+{company.extra_monthly_credits})</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-sm mb-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4 text-green-600" />
                    <span>
                      {company._count?.employees || 0}
                      {company.employee_limit ? ` / ${company.employee_limit}` : ''} funcionários
                    </span>
                    {company.employee_limit && company._count && company._count.employees >= company.employee_limit && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Limite atingido</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      Criada em {new Date(company.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Access Links */}
                <div className="mb-3">
                  {process.env.NEXT_PUBLIC_USE_UNIFIED_SYSTEM === 'true' ? (
                    <p className="text-xs text-gray-400 text-center">
                      Acesso unificado em ramppy.site
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <a
                        href={`http://${company.subdomain}.ramppy.local:3000`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium text-center transition-colors border border-gray-200"
                      >
                        Local
                      </a>
                      <a
                        href={`https://${company.subdomain}.ramppy.site`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium text-center transition-colors border border-green-200"
                      >
                        Produção
                      </a>
                      <a
                        href={`https://${company.subdomain}.ramppy.site?openConfigHub=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium text-center transition-colors border border-gray-200 flex items-center justify-center gap-1"
                      >
                        <Settings className="w-3 h-3" />
                        Config
                      </a>
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="pt-3 border-t border-gray-100 flex items-center gap-1">
                  <button
                    onClick={() => handleEditPlanClick(company)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Editar plano"
                  >
                    <Package className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleAddCreditsClick(company)}
                    className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                    title="Adicionar créditos"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenCreateUser(company)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Criar novo usuário"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleManageUsersClick(company)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Gerenciar usuários"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleViewRoleplays(company)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Ver roleplays"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleLock(company)}
                    disabled={togglingLock === company.id}
                    className={`p-2 rounded-lg transition-colors ${
                      company.locked
                        ? 'text-orange-500 hover:bg-orange-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={company.locked ? 'Desbloquear empresa' : 'Bloquear empresa'}
                  >
                    {togglingLock === company.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : company.locked ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <LockOpen className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => handleDeleteClick(company)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir empresa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Company Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Criar Nova Empresa
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
                  {success}
                </div>
              )}

              <div className="space-y-4">
                {/* Dados da Empresa */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Dados da Empresa</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome da Empresa
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ex: Tech Solutions"
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                      />
                    </div>


                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Negócio
                      </label>
                      <select
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value as 'B2B' | 'B2C')}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                      >
                        <option value="B2B">B2B (Empresa para Empresa)</option>
                        <option value="B2C">B2C (Empresa para Consumidor)</option>
                      </select>
                    </div>

                  </div>
                </div>

                {/* Dados do Administrador */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Administrador da Empresa</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome do Administrador
                      </label>
                      <input
                        type="text"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="João Silva"
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email do Administrador
                      </label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@techsolutions.com"
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Senha Inicial
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                        >
                          Gerar Senha
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateCompany}
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Criar Empresa
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false)
            setCompanyToDelete(null)
            setDeleteConfirmText('')
          }}
          onConfirm={confirmDelete}
          title="Deletar Empresa"
          message={
            <div className="space-y-3">
              <p>
                Tem certeza que deseja excluir a empresa <strong className="text-gray-900">{companyToDelete?.name}</strong>?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                <p className="text-sm font-semibold text-red-700">⚠️ Esta ação irá deletar PERMANENTEMENTE:</p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4">
                  <li>• A empresa e todas as configurações</li>
                  <li>• Todos os funcionários e usuários</li>
                  <li>• Todas as personas e objeções</li>
                  <li>• Todos os dados da empresa</li>
                  <li>• Todos os históricos de roleplay</li>
                  <li>• Todas as sessões de chat</li>
                </ul>
              </div>
              <p className="text-sm text-red-600 font-semibold">
                Esta ação NÃO pode ser desfeita!
              </p>
            </div>
          }
          confirmText="Deletar Empresa"
          cancelText="Cancelar"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          requireTyping={companyToDelete?.name}
          typedValue={deleteConfirmText}
          onTypedValueChange={setDeleteConfirmText}
        />

        {/* Manage Users Modal */}
        {showManageUsersModal && companyToManageUsers && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-4xl w-full border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Gerenciar Usuários</h2>
                  <p className="text-sm text-gray-500 mt-1">Empresa: {companyToManageUsers.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowManageUsersModal(false)
                    setCompanyToManageUsers(null)
                    setCompanyUsers([])
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingUsers ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Carregando usuários...</p>
                </div>
              ) : companyUsers.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum usuário encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {companyUsers.map(user => (
                    <div
                      key={user.user_id}
                      className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h4 className="text-gray-900 font-medium">{user.name}</h4>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none appearance-none cursor-pointer"
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5rem', paddingRight: '2.5rem' }}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Vendedor">Vendedor</option>
                          <option value="Representante">Representante</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  <p className="mb-2">📌 Notas:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• <strong className="text-green-600">Admin:</strong> Acesso total, incluindo ConfigHub</li>
                    <li>• <strong className="text-green-600">Vendedor:</strong> Acesso apenas aos treinamentos</li>
                    <li>• <strong className="text-green-600">Representante:</strong> Portal de parceiros (sem acesso a treinamentos)</li>
                    <li>• As alterações são aplicadas imediatamente</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Criar Novo Usuário */}
        {showCreateUserModal && selectedCompanyForNewUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full border border-gray-200 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Criar Novo Usuário</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Empresa: <span className="text-green-600 font-medium">{selectedCompanyForNewUser.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreateUserModal(false)
                    setSelectedCompanyForNewUser(null)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Usuário
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="João Silva"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="joao@empresa.com"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                    />
                    <button
                      onClick={generateUserPassword}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                    >
                      Gerar
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'vendedor' | 'representante')}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.25rem', paddingRight: '2.5rem' }}
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="admin">Administrador</option>
                    <option value="representante">Representante</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowCreateUserModal(false)
                      setSelectedCompanyForNewUser(null)
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateUser}
                    disabled={creatingUser}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                  >
                    {creatingUser ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Criando...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Criar Usuário</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan Selection Modal */}
        {showPlanModal && companyToEditPlan && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Selecionar Plano</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Empresa: <span className="text-green-600 font-medium">{companyToEditPlan.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPlanModal(false)
                    setCompanyToEditPlan(null)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Planos de Treinamento */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    Planos de Treinamento
                  </h3>
                  <div className="space-y-2">
                    {/* Individual Plan */}
                    <label className={`relative flex items-start p-4 rounded-xl cursor-pointer transition-all ${
                      selectedTrainingPlan === PlanType.INDIVIDUAL
                        ? 'bg-green-50 border-2 border-green-500'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}>
                      <input
                        type="radio"
                        value={PlanType.INDIVIDUAL}
                        checked={selectedTrainingPlan === PlanType.INDIVIDUAL}
                        onChange={(e) => setSelectedTrainingPlan(e.target.value as PlanType)}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{PLAN_NAMES[PlanType.INDIVIDUAL]}</span>
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                            R$ 129/mês
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">Para vendedores individuais</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">20 créditos/mês</span>
                          <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">1 vendedor</span>
                          <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">✓ Todos os recursos</span>
                        </div>
                      </div>
                    </label>

                    {/* Team Plan */}
                    <label className={`relative flex items-start p-4 rounded-xl cursor-pointer transition-all ${
                      selectedTrainingPlan === PlanType.TEAM
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}>
                      <input
                        type="radio"
                        value={PlanType.TEAM}
                        checked={selectedTrainingPlan === PlanType.TEAM}
                        onChange={(e) => setSelectedTrainingPlan(e.target.value as PlanType)}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{PLAN_NAMES[PlanType.TEAM]}</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            R$ 1.999/mês
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">Para equipes pequenas e médias</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">400 créditos/mês</span>
                          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">Até 20 vendedores</span>
                          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">+50 créd = R$250</span>
                        </div>
                      </div>
                    </label>

                    {/* Business Plan */}
                    <label className={`relative flex items-start p-4 rounded-xl cursor-pointer transition-all ${
                      selectedTrainingPlan === PlanType.BUSINESS
                        ? 'bg-purple-50 border-2 border-purple-500'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}>
                      <input
                        type="radio"
                        value={PlanType.BUSINESS}
                        checked={selectedTrainingPlan === PlanType.BUSINESS}
                        onChange={(e) => setSelectedTrainingPlan(e.target.value as PlanType)}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{PLAN_NAMES[PlanType.BUSINESS]}</span>
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                            R$ 4.999/mês
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">Para equipes grandes</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">1.000 créditos/mês</span>
                          <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">20-50 vendedores</span>
                          <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">+50 créd = R$250</span>
                          <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">+100 créd = R$450</span>
                        </div>
                      </div>
                    </label>

                    {/* Enterprise Plan */}
                    <label className={`relative flex items-start p-4 rounded-xl cursor-pointer transition-all ${
                      selectedTrainingPlan === PlanType.ENTERPRISE
                        ? 'bg-amber-50 border-2 border-amber-500'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}>
                      <input
                        type="radio"
                        value={PlanType.ENTERPRISE}
                        checked={selectedTrainingPlan === PlanType.ENTERPRISE}
                        onChange={(e) => setSelectedTrainingPlan(e.target.value as PlanType)}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{PLAN_NAMES[PlanType.ENTERPRISE]}</span>
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                            Personalizado
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">Para grandes operações - preço negociável</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded">Créditos ilimitados</span>
                          <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded">+50 vendedores</span>
                          <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded">Suporte dedicado</span>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowPlanModal(false)
                    setCompanyToEditPlan(null)
                  }}
                  disabled={updatingPlan}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdatePlan}
                  disabled={updatingPlan}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updatingPlan ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Salvar Plano
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Roleplays */}
        {showRoleplaysModal && companyToViewRoleplays && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-gray-200 shadow-xl">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                    Roleplays - {companyToViewRoleplays.name}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {roleplays.length} sessão(ões) encontrada(s)
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRoleplaysModal(false)
                    setCompanyToViewRoleplays(null)
                    setSelectedRoleplay(null)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex h-[calc(90vh-120px)]">
                {/* Lista de Roleplays */}
                <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
                  {loadingRoleplays ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                    </div>
                  ) : roleplays.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
                      <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-center">Nenhum roleplay encontrado para esta empresa</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {roleplays.map((roleplay) => (
                        <button
                          key={roleplay.id}
                          onClick={() => setSelectedRoleplay(roleplay)}
                          className={`w-full p-4 text-left transition-colors ${
                            selectedRoleplay?.id === roleplay.id
                              ? 'bg-green-50 border-l-4 border-green-500'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-900 font-medium truncate">
                              {roleplay.employee_name || 'Usuário'}
                            </span>
                            {roleplay.evaluation?.overall_score !== undefined && (
                              <span className={`text-sm font-bold ${getScoreColor(roleplay.evaluation.overall_score)}`}>
                                {roleplay.evaluation.overall_score.toFixed(1)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(roleplay.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(roleplay.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {roleplay.messages?.length || 0} mensagens
                            </div>
                            {roleplay.config?.persona && (
                              <div className="truncate text-green-600/70">
                                {roleplay.config.persona}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Detalhes do Roleplay */}
                <div className="flex-1 overflow-y-auto">
                  {!selectedRoleplay ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <ChevronRight className="w-12 h-12 mb-4 opacity-30" />
                      <p className="text-gray-500">Selecione um roleplay para ver os detalhes</p>
                    </div>
                  ) : (
                    <div className="p-6 space-y-6">
                      {/* Info do Funcionário e Scores */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Info */}
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h3 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4 text-green-600" />
                            Informações
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Funcionário:</span>
                              <span className="text-gray-900">{selectedRoleplay.employee_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Email:</span>
                              <span className="text-gray-600 text-xs">{selectedRoleplay.employee_email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Data:</span>
                              <span className="text-gray-900">
                                {new Date(selectedRoleplay.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Status:</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                selectedRoleplay.status === 'completed' ? 'bg-green-100 text-green-700' :
                                selectedRoleplay.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {selectedRoleplay.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Score Geral */}
                        <div className={`rounded-xl p-4 border ${getScoreBgColor(selectedRoleplay.evaluation?.overall_score)} border-gray-200`}>
                          <h3 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500" />
                            Avaliação
                          </h3>
                          {selectedRoleplay.evaluation ? (
                            <div className="space-y-3">
                              <div className="text-center">
                                <div className={`text-4xl font-bold ${getScoreColor(selectedRoleplay.evaluation.overall_score)}`}>
                                  {selectedRoleplay.evaluation.overall_score?.toFixed(1) || 'N/A'}
                                </div>
                                <div className="text-sm text-gray-500 capitalize">
                                  {selectedRoleplay.evaluation.performance_level?.replace(/_/g, ' ') || ''}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm text-center">Sem avaliação</p>
                          )}
                        </div>
                      </div>

                      {/* Scores SPIN */}
                      {selectedRoleplay.evaluation?.spin_evaluation && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h3 className="text-gray-900 font-semibold mb-3">Scores SPIN</h3>
                          <div className="grid grid-cols-4 gap-3">
                            {(['S', 'P', 'I', 'N'] as const).map((letter) => {
                              const score = selectedRoleplay.evaluation?.spin_evaluation?.[letter]?.final_score
                              return (
                                <div key={letter} className={`rounded-lg p-3 text-center ${getScoreBgColor(score)}`}>
                                  <div className="text-lg font-bold text-gray-900">{letter}</div>
                                  <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
                                    {score?.toFixed(1) || 'N/A'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {letter === 'S' && 'Situação'}
                                    {letter === 'P' && 'Problema'}
                                    {letter === 'I' && 'Implicação'}
                                    {letter === 'N' && 'Necessidade'}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Resumo Executivo */}
                      {selectedRoleplay.evaluation?.executive_summary && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h3 className="text-gray-900 font-semibold mb-3">Resumo Executivo</h3>
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {selectedRoleplay.evaluation.executive_summary}
                          </p>
                        </div>
                      )}

                      {/* Pontos Fortes e Gaps */}
                      <div className="grid grid-cols-2 gap-4">
                        {selectedRoleplay.evaluation?.top_strengths && selectedRoleplay.evaluation.top_strengths.length > 0 && (
                          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                            <h3 className="text-green-700 font-semibold mb-3">Pontos Fortes</h3>
                            <ul className="space-y-1">
                              {selectedRoleplay.evaluation.top_strengths.map((strength, idx) => (
                                <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                  {strength}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selectedRoleplay.evaluation?.critical_gaps && selectedRoleplay.evaluation.critical_gaps.length > 0 && (
                          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                            <h3 className="text-red-700 font-semibold mb-3">Gaps Críticos</h3>
                            <ul className="space-y-1">
                              {selectedRoleplay.evaluation.critical_gaps.map((gap, idx) => (
                                <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                  {gap}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Configuração */}
                      {selectedRoleplay.config && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h3 className="text-gray-900 font-semibold mb-3">Configuração da Sessão</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {selectedRoleplay.config.persona && (
                              <div>
                                <span className="text-gray-500">Persona:</span>
                                <p className="text-gray-900 mt-1">{selectedRoleplay.config.persona}</p>
                              </div>
                            )}
                            {selectedRoleplay.config.age && (
                              <div>
                                <span className="text-gray-500">Faixa Etária:</span>
                                <p className="text-gray-900 mt-1">{selectedRoleplay.config.age}</p>
                              </div>
                            )}
                            {selectedRoleplay.config.temperament && (
                              <div>
                                <span className="text-gray-500">Temperamento:</span>
                                <p className="text-gray-900 mt-1">{selectedRoleplay.config.temperament}</p>
                              </div>
                            )}
                            {selectedRoleplay.config.objections && selectedRoleplay.config.objections.length > 0 && (
                              <div className="col-span-2">
                                <span className="text-gray-500">Objeções:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {selectedRoleplay.config.objections.map((obj, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                      {obj}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Transcrição */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h3 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-600" />
                          Transcrição ({selectedRoleplay.messages?.length || 0} mensagens)
                        </h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {selectedRoleplay.messages?.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg ${
                                msg.role === 'seller' || msg.role === 'user'
                                  ? 'bg-green-50 border border-green-200 ml-8'
                                  : 'bg-gray-100 border border-gray-200 mr-8'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-medium ${
                                  msg.role === 'seller' || msg.role === 'user' ? 'text-green-600' : 'text-gray-700'
                                }`}>
                                  {msg.role === 'seller' || msg.role === 'user' ? 'Vendedor' : 'Cliente'}
                                </span>
                                {msg.timestamp && (
                                  <span className="text-xs text-gray-500">
                                    {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-600 text-sm">{msg.text}</p>
                            </div>
                          ))}
                          {(!selectedRoleplay.messages || selectedRoleplay.messages.length === 0) && (
                            <p className="text-gray-500 text-sm text-center py-4">
                              Nenhuma mensagem registrada
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Adicionar Créditos */}
        {showCreditsModal && companyToAddCredits && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full border border-gray-200 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Zap className="w-6 h-6 text-yellow-500" />
                    Adicionar Créditos
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Empresa: <span className="text-green-600 font-medium">{companyToAddCredits.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowCreditsModal(false)
                    setCompanyToAddCredits(null)
                    setCreditsToAdd('')
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Créditos atuais */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Limite do plano:</span>
                  <span className="text-lg font-bold text-green-600">
                    {PLAN_CONFIGS[companyToAddCredits.training_plan!]?.monthlyCredits ?? 'Ilimitado'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Créditos extras:</span>
                  <span className="text-lg font-bold text-green-600">
                    +{companyToAddCredits.extra_monthly_credits || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <span className="text-gray-500">Limite total:</span>
                  <span className="text-xl font-bold text-gray-900">
                    {(PLAN_CONFIGS[companyToAddCredits.training_plan!]?.monthlyCredits || 0) + (companyToAddCredits.extra_monthly_credits || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Créditos usados:</span>
                  <span className="text-lg text-gray-700">
                    {companyToAddCredits.monthly_credits_used || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-400 pt-2 border-t border-gray-200">
                  Os créditos adicionados aumentam o limite mensal total da empresa.
                </p>
              </div>

              {/* Input de créditos */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade de créditos a adicionar
                </label>
                <input
                  type="number"
                  min="1"
                  value={creditsToAdd}
                  onChange={(e) => setCreditsToAdd(e.target.value)}
                  placeholder="Ex: 50, 100, 200..."
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                />
              </div>

              {/* Pacotes sugeridos */}
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-3">Pacotes rápidos:</p>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 50, 100, 200, 500, 1000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setCreditsToAdd(amount.toString())}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        creditsToAdd === amount.toString()
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreditsModal(false)
                    setCompanyToAddCredits(null)
                    setCreditsToAdd('')
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddCredits}
                  disabled={addingCredits || !creditsToAdd}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {addingCredits ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Adicionar Créditos
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Container */}
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </div>
    </div>
  )
}