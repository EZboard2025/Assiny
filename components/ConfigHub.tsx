'use client'

import { useState, useEffect } from 'react'
import { X, Lock, Settings, Building2, Users, Target, Upload, Plus, Trash2, FileText, AlertCircle, CheckCircle, Loader2, UserCircle2, Edit2, Check, Eye, EyeOff, Tag as TagIcon, Filter, GripVertical } from 'lucide-react'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  getEmployees,
  addEmployee as addEmployeeDB,
  updateEmployee,
  deleteEmployee,
  getCompanyType,
  setCompanyType,
  getObjections,
  addObjection,
  updateObjection,
  updateObjectionScore,
  deleteObjection,
  getPersonas,
  addPersona,
  deletePersona,
  getTags,
  createTag,
  updateTag,
  deleteTag,
  getPersonaTags,
  updatePersonaTags,
  getRoleplayObjectives,
  addRoleplayObjective,
  updateRoleplayObjective,
  deleteRoleplayObjective,
  getFunnelStages,
  addFunnelStage,
  updateFunnelStage,
  updateFunnelStageOrder,
  deleteFunnelStage,
  type Employee,
  type Objection,
  type Persona,
  type PersonaB2B,
  type PersonaB2C,
  type Tag,
  type RoleplayObjective,
  type FunnelStage
} from '@/lib/config'
import { useCompany } from '@/lib/contexts/CompanyContext'
import {
  canCreatePersona,
  canCreateObjection,
  canAddRebuttal,
  getPlanUsageSummary,
  getCompanyTrainingPlan
} from '@/lib/utils/planLimitsChecker'
import { PlanType } from '@/lib/types/plans'
import { useToast } from '@/components/Toast'

interface ConfigHubProps {
  onClose: () => void
}

// Sortable Stage Card Component
interface SortableStageCardProps {
  stage: FunnelStage
  index: number
  totalStages: number
  isEditing: boolean
  editStageName: string
  editStageDescription: string
  editStageObjective: string
  onStartEdit: (stage: FunnelStage) => void
  onCancelEdit: () => void
  onUpdate: (id: string) => void
  onDelete: (id: string) => void
  setEditStageName: (value: string) => void
  setEditStageDescription: (value: string) => void
  setEditStageObjective: (value: string) => void
}

function SortableStageCard({
  stage,
  index,
  totalStages,
  isEditing,
  editStageName,
  editStageDescription,
  editStageObjective,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  setEditStageName,
  setEditStageDescription,
  setEditStageObjective,
}: SortableStageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Definir gradiente e borda baseado na posição
  const isFirst = index === 0
  const isLast = index === totalStages - 1

  const getBorderColor = () => {
    if (isFirst) return 'border-green-400/50' // Verde brilhante no topo
    if (isLast) return 'border-purple-400/50' // Roxo no final
    return 'border-green-500/20' // Padrão
  }

  const getGradient = () => {
    if (isFirst) return 'from-green-900/30 to-green-800/20' // Topo
    if (isLast) return 'from-purple-900/30 to-purple-800/20' // Final
    return 'from-gray-800/50 to-gray-900/30' // Meio
  }

  const getLabel = () => {
    if (isFirst) return '🚀 INÍCIO DO FUNIL'
    if (isLast) return '🎯 FINAL DO FUNIL'
    return `FASE ${index + 1}`
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${
        isDragging ? 'shadow-2xl shadow-green-500/50 z-50 scale-105' : ''
      }`}
    >
      {/* Card principal com efeito empilhado */}
      <div className={`relative bg-gradient-to-br ${getGradient()} border-2 ${getBorderColor()} rounded-2xl p-5 transition-all duration-300 ${
        !isDragging && 'hover:border-green-400/60 hover:shadow-lg hover:shadow-green-500/20'
      }`}>

        {/* Label de posição */}
        <div className={`absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold ${
          isFirst ? 'bg-green-500/20 text-green-300 border border-green-400/50' :
          isLast ? 'bg-purple-500/20 text-purple-300 border border-purple-400/50' :
          'bg-gray-700/80 text-gray-300 border border-gray-600'
        }`}>
          {getLabel()}
        </div>

        {/* Efeito de sombra empilhada */}
        <div className="absolute -bottom-1 left-2 right-2 h-1 bg-gradient-to-b from-gray-900/40 to-transparent rounded-b-xl -z-10" />
        <div className="absolute -bottom-2 left-4 right-4 h-1 bg-gradient-to-b from-gray-900/20 to-transparent rounded-b-xl -z-20" />

        {isEditing ? (
          // Modo de edição
          <div className="space-y-3 mt-2">
            <input
              type="text"
              value={editStageName}
              onChange={(e) => setEditStageName(e.target.value)}
              placeholder="Nome da fase"
              className="w-full px-3 py-2 bg-gray-700/50 border border-green-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
            />
            <textarea
              value={editStageDescription}
              onChange={(e) => setEditStageDescription(e.target.value)}
              placeholder="Descrição"
              rows={2}
              className="w-full px-3 py-2 bg-gray-700/50 border border-green-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
            />
            <textarea
              value={editStageObjective}
              onChange={(e) => setEditStageObjective(e.target.value)}
              placeholder="Objetivo (como passar para próxima fase)"
              rows={2}
              className="w-full px-3 py-2 bg-gray-700/50 border border-green-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => onUpdate(stage.id)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Salvar
              </button>
              <button
                onClick={onCancelEdit}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          // Modo de visualização
          <div className="mt-2">
            <div className="flex items-start gap-3">
              {/* Drag Handle com visual melhorado */}
              <button
                {...attributes}
                {...listeners}
                className={`mt-1 p-2 rounded-lg transition-all ${
                  isDragging
                    ? 'bg-green-500/30 text-green-300'
                    : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10'
                } cursor-grab active:cursor-grabbing`}
                title="⬍ Arraste para reordenar"
              >
                <GripVertical className="w-5 h-5" />
              </button>

              <div className="flex-1 min-w-0">
                {/* Nome da fase */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                    isFirst ? 'bg-green-500/20 text-green-300' :
                    isLast ? 'bg-purple-500/20 text-purple-300' :
                    'bg-gray-700/50 text-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                  <h5 className="text-white font-bold text-lg">{stage.stage_name}</h5>
                </div>

                {/* Descrição */}
                {stage.description && (
                  <p className="text-sm text-gray-300 mb-2 pl-12 leading-relaxed">
                    {stage.description}
                  </p>
                )}

                {/* Objetivo */}
                {stage.objective && (
                  <div className="pl-12 bg-green-500/10 border-l-2 border-green-400 p-2 rounded-r-lg">
                    <p className="text-xs text-green-300 flex items-start gap-1.5">
                      <Target className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span><strong className="text-green-200">Objetivo:</strong> {stage.objective}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Botões de ação */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={() => onStartEdit(stage)}
                  className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                  title="Editar fase"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(stage.id)}
                  className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  title="Excluir fase"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Component for the main configuration interface
function ConfigurationInterface({
  personaEvaluation,
  setPersonaEvaluation,
  showPersonaEvaluationModal,
  setShowPersonaEvaluationModal,
  objectionEvaluation,
  setObjectionEvaluation,
  showObjectionEvaluationModal,
  setShowObjectionEvaluationModal,
  qualityEvaluation,
  setQualityEvaluation,
  showCompanyEvaluationModal,
  setShowCompanyEvaluationModal
}: {
  personaEvaluation: any
  setPersonaEvaluation: (val: any) => void
  showPersonaEvaluationModal: boolean
  setShowPersonaEvaluationModal: (val: boolean) => void
  objectionEvaluation: any
  setObjectionEvaluation: (val: any) => void
  showObjectionEvaluationModal: boolean
  setShowObjectionEvaluationModal: (val: boolean) => void
  qualityEvaluation: any
  setQualityEvaluation: (val: any) => void
  showCompanyEvaluationModal: boolean
  setShowCompanyEvaluationModal: (val: boolean) => void
}) {
  const { currentCompany } = useCompany()
  const { showToast } = useToast()

  // Hook para verificar limites do plano
  const {
    checkPersonaLimit,
    checkObjectionLimit,
    checkRebuttalLimit,
    trainingPlan,
    planUsage
  } = usePlanLimits()

  const [activeTab, setActiveTab] = useState<'employees' | 'personas' | 'objections' | 'objectives' | 'files' | 'funnel'>('employees')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('')
  const [newEmployeePassword, setNewEmployeePassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [addingEmployee, setAddingEmployee] = useState(false)
  const [businessType, setBusinessType] = useState<'B2B' | 'B2C' | 'Ambos'>('B2C')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [showPersonaForm, setShowPersonaForm] = useState(false)
  const [newPersona, setNewPersona] = useState<Partial<PersonaB2B> | Partial<PersonaB2C>>({})
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null)
  const [selectedPersonaType, setSelectedPersonaType] = useState<'B2B' | 'B2C'>('B2B')
  const [objections, setObjections] = useState<Objection[]>([])
  const [newObjection, setNewObjection] = useState('')
  const [newRebuttal, setNewRebuttal] = useState('')
  const [editingObjectionId, setEditingObjectionId] = useState<string | null>(null)
  const [expandedObjections, setExpandedObjections] = useState<Set<string>>(new Set())
  const [evaluatingObjection, setEvaluatingObjection] = useState(false)
  const [loading, setLoading] = useState(true)

  // Estados para Objetivos de Roleplay
  const [objectives, setObjectives] = useState<RoleplayObjective[]>([])
  const [newObjectiveName, setNewObjectiveName] = useState('')
  const [newObjectiveDescription, setNewObjectiveDescription] = useState('')
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null)
  const [editingObjectiveName, setEditingObjectiveName] = useState('')
  const [editingObjectiveDescription, setEditingObjectiveDescription] = useState('')

  // Estados para Tags
  const [tags, setTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6B46C1')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [editingTagColor, setEditingTagColor] = useState('')
  const [selectedPersonaTags, setSelectedPersonaTags] = useState<string[]>([])
  const [personaTags, setPersonaTags] = useState<Map<string, string[]>>(new Map())
  const [filterTag, setFilterTag] = useState<string>('')
  const [showTagForm, setShowTagForm] = useState(false)

  // Estados para controle de limites
  const [personaLimitReached, setPersonaLimitReached] = useState(false)
  const [objectionLimitReached, setObjectionLimitReached] = useState(false)

  // Paleta de cores para tags
  const tagColorPalette = [
    '#6B46C1', // Roxo
    '#EC4899', // Rosa
    '#F59E0B', // Amarelo/Laranja
    '#10B981', // Verde
    '#3B82F6', // Azul
    '#EF4444', // Vermelho
    '#8B5CF6', // Violeta
    '#14B8A6', // Teal
    '#F97316', // Laranja
    '#06B6D4', // Ciano
    '#84CC16', // Lima
    '#A855F7', // Púrpura
  ]
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [uploadQueue, setUploadQueue] = useState<File[]>([])
  const [currentUploadIndex, setCurrentUploadIndex] = useState<number>(-1)
  const [uploadProgress, setUploadProgress] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 })
  const [evaluatingQuality, setEvaluatingQuality] = useState(false)
  const [evaluatingPersona, setEvaluatingPersona] = useState(false)
  const [editedPersonaIds, setEditedPersonaIds] = useState<Set<string>>(new Set())
  const [editedObjectionIds, setEditedObjectionIds] = useState<Set<string>>(new Set())
  const [editingObjectionName, setEditingObjectionName] = useState<string | null>(null)
  const [tempObjectionName, setTempObjectionName] = useState('')
  const [editingRebuttalId, setEditingRebuttalId] = useState<{objectionId: string, index: number} | null>(null)
  const [tempRebuttalText, setTempRebuttalText] = useState('')

  // Estados do formulário de Dados da Empresa
  const [companyData, setCompanyData] = useState({
    nome: '',
    descricao: '',
    produtos_servicos: '',
    funcao_produtos: '',
    diferenciais: '',
    concorrentes: '',
    dados_metricas: '',
    erros_comuns: '',
    percepcao_desejada: '',
    dores_resolvidas: ''
  })
  const [companyDataId, setCompanyDataId] = useState<string | null>(null)
  const [savingCompanyData, setSavingCompanyData] = useState(false)
  const [companyDataEdited, setCompanyDataEdited] = useState(false)

  // Estados para Fases do Funil
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>([])
  const [newStageName, setNewStageName] = useState('')
  const [newStageDescription, setNewStageDescription] = useState('')
  const [newStageObjective, setNewStageObjective] = useState('')
  const [editingStage, setEditingStage] = useState<string | null>(null)
  const [editStageName, setEditStageName] = useState('')
  const [editStageDescription, setEditStageDescription] = useState('')
  const [editStageObjective, setEditStageObjective] = useState('')

  // Carregar dados do Supabase
  useEffect(() => {
    loadData()
    loadCompanyData()
    loadTags()
  }, [])

  // Recarregar tags das personas quando as personas mudarem
  useEffect(() => {
    const loadPersonaTags = async () => {
      const newPersonaTags = new Map<string, string[]>()
      for (const persona of personas) {
        if (persona.id) {
          const tags = await getPersonaTags(persona.id)
          newPersonaTags.set(persona.id, tags.map(t => t.id))
        }
      }
      setPersonaTags(newPersonaTags)
    }

    if (personas.length > 0) {
      loadPersonaTags()
    }
  }, [personas])

  // Verificar limites quando os dados mudarem
  useEffect(() => {
    const checkLimits = async () => {
      if (!trainingPlan || !planUsage) {
        console.log('🔍 Aguardando carregamento do plano e uso...', { trainingPlan, planUsage })
        return
      }

      console.log('🔍 Verificando limites do plano:', {
        trainingPlan,
        planUsage,
        personasCount: personas.length,
        objectionsCount: objections.length
      })

      // Verificar limite de personas
      const personasUsed = planUsage.training?.personas?.used || personas.length || 0
      const personasLimit = planUsage.training?.personas?.limit || 999
      if (trainingPlan === 'pro' && personasUsed >= personasLimit) {
        console.log('⚠️ Limite de personas atingido:', personasUsed, '/', personasLimit)
        setPersonaLimitReached(true)
      } else {
        setPersonaLimitReached(false)
      }

      // Verificar limite de objeções
      const objectionsUsed = planUsage.training?.objections?.used || objections.length || 0
      const objectionsLimit = planUsage.training?.objections?.limit || 999
      if (trainingPlan === 'pro' && objectionsUsed >= objectionsLimit) {
        console.log('⚠️ Limite de objeções atingido:', objectionsUsed, '/', objectionsLimit)
        setObjectionLimitReached(true)
      } else {
        setObjectionLimitReached(false)
      }
    }
    checkLimits()
  }, [personas.length, objections.length, trainingPlan, planUsage])

  // Carregar dados da empresa
  const loadCompanyData = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')

      // Buscar company_id (prioriza subdomínio, depois usuário)
      const companyId = await getCompanyId()
      if (!companyId) {
        console.warn('⚠️ company_id não encontrado')
        return
      }

      const { data, error } = await supabase
        .from('company_data')
        .select('*')
        .eq('company_id', companyId)
        .single()

      if (data && !error) {
        setCompanyDataId(data.id) // Guardar ID para atualizar depois
        setCompanyData({
          nome: data.nome || '',
          descricao: data.descricao || '',
          produtos_servicos: data.produtos_servicos || '',
          funcao_produtos: data.funcao_produtos || '',
          diferenciais: data.diferenciais || '',
          concorrentes: data.concorrentes || '',
          dados_metricas: data.dados_metricas || '',
          erros_comuns: data.erros_comuns || '',
          percepcao_desejada: data.percepcao_desejada || '',
          dores_resolvidas: data.dores_resolvidas || ''
        })

        // Carregar última avaliação se existir
        const { data: evalData, error: evalError } = await supabase
          .from('company_data_evaluations')
          .select('*')
          .eq('company_data_id', data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (evalData && !evalError) {
          setQualityEvaluation(evalData)
          console.log('✅ Última avaliação carregada do banco')
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados da empresa:', error)
    }
  }

  // Salvar dados da empresa e gerar embeddings
  const handleSaveCompanyData = async () => {
    setSavingCompanyData(true)

    try {
      const { supabase } = await import('@/lib/supabase')
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')

      // Buscar company_id (prioriza subdomínio, depois usuário)
      const companyId = await getCompanyId()
      if (!companyId) {
        alert('❌ Erro: company_id não encontrado')
        setSavingCompanyData(false)
        return
      }

      let savedData: any

      // 1. Verificar se já existe registro
      if (companyDataId) {
        // ATUALIZAR registro existente
        console.log('📝 Atualizando registro existente:', companyDataId)
        const { data, error } = await supabase
          .from('company_data')
          .update({
            nome: companyData.nome,
            descricao: companyData.descricao,
            produtos_servicos: companyData.produtos_servicos,
            funcao_produtos: companyData.funcao_produtos,
            diferenciais: companyData.diferenciais,
            concorrentes: companyData.concorrentes,
            dados_metricas: companyData.dados_metricas,
            erros_comuns: companyData.erros_comuns,
            percepcao_desejada: companyData.percepcao_desejada,
            dores_resolvidas: companyData.dores_resolvidas,
            updated_at: new Date().toISOString()
          })
          .eq('id', companyDataId)
          .select()
          .single()

        if (error) {
          console.error('Erro ao atualizar:', error)
          alert('❌ Erro ao atualizar dados da empresa')
          return
        }
        savedData = data
      } else {
        // CRIAR novo registro
        console.log('➕ Criando novo registro para company_id:', companyId)
        const { data, error } = await supabase
          .from('company_data')
          .insert({
            company_id: companyId,
            nome: companyData.nome,
            descricao: companyData.descricao,
            produtos_servicos: companyData.produtos_servicos,
            funcao_produtos: companyData.funcao_produtos,
            diferenciais: companyData.diferenciais,
            concorrentes: companyData.concorrentes,
            dados_metricas: companyData.dados_metricas,
            erros_comuns: companyData.erros_comuns,
            percepcao_desejada: companyData.percepcao_desejada,
            dores_resolvidas: companyData.dores_resolvidas
          })
          .select()
          .single()

        if (error) {
          console.error('Erro ao criar:', error)
          alert('❌ Erro ao criar dados da empresa')
          return
        }
        savedData = data
        setCompanyDataId(data.id) // Guardar ID para próximas atualizações
      }

      console.log('✅ Dados salvos no Supabase:', savedData.id)

      // 2. Gerar embeddings via API (assíncrono - não bloqueia)
      console.log('🔄 Iniciando geração de embeddings...')

      fetch('/api/company/generate-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyDataId: savedData.id })
      })
        .then(res => res.json())
        .then(result => {
          console.log('✅ Embeddings gerados:', result)
        })
        .catch(error => {
          console.error('⚠️ Erro ao gerar embeddings (não bloqueante):', error)
        })

      alert('✅ Dados salvos com sucesso! Embeddings estão sendo gerados em segundo plano.')
      setCompanyDataEdited(false) // Resetar flag de edição após salvar

    } catch (error) {
      console.error('💥 Erro ao salvar dados:', error)
      alert('❌ Erro ao salvar dados da empresa')
    } finally {
      setSavingCompanyData(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [employeesData, companyTypeData, personasData, objectionsData, objectivesData, funnelStagesData] = await Promise.all([
        getEmployees(),
        getCompanyType(),
        getPersonas(),
        getObjections(),
        getRoleplayObjectives(),
        getFunnelStages()
      ])

      setEmployees(employeesData)
      setBusinessType(companyTypeData)
      setPersonas(personasData)

      // Normalizar objections: garantir que rebuttals sejam sempre strings
      const normalizedObjections = objectionsData.map(obj => ({
        ...obj,
        rebuttals: (obj.rebuttals || []).map((r: unknown) => {
          if (typeof r === 'string') return r
          if (typeof r === 'object' && r !== null && 'name' in r) {
            return (r as { name: string }).name
          }
          return JSON.stringify(r)
        })
      }))
      setObjections(normalizedObjections)

      setObjectives(objectivesData)
      setFunnelStages(funnelStagesData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  // Funções para Tags
  const loadTags = async () => {
    try {
      const tagsData = await getTags()
      setTags(tagsData)

      // Carregar tags de cada persona
      const newPersonaTags = new Map<string, string[]>()
      for (const persona of personas) {
        if (persona.id) {
          const tags = await getPersonaTags(persona.id)
          newPersonaTags.set(persona.id, tags.map(t => t.id))
        }
      }
      setPersonaTags(newPersonaTags)
    } catch (error) {
      console.error('Erro ao carregar tags:', error)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      alert('Digite o nome da etiqueta')
      return
    }

    try {
      const newTag = await createTag(newTagName, newTagColor)
      if (newTag) {
        setTags([...tags, newTag])
        setNewTagName('')
        setNewTagColor('#6B46C1')
        setShowTagForm(false)
      }
    } catch (error) {
      console.error('Erro ao criar tag:', error)
      alert('Erro ao criar etiqueta')
    }
  }

  const handleUpdateTag = async (tagId: string) => {
    if (!editingTagName.trim()) {
      alert('Digite o nome da etiqueta')
      return
    }

    try {
      const success = await updateTag(tagId, editingTagName, editingTagColor)
      if (success) {
        setTags(tags.map(t =>
          t.id === tagId
            ? { ...t, name: editingTagName, color: editingTagColor }
            : t
        ))
        setEditingTagId(null)
        setEditingTagName('')
        setEditingTagColor('')
      }
    } catch (error) {
      console.error('Erro ao atualizar tag:', error)
      alert('Erro ao atualizar etiqueta')
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta etiqueta?')) return

    try {
      const success = await deleteTag(tagId)
      if (success) {
        setTags(tags.filter(t => t.id !== tagId))
        // Remover tag das personas
        const newPersonaTags = new Map(personaTags)
        newPersonaTags.forEach((tagIds, personaId) => {
          newPersonaTags.set(personaId, tagIds.filter(id => id !== tagId))
        })
        setPersonaTags(newPersonaTags)
      }
    } catch (error) {
      console.error('Erro ao deletar tag:', error)
      alert('Erro ao deletar etiqueta')
    }
  }

  const handlePersonaTagsUpdate = async (personaId: string, tagIds: string[]) => {
    try {
      const success = await updatePersonaTags(personaId, tagIds)
      if (success) {
        setPersonaTags(prev => {
          const newMap = new Map(prev)
          newMap.set(personaId, tagIds)
          return newMap
        })
      }
    } catch (error) {
      console.error('Erro ao atualizar tags da persona:', error)
      alert('Erro ao atualizar etiquetas da persona')
    }
  }

  const handleSaveEmployee = async () => {
    if (!newEmployeeName || !newEmployeeEmail || !newEmployeePassword) {
      alert('Preencha todos os campos!')
      return
    }

    if (!currentCompany?.id) {
      alert('Erro: empresa não identificada')
      return
    }

    try {
      console.log('🟢 Enviando para API:', {
        name: newEmployeeName,
        email: newEmployeeEmail,
        company_id: currentCompany.id
      })

      const response = await fetch('/api/employees/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newEmployeeName,
          email: newEmployeeEmail,
          password: newEmployeePassword,
          company_id: currentCompany.id
        }),
      })

      console.log('📨 Status da resposta:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Erro completo:', errorText)
        let errorMsg = `Erro ${response.status}`
        let limitInfo = null
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error || errorJson.message || errorText

          // Verificar se é erro de limite
          if (response.status === 403 && errorJson.limit) {
            limitInfo = {
              current: errorJson.currentCount,
              limit: errorJson.limit
            }
            errorMsg = `Limite de funcionários atingido!\n\nSua empresa pode ter no máximo ${errorJson.limit} funcionários.\nAtualmente existem ${errorJson.currentCount} funcionários cadastrados.\n\nEntre em contato com o administrador para aumentar o limite.`
          }
        } catch {
          errorMsg = errorText
        }
        alert(errorMsg)
        return
      }

      const { employee } = await response.json()

      // Adicionar à lista
      setEmployees([...employees, employee])

      // Limpar campos
      setNewEmployeeName('')
      setNewEmployeeEmail('')
      setNewEmployeePassword('')
      setShowPassword(false)
      setAddingEmployee(false)

      alert('Funcionário criado com sucesso!')
    } catch (error) {
      console.error('Erro ao criar funcionário:', error)
      alert('Erro ao criar funcionário!')
    }
  }

  const handleDeleteEmployee = async (id: string, email: string) => {
    if (!confirm('Tem certeza que deseja excluir este funcionário?')) return
    const success = await deleteEmployee(id, email)
    if (success) {
      setEmployees(employees.filter(e => e.id !== id))
    }
  }

  const handleRoleChange = async (employeeId: string, newRole: string) => {
    try {
      const response = await fetch('/api/employees/update-role', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId,
          role: newRole
        })
      })

      if (response.ok) {
        const { employee } = await response.json()
        // Atualizar o estado local
        setEmployees(employees.map(emp =>
          emp.id === employeeId ? { ...emp, role: newRole } : emp
        ))
        alert(`Role atualizado para ${newRole} com sucesso!`)
      } else {
        const error = await response.json()
        alert(`Erro ao atualizar role: ${error.error}`)
      }
    } catch (error) {
      console.error('Erro ao atualizar role:', error)
      alert('Erro ao atualizar role')
    }
  }

  // Processar fila de upload - envia um arquivo por vez
  const processUploadQueue = async (files: File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setCurrentUploadIndex(i)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('fileName', file.name)
        formData.append('fileType', file.type)

        console.log(`📤 [${i + 1}/${files.length}] Enviando ${file.name} para processamento...`)

        // Enviar para API route que faz proxy para N8N
        const response = await fetch('/api/upload-file', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const result = await response.json()
          setUploadedFiles(prev => [...prev, file.name])
          setUploadProgress(prev => ({ ...prev, completed: prev.completed + 1 }))
          console.log(`✅ [${i + 1}/${files.length}] Arquivo ${file.name} processado com sucesso!`, result)
        } else {
          const error = await response.json()
          console.error(`❌ [${i + 1}/${files.length}] Erro ao enviar ${file.name}:`, error)
          alert(`Erro ao enviar arquivo ${file.name}: ${error.details || error.error}`)
        }
      } catch (error) {
        console.error(`💥 [${i + 1}/${files.length}] Erro ao processar ${file.name}:`, error)
        alert(`Erro ao processar arquivo ${file.name}!`)
      }
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    setUploadQueue(fileArray)
    setUploadProgress({ total: fileArray.length, completed: 0 })
    setUploadingFile(true)

    try {
      await processUploadQueue(fileArray)
      alert(`${fileArray.length} arquivo(s) processado(s) com sucesso! Os embeddings foram criados.`)
    } catch (error) {
      console.error('Erro ao fazer upload:', error)
      alert('Erro ao fazer upload dos arquivos!')
    } finally {
      setUploadingFile(false)
      setCurrentUploadIndex(-1)
      setUploadQueue([])
      // Limpar input
      event.target.value = ''
    }
  }

  const handleSetBusinessType = async (type: 'B2B' | 'B2C' | 'Ambos') => {
    const success = await setCompanyType(type)
    if (success) {
      setBusinessType(type)
    }
  }

  const handleSavePersona = async () => {
    // Determinar o tipo de persona baseado no businessType e selectedPersonaType
    const personaType = businessType === 'Ambos' ? selectedPersonaType : businessType

    if (personaType === 'B2B') {
      const persona = newPersona as PersonaB2B
      if (!persona.job_title) {
        alert('Por favor, preencha o cargo')
        return
      }

      if (editingPersonaId) {
        // Atualizar persona existente
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase
          .from('personas')
          .update({ ...persona, business_type: personaType })
          .eq('id', editingPersonaId)
          .select()
          .single()

        if (error) {
          console.error('Erro ao atualizar persona:', error)
          alert('Erro ao atualizar persona!')
          return
        }

        setPersonas(personas.map(p => p.id === editingPersonaId ? data : p))
        // Marcar persona como editada (permite reavaliação)
        if (editingPersonaId) {
          setEditedPersonaIds(prev => new Set(prev).add(editingPersonaId))
          // Atualizar tags da persona
          await handlePersonaTagsUpdate(editingPersonaId, selectedPersonaTags)
        }
        setNewPersona({})
        setShowPersonaForm(false)
        setEditingPersonaId(null)
        setSelectedPersonaTags([])
      } else {
        // Verificar limite de personas antes de criar
        const limitCheck = await checkPersonaLimit()
        if (!limitCheck.allowed) {
          showToast('error', 'Limite atingido', limitCheck.reason || 'Limite de personas atingido para o plano')
          return
        }

        // Criar nova persona
        const result = await addPersona({ ...persona, business_type: personaType })
        if (result) {
          setPersonas([...personas, result])
          // Adicionar tags à nova persona
          if (result.id && selectedPersonaTags.length > 0) {
            await handlePersonaTagsUpdate(result.id, selectedPersonaTags)
          }
          setNewPersona({})
          setShowPersonaForm(false)
          setSelectedPersonaTags([])
        }
      }
    } else if (personaType === 'B2C') {
      const persona = newPersona as PersonaB2C
      if (!persona.profession) {
        alert('Por favor, preencha a profissão')
        return
      }

      if (editingPersonaId) {
        // Atualizar persona existente
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase
          .from('personas')
          .update({ ...persona, business_type: personaType })
          .eq('id', editingPersonaId)
          .select()
          .single()

        if (error) {
          console.error('Erro ao atualizar persona:', error)
          alert('Erro ao atualizar persona!')
          return
        }

        setPersonas(personas.map(p => p.id === editingPersonaId ? data : p))
        // Marcar persona como editada (permite reavaliação)
        if (editingPersonaId) {
          setEditedPersonaIds(prev => new Set(prev).add(editingPersonaId))
          // Atualizar tags da persona
          await handlePersonaTagsUpdate(editingPersonaId, selectedPersonaTags)
        }
        setNewPersona({})
        setShowPersonaForm(false)
        setEditingPersonaId(null)
        setSelectedPersonaTags([])
      } else {
        // Verificar limite de personas antes de criar
        const limitCheck = await checkPersonaLimit()
        if (!limitCheck.allowed) {
          showToast('error', 'Limite atingido', limitCheck.reason || 'Limite de personas atingido para o plano')
          return
        }

        // Criar nova persona
        const result = await addPersona({ ...persona, business_type: personaType })
        if (result) {
          setPersonas([...personas, result])
          // Adicionar tags à nova persona
          if (result.id && selectedPersonaTags.length > 0) {
            await handlePersonaTagsUpdate(result.id, selectedPersonaTags)
          }
          setNewPersona({})
          setShowPersonaForm(false)
          setSelectedPersonaTags([])
        }
      }
    }
  }

  const handleDeletePersona = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta persona?')) return
    const success = await deletePersona(id)
    if (success) {
      setPersonas(personas.filter(p => p.id !== id))
    }
  }

  const handleEvaluatePersona = async (persona: Persona) => {
    setEvaluatingPersona(true)
    try {
      console.log('📊 Enviando persona para avaliação...', persona)

      // Buscar dados da empresa e company_type
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const { supabase } = await import('@/lib/supabase')

      const companyId = await getCompanyId()
      let companyData = null
      let companyType = 'B2C' // Default

      if (companyId) {
        // Buscar company_data
        const { data: companyDataResult, error: companyError } = await supabase
          .from('company_data')
          .select('*')
          .eq('company_id', companyId)
          .single()

        if (!companyError && companyDataResult) {
          companyData = companyDataResult
          console.log('🏢 Dados da empresa carregados:', companyDataResult.nome)
        }

        // Buscar company_type
        const { data: companyTypeResult, error: typeError } = await supabase
          .from('company_type')
          .select('name')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (typeError) {
          console.warn('⚠️ Erro ao buscar company_type:', typeError)
        }

        if (companyTypeResult) {
          companyType = companyTypeResult.name
          console.log('🏷️ Company type encontrado:', companyType)
        } else {
          console.warn('⚠️ Company type não encontrado, usando default:', companyType)
        }
      }

      // Juntar todos os campos do formulário em um único texto
      let personaText = ''

      if (persona.business_type === 'B2B') {
        const personaB2B = persona as PersonaB2B
        personaText = `Tipo de Negócio: B2B\n\nCargo: ${personaB2B.job_title || 'N/A'}\n\nTipo de Empresa: ${personaB2B.company_type || 'N/A'}\n\nContexto: ${personaB2B.context || 'N/A'}\n\nO que busca para a empresa: ${personaB2B.company_goals || 'N/A'}\n\nPrincipais desafios/dores do negócio: ${personaB2B.business_challenges || 'N/A'}\n\nO que já sabe sobre a empresa: ${personaB2B.prior_knowledge || 'N/A'}`
      } else {
        const personaB2C = persona as PersonaB2C
        personaText = `Tipo de Negócio: B2C\n\nProfissão: ${personaB2C.profession || 'N/A'}\n\nContexto: ${personaB2C.context || 'N/A'}\n\nO que busca/valoriza: ${personaB2C.what_seeks || 'N/A'}\n\nPrincipais dores/problemas: ${personaB2C.main_pains || 'N/A'}\n\nO que já sabe sobre a empresa: ${personaB2C.prior_knowledge || 'N/A'}`
      }

      const payload = {
        persona: personaText,
        companyData: companyData, // Dados da empresa
        companyType: companyType   // B2B ou B2C
      }

      console.log('📤 Payload enviado para N8N:', {
        hasCompanyData: !!companyData,
        companyType: companyType,
        companyName: companyData?.nome
      })

      const response = await fetch('https://ezboard.app.n8n.cloud/webhook/persona-consultor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Resposta recebida:', result)

        // Parse do JSON retornado pelo N8N
        let evaluation

        // N8N retorna array com objeto {output: "```json\n{...}\n```"}
        if (Array.isArray(result) && result[0]?.output) {
          const outputString = result[0].output
          // Remover ```json e ``` do início e fim
          const jsonString = outputString.replace(/```json\n/, '').replace(/\n```$/, '')
          evaluation = JSON.parse(jsonString)
        } else if (result.output) {
          const outputString = result.output
          const jsonString = outputString.replace(/```json\n/, '').replace(/\n```$/, '')
          evaluation = JSON.parse(jsonString)
        } else {
          evaluation = result
        }

        console.log('✅ Avaliação processada:', evaluation)
        setPersonaEvaluation(evaluation)
        setShowPersonaEvaluationModal(true)

        // Salvar o score no banco de dados
        if (evaluation.score_geral && persona.id) {
          const { supabase } = await import('@/lib/supabase')
          const { error: updateError } = await supabase
            .from('personas')
            .update({ evaluation_score: evaluation.score_geral })
            .eq('id', persona.id)

          if (!updateError) {
            // Atualizar a lista local de personas
            setPersonas(personas.map(p =>
              p.id === persona.id
                ? { ...p, evaluation_score: evaluation.score_geral }
                : p
            ))
            // Remover da lista de editadas (desabilita o botão)
            if (persona.id) {
              setEditedPersonaIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(persona.id!)
                return newSet
              })
            }
          }
        }
      } else {
        console.error('❌ Erro ao avaliar persona:', response.status)
        alert(`Erro ao avaliar persona (${response.status})`)
      }
    } catch (error) {
      console.error('💥 Erro ao avaliar persona:', error)
      alert('Erro ao conectar com o serviço de avaliação')
    } finally {
      setEvaluatingPersona(false)
    }
  }

  const handleAddObjection = async () => {
    if (newObjection.trim()) {
      // Verificar limite de objeções antes de criar
      const limitCheck = await checkObjectionLimit()
      if (!limitCheck.allowed) {
        showToast('error', 'Limite atingido', limitCheck.reason || 'Limite de objeções atingido para o plano')
        return
      }

      const objection = await addObjection(newObjection.trim(), [])
      if (objection) {
        setObjections([...objections, objection])
        setNewObjection('')
        setEditingObjectionId(objection.id)
        setExpandedObjections(new Set([objection.id]))
      }
    }
  }

  const handleAddRebuttal = async (objectionId: string) => {
    if (!newRebuttal.trim()) return

    const objection = objections.find(o => o.id === objectionId)
    if (!objection) return

    // Verificar limite de formas de quebrar antes de adicionar
    const currentRebuttalCount = objection.rebuttals?.length || 0
    const limitCheck = await checkRebuttalLimit(currentRebuttalCount)
    if (!limitCheck.allowed) {
      showToast('error', 'Limite atingido', limitCheck.reason || 'Limite de formas de quebrar atingido para o plano')
      return
    }

    const updatedRebuttals = [...(objection.rebuttals || []), newRebuttal.trim()]
    const success = await updateObjection(objectionId, objection.name, updatedRebuttals)

    if (success) {
      setObjections(objections.map(o =>
        o.id === objectionId ? { ...o, rebuttals: updatedRebuttals, evaluation_score: null } : o
      ))
      setNewRebuttal('')
      // Marcar como editada para permitir reavaliação
      setEditedObjectionIds(prev => new Set(Array.from(prev).concat(objectionId)))
    }
  }

  const handleUpdateObjectionName = async (objectionId: string) => {
    if (!tempObjectionName.trim()) return

    const objection = objections.find(o => o.id === objectionId)
    if (!objection) return

    const success = await updateObjection(objectionId, tempObjectionName.trim(), objection.rebuttals || [])

    if (success) {
      setObjections(objections.map(o =>
        o.id === objectionId ? { ...o, name: tempObjectionName.trim(), evaluation_score: null } : o
      ))
      setEditingObjectionName(null)
      setTempObjectionName('')
      // Marcar como editada para permitir reavaliação
      setEditedObjectionIds(prev => new Set(Array.from(prev).concat(objectionId)))
    }
  }

  const handleUpdateRebuttal = async (objectionId: string, index: number) => {
    if (!tempRebuttalText.trim()) return

    const objection = objections.find(o => o.id === objectionId)
    if (!objection || !objection.rebuttals) return

    const updatedRebuttals = [...objection.rebuttals]
    updatedRebuttals[index] = tempRebuttalText.trim()

    const success = await updateObjection(objectionId, objection.name, updatedRebuttals)

    if (success) {
      setObjections(objections.map(o =>
        o.id === objectionId ? { ...o, rebuttals: updatedRebuttals, evaluation_score: null } : o
      ))
      setEditingRebuttalId(null)
      setTempRebuttalText('')
      // Marcar como editada para permitir reavaliação
      setEditedObjectionIds(prev => new Set(Array.from(prev).concat(objectionId)))
    }
  }

  const handleRemoveRebuttal = async (objectionId: string, rebuttalIndex: number) => {
    const objection = objections.find(o => o.id === objectionId)
    if (!objection) return

    const updatedRebuttals = objection.rebuttals.filter((_, i) => i !== rebuttalIndex)
    const success = await updateObjection(objectionId, objection.name, updatedRebuttals)

    if (success) {
      setObjections(objections.map(o =>
        o.id === objectionId ? { ...o, rebuttals: updatedRebuttals, evaluation_score: null } : o
      ))
      // Marcar como editada para permitir reavaliação
      setEditedObjectionIds(prev => new Set(Array.from(prev).concat(objectionId)))
    }
  }

  const handleRemoveObjection = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta objeção?')) return
    const success = await deleteObjection(id)
    if (success) {
      setObjections(objections.filter(o => o.id !== id))
      setExpandedObjections(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }
  }

  const toggleObjectionExpanded = (id: string) => {
    setExpandedObjections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleEvaluateObjection = async (objection: Objection) => {
    setEvaluatingObjection(true)
    setObjectionEvaluation(null)

    try {
      console.log('🔍 Iniciando avaliação da objeção:', objection.name)

      // Buscar dados da empresa e company_type
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const { supabase } = await import('@/lib/supabase')

      const companyId = await getCompanyId()
      let companyData = null
      let companyType = 'B2C' // Default

      if (companyId) {
        // Buscar company_data
        const { data, error } = await supabase
          .from('company_data')
          .select('*')
          .eq('company_id', companyId)
          .single()

        if (!error && data) {
          companyData = data
          console.log('🏢 Dados da empresa carregados:', data.nome)
        }

        // Buscar company_type
        const { data: companyTypeResult, error: typeError } = await supabase
          .from('company_type')
          .select('name')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!typeError && companyTypeResult) {
          companyType = companyTypeResult.name
          console.log('🏷️ Company type:', companyType)
        }
      }

      // Formatar como texto único
      let objectionText = `OBJEÇÃO:\n${objection.name}\n\nFORMAS DE QUEBRAR:`

      if (objection.rebuttals && objection.rebuttals.length > 0) {
        objection.rebuttals.forEach((rebuttal, index) => {
          // Garantir que rebuttal é string (pode vir como objeto do banco)
          const rebuttalText = typeof rebuttal === 'string' ? rebuttal : JSON.stringify(rebuttal)
          objectionText += `\n${index + 1}. ${rebuttalText}`
        })
      } else {
        objectionText += `\nNenhuma forma de quebrar cadastrada.`
      }

      const payload = {
        objecao_completa: objectionText,
        companyData: companyData, // Dados da empresa para contexto
        companyType: companyType   // B2B ou B2C
      }

      console.log('📤 Enviando para N8N:', payload)

      const response = await fetch('https://ezboard.app.n8n.cloud/webhook/ed84cced-6bf5-4c4d-87e7-4ca3057be871', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`)
      }

      const result = await response.json()
      console.log('📥 Resposta N8N:', result)

      // Parse do formato N8N
      let evaluation = result
      if (Array.isArray(result) && result[0]?.output) {
        let outputString = result[0].output
        // Remover markdown code blocks se existirem
        if (outputString.includes('```json')) {
          outputString = outputString.replace(/```json\n/, '').replace(/\n```$/, '')
        }
        evaluation = JSON.parse(outputString)
      } else if (result?.output && typeof result.output === 'string') {
        let outputString = result.output
        // Remover markdown code blocks se existirem
        if (outputString.includes('```json')) {
          outputString = outputString.replace(/```json\n/, '').replace(/\n```$/, '')
        }
        evaluation = JSON.parse(outputString)
      }

      console.log('✅ Avaliação processada:', evaluation)

      // Salvar score no banco de dados
      if (evaluation?.nota_final !== undefined) {
        const success = await updateObjectionScore(objection.id, evaluation.nota_final)
        if (success) {
          console.log('💾 Score salvo no banco:', evaluation.nota_final)
          // Atualizar state local
          setObjections(objections.map(o =>
            o.id === objection.id ? { ...o, evaluation_score: evaluation.nota_final } : o
          ))
        }
      }

      setObjectionEvaluation(evaluation)
      setShowObjectionEvaluationModal(true)

      // Limpar flag de edição após avaliação bem-sucedida
      setEditedObjectionIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(objection.id)
        return newSet
      })

    } catch (error) {
      console.error('💥 Erro ao avaliar objeção:', error)
      alert('Erro ao conectar com o serviço de avaliação')
    } finally {
      setEvaluatingObjection(false)
    }
  }

  // Funções para Objetivos de Roleplay
  const handleAddObjective = async () => {
    if (!newObjectiveName.trim()) {
      showToast('warning', 'Preencha o nome do objetivo')
      return
    }

    if (!newObjectiveDescription.trim()) {
      showToast('warning', 'Preencha a descrição do objetivo')
      return
    }

    const objective = await addRoleplayObjective(newObjectiveName.trim(), newObjectiveDescription.trim())
    if (objective) {
      setObjectives([...objectives, objective])
      setNewObjectiveName('')
      setNewObjectiveDescription('')
      showToast('success', 'Objetivo criado com sucesso')
    } else {
      showToast('error', 'Erro ao criar objetivo')
    }
  }

  const handleUpdateObjective = async (id: string) => {
    if (!editingObjectiveName.trim()) {
      showToast('warning', 'Preencha o nome do objetivo')
      return
    }

    if (!editingObjectiveDescription.trim()) {
      showToast('warning', 'Preencha a descrição do objetivo')
      return
    }

    const success = await updateRoleplayObjective(id, editingObjectiveName.trim(), editingObjectiveDescription.trim())
    if (success) {
      setObjectives(objectives.map(o =>
        o.id === id
          ? { ...o, name: editingObjectiveName.trim(), description: editingObjectiveDescription.trim() }
          : o
      ))
      setEditingObjectiveId(null)
      setEditingObjectiveName('')
      setEditingObjectiveDescription('')
      showToast('success', 'Objetivo atualizado')
    } else {
      showToast('error', 'Erro ao atualizar objetivo')
    }
  }

  const handleDeleteObjective = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este objetivo?')) return

    const success = await deleteRoleplayObjective(id)
    if (success) {
      setObjectives(objectives.filter(o => o.id !== id))
      showToast('success', 'Objetivo excluído')
    } else {
      showToast('error', 'Erro ao excluir objetivo')
    }
  }

  const startEditingObjective = (objective: RoleplayObjective) => {
    setEditingObjectiveId(objective.id)
    setEditingObjectiveName(objective.name)
    setEditingObjectiveDescription(objective.description || '')
  }

  const cancelEditingObjective = () => {
    setEditingObjectiveId(null)
    setEditingObjectiveName('')
    setEditingObjectiveDescription('')
  }

  // Funções para Fases do Funil
  const handleAddFunnelStage = async () => {
    if (!newStageName.trim()) {
      showToast('warning', 'Preencha o nome da fase')
      return
    }

    const stage = await addFunnelStage(newStageName.trim(), newStageDescription.trim(), newStageObjective.trim())
    if (stage) {
      setFunnelStages([...funnelStages, stage])
      setNewStageName('')
      setNewStageDescription('')
      setNewStageObjective('')
      showToast('success', 'Fase criada com sucesso')
    } else {
      showToast('error', 'Erro ao criar fase')
    }
  }

  const handleUpdateFunnelStage = async (id: string) => {
    if (!editStageName.trim()) {
      showToast('warning', 'Preencha o nome da fase')
      return
    }

    const success = await updateFunnelStage(id, editStageName.trim(), editStageDescription.trim(), editStageObjective.trim())
    if (success) {
      setFunnelStages(funnelStages.map(s =>
        s.id === id
          ? { ...s, stage_name: editStageName.trim(), description: editStageDescription.trim(), objective: editStageObjective.trim() }
          : s
      ))
      setEditingStage(null)
      setEditStageName('')
      setEditStageDescription('')
      setEditStageObjective('')
      showToast('success', 'Fase atualizada')
    } else {
      showToast('error', 'Erro ao atualizar fase')
    }
  }

  const handleDeleteFunnelStage = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fase?')) return

    const success = await deleteFunnelStage(id)
    if (success) {
      setFunnelStages(funnelStages.filter(s => s.id !== id))
      showToast('success', 'Fase excluída')
    } else {
      showToast('error', 'Erro ao excluir fase')
    }
  }

  const startEditingStage = (stage: FunnelStage) => {
    setEditingStage(stage.id)
    setEditStageName(stage.stage_name)
    setEditStageDescription(stage.description || '')
    setEditStageObjective(stage.objective || '')
  }

  const cancelEditingStage = () => {
    setEditingStage(null)
    setEditStageName('')
    setEditStageDescription('')
    setEditStageObjective('')
  }

  const handleDragEndFunnelStages = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = funnelStages.findIndex((stage) => stage.id === active.id)
    const newIndex = funnelStages.findIndex((stage) => stage.id === over.id)

    const newStages = arrayMove(funnelStages, oldIndex, newIndex)

    // Atualizar ordem localmente primeiro (feedback instantâneo)
    setFunnelStages(newStages)

    // Atualizar ordem no banco de dados
    const stagesWithNewOrder = newStages.map((stage, index) => ({
      id: stage.id,
      stage_order: index
    }))

    const success = await updateFunnelStageOrder(stagesWithNewOrder)
    if (!success) {
      // Se falhar, reverter para ordem anterior
      setFunnelStages(funnelStages)
      showToast('error', 'Erro ao reordenar fases')
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const getQualityLabel = (score: number): string => {
    if (score >= 95) return 'Perfeito'
    if (score >= 80) return 'Ótimo'
    if (score >= 60) return 'Suficiente'
    if (score >= 40) return 'Ok'
    if (score >= 20) return 'Ruim'
    return 'Insuficiente'
  }

  const handleEvaluateQuality = async () => {
    setEvaluatingQuality(true)

    try {
      console.log('📊 Solicitando avaliação de qualidade dos dados da empresa...')

      // Validar se há dados preenchidos
      if (!companyData.nome || !companyData.descricao) {
        alert('Preencha pelo menos o nome e descrição da empresa antes de avaliar.')
        setEvaluatingQuality(false)
        return
      }

      // Montar formulário completo como texto único
      const formularioTexto = `
DADOS RECEBIDOS DO FORMULÁRIO:

1. Qual é o nome da empresa?
${companyData.nome || '(não preenchido)'}

2. Em uma frase simples e objetiva, como você descreveria o que a empresa faz?
${companyData.descricao || '(não preenchido)'}

3. Quais são os produtos ou serviços principais da empresa?
${companyData.produtos_servicos || '(não preenchido)'}

4. O que cada produto faz na prática (função real e verificável)?
${companyData.funcao_produtos || '(não preenchido)'}

5. Quais são os diferenciais reais da empresa em relação aos concorrentes?
${companyData.diferenciais || '(não preenchido)'}

6. Quais empresas são consideradas concorrentes diretas?
${companyData.concorrentes || '(não preenchido)'}

7. Quais dados, resultados ou números podem ser citados com segurança (ex: quantidade de clientes, crescimento, métricas reais)?
${companyData.dados_metricas || '(não preenchido)'}

8. Quais informações ou pontos o vendedor costuma confundir, exagerar ou citar de forma incorreta sobre a empresa ou produto?
${companyData.erros_comuns || '(não preenchido)'}

9. Como a empresa deseja ser percebida pelos clientes (ex: acessível, premium, inovadora, consultiva, simples, tradicional etc.)?
${companyData.percepcao_desejada || '(não preenchido)'}

10. Quais dores a empresa resolve para seus clientes?
${companyData.dores_resolvidas || '(não preenchido)'}
`.trim()

      const response = await fetch('https://ezboard.app.n8n.cloud/webhook/avaliar-documento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formulario: formularioTexto
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Resposta recebida do N8N:', result)

        let evaluation

        // O N8N pode retornar de 3 formas diferentes:
        // 1. Objeto com propriedade 'output' contendo string JSON
        // 2. Diretamente o objeto com nota_final
        // 3. String JSON pura

        if (result.output) {
          // Caso 1: Tem propriedade output
          try {
            if (typeof result.output === 'string') {
              evaluation = JSON.parse(result.output)
            } else {
              evaluation = result.output
            }
            console.log('✅ Avaliação extraída do output:', evaluation)
          } catch (parseError) {
            console.error('❌ Erro ao fazer parse do output:', parseError)
            console.error('Output recebido:', result.output)
            throw new Error('Erro ao processar resposta do servidor')
          }
        } else if (result.nota_final) {
          // Caso 2: Objeto direto
          evaluation = result
          console.log('✅ Avaliação recebida diretamente:', evaluation)
        } else if (typeof result === 'string') {
          // Caso 3: String JSON
          try {
            evaluation = JSON.parse(result)
            console.log('✅ Avaliação parseada de string:', evaluation)
          } catch (parseError) {
            console.error('❌ Erro ao fazer parse da string:', parseError)
            throw new Error('Erro ao processar resposta do servidor')
          }
        } else {
          console.error('❌ Formato de resposta inesperado:', result)
          throw new Error('Formato de resposta inesperado')
        }

        // Verificar se a avaliação tem os campos esperados
        if (!evaluation.nota_final || !evaluation.classificacao) {
          console.error('❌ Resposta sem campos obrigatórios:', evaluation)
          throw new Error('Resposta incompleta do servidor')
        }

        console.log('✅ Avaliação final processada:', evaluation)

        // Salvar avaliação no Supabase
        if (companyDataId) {
          try {
            const { supabase } = await import('@/lib/supabase')
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
              const { error: saveError } = await supabase
                .from('company_data_evaluations')
                .insert({
                  user_id: user.id,
                  company_data_id: companyDataId,
                  nota_final: evaluation.nota_final,
                  classificacao: evaluation.classificacao,
                  pode_usar: evaluation.pode_usar,
                  capacidade_roleplay: evaluation.capacidade_roleplay,
                  resumo: evaluation.resumo,
                  pontos_fortes: evaluation.pontos_fortes || [],
                  principais_gaps: evaluation.principais_gaps || [],
                  campos_criticos_vazios: evaluation.campos_criticos_vazios || [],
                  proxima_acao: evaluation.proxima_acao,
                  recomendacao_uso: evaluation.recomendacao_uso
                })

              if (saveError) {
                console.error('❌ Erro ao salvar avaliação no banco:', saveError)
              } else {
                console.log('✅ Avaliação salva no banco de dados')
              }
            }
          } catch (saveError) {
            console.error('💥 Erro ao salvar avaliação:', saveError)
          }
        }

        setQualityEvaluation(evaluation)
        setShowCompanyEvaluationModal(true)
        setCompanyDataEdited(false) // Resetar flag de edição após avaliar
      } else {
        const errorText = await response.text()
        console.error('❌ Erro ao avaliar qualidade:', response.status, errorText)
        alert(`Erro ao avaliar qualidade dos arquivos (${response.status})`)
      }
    } catch (error) {
      console.error('💥 Erro ao avaliar qualidade:', error)
      alert('Erro ao conectar com o serviço de avaliação')
    } finally {
      setEvaluatingQuality(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs - Redesenhadas */}
      <div className="flex gap-2 pb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('employees')}
          className={`group px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap border-2 ${
            activeTab === 'employees'
              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              : 'bg-transparent text-gray-400 hover:text-gray-200 border-green-500/30 hover:border-green-500/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Funcionários</span>
        </button>
        <button
          onClick={() => setActiveTab('personas')}
          className={`group px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap border-2 ${
            activeTab === 'personas'
              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              : 'bg-transparent text-gray-400 hover:text-gray-200 border-green-500/30 hover:border-green-500/50'
          }`}
        >
          <UserCircle2 className="w-4 h-4" />
          <span>Personas</span>
        </button>
        <button
          onClick={() => setActiveTab('objections')}
          className={`group px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap border-2 ${
            activeTab === 'objections'
              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              : 'bg-transparent text-gray-400 hover:text-gray-200 border-green-500/30 hover:border-green-500/50'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Objeções</span>
        </button>
        <button
          onClick={() => setActiveTab('objectives')}
          className={`group px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap border-2 ${
            activeTab === 'objectives'
              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              : 'bg-transparent text-gray-400 hover:text-gray-200 border-green-500/30 hover:border-green-500/50'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Objetivos</span>
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`group px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap border-2 ${
            activeTab === 'files'
              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              : 'bg-transparent text-gray-400 hover:text-gray-200 border-green-500/30 hover:border-green-500/50'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Dados da Empresa</span>
        </button>
        <button
          onClick={() => setActiveTab('funnel')}
          className={`group px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap border-2 ${
            activeTab === 'funnel'
              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
              : 'bg-transparent text-gray-400 hover:text-gray-200 border-green-500/30 hover:border-green-500/50'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Fases do Funil</span>
        </button>
      </div>

      {/* Content */}
      <div className="py-4">
        {/* Funcionários Tab */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-4">Gerenciar Funcionários</h3>

              {/* Lista de funcionários */}
              {employees.length > 0 && (
                <div className="mb-6 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-green-500/20">
                        <th className="pb-3 text-sm font-medium text-gray-400">Nome</th>
                        <th className="pb-3 text-sm font-medium text-gray-400">Email</th>
                        <th className="pb-3 text-sm font-medium text-gray-400">Cargo/Role</th>
                        <th className="pb-3 text-sm font-medium text-gray-400">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id} className="border-b border-green-500/10">
                          <td className="py-3 text-sm text-gray-300">{emp.name}</td>
                          <td className="py-3 text-sm text-gray-300">{emp.email}</td>
                          <td className="py-3">
                            <select
                              value={emp.role || 'Vendedor'}
                              onChange={(e) => handleRoleChange(emp.id, e.target.value)}
                              className="px-3 py-1.5 bg-gray-800/50 border border-green-500/20 rounded-lg text-sm text-white focus:outline-none focus:border-green-500/40"
                            >
                              <option value="Admin">Admin</option>
                              <option value="Vendedor">Vendedor</option>
                            </select>
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => handleDeleteEmployee(emp.id, emp.email)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Adicionar novo funcionário */}
              {!addingEmployee ? (
                <button
                  onClick={() => setAddingEmployee(true)}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-medium hover:scale-105 transition-transform flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Funcionário
                </button>
              ) : (
                <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-6">
                  <h4 className="text-lg font-semibold mb-4">Novo Funcionário</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
                      <input
                        type="text"
                        value={newEmployeeName}
                        onChange={(e) => setNewEmployeeName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40"
                        placeholder="João Silva"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                      <input
                        type="email"
                        value={newEmployeeEmail}
                        onChange={(e) => setNewEmployeeEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40"
                        placeholder="joao@empresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={newEmployeePassword}
                          onChange={(e) => setNewEmployeePassword(e.target.value)}
                          className="w-full px-4 py-3 pr-12 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-green-400 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setAddingEmployee(false)
                          setShowPassword(false)
                        }}
                        className="flex-1 px-6 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl font-medium hover:bg-gray-700/50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveEmployee}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-medium hover:scale-105 transition-transform"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Personas Tab */}
        {activeTab === 'personas' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold">Personas {businessType === 'Ambos' ? 'B2B e B2C' : businessType}</h3>
                  {/* Contador de Personas */}
                  <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    personaLimitReached
                      ? 'bg-red-900/30 border border-red-500/40 text-red-400'
                      : trainingPlan === 'pro'
                      ? 'bg-yellow-900/30 border border-yellow-500/40 text-yellow-400'
                      : 'bg-green-900/30 border border-green-500/40 text-green-400'
                  }`}>
                    {planUsage?.training?.personas?.used || personas.length || 0}/{planUsage?.training?.personas?.limit || '∞'} personas
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Filtro por Tag */}
                  {tags.length > 0 && (
                    <select
                      value={filterTag}
                      onChange={(e) => setFilterTag(e.target.value)}
                      className="px-4 py-2 bg-gray-800/50 border border-green-500/20 rounded-xl text-white focus:outline-none focus:border-green-500/40"
                    >
                      <option value="">Todas as etiquetas</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => {
                      if (!personaLimitReached) {
                        setShowPersonaForm(true)
                        setNewPersona({})
                        setEditingPersonaId(null)
                        setSelectedPersonaTags([])
                      }
                    }}
                    disabled={personaLimitReached}
                    className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
                      personaLimitReached
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                        : 'bg-gradient-to-r from-green-600 to-green-500 hover:scale-105'
                    }`}
                    title={personaLimitReached ? `Limite de ${planUsage?.training?.personas?.used || 0} personas atingido no plano PRO` : ''}
                  >
                    {personaLimitReached ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {personaLimitReached
                      ? `Limite Atingido (${planUsage?.training?.personas?.used || 0}/${planUsage?.training?.personas?.limit || 3})`
                      : `Nova Persona ${businessType}`
                    }
                  </button>
                </div>
              </div>

              {/* Aviso de Qualidade */}
              <div className="mb-4 bg-red-900/20 border border-red-500/40 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 leading-relaxed">
                      <span className="font-bold">Atenção:</span> Personas com pontuação abaixo de 7.0 podem comprometer a eficiência e o realismo dos roleplays de vendas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Seção de Gerenciar Etiquetas */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                    <TagIcon className="w-5 h-5 text-green-400" />
                    Etiquetas
                  </h4>
                  {!showTagForm && (
                    <button
                      onClick={() => setShowTagForm(true)}
                      className="px-4 py-2 bg-gray-800/50 border border-green-500/20 rounded-lg text-sm font-medium hover:bg-gray-800/70 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-3 h-3" />
                      Nova Etiqueta
                    </button>
                  )}
                </div>

                {/* Formulário para adicionar nova etiqueta */}
                {showTagForm && (
                  <div className="mb-4 bg-gray-900/50 border border-green-500/20 rounded-xl p-4 space-y-3">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Nome da etiqueta"
                      className="w-full px-3 py-2 bg-gray-800/50 border border-green-500/20 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40"
                    />

                    <div>
                      <p className="text-xs text-gray-400 mb-2">Escolha uma cor:</p>
                      <div className="grid grid-cols-6 gap-2">
                        {tagColorPalette.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setNewTagColor(color)}
                            className={`w-10 h-10 rounded-lg transition-all ${
                              newTagColor === color
                                ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900 scale-110'
                                : 'hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleCreateTag}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 rounded-lg text-sm font-medium hover:scale-105 transition-transform"
                      >
                        Criar Etiqueta
                      </button>
                      <button
                        onClick={() => {
                          setShowTagForm(false)
                          setNewTagName('')
                          setNewTagColor('#6B46C1')
                        }}
                        className="px-4 py-2 bg-gray-800/50 border border-green-500/20 rounded-lg text-sm font-medium hover:bg-gray-800/70 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de etiquetas existentes */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white transition-all hover:ring-2 hover:ring-offset-2 hover:ring-offset-gray-900"
                        style={{
                          backgroundColor: tag.color,
                          ...(editingTagId === tag.id && { ringColor: tag.color })
                        }}
                      >
                        {editingTagId === tag.id ? (
                          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
                            setEditingTagId(null)
                            setEditingTagName('')
                            setEditingTagColor('')
                          }}>
                            <div className="bg-gray-900 border border-green-500/30 rounded-xl p-5 w-80 space-y-4" onClick={(e) => e.stopPropagation()}>
                              <h4 className="text-lg font-semibold text-white">Editar Etiqueta</h4>

                              <input
                                type="text"
                                value={editingTagName}
                                onChange={(e) => setEditingTagName(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-green-500/20 rounded-lg text-sm text-white placeholder-white/60 focus:outline-none focus:border-green-500/40"
                                autoFocus
                              />

                              <div>
                                <p className="text-xs text-gray-400 mb-2">Escolha uma cor:</p>
                                <div className="grid grid-cols-6 gap-2">
                                  {tagColorPalette.map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => setEditingTagColor(color)}
                                      className={`w-10 h-10 rounded-lg transition-all ${
                                        editingTagColor === color
                                          ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900 scale-110'
                                          : 'hover:scale-105'
                                      }`}
                                      style={{ backgroundColor: color }}
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleUpdateTag(tag.id)}
                                  className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 rounded-lg text-sm font-medium hover:scale-105 transition-transform"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingTagId(null)
                                    setEditingTagName('')
                                    setEditingTagColor('')
                                  }}
                                  className="px-4 py-2 bg-gray-800/50 border border-green-500/20 rounded-lg text-sm font-medium hover:bg-gray-800/70 transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span>{tag.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingTagId(tag.id)
                                  setEditingTagName(tag.name)
                                  setEditingTagColor(tag.color)
                                }}
                                className="text-white/80 hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteTag(tag.id)}
                                className="text-white/80 hover:text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {tags.length === 0 && !showTagForm && (
                  <p className="text-gray-400 text-sm">Nenhuma etiqueta criada ainda. Crie etiquetas para organizar suas personas.</p>
                )}
              </div>

              {/* Lista de personas */}
              {!showPersonaForm && personas.filter(p => {
                // Filtrar por tipo de negócio
                if (businessType === 'Ambos') {
                  // Se "Ambos" está selecionado, mostrar tanto B2B quanto B2C
                  if (p.business_type !== 'B2B' && p.business_type !== 'B2C') return false
                } else {
                  // Caso contrário, filtrar pelo tipo específico
                  if (p.business_type !== businessType) return false
                }

                // Filtrar por tag se selecionada
                if (filterTag && p.id) {
                  const personaTagIds = personaTags.get(p.id) || []
                  if (!personaTagIds.includes(filterTag)) return false
                }

                return true
              }).length > 0 && (
                <div className="mb-4 space-y-4">
                  {personas.filter(p => {
                    // Filtrar por tipo de negócio
                    if (businessType === 'Ambos') {
                      // Se "Ambos" está selecionado, mostrar tanto B2B quanto B2C
                      if (p.business_type !== 'B2B' && p.business_type !== 'B2C') return false
                    } else {
                      // Caso contrário, filtrar pelo tipo específico
                      if (p.business_type !== businessType) return false
                    }

                    // Filtrar por tag se selecionada
                    if (filterTag && p.id) {
                      const personaTagIds = personaTags.get(p.id) || []
                      if (!personaTagIds.includes(filterTag)) return false
                    }

                    return true
                  }).map((persona) => (
                    <div
                      key={persona.id}
                      className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 border border-green-500/30 rounded-xl p-5 hover:border-green-500/50 transition-all shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Título */}
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center flex-shrink-0">
                              <UserCircle2 className="w-7 h-7 text-white" />
                            </div>
                            <h4 className="text-lg font-bold text-white">
                              {persona.business_type === 'B2B'
                                ? (persona as PersonaB2B).job_title
                                : (persona as PersonaB2C).profession}
                            </h4>
                          </div>

                          {/* Conteúdo B2B */}
                          {persona.business_type === 'B2B' && (
                            <div className="space-y-2 pl-15">
                              {(persona as PersonaB2B).company_type && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-green-400">Tipo de Empresa:</span>{' '}
                                  {(persona as PersonaB2B).company_type}
                                </p>
                              )}
                              {(persona as PersonaB2B).company_goals && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-green-400">Busca:</span>{' '}
                                  {(persona as PersonaB2B).company_goals}
                                </p>
                              )}
                              {(persona as PersonaB2B).business_challenges && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-green-400">Desafios:</span>{' '}
                                  {(persona as PersonaB2B).business_challenges}
                                </p>
                              )}
                              {(persona as PersonaB2B).prior_knowledge && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-green-400">Conhecimento prévio:</span>{' '}
                                  {(persona as PersonaB2B).prior_knowledge}
                                </p>
                              )}
                              {(persona as PersonaB2B).context && (
                                <p className="text-sm text-gray-400 italic mt-2 pt-2 border-t border-green-500/20">
                                  {(persona as PersonaB2B).context}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Conteúdo B2C */}
                          {persona.business_type === 'B2C' && (
                            <div className="space-y-2 pl-15">
                              {(persona as PersonaB2C).what_seeks && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-green-400">Busca:</span>{' '}
                                  {(persona as PersonaB2C).what_seeks}
                                </p>
                              )}
                              {(persona as PersonaB2C).main_pains && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-green-400">Dores:</span>{' '}
                                  {(persona as PersonaB2C).main_pains}
                                </p>
                              )}
                              {(persona as PersonaB2C).prior_knowledge && (
                                <p className="text-sm text-gray-300 leading-relaxed">
                                  <span className="font-bold text-green-400">Conhecimento prévio:</span>{' '}
                                  {(persona as PersonaB2C).prior_knowledge}
                                </p>
                              )}
                              {(persona as PersonaB2C).context && (
                                <p className="text-sm text-gray-400 italic mt-2 pt-2 border-t border-green-500/20">
                                  {(persona as PersonaB2C).context}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Tags da Persona */}
                          {persona.id && personaTags.get(persona.id) && personaTags.get(persona.id)!.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {personaTags.get(persona.id)?.map(tagId => {
                                const tag = tags.find(t => t.id === tagId)
                                if (!tag) return null
                                return (
                                  <span
                                    key={tag.id}
                                    className="px-3 py-1 rounded-full text-xs font-medium text-white"
                                    style={{ backgroundColor: tag.color }}
                                  >
                                    {tag.name}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Botões de ação */}
                        <div className="flex gap-2 flex-shrink-0 items-center">
                          {/* Score da avaliação */}
                          {persona.evaluation_score !== undefined && persona.evaluation_score !== null && (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-green-900/30 border border-green-500/40 rounded-lg">
                              <span className="text-xs text-green-300 font-medium">Nota:</span>
                              <span className="text-lg font-bold text-green-400">{persona.evaluation_score.toFixed(1)}</span>
                            </div>
                          )}

                          <button
                            onClick={() => handleEvaluatePersona(persona)}
                            disabled={evaluatingPersona || (persona.evaluation_score !== undefined && persona.evaluation_score !== null && !editedPersonaIds.has(persona.id!))}
                            className={`px-4 py-2 rounded-lg font-medium text-white hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 ${
                              editedPersonaIds.has(persona.id!)
                                ? 'bg-gradient-to-r from-green-500 to-green-400 shadow-green-500/30'
                                : 'bg-gradient-to-r from-green-500 to-green-400 shadow-green-500/30'
                            }`}
                            title={
                              persona.evaluation_score !== undefined && persona.evaluation_score !== null && !editedPersonaIds.has(persona.id!)
                                ? 'Edite a persona para poder reavaliá-la'
                                : editedPersonaIds.has(persona.id!)
                                ? 'Reavaliar persona após edição'
                                : 'Avaliar persona'
                            }
                          >
                            {evaluatingPersona && <Loader2 className="w-4 h-4 animate-spin" />}
                            {evaluatingPersona
                              ? 'AVALIANDO...'
                              : editedPersonaIds.has(persona.id!)
                              ? 'REAVALIAR PERSONA'
                              : 'AVALIAR PERSONA'}
                          </button>
                          <button
                            onClick={async () => {
                              setEditingPersonaId(persona.id!)
                              setNewPersona(persona)
                              setShowPersonaForm(true)
                              // Carregar tags da persona
                              if (persona.id) {
                                const tags = personaTags.get(persona.id) || []
                                setSelectedPersonaTags(tags)
                              }
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-2 rounded-lg transition-all"
                            title="Editar persona"
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeletePersona(persona.id!)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                            title="Deletar persona"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulário de Nova/Editar Persona */}
              {showPersonaForm && (
                <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold">
                      {editingPersonaId ? 'Editar' : 'Nova'} Persona {businessType === 'Ambos' ? selectedPersonaType : businessType}
                    </h4>
                    <button
                      onClick={() => {
                        setShowPersonaForm(false)
                        setNewPersona({})
                        setEditingPersonaId(null)
                        setSelectedPersonaTags([])
                      }}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Selector de tipo quando businessType é "Ambos" */}
                  {businessType === 'Ambos' && !editingPersonaId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Tipo de Persona
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            setSelectedPersonaType('B2B')
                            setNewPersona({})
                          }}
                          className={`px-4 py-3 rounded-xl font-medium transition-all ${
                            selectedPersonaType === 'B2B'
                              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                              : 'bg-gray-800/50 border border-green-500/20 text-gray-400 hover:border-green-500/40'
                          }`}
                        >
                          B2B
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPersonaType('B2C')
                            setNewPersona({})
                          }}
                          className={`px-4 py-3 rounded-xl font-medium transition-all ${
                            selectedPersonaType === 'B2C'
                              ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                              : 'bg-gray-800/50 border border-green-500/20 text-gray-400 hover:border-green-500/40'
                          }`}
                        >
                          B2C
                        </button>
                      </div>
                    </div>
                  )}

                  {(businessType === 'B2B' || (businessType === 'Ambos' && selectedPersonaType === 'B2B')) ? (
                    <>
                      {/* Formulário B2B */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Cargo *
                        </label>
                        <input
                          type="text"
                          value={(newPersona as PersonaB2B).job_title || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, job_title: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40"
                          placeholder="Ex: Gerente de Compras, CEO, Diretor de TI"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Tipo de Empresa e Faturamento
                        </label>
                        <input
                          type="text"
                          value={(newPersona as PersonaB2B).company_type || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, company_type: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40"
                          placeholder="Ex: Startup de tecnologia com faturamento de R$500k/mês"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Contexto (descrição livre)
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2B).context || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, context: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 min-h-[80px]"
                          placeholder="Ex: Responsável por decisões de compra, equipe de 10 pessoas, busca inovação"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          O que busca para a empresa?
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2B).company_goals || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, company_goals: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 min-h-[80px]"
                          placeholder="Ex: Aumentar eficiência, reduzir custos, melhorar processos, escalar o negócio"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Principais desafios/dores do negócio
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2B).business_challenges || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, business_challenges: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 min-h-[80px]"
                          placeholder="Ex: Processos manuais demorados, falta de integração, dificuldade em medir resultados"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          O que a persona já sabe sobre a sua empresa e seus serviços?
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2B).prior_knowledge || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, prior_knowledge: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 min-h-[80px]"
                          placeholder="Ex: Já conhece a empresa por indicação, viu anúncio online, não sabe nada ainda"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Formulário B2C */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Profissão *
                        </label>
                        <input
                          type="text"
                          value={(newPersona as PersonaB2C).profession || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, profession: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40"
                          placeholder="Ex: Professor, Médico, Estudante"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Contexto (descrição livre)
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2C).context || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, context: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 min-h-[80px]"
                          placeholder="Ex: Mãe de 2 filhos, mora em apartamento, trabalha home office"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          O que busca/valoriza?
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2C).what_seeks || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, what_seeks: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 min-h-[80px]"
                          placeholder="Ex: Praticidade, economia de tempo, produtos de qualidade, bom atendimento"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Principais dores/problemas
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2C).main_pains || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, main_pains: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 min-h-[80px]"
                          placeholder="Ex: Falta de tempo, dificuldade em encontrar produtos confiáveis, preços altos"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          O que a persona já sabe sobre a sua empresa e seus serviços?
                        </label>
                        <textarea
                          value={(newPersona as PersonaB2C).prior_knowledge || ''}
                          onChange={(e) => setNewPersona({ ...newPersona, prior_knowledge: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 min-h-[80px]"
                          placeholder="Ex: Já conhece a empresa por indicação, viu anúncio online, não sabe nada ainda"
                        />
                      </div>
                    </>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-sm text-blue-300">
                    <strong>Lembre-se:</strong> Nome, idade, temperamento e objeções serão configurados antes de iniciar cada roleplay.
                  </div>

                  {/* Seletor de Tags */}
                  {tags.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Etiqueta (opcional - apenas uma por persona)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (selectedPersonaTags.includes(tag.id)) {
                                setSelectedPersonaTags([])
                              } else {
                                setSelectedPersonaTags([tag.id])
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                              selectedPersonaTags.includes(tag.id)
                                ? 'text-white ring-2 ring-offset-2 ring-offset-gray-900'
                                : 'text-white opacity-60 hover:opacity-100'
                            }`}
                            style={{
                              backgroundColor: tag.color,
                              ...(selectedPersonaTags.includes(tag.id) && {
                                ringColor: tag.color
                              })
                            }}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowPersonaForm(false)
                        setNewPersona({})
                        setEditingPersonaId(null)
                        setSelectedPersonaTags([])
                      }}
                      className="flex-1 px-6 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl font-medium hover:border-green-500/40 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSavePersona}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-medium hover:scale-105 transition-transform"
                    >
                      {editingPersonaId ? 'Atualizar' : 'Salvar'} Persona
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Objeções Tab */}
        {activeTab === 'objections' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold">Principais Objeções</h3>
                  {/* Contador de Objeções */}
                  <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    objectionLimitReached
                      ? 'bg-red-900/30 border border-red-500/40 text-red-400'
                      : trainingPlan === 'pro'
                      ? 'bg-yellow-900/30 border border-yellow-500/40 text-yellow-400'
                      : 'bg-green-900/30 border border-green-500/40 text-green-400'
                  }`}>
                    {planUsage?.training?.objections?.used || objections.length || 0}/{planUsage?.training?.objections?.limit || '∞'} objeções
                  </div>
                </div>
              </div>
              <p className="text-gray-400 mb-6 text-sm">
                Registre objeções comuns e adicione múltiplas formas de quebrá-las para cada uma.
              </p>

              {/* Aviso de Qualidade */}
              <div className="mb-4 bg-red-900/20 border border-red-500/40 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 leading-relaxed">
                      <span className="font-bold">Atenção:</span> Objeções com pontuação abaixo de 7.0 podem comprometer a qualidade e a eficácia do treinamento de vendas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de objeções */}
              {objections.length > 0 && (
                <div className="mb-4 space-y-3">
                  {objections.map((objection) => (
                    <div
                      key={objection.id}
                      className="bg-gray-900/50 border border-green-500/20 rounded-xl overflow-hidden"
                    >
                      {/* Header da objeção */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 flex-1">
                          <button
                            onClick={() => toggleObjectionExpanded(objection.id)}
                            className="text-green-400 hover:text-green-300 transition-colors"
                          >
                            <svg
                              className={`w-5 h-5 transform transition-transform ${expandedObjections.has(objection.id) ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <div className="flex-1 flex items-center gap-2">
                            {editingObjectionName === objection.id ? (
                              <>
                                <input
                                  type="text"
                                  value={tempObjectionName}
                                  onChange={(e) => setTempObjectionName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateObjectionName(objection.id)
                                    } else if (e.key === 'Escape') {
                                      setEditingObjectionName(null)
                                      setTempObjectionName('')
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 bg-gray-800/50 border border-green-500/30 rounded text-white text-sm focus:outline-none focus:border-green-500"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleUpdateObjectionName(objection.id)}
                                  className="text-green-400 hover:text-green-300 transition-colors"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingObjectionName(null)
                                    setTempObjectionName('')
                                  }}
                                  className="text-gray-400 hover:text-gray-300 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-gray-300 font-medium">{objection.name}</span>
                                <button
                                  onClick={() => {
                                    setEditingObjectionName(objection.id)
                                    setTempObjectionName(objection.name)
                                  }}
                                  className="text-green-400 hover:text-green-300 transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <span className="text-gray-500 text-sm">
                                  ({objection.rebuttals?.length || 0} {objection.rebuttals?.length === 1 ? 'forma de quebra' : 'formas de quebra'})
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Score Badge */}
                          {objection.evaluation_score !== null && objection.evaluation_score !== undefined && (
                            <div className={`px-2 py-1 rounded text-xs font-bold ${
                              objection.evaluation_score >= 7 ? 'bg-green-600/20 text-green-400' :
                              objection.evaluation_score >= 4 ? 'bg-yellow-600/20 text-yellow-400' :
                              'bg-red-600/20 text-red-400'
                            }`}>
                              {objection.evaluation_score.toFixed(1)}
                            </div>
                          )}

                          <button
                            onClick={() => handleEvaluateObjection(objection)}
                            disabled={evaluatingObjection || (objection.evaluation_score !== null && objection.evaluation_score !== undefined && !editedObjectionIds.has(objection.id))}
                            className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg text-xs font-medium text-green-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                              objection.evaluation_score !== null && objection.evaluation_score !== undefined && !editedObjectionIds.has(objection.id)
                                ? 'Edite a objeção para poder reavaliar'
                                : ''
                            }
                          >
                            {evaluatingObjection ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              objection.evaluation_score !== null && objection.evaluation_score !== undefined ? 'REAVALIAR' : 'AVALIAR'
                            )}
                          </button>
                          <button
                            onClick={() => handleRemoveObjection(objection.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Conteúdo expandido */}
                      {expandedObjections.has(objection.id) && (
                        <div className="border-t border-green-500/20 px-4 py-3 space-y-3 bg-gray-800/30">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium text-gray-400">Formas de Quebrar:</h4>
                              {/* Contador de formas de quebrar */}
                              <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                                trainingPlan === 'pro' && objection.rebuttals?.length >= 3
                                  ? 'bg-red-900/30 border border-red-500/40 text-red-400'
                                  : trainingPlan === 'pro'
                                  ? 'bg-yellow-900/30 border border-yellow-500/40 text-yellow-400'
                                  : 'bg-green-900/30 border border-green-500/40 text-green-400'
                              }`}>
                                {objection.rebuttals?.length || 0}/{trainingPlan === 'pro' ? '3' : '∞'}
                              </div>
                            </div>

                            {/* Lista de rebuttals */}
                            {objection.rebuttals && objection.rebuttals.length > 0 ? (
                              <div className="space-y-2 mb-3">
                                {objection.rebuttals.map((rebuttal, index) => {
                                  // Garantir que rebuttal é string
                                  const rebuttalText = typeof rebuttal === 'string' ? rebuttal : String(rebuttal)

                                  return (
                                  <div
                                    key={index}
                                    className="flex items-start gap-2 bg-gray-900/50 border border-green-500/10 rounded-lg px-3 py-2"
                                  >
                                    <span className="text-green-400 font-bold text-sm mt-0.5">{index + 1}.</span>
                                    {editingRebuttalId?.objectionId === objection.id && editingRebuttalId?.index === index ? (
                                      <>
                                        <input
                                          type="text"
                                          value={tempRebuttalText}
                                          onChange={(e) => setTempRebuttalText(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              handleUpdateRebuttal(objection.id, index)
                                            } else if (e.key === 'Escape') {
                                              setEditingRebuttalId(null)
                                              setTempRebuttalText('')
                                            }
                                          }}
                                          className="flex-1 px-2 py-1 bg-gray-800/50 border border-green-500/30 rounded text-white text-sm focus:outline-none focus:border-green-500"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleUpdateRebuttal(objection.id, index)}
                                          className="text-green-400 hover:text-green-300 transition-colors"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingRebuttalId(null)
                                            setTempRebuttalText('')
                                          }}
                                          className="text-gray-400 hover:text-gray-300 transition-colors"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-gray-300 text-sm flex-1">{rebuttalText}</span>
                                        <button
                                          onClick={() => {
                                            setEditingRebuttalId({ objectionId: objection.id, index })
                                            setTempRebuttalText(rebuttalText)
                                          }}
                                          className="text-green-400 hover:text-green-300 transition-colors"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleRemoveRebuttal(objection.id, index)}
                                          className="text-red-400 hover:text-red-300 transition-colors"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )})}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm mb-3 italic">Nenhuma forma de quebra registrada ainda.</p>
                            )}

                            {/* Adicionar nova forma de quebra */}
                            {/* Verificar limite de formas de quebrar */}
                            {trainingPlan === 'pro' && objection.rebuttals?.length >= 3 ? (
                              <div className="bg-yellow-900/20 border border-yellow-500/40 rounded-lg p-2 flex items-center gap-2">
                                <Lock className="w-4 h-4 text-yellow-400" />
                                <span className="text-xs text-yellow-300">
                                  Limite de 3 formas de quebrar atingido - Plano PRO
                                </span>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editingObjectionId === objection.id ? newRebuttal : ''}
                                  onFocus={() => setEditingObjectionId(objection.id)}
                                  onChange={(e) => setNewRebuttal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !(trainingPlan === 'pro' && objection.rebuttals?.length >= 3)) {
                                      handleAddRebuttal(objection.id)
                                    }
                                  }}
                                  disabled={trainingPlan === 'pro' && objection.rebuttals?.length >= 3}
                                  className={`flex-1 px-3 py-2 bg-gray-800/50 border rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none ${
                                    trainingPlan === 'pro' && objection.rebuttals?.length >= 3
                                      ? 'border-gray-700 opacity-50 cursor-not-allowed'
                                      : 'border-green-500/20 focus:border-green-500/40'
                                  }`}
                                  placeholder={
                                    trainingPlan === 'pro' && objection.rebuttals?.length >= 3
                                      ? "Limite de formas de quebrar atingido"
                                      : "Ex: Apresentar cálculo de ROI detalhado mostrando retorno em 6 meses com base em cases reais do segmento"
                                  }
                                />
                                <button
                                  onClick={() => handleAddRebuttal(objection.id)}
                                  disabled={trainingPlan === 'pro' && objection.rebuttals?.length >= 3}
                                  className={`px-4 py-2 rounded-lg font-medium transition-transform text-sm ${
                                    trainingPlan === 'pro' && objection.rebuttals?.length >= 3
                                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                                      : 'bg-gradient-to-r from-green-600 to-green-500 hover:scale-105'
                                  }`}
                                  title={
                                    trainingPlan === 'pro' && objection.rebuttals?.length >= 3
                                      ? 'Limite de 3 formas de quebrar atingido no plano PRO'
                                      : ''
                                  }
                                >
                                  {trainingPlan === 'pro' && objection.rebuttals?.length >= 3 ? (
                                    <Lock className="w-4 h-4" />
                                  ) : (
                                    <Plus className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar nova objeção */}
              <div className="space-y-2">
                {/* Indicador de limite */}
                {objectionLimitReached && (
                  <div className="bg-yellow-900/20 border border-yellow-500/40 rounded-xl p-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-300">
                      Limite de objeções atingido ({planUsage?.training?.objections?.used || 0}/{planUsage?.training?.objections?.limit || 10}) - Plano PRO
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newObjection}
                    onChange={(e) => setNewObjection(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !objectionLimitReached && handleAddObjection()}
                    disabled={objectionLimitReached}
                    className={`flex-1 px-4 py-3 bg-gray-800/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none ${
                      objectionLimitReached
                        ? 'border-gray-700 opacity-50 cursor-not-allowed'
                        : 'border-green-500/20 focus:border-green-500/40'
                    }`}
                    placeholder={
                      objectionLimitReached
                        ? "Limite de objeções atingido no plano PRO"
                        : "Ex: Cliente diz que o preço está acima do orçamento disponível e questiona se terá ROI rápido o suficiente para justificar"
                    }
                  />
                  <button
                    onClick={handleAddObjection}
                    disabled={objectionLimitReached}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${
                      objectionLimitReached
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                        : 'bg-gradient-to-r from-green-600 to-green-500 hover:scale-105'
                    }`}
                    title={objectionLimitReached ? `Limite de ${planUsage?.training?.objections?.used || 0} objeções atingido no plano PRO` : ''}
                  >
                    {objectionLimitReached ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Objetivos de Roleplay Tab */}
        {activeTab === 'objectives' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-4">Objetivos de Roleplay</h3>
              <p className="text-gray-400 mb-6 text-sm">
                Defina os objetivos que os vendedores devem alcançar durante os roleplays (ex: marcar reunião, fechar venda, identificar necessidades).
              </p>

              {/* Formulário de novo objetivo */}
              <div className="mb-6 bg-gray-900/50 border border-green-500/20 rounded-xl p-4">
                <h4 className="text-sm font-bold text-green-400 mb-3">Adicionar Novo Objetivo</h4>
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={newObjectiveName}
                      onChange={(e) => setNewObjectiveName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddObjective()}
                      placeholder="Nome do objetivo (ex: Marcar próxima reunião)"
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                    />
                  </div>
                  <div>
                    <textarea
                      value={newObjectiveDescription}
                      onChange={(e) => setNewObjectiveDescription(e.target.value)}
                      placeholder="Descrição do objetivo"
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors resize-none"
                    />
                  </div>
                  <button
                    onClick={handleAddObjective}
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-green-500/20"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Adicionar Objetivo
                  </button>
                </div>
              </div>

              {/* Lista de objetivos */}
              {objectives.length > 0 ? (
                <div className="space-y-3">
                  {objectives.map((objective) => (
                    <div
                      key={objective.id}
                      className="bg-gray-900/50 border border-green-500/20 rounded-xl p-4"
                    >
                      {editingObjectiveId === objective.id ? (
                        // Modo de edição
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editingObjectiveName}
                            onChange={(e) => setEditingObjectiveName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateObjective(objective.id)
                              if (e.key === 'Escape') cancelEditingObjective()
                            }}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-green-500/30 rounded text-white text-sm focus:outline-none focus:border-green-500"
                            autoFocus
                          />
                          <textarea
                            value={editingObjectiveDescription}
                            onChange={(e) => setEditingObjectiveDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-green-500/30 rounded text-white text-sm focus:outline-none focus:border-green-500 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateObjective(objective.id)}
                              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition-colors"
                            >
                              <Check className="w-4 h-4 inline mr-1" />
                              Salvar
                            </button>
                            <button
                              onClick={cancelEditingObjective}
                              className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium transition-colors"
                            >
                              <X className="w-4 h-4 inline mr-1" />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Modo de visualização
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                              <h4 className="text-white font-medium">{objective.name}</h4>
                            </div>
                            {objective.description && (
                              <p className="text-gray-400 text-sm ml-6">{objective.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditingObjective(objective)}
                              className="p-2 text-gray-400 hover:text-green-400 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteObjective(objective.id)}
                              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-900/30 rounded-xl border border-green-500/10">
                  <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhum objetivo cadastrado ainda.</p>
                  <p className="text-gray-600 text-sm mt-1">Adicione objetivos acima para começar.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dados da Empresa Tab */}
        {activeTab === 'files' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-4">Dados da Empresa</h3>
              <p className="text-gray-400 mb-6">
                Preencha as informações sobre sua empresa para melhorar o treinamento da IA.
              </p>

              {/* Tipo de Empresa */}
              <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold mb-4">Tipo de Empresa</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Selecione o modelo de negócio da sua empresa
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleSetBusinessType('B2C')}
                    className={`px-6 py-4 rounded-xl font-medium transition-all ${
                      businessType === 'B2C'
                        ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                        : 'bg-gray-800/50 border border-green-500/20 text-gray-400 hover:border-green-500/40'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">B2C</div>
                      <div className="text-xs mt-1 opacity-80">Business to Consumer</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleSetBusinessType('B2B')}
                    className={`px-6 py-4 rounded-xl font-medium transition-all ${
                      businessType === 'B2B'
                        ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                        : 'bg-gray-800/50 border border-green-500/20 text-gray-400 hover:border-green-500/40'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">B2B</div>
                      <div className="text-xs mt-1 opacity-80">Business to Business</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleSetBusinessType('Ambos')}
                    className={`px-6 py-4 rounded-xl font-medium transition-all ${
                      businessType === 'Ambos'
                        ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                        : 'bg-gray-800/50 border border-green-500/20 text-gray-400 hover:border-green-500/40'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">Ambos</div>
                      <div className="text-xs mt-1 opacity-80">B2B e B2C</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Formulário de Dados da Empresa */}
              <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold mb-6">Informações da Empresa</h4>
                <div className="space-y-6">
                  {/* Nome da Empresa */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Qual é o nome da empresa?
                    </label>
                    <input
                      type="text"
                      value={companyData.nome}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, nome: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: Tech Solutions LTDA"
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Em uma frase simples e objetiva, como você descreveria o que a empresa faz?
                    </label>
                    <textarea
                      value={companyData.descricao}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, descricao: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: Desenvolvemos software de gestão para pequenas e médias empresas"
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Produtos/Serviços */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Quais são os produtos ou serviços principais da empresa?
                    </label>
                    <textarea
                      value={companyData.produtos_servicos}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, produtos_servicos: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: Sistema ERP, CRM para vendas, Plataforma de automação de marketing"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Função dos Produtos */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      O que cada produto faz na prática (função real e verificável)?
                    </label>
                    <textarea
                      value={companyData.funcao_produtos}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, funcao_produtos: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: ERP - controla estoque em tempo real e gera relatórios financeiros automáticos"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Diferenciais */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Quais são os diferenciais reais da empresa em relação aos concorrentes?
                    </label>
                    <textarea
                      value={companyData.diferenciais}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, diferenciais: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: Suporte técnico 24/7, implementação em 48h, integração nativa com 200+ apps"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Concorrentes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Quais empresas são consideradas concorrentes diretas?
                    </label>
                    <textarea
                      value={companyData.concorrentes}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, concorrentes: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: TOTVS, Omie, Bling, SAP Business One"
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Dados e Métricas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Quais dados, resultados ou números podem ser citados com segurança (ex: quantidade de clientes, crescimento, métricas reais)?
                    </label>
                    <textarea
                      value={companyData.dados_metricas}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, dados_metricas: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: 5.000+ clientes ativos, 98% de satisfação (NPS 85), crescimento de 40% em 2024"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Erros Comuns */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Quais informações ou pontos o vendedor costuma confundir, exagerar ou citar de forma incorreta sobre a empresa ou produto?
                    </label>
                    <textarea
                      value={companyData.erros_comuns}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, erros_comuns: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: Vendedores dizem 'integração instantânea' mas leva 24-48h, falam 'ilimitado' mas há limite de 10GB"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Percepção Desejada */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Como a empresa deseja ser percebida pelos clientes (ex: acessível, premium, inovadora, consultiva, simples, tradicional etc.)?
                    </label>
                    <textarea
                      value={companyData.percepcao_desejada}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, percepcao_desejada: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: Inovadora e acessível, com foco em simplificar tecnologia para PMEs"
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Dores que Resolve */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Quais dores a empresa resolve para seus clientes?
                    </label>
                    <textarea
                      value={companyData.dores_resolvidas}
                      onChange={(e) => {
                        setCompanyData({ ...companyData, dores_resolvidas: e.target.value })
                        setCompanyDataEdited(true)
                      }}
                      placeholder="Ex: Falta de controle financeiro, processos manuais demorados, dificuldade em escalar o negócio, perda de vendas por falta de organização"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>

                  {/* Botões Salvar/Avaliar/Ver */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Botão Salvar/Atualizar - só aparece se não há ID (primeira vez) OU se houve edição */}
                    {(!companyDataId || companyDataEdited) && (
                      <button
                        onClick={handleSaveCompanyData}
                        disabled={savingCompanyData}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-medium hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {savingCompanyData ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {companyDataId ? 'Atualizando...' : 'Salvando...'}
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            {companyDataId ? 'Atualizar Dados' : 'Salvar Dados'}
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={handleEvaluateQuality}
                      disabled={evaluatingQuality || (qualityEvaluation && !companyDataEdited)}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-medium hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      title={
                        qualityEvaluation && !companyDataEdited
                          ? 'Edite os dados para poder reavaliar'
                          : ''
                      }
                    >
                      {evaluatingQuality ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Avaliando...
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5" />
                          {qualityEvaluation ? 'Reavaliar Dados' : 'Avaliar Dados'}
                        </>
                      )}
                    </button>

                    {qualityEvaluation && (
                      <button
                        onClick={() => setShowCompanyEvaluationModal(true)}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl font-medium hover:scale-105 transition-transform flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Ver Avaliação
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fases do Funil Tab */}
        {activeTab === 'funnel' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-4">Fases do Funil de Vendas</h3>
              <p className="text-gray-400 mb-6">
                Configure as fases do seu processo de vendas. Essas fases serão usadas para categorizar e analisar follow-ups.
              </p>

              {/* Formulário para adicionar nova fase */}
              <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold mb-4">Adicionar Nova Fase</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nome da Fase *
                    </label>
                    <input
                      type="text"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      placeholder="Ex: Primeiro Contato, Qualificação, Proposta..."
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Descrição
                    </label>
                    <textarea
                      value={newStageDescription}
                      onChange={(e) => setNewStageDescription(e.target.value)}
                      placeholder="Descreva o que caracteriza essa fase do funil..."
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Objetivo (Como passar para próxima fase)
                    </label>
                    <textarea
                      value={newStageObjective}
                      onChange={(e) => setNewStageObjective(e.target.value)}
                      placeholder="Ex: Conseguir que o lead responda e demonstre interesse inicial"
                      rows={2}
                      className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <button
                    onClick={handleAddFunnelStage}
                    className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 text-white font-medium rounded-xl hover:from-green-500 hover:to-green-400 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar Fase
                  </button>
                </div>
              </div>

              {/* Lista de fases */}
              <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-6">
                <h4 className="text-lg font-semibold mb-4">Fases Cadastradas</h4>

                {funnelStages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma fase cadastrada ainda.</p>
                    <p className="text-sm mt-2">Adicione as fases do seu funil de vendas acima.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-400 mb-4 flex items-center gap-2">
                      <GripVertical className="w-4 h-4" />
                      Arraste os cards para reordenar as fases do funil
                    </p>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEndFunnelStages}
                    >
                      <SortableContext
                        items={funnelStages.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {funnelStages.map((stage, index) => (
                            <SortableStageCard
                              key={stage.id}
                              stage={stage}
                              index={index}
                              totalStages={funnelStages.length}
                              isEditing={editingStage === stage.id}
                              editStageName={editStageName}
                              editStageDescription={editStageDescription}
                              editStageObjective={editStageObjective}
                              onStartEdit={startEditingStage}
                              onCancelEdit={cancelEditingStage}
                              onUpdate={handleUpdateFunnelStage}
                              onDelete={handleDeleteFunnelStage}
                              setEditStageName={setEditStageName}
                              setEditStageDescription={setEditStageDescription}
                              setEditStageObjective={setEditStageObjective}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ConfigHub({ onClose }: ConfigHubProps) {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Estados para avaliação de persona
  const [personaEvaluation, setPersonaEvaluation] = useState<{
    qualidade_geral: string
    score_geral: number
    nivel_qualidade_textual: string
    score_detalhado: {
      cargo: number
      tipo_empresa_faturamento: number
      contexto: number
      busca: number
      dores: number
    }
    destaques_positivos: string[]
    spin_readiness: {
      situacao: string
      problema: string
      implicacao: string
      need_payoff: string
      score_spin_total: number
    }
    campos_excelentes: string[]
    campos_que_precisam_ajuste: string[]
    sugestoes_melhora_prioritarias: string[]
    pronto_para_roleplay: boolean
    nivel_complexidade_roleplay: string
    proxima_acao_recomendada: string
    mensagem_motivacional: string
  } | null>(null)
  const [showPersonaEvaluationModal, setShowPersonaEvaluationModal] = useState(false)

  // Estados para avaliação de objeção
  const [objectionEvaluation, setObjectionEvaluation] = useState<any>(null)
  const [showObjectionEvaluationModal, setShowObjectionEvaluationModal] = useState(false)

  // Estados para avaliação de dados da empresa
  const [qualityEvaluation, setQualityEvaluation] = useState<{
    nota_final: number
    classificacao: string
    pode_usar: boolean
    capacidade_roleplay: number
    resumo: string
    pontos_fortes: string[]
    principais_gaps: {
      campo: string
      problema: string
      impacto: string
      acao: string
    }[]
    campos_criticos_vazios: string[]
    proxima_acao: string
    recomendacao_uso: string
  } | null>(null)
  const [showCompanyEvaluationModal, setShowCompanyEvaluationModal] = useState(false)

  // Check user role on mount
  useEffect(() => {
    checkUserRole()
  }, [])

  const checkUserRole = async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: employee } = await supabase
          .from('employees')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (employee) {
          setUserRole(employee.role)
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`relative max-w-5xl w-full max-h-[90vh] overflow-hidden transition-transform duration-300 ${
        showPersonaEvaluationModal || showCompanyEvaluationModal ? 'sm:-translate-x-[250px]' :
        showObjectionEvaluationModal ? 'sm:-translate-x-[210px]' : ''
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl"></div>
        <div className="relative bg-gray-900/70 backdrop-blur-xl rounded-3xl border border-green-500/30 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">
                <Settings className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Hub de Configuração</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
            {loading ? (
              // Loading state
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
              </div>
            ) : userRole?.toLowerCase() === 'admin' ? (
              // Configuration Interface - Admin only
              <ConfigurationInterface
                personaEvaluation={personaEvaluation}
                setPersonaEvaluation={setPersonaEvaluation}
                showPersonaEvaluationModal={showPersonaEvaluationModal}
                setShowPersonaEvaluationModal={setShowPersonaEvaluationModal}
                objectionEvaluation={objectionEvaluation}
                setObjectionEvaluation={setObjectionEvaluation}
                showObjectionEvaluationModal={showObjectionEvaluationModal}
                setShowObjectionEvaluationModal={setShowObjectionEvaluationModal}
                qualityEvaluation={qualityEvaluation}
                setQualityEvaluation={setQualityEvaluation}
                showCompanyEvaluationModal={showCompanyEvaluationModal}
                setShowCompanyEvaluationModal={setShowCompanyEvaluationModal}
              />
            ) : (
              // Access denied - Not admin
              <div className="max-w-md mx-auto py-8 text-center">
                <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-10 h-10 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-white">
                  Acesso Negado
                </h3>
                <p className="text-gray-400">
                  Apenas administradores podem acessar as configurações.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Modal de Avaliação de Persona - Side Panel (fora do ConfigHub) */}
    {showPersonaEvaluationModal && personaEvaluation && (
      <div className="fixed top-0 right-0 h-screen w-full sm:w-[500px] z-[70] p-4">
        <style jsx>{`
          @keyframes slide-in {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .animate-slide-in {
            animation: slide-in 0.3s ease-out;
          }
        `}</style>
        <div className="relative h-full animate-slide-in">
          <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl"></div>
          <div className="relative bg-gray-900/98 backdrop-blur-xl rounded-3xl border border-green-500/30 h-full flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-green-500/20 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Avaliação</h2>
                  <p className="text-xs text-gray-400">{personaEvaluation.mensagem_motivacional}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPersonaEvaluationModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Score Geral */}
              <div className="bg-gradient-to-br from-green-900/30 to-transparent border border-green-500/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-white mb-0.5">Score Geral</h3>
                    <p className="text-xs text-gray-400 capitalize">{personaEvaluation.qualidade_geral} • {personaEvaluation.nivel_qualidade_textual}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-400">{personaEvaluation.score_geral.toFixed(1)}</div>
                    <div className="text-xs text-gray-500">/10</div>
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-600 to-green-400 h-2 rounded-full transition-all"
                    style={{ width: `${(personaEvaluation.score_geral / 10) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Scores Detalhados */}
              <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-3">
                <h3 className="text-sm font-bold text-white mb-3">Scores por Campo</h3>
                <div className="space-y-2">
                  {personaEvaluation.score_detalhado && Object.entries(personaEvaluation.score_detalhado).map(([campo, scoreData]: [string, any]) => {
                    // Mapeamento de nomes para exibição
                    const fieldNames: Record<string, string> = {
                      'cargo_perfil': 'Cargo/Perfil',
                      'tipo_empresa_faturamento_perfil_socioeconomico': 'Tipo Empresa/Perfil',
                      'contexto': 'Contexto',
                      'busca': 'O que Busca',
                      'dores': 'Dores/Desafios'
                    }

                    // Extrair o score numérico do objeto
                    const scoreValue = typeof scoreData === 'object' ? (scoreData.score || 0) : scoreData;

                    return (
                      <div key={campo}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-300">
                            {fieldNames[campo] || campo}
                          </span>
                          <span className="text-xs font-bold text-green-400">{scoreValue}/10</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              scoreValue >= 9 ? 'bg-green-500' :
                              scoreValue >= 7 ? 'bg-blue-500' :
                              scoreValue >= 5 ? 'bg-yellow-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: `${(scoreValue / 10) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Destaques Positivos */}
              {personaEvaluation.destaques_positivos?.length > 0 && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Destaques Positivos
                  </h3>
                  <ul className="space-y-1.5">
                    {personaEvaluation.destaques_positivos.map((destaque, idx) => (
                      <li key={idx} className="text-xs text-gray-300 flex items-start gap-1.5">
                        <span className="text-green-400 mt-0.5">•</span>
                        <span>{destaque}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SPIN Readiness */}
              <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-white">Prontidão SPIN</h3>
                  <span className="text-lg font-bold text-green-400">
                    {personaEvaluation.spin_readiness.score_spin_total}/10
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(personaEvaluation.spin_readiness)
                    .filter(([key]) => key !== 'score_spin_total')
                    .map(([etapa, statusData]) => {
                      // Extrair o status do objeto
                      const statusValue = typeof statusData === 'object' ? ((statusData as any).status || 'insuficiente') : statusData;

                      return (
                        <div key={etapa} className="bg-gray-800/50 rounded-lg p-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-medium text-gray-400 uppercase">
                              {etapa.replace(/_/g, ' ')}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold text-center ${
                              statusValue === 'pronto' ? 'bg-green-500/20 text-green-400' :
                              statusValue === 'precisa_ajuste' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {statusValue === 'pronto' ? '✓ Pronto' :
                               statusValue === 'precisa_ajuste' ? '⚠ Ajustar' :
                               '✗ Insuf.'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Campos Excelentes */}
              {personaEvaluation.campos_excelentes?.length > 0 && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-white mb-2">
                    🌟 Excelentes (≥9)
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {personaEvaluation.campos_excelentes.map((campo, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-[10px]">
                        {campo.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Campos que Precisam Ajuste */}
              {personaEvaluation.campos_que_precisam_ajuste?.length > 0 && (
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                    Para Ajustar
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {personaEvaluation.campos_que_precisam_ajuste.map((campo, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded-full text-[10px]">
                        {campo.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sugestões de Melhoria */}
              {personaEvaluation.sugestoes_melhora_prioritarias?.length > 0 && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-white mb-2">
                    💡 Sugestões Prioritárias
                  </h3>
                  <ul className="space-y-1.5">
                    {personaEvaluation.sugestoes_melhora_prioritarias.map((sugestao, idx) => (
                      <li key={idx} className="text-xs text-gray-300 flex items-start gap-1.5">
                        <span className="text-blue-400 mt-0.5 font-bold text-[10px]">{idx + 1}.</span>
                        <span className="leading-tight">{sugestao}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Status e Recomendação */}
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded-lg p-2.5 border ${
                  personaEvaluation.pronto_para_roleplay
                    ? 'bg-green-900/20 border-green-500/30'
                    : 'bg-yellow-900/20 border-yellow-500/30'
                }`}>
                  <h4 className="text-xs font-semibold mb-1 text-white">Status</h4>
                  <p className={`text-xs font-bold ${
                    personaEvaluation.pronto_para_roleplay ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {personaEvaluation.pronto_para_roleplay ? '✓ Pronto' : '⚠ Ajustar'}
                  </p>
                </div>
                <div className="bg-gray-900/50 border border-green-500/20 rounded-lg p-2.5">
                  <h4 className="text-xs font-semibold mb-1 text-white">Nível</h4>
                  <p className="text-xs text-green-400 capitalize font-bold">
                    {personaEvaluation.nivel_complexidade_roleplay}
                  </p>
                </div>
              </div>

              {/* Próxima Ação */}
              <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 border border-green-500/30 rounded-xl p-3">
                <h3 className="text-sm font-bold text-white mb-1.5">🎯 Próxima Ação</h3>
                <p className="text-xs text-gray-300 leading-tight">
                  {(() => {
                    const actionMap: Record<string, string> = {
                      'usar_imediatamente': '✅ Usar imediatamente no treinamento',
                      'refinar_campos_especificos': '⚠️ Refinar campos específicos',
                      'reescrever_persona': '🔄 Reescrever persona do zero'
                    }
                    return actionMap[personaEvaluation.proxima_acao_recomendada] || personaEvaluation.proxima_acao_recomendada
                  })()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Avaliação de Objeção - Side Panel (fora do ConfigHub) */}
    {showObjectionEvaluationModal && objectionEvaluation && (
      <div className="fixed top-0 right-0 h-screen w-full sm:w-[420px] z-[70] p-3 bg-gradient-to-br from-green-950/90 via-gray-900/95 to-gray-900/95">
        <div className="h-full bg-gradient-to-b from-green-900/20 to-gray-900/50 border border-green-500/30 rounded-lg shadow-2xl overflow-y-auto animate-slide-in">
          <div className="sticky top-0 bg-gradient-to-b from-green-900/80 to-gray-900/80 backdrop-blur-sm border-b border-green-500/30 p-3 flex items-center justify-between z-10">
            <h3 className="font-bold text-white text-sm">Avaliação da Objeção</h3>
            <button
              onClick={() => setShowObjectionEvaluationModal(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-3">
            {/* Score Geral */}
            <div className={`rounded-lg p-3 text-center ${
              objectionEvaluation.status === 'APROVADA' ? 'bg-green-500/20 border border-green-500/30' :
              objectionEvaluation.status === 'REVISAR' ? 'bg-yellow-500/20 border border-yellow-500/30' :
              'bg-red-500/20 border border-red-500/30'
            }`}>
              <div className="text-3xl font-bold text-white mb-1">
                {objectionEvaluation.nota_final?.toFixed(1)}/10
              </div>
              <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                objectionEvaluation.status === 'APROVADA' ? 'bg-green-600/30 text-green-300' :
                objectionEvaluation.status === 'REVISAR' ? 'bg-yellow-600/30 text-yellow-300' :
                'bg-red-600/30 text-red-300'
              }`}>
                {objectionEvaluation.status}
              </div>
            </div>

            {/* Como Melhorar */}
            {objectionEvaluation.como_melhorar?.length > 0 && (
              <div className="bg-gray-800/50 border border-green-500/20 rounded-lg p-3">
                <h4 className="font-semibold text-green-400 mb-2 text-xs">
                  💡 Como Melhorar
                </h4>
                <ul className="space-y-1.5">
                  {objectionEvaluation.como_melhorar.map((sugestao: string, idx: number) => (
                    <li key={idx} className="text-xs text-gray-300 flex items-start">
                      <span className="text-green-400 mr-1.5 font-bold">{idx + 1}.</span>
                      <span className="flex-1 leading-relaxed">{sugestao}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mensagem de Aprovação */}
            {objectionEvaluation.status === 'APROVADA' && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <p className="text-green-300 text-xs">
                  ✅ Objeção bem estruturada e pronta para usar no treinamento!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Painel Lateral de Avaliação de Dados da Empresa */}
    {showCompanyEvaluationModal && qualityEvaluation && (
      <div className="fixed top-0 right-0 h-screen w-full sm:w-[500px] z-[70] p-4 overflow-y-auto bg-black/95 backdrop-blur-xl border-l border-green-500/30">
        <div className="animate-slide-in">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-green-500/30">
            <h3 className="text-xl font-bold text-white">Avaliação dos Dados</h3>
            <button
              onClick={() => setShowCompanyEvaluationModal(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Score Geral */}
          <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Score Geral</span>
              <span className="text-3xl font-bold text-green-400">
                {qualityEvaluation.nota_final}
                <span className="text-lg text-gray-500">/100</span>
              </span>
            </div>
            <div className={`px-4 py-2 rounded-lg font-semibold text-center text-sm ${
              qualityEvaluation.classificacao === 'Excelente' ? 'bg-green-500/20 text-green-400' :
              qualityEvaluation.classificacao === 'Ótimo' ? 'bg-green-500/20 text-green-400' :
              qualityEvaluation.classificacao === 'Bom' ? 'bg-blue-500/20 text-blue-400' :
              qualityEvaluation.classificacao === 'Aceitável' ? 'bg-yellow-500/20 text-yellow-400' :
              qualityEvaluation.classificacao === 'Ruim' ? 'bg-orange-500/20 text-orange-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {qualityEvaluation.classificacao}
            </div>
          </div>

          {/* Capacidade para Roleplay */}
          <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Capacidade Roleplay</span>
              <span className="text-2xl font-bold text-blue-400">
                {qualityEvaluation.capacidade_roleplay}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all"
                style={{ width: `${qualityEvaluation.capacidade_roleplay}%` }}
              ></div>
            </div>
          </div>

          {/* Resumo */}
          <div className="bg-gray-900/50 border border-green-500/20 rounded-xl p-4 mb-4">
            <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Resumo</h4>
            <p className="text-sm text-gray-300 leading-relaxed">{qualityEvaluation.resumo}</p>
          </div>

          {/* Pontos Fortes */}
          {qualityEvaluation.pontos_fortes && qualityEvaluation.pontos_fortes.length > 0 && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 mb-4">
              <h4 className="text-xs text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Pontos Fortes
              </h4>
              <ul className="space-y-2">
                {qualityEvaluation.pontos_fortes.map((ponto, index) => (
                  <li key={index} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>{ponto}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Principais Gaps */}
          {qualityEvaluation.principais_gaps && qualityEvaluation.principais_gaps.length > 0 && (
            <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4 mb-4">
              <h4 className="text-xs text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Principais Gaps
              </h4>
              <div className="space-y-3">
                {qualityEvaluation.principais_gaps.map((gap, index) => (
                  <div key={index} className="bg-gray-900/50 border border-orange-500/20 rounded-lg p-3">
                    <div className="text-xs font-semibold text-orange-400 mb-1">
                      {gap.campo}
                    </div>
                    <div className="text-xs text-gray-300 mb-2">{gap.problema}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Impacto: {gap.impacto}</span>
                    </div>
                    <div className="mt-2 text-xs text-blue-400 bg-blue-900/20 rounded px-2 py-1">
                      💡 {gap.acao}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campos Críticos Vazios */}
          {qualityEvaluation.campos_criticos_vazios && qualityEvaluation.campos_criticos_vazios.length > 0 && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-4">
              <h4 className="text-xs text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Campos Críticos Vazios
              </h4>
              <ul className="space-y-1">
                {qualityEvaluation.campos_criticos_vazios.map((campo, index) => (
                  <li key={index} className="text-xs text-red-300 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">⚠</span>
                    <span>{campo}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Próxima Ação */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 mb-4">
            <h4 className="text-xs text-blue-400 uppercase tracking-wider mb-2">Próxima Ação</h4>
            <p className="text-sm text-gray-300">{qualityEvaluation.proxima_acao}</p>
          </div>

          {/* Recomendação de Uso */}
          <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
            <h4 className="text-xs text-green-400 uppercase tracking-wider mb-2">Recomendação de Uso</h4>
            <p className="text-sm text-gray-300">{qualityEvaluation.recomendacao_uso}</p>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
