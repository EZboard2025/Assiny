'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Link2, Copy, CheckCircle, Users, BarChart3, Settings, Power } from 'lucide-react'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

interface RoleplayLink {
  id: string
  company_id: string
  is_active: boolean
  config: {
    age_range: string
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

  // Opções disponíveis
  const [personas, setPersonas] = useState<Persona[]>([])
  const [objections, setObjections] = useState<Objection[]>([])

  // Configuração
  const [config, setConfig] = useState({
    age_range: '25-34',
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
        setRoleplayLink(linkData)
        setConfig(linkData.config)
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
        .eq('company_id', roleplayLink.company_id)

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
    if (!roleplayLink) return

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
      const { error } = await supabase
        .from('roleplay_links')
        .update({
          config,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', roleplayLink.company_id)

      if (!error) {
        setRoleplayLink({
          ...roleplayLink,
          config
        })
        alert('Configuração salva com sucesso!')
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
      alert('Erro ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = () => {
    if (!company) return

    const link = `https://${company.subdomain}.ramppy.site/roleplay-publico`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getRoleplayUrl = () => {
    if (!company) return ''

    // Em desenvolvimento
    if (window.location.hostname.includes('localhost') || window.location.hostname.includes('ramppy.local')) {
      return `http://${company.subdomain}.ramppy.local:3000/roleplay-publico`
    }

    // Em produção
    return `https://${company.subdomain}.ramppy.site/roleplay-publico`
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!roleplayLink || !company) {
    return (
      <div className="p-8">
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6">
          <p className="text-yellow-300">Erro ao carregar configuração de roleplay</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Link Público de Roleplay
          </h1>
          <p className="text-gray-400">
            Gerencie o link de roleplay público da sua empresa
          </p>
        </div>

        {/* Card do Link */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center">
                <Link2 className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Link de Treinamento
                </h2>
                <p className="text-sm text-gray-400">
                  {roleplayLink.is_active ? 'Ativo' : 'Desativado'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleActive}
              disabled={saving}
              className={`p-3 rounded-xl transition-all ${
                roleplayLink.is_active
                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700/70'
              } disabled:opacity-50`}
            >
              <Power className="w-5 h-5" />
            </button>
          </div>

          {/* URL */}
          <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-400 mb-2">URL do Roleplay:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-purple-300 text-sm font-mono">
                {getRoleplayUrl()}
              </code>
              <button
                onClick={copyLink}
                className="p-2 bg-purple-600/20 hover:bg-purple-600/30 rounded-lg transition-colors"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-purple-400" />
                )}
              </button>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-purple-400" />
                <p className="text-sm text-gray-400">Total de Usos</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {roleplayLink.usage_count}
              </p>
            </div>
            <div className="bg-gray-900/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <p className="text-sm text-gray-400">Status</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {roleplayLink.is_active ? 'Ativo' : 'Inativo'}
              </p>
            </div>
          </div>
        </div>

        {/* Configuração */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">
              Configuração do Roleplay
            </h2>
          </div>

          <div className="space-y-6">
            {/* Faixa Etária */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Faixa Etária do Cliente
              </label>
              <select
                value={config.age_range}
                onChange={(e) => setConfig({ ...config, age_range: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/20 rounded-xl text-white focus:outline-none focus:border-purple-500/40"
              >
                <option value="18-24">18-24 anos</option>
                <option value="25-34">25-34 anos</option>
                <option value="35-44">35-44 anos</option>
                <option value="45-60">45-60 anos</option>
              </select>
            </div>

            {/* Temperamento */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Temperamento do Cliente
              </label>
              <select
                value={config.temperament}
                onChange={(e) => setConfig({ ...config, temperament: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/20 rounded-xl text-white focus:outline-none focus:border-purple-500/40"
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
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Persona do Cliente
              </label>
              {personas.length === 0 ? (
                <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl">
                  <p className="text-yellow-300 text-sm">
                    Nenhuma persona cadastrada. Por favor, cadastre personas no ConfigHub primeiro.
                  </p>
                </div>
              ) : (
                <select
                  value={config.persona_id || ''}
                  onChange={(e) => setConfig({ ...config, persona_id: e.target.value || null })}
                  className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/20 rounded-xl text-white focus:outline-none focus:border-purple-500/40"
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
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Objeções do Cliente ({config.objection_ids.length} selecionadas)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-900/30 rounded-xl p-4">
                {objections.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhuma objeção cadastrada</p>
                ) : (
                  objections.map(objection => (
                    <label
                      key={objection.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={config.objection_ids.includes(objection.id)}
                        onChange={() => {
                          if (config.objection_ids.includes(objection.id)) {
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
                        className="w-4 h-4 text-purple-600 bg-gray-900 border-purple-500/30 rounded focus:ring-purple-500"
                      />
                      <span className="text-gray-300">{objection.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Preview da Configuração */}
            {config.persona_id && config.objection_ids.length > 0 && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-purple-300 mb-2">
                  Resumo da Configuração
                </h3>
                <p className="text-xs text-gray-400">
                  Os participantes farão roleplay com um cliente de {config.age_range} anos,
                  com temperamento {config.temperament.toLowerCase()},
                  representando {(() => {
                    const persona = personas.find(p => p.id === config.persona_id)
                    return persona?.job_title || persona?.profession || 'perfil selecionado'
                  })()},
                  com {config.objection_ids.length} objeção(ões) selecionada(s).
                </p>
              </div>
            )}

            {/* Botão Salvar */}
            <button
              onClick={saveConfig}
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}