'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Link2, Copy, CheckCircle, Users, BarChart3, Settings, Power, Sparkles, Target, Edit2, X, Save, History, Loader2, ArrowUpDown, Calendar, Trophy, GitCompare, Check, AlertCircle } from 'lucide-react'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { PLAN_CONFIGS } from '@/lib/types/plans'

interface RoleplayLink {
  id: string
  company_id: string
  link_code: string
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
  // B2B fields
  job_title?: string
  company_type?: string
  // B2C fields
  profession?: string
  // Common
  business_type: string
}

interface Objection {
  id: string
  name: string
}

export default function RoleplayLinksView() {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [roleplayLink, setRoleplayLink] = useState<RoleplayLink | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hook para verificar limites do plano
  const { trainingPlan, selectionPlan, planUsage } = usePlanLimits()

  // Debug - verificar se o plano está sendo carregado
  useEffect(() => {
    console.log('🎯 Plano de treinamento:', trainingPlan)
    console.log('🎯 Plano de seleção:', selectionPlan)
    console.log('📊 Uso do plano:', planUsage)
    console.log('🔗 RoleplayLink:', roleplayLink)
    console.log('📈 Usage count:', roleplayLink?.usage_count)

    if (selectionPlan) {
      console.log('✅ Plano de seleção encontrado:', selectionPlan)
      console.log('🔍 Configuração completa:', PLAN_CONFIGS[selectionPlan])
      console.log('📌 É plano de seleção?', PLAN_CONFIGS[selectionPlan]?.isSelectionPlan)
      console.log('👥 Limite de candidatos:', PLAN_CONFIGS[selectionPlan]?.maxSelectionCandidates)

      // Verificar se a condição para mostrar o card está sendo atendida
      const shouldShowCard = selectionPlan && PLAN_CONFIGS[selectionPlan]?.isSelectionPlan
      console.log('🎨 Deve mostrar o card de limite?', shouldShowCard)
    } else {
      console.log('❌ Nenhum plano de seleção encontrado')
    }
  }, [trainingPlan, selectionPlan, planUsage, roleplayLink])

  // Ver Roleplays
  const [showHistorico, setShowHistorico] = useState(false)
  const [historico, setHistorico] = useState<any[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null)

  // Estados para ordenação
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Estados para comparação
  const [compareMode, setCompareMode] = useState(false)
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([])
  const [showComparison, setShowComparison] = useState(false)

  // Opções disponíveis
  const [personas, setPersonas] = useState<Persona[]>([])
  const [objections, setObjections] = useState<Objection[]>([])
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null)

  // Configuração
  const [config, setConfig] = useState({
    age: '25-34',
    temperament: 'Analítico',
    persona_id: null as string | null,
    objection_ids: [] as string[]
  })

  // Configuração original (para cancelar edição)
  const [originalConfig, setOriginalConfig] = useState({
    age: '25-34',
    temperament: 'Analítico',
    persona_id: null as string | null,
    objection_ids: [] as string[]
  })

  useEffect(() => {
    // Aguardar um pouco para garantir que a sessão esteja carregada
    const timer = setTimeout(() => {
      loadData()
    }, 100)

    // Listener para mudanças de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadData()
      } else if (event === 'SIGNED_OUT') {
        setError('Sessão encerrada. Por favor, faça login novamente.')
        setLoading(false)
      }
    })

    return () => {
      clearTimeout(timer)
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  // Função alternativa para carregar dados via API quando há problemas de autenticação
  const loadDataViaAPI = async (companyId: string, userId?: string) => {
    try {
      console.log('🚀 Carregando dados via API para company_id:', companyId)

      // Buscar ou criar link via API
      const linkResponse = await fetch('/api/roleplay-links/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, userId: userId || null })
      })

      if (!linkResponse.ok) {
        throw new Error('Erro ao buscar/criar link')
      }

      const linkResult = await linkResponse.json()
      const linkData = linkResult.data

      console.log('✅ Link carregado via API:', linkData)
      console.log('🔍 Status is_active:', linkData.is_active)
      setRoleplayLink(linkData)

      // Carregar configuração
      const loadedConfig = linkData.config || {
        age: '25-34',
        temperament: 'Analítico',
        persona_id: null,
        objection_ids: []
      }

      // Garantir compatibilidade
      if (loadedConfig.age_range && !loadedConfig.age) {
        loadedConfig.age = loadedConfig.age_range
        delete loadedConfig.age_range
      }

      setConfig(loadedConfig)
      setOriginalConfig(JSON.parse(JSON.stringify(loadedConfig)))

      // Verificar se já tem configuração salva
      if (loadedConfig.persona_id && loadedConfig.objection_ids?.length > 0) {
        setConfigSaved(true)
        setEditMode(false)
      } else {
        setConfigSaved(false)
        setEditMode(true)
      }

      // Buscar dados da empresa usando service role
      try {
        // Buscar empresa
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single()

        if (companyData) {
          setCompany(companyData)
        }

        // Buscar personas
        const { data: personasData } = await supabase
          .from('personas')
          .select('id, job_title, company_type, profession, business_type')
          .eq('company_id', companyId)
          .order('created_at')

        if (personasData) {
          setPersonas(personasData)
        }

        // Buscar objeções
        const { data: objectionsData } = await supabase
          .from('objections')
          .select('id, name')
          .eq('company_id', companyId)
          .order('name')

        if (objectionsData) {
          setObjections(objectionsData)
        }
      } catch (error) {
        console.error('⚠️ Erro ao buscar dados complementares:', error)
        // Não é crítico, continuar sem esses dados
      }

      setLoading(false)
    } catch (error) {
      console.error('❌ Erro ao carregar dados via API:', error)
      setError('Erro ao carregar configuração. Por favor, recarregue a página.')
      setLoading(false)
    }
  }

  const loadData = async () => {
    try {
      setError(null)

      // Verificar se estamos no contexto correto (não em página pública)
      if (typeof window !== 'undefined' && window.location.pathname.includes('roleplay-publico')) {
        console.log('RoleplayLinksView: Pulando carregamento em página pública')
        setLoading(false)
        return
      }

      // Buscar a sessão atual de forma mais confiável
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      console.log('🔍 Sessão atual:', session ? 'Encontrada' : 'Não encontrada')
      console.log('🔍 Erro de sessão:', sessionError)

      let user = session?.user

      // Se não encontrou sessão, NÃO tentar buscar usuário diretamente pois vai dar erro
      if (!user) {
        console.log('🔍 Sessão não encontrada, tentando alternativas...')

        // Tentar buscar dados diretamente do localStorage do Supabase
        const storageKey = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').split('.')[0]}-auth-token`
        const storedSession = localStorage.getItem(storageKey)

        if (storedSession) {
          try {
            const parsed = JSON.parse(storedSession)
            if (parsed?.user) {
              console.log('✅ Usuário encontrado no localStorage')
              user = parsed.user
            }
          } catch (e) {
            console.error('❌ Erro ao parsear sessão do localStorage:', e)
          }
        }

        // Se ainda não tem usuário, tentar usar um ID fixo temporário para testes
        if (!user) {
          console.log('⚠️ Usando fallback para buscar dados sem autenticação completa')

          // Buscar a primeira empresa disponível
          console.log('🔍 Buscando primeira empresa disponível...')

          const { data: companies } = await supabase
            .from('companies')
            .select('id, name')
            .limit(1)
            .single()

          if (companies) {
            console.log('✅ Empresa encontrada:', companies.name)

            // Usar a empresa encontrada para continuar
            await loadDataViaAPI(companies.id)
            return
          }
        }
      }

      if (!user) {
        console.error('❌ Nenhum usuário autenticado encontrado')
        setError('Usuário não autenticado. Por favor, faça login novamente.')
        setLoading(false)
        return
      }

      console.log('✅ Usuário autenticado:', user.email)

      // Buscar o company_id do usuário
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

      if (employeeError || !employeeData?.company_id) {
        console.error('Company ID não encontrado para o usuário:', employeeError)

        // Tentar buscar via API com service role
        console.log('🔍 Tentando buscar company_id via API...')
        try {
          const response = await fetch('/api/user/company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
          })

          if (response.ok) {
            const { companyId: apiCompanyId } = await response.json()
            if (apiCompanyId) {
              console.log('✅ Company ID encontrado via API:', apiCompanyId)
              setCurrentCompanyId(apiCompanyId)

              // Continuar com o fluxo usando a API
              await loadDataViaAPI(apiCompanyId, user.id)
              return
            }
          }
        } catch (apiError) {
          console.error('❌ Erro ao buscar via API:', apiError)
        }

        setLoading(false)
        return
      }

      const companyId = employeeData.company_id
      console.log('Company ID encontrado:', companyId)
      setCurrentCompanyId(companyId)

      // Buscar dados da empresa
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single()

      if (companyData) {
        setCompany(companyData)
      }

      // Buscar personas da empresa
      const { data: personasData } = await supabase
        .from('personas')
        .select('id, job_title, company_type, profession, business_type')
        .eq('company_id', companyId)
        .order('created_at')

      if (personasData) {
        setPersonas(personasData)
      }

      // Buscar objeções da empresa
      const { data: objectionsData } = await supabase
        .from('objections')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name')

      if (objectionsData) {
        setObjections(objectionsData)
      }

      // Buscar ou criar link de roleplay
      const { data: linkData, error: linkError } = await supabase
        .rpc('get_or_create_roleplay_config', {
          p_company_id: companyId
        })

      if (linkData) {
        console.log('Link data carregado:', linkData)
        console.log('🔍 Status is_active do RPC:', linkData.is_active)
        setRoleplayLink(linkData)

        // Garantir que a configuração seja aplicada corretamente
        const loadedConfig = linkData.config || {
          age: '25-34',
          temperament: 'Analítico',
          persona_id: null,
          objection_ids: []
        }

        // Garantir compatibilidade: converter age_range para age se existir
        if (loadedConfig.age_range && !loadedConfig.age) {
          loadedConfig.age = loadedConfig.age_range
          delete loadedConfig.age_range
        }

        console.log('Config carregada:', loadedConfig)
        setConfig(loadedConfig)
        setOriginalConfig(JSON.parse(JSON.stringify(loadedConfig))) // Clone profundo

        // Verificar se já tem configuração salva
        if (loadedConfig.persona_id && loadedConfig.objection_ids?.length > 0) {
          console.log('Configuração já existe, iniciando em modo visualização')
          setConfigSaved(true)
          setEditMode(false) // Iniciar em modo visualização se já tem config
        } else {
          console.log('Configuração vazia, iniciando em modo edição')
          setConfigSaved(false)
          setEditMode(true) // Iniciar em modo edição se não tem config
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error)
      setError(error?.message || 'Erro ao carregar configuração do roleplay')
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async () => {
    if (!roleplayLink) return

    // Verificar se pode ativar baseado no limite do plano
    if (!roleplayLink.is_active && selectionPlan) {
      const planConfig = PLAN_CONFIGS[selectionPlan]
      if (planConfig?.maxSelectionCandidates !== null) {
        const used = roleplayLink.usage_count || 0
        const limit = planConfig.maxSelectionCandidates

        if (used >= limit) {
          alert(`Não é possível ativar o link. O limite de ${limit} candidatos já foi atingido.`)
          return
        }
      }
    }

    setSaving(true)
    try {
      const newStatus = !roleplayLink.is_active

      console.log('🔄 Atualizando status do link:', {
        id: roleplayLink.id,
        currentStatus: roleplayLink.is_active,
        newStatus: newStatus
      })

      // Usar API com service role para bypass RLS
      const response = await fetch('/api/roleplay-links/toggle-active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          linkId: roleplayLink.id,
          isActive: newStatus
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('❌ Erro ao atualizar status:', result)
        alert('Erro ao atualizar status do link. Tente novamente.')
        return
      }

      if (result.data) {
        console.log('✅ Status atualizado com sucesso:', result.data)
        setRoleplayLink(result.data)

        // Forçar reload dos dados para garantir consistência
        await loadData()
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error)
      alert('Erro ao atualizar status do link. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const saveConfig = async () => {
    console.log('🔵 saveConfig chamado')
    console.log('🔵 roleplayLink:', roleplayLink)
    console.log('🔵 config atual:', config)

    if (!roleplayLink) {
      console.error('❌ roleplayLink é null!')
      return
    }

    // Validar configuração
    if (!config.persona_id) {
      alert('Por favor, selecione uma persona')
      return
    }

    if (config.objection_ids.length === 0) {
      alert('Por favor, selecione pelo menos uma objeção')
      return
    }

    setSaving(true)
    try {
      // Normalizar config para garantir tipos corretos
      const normalizedConfig = {
        age: config.age || '25-34',
        temperament: config.temperament || 'Analítico',
        persona_id: config.persona_id || null,
        objection_ids: Array.isArray(config.objection_ids) ? config.objection_ids : []
      }

      console.log('🔵 Chamando API para salvar config...')
      console.log('🔵 roleplayLink.id:', roleplayLink.id)
      console.log('🔵 config normalizado a salvar:', JSON.stringify(normalizedConfig, null, 2))

      // Usar API route com service role para bypass RLS
      const response = await fetch('/api/roleplay-links/update-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: roleplayLink.id,
          config: normalizedConfig
        })
      })

      const result = await response.json()

      console.log('🔵 Resposta da API:')
      console.log('  - result:', result)

      if (!response.ok || !result.success) {
        console.error('❌ Erro ao salvar:', result.error)
        alert(`Erro ao salvar: ${result.error}`)
        return
      }

      console.log('✅ Configuração salva com sucesso:', normalizedConfig)
      setRoleplayLink({
        ...roleplayLink,
        config: normalizedConfig
      })
      setConfig(normalizedConfig) // Atualizar estado com config normalizado
      setOriginalConfig(JSON.parse(JSON.stringify(normalizedConfig))) // Clone profundo
      setConfigSaved(true)
      setEditMode(false) // Sair do modo de edição
      alert(configSaved ? 'Configuração atualizada com sucesso!' : 'Configuração salva com sucesso!')

    } catch (error) {
      console.error('❌ Erro ao salvar configuração:', error)
      alert('Erro ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = () => {
    setEditMode(true)
  }

  const handleCancel = () => {
    console.log('Cancelando edição, restaurando config original:', originalConfig)
    setConfig(JSON.parse(JSON.stringify(originalConfig))) // Clone profundo para garantir que restaura
    setEditMode(false)
  }

  const copyLink = async () => {
    if (!company || !roleplayLink?.link_code) return

    // Gerar link completo (dev ou prod)
    let link = ''
    if (window.location.hostname.includes('localhost') || window.location.hostname.includes('ramppy.local')) {
      link = `http://localhost:3000/roleplay-publico?link=${roleplayLink.link_code}`
    } else {
      link = `https://ramppy.site/roleplay-publico?link=${roleplayLink.link_code}`
    }

    // Tentar copiar com clipboard API (só funciona em HTTPS ou localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch (err) {
        console.warn('Clipboard API falhou, usando fallback:', err)
      }
    }

    // Fallback: criar input temporário e copiar
    const textArea = document.createElement('textarea')
    textArea.value = link
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      document.execCommand('copy')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
      // Último fallback: mostrar o link em um prompt
      alert(`Copie o link abaixo:\n\n${link}`)
    }

    textArea.remove()
  }

  const loadHistorico = async () => {
    if (!roleplayLink?.id) {
      console.error('Link ID não disponível')
      return
    }

    setLoadingHistorico(true)
    try {
      const response = await fetch(`/api/public/roleplay/history?linkId=${roleplayLink.id}`)
      if (!response.ok) {
        throw new Error('Erro ao carregar histórico')
      }

      const data = await response.json()
      console.log('📊 Histórico carregado:', data)
      setHistorico(data.roleplays || [])
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error)
      alert('Erro ao carregar histórico')
    } finally {
      setLoadingHistorico(false)
    }
  }

  const getRoleplayUrl = () => {
    if (!roleplayLink?.link_code) return ''

    // Sistema unificado - não usa mais subdomínios
    // Em desenvolvimento
    if (window.location.hostname.includes('localhost') || window.location.hostname.includes('ramppy.local')) {
      return `http://localhost:3000/roleplay-publico?link=${roleplayLink.link_code}`
    }

    // Em produção
    return `https://ramppy.site/roleplay-publico?link=${roleplayLink.link_code}`
  }

  // Função para ordenar o histórico
  const getSortedHistorico = () => {
    if (!historico || historico.length === 0) return []

    const sorted = [...historico].sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB
      } else {
        // Ordenar por nota
        const scoreA = a.evaluation?.overall_score || 0
        const scoreB = b.evaluation?.overall_score || 0
        return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB
      }
    })

    return sorted
  }

  // Funções de comparação
  const toggleCompareMode = () => {
    setCompareMode(!compareMode)
    setSelectedForComparison([])
    setShowComparison(false)
  }

  const toggleSelectForComparison = (roleplayId: string) => {
    if (selectedForComparison.includes(roleplayId)) {
      setSelectedForComparison(selectedForComparison.filter(id => id !== roleplayId))
    } else {
      if (selectedForComparison.length < 4) { // Limitar a 4 comparações
        setSelectedForComparison([...selectedForComparison, roleplayId])
      } else {
        alert('Você pode comparar no máximo 4 roleplays por vez')
      }
    }
  }

  const startComparison = () => {
    if (selectedForComparison.length < 2) {
      alert('Selecione pelo menos 2 roleplays para comparar')
      return
    }
    setShowComparison(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 max-w-md">
          <h3 className="text-red-400 font-bold mb-2">Erro ao carregar</h3>
          <p className="text-red-300 mb-4">{error}</p>

          {error.includes('autenticado') || error.includes('Sessão') ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  // Redirecionar para a página de login
                  window.location.href = '/'
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
              >
                Ir para Login
              </button>
              <button
                onClick={() => {
                  setError(null)
                  setLoading(true)
                  loadData()
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setError(null)
                setLoading(true)
                loadData()
              }}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!roleplayLink) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6 max-w-md">
          <p className="text-yellow-300">Configuração de roleplay não encontrada</p>
          <button
            onClick={() => {
              setLoading(true)
              loadData()
            }}
            className="mt-4 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white transition-colors"
          >
            Recarregar
          </button>
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

      <div className="relative z-10 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Cabeçalho */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Configure o <span className="text-gradient-green">Roleplay Público</span>
            </h1>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Defina o cenário de treinamento que sua equipe irá praticar através do link público
            </p>
          </div>

          {/* Card do Link */}
          <div className="bg-black/40 backdrop-blur-xl rounded-3xl p-8 border border-green-500/20 mb-8 glow-green-subtle">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-r from-green-600/20 to-lime-500/20 rounded-2xl flex items-center justify-center">
                  <Link2 className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                    Link de Treinamento
                    {roleplayLink.is_active && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                        ATIVO
                      </span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Compartilhe este link com sua equipe para treinamento
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowHistorico(!showHistorico)
                    if (!showHistorico && historico.length === 0) {
                      loadHistorico()
                    }
                  }}
                  className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                    showHistorico
                      ? 'bg-gradient-to-r from-green-600 to-lime-500 text-white hover:scale-105 shadow-lg shadow-green-500/30'
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white border border-gray-700'
                  }`}
                >
                  <History className="w-5 h-5" />
                  {showHistorico ? 'Ver Configuração' : 'Ver Roleplays'}
                </button>
                <button
                  onClick={toggleActive}
                  disabled={!!(saving || (
                    !roleplayLink.is_active &&
                    selectionPlan &&
                    PLAN_CONFIGS[selectionPlan]?.maxSelectionCandidates !== null &&
                    roleplayLink.usage_count >= PLAN_CONFIGS[selectionPlan].maxSelectionCandidates
                  ))}
                  className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                    roleplayLink.is_active
                      ? 'bg-gradient-to-r from-green-600 to-lime-500 text-white hover:scale-105 glow-green'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={
                    !roleplayLink.is_active &&
                    selectionPlan &&
                    PLAN_CONFIGS[selectionPlan]?.maxSelectionCandidates !== null &&
                    roleplayLink.usage_count >= PLAN_CONFIGS[selectionPlan].maxSelectionCandidates
                      ? 'Limite de candidatos atingido'
                      : ''
                  }
                >
                  <Power className="w-5 h-5" />
                  {roleplayLink.is_active ? 'Ativo' : 'Desativado'}
                </button>
              </div>
            </div>

            {/* URL */}
            <div className="bg-black/60 border border-green-500/10 rounded-2xl p-5 mb-6">
              <p className="text-sm font-medium text-green-400 mb-3">URL do Roleplay:</p>
              <div className="flex items-center gap-3">
                <code className="flex-1 text-white bg-black/40 px-4 py-3 rounded-xl text-sm font-mono border border-green-500/20">
                  {getRoleplayUrl()}
                </code>
                <button
                  onClick={copyLink}
                  className="p-3 bg-gradient-to-r from-green-600/20 to-lime-500/20 hover:from-green-600/30 hover:to-lime-500/30 rounded-xl transition-all hover:scale-105"
                >
                  {copied ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-green-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-green-600/10 to-lime-500/10 rounded-2xl p-5 border border-green-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-green-400" />
                  <p className="text-sm font-medium text-gray-300">Total de Usos</p>
                </div>
                <p className="text-3xl font-bold text-white">
                  {roleplayLink.usage_count}
                </p>
              </div>

              {/* Card de Limites do Plano */}
              {selectionPlan && (
                (() => {
                  console.log('🎯 Renderizando card de limite para plano:', selectionPlan)
                  const planConfig = PLAN_CONFIGS[selectionPlan]

                  if (!planConfig) {
                    console.error('❌ Configuração não encontrada para:', selectionPlan)
                    return null
                  }

                  if (!planConfig.isSelectionPlan) {
                    console.log('⚠️ Não é plano de seleção:', selectionPlan)
                    return null
                  }

                  const maxCandidates = planConfig.maxSelectionCandidates
                  const used = roleplayLink.usage_count || 0

                  return (
                    <div className="bg-gradient-to-r from-yellow-600/10 to-orange-500/10 rounded-2xl p-5 border border-yellow-500/20">
                      <div className="flex items-center gap-3 mb-2">
                        <Target className="w-5 h-5 text-yellow-400" />
                        <p className="text-sm font-medium text-gray-300">Limite do Plano</p>
                      </div>
                      {maxCandidates === null ? (
                        <div>
                          <p className="text-2xl font-bold text-white">Ilimitado</p>
                          <p className="text-xs text-gray-400 mt-1">{used} realizados</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {used}/{maxCandidates}
                          </p>
                          <div className="mt-2">
                            <div className="w-full bg-black/40 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  (used / maxCandidates) * 100 >= 100 ? 'bg-red-500' :
                                  (used / maxCandidates) * 100 >= 80 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${Math.min((used / maxCandidates) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                          <p className={`text-xs mt-1 ${
                            Math.max(0, maxCandidates - used) === 0 ? 'text-red-400' :
                            Math.max(0, maxCandidates - used) <= 2 ? 'text-yellow-400' :
                            'text-gray-400'
                          }`}>
                            {Math.max(0, maxCandidates - used) === 0
                              ? '⚠️ Limite atingido'
                              : `${Math.max(0, maxCandidates - used)} ${Math.max(0, maxCandidates - used) === 1 ? 'restante' : 'restantes'}`
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()
              )}

              <div className="bg-gradient-to-r from-green-600/10 to-lime-500/10 rounded-2xl p-5 border border-green-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  <p className="text-sm font-medium text-gray-300">Status</p>
                </div>
                <p className="text-3xl font-bold text-white">
                  {roleplayLink.is_active ? 'Ativo' : 'Inativo'}
                </p>
              </div>
            </div>

            {/* Aviso de limite atingido */}
            {selectionPlan && PLAN_CONFIGS[selectionPlan]?.isSelectionPlan &&
             PLAN_CONFIGS[selectionPlan].maxSelectionCandidates !== null &&
             roleplayLink.usage_count >= PLAN_CONFIGS[selectionPlan].maxSelectionCandidates && (
              <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-red-400 font-semibold mb-1">Limite de Candidatos Atingido</h4>
                  <p className="text-red-300/80 text-sm">
                    Você atingiu o limite de {PLAN_CONFIGS[selectionPlan].maxSelectionCandidates} candidatos do seu plano.
                    Para avaliar mais candidatos, considere fazer upgrade do plano.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Conteúdo Condicional */}
          {!showHistorico ? (
            /* Configuração do Roleplay */
            <div className="bg-black/40 backdrop-blur-xl rounded-3xl p-8 border border-green-500/20">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-600/20 to-lime-500/20 rounded-xl flex items-center justify-center">
                  <Settings className="w-5 h-5 text-green-400" />
                </div>
                <h2 className="text-2xl font-semibold text-white">
                  Configuração do Cenário
                </h2>
              </div>
              {editMode && (
                <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl">
                  <p className="text-sm text-yellow-300 flex items-center gap-2">
                    <Edit2 className="w-4 h-4" />
                    Modo de Edição
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Faixa Etária */}
              <div>
                <label className="block text-sm font-medium text-green-400 mb-3">
                  Faixa Etária do Cliente
                </label>
                <select
                  value={config.age}
                  onChange={(e) => setConfig({ ...config, age: e.target.value })}
                  disabled={!editMode}
                  className={`w-full px-5 py-4 border border-green-500/20 rounded-xl text-white transition-colors ${
                    editMode
                      ? 'bg-black/60 focus:outline-none focus:border-green-500/40 cursor-pointer'
                      : 'bg-black/30 cursor-not-allowed opacity-70'
                  }`}
                >
                  <option value="18-24">18-24 anos</option>
                  <option value="25-34">25-34 anos</option>
                  <option value="35-44">35-44 anos</option>
                  <option value="45-60">45-60 anos</option>
                </select>
              </div>

              {/* Temperamento */}
              <div>
                <label className="block text-sm font-medium text-green-400 mb-3">
                  Temperamento do Cliente
                </label>
                <select
                  value={config.temperament}
                  onChange={(e) => setConfig({ ...config, temperament: e.target.value })}
                  disabled={!editMode}
                  className={`w-full px-5 py-4 border border-green-500/20 rounded-xl text-white transition-colors ${
                    editMode
                      ? 'bg-black/60 focus:outline-none focus:border-green-500/40 cursor-pointer'
                      : 'bg-black/30 cursor-not-allowed opacity-70'
                  }`}
                >
                  <option value="Analítico">Analítico</option>
                  <option value="Empático">Empático</option>
                  <option value="Determinado">Determinado</option>
                  <option value="Indeciso">Indeciso</option>
                  <option value="Sociável">Sociável</option>
                </select>
              </div>

              {/* Persona */}
              <div>
                <label className="block text-sm font-medium text-green-400 mb-3">
                  Persona do Cliente
                </label>
                {personas.length === 0 ? (
                  <div className="p-6 bg-yellow-900/20 border border-yellow-500/30 rounded-2xl">
                    <p className="text-yellow-300 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Nenhuma persona cadastrada. Configure personas no ConfigHub primeiro.
                    </p>
                  </div>
                ) : (
                  <select
                    value={config.persona_id || ''}
                    onChange={(e) => setConfig({ ...config, persona_id: e.target.value || null })}
                    disabled={!editMode}
                    className={`w-full px-5 py-4 border border-green-500/20 rounded-xl text-white transition-colors ${
                      editMode
                        ? 'bg-black/60 focus:outline-none focus:border-green-500/40 cursor-pointer'
                        : 'bg-black/30 cursor-not-allowed opacity-70'
                    }`}
                  >
                    <option value="">Selecione uma persona</option>
                    {personas.map(persona => {
                      const label = persona.job_title
                        ? `${persona.job_title} - ${persona.company_type} (B2B)`
                        : persona.profession
                        ? `${persona.profession} (B2C)`
                        : 'Persona sem nome'
                      return (
                        <option key={persona.id} value={persona.id}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                )}
              </div>

              {/* Objeções */}
              <div>
                <label className="block text-sm font-medium text-green-400 mb-3">
                  Objeções do Cliente
                  {config.objection_ids.length > 0 && (
                    <span className="ml-2 px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                      {config.objection_ids.length} selecionada{config.objection_ids.length > 1 ? 's' : ''}
                    </span>
                  )}
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto bg-black/40 rounded-2xl p-5 border border-green-500/10">
                  {objections.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhuma objeção cadastrada</p>
                  ) : (
                    objections.map(objection => {
                      const isSelected = config.objection_ids.includes(objection.id)
                      const isSaved = configSaved && originalConfig.objection_ids.includes(objection.id)

                      return (
                        <label
                          key={objection.id}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all group relative ${
                            editMode ? 'hover:bg-green-500/5 cursor-pointer' : 'cursor-not-allowed opacity-70'
                          } ${
                            isSaved && isSelected
                              ? 'border-2 border-green-500/60 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                              : 'border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!editMode}
                            onChange={() => {
                              if (isSelected) {
                                setConfig({
                                  ...config,
                                  objection_ids: config.objection_ids.filter(id => id !== objection.id)
                                })
                              } else {
                                setConfig({
                                  ...config,
                                  objection_ids: [...config.objection_ids, objection.id]
                                })
                              }
                            }}
                            className="w-5 h-5 text-green-600 bg-black border-green-500/30 rounded focus:ring-green-500 focus:ring-2"
                          />
                          <span className={`group-hover:text-white transition-colors flex items-center gap-2 ${
                            isSaved && isSelected ? 'text-green-300 font-medium' : 'text-gray-300'
                          }`}>
                            {objection.name}
                            {isSelected && (
                              <CheckCircle className={`w-4 h-4 ${isSaved ? 'text-green-400' : 'text-green-400'}`} />
                            )}
                          </span>
                          {isSaved && isSelected && (
                            <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full">
                              SALVA
                            </span>
                          )}
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Preview da Configuração */}
              {config.persona_id && config.objection_ids.length > 0 && (
                <div className="bg-gradient-to-r from-green-600/10 to-lime-500/10 border border-green-500/30 rounded-2xl p-6">
                  <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Cenário Configurado
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    Os participantes farão roleplay com um cliente de <span className="text-white font-medium">{config.age} anos</span>,
                    com temperamento <span className="text-white font-medium">{config.temperament.toLowerCase()}</span>,
                    representando <span className="text-white font-medium">{(() => {
                      const persona = personas.find(p => p.id === config.persona_id)
                      return persona?.job_title || persona?.profession || 'perfil selecionado'
                    })()}</span>,
                    com <span className="text-white font-medium">{config.objection_ids.length} objeção(ões)</span> preparada(s).
                  </p>
                </div>
              )}

              {/* Botões de Ação */}
              {editMode ? (
                // Modo edição - mostrar Salvar e Cancelar
                <div className="flex gap-4">
                  <button
                    onClick={saveConfig}
                    disabled={saving}
                    className="flex-1 py-4 bg-gradient-to-r from-green-600 to-lime-500 rounded-2xl font-semibold text-white hover:scale-[1.02] transition-all disabled:opacity-50 glow-green flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        {configSaved ? 'Atualizando...' : 'Salvando...'}
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        {configSaved ? 'Salvar Alterações' : 'Salvar Configuração'}
                      </>
                    )}
                  </button>
                  {configSaved && (
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-6 py-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-2xl font-semibold text-gray-300 transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      Cancelar
                    </button>
                  )}
                </div>
              ) : (
                // Modo visualização - mostrar botão Editar
                <button
                  onClick={handleEdit}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl font-semibold text-white hover:scale-[1.02] transition-all glow-blue flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-5 h-5" />
                  Editar Configuração
                </button>
              )}
            </div>
          </div>
          ) : (
            /* Histórico de Roleplays */
            <div className="bg-black/40 backdrop-blur-xl rounded-3xl p-8 border border-green-500/20">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-gradient-to-r from-green-600/20 to-lime-500/20 rounded-xl flex items-center justify-center">
                  <History className="w-5 h-5 text-green-400" />
                </div>
                <h2 className="text-2xl font-semibold text-white">
                  Roleplays Realizados
                </h2>
              </div>

              {loadingHistorico ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
                </div>
              ) : historico.length === 0 ? (
                <div className="text-center py-20">
                  <History className="w-20 h-20 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400 text-xl font-medium">Nenhum roleplay realizado ainda</p>
                  <p className="text-gray-500 mt-2">Compartilhe o link para começar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Controles de ordenação e estatísticas */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <p className="text-gray-400">
                        {historico.length} roleplay{historico.length !== 1 ? 's' : ''} realizad{historico.length !== 1 ? 'os' : 'o'}
                      </p>
                      {selectedForComparison.length > 0 && compareMode && (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full border border-green-500/30">
                          {selectedForComparison.length} selecionado{selectedForComparison.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Controles de Ordenação e Comparação */}
                    <div className="flex flex-wrap gap-2">
                      {/* Botões de tipo de ordenação */}
                      <div className="flex bg-black/60 rounded-xl p-1 border border-green-500/20">
                        <button
                          onClick={() => setSortBy('date')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            sortBy === 'date'
                              ? 'bg-green-600/30 text-green-400 border border-green-500/30'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                          }`}
                        >
                          <Calendar className="w-4 h-4" />
                          Data
                        </button>
                        <button
                          onClick={() => setSortBy('score')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                            sortBy === 'score'
                              ? 'bg-green-600/30 text-green-400 border border-green-500/30'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                          }`}
                        >
                          <Trophy className="w-4 h-4" />
                          Nota
                        </button>
                      </div>

                      {/* Botão de direção de ordenação */}
                      <button
                        onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                        className="px-4 py-2 bg-black/60 hover:bg-gray-800/50 rounded-xl text-sm font-medium text-gray-400 hover:text-white transition-all flex items-center gap-2 border border-green-500/20"
                        title={sortOrder === 'desc' ? 'Ordem decrescente' : 'Ordem crescente'}
                      >
                        <ArrowUpDown className="w-4 h-4" />
                        {sortBy === 'date' ? (
                          sortOrder === 'desc' ? 'Mais recente' : 'Mais antigo'
                        ) : (
                          sortOrder === 'desc' ? 'Maior nota' : 'Menor nota'
                        )}
                      </button>

                      {/* Botão de Comparação */}
                      <button
                        onClick={toggleCompareMode}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 border ${
                          compareMode
                            ? 'bg-green-600/30 text-green-400 border-green-500/30'
                            : 'bg-black/60 hover:bg-gray-800/50 text-gray-400 hover:text-white border-green-500/20'
                        }`}
                      >
                        <GitCompare className="w-4 h-4" />
                        {compareMode ? 'Cancelar Comparação' : 'Comparar'}
                      </button>

                      {/* Botão de Iniciar Comparação */}
                      {compareMode && selectedForComparison.length >= 2 && (
                        <button
                          onClick={startComparison}
                          className="px-4 py-2 bg-gradient-to-r from-green-600 to-lime-500 rounded-xl text-sm font-medium text-white hover:scale-105 transition-all flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Comparar {selectedForComparison.length} Selecionados
                        </button>
                      )}
                    </div>
                  </div>

                  {getSortedHistorico().map((roleplay) => {
                    const createdAt = new Date(roleplay.created_at)
                    const formattedDate = createdAt.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })
                    const formattedTime = createdAt.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })

                    const evaluation = roleplay.evaluation
                    const overallScore = evaluation?.overall_score
                    const performanceLevel = evaluation?.performance_level

                    // Mapear performance_level para cor
                    const getScoreColor = (level: string) => {
                      switch (level) {
                        case 'legendary': return 'text-purple-400'
                        case 'excellent': return 'text-green-400'
                        case 'very_good': return 'text-blue-400'
                        case 'good': return 'text-yellow-400'
                        case 'needs_improvement': return 'text-orange-400'
                        case 'poor': return 'text-red-400'
                        default: return 'text-gray-400'
                      }
                    }

                    // Mapear performance_level para texto em português
                    const getPerformanceLevelText = (level: string) => {
                      switch (level) {
                        case 'legendary': return 'Lendário'
                        case 'excellent': return 'Excelente'
                        case 'very_good': return 'Muito Bom'
                        case 'good': return 'Bom'
                        case 'needs_improvement': return 'Precisa Melhorar'
                        case 'poor': return 'Fraco'
                        default: return 'N/A'
                      }
                    }

                    return (
                      <div
                        key={roleplay.id}
                        className={`bg-black/60 border rounded-2xl p-6 transition-all relative ${
                          selectedForComparison.includes(roleplay.id)
                            ? 'border-green-500/50 bg-green-500/5'
                            : 'border-green-500/10 hover:border-green-500/30'
                        }`}
                      >
                        {/* Checkbox de seleção */}
                        {compareMode && (
                          <div className="absolute top-4 left-4">
                            <button
                              onClick={() => toggleSelectForComparison(roleplay.id)}
                              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                                selectedForComparison.includes(roleplay.id)
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-green-500/30 hover:border-green-500/50'
                              }`}
                            >
                              {selectedForComparison.includes(roleplay.id) && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </button>
                          </div>
                        )}

                        <div className={`flex items-start justify-between ${compareMode ? 'pl-10' : ''}`}>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-3">
                              {roleplay.participant_name}
                            </h3>
                            <div className="space-y-2 text-sm text-gray-400">
                              <p>
                                <span className="text-gray-500">Data:</span> {formattedDate} às {formattedTime}
                              </p>
                              {roleplay.config && (
                                <>
                                  <p>
                                    <span className="text-gray-500">Cliente:</span>{' '}
                                    {roleplay.config.age} anos, {roleplay.config.temperament}
                                  </p>
                                  {roleplay.config.persona && (
                                    <p>
                                      <span className="text-gray-500">Cargo:</span>{' '}
                                      {roleplay.config.persona.cargo || roleplay.config.persona.job_title || 'N/A'}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="ml-6 text-right">
                            {overallScore !== null && overallScore !== undefined ? (
                              <div className={`text-4xl font-bold ${getScoreColor(performanceLevel)}`}>
                                {(overallScore / 10).toFixed(1)}/10
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                Sem avaliação
                              </div>
                            )}
                          </div>
                        </div>

                        {evaluation && (
                          <button
                            onClick={() => setSelectedEvaluation(roleplay)}
                            className="mt-4 w-full py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 hover:border-green-500/50 rounded-xl text-green-400 font-semibold transition-all"
                          >
                            Ver Avaliação Completa
                          </button>
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

      {/* Modal de Avaliação Detalhada */}
      {selectedEvaluation && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[80vh] flex flex-col bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-3xl border border-green-500/30">
            {/* Header - sem position sticky ou relative */}
            <div className="rounded-t-3xl border-b border-green-500/30 p-4 bg-gradient-to-br from-gray-900 to-gray-800">
              {/* Botão simples sem containers extras */}
              <div className="text-right mb-4 mt-6">
                <button
                  onClick={() => setSelectedEvaluation(null)}
                  className="inline-block px-6 py-2 rounded-lg text-xs font-bold text-white shadow-lg"
                  style={{
                    background: 'linear-gradient(to right, #22c55e, #a3e635)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(to right, #16a34a, #84cc16)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(to right, #22c55e, #a3e635)'
                  }}
                >
                  FECHAR
                </button>
              </div>

              <h2 className="text-xl font-bold text-center text-white mb-2">🎯 AVALIAÇÃO DETALHADA</h2>
              <p className="text-center text-gray-400 text-sm mb-3">
                {selectedEvaluation.participant_name} - {new Date(selectedEvaluation.created_at).toLocaleString('pt-BR')}
              </p>

              {/* Score Geral */}
              <div className="bg-gray-800/40 rounded-xl p-3 border border-green-500/20">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-400">
                    {selectedEvaluation.evaluation?.overall_score ? (selectedEvaluation.evaluation.overall_score / 10).toFixed(1) : '0.0'}/10
                  </div>
                </div>
              </div>
            </div>

            {/* Content - scrollable area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Resumo Executivo */}
              {selectedEvaluation.evaluation?.executive_summary && (
                <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20">
                  <h3 className="text-base font-bold text-green-400 mb-2">📋 Resumo Executivo</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{selectedEvaluation.evaluation.executive_summary}</p>
                </div>
              )}

              {/* SPIN Scores */}
              {selectedEvaluation.evaluation?.spin_evaluation && (
                <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20">
                  <h3 className="text-base font-bold text-green-400 mb-3">📊 Métricas SPIN</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {['S', 'P', 'I', 'N'].map((key) => (
                      <div key={key} className="text-center bg-gray-900/50 rounded-lg p-3 border border-green-500/10">
                        <div className="text-xs text-gray-400 mb-1">{key}</div>
                        <div className="text-2xl font-bold text-white">
                          {selectedEvaluation.evaluation.spin_evaluation[key]?.final_score?.toFixed(1) || '0.0'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pontos Fortes */}
              {selectedEvaluation.evaluation?.top_strengths && selectedEvaluation.evaluation.top_strengths.length > 0 && (
                <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20">
                  <h3 className="text-base font-bold text-green-400 mb-2">✅ Pontos Fortes</h3>
                  <ul className="space-y-2">
                    {selectedEvaluation.evaluation.top_strengths.map((strength: string, index: number) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Gaps Críticos */}
              {selectedEvaluation.evaluation?.critical_gaps && selectedEvaluation.evaluation.critical_gaps.length > 0 && (
                <div className="bg-gray-800/40 rounded-xl p-4 border border-red-500/20">
                  <h3 className="text-base font-bold text-red-400 mb-2">⚠️ Gaps Críticos</h3>
                  <ul className="space-y-2">
                    {selectedEvaluation.evaluation.critical_gaps.map((gap: string, index: number) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Melhorias Prioritárias */}
              {selectedEvaluation.evaluation?.priority_improvements && selectedEvaluation.evaluation.priority_improvements.length > 0 && (
                <div className="bg-gray-800/40 rounded-xl p-4 border border-yellow-500/20">
                  <h3 className="text-base font-bold text-yellow-400 mb-3">🎯 Melhorias Prioritárias</h3>
                  <div className="space-y-3">
                    {selectedEvaluation.evaluation.priority_improvements.map((improvement: any, index: number) => (
                      <div key={index} className="bg-gray-900/50 rounded-lg p-3 border border-yellow-500/10">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs uppercase font-bold text-yellow-400">
                            {improvement.priority}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-300">{improvement.area}</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-2">{improvement.current_gap}</p>
                        <p className="text-sm text-gray-300">{improvement.action_plan}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão Fechar */}
              <button
                onClick={() => setSelectedEvaluation(null)}
                className="w-full py-3 rounded-xl font-bold text-white shadow-xl"
                style={{
                  background: 'linear-gradient(to right, #22c55e, #a3e635)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, #16a34a, #84cc16)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, #22c55e, #a3e635)'
                }}
              >
                FECHAR AVALIAÇÃO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Comparação */}
      {showComparison && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="w-full max-w-6xl h-[80vh] flex flex-col bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-2xl border border-green-500/30">
            {/* Header simples */}
            <div className="px-4 py-3 border-b border-green-500/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-green-400" />
                    Comparação de Roleplays
                    <span className="text-sm text-gray-400 font-normal">
                      ({selectedForComparison.length} selecionados)
                    </span>
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowComparison(false)
                    setSelectedForComparison([])
                    setCompareMode(false)
                  }}
                  className="px-6 py-1.5 rounded-lg text-xs font-bold text-white shadow-lg mt-4"
                  style={{
                    background: 'linear-gradient(to right, #22c55e, #a3e635)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(to right, #16a34a, #84cc16)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(to right, #22c55e, #a3e635)'
                  }}
                >
                  FECHAR
                </button>
              </div>
            </div>

            {/* Content com scroll */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Grid de Comparação */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {selectedForComparison.map(roleplayId => {
                  const roleplay = historico.find(r => r.id === roleplayId)
                  if (!roleplay) return null

                  const evaluation = roleplay.evaluation
                  const overallScore = evaluation?.overall_score
                  const spinScores = evaluation?.spin_evaluation

                  return (
                    <div key={roleplayId} className="bg-black/60 border border-green-500/20 rounded-xl p-3">
                      {/* Header do Card */}
                      <div className="mb-3 pb-2 border-b border-green-500/20">
                        <h3 className="font-bold text-white text-base mb-1">
                          {roleplay.participant_name}
                        </h3>
                        <p className="text-[10px] text-gray-400">
                          {new Date(roleplay.created_at).toLocaleString('pt-BR')}
                        </p>
                        <div className="mt-1">
                          {overallScore !== null && overallScore !== undefined ? (
                            <div className="text-2xl font-bold text-green-400">
                              {(overallScore / 10).toFixed(1)}/10
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              Sem avaliação
                            </div>
                          )}
                        </div>
                      </div>

                      {/* SPIN Scores */}
                      {spinScores && (
                        <div className="mb-3">
                          <h4 className="text-xs font-bold text-green-400 mb-1">SPIN</h4>
                          <div className="grid grid-cols-2 gap-1">
                            {['S', 'P', 'I', 'N'].map((key) => (
                              <div key={key} className="bg-gray-900/50 rounded p-1 text-center">
                                <div className="text-[9px] text-gray-400">{key}</div>
                                <div className="text-sm font-bold text-white">
                                  {spinScores[key]?.final_score?.toFixed(1) || '0.0'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resumo Compacto */}
                      {evaluation?.executive_summary && (
                        <div className="mb-2">
                          <h4 className="text-xs font-bold text-green-400 mb-1">Resumo</h4>
                          <p className="text-[10px] text-gray-300 leading-relaxed line-clamp-2">
                            {evaluation.executive_summary}
                          </p>
                        </div>
                      )}

                      {/* Pontos Fortes - Apenas 1 */}
                      {evaluation?.top_strengths && evaluation.top_strengths.length > 0 && (
                        <div className="mb-2">
                          <h4 className="text-xs font-bold text-green-400 mb-1">✅ Principal Forte</h4>
                          <p className="text-[10px] text-gray-300 line-clamp-1">
                            • {evaluation.top_strengths[0]}
                          </p>
                        </div>
                      )}

                      {/* Gap Principal - Apenas 1 */}
                      {evaluation?.critical_gaps && evaluation.critical_gaps.length > 0 && (
                        <div className="mb-2">
                          <h4 className="text-xs font-bold text-red-400 mb-1">⚠️ Principal Gap</h4>
                          <p className="text-[10px] text-gray-300 line-clamp-1">
                            • {evaluation.critical_gaps[0]}
                          </p>
                        </div>
                      )}

                      {/* Botão Ver Detalhes */}
                      {evaluation && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedEvaluation(roleplay)
                          }}
                          className="w-full mt-2 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 hover:border-green-500/50 rounded-lg text-[10px] text-green-400 font-semibold transition-all"
                        >
                          Ver Detalhes
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Tabela Comparativa de Métricas */}
              <div className="mt-4 overflow-x-auto">
                <h3 className="text-base font-bold text-white mb-3">📊 Comparação de Métricas</h3>
                <table className="w-full bg-black/40 rounded-xl overflow-hidden text-sm">
                  <thead className="bg-green-500/10 border-b border-green-500/20">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-green-400">Participante</th>
                      <th className="text-center px-2 py-2 text-xs font-medium text-green-400">Nota</th>
                      <th className="text-center px-2 py-2 text-xs font-medium text-green-400">S</th>
                      <th className="text-center px-2 py-2 text-xs font-medium text-green-400">P</th>
                      <th className="text-center px-2 py-2 text-xs font-medium text-green-400">I</th>
                      <th className="text-center px-2 py-2 text-xs font-medium text-green-400">N</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-500/10">
                    {selectedForComparison.map(roleplayId => {
                      const roleplay = historico.find(r => r.id === roleplayId)
                      if (!roleplay) return null

                      const evaluation = roleplay.evaluation
                      const spinScores = evaluation?.spin_evaluation

                      return (
                        <tr key={roleplayId} className="hover:bg-green-500/5 transition-colors">
                          <td className="px-3 py-2 text-xs text-white font-medium">
                            {roleplay.participant_name}
                          </td>
                          <td className="text-center px-2 py-2">
                            <span className="text-sm font-bold text-green-400">
                              {evaluation?.overall_score ? (evaluation.overall_score / 10).toFixed(1) : '0.0'}
                            </span>
                          </td>
                          <td className="text-center px-2 py-2 text-xs text-white">
                            {spinScores?.S?.final_score?.toFixed(1) || '0.0'}
                          </td>
                          <td className="text-center px-2 py-2 text-xs text-white">
                            {spinScores?.P?.final_score?.toFixed(1) || '0.0'}
                          </td>
                          <td className="text-center px-2 py-2 text-xs text-white">
                            {spinScores?.I?.final_score?.toFixed(1) || '0.0'}
                          </td>
                          <td className="text-center px-2 py-2 text-xs text-white">
                            {spinScores?.N?.final_score?.toFixed(1) || '0.0'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botão Fechar */}
              <button
                onClick={() => {
                  setShowComparison(false)
                  setSelectedForComparison([])
                  setCompareMode(false)
                }}
                className="w-full mt-4 py-2 rounded-xl font-bold text-sm text-white shadow-xl"
                style={{
                  background: 'linear-gradient(to right, #22c55e, #a3e635)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, #16a34a, #84cc16)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(to right, #22c55e, #a3e635)'
                }}
              >
                FECHAR COMPARAÇÃO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}