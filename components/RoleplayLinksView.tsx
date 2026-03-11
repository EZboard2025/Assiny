'use client'

import { useState, useEffect, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Link2, Copy, CheckCircle, Users, Power, Sparkles, Edit2, X, Save, Loader2, ArrowUpDown, Calendar, GitCompare, Check, AlertCircle, User, ChevronRight, ChevronDown, Trash2, Plus, FolderOpen } from 'lucide-react'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { PLAN_CONFIGS } from '@/lib/types/plans'

interface RoleplayLink {
  id: string
  company_id: string
  link_code: string
  name: string
  description?: string
  is_active: boolean
  config: {
    age: string
    temperament: string
    persona_id: string | null
    objection_ids: string[]
  }
  usage_count: number
  created_at: string
  updated_at: string
}

interface Company {
  id: string
  name: string
  subdomain: string
}

interface Persona {
  id: string
  job_title?: string
  company_type?: string
  profession?: string
  business_type: string
}

interface Objection {
  id: string
  name: string
}

export default function RoleplayLinksView() {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [allLinks, setAllLinks] = useState<RoleplayLink[]>([])
  const [roleplayLink, setRoleplayLink] = useState<RoleplayLink | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { trainingPlan, planUsage } = usePlanLimits()

  // Create group modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Tab: 'config' | 'historico'
  const [activeTab, setActiveTab] = useState<'config' | 'historico'>('config')

  const [historico, setHistorico] = useState<any[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null)

  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [compareMode, setCompareMode] = useState(false)
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)

  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [personas, setPersonas] = useState<Persona[]>([])
  const [objections, setObjections] = useState<Objection[]>([])
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null)

  const [config, setConfig] = useState({
    age: '25-34',
    temperament: 'Analítico',
    persona_id: null as string | null,
    objection_ids: [] as string[]
  })

  const [originalConfig, setOriginalConfig] = useState({
    age: '25-34',
    temperament: 'Analítico',
    persona_id: null as string | null,
    objection_ids: [] as string[]
  })

  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ─── DATA LOADING ──────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => { loadData() }, 100)
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') loadData()
      else if (event === 'SIGNED_OUT') { setError('Sessão encerrada. Por favor, faça login novamente.'); setLoading(false) }
    })
    return () => { clearTimeout(timer); authListener?.subscription?.unsubscribe() }
  }, [])

  const selectLink = (link: RoleplayLink) => {
    setRoleplayLink(link)
    const loadedConfig = link.config || { age: '25-34', temperament: 'Analítico', persona_id: null, objection_ids: [] }
    if ((loadedConfig as any).age_range && !loadedConfig.age) { loadedConfig.age = (loadedConfig as any).age_range }
    setConfig(loadedConfig)
    setOriginalConfig(JSON.parse(JSON.stringify(loadedConfig)))
    if (loadedConfig.persona_id && loadedConfig.objection_ids?.length > 0) { setConfigSaved(true); setEditMode(false) }
    else { setConfigSaved(false); setEditMode(true) }
    setHistorico([])
    setActiveTab('config')
  }

  const loadData = async () => {
    try {
      setError(null)
      if (typeof window !== 'undefined' && window.location.pathname.includes('roleplay-publico')) { setLoading(false); return }

      const { data: { session } } = await supabase.auth.getSession()
      let user = session?.user

      if (!user) {
        const storageKey = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').split('.')[0]}-auth-token`
        const storedSession = localStorage.getItem(storageKey)
        if (storedSession) { try { const parsed = JSON.parse(storedSession); if (parsed?.user) user = parsed.user } catch {} }
      }

      if (!user) { setError('Usuário não autenticado. Por favor, faça login novamente.'); setLoading(false); return }

      const { data: employeeData, error: employeeError } = await supabase.from('employees').select('company_id').eq('user_id', user.id).single()

      if (employeeError || !employeeData?.company_id) {
        try {
          const response = await fetch('/api/user/company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) })
          if (response.ok) {
            const { companyId: apiCompanyId } = await response.json()
            if (apiCompanyId) { setCurrentCompanyId(apiCompanyId) }
          }
        } catch {}
        setLoading(false); return
      }

      const companyId = employeeData.company_id
      setCurrentCompanyId(companyId)

      const { data: companyData } = await supabase.from('companies').select('*').eq('id', companyId).single()
      if (companyData) setCompany(companyData)

      const { data: personasData } = await supabase.from('personas').select('id, job_title, company_type, profession, business_type').eq('company_id', companyId).order('created_at')
      if (personasData) setPersonas(personasData)

      const { data: objectionsData } = await supabase.from('objections').select('id, name').eq('company_id', companyId).order('name')
      if (objectionsData) setObjections(objectionsData)

      // Fetch all links for this company via API (uses service role, bypasses RLS)
      const listResponse = await fetch(`/api/roleplay-links/list?companyId=${companyId}`)
      const listResult = await listResponse.json()
      const linksData = listResult.data || []

      if (linksData.length > 0) {
        const links = linksData.map((l: any) => ({ ...l, name: l.name || 'Grupo Padrão' })) as RoleplayLink[]
        setAllLinks(links)
        if (!roleplayLink) selectLink(links[0])
      } else {
        // No links yet — create a default one
        const createResponse = await fetch('/api/roleplay-links/get-or-create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, userId: user?.id })
        })
        if (createResponse.ok) {
          const result = await createResponse.json()
          const link = { ...result.data, name: result.data.name || 'Grupo Padrão' } as RoleplayLink
          setAllLinks([link])
          selectLink(link)
        }
      }
    } catch (error: any) {
      setError(error?.message || 'Erro ao carregar configuração do roleplay')
    } finally { setLoading(false) }
  }

  // ─── ACTIONS ──────────────────────────────────────────────────────

  const toggleActive = async () => {
    if (!roleplayLink) return
    setSaving(true)
    try {
      const newStatus = !roleplayLink.is_active
      const response = await fetch('/api/roleplay-links/toggle-active', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId: roleplayLink.id, isActive: newStatus })
      })
      const result = await response.json()
      if (!response.ok) { alert('Erro ao atualizar status do link.'); return }
      if (result.data) { setRoleplayLink(result.data); await loadData() }
    } catch { alert('Erro ao atualizar status do link.') }
    finally { setSaving(false) }
  }

  const saveConfig = async () => {
    if (!roleplayLink) return
    if (!config.persona_id) { alert('Selecione uma persona'); return }
    if (config.objection_ids.length === 0) { alert('Selecione pelo menos uma objeção'); return }

    setSaving(true)
    try {
      const normalizedConfig = {
        age: config.age || '25-34', temperament: config.temperament || 'Analítico',
        persona_id: config.persona_id || null,
        objection_ids: Array.isArray(config.objection_ids) ? config.objection_ids : []
      }
      const response = await fetch('/api/roleplay-links/update-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId: roleplayLink.id, config: normalizedConfig })
      })
      const result = await response.json()
      if (!response.ok || !result.success) { alert(`Erro ao salvar: ${result.error}`); return }

      const updatedLink = { ...roleplayLink, config: normalizedConfig }
      setRoleplayLink(updatedLink)
      setAllLinks(prev => prev.map(l => l.id === roleplayLink.id ? updatedLink : l))
      setConfig(normalizedConfig)
      setOriginalConfig(JSON.parse(JSON.stringify(normalizedConfig)))
      setConfigSaved(true)
      setEditMode(false)
    } catch { alert('Erro ao salvar configuração') }
    finally { setSaving(false) }
  }

  const copyLink = async () => {
    if (!roleplayLink?.link_code) return
    const link = getRoleplayUrl()
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); return } catch {}
    }
    const ta = document.createElement('textarea'); ta.value = link; ta.style.position = 'fixed'; ta.style.left = '-999999px'
    document.body.appendChild(ta); ta.focus(); ta.select()
    try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { alert(`Copie o link:\n\n${link}`) }
    ta.remove()
  }

  // Auto-load historico for stats panel
  useEffect(() => {
    if (roleplayLink?.id && historico.length === 0) loadHistorico()
  }, [roleplayLink?.id])

  const loadHistorico = async () => {
    if (!roleplayLink?.id) return
    setLoadingHistorico(true)
    try {
      const response = await fetch(`/api/public/roleplay/history?linkId=${roleplayLink.id}`)
      if (!response.ok) throw new Error('Erro')
      const data = await response.json()
      setHistorico(data.roleplays || [])
    } catch { alert('Erro ao carregar histórico') }
    finally { setLoadingHistorico(false) }
  }

  const getRoleplayUrl = () => {
    if (!roleplayLink?.link_code) return ''
    if (typeof window !== 'undefined' && (window.location.hostname.includes('localhost') || window.location.hostname.includes('ramppy.local'))) {
      return `http://localhost:3000/roleplay-publico?link=${roleplayLink.link_code}`
    }
    return `https://ramppy.site/roleplay-publico?link=${roleplayLink.link_code}`
  }

  const getSortedHistorico = () => {
    if (!historico?.length) return []
    return [...historico].sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'desc' ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime() : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      const hasA = a.evaluation?.overall_score !== null && a.evaluation?.overall_score !== undefined
      const hasB = b.evaluation?.overall_score !== null && b.evaluation?.overall_score !== undefined
      if (!hasA && !hasB) return 0
      if (!hasA) return 1
      if (!hasB) return -1
      const sA = Number(a.evaluation.overall_score)
      const sB = Number(b.evaluation.overall_score)
      return sortOrder === 'desc' ? sB - sA : sA - sB
    })
  }

  const toggleCompareMode = () => { setCompareMode(!compareMode); setDeleteMode(false); setSelectedForComparison([]); setShowComparison(false) }
  const toggleSelectForComparison = (id: string) => {
    if (selectedForComparison.includes(id)) setSelectedForComparison(selectedForComparison.filter(x => x !== id))
    else if (selectedForComparison.length < 4) setSelectedForComparison([...selectedForComparison, id])
    else alert('Máximo 4 para comparar')
  }

  const toggleDeleteMode = () => { setDeleteMode(!deleteMode); setCompareMode(false); setSelectedForDeletion([]); setSelectedForComparison([]) }
  const toggleSelectForDeletion = (id: string) => {
    if (selectedForDeletion.includes(id)) setSelectedForDeletion(selectedForDeletion.filter(x => x !== id))
    else setSelectedForDeletion([...selectedForDeletion, id])
  }
  const selectAllForDeletion = () => {
    if (selectedForDeletion.length === historico.length) setSelectedForDeletion([])
    else setSelectedForDeletion(historico.map(r => r.id))
  }
  const deleteSelected = async () => {
    if (selectedForDeletion.length === 0) return
    setDeleting(true)
    try {
      const response = await fetch('/api/public/roleplay/history/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedForDeletion })
      })
      if (!response.ok) throw new Error('Erro ao deletar')
      setHistorico(historico.filter(r => !selectedForDeletion.includes(r.id)))
      if (roleplayLink) {
        setRoleplayLink({ ...roleplayLink, usage_count: roleplayLink.usage_count - selectedForDeletion.length })
      }
      setSelectedForDeletion([])
      setDeleteMode(false)
      setShowDeleteConfirm(false)
    } catch { alert('Erro ao deletar simulações') }
    finally { setDeleting(false) }
  }

  // ─── GROUP MANAGEMENT ────────────────────────────────────────────

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    if (!currentCompanyId) { alert('Empresa não encontrada.'); return }
    setCreatingGroup(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const response = await fetch('/api/roleplay-links/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          companyId: currentCompanyId,
          userId: user?.id || null,
          config: { age: '25-34', temperament: 'Analítico', persona_id: null, objection_ids: [] }
        })
      })
      if (!response.ok) {
        const err = await response.json()
        alert(err.error || 'Erro ao criar grupo')
        return
      }
      const result = await response.json()
      const newLink = result.data as RoleplayLink
      setAllLinks(prev => [newLink, ...prev])
      selectLink(newLink)
      setShowCreateModal(false)
      setNewGroupName('')
    } catch { alert('Erro ao criar grupo') }
    finally { setCreatingGroup(false) }
  }

  const deleteGroup = async (linkId: string) => {
    try {
      const response = await fetch(`/api/roleplay-links/delete?id=${linkId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      const remaining = allLinks.filter(l => l.id !== linkId)
      setAllLinks(remaining)
      if (roleplayLink?.id === linkId) {
        if (remaining.length > 0) selectLink(remaining[0])
        else { setRoleplayLink(null); setHistorico([]) }
      }
    } catch { alert('Erro ao deletar grupo') }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────

  const scoreColor = (level: string) => {
    const m: Record<string, string> = { legendary: 'text-purple-600', excellent: 'text-green-600', very_good: 'text-blue-600', good: 'text-amber-600', needs_improvement: 'text-orange-600', poor: 'text-red-600' }
    return m[level] || 'text-gray-400'
  }
  const scoreBg = (level: string) => {
    const m: Record<string, string> = { legendary: 'bg-purple-50', excellent: 'bg-green-50', very_good: 'bg-blue-50', good: 'bg-amber-50', needs_improvement: 'bg-orange-50', poor: 'bg-red-50' }
    return m[level] || 'bg-gray-50'
  }
  const levelText = (level: string) => {
    const m: Record<string, string> = { legendary: 'Lendário', excellent: 'Excelente', very_good: 'Muito Bom', good: 'Bom', needs_improvement: 'Precisa Melhorar', poor: 'Fraco' }
    return m[level] || 'N/A'
  }

  // ─── LOADING / ERROR / EMPTY ──────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-xs">
        <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500 mb-4">{error}</p>
        <button onClick={() => { setError(null); setLoading(true); loadData() }}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-white text-sm font-medium transition-colors">
          Tentar novamente
        </button>
      </div>
    </div>
  )

  if (!roleplayLink && allLinks.length === 0) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-xs">
        <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500 mb-1">Nenhum grupo criado</p>
        <p className="text-xs text-gray-400 mb-4">Crie seu primeiro grupo de simulação</p>
        <button onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-white text-sm font-medium transition-colors flex items-center gap-2 mx-auto">
          <Plus className="w-4 h-4" />
          Criar Grupo
        </button>
      </div>
    </div>
  )

  if (!roleplayLink) return null

  // ─── MAIN RENDER ──────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FA]">
      <div className="flex gap-6 max-w-[1150px] ml-[150px] items-start pt-6 px-6 pb-3">

        {/* ── Left Groups Panel ── */}
        <div className="hidden lg:block w-[260px] flex-shrink-0">
          <div className="sticky top-8 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Grupos</h3>
              <button onClick={() => setShowCreateModal(true)}
                className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                title="Criar novo grupo">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {allLinks.map(link => (
              <div key={link.id}
                onClick={() => { if (roleplayLink?.id !== link.id) { selectLink(link) } }}
                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all group ${
                  roleplayLink?.id === link.id
                    ? 'border-green-400 shadow-sm ring-1 ring-green-100'
                    : 'border-gray-200 hover:border-green-300 hover:shadow-sm'
                }`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className={`text-sm font-semibold truncate ${roleplayLink?.id === link.id ? 'text-green-700' : 'text-gray-900'}`}>
                    {link.name || 'Sem nome'}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`w-2 h-2 rounded-full ${link.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Apagar grupo "${link.name || 'Sem nome'}"?`)) deleteGroup(link.id) }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
                      title="Apagar grupo">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    {link.link_code}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {link.usage_count}
                  </span>
                </div>
              </div>
            ))}

            {allLinks.length === 0 && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-5 text-center">
                <FolderOpen className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Nenhum grupo</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0 max-w-[1000px]">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium text-green-600 uppercase tracking-wider mb-1">Simulação Pública</p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">{roleplayLink?.name || 'Sem nome'}</h1>
          <p className="text-sm text-gray-400">Configure e acompanhe as simulações deste grupo</p>
        </div>

        {/* KPI cards row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Link card */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-green-300 hover:shadow-sm transition-all cursor-pointer group"
            onClick={copyLink}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <Link2 className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Link</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm text-gray-900 font-medium truncate">{roleplayLink.link_code}</code>
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 text-gray-300 group-hover:text-green-500 flex-shrink-0 transition-colors" />}
            </div>
            <p className="text-xs text-gray-400 mt-1">{copied ? 'Copiado!' : 'Clique para copiar'}</p>
          </div>

          {/* Usage count */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            onClick={() => { setActiveTab('historico'); if (historico.length === 0) loadHistorico() }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Simulações</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">{historico.length}</span>
            <p className="text-xs text-gray-400 mt-1">simulações realizadas</p>
          </div>

          {/* Status toggle */}
          <div className={`bg-white border rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer ${
            roleplayLink.is_active ? 'border-gray-200 hover:border-green-300' : 'border-gray-200 hover:border-gray-300'
          }`} onClick={toggleActive}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                roleplayLink.is_active ? 'bg-green-50' : 'bg-gray-100'
              }`}>
                <Power className={`w-5 h-5 ${roleplayLink.is_active ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</span>
            </div>
            <span className={`text-2xl font-bold ${roleplayLink.is_active ? 'text-green-600' : 'text-gray-400'}`}>
              {roleplayLink.is_active ? 'Ativo' : 'Inativo'}
            </span>
            <p className="text-xs text-gray-400 mt-1">Clique para {roleplayLink.is_active ? 'desativar' : 'ativar'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-100 pb-px">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'config' ? 'text-green-700' : 'text-gray-400 hover:text-gray-600'
            }`}>
            Configuração
            {activeTab === 'config' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-600 rounded-full" />}
          </button>
          <button
            onClick={() => { setActiveTab('historico'); if (historico.length === 0) loadHistorico() }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'historico' ? 'text-green-700' : 'text-gray-400 hover:text-gray-600'
            }`}>
            Simulações
            {historico.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                activeTab === 'historico' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {historico.length}
              </span>
            )}
            {activeTab === 'historico' && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-600 rounded-full" />}
          </button>
        </div>

        {/* ── Tab: Config ──────────────────────────────────── */}
        {activeTab === 'config' && (
          <div className="space-y-4" ref={dropdownRef}>
            {/* Edit toggle header */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Configuração da simulação</p>
              {editMode ? (
                <div className="flex items-center gap-2">
                  {configSaved && (
                    <button onClick={() => { setConfig(JSON.parse(JSON.stringify(originalConfig))); setEditMode(false) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                      Cancelar
                    </button>
                  )}
                  <button onClick={saveConfig} disabled={saving}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditMode(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-green-600 hover:bg-green-50 transition-colors flex items-center gap-1.5 border border-green-200">
                  <Edit2 className="w-3 h-3" />
                  Editar
                </button>
              )}
            </div>

            {/* Row: Age + Temperament */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`bg-white border rounded-xl p-5 transition-colors ${editMode ? 'border-green-200 shadow-sm' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-purple-50 rounded-md flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <label className="text-xs font-medium text-gray-500">Faixa Etária</label>
                </div>
                <div className="relative">
                  <button type="button" disabled={!editMode}
                    onClick={() => setOpenDropdown(openDropdown === 'age' ? null : 'age')}
                    className={`w-full text-left text-sm font-medium text-gray-900 rounded-lg flex items-center justify-between transition-all ${
                      editMode
                        ? 'bg-gray-50 border border-gray-200 px-3 py-2.5 cursor-pointer hover:border-purple-300 hover:bg-purple-50/30'
                        : 'px-0 py-0 cursor-default'
                    } ${openDropdown === 'age' ? 'border-purple-400 ring-2 ring-purple-100' : ''}`}>
                    <span>{{ '18-24': '18-24 anos', '25-34': '25-34 anos', '35-44': '35-44 anos', '45-60': '45-60 anos' }[config.age] || config.age}</span>
                    {editMode && <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openDropdown === 'age' ? 'rotate-180' : ''}`} />}
                  </button>
                  {openDropdown === 'age' && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      {[{ v: '18-24', l: '18-24 anos' }, { v: '25-34', l: '25-34 anos' }, { v: '35-44', l: '35-44 anos' }, { v: '45-60', l: '45-60 anos' }].map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => { setConfig({ ...config, age: opt.v }); setOpenDropdown(null) }}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between ${
                            config.age === opt.v
                              ? 'bg-purple-50 text-purple-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}>
                          <span>{opt.l}</span>
                          {config.age === opt.v && <Check className="w-3.5 h-3.5 text-purple-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={`bg-white border rounded-xl p-5 transition-colors ${editMode ? 'border-amber-200 shadow-sm' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-amber-50 rounded-md flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <label className="text-xs font-medium text-gray-500">Temperamento</label>
                </div>
                <div className="relative">
                  <button type="button" disabled={!editMode}
                    onClick={() => setOpenDropdown(openDropdown === 'temperament' ? null : 'temperament')}
                    className={`w-full text-left text-sm font-medium text-gray-900 rounded-lg flex items-center justify-between transition-all ${
                      editMode
                        ? 'bg-gray-50 border border-gray-200 px-3 py-2.5 cursor-pointer hover:border-amber-300 hover:bg-amber-50/30'
                        : 'px-0 py-0 cursor-default'
                    } ${openDropdown === 'temperament' ? 'border-amber-400 ring-2 ring-amber-100' : ''}`}>
                    <span>{config.temperament}</span>
                    {editMode && <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openDropdown === 'temperament' ? 'rotate-180' : ''}`} />}
                  </button>
                  {openDropdown === 'temperament' && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                      {['Analítico', 'Empático', 'Determinado', 'Indeciso', 'Sociável'].map(t => (
                        <button key={t} type="button"
                          onClick={() => { setConfig({ ...config, temperament: t }); setOpenDropdown(null) }}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between ${
                            config.temperament === t
                              ? 'bg-amber-50 text-amber-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}>
                          <span>{t}</span>
                          {config.temperament === t && <Check className="w-3.5 h-3.5 text-amber-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Persona */}
            <div className={`bg-white border rounded-xl p-5 transition-colors ${editMode ? 'border-blue-200 shadow-sm' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-blue-50 rounded-md flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <label className="text-xs font-medium text-gray-500">Persona</label>
              </div>
              {personas.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma persona cadastrada. Configure no ConfigHub.</p>
              ) : (
                <div className="relative">
                  <button type="button" disabled={!editMode}
                    onClick={() => setOpenDropdown(openDropdown === 'persona' ? null : 'persona')}
                    className={`w-full text-left text-sm font-medium rounded-lg flex items-center justify-between transition-all ${
                      editMode
                        ? 'bg-gray-50 border border-gray-200 px-3 py-2.5 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30'
                        : 'px-0 py-0 cursor-default'
                    } ${openDropdown === 'persona' ? 'border-blue-400 ring-2 ring-blue-100' : ''} ${config.persona_id ? 'text-gray-900' : 'text-gray-400'}`}>
                    <span className="truncate pr-2">
                      {config.persona_id
                        ? (() => {
                            const p = personas.find(p => p.id === config.persona_id)
                            return p ? (p.job_title ? `${p.job_title} - ${p.company_type} (B2B)` : p.profession ? `${p.profession} (B2C)` : 'Persona sem nome') : 'Selecione uma persona'
                          })()
                        : 'Selecione uma persona'}
                    </span>
                    {editMode && <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openDropdown === 'persona' ? 'rotate-180' : ''}`} />}
                  </button>
                  {openDropdown === 'persona' && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden max-h-52 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {personas.map(p => {
                        const label = p.job_title ? `${p.job_title} - ${p.company_type} (B2B)` : p.profession ? `${p.profession} (B2C)` : 'Persona sem nome'
                        const selected = config.persona_id === p.id
                        return (
                          <button key={p.id} type="button"
                            onClick={() => { setConfig({ ...config, persona_id: p.id }); setOpenDropdown(null) }}
                            className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                              selected
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}>
                            <span className="truncate">{label}</span>
                            {selected && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Objeções */}
            <div className={`bg-white border rounded-xl p-5 transition-colors ${editMode ? 'border-red-200 shadow-sm' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-red-50 rounded-md flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <label className="text-xs font-medium text-gray-500">Objeções</label>
                </div>
                {config.objection_ids.length > 0 && (
                  <span className="text-[11px] font-semibold text-green-600">{config.objection_ids.length} selecionada{config.objection_ids.length > 1 ? 's' : ''}</span>
                )}
              </div>
              {!editMode && (
                <p className="text-xs text-gray-400 mb-2 italic">Clique em "Editar" para modificar</p>
              )}
              <div className="space-y-1 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {objections.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma objeção cadastrada</p>
                ) : objections.map(obj => {
                  const selected = config.objection_ids.includes(obj.id)
                  return (
                    <label key={obj.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${editMode ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default opacity-60'} ${selected ? 'bg-green-50/50' : ''}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? 'bg-green-600 border-green-600' : 'border-gray-300'
                      }`}>
                        {selected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <input type="checkbox" checked={selected} disabled={!editMode} className="sr-only"
                        onChange={() => {
                          if (selected) setConfig({ ...config, objection_ids: config.objection_ids.filter(id => id !== obj.id) })
                          else setConfig({ ...config, objection_ids: [...config.objection_ids, obj.id] })
                        }} />
                      <span className={`text-sm ${selected ? 'text-gray-900' : 'text-gray-500'}`}>{obj.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Simulações ──────────────────────────────── */}
        {activeTab === 'historico' && (
          <div>
            {loadingHistorico ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
              </div>
            ) : historico.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Users className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500 mb-1">Nenhuma simulação ainda</p>
                <p className="text-xs text-gray-400">Compartilhe o link para começar</p>
              </div>
            ) : (
              <>
                {/* Controls */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-gray-400">
                    {deleteMode
                      ? <span className="text-red-500 font-medium">{selectedForDeletion.length} selecionada{selectedForDeletion.length !== 1 ? 's' : ''}</span>
                      : <>{historico.length} simulaç{historico.length > 1 ? 'ões' : 'ão'}</>
                    }
                  </p>
                  <div className="flex gap-1.5">
                    {deleteMode ? (
                      <>
                        <button onClick={selectAllForDeletion}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                          {selectedForDeletion.length === historico.length ? 'Desmarcar tudo' : 'Selecionar tudo'}
                        </button>
                        <button onClick={() => { setDeleteMode(false); setSelectedForDeletion([]) }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                          Cancelar
                        </button>
                        {selectedForDeletion.length > 0 && (
                          <button onClick={() => setShowDeleteConfirm(true)}
                            className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[11px] font-medium transition-colors flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />
                            Apagar ({selectedForDeletion.length})
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                          {(['date', 'score'] as const).map(s => (
                            <button key={s} onClick={() => { setSortBy(s); setSortOrder('desc') }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${sortBy === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                              {s === 'date' ? 'Data' : 'Nota'}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                          title={sortOrder === 'desc' ? 'Ordem crescente' : 'Ordem decrescente'}>
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={toggleCompareMode}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            compareMode ? 'bg-green-50 text-green-600' : 'hover:bg-gray-100 text-gray-400'
                          }`}>
                          <GitCompare className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={toggleDeleteMode}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {compareMode && selectedForComparison.length >= 2 && (
                          <button onClick={() => setShowComparison(true)}
                            className="px-3 py-1 rounded-lg bg-green-600 text-white text-[11px] font-medium">
                            Comparar ({selectedForComparison.length})
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* List */}
                <div className="space-y-2">
                  {getSortedHistorico().map((rp) => {
                    const ev = rp.evaluation
                    const score = ev?.overall_score
                    const level = ev?.performance_level
                    return (
                      <div key={rp.id}
                        className={`bg-white border rounded-xl px-5 py-4 transition-all cursor-pointer group ${
                          deleteMode && selectedForDeletion.includes(rp.id)
                            ? 'border-red-300 bg-red-50/30'
                            : selectedForComparison.includes(rp.id) ? 'border-green-400 bg-green-50/30' : 'border-gray-200 hover:border-green-300 hover:shadow-sm'
                        }`}
                        onClick={() => {
                          if (deleteMode) toggleSelectForDeletion(rp.id)
                          else if (compareMode) toggleSelectForComparison(rp.id)
                          else if (ev) setSelectedEvaluation(rp)
                        }}>
                        <div className="flex items-center gap-4">
                          {deleteMode && (
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              selectedForDeletion.includes(rp.id) ? 'bg-red-500 border-red-500' : 'border-gray-300'
                            }`}>
                              {selectedForDeletion.includes(rp.id) && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                          )}
                          {compareMode && !deleteMode && (
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                              selectedForComparison.includes(rp.id) ? 'bg-green-600 border-green-600' : 'border-gray-300'
                            }`}>
                              {selectedForComparison.includes(rp.id) && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                          )}
                          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{rp.participant_name}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {new Date(rp.created_at).toLocaleDateString('pt-BR')} {new Date(rp.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {score !== null && score !== undefined ? (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-lg font-bold ${scoreColor(level)}`}>{(score / 10).toFixed(1)}</span>
                              <span className="text-xs text-gray-300">/10</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                          {!compareMode && ev && (
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Modal: Evaluation Detail ─────────────────────── */}
      {selectedEvaluation && (() => {
        const ev = selectedEvaluation.evaluation
        return (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={() => setSelectedEvaluation(null)}>
            <div className="w-full max-w-lg max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedEvaluation.participant_name}</h2>
                    <p className="text-xs text-gray-400">{new Date(selectedEvaluation.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <button onClick={() => setSelectedEvaluation(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Score */}
                <div className={`rounded-xl p-4 text-center ${scoreBg(ev?.performance_level)}`}>
                  <p className={`text-3xl font-bold ${scoreColor(ev?.performance_level)}`}>
                    {ev?.overall_score ? (ev.overall_score / 10).toFixed(1) : '0.0'}
                    <span className="text-base font-normal opacity-50">/10</span>
                  </p>
                  <p className={`text-xs font-medium mt-0.5 ${scoreColor(ev?.performance_level)} opacity-70`}>{levelText(ev?.performance_level)}</p>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4" style={{ scrollbarWidth: 'thin' }}>
                {ev?.executive_summary && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Resumo</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{ev.executive_summary}</p>
                  </div>
                )}

                {ev?.spin_evaluation && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">SPIN</p>
                    <div className="grid grid-cols-4 gap-2">
                      {['S', 'P', 'I', 'N'].map(k => (
                        <div key={k} className="bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-gray-400">{k === 'S' ? 'Situação' : k === 'P' ? 'Problema' : k === 'I' ? 'Implicação' : 'Necessidade'}</p>
                          <p className="text-lg font-bold text-gray-900">{ev.spin_evaluation[k]?.final_score?.toFixed(1) || '0.0'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ev?.top_strengths?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wide mb-1.5">Pontos Fortes</p>
                    <ul className="space-y-1">
                      {ev.top_strengths.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="w-1 h-1 bg-green-500 rounded-full mt-2 flex-shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ev?.critical_gaps?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wide mb-1.5">Gaps</p>
                    <ul className="space-y-1">
                      {ev.critical_gaps.map((g: string, i: number) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="w-1 h-1 bg-red-500 rounded-full mt-2 flex-shrink-0" />{g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ev?.priority_improvements?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Melhorias</p>
                    <div className="space-y-2">
                      {ev.priority_improvements.map((imp: any, i: number) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-900 mb-0.5">{imp.area}</p>
                          <p className="text-xs text-gray-500">{imp.action_plan}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modal: Comparison ────────────────────────────── */}
      {showComparison && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => { setShowComparison(false); setSelectedForComparison([]); setCompareMode(false) }}>
          <div className="w-full max-w-4xl max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Comparação</h2>
              <button onClick={() => { setShowComparison(false); setSelectedForComparison([]); setCompareMode(false) }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
              {/* Table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-3 text-xs font-medium text-gray-400">Candidato</th>
                    <th className="text-center pb-3 text-xs font-medium text-gray-400">Nota</th>
                    <th className="text-center pb-3 text-xs font-medium text-gray-400">S</th>
                    <th className="text-center pb-3 text-xs font-medium text-gray-400">P</th>
                    <th className="text-center pb-3 text-xs font-medium text-gray-400">I</th>
                    <th className="text-center pb-3 text-xs font-medium text-gray-400">N</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedForComparison.map(id => {
                    const rp = historico.find(r => r.id === id)
                    if (!rp) return null
                    const ev = rp.evaluation, sp = ev?.spin_evaluation
                    return (
                      <tr key={id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900">{rp.participant_name}</p>
                          <p className="text-[10px] text-gray-400">{new Date(rp.created_at).toLocaleDateString('pt-BR')}</p>
                        </td>
                        <td className="text-center py-3">
                          <span className={`font-bold ${scoreColor(ev?.performance_level)}`}>
                            {ev?.overall_score ? (ev.overall_score / 10).toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="text-center py-3 text-gray-600">{sp?.S?.final_score?.toFixed(1) || '—'}</td>
                        <td className="text-center py-3 text-gray-600">{sp?.P?.final_score?.toFixed(1) || '—'}</td>
                        <td className="text-center py-3 text-gray-600">{sp?.I?.final_score?.toFixed(1) || '—'}</td>
                        <td className="text-center py-3 text-gray-600">{sp?.N?.final_score?.toFixed(1) || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                {selectedForComparison.map(id => {
                  const rp = historico.find(r => r.id === id)
                  if (!rp) return null
                  const ev = rp.evaluation
                  return (
                    <div key={id} className="border border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-900 truncate mb-2">{rp.participant_name}</p>
                      {ev?.top_strengths?.[0] && (
                        <div className="mb-2">
                          <p className="text-[10px] text-green-600 font-medium mb-0.5">Forte</p>
                          <p className="text-[10px] text-gray-500 line-clamp-2">{ev.top_strengths[0]}</p>
                        </div>
                      )}
                      {ev?.critical_gaps?.[0] && (
                        <div>
                          <p className="text-[10px] text-red-500 font-medium mb-0.5">Gap</p>
                          <p className="text-[10px] text-gray-500 line-clamp-2">{ev.critical_gaps[0]}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Delete Confirmation ─────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Apagar simulações</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Tem certeza que deseja apagar {selectedForDeletion.length} simulaç{selectedForDeletion.length > 1 ? 'ões' : 'ão'}? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={deleteSelected} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create Group ──────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Plus className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Novo Grupo</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              Cada grupo tem seu próprio link e candidatos
            </p>
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              placeholder="Ex: Turma Março 2026"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 mb-5"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && newGroupName.trim()) createGroup() }}
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowCreateModal(false); setNewGroupName('') }} disabled={creatingGroup}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={createGroup} disabled={creatingGroup || !newGroupName.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creatingGroup ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>
  )
}
