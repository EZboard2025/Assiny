'use client'

import { useState, useEffect } from 'react'
import { Building2, Plus, Globe, Users, Mail, Calendar, Trash2, Edit, Check, X, Loader2, UserCog, BarChart3, PlayCircle, Settings, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast, ToastContainer } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'

interface Company {
  id: string
  name: string
  subdomain: string
  created_at: string
  updated_at: string
  employee_limit: number | null
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

  // Edit limit modal states
  const [showEditLimitModal, setShowEditLimitModal] = useState(false)
  const [companyToEditLimit, setCompanyToEditLimit] = useState<Company | null>(null)
  const [newEmployeeLimit, setNewEmployeeLimit] = useState('')
  const [updatingLimit, setUpdatingLimit] = useState(false)

  // Manage users modal states
  const [showManageUsersModal, setShowManageUsersModal] = useState(false)
  const [companyToManageUsers, setCompanyToManageUsers] = useState<Company | null>(null)
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Toast system
  const { toasts, showToast, removeToast } = useToast()

  // Metrics states
  const [metrics, setMetrics] = useState<CompanyMetrics[]>([])
  const [metricsTotals, setMetricsTotals] = useState<MetricsTotals | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null)
  const [showUsersForCompany, setShowUsersForCompany] = useState<string | null>(null)

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
  const [subdomain, setSubdomain] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [businessType, setBusinessType] = useState<'B2B' | 'B2C'>('B2B')
  const [employeeLimit, setEmployeeLimit] = useState('10')

  useEffect(() => {
    // Verificar se já tem senha salva no sessionStorage
    const savedAuth = sessionStorage.getItem('admin-companies-auth')
    if (savedAuth === 'admin123') {
      setIsAuthenticated(true)
      loadCompanies()
    }
  }, [])

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

  const validateSubdomain = (value: string) => {
    // Remover caracteres especiais e espaços
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/\s+/g, '-')
  }

  const handleSubdomainChange = (value: string) => {
    const cleaned = validateSubdomain(value)
    setSubdomain(cleaned)
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
    if (!companyName || !subdomain || !adminName || !adminEmail || !adminPassword) {
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
      // Verificar se subdomínio já existe
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('subdomain', subdomain)
        .single()

      if (existingCompany) {
        setError('Este subdomínio já está em uso')
        setCreating(false)
        return
      }

      // Chamar API para criar empresa
      const response = await fetch('/api/admin/companies/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          subdomain,
          adminName,
          adminEmail,
          adminPassword,
          businessType,
          employeeLimit: parseInt(employeeLimit) || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar empresa')
      }

      showToast('success', `Empresa "${companyName}" criada!`, 'Configure os dados da empresa no ConfigHub.')

      // Limpar formulário
      setCompanyName('')
      setSubdomain('')
      setAdminName('')
      setAdminEmail('')
      setAdminPassword('')
      setBusinessType('B2B')
      setEmployeeLimit('10')

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

  const handleEditLimitClick = (company: Company) => {
    setCompanyToEditLimit(company)
    setNewEmployeeLimit(company.employee_limit?.toString() || '')
    setShowEditLimitModal(true)
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

  const confirmUpdateLimit = async () => {
    if (!companyToEditLimit) return

    setUpdatingLimit(true)

    try {
      const response = await fetch(`/api/admin/companies/update-limit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: companyToEditLimit.id,
          employeeLimit: newEmployeeLimit ? parseInt(newEmployeeLimit) : null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao atualizar limite')
      }

      showToast('success', 'Limite atualizado!', `Novo limite: ${newEmployeeLimit || 'Sem limite'}`)

      // Fechar modal e limpar estados
      setShowEditLimitModal(false)
      setCompanyToEditLimit(null)
      setNewEmployeeLimit('')

      // Recarregar lista
      await loadCompanies()

    } catch (error: any) {
      console.error('Erro ao atualizar limite:', error)
      showToast('error', 'Erro ao atualizar limite', error.message)
    } finally {
      setUpdatingLimit(false)
    }
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

  // Tela de senha
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 border border-purple-500/30">
            <div className="text-center mb-6">
              <Building2 className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">Gerenciar Empresas</h1>
              <p className="text-gray-400">Digite a senha para acessar</p>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de acesso"
                className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none mb-4"
                autoFocus
              />
              <button
                type="submit"
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-medium hover:scale-105 transition-all shadow-lg shadow-purple-500/30"
              >
                Acessar
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-4">
              Senha padrão: admin123
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Building2 className="w-10 h-10 text-purple-400" />
              Gerenciar Empresas
            </h1>
            <p className="text-gray-400">Administre as empresas do sistema multi-tenant</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleToggleMetrics}
              className={`px-6 py-3 ${showMetrics ? 'bg-gradient-to-r from-blue-600 to-blue-500' : 'bg-gray-700 hover:bg-gray-600'} text-white rounded-xl font-medium transition-all flex items-center gap-2`}
            >
              <BarChart3 className="w-5 h-5" />
              {showMetrics ? 'Ocultar Métricas' : 'Ver Métricas'}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-medium hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/30"
            >
              <Plus className="w-5 h-5" />
              Nova Empresa
            </button>
          </div>
        </div>

        {/* Metrics Section */}
        {showMetrics && (
          <div className="mb-8 space-y-6">
            {/* Totals Cards */}
            {loadingMetrics ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            ) : metricsTotals && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-2xl p-5 border border-blue-500/30">
                    <div className="flex items-center gap-3 mb-2">
                      <PlayCircle className="w-6 h-6 text-blue-400" />
                      <span className="text-sm text-gray-400">Total de Roleplays</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{metricsTotals.totalRoleplays}</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-2xl p-5 border border-purple-500/30">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-6 h-6 text-purple-400" />
                      <span className="text-sm text-gray-400">Treinamento</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{metricsTotals.trainingRoleplays}</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-2xl p-5 border border-green-500/30">
                    <div className="flex items-center gap-3 mb-2">
                      <Globe className="w-6 h-6 text-green-400" />
                      <span className="text-sm text-gray-400">Públicos</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{metricsTotals.publicRoleplays}</p>
                  </div>

                  <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 rounded-2xl p-5 border border-orange-500/30">
                    <div className="flex items-center gap-3 mb-2">
                      <Settings className="w-6 h-6 text-orange-400" />
                      <span className="text-sm text-gray-400">Empresas Configuradas</span>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {metricsTotals.fullyConfiguredCompanies}/{metricsTotals.totalCompanies}
                    </p>
                  </div>
                </div>

                {/* Per Company Metrics */}
                <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 rounded-2xl border border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-700 bg-gray-800/50">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                      Métricas por Empresa
                    </h3>
                  </div>

                  <div className="divide-y divide-gray-700">
                    {metrics.map((metric) => (
                      <div key={metric.companyId} className="p-4">
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedMetricId(expandedMetricId === metric.companyId ? null : metric.companyId)}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${metric.isFullyConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <div>
                              <p className="font-medium text-white">{metric.companyName}</p>
                              <p className="text-sm text-gray-400">{metric.subdomain}.ramppy.site</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm text-gray-400">Roleplays</p>
                              <p className="font-semibold text-white">{metric.roleplays.total}</p>
                            </div>
                            <div className="text-right hidden sm:block">
                              <p className="text-sm text-gray-400">Treinamento / Público</p>
                              <p className="font-semibold text-white">{metric.roleplays.training} / {metric.roleplays.public}</p>
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
                          <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="flex items-center gap-2">
                                {metric.configStatus.hasPersonas ? (
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                                )}
                                <span className="text-sm text-gray-300">
                                  Personas: {metric.configStatus.personasCount}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {metric.configStatus.hasObjections ? (
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                                )}
                                <span className="text-sm text-gray-300">
                                  Objeções: {metric.configStatus.objectionsCount}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {metric.configStatus.hasCompanyData ? (
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                                )}
                                <span className="text-sm text-gray-300">
                                  Dados da Empresa
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {metric.configStatus.hasBusinessType ? (
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-yellow-400" />
                                )}
                                <span className="text-sm text-gray-300">
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
                                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg text-sm font-medium transition-colors"
                                >
                                  <Users className="w-4 h-4" />
                                  {showUsersForCompany === metric.companyId ? 'Ocultar' : 'Ver'} Usuários ({metric.usersWithRoleplays.length})
                                </button>

                                {/* Lista de Usuários */}
                                {showUsersForCompany === metric.companyId && (
                                  <div className="mt-3 bg-gray-800/50 rounded-xl p-3 space-y-2">
                                    {metric.usersWithRoleplays.map((user) => (
                                      <div key={user.id} className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded-lg">
                                        <div>
                                          <p className="text-sm font-medium text-white">{user.name}</p>
                                          <p className="text-xs text-gray-400">{user.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <PlayCircle className="w-4 h-4 text-purple-400" />
                                          <span className="text-sm font-semibold text-purple-300">{user.roleplayCount}</span>
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
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-20 text-center border border-purple-500/20">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhuma empresa cadastrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <div
                key={company.id}
                className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1">{company.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Globe className="w-4 h-4" />
                      <span>{company.subdomain}.ramppy.local</span>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleManageUsersClick(company)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                      title="Gerenciar usuários"
                    >
                      <Users className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleEditLimitClick(company)}
                      className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                      title="Editar limite de funcionários"
                    >
                      <UserCog className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteClick(company)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Excluir empresa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>
                      {company._count?.employees || 0}
                      {company.employee_limit ? ` / ${company.employee_limit}` : ''} funcionários
                    </span>
                    {company.employee_limit && company._count && company._count.employees >= company.employee_limit && (
                      <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">Limite atingido</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-gray-300">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <span>
                      Criada em {new Date(company.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
                  <div className="flex gap-2">
                    <a
                      href={`http://${company.subdomain}.ramppy.local:3000`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg text-sm font-medium text-center transition-colors"
                    >
                      Acessar Local
                    </a>
                    <a
                      href={`https://${company.subdomain}.ramppy.site`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-300 rounded-lg text-sm font-medium text-center transition-colors"
                    >
                      Acessar Produção
                    </a>
                  </div>
                  <a
                    href={`https://${company.subdomain}.ramppy.site?openConfigHub=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg text-sm font-medium text-center transition-colors flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Ver Configurações
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Company Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-2xl w-full border border-purple-500/30 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Criar Nova Empresa</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400">
                  {success}
                </div>
              )}

              <div className="space-y-4">
                {/* Dados da Empresa */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Dados da Empresa</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Nome da Empresa
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ex: Tech Solutions"
                        className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Subdomínio
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={subdomain}
                          onChange={(e) => handleSubdomainChange(e.target.value)}
                          placeholder="techsolutions"
                          className="flex-1 px-4 py-2 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                        />
                        <span className="text-gray-400">.ramppy.local</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Apenas letras minúsculas, números e hífens
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Tipo de Negócio
                      </label>
                      <select
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value as 'B2B' | 'B2C')}
                        className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white focus:border-purple-500/50 focus:outline-none"
                      >
                        <option value="B2B">B2B (Empresa para Empresa)</option>
                        <option value="B2C">B2C (Empresa para Consumidor)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Limite de Funcionários
                      </label>
                      <input
                        type="number"
                        value={employeeLimit}
                        onChange={(e) => setEmployeeLimit(e.target.value)}
                        placeholder="10"
                        min="1"
                        className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Deixe vazio para sem limite
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dados do Administrador */}
                <div className="pt-4 border-t border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-3">Administrador da Empresa</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Nome do Administrador
                      </label>
                      <input
                        type="text"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="João Silva"
                        className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Email do Administrador
                      </label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@techsolutions.com"
                        className="w-full px-4 py-2 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Senha Inicial
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="flex-1 px-4 py-2 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-xl text-sm font-medium transition-colors"
                        >
                          Gerar Senha
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-700">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateCompany}
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        {/* Edit Limit Modal */}
        {showEditLimitModal && companyToEditLimit && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-md w-full border border-purple-500/30">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Editar Limite de Funcionários</h2>
                <button
                  onClick={() => {
                    setShowEditLimitModal(false)
                    setCompanyToEditLimit(null)
                    setNewEmployeeLimit('')
                  }}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-gray-300 mb-4">
                    Empresa: <strong className="text-white">{companyToEditLimit.name}</strong>
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    Funcionários atuais: <strong className="text-purple-400">{companyToEditLimit._count?.employees || 0}</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Novo Limite de Funcionários
                  </label>
                  <input
                    type="number"
                    value={newEmployeeLimit}
                    onChange={(e) => setNewEmployeeLimit(e.target.value)}
                    placeholder="Ex: 20"
                    min="1"
                    className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Deixe vazio para remover o limite (ilimitado)
                  </p>
                </div>

                {companyToEditLimit._count && newEmployeeLimit && parseInt(newEmployeeLimit) < companyToEditLimit._count.employees && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <p className="text-sm text-yellow-400">
                      ⚠️ <strong>Atenção:</strong> O novo limite é menor que a quantidade atual de funcionários.
                      Os funcionários existentes não serão removidos, mas não será possível adicionar novos até reduzir a quantidade.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditLimitModal(false)
                    setCompanyToEditLimit(null)
                    setNewEmployeeLimit('')
                  }}
                  disabled={updatingLimit}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmUpdateLimit}
                  disabled={updatingLimit}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {updatingLimit ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Salvar Limite
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
                Tem certeza que deseja excluir a empresa <strong className="text-white">{companyToDelete?.name}</strong>?
              </p>
              <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 space-y-1">
                <p className="text-sm font-semibold text-red-400">⚠️ Esta ação irá deletar PERMANENTEMENTE:</p>
                <ul className="text-sm text-gray-300 space-y-1 ml-4">
                  <li>• A empresa e todas as configurações</li>
                  <li>• Todos os funcionários e usuários</li>
                  <li>• Todas as personas e objeções</li>
                  <li>• Todos os dados da empresa</li>
                  <li>• Todos os históricos de roleplay</li>
                  <li>• Todas as sessões de chat</li>
                </ul>
              </div>
              <p className="text-sm text-yellow-400 font-semibold">
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-4xl w-full border border-purple-500/30 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Gerenciar Usuários</h2>
                  <p className="text-sm text-gray-400 mt-1">Empresa: {companyToManageUsers.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowManageUsersModal(false)
                    setCompanyToManageUsers(null)
                    setCompanyUsers([])
                  }}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingUsers ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Carregando usuários...</p>
                </div>
              ) : companyUsers.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhum usuário encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {companyUsers.map(user => (
                    <div
                      key={user.user_id}
                      className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h4 className="text-white font-medium">{user.name}</h4>
                        <p className="text-sm text-gray-400">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.user_id, e.target.value)}
                          className="px-4 py-2 bg-gray-700/50 border border-purple-500/30 rounded-lg text-white focus:border-purple-500/50 focus:outline-none"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Vendedor">Vendedor</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-700">
                <div className="text-sm text-gray-400">
                  <p className="mb-2">📌 Notas:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• <strong className="text-purple-400">Admin:</strong> Acesso total, incluindo ConfigHub</li>
                    <li>• <strong className="text-purple-400">Vendedor:</strong> Acesso apenas aos treinamentos</li>
                    <li>• As alterações são aplicadas imediatamente</li>
                  </ul>
                </div>
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