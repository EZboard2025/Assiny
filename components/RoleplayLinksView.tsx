'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Link2, Copy, CheckCircle, Users, BarChart3, Settings, Power, Sparkles, Target, Edit2, X, Save, History, Loader2 } from 'lucide-react'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

interface RoleplayLink {
  id: string
  company_id: string
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

  // Ver Roleplays
  const [showHistorico, setShowHistorico] = useState(false)
  const [historico, setHistorico] = useState<any[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [selectedEvaluation, setSelectedEvaluation] = useState<any>(null)

  // Opções disponíveis
  const [personas, setPersonas] = useState<Persona[]>([])
  const [objections, setObjections] = useState<Objection[]>([])

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
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const companyId = await getCompanyId()

      if (!companyId) {
        console.error('Company ID não encontrado')
        setLoading(false)
        return
      }

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
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async () => {
    if (!roleplayLink) return

    setSaving(true)
    try {
      const newStatus = !roleplayLink.is_active

      const { error } = await supabase
        .from('roleplay_links')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleplayLink.id)  // ✅ Usar ID específico do link

      if (!error) {
        setRoleplayLink({
          ...roleplayLink,
          is_active: newStatus
        })
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
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
      console.log('🔵 Chamando API para salvar config...')
      console.log('🔵 roleplayLink.id:', roleplayLink.id)
      console.log('🔵 config a salvar:', JSON.stringify(config, null, 2))

      // Usar API route com service role para bypass RLS
      const response = await fetch('/api/roleplay-links/update-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: roleplayLink.id,
          config
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

      console.log('✅ Configuração salva com sucesso:', config)
      setRoleplayLink({
        ...roleplayLink,
        config
      })
      setOriginalConfig(JSON.parse(JSON.stringify(config))) // Clone profundo
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
      link = `http://${company.subdomain}.ramppy.local:3000/roleplay-publico?link=${roleplayLink.link_code}`
    } else {
      link = `https://${company.subdomain}.ramppy.site/roleplay-publico?link=${roleplayLink.link_code}`
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
    if (!company || !roleplayLink?.link_code) return ''

    // Em desenvolvimento
    if (window.location.hostname.includes('localhost') || window.location.hostname.includes('ramppy.local')) {
      return `http://${company.subdomain}.ramppy.local:3000/roleplay-publico?link=${roleplayLink.link_code}`
    }

    // Em produção
    return `https://${company.subdomain}.ramppy.site/roleplay-publico?link=${roleplayLink.link_code}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!roleplayLink || !company) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6 max-w-md">
          <p className="text-yellow-300">Erro ao carregar configuração de roleplay</p>
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
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-600/20 to-lime-500/20 rounded-full mb-6">
              <Target className="w-10 h-10 text-green-400" />
            </div>
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
                  className="px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:text-white border border-gray-700"
                >
                  <History className="w-5 h-5" />
                  Ver Roleplays
                </button>
                <button
                  onClick={toggleActive}
                  disabled={saving}
                  className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                    roleplayLink.is_active
                      ? 'bg-gradient-to-r from-green-600 to-lime-500 text-white hover:scale-105 glow-green'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                  } disabled:opacity-50`}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-green-600/10 to-lime-500/10 rounded-2xl p-5 border border-green-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-green-400" />
                  <p className="text-sm font-medium text-gray-300">Total de Usos</p>
                </div>
                <p className="text-3xl font-bold text-white">
                  {roleplayLink.usage_count}
                </p>
              </div>
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
                  <div className="mb-6">
                    <p className="text-gray-400">
                      {historico.length} roleplay{historico.length !== 1 ? 's' : ''} realizad{historico.length !== 1 ? 'os' : 'o'}
                    </p>
                  </div>

                  {historico.map((roleplay) => {
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
                        className="bg-black/60 border border-green-500/10 rounded-2xl p-6 hover:border-green-500/30 transition-all"
                      >
                        <div className="flex items-start justify-between">
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
                              <>
                                <div className={`text-4xl font-bold ${getScoreColor(performanceLevel)}`}>
                                  {overallScore.toFixed(1)}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {getPerformanceLevelText(performanceLevel)}
                                </div>
                              </>
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] overflow-hidden flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setSelectedEvaluation(null)}
              className="absolute top-2 right-2 z-10 w-10 h-10 bg-gray-800/90 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors border border-green-500/30"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-t-3xl border-t border-x border-green-500/30 p-4">
              <h2 className="text-xl font-bold text-center text-white mb-2">🎯 AVALIAÇÃO DETALHADA</h2>
              <p className="text-center text-gray-400 text-sm">
                {selectedEvaluation.participant_name} - {new Date(selectedEvaluation.created_at).toLocaleString('pt-BR')}
              </p>

              {/* Score Geral */}
              <div className="bg-gray-800/40 rounded-xl p-3 border border-green-500/20 mt-3">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-400">
                    {selectedEvaluation.evaluation?.overall_score ? (selectedEvaluation.evaluation.overall_score / 10).toFixed(1) : '0.0'}/10
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-b-3xl border-b border-x border-green-500/30 p-5 space-y-4">
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
                className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-bold text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/50 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}