'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Link2,
  Copy,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Check,
  Loader2,
  Eye,
  Users,
  Target,
  BarChart3
} from 'lucide-react'
import { getPersonas, getObjections, type Persona, type Objection } from '@/lib/config'

interface RoleplayLink {
  id: string
  link_code: string
  name: string
  description?: string
  config: {
    age: string
    temperament: string
    persona_id: string
    objection_ids: string[]
  }
  is_active: boolean
  usage_count: number
  full_url: string
  created_at: string
  stats?: {
    total_sessions: number
    completed_sessions: number
    abandoned_sessions: number
    avg_score: number | null
  }
}

interface RoleplayLinkManagerProps {
  companyId: string
}

export default function RoleplayLinkManager({ companyId }: RoleplayLinkManagerProps) {
  // Estados
  const [links, setLinks] = useState<RoleplayLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingLink, setEditingLink] = useState<RoleplayLink | null>(null)
  const [savingLink, setSavingLink] = useState(false)
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null)

  // Estados do formulário
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    age: '25-34',
    temperament: 'Analítico',
    persona_id: '',
    objection_ids: [] as string[]
  })

  // Dados de configuração
  const [personas, setPersonas] = useState<Persona[]>([])
  const [objections, setObjections] = useState<Objection[]>([])

  // Opções de idade e temperamento
  const ageOptions = [
    { value: '18-24', label: '18-24 anos' },
    { value: '25-34', label: '25-34 anos' },
    { value: '35-44', label: '35-44 anos' },
    { value: '45-60', label: '45-60 anos' }
  ]

  const temperamentOptions = [
    { value: 'Analítico', label: 'Analítico' },
    { value: 'Empático', label: 'Empático' },
    { value: 'Determinado', label: 'Determinado' },
    { value: 'Indeciso', label: 'Indeciso' },
    { value: 'Sociável', label: 'Sociável' }
  ]

  // Carregar dados iniciais
  useEffect(() => {
    loadLinks()
    loadConfigData()
  }, [companyId])

  const loadLinks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/roleplay-links/list')
      const data = await response.json()

      if (data.success) {
        setLinks(data.data || [])
      }
    } catch (error) {
      console.error('Erro ao carregar links:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadConfigData = async () => {
    try {
      const [personasData, objectionsData] = await Promise.all([
        getPersonas(),
        getObjections()
      ])

      setPersonas(personasData)
      setObjections(objectionsData)
    } catch (error) {
      console.error('Erro ao carregar dados de configuração:', error)
    }
  }

  const handleCreateLink = async () => {
    if (!formData.name || !formData.persona_id || formData.objection_ids.length === 0) {
      alert('Preencha todos os campos obrigatórios!')
      return
    }

    try {
      setSavingLink(true)

      const response = await fetch('/api/roleplay-links/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          config: {
            age: formData.age,
            temperament: formData.temperament,
            persona_id: formData.persona_id,
            objection_ids: formData.objection_ids
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        await loadLinks()
        setShowCreateModal(false)
        resetForm()
        alert('Link criado com sucesso!')
      } else {
        alert(data.error || 'Erro ao criar link')
      }
    } catch (error) {
      console.error('Erro ao criar link:', error)
      alert('Erro ao criar link')
    } finally {
      setSavingLink(false)
    }
  }

  const handleUpdateLink = async () => {
    if (!editingLink) return

    try {
      setSavingLink(true)

      const response = await fetch('/api/roleplay-links/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId: editingLink.id,
          name: formData.name,
          description: formData.description,
          config: {
            age: formData.age,
            temperament: formData.temperament,
            persona_id: formData.persona_id,
            objection_ids: formData.objection_ids
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        await loadLinks()
        setShowEditModal(false)
        setEditingLink(null)
        resetForm()
        alert('Link atualizado com sucesso!')
      } else {
        alert(data.error || 'Erro ao atualizar link')
      }
    } catch (error) {
      console.error('Erro ao atualizar link:', error)
      alert('Erro ao atualizar link')
    } finally {
      setSavingLink(false)
    }
  }

  const handleToggleActive = async (linkId: string, currentState: boolean) => {
    try {
      const response = await fetch('/api/roleplay-links/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          is_active: !currentState
        })
      })

      const data = await response.json()

      if (data.success) {
        await loadLinks()
      } else {
        alert(data.error || 'Erro ao atualizar status')
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      alert('Erro ao atualizar status')
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Tem certeza que deseja deletar este link? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      setDeletingLinkId(linkId)

      const response = await fetch(`/api/roleplay-links/delete?id=${linkId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await loadLinks()
        alert('Link deletado com sucesso!')
      } else {
        alert(data.error || 'Erro ao deletar link')
      }
    } catch (error) {
      console.error('Erro ao deletar link:', error)
      alert('Erro ao deletar link')
    } finally {
      setDeletingLinkId(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Link copiado para a área de transferência!')
  }

  const openEditModal = (link: RoleplayLink) => {
    setEditingLink(link)
    setFormData({
      name: link.name,
      description: link.description || '',
      age: link.config.age,
      temperament: link.config.temperament,
      persona_id: link.config.persona_id,
      objection_ids: link.config.objection_ids
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      age: '25-34',
      temperament: 'Analítico',
      persona_id: '',
      objection_ids: []
    })
  }

  const toggleObjection = (objectionId: string) => {
    setFormData(prev => ({
      ...prev,
      objection_ids: prev.objection_ids.includes(objectionId)
        ? prev.objection_ids.filter(id => id !== objectionId)
        : [...prev.objection_ids, objectionId]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Links de Roleplay</h3>
          <p className="text-sm text-gray-400">
            Crie links únicos para que pessoas façam roleplays sem precisar de conta
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Criar Novo Link
        </button>
      </div>

      {/* Lista de Links */}
      {links.length === 0 ? (
        <div className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-20 text-center">
          <Link2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">Nenhum link criado ainda</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform"
          >
            Criar Primeiro Link
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {links.map(link => (
            <div
              key={link.id}
              className="bg-gray-900/50 border border-purple-500/20 rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-bold text-white">{link.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      link.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {link.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {link.description && (
                    <p className="text-sm text-gray-400 mb-3">{link.description}</p>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 px-3 py-2 bg-gray-800/50 border border-purple-500/10 rounded-lg text-sm text-gray-300 font-mono">
                      {link.full_url}
                    </div>
                    <button
                      onClick={() => copyToClipboard(link.full_url)}
                      className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                      title="Copiar link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(link.id, link.is_active)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title={link.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {link.is_active ? (
                      <ToggleRight className="w-5 h-5 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(link)}
                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteLink(link.id)}
                    disabled={deletingLinkId === link.id}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Deletar"
                  >
                    {deletingLinkId === link.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-700">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{link.usage_count}</p>
                  <p className="text-xs text-gray-400">Usos Totais</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {link.stats?.completed_sessions || 0}
                  </p>
                  <p className="text-xs text-gray-400">Completos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {link.stats?.abandoned_sessions || 0}
                  </p>
                  <p className="text-xs text-gray-400">Abandonados</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {link.stats?.avg_score ? link.stats.avg_score.toFixed(1) : '-'}
                  </p>
                  <p className="text-xs text-gray-400">Média Score</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar/Editar */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-purple-500/30">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {showEditModal ? 'Editar' : 'Criar'} Link de Roleplay
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setShowEditModal(false)
                  setEditingLink(null)
                  resetForm()
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome do Link */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome do Link *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Roleplay Vendas B2B"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição (Opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva o propósito deste link..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none resize-none"
                />
              </div>

              {/* Idade e Temperamento */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Faixa Etária *
                  </label>
                  <select
                    value={formData.age}
                    onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white focus:border-purple-500/50 focus:outline-none"
                  >
                    {ageOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Temperamento *
                  </label>
                  <select
                    value={formData.temperament}
                    onChange={(e) => setFormData(prev => ({ ...prev, temperament: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white focus:border-purple-500/50 focus:outline-none"
                  >
                    {temperamentOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Persona */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Persona *
                </label>
                <select
                  value={formData.persona_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, persona_id: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl text-white focus:border-purple-500/50 focus:outline-none"
                >
                  <option value="">Selecione uma persona...</option>
                  {personas.map(persona => (
                    <option key={persona.id} value={persona.id}>
                      {(persona as any).cargo || (persona as any).nome || 'Persona sem nome'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Objeções */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Objeções * (Selecione pelo menos uma)
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-gray-800/30 rounded-xl">
                  {objections.map(objection => (
                    <label
                      key={objection.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-700/30 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.objection_ids.includes(objection.id!)}
                        onChange={() => toggleObjection(objection.id!)}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-300">{objection.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setShowEditModal(false)
                  setEditingLink(null)
                  resetForm()
                }}
                disabled={savingLink}
                className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={showEditModal ? handleUpdateLink : handleCreateLink}
                disabled={savingLink}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingLink ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {showEditModal ? 'Salvar Alterações' : 'Criar Link'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}