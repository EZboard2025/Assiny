'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Play, Clock, MessageCircle, Send, Calendar, User, Zap, Mic, MicOff, Volume2, UserCircle2, CheckCircle, Loader2, X, AlertCircle, ChevronDown, ChevronUp, Lock, Target, TrendingUp, AlertTriangle, Lightbulb, Video, VideoOff, PhoneOff, Phone, Shuffle, EyeOff, Eye } from 'lucide-react'
import { getPersonas, getObjections, getCompanyType, getTags, getPersonaTags, getRoleplayObjectives, type Persona, type PersonaB2B, type PersonaB2C, type Objection, type Tag, type RoleplayObjective } from '@/lib/config'
import { createRoleplaySession, addMessageToSession, endRoleplaySession, getRoleplaySession, type RoleplayMessage } from '@/lib/roleplay'
import { processWhisperTranscription } from '@/lib/utils/whisperValidation'
import { generateAvatarWithAI, generateAvatarUrl, preloadImage } from '@/lib/utils/generateAvatar'
import { updatePersona } from '@/lib/config'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { PlanLimitWarning } from '@/components/PlanLimitWarning'

interface RoleplayViewProps {
  onNavigateToHistory?: () => void
}

export default function RoleplayView({ onNavigateToHistory }: RoleplayViewProps = {}) {
  // Hook para verificar limites do plano
  const {
    checkRoleplayLimit,
    incrementRoleplay,
    planUsage,
    trainingPlan
  } = usePlanLimits()

  // CSS for custom scrollbar
  const scrollbarStyles = `
    <style>
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(31, 41, 55, 0.5);
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(34, 197, 94, 0.5);
        border-radius: 4px;
        transition: background 0.2s;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(34, 197, 94, 0.7);
      }
    </style>
  `;
  const [isSimulating, setIsSimulating] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [roleplayLimitReached, setRoleplayLimitReached] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Estados e refs para interface de videochamada
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const [showChatSidebar, setShowChatSidebar] = useState(false)

  // Configurações do roleplay
  const [age, setAge] = useState(30)
  const [temperament, setTemperament] = useState('Analítico')
  const [selectedPersona, setSelectedPersona] = useState('')
  const [selectedObjections, setSelectedObjections] = useState<string[]>([])
  const [selectedObjective, setSelectedObjective] = useState('')
  const [hiddenMode, setHiddenMode] = useState(false) // Modo oculto - esconde seleções

  // Estados para avatar da persona
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)

  // Estado para modal de aviso ao encerrar
  const [showEndSessionWarning, setShowEndSessionWarning] = useState(false)

  // Dados do banco
  const [businessType, setBusinessType] = useState<'B2B' | 'B2C' | 'Ambos'>('B2C')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [objections, setObjections] = useState<Objection[]>([])
  const [objectives, setObjectives] = useState<RoleplayObjective[]>([])
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [personaTags, setPersonaTags] = useState<Map<string, Tag[]>>(new Map())

  // Estados de expansão individual
  const [expandedPersonaId, setExpandedPersonaId] = useState<string | null>(null)
  const [expandedObjectionId, setExpandedObjectionId] = useState<string | null>(null)

  // Chat simulation
  const [messages, setMessages] = useState<Array<{ role: 'client' | 'seller', text: string }>>([])
  const [inputMessage, setInputMessage] = useState('')
  const [sessionIdN8N, setSessionIdN8N] = useState<string | null>(null) // SessionId do N8N
  const [isLoading, setIsLoading] = useState(false)
  const [currentTranscription, setCurrentTranscription] = useState<string>('') // Para mostrar transcrição em tempo real
  const [isProcessingTranscription, setIsProcessingTranscription] = useState(false) // Para mostrar que está processando
  const [lastUserMessage, setLastUserMessage] = useState<string>('') // Para destacar última mensagem do usuário
  const [sessionId, setSessionId] = useState<string | null>(null) // ID da sessão no Supabase
  const [isEvaluating, setIsEvaluating] = useState(false) // Loading durante avaliação
  const [showEvaluationSummary, setShowEvaluationSummary] = useState(false) // Modal de resumo
  const [evaluation, setEvaluation] = useState<any>(null) // Avaliação recebida
  const [audioVolume, setAudioVolume] = useState(0) // Volume do áudio para animação do blob
  const audioAnalyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [showFinalizingMessage, setShowFinalizingMessage] = useState(false) // Mostrar mensagem de finalização
  const [activeEvaluationTab, setActiveEvaluationTab] = useState<'conversation' | 'evaluation' | 'feedback'>('evaluation') // Aba ativa no modal de avaliação
  const [clientName, setClientName] = useState<string>('Cliente') // Nome do cliente virtual
  const [roleplayConfig, setRoleplayConfig] = useState<any>(null) // Armazena toda a configuração do roleplay
  const [dataLoading, setDataLoading] = useState(true) // Loading state para dados iniciais

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [])

  // Verificar limite de créditos mensais
  useEffect(() => {
    if (planUsage && trainingPlan) {
      const used = planUsage?.credits?.used || 0
      const limit = planUsage?.credits?.limit

      if (limit !== null && used >= limit) {
        setRoleplayLimitReached(true)
        console.log('⚠️ Limite de créditos mensais atingido:', used, '/', limit)
      } else {
        setRoleplayLimitReached(false)
      }
    }
  }, [planUsage, trainingPlan])

  const loadData = async () => {
    setDataLoading(true)
    try {
      const [businessTypeData, personasData, objectionsData, objectivesData, tagsData] = await Promise.all([
        getCompanyType(),
        getPersonas(),
        getObjections(),
        getRoleplayObjectives(),
        getTags(),
      ])
      setBusinessType(businessTypeData)
      setPersonas(personasData)
      setObjections(objectionsData)
      setObjectives(objectivesData)
      setTags(tagsData)

      // Carregar tags de cada persona em paralelo (otimizado)
      const personaTagsPromises = personasData
        .filter(persona => persona.id)
        .map(async (persona) => {
          const personaTagsData = await getPersonaTags(persona.id!)
          return { id: persona.id!, tags: personaTagsData }
        })

      const personaTagsResults = await Promise.all(personaTagsPromises)
      const newPersonaTags = new Map<string, Tag[]>()
      personaTagsResults.forEach(({ id, tags }) => {
        newPersonaTags.set(id, tags)
      })
      setPersonaTags(newPersonaTags)

      // Filtrar personas pelo tipo de empresa e selecionar a primeira
      const filteredPersonas = businessTypeData === 'Ambos'
        ? personasData
        : personasData.filter(p => p.business_type === businessTypeData)
      if (filteredPersonas.length > 0) {
        setSelectedPersona(filteredPersonas[0].id!)
      }

      // Selecionar primeiro objetivo se existir
      if (objectivesData.length > 0) {
        setSelectedObjective(objectivesData[0].id)
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setDataLoading(false)
    }
  }

  // Funções para gerenciar webcam na interface de videochamada
  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false // Áudio é gerenciado separadamente pelo MediaRecorder
      })
      setWebcamStream(mediaStream)
      setIsCameraOn(true)
    } catch (err) {
      console.error('Erro ao acessar câmera:', err)
      setIsCameraOn(false)
    }
  }

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop())
      setWebcamStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOn(false)
  }

  const toggleCamera = async () => {
    if (isCameraOn) {
      stopWebcam()
    } else {
      await startWebcam()
    }
  }

  // Efeito para conectar o stream ao elemento de vídeo quando ambos existirem
  useEffect(() => {
    if (isCameraOn && webcamStream && videoRef.current) {
      videoRef.current.srcObject = webcamStream
    }
  }, [isCameraOn, webcamStream])

  // Efeito para gerar avatar APENAS quando a simulação iniciar
  useEffect(() => {
    // Só gera quando a simulação começa
    if (!isSimulating || !selectedPersona || hiddenMode) {
      return
    }

    const persona = personas.find(p => p.id === selectedPersona)
    if (!persona) return

    // Já tem avatar? Não regenera
    if (avatarUrl) return

    // Gera novo avatar usando DALL-E 3
    const generateAvatar = async () => {
      setIsLoadingAvatar(true)

      try {
        // Tenta gerar com DALL-E 3
        const aiUrl = await generateAvatarWithAI(persona, age, temperament)

        if (aiUrl) {
          setAvatarUrl(aiUrl)
        } else {
          // Fallback para Pravatar se DALL-E falhar
          console.warn('DALL-E falhou, usando fallback Pravatar')
          const fallbackUrl = generateAvatarUrl(persona, age, temperament)
          await preloadImage(fallbackUrl)
          setAvatarUrl(fallbackUrl)
        }
      } catch (error) {
        console.error('Erro ao gerar avatar:', error)
        setAvatarUrl(null)
      } finally {
        setIsLoadingAvatar(false)
      }
    }

    generateAvatar()
  }, [isSimulating]) // Só dispara quando simulação inicia

  // Limpa avatar quando sair da simulação
  useEffect(() => {
    if (!isSimulating) {
      setAvatarUrl(null)
    }
  }, [isSimulating])

  // Helper functions for evaluation modal (matching HistoricoView design)
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400'
    if (score >= 6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 8) return 'bg-green-500/20 border-green-500/30'
    if (score >= 6) return 'bg-yellow-500/20 border-yellow-500/30'
    return 'bg-red-500/20 border-red-500/30'
  }

  const getPerformanceLabel = (level: string) => {
    const labels: Record<string, string> = {
      'legendary': 'Lendário',
      'excellent': 'Excelente',
      'very_good': 'Muito Bom',
      'good': 'Bom',
      'needs_improvement': 'Precisa Melhorar',
      'poor': 'Em Desenvolvimento'
    }
    return labels[level] || level
  }

  const translateIndicator = (key: string) => {
    const translations: Record<string, string> = {
      // Indicadores SPIN - Situação (S)
      'adaptability_score': 'Adaptabilidade',
      'open_questions_score': 'Perguntas Abertas',
      'scenario_mapping_score': 'Mapeamento de Cenário',
      'depth_score': 'Profundidade',
      'relevance_score': 'Relevância',
      'context_score': 'Contexto',
      'discovery_score': 'Descoberta',
      'exploration_score': 'Exploração',
      'investigation_score': 'Investigação',
      // Indicadores SPIN - Problema (P)
      'problem_identification_score': 'Identificação de Problemas',
      'empathy_score': 'Empatia',
      'consequences_exploration_score': 'Exploração de Consequências',
      'impact_understanding_score': 'Compreensão de Impacto',
      'pain_identification_score': 'Identificação de Dores',
      'challenge_discovery_score': 'Descoberta de Desafios',
      // Indicadores SPIN - Implicação (I)
      'emotional_impact_score': 'Impacto Emocional',
      'logical_flow_score': 'Fluxo Lógico',
      'quantification_score': 'Quantificação',
      'future_projection_score': 'Projeção Futura',
      'business_impact_score': 'Impacto no Negócio',
      'consequence_development_score': 'Desenvolvimento de Consequências',
      'amplification_score': 'Amplificação',
      'concrete_risks': 'Riscos Concretos',
      'inaction_consequences': 'Consequências da Inação',
      'urgency_amplification': 'Amplificação de Urgência',
      'non_aggressive_urgency': 'Urgência Não Agressiva',
      // Indicadores SPIN - Necessidade (N)
      'value_articulation_score': 'Articulação de Valor',
      'solution_fit_score': 'Adequação da Solução',
      'commitment_score': 'Comprometimento',
      'benefit_clarity_score': 'Clareza de Benefícios',
      'roi_demonstration_score': 'Demonstração de ROI',
      'outcome_score': 'Resultado',
      'value_proposition_score': 'Proposta de Valor',
      'credibility': 'Credibilidade',
      'personalization': 'Personalização',
      'benefits_clarity': 'Clareza de Benefícios',
      'solution_clarity': 'Clareza da Solução',
      'cta_effectiveness': 'Eficácia do CTA',
      // Indicadores gerais de vendas
      'timing_score': 'Timing',
      'impact_score': 'Impacto',
      'clarity_score': 'Clareza',
      'connection_score': 'Conexão',
      'rapport_score': 'Rapport',
      'listening_score': 'Escuta Ativa',
      'active_listening_score': 'Escuta Ativa',
      'questioning_score': 'Questionamento',
      'probing_score': 'Investigação',
      'urgency_score': 'Urgência',
      'engagement_score': 'Engajamento',
      'trust_score': 'Confiança',
      'persuasion_score': 'Persuasão',
      'negotiation_score': 'Negociação',
      'presentation_score': 'Apresentação',
      'communication_score': 'Comunicação',
      'flexibility_score': 'Flexibilidade',
      'confidence_score': 'Confiança',
      // Indicadores sem sufixo _score
      'timing': 'Timing',
      'impact': 'Impacto',
      'clarity': 'Clareza',
      'connection': 'Conexão',
      'rapport': 'Rapport',
      'listening': 'Escuta Ativa',
      'engagement': 'Engajamento',
      'trust': 'Confiança',
      'depth': 'Profundidade',
      'relevance': 'Relevância',
      'context': 'Contexto',
      'discovery': 'Descoberta',
      'exploration': 'Exploração',
      'empathy': 'Empatia',
      'adaptability': 'Adaptabilidade',
      'outcome': 'Resultado',
      'commitment': 'Comprometimento',
      'quantification': 'Quantificação',
      'amplification': 'Amplificação',
    }
    const normalized = key.toLowerCase().replace(/\s+/g, '_')
    if (translations[normalized]) return translations[normalized]
    if (translations[key]) return translations[key]
    const withoutScore = normalized.replace(/_score$/, '')
    if (translations[withoutScore]) return translations[withoutScore]
    const cleaned = key.replace(/_score$/i, '').replace(/\s+score$/i, '').replace(/_/g, ' ').trim()
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  const temperaments = ['Analítico', 'Empático', 'Determinado', 'Indeciso', 'Sociável']

  // Função para seleção aleatória de todas as configurações
  const handleRandomSelection = () => {
    // Idade aleatória entre 18 e 60
    const randomAge = Math.floor(Math.random() * (60 - 18 + 1)) + 18
    setAge(randomAge)

    // Temperamento aleatório
    const randomTemperament = temperaments[Math.floor(Math.random() * temperaments.length)]
    setTemperament(randomTemperament)

    // Persona aleatória (considerando o business type)
    const filteredPersonas = businessType === 'Ambos'
      ? personas
      : personas.filter(p => p.business_type === businessType)

    if (filteredPersonas.length > 0) {
      const randomPersona = filteredPersonas[Math.floor(Math.random() * filteredPersonas.length)]
      setSelectedPersona(randomPersona.id!)
    }

    // Objeções aleatórias (1 a 3 objeções)
    if (objections.length > 0) {
      const numObjections = Math.min(Math.floor(Math.random() * 3) + 1, objections.length)
      const shuffled = [...objections].sort(() => Math.random() - 0.5)
      const randomObjections = shuffled.slice(0, numObjections).map(o => o.id!)
      setSelectedObjections(randomObjections)
    }

    // Objetivo aleatório
    if (objectives.length > 0) {
      const randomObjective = objectives[Math.floor(Math.random() * objectives.length)]
      setSelectedObjective(randomObjective.id!)
    }
  }

  // Função para agrupar e ordenar personas por tags
  const getGroupedPersonas = () => {
    const filtered = businessType === 'Ambos'
      ? personas
      : personas.filter(p => p.business_type === businessType)

    // Agrupar por tags
    const tagGroups = new Map<string, Persona[]>()
    const noTagPersonas: Persona[] = []

    filtered.forEach(persona => {
      const tags = personaTags.get(persona.id!) || []

      if (tags.length === 0) {
        noTagPersonas.push(persona)
      } else {
        // Agrupar pela primeira tag (pode ter múltiplas tags, mas vamos usar a primeira)
        const firstTag = tags[0]
        const tagKey = firstTag.id

        if (!tagGroups.has(tagKey)) {
          tagGroups.set(tagKey, [])
        }
        tagGroups.get(tagKey)!.push(persona)
      }
    })

    // Ordenar os grupos de tags alfabeticamente pelo nome da tag
    const sortedGroups = Array.from(tagGroups.entries())
      .map(([tagId, personas]) => {
        const tag = tags.find(t => t.id === tagId)!
        return { tag, personas }
      })
      .sort((a, b) => a.tag.name.localeCompare(b.tag.name))

    return { sortedGroups, noTagPersonas }
  }

  const handleStartSimulation = async () => {
    // Validar persona selecionada
    if (!selectedPersona) {
      const messageElement = document.createElement('div')
      messageElement.className = 'fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg'
      messageElement.textContent = 'Selecione uma persona para o roleplay'
      document.body.appendChild(messageElement)

      setTimeout(() => {
        messageElement.remove()
      }, 3000)

      return
    }

    // Validar objeções selecionadas
    if (selectedObjections.length === 0) {
      const messageElement = document.createElement('div')
      messageElement.className = 'fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg'
      messageElement.textContent = 'Selecione pelo menos uma objeção'
      document.body.appendChild(messageElement)

      setTimeout(() => {
        messageElement.remove()
      }, 3000)

      return
    }

    // Validar objetivo selecionado
    if (!selectedObjective) {
      const messageElement = document.createElement('div')
      messageElement.className = 'fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg'
      messageElement.textContent = 'Selecione um objetivo para o roleplay'
      document.body.appendChild(messageElement)

      setTimeout(() => {
        messageElement.remove()
      }, 3000)

      return
    }

    // Primeiro verificar os limites do plano antes de iniciar
    const limitCheck = await checkRoleplayLimit()

    if (!limitCheck.allowed) {
      // Mostrar aviso de limite atingido
      setRoleplayLimitReached(true)

      // Mostrar mensagem de erro
      const messageElement = document.createElement('div')
      messageElement.className = 'fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg'
      messageElement.textContent = limitCheck.reason || 'Limite de simulações atingido'
      document.body.appendChild(messageElement)

      setTimeout(() => {
        messageElement.remove()
      }, 3000)

      return
    }

    setIsSimulating(true)
    setIsLoading(true)

    // Iniciar webcam para interface de videochamada
    startWebcam()

    try {
      // Buscar userId e companyId
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id

      if (!userId) {
        throw new Error('Usuário não autenticado')
      }

      // Buscar companyId do employee
      const { getCompanyIdFromUserId } = await import('@/lib/utils/getCompanyId')
      const companyId = await getCompanyIdFromUserId(userId)

      if (!companyId) {
        throw new Error('Company ID não encontrado')
      }

      // Salvar companyId no estado para usar na transcrição
      setCurrentCompanyId(companyId)

      // Buscar persona selecionada
      const selectedPersonaData = personas.find(p => p.id === selectedPersona)
      const selectedObjectionsData = objections.filter(o => selectedObjections.includes(o.id))
      const selectedObjectiveData = objectives.find(o => o.id === selectedObjective)

      // Enviar todos os dados da persona para o agente (usando nomes do banco de dados)
      let personaData: any = {}
      if (selectedPersonaData) {
        // O banco usa nomes em português: cargo, tipo_empresa_faturamento, contexto, busca, dores
        const p = selectedPersonaData as any
        if (selectedPersonaData.business_type === 'B2B') {
          personaData = {
            business_type: 'B2B',
            cargo: p.cargo || p.job_title,
            tipo_empresa_faturamento: p.tipo_empresa_faturamento || p.company_type,
            contexto: p.contexto || p.context,
            busca: p.busca || p.company_goals,
            dores: p.dores || p.business_challenges,
            prior_knowledge: p.prior_knowledge
          }
        } else {
          personaData = {
            business_type: 'B2C',
            profissao: p.profissao || p.profession,
            contexto: p.contexto || p.context,
            busca: p.busca || p.what_seeks,
            dores: p.dores || p.main_pains,
            prior_knowledge: p.prior_knowledge
          }
        }
      }

      // Formatar objeções com suas formas de quebra E incluir o ID
      const objectionsWithRebuttals = selectedObjectionsData.map(o => ({
        id: o.id,  // IMPORTANTE: Incluir o ID real do banco
        name: o.name,
        rebuttals: o.rebuttals || []
      }))

      // Salvar configuração completa para usar em todas as mensagens
      const fullConfig = {
        age,
        temperament,
        selectedPersona: selectedPersonaData,
        objections: objectionsWithRebuttals,
        objective: selectedObjectiveData,
        personaData: personaData
      }
      setRoleplayConfig(fullConfig)
      console.log('💾 Configuração do roleplay salva:', fullConfig)

      // Salvar também no sessionStorage como backup
      sessionStorage.setItem('roleplayConfig', JSON.stringify(fullConfig))

      // Montar mensagem de contexto (igual ao backend)
      let objectionsText = 'Nenhuma objeção específica'
      if (objectionsWithRebuttals.length > 0) {
        objectionsText = objectionsWithRebuttals.map((obj: any) => {
          let text = obj.name
          if (obj.rebuttals && obj.rebuttals.length > 0) {
            text += `\n  Formas de quebrar esta objeção:\n`
            text += obj.rebuttals.map((r: string, i: number) => `  ${i + 1}. ${r}`).join('\n')
          }
          return text
        }).join('\n\n')
      }

      let personaInfo = ''
      if (personaData.business_type === 'B2B') {
        personaInfo = `
PERFIL DO CLIENTE B2B:
- Cargo: ${personaData.cargo || 'Não especificado'}
- Empresa: ${personaData.tipo_empresa_faturamento || 'Não especificado'}
- Contexto: ${personaData.contexto || 'Não especificado'}
- O que busca para a empresa: ${personaData.busca || 'Não especificado'}
- Principais desafios do negócio: ${personaData.dores || 'Não especificado'}
- O que já sabe sobre sua empresa: ${personaData.prior_knowledge || 'Não sabe nada ainda'}`
      } else if (personaData.business_type === 'B2C') {
        personaInfo = `
PERFIL DO CLIENTE B2C:
- Profissão: ${personaData.profissao || 'Não especificado'}
- Contexto: ${personaData.contexto || 'Não especificado'}
- O que busca/valoriza: ${personaData.busca || 'Não especificado'}
- Principais dores/problemas: ${personaData.dores || 'Não especificado'}
- O que já sabe sobre sua empresa: ${personaData.prior_knowledge || 'Não sabe nada ainda'}`
      }

      const contextMessage = `Você está em uma simulação de venda. Características do cliente:
- Idade: ${age} anos
- Temperamento: ${temperament}
${personaInfo}

Objeções que o cliente pode usar:
${objectionsText}

OBJETIVO DO VENDEDOR NESTE ROLEPLAY:
${selectedObjectiveData?.name || 'Não especificado'}
${selectedObjectiveData?.description ? `Descrição: ${selectedObjectiveData.description}` : ''}

Interprete este personagem de forma realista e consistente com todas as características acima. Inicie a conversa como cliente.`

      // Criar nova sessão com API direta (chat-v2)
      const response = await fetch('/api/roleplay/chat-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            age,
            temperament,
            persona: personaData,
            objections: objectionsWithRebuttals,
            objective: selectedObjectiveData,
          },
          userId: userId,
          companyId: companyId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Erro da API:', data)
        throw new Error(data.error || 'Erro ao iniciar roleplay')
      }

      setSessionIdN8N(data.sessionId)
      if (data.clientName) {
        setClientName(data.clientName)
        console.log('✅ ClientName salvo no estado:', data.clientName)
        // Também salvar no sessionStorage como backup
        sessionStorage.setItem('roleplayClientName', data.clientName)
      } else {
        console.warn('⚠️ ClientName não retornado do backend')
        // Tentar recuperar do sessionStorage se existir
        const storedClientName = sessionStorage.getItem('roleplayClientName')
        if (storedClientName) {
          console.log('📦 Recuperando clientName do sessionStorage:', storedClientName)
          setClientName(storedClientName)
        }
      }

      // Criar descrição resumida para o banco (campo segment)
      let segmentDescription = 'Não especificado'
      if (personaData.business_type === 'B2B') {
        segmentDescription = personaData.cargo || 'Não especificado'
        if (personaData.tipo_empresa_faturamento) segmentDescription += ` de ${personaData.tipo_empresa_faturamento}`
      } else if (personaData.business_type === 'B2C') {
        segmentDescription = personaData.profissao || 'Não especificado'
      }

      // Criar sessão no Supabase (usando sessionId do N8N como thread_id)
      const session = await createRoleplaySession(data.sessionId, {
        age,
        temperament,
        segment: segmentDescription,
        objections: objectionsWithRebuttals,
        client_name: data.clientName, // Salvar o nome do cliente
        objective: selectedObjectiveData, // Salvar o objetivo do roleplay
      })

      if (session) {
        setSessionId(session.id)
        console.log('💾 Sessão salva no Supabase:', session.id)

        // Incrementar contador de roleplays após criação bem-sucedida
        await incrementRoleplay()
        console.log('📊 Contador de roleplays incrementado')
      }

      // Adicionar primeira mensagem do cliente
      const firstMessage: RoleplayMessage = {
        role: 'client',
        text: data.message,
        timestamp: new Date().toISOString()
      }

      setMessages([{ role: 'client', text: data.message }])

      // Salvar mensagem no Supabase (roleplay_sessions)
      if (session) {
        await addMessageToSession(session.id, firstMessage)
      }

      // N8N Postgres Chat Memory salva automaticamente as mensagens em roleplay_chat_memory

      // Converter a primeira mensagem em áudio e tocar
      await textToSpeech(data.message)
    } catch (error) {
      console.error('❌ Erro ao iniciar roleplay:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      alert(`Erro ao iniciar roleplay: ${errorMessage}`)
      setIsSimulating(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndSession = async () => {
    console.log('🛑 Encerrando simulação...')

    // Parar webcam
    stopWebcam()

    // Parar gravação se estiver ativa
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      } catch (e) {
        console.log('Erro ao parar gravação:', e);
      }
    }

    // Limpar timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Fechar stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Parar áudio se estiver tocando
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Limpar visualizador de áudio
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsPlayingAudio(false);
    setAudioVolume(0);

    // Resetar estados
    setIsSimulating(false);
    setIsRecording(false);
    setClientName('Cliente'); // Reset clientName
    setRoleplayConfig(null); // Limpar configuração do roleplay
    sessionStorage.removeItem('roleplayClientName'); // Limpar sessionStorage
    sessionStorage.removeItem('roleplayConfig'); // Limpar configuração do roleplay
    setIsProcessingTranscription(false);
    setCurrentTranscription('');
    setLastUserMessage('');
    setShowFinalizingMessage(false);

    // Iniciar avaliação se tiver sessionId
    if (sessionId && !isEvaluating) {
      console.log('📊 Iniciando avaliação...');
      setIsEvaluating(true);

      try {
        // Primeiro, atualizar o status da sessão para 'completed'
        console.log('📝 Finalizando sessão no banco de dados...');
        await endRoleplaySession(sessionId, 'completed');

        // Obter mensagens
        const messages = await getRoleplaySession(sessionId);

        // Enviar para avaliação
        const evaluationResponse = await fetch('/api/roleplay/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            messages: messages?.messages || [],
            config: messages?.config || {}
          }),
        });

        if (evaluationResponse.ok) {
          const result = await evaluationResponse.json();
          console.log('📦 Resposta da API:', result);

          // A API retorna {success: true, evaluation: {...}}
          let parsedEvaluation = result.evaluation || result;

          // Se ainda tiver formato legado (com 'output'), fazer o parse
          if (parsedEvaluation && typeof parsedEvaluation === 'object' && 'output' in parsedEvaluation) {
            try {
              parsedEvaluation = JSON.parse(parsedEvaluation.output);
            } catch (e) {
              console.error('Failed to parse evaluation:', e);
            }
          }

          console.log('✅ Avaliação processada:', parsedEvaluation);
          setEvaluation(parsedEvaluation);

          // Atualizar o resumo de performance após avaliação
          const { supabase } = await import('@/lib/supabase')
          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            try {
              await fetch('/api/performance-summary/update', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: user.id }),
              })
              console.log('✅ Resumo de performance atualizado')
            } catch (error) {
              console.error('Erro ao atualizar resumo de performance:', error)
            }
          }
        } else {
          console.error('Erro ao obter avaliação');
        }
      } catch (error) {
        console.error('Erro durante avaliação:', error);
      } finally {
        setIsEvaluating(false);
        setShowEvaluationSummary(true); // Mostrar modal de resumo
      }
    } else {
      console.log('📊 Pulando avaliação - sem sessionId');
    }
  }

  // Função para encerrar sessão SEM avaliação (quando usuário encerra manualmente)
  const handleEndSessionWithoutEvaluation = async () => {
    console.log('🛑 Encerrando simulação SEM avaliação (encerramento manual)...')

    // Parar webcam
    stopWebcam()

    // Parar gravação se estiver ativa
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      } catch (e) {
        console.log('Erro ao parar gravação:', e);
      }
    }

    // Limpar timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Fechar stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Parar áudio se estiver tocando
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Limpar visualizador de áudio
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsPlayingAudio(false);
    setAudioVolume(0);

    // Resetar estados
    setIsSimulating(false);
    setIsRecording(false);
    setClientName('Cliente');
    setRoleplayConfig(null);
    sessionStorage.removeItem('roleplayClientName');
    sessionStorage.removeItem('roleplayConfig');
    setIsProcessingTranscription(false);
    setCurrentTranscription('');
    setLastUserMessage('');
    setShowFinalizingMessage(false);

    // Marcar sessão como cancelada (sem avaliação)
    if (sessionId) {
      try {
        await endRoleplaySession(sessionId, 'cancelled');
        console.log('📝 Sessão marcada como cancelada (sem avaliação)');
      } catch (error) {
        console.error('Erro ao marcar sessão como cancelada:', error);
      }
    }

    // NÃO inicia avaliação - sessão encerrada manualmente
    console.log('⚠️ Avaliação pulada - encerramento manual pelo usuário');
  }

  const handleSendMessage = async (messageToSend?: string) => {
    console.log('🔍 handleSendMessage chamada com:', messageToSend)
    console.log('🔍 inputMessage atual:', inputMessage)
    console.log('🔍 isLoading:', isLoading)
    console.log('🔍 sessionIdN8N:', sessionIdN8N)
    console.log('🔍 isSimulating:', isSimulating)
    console.log('🔍 roleplayConfig atual:', roleplayConfig)
    console.log('🔍 Estados atuais - age:', age, 'temperament:', temperament, 'selectedPersona:', selectedPersona)

    // Verificar se a simulação ainda está ativa
    if (!isSimulating) {
      console.log('⚠️ Simulação foi encerrada, cancelando envio')
      return
    }

    const message = messageToSend || inputMessage.trim()

    if (!message) {
      console.log('❌ Mensagem vazia, não enviando')
      return
    }

    if (!sessionIdN8N) {
      console.log('❌ Sem sessionId, não enviando')
      return
    }

    if (isLoading) {
      console.log('⚠️ Já está carregando, não enviando')
      return
    }

    const userMessage = message
    console.log('📤 Enviando mensagem:', userMessage)
    setInputMessage('')

    // Buscar userId e companyId
    const { supabase } = await import('@/lib/supabase')
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    const { getCompanyIdFromUserId } = await import('@/lib/utils/getCompanyId')
    const companyId = await getCompanyIdFromUserId(userId!)

    // Adicionar mensagem do vendedor
    setMessages(prev => [...prev, { role: 'seller', text: userMessage }])
    setIsLoading(true)

    // Salvar mensagem do vendedor no Supabase
    if (sessionId) {
      const sellerMessage: RoleplayMessage = {
        role: 'seller',
        text: userMessage,
        timestamp: new Date().toISOString()
      }
      await addMessageToSession(sessionId, sellerMessage)
    }

    try {
      // Tentar recuperar configuração do estado ou sessionStorage
      let currentConfig = roleplayConfig
      if (!currentConfig) {
        const storedConfig = sessionStorage.getItem('roleplayConfig')
        if (storedConfig) {
          console.log('📦 Recuperando configuração do sessionStorage')
          currentConfig = JSON.parse(storedConfig)
        }
      }

      // Usar configuração salva do roleplay ou buscar dados atuais
      let selectedPersonaData = currentConfig?.selectedPersona
      let objectionsWithRebuttals = currentConfig?.objections
      let savedAge = currentConfig?.age || age
      let savedTemperament = currentConfig?.temperament || temperament

      // Se não tiver configuração salva, buscar dados atuais (fallback)
      if (!currentConfig) {
        console.warn('⚠️ Configuração do roleplay não encontrada, buscando dados atuais...')
        selectedPersonaData = personas.find(p => p.id === selectedPersona)
        const selectedObjectionsData = objections.filter(o => selectedObjections.includes(o.id))

        // Formatar objeções com suas formas de quebra E incluir o ID
        objectionsWithRebuttals = selectedObjectionsData.map(o => ({
          id: o.id,  // IMPORTANTE: Incluir o ID real do banco
          name: o.name,
          rebuttals: o.rebuttals || []
        }))

        savedAge = age
        savedTemperament = temperament
      }

      // Debug do clientName e outros estados
      console.log('🔍 Estado atual antes de enviar:', {
        clientName,
        age: savedAge,
        temperament: savedTemperament,
        selectedPersona,
        sessionIdN8N,
        personaData: (selectedPersonaData as any)?.cargo || (selectedPersonaData as any)?.profissao || selectedPersonaData?.profile_type,
        selectedObjections,
        objectionsWithRebuttals
      })

      console.log('🔍 Valores que serão enviados ao N8N:', {
        clientName,
        age: savedAge,
        temperament: savedTemperament,
        persona: selectedPersonaData,
        objections: objectionsWithRebuttals
      })

      // Garantir que temos um clientName válido - tentar recuperar do sessionStorage se necessário
      let currentClientName = clientName
      if (!currentClientName || currentClientName === 'Cliente') {
        const storedClientName = sessionStorage.getItem('roleplayClientName')
        if (storedClientName) {
          console.log('🔄 Recuperando clientName perdido do sessionStorage:', storedClientName)
          currentClientName = storedClientName
          // Atualizar o estado também
          setClientName(storedClientName)
        } else {
          currentClientName = 'Cliente'
        }
      }
      console.log('📤 Enviando com clientName:', currentClientName)

      // Enviar para API direta (chat-v2)
      const payload = {
        sessionId: sessionIdN8N,
        message: userMessage,
        userId: userId,
        companyId: companyId,
        // Enviar também os dados de contexto para manter consistência
        clientName: currentClientName,
        age: savedAge,
        temperament: savedTemperament,
        persona: selectedPersonaData,
        objections: objectionsWithRebuttals,
        objective: roleplayConfig?.objective, // Enviar objetivo do roleplay
        // NOVO: Enviar histórico de mensagens para manter contexto
        chatHistory: messages
      }

      console.log('📦 PAYLOAD COMPLETO sendo enviado:', JSON.stringify(payload, null, 2))

      const response = await fetch('/api/roleplay/chat-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        // Tratamento de erros específicos da API v2
        if (data.code === 'CONTEXT_TOO_LONG') {
          throw new Error('A conversa ficou muito longa. Por favor, finalize esta sessão e inicie uma nova.')
        } else if (data.code === 'RATE_LIMIT') {
          throw new Error('Muitas requisições. Aguarde alguns segundos e tente novamente.')
        } else {
          throw new Error(data.error || 'Erro ao enviar mensagem')
        }
      }

      console.log('✅ Resposta do cliente recebida:', data.message)

      // Adicionar resposta do cliente
      setMessages(prev => [...prev, { role: 'client', text: data.message }])

      // Verificar se a mensagem contém a frase de finalização
      const isFinalizationMessage = data.message.includes('Roleplay finalizado, aperte em finalizar sessão')

      if (isFinalizationMessage) {
        console.log('🎯 Detectada mensagem de finalização do roleplay!')
      }

      // Salvar mensagem do cliente no Supabase (roleplay_sessions)
      if (sessionId) {
        const clientMessage: RoleplayMessage = {
          role: 'client',
          text: data.message,
          timestamp: new Date().toISOString()
        }
        await addMessageToSession(sessionId, clientMessage)
      }

      // N8N Postgres Chat Memory salva automaticamente as mensagens em roleplay_chat_memory

      // Converter resposta em áudio e tocar
      await textToSpeech(data.message, isFinalizationMessage)
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error)
      alert(error.message || 'Erro ao enviar mensagem. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleObjection = (objectionId: string) => {
    if (selectedObjections.includes(objectionId)) {
      setSelectedObjections(selectedObjections.filter(id => id !== objectionId))
    } else {
      setSelectedObjections([...selectedObjections, objectionId])
    }
  }

  const startRecording = async () => {
    try {
      console.log('🎤 Iniciando gravação...')

      // Limpar estados anteriores que podem estar travados
      setCurrentTranscription('')

      // Garantir que stream anterior esteja parado
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Configurar MediaRecorder com qualidade otimizada para Whisper
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 32000  // Taxa aumentada para melhor qualidade (era 16000)
      }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('🛑 MediaRecorder.onstop disparado!')
        console.log('🛑 Chunks de áudio capturados:', audioChunksRef.current.length)

        // Garantir que o indicador seja removido imediatamente
        setIsRecording(false)

        if (audioChunksRef.current.length === 0) {
          console.log('⚠️ Nenhum chunk de áudio capturado!')
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        console.log('📦 Blob de áudio criado, tamanho:', audioBlob.size, 'bytes')

        // Verificar se o áudio não está muito grande (limite de 10MB)
        const MAX_SIZE = 10 * 1024 * 1024 // 10MB
        if (audioBlob.size > MAX_SIZE) {
          console.error('❌ Áudio muito grande:', (audioBlob.size / (1024 * 1024)).toFixed(2), 'MB')
          alert('Gravação muito longa! Tente falar por menos tempo (máximo 2 minutos).')
          setIsRecording(false)
          return
        }

        // Fechar stream
        stream.getTracks().forEach(track => {
          track.stop()
          console.log('🔇 Track parada:', track.label)
        })

        // Limpar referências
        mediaRecorderRef.current = null
        streamRef.current = null

        // Transcrever o áudio
        console.log('📝 Enviando para transcrição...')
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)

    } catch (error) {
      console.error('Erro ao acessar microfone:', error)
      alert('Erro ao acessar o microfone. Verifique as permissões.')
      // Garantir reset dos estados em caso de erro
      setIsRecording(false)
      setIsLoading(false)
      streamRef.current = null
      mediaRecorderRef.current = null
    }
  }

  const stopRecording = () => {
    console.log('🛑 stopRecording chamada')
    console.log('🛑 Estado atual - isRecording:', isRecording)
    console.log('🛑 MediaRecorder existe?', !!mediaRecorderRef.current)
    console.log('🛑 MediaRecorder state:', mediaRecorderRef.current?.state)

    // Limpar timer de silêncio
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
      console.log('✅ Timer de silêncio limpo')
    }

    // Parar gravação se existir
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          console.log('📝 Parando MediaRecorder...')
          mediaRecorderRef.current.stop()
          // NÃO setar para null aqui, pois o onstop precisa dele
        } else {
          console.log('⚠️ MediaRecorder não está gravando, state:', mediaRecorderRef.current.state)
        }
      } catch (error) {
        console.error('❌ Erro ao parar MediaRecorder:', error)
      }
    } else {
      console.log('⚠️ MediaRecorder não existe')
    }

    // NÃO fechar o stream aqui, deixar o onstop fazer isso
    setIsRecording(false)
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    console.log('📝 Iniciando transcrição do áudio...')

    // Verificar se a simulação ainda está ativa
    if (!isSimulating) {
      console.log('⚠️ Simulação foi encerrada, cancelando transcrição')
      setIsRecording(false)
      setIsProcessingTranscription(false)
      setCurrentTranscription('')
      return
    }

    // Garantir que o indicador de gravação seja removido
    setIsRecording(false)
    setIsProcessingTranscription(true)
    setCurrentTranscription('⏳ Processando sua fala...')

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      // Adicionar companyId para melhorar a transcrição com contexto
      if (currentCompanyId) {
        formData.append('companyId', currentCompanyId)
      }

      const response = await fetch('/api/roleplay/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Erro na transcrição:', data.error)
        throw new Error(data.error || 'Erro ao transcrever áudio')
      }

      console.log('✅ Texto transcrito:', data.text)

      // Validar e processar a transcrição
      const processed = processWhisperTranscription(data.text)

      if (!processed.isValid) {
        console.warn('⚠️ Transcrição inválida detectada:', data.text)
        setCurrentTranscription('❌ Não consegui entender. Tente falar novamente.')
        setLastUserMessage('')
        // Aguardar antes de limpar a mensagem de erro
        setTimeout(() => setCurrentTranscription(''), 3000)
        return
      }

      if (processed.hasRepetition) {
        console.warn('⚠️ Repetições detectadas e corrigidas:', {
          original: data.text,
          cleaned: processed.text
        })
      }

      // Mostrar a transcrição processada na tela
      if (processed.text) {
        // Adicionar indicador de confiança
        const confidenceIcon = processed.confidence === 'high' ? '✅' :
                               processed.confidence === 'medium' ? '⚠️' : '❓'
        setCurrentTranscription(`${confidenceIcon} Entendi: "${processed.text}"`)
        setLastUserMessage(processed.text)

        // Aguardar um momento para o usuário ver antes de enviar
        await new Promise(resolve => setTimeout(resolve, 800))
      }

      // Enviar automaticamente após transcrever se houver texto válido
      if (processed.text && processed.text.trim()) {
        console.log('📤 Enviando mensagem transcrita...')
        setCurrentTranscription('📤 Enviando sua mensagem...')

        // Chamar handleSendMessage diretamente com o texto processado
        await handleSendMessage(processed.text.trim())

        // Mostrar confirmação de envio
        setCurrentTranscription('✅ Mensagem enviada!')
        setTimeout(() => {
          setCurrentTranscription('')
          setLastUserMessage('')
        }, 1500)
      } else {
        console.log('⚠️ Transcrição vazia ou apenas espaços')
        setCurrentTranscription('❌ Não consegui entender, tente novamente')
        setTimeout(() => setCurrentTranscription(''), 2000)
      }
    } catch (error) {
      console.error('Erro ao transcrever áudio:', error)
      setCurrentTranscription('❌ Erro ao processar áudio')
      setTimeout(() => setCurrentTranscription(''), 2000)
    } finally {
      setIsLoading(false)
      setIsProcessingTranscription(false)
      setIsRecording(false) // Garantir que está false
    }
  }

  // Função para converter texto em áudio e tocar
  const textToSpeech = async (text: string, isFinalizationMessage: boolean = false) => {
    try {
      console.log('🔊 Enviando texto para TTS:', text)
      setIsPlayingAudio(true)

      // Enviar texto para TTS via API proxy
      const response = await fetch('/api/roleplay/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error('Erro ao gerar áudio')
      }

      // Receber o áudio
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // Criar e tocar o áudio
      if (audioRef.current) {
        audioRef.current.pause()
      }

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      // Configurar visualizador de áudio
      setupAudioVisualizer(audio)

      // Função para limpar estado do áudio
      const cleanupAudio = () => {
        setIsPlayingAudio(false)
        setAudioVolume(0)
        URL.revokeObjectURL(audioUrl)

        // Limpar animação
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
      }

      // Quando o áudio terminar, limpar visualizador e possivelmente finalizar
      audio.onended = () => {
        cleanupAudio()
        console.log('🔊 Áudio do cliente finalizado')

        // Se for mensagem de finalização, finalizar automaticamente
        if (isFinalizationMessage) {
          console.log('🎯 Finalizando roleplay automaticamente...')
          setShowFinalizingMessage(true)

          // Aguardar 2 segundos após o áudio terminar
          setTimeout(() => {
            handleEndSession()
          }, 2000)
        } else {
          console.log('🔊 Aguardando usuário clicar no microfone')
        }
      }

      // Tratar erros de áudio
      audio.onerror = (e) => {
        console.error('❌ Erro no elemento de áudio:', e)
        cleanupAudio()
      }

      // Tocar o áudio
      try {
        await audio.play()
        console.log('🔊 Áudio tocando')
      } catch (playError) {
        console.error('❌ Erro ao reproduzir áudio (autoplay blocked?):', playError)
        cleanupAudio()
      }
    } catch (error) {
      console.error('❌ Erro ao converter texto em áudio:', error)
      setIsPlayingAudio(false)
      setAudioVolume(0)
    }
  }

  // Configurar visualizador de áudio
  const setupAudioVisualizer = (audio: HTMLAudioElement) => {
    try {
      // Criar contexto de áudio se não existir
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const audioContext = audioContextRef.current
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 128 // Menor FFT = mais responsivo aos picos
      analyser.smoothingTimeConstant = 0.3 // Menos suavização = mais reativo

      const source = audioContext.createMediaElementSource(audio)
      source.connect(analyser)
      analyser.connect(audioContext.destination)

      audioAnalyserRef.current = analyser

      // Analisar volume em tempo real
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateVolume = () => {
        if (!audioAnalyserRef.current || !isPlayingAudio) return

        analyser.getByteFrequencyData(dataArray)

        // Focar nas frequências médias/altas (fala humana)
        const relevantFrequencies = dataArray.slice(5, 40)
        const average = relevantFrequencies.reduce((a, b) => a + b, 0) / relevantFrequencies.length

        // Normalizar e AMPLIFICAR MUITO para visualização dramática
        const normalizedVolume = Math.min((average / 80) * 2.5, 1.2) // Permite ultrapassar 1
        setAudioVolume(normalizedVolume)

        animationFrameRef.current = requestAnimationFrame(updateVolume)
      }

      updateVolume()
    } catch (error) {
      console.error('Erro ao configurar visualizador de áudio:', error)
    }
  }

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />

      {/* Interface de Videochamada - Exibida durante a sessão ativa */}
      {isSimulating && (
        <div className="fixed inset-0 bg-[#1a1a1a] z-50 flex flex-col">
          {/* Header minimalista */}
          <div className="flex justify-between items-center px-6 py-3 border-b border-gray-800">
            <span className="text-white/60 text-sm">Roleplay em andamento</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowChatSidebar(!showChatSidebar)}
                className={`p-2 rounded-lg transition-colors ${showChatSidebar ? 'bg-green-600/20 text-green-400' : 'hover:bg-gray-800 text-white/70'}`}
                title="Mostrar/Ocultar Chat"
              >
                <MessageCircle size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Área dos vídeos */}
            <div className={`flex-1 flex items-center justify-center gap-4 p-6 transition-all ${showChatSidebar ? 'pr-0' : ''}`}>
              {/* Avatar do Cliente Virtual (gerado por IA) */}
              <div className="flex-1 max-w-[600px] aspect-video bg-gray-800 rounded-xl flex items-center justify-center relative overflow-hidden">
                {isLoadingAvatar ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-700">
                    <Loader2 className="w-16 h-16 text-green-400 animate-spin mb-4" />
                    <span className="text-gray-300 text-sm font-medium">Gerando avatar com IA...</span>
                    <span className="text-gray-500 text-xs mt-1">Aguarde ~10 segundos</span>
                  </div>
                ) : (
                  <img
                    src={avatarUrl || '/icone-call.png'}
                    alt="Cliente Virtual"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/icone-call.png'
                    }}
                  />
                )}
                {isPlayingAudio && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 text-green-400 text-sm bg-black/50 px-3 py-1.5 rounded-full">
                    <Volume2 size={16} className="animate-pulse" />
                    <span>Falando...</span>
                  </div>
                )}
                {isLoading && !isPlayingAudio && !isLoadingAvatar && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 text-gray-400 text-sm bg-black/50 px-3 py-1.5 rounded-full">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processando...</span>
                  </div>
                )}
                <div className="absolute top-4 left-4 text-white/40 text-xs font-medium">Cliente Virtual</div>
              </div>

              {/* Webcam usuário */}
              <div className="flex-1 max-w-[600px] aspect-video bg-gray-900 rounded-xl overflow-hidden relative">
                {isCameraOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <UserCircle2 className="w-24 h-24 text-gray-600" />
                  </div>
                )}
                {isRecording && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 text-red-400 text-sm bg-black/50 px-3 py-1.5 rounded-full">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span>Gravando...</span>
                  </div>
                )}
                <div className="absolute top-4 left-4 text-white/40 text-xs font-medium">Você</div>
              </div>
            </div>

            {/* Chat Sidebar */}
            {showChatSidebar && (
              <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                  <MessageCircle size={18} className="text-green-400" />
                  <h3 className="text-white font-medium">Chat da Simulação</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">Aguardando início da conversa...</p>
                  ) : (
                    messages.map((msg, i) => (
                      <div key={i} className={`p-3 rounded-lg text-sm ${
                        msg.role === 'seller'
                          ? 'bg-green-600/20 text-green-100 ml-4'
                          : 'bg-gray-800 text-gray-100 mr-4'
                      }`}>
                        <span className="text-xs opacity-60 block mb-1">
                          {msg.role === 'seller' ? 'Você' : 'Cliente'}
                        </span>
                        {msg.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex justify-center items-center gap-4 p-6 bg-[#1a1a1a] border-t border-gray-800">
            {/* Botão Câmera */}
            <button
              onClick={toggleCamera}
              className={`p-4 rounded-full transition-colors ${
                isCameraOn
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              }`}
              title={isCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
            >
              {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>

            {/* Botão Microfone */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isPlayingAudio || isLoading || showFinalizingMessage}
              className={`p-4 rounded-full transition-colors ${
                isRecording
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              } ${(isPlayingAudio || isLoading || showFinalizingMessage) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
            >
              {isRecording ? <Mic size={24} /> : <MicOff size={24} />}
            </button>

            {/* Botão Encerrar */}
            <button
              onClick={() => setShowEndSessionWarning(true)}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
              title="Encerrar chamada"
            >
              <PhoneOff size={24} />
            </button>
          </div>

          {/* Modal de Aviso ao Encerrar */}
          {showEndSessionWarning && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
              <div className="bg-gray-800 rounded-2xl p-6 max-w-md mx-4 border border-red-500/50 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-500/20 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Encerrar Roleplay?</h3>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 text-sm font-medium mb-2">
                      ⚠️ Atenção: Você NÃO receberá avaliação!
                    </p>
                    <p className="text-gray-300 text-sm">
                      Ao encerrar manualmente, a sessão será cancelada e você não receberá feedback sobre sua performance.
                    </p>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-400 text-sm font-medium mb-2">
                      ✓ Para receber avaliação:
                    </p>
                    <p className="text-gray-300 text-sm">
                      Continue o roleplay até concluir uma <strong>call to action</strong> (agendamento, venda, próximo passo). A sessão finalizará automaticamente e você receberá sua avaliação completa.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEndSessionWarning(false)}
                    className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                  >
                    Continuar Roleplay
                  </button>
                  <button
                    onClick={() => {
                      setShowEndSessionWarning(false)
                      handleEndSessionWithoutEvaluation()
                    }}
                    className="flex-1 py-3 px-4 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-medium transition-colors"
                  >
                    Encerrar sem Avaliação
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Tela de Configuração - Layout integrado com fundo branco */}
      <div className={`min-h-screen relative z-10 py-8 px-6 ${isSimulating ? 'hidden' : ''}`}>
        <div className="max-w-6xl mx-auto">
          {/* Header com título e contador */}
          <div className={`mb-6 flex items-start justify-between ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            {/* Título à esquerda */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Simulação de Vendas</h1>
              <p className="text-gray-500 mt-1">
                Pratique suas habilidades de vendas com nosso cliente sintético inteligente.
              </p>
            </div>

            {/* Contador de Créditos à direita */}
            {planUsage && (
              <div className={`flex items-center gap-2 ${
                planUsage.training?.credits?.limit !== null && planUsage.training?.credits?.used >= planUsage.training?.credits?.limit
                  ? 'text-red-500'
                  : 'text-green-500'
              }`}>
                <Zap className="w-6 h-6" />
                <span className="text-2xl font-bold">
                  {planUsage.training?.credits?.used || 0}/{planUsage.training?.credits?.limit === null ? '∞' : planUsage.training?.credits?.limit || 0}
                </span>
              </div>
            )}
          </div>

          {/* Painel de Configuração */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              {/* Loading Skeleton */}
              {dataLoading ? (
                <div className="relative">
                  {/* Animação de 3 bolinhas aparecendo uma de cada vez */}
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <style dangerouslySetInnerHTML={{ __html: `
                      @keyframes dotSequence {
                        0%, 100% { opacity: 0; transform: scale(0.5); }
                        20%, 80% { opacity: 1; transform: scale(1); }
                      }
                      .seq-dot-1 { animation: dotSequence 1.8s ease-in-out infinite; }
                      .seq-dot-2 { animation: dotSequence 1.8s ease-in-out infinite; animation-delay: 0.3s; }
                      .seq-dot-3 { animation: dotSequence 1.8s ease-in-out infinite; animation-delay: 0.6s; }
                    `}} />
                    <div className="flex gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full seq-dot-1" />
                      <div className="w-3 h-3 bg-green-500 rounded-full seq-dot-2" />
                      <div className="w-3 h-3 bg-green-500 rounded-full seq-dot-3" />
                    </div>
                  </div>
                  {/* Skeleton de fundo */}
                  <div className="animate-pulse opacity-50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Coluna 1 - Skeleton */}
                      <div className="space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-32" />
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                          <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
                          <div className="h-2 bg-gray-200 rounded w-full mb-4" />
                          <div className="h-16 bg-gray-200 rounded" />
                        </div>
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                          <div className="h-4 bg-gray-200 rounded w-28 mb-3" />
                          <div className="flex gap-2">
                            {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-gray-200 rounded w-20" />)}
                          </div>
                        </div>
                      </div>
                      {/* Coluna 2 - Skeleton */}
                      <div className="space-y-4">
                        <div className="h-4 bg-gray-200 rounded w-40" />
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                          <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
                          <div className="space-y-2">
                            {[1,2,3,4,5,6].map(i => <div key={i} className="h-12 bg-gray-200 rounded" />)}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                          <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
                          <div className="space-y-2">
                            {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-gray-200 rounded" />)}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                          <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
                          <div className="h-10 bg-gray-200 rounded" />
                        </div>
                      </div>
                    </div>
                    <div className="h-14 bg-gray-200 rounded-xl mt-4" />
                  </div>
                </div>
              ) : (
              <>
              {/* Layout em 2 linhas */}
              {/* Linha 1: Iniciar Simulação + Perfil do Cliente */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Coluna 1 - Iniciar Simulação */}
                <div className="flex flex-col">
                  {/* Botões Aleatório e Oculto */}
                  <div className="flex gap-2 mb-4">
                    {/* Botão Aleatório com Tooltip */}
                    <div className="relative group">
                      <button
                        onClick={handleRandomSelection}
                        disabled={dataLoading || personas.length === 0 || objections.length === 0 || objectives.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all hover:scale-105 shadow-sm"
                      >
                        <Shuffle className="w-4 h-4" />
                        Aleatório
                      </button>
                      <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-white/70 backdrop-blur-md border border-gray-200 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <p className="font-semibold text-green-600 mb-1">Modo Aleatório</p>
                        <p className="text-gray-800 leading-relaxed">
                          Seleciona automaticamente uma persona, objeções e objetivo de forma aleatória para treinar situações variadas e inesperadas.
                        </p>
                        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white/70 border-l border-t border-gray-200 rotate-45"></div>
                      </div>
                    </div>

                    {/* Botão Ocultar com Tooltip */}
                    <div className="relative group">
                      <button
                        onClick={() => setHiddenMode(!hiddenMode)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all hover:scale-105 shadow-sm ${
                          hiddenMode
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        {hiddenMode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {hiddenMode ? 'Mostrar' : 'Ocultar'}
                      </button>
                      <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-white/70 backdrop-blur-md border border-gray-200 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <p className="font-semibold text-green-600 mb-1">Modo Oculto</p>
                        <p className="text-gray-800 leading-relaxed">
                          {hiddenMode
                            ? 'Clique para revelar as seleções de persona, objeções e objetivo durante a simulação.'
                            : 'Esconde as seleções durante o roleplay para simular uma ligação real onde você não sabe quem está do outro lado.'}
                        </p>
                        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white/70 border-l border-t border-gray-200 rotate-45"></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center flex-1">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">Iniciar Simulação</h3>
                  <button
                    onClick={handleStartSimulation}
                    disabled={roleplayLimitReached || dataLoading || !selectedPersona || selectedObjections.length === 0 || !selectedObjective}
                    className={`w-40 h-40 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                      roleplayLimitReached || dataLoading || !selectedPersona || selectedObjections.length === 0 || !selectedObjective
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 hover:scale-105 hover:shadow-green-500/30 hover:shadow-xl cursor-pointer'
                    }`}
                  >
                    <Phone className={`w-20 h-20 ${
                      roleplayLimitReached || dataLoading || !selectedPersona || selectedObjections.length === 0 || !selectedObjective
                        ? 'text-gray-400'
                        : 'text-white'
                    }`} />
                  </button>
                  <p className={`text-sm mt-4 text-center font-medium ${
                    roleplayLimitReached ? 'text-red-500' : dataLoading ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {dataLoading ? 'Carregando...' : roleplayLimitReached ? 'Limite atingido' :
                      (!selectedPersona || selectedObjections.length === 0 || !selectedObjective) ? 'Configure a sessão' : 'Clique para iniciar'}
                  </p>
                  </div>
                </div>

                {/* Coluna 2 - Perfil do Cliente */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Perfil do Cliente</h3>

                  {/* Idade do Cliente */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700">Idade do Cliente</label>
                      <span className={`text-lg font-bold ${hiddenMode ? 'text-gray-400' : 'text-green-600'}`}>
                        {hiddenMode ? '?? anos' : `${age} anos`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="18"
                      max="60"
                      value={hiddenMode ? 39 : age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                        hiddenMode
                          ? 'bg-gray-300 accent-gray-400 pointer-events-none'
                          : 'bg-gray-200 accent-green-500'
                      }`}
                    />
                    <div className={`flex justify-between text-xs mt-2 ${hiddenMode ? 'text-gray-300' : 'text-gray-400'}`}>
                      <span>18</span>
                      <span>60</span>
                    </div>

                    {/* Info da faixa etária */}
                    <div className="mt-3 bg-white rounded-lg p-2 border border-gray-200">
                      {hiddenMode ? (
                        <div className="bg-gray-100 rounded p-2">
                          <p className="text-xs font-medium text-gray-400 mb-1">Faixa etária</p>
                          <p className="text-[10px] text-gray-400">••••••••••••••</p>
                        </div>
                      ) : (
                        <>
                          {age >= 18 && age <= 24 && (
                            <div>
                              <p className="text-xs font-medium text-blue-600 mb-1">18 a 24 anos</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Tom:</span> Informal e moderno</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Comportamento:</span> Aceita novidades</p>
                            </div>
                          )}
                          {age >= 25 && age <= 34 && (
                            <div>
                              <p className="text-xs font-medium text-green-600 mb-1">25 a 34 anos</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Tom:</span> Pragmático e orientado a resultados</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Comportamento:</span> Foco em ROI • Aceita risco calculado</p>
                            </div>
                          )}
                          {age >= 35 && age <= 44 && (
                            <div>
                              <p className="text-xs font-medium text-yellow-600 mb-1">35 a 44 anos</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Tom:</span> Equilibrado entre desempenho e estabilidade</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Comportamento:</span> Valoriza compliance • Cauteloso</p>
                            </div>
                          )}
                          {age >= 45 && age <= 60 && (
                            <div>
                              <p className="text-xs font-medium text-orange-600 mb-1">45 a 60 anos</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Tom:</span> Conservador e formal</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Comportamento:</span> Foco em segurança • Avesso a riscos</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Temperamento */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <label className="text-sm font-medium text-gray-700 mb-3 block">Temperamento</label>
                    <div className={`flex flex-wrap gap-2 ${hiddenMode ? 'blur-sm select-none pointer-events-none' : ''}`}>
                      {temperaments.map((temp) => (
                        <button
                          key={temp}
                          onClick={() => setTemperament(temp)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            hiddenMode
                              ? 'bg-gray-300 text-gray-500 border border-gray-300'
                              : temperament === temp
                                ? 'bg-green-500 text-white border border-green-500'
                                : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {temp}
                        </button>
                      ))}
                    </div>

                    {/* Info do temperamento */}
                    <div className="mt-3 bg-white rounded-lg p-2 border border-gray-200">
                      {hiddenMode ? (
                        <div className="bg-gray-100 rounded p-2">
                          <p className="text-xs font-medium text-gray-400 mb-1">Temperamento</p>
                          <p className="text-[10px] text-gray-400">••••••••••••••</p>
                        </div>
                      ) : (
                        <>
                          {temperament === 'Analítico' && (
                            <div>
                              <p className="text-xs font-medium text-green-600 mb-1">Analítico</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Estilo:</span> Formal, racional, calmo e preciso</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Gatilhos:</span> Dados concretos, estatísticas</p>
                            </div>
                          )}
                          {temperament === 'Empático' && (
                            <div>
                              <p className="text-xs font-medium text-pink-600 mb-1">Empático</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Estilo:</span> Afável, próximo, gentil e emocional</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Gatilhos:</span> Histórias reais, propósito</p>
                            </div>
                          )}
                          {temperament === 'Determinado' && (
                            <div>
                              <p className="text-xs font-medium text-red-600 mb-1">Determinado</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Estilo:</span> Objetivo, seguro, impaciente e assertivo</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Gatilhos:</span> Soluções rápidas, eficiência</p>
                            </div>
                          )}
                          {temperament === 'Indeciso' && (
                            <div>
                              <p className="text-xs font-medium text-yellow-600 mb-1">Indeciso</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Estilo:</span> Hesitante, cauteloso e questionador</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Gatilhos:</span> Depoimentos, garantias, segurança</p>
                            </div>
                          )}
                          {temperament === 'Sociável' && (
                            <div>
                              <p className="text-xs font-medium text-cyan-600 mb-1">Sociável</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Estilo:</span> Leve, animado, entusiasmado e informal</p>
                              <p className="text-[10px] text-gray-500"><span className="text-gray-700">Gatilhos:</span> Amizade, humor, energia positiva</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Linha 2: Persona + Objeções */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Coluna 1 - Persona */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Persona</h3>

                  {/* Persona */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    {dataLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                      </div>
                    ) : (businessType === 'Ambos' ? personas : personas.filter(p => p.business_type === businessType)).length === 0 ? (
                      <div className="text-gray-500 text-sm py-4 text-center">
                        Nenhuma persona {businessType} cadastrada.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {(() => {
                          const { sortedGroups, noTagPersonas } = getGroupedPersonas()
                          return (
                            <>
                              {sortedGroups.map(({ tag, personas: groupPersonas }) => (
                                <div key={tag.id} className="space-y-2">
                                  <div className="flex items-center gap-2 py-1">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{tag.name}</span>
                                  </div>
                                  {groupPersonas.map((persona) => (
                                    <div
                                      key={persona.id}
                                      onClick={() => setSelectedPersona(persona.id!)}
                                      className={`cursor-pointer rounded-lg p-2 border transition-all ${
                                        hiddenMode
                                          ? 'bg-gray-100 border-gray-200'
                                          : selectedPersona === persona.id
                                            ? 'bg-green-50 border-green-500'
                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                          hiddenMode ? 'bg-gray-200' : selectedPersona === persona.id ? 'bg-green-100' : 'bg-gray-100'
                                        }`}>
                                          <UserCircle2 className={`w-4 h-4 ${hiddenMode ? 'text-gray-400' : selectedPersona === persona.id ? 'text-green-600' : 'text-gray-400'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-gray-900 truncate">
                                            {hiddenMode ? '••••••••••' : (persona.business_type === 'B2B' ? ((persona as any).cargo || (persona as PersonaB2B).job_title) : ((persona as any).profissao || (persona as PersonaB2C).profession))}
                                          </p>
                                          <p className="text-[10px] text-gray-500 truncate">
                                            {hiddenMode ? '••••••••' : (persona.business_type === 'B2B' ? ((persona as any).tipo_empresa_faturamento || (persona as PersonaB2B).company_type) : ((persona as any).busca || (persona as PersonaB2C).what_seeks))}
                                          </p>
                                        </div>
                                        {!hiddenMode && selectedPersona === persona.id && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))}
                              {noTagPersonas.length > 0 && (
                                <div className="space-y-2">
                                  {sortedGroups.length > 0 && (
                                    <div className="flex items-center gap-2 py-1">
                                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Sem Etiqueta</span>
                                    </div>
                                  )}
                                  {noTagPersonas.map((persona) => (
                                    <div
                                      key={persona.id}
                                      onClick={() => setSelectedPersona(persona.id!)}
                                      className={`cursor-pointer rounded-lg p-2 border transition-all ${
                                        hiddenMode
                                          ? 'bg-gray-100 border-gray-200'
                                          : selectedPersona === persona.id
                                            ? 'bg-green-50 border-green-500'
                                            : 'bg-white border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                          hiddenMode ? 'bg-gray-200' : selectedPersona === persona.id ? 'bg-green-100' : 'bg-gray-100'
                                        }`}>
                                          <UserCircle2 className={`w-4 h-4 ${hiddenMode ? 'text-gray-400' : selectedPersona === persona.id ? 'text-green-600' : 'text-gray-400'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-gray-900 truncate">
                                            {hiddenMode ? '••••••••••' : (persona.business_type === 'B2B' ? ((persona as any).cargo || (persona as PersonaB2B).job_title) : ((persona as any).profissao || (persona as PersonaB2C).profession))}
                                          </p>
                                          <p className="text-[10px] text-gray-500 truncate">
                                            {hiddenMode ? '••••••••' : (persona.business_type === 'B2B' ? ((persona as any).tipo_empresa_faturamento || (persona as PersonaB2B).company_type) : ((persona as any).busca || (persona as PersonaB2C).what_seeks))}
                                          </p>
                                        </div>
                                        {!hiddenMode && selectedPersona === persona.id && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna 2 - Objeções */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Objeções</h3>

                  {/* Objeções */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">Selecione as objeções</span>
                      {!dataLoading && <span className={`text-xs font-medium ${hiddenMode ? 'text-gray-400' : 'text-green-600'}`}>{hiddenMode ? '? selecionadas' : `${selectedObjections.length} selecionadas`}</span>}
                    </div>
                    {dataLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                      </div>
                    ) : objections.length === 0 ? (
                      <div className="text-gray-500 text-sm py-4 text-center">Nenhuma objeção cadastrada.</div>
                    ) : (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                        {objections.map((objection) => (
                          <label
                            key={objection.id}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                              hiddenMode
                                ? 'bg-gray-100 border border-gray-200'
                                : selectedObjections.includes(objection.id)
                                  ? 'bg-green-50 border border-green-500'
                                  : 'bg-white border border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div
                              onClick={(e) => { e.preventDefault(); toggleObjection(objection.id) }}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${
                                hiddenMode
                                  ? 'bg-gray-300 border-gray-300'
                                  : selectedObjections.includes(objection.id)
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300'
                              }`}
                            >
                              {!hiddenMode && selectedObjections.includes(objection.id) && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="text-xs text-gray-700 truncate">
                              {hiddenMode ? '••••••••••••' : objection.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Objetivo do Roleplay */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <span className="text-sm font-medium text-gray-700 mb-3 block">
                      Objetivo do Roleplay <span className="text-red-500">*</span>
                    </span>
                    {dataLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                      </div>
                    ) : objectives.length === 0 ? (
                      <div className="text-gray-500 text-sm py-4 text-center">Nenhum objetivo cadastrado.</div>
                    ) : (
                      <select
                        value={selectedObjective}
                        onChange={(e) => setSelectedObjective(e.target.value)}
                        className={`w-full p-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                          hiddenMode
                            ? 'bg-gray-400 text-gray-600'
                            : 'bg-green-600 text-white hover:bg-green-500'
                        }`}
                      >
                        {hiddenMode ? (
                          <option value="">••••••••••••••</option>
                        ) : (
                          objectives.map((objective) => (
                            <option key={objective.id} value={objective.id}>
                              {objective.name}
                            </option>
                          ))
                        )}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Aviso de configuração incompleta */}
              {!dataLoading && (!selectedPersona || selectedObjections.length === 0 || !selectedObjective) && (
                <div className="mt-4 bg-yellow-50 rounded-lg border border-yellow-200 p-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-700">
                      {!selectedPersona && !selectedObjective && selectedObjections.length === 0
                        ? 'Selecione Persona, Objeção e Objetivo'
                        : !selectedPersona
                        ? 'Selecione uma Persona'
                        : selectedObjections.length === 0
                        ? 'Selecione pelo menos uma Objeção'
                        : 'Selecione um Objetivo'}
                    </p>
                  </div>
                </div>
              )}

              {/* Botão Iniciar Chamada - Apenas Mobile */}
              <button
                onClick={handleStartSimulation}
                disabled={dataLoading || roleplayLimitReached || !selectedPersona || selectedObjections.length === 0 || !selectedObjective}
                className={`lg:hidden w-full mt-4 py-4 rounded-xl flex items-center justify-center gap-3 font-semibold text-lg transition-all ${
                  dataLoading || roleplayLimitReached || !selectedPersona || selectedObjections.length === 0 || !selectedObjective
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-500 text-white hover:scale-[1.02]'
                }`}
              >
                {roleplayLimitReached ? (
                  <>
                    <Lock className="w-6 h-6" />
                    Limite Atingido
                  </>
                ) : (
                  <>
                    <Phone className="w-6 h-6" />
                    Iniciar Chamada
                  </>
                )}
              </button>

              {/* Data e Hora Atual */}
              <div className="flex items-center justify-center gap-2 text-gray-400 pt-4 mt-4 border-t border-gray-200">
                <Calendar className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-500">
                  {new Date().toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                  {', '}
                  {new Date().toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              </>
              )}
            </div>
          </div>
        </div>

      {/* Modal de Loading - Avaliação */}
        {isEvaluating && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-green-500/30 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
              <Loader2 className="w-16 h-16 text-green-400 animate-spin mx-auto" />
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Analisando sua performance...</h3>
                <p className="text-gray-400">Nosso agente está avaliando sua conversa com base em metodologia SPIN Selling</p>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Avaliação - Design matching HistoricoView */}
        {showEvaluationSummary && evaluation && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] overflow-y-auto">
            <div className="min-h-screen py-8 px-4 sm:px-6">
              <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Resultado da Sessão</h1>
                    <p className="text-gray-400 text-sm">Análise detalhada do seu desempenho</p>
                  </div>
                  <button
                    onClick={() => setShowEvaluationSummary(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Score Principal */}
                {(() => {
                  const overallScore = evaluation.overall_score !== undefined
                    ? (evaluation.overall_score > 10 ? evaluation.overall_score / 10 : evaluation.overall_score)
                    : null
                  return (
                    <div className={`rounded-xl border p-6 text-center mb-6 ${getScoreBg(overallScore || 0)}`}>
                      <div className={`text-5xl font-bold mb-2 ${getScoreColor(overallScore || 0)}`}>
                        {overallScore?.toFixed(1) || 'N/A'}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {evaluation.performance_level && getPerformanceLabel(evaluation.performance_level)}
                      </div>
                    </div>
                  )
                })()}

                {/* Tabs de navegação */}
                <div className="flex gap-1 bg-gray-900/50 rounded-xl border border-gray-800 p-1 mb-6">
                  {['resumo', 'spin', 'transcricao'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveEvaluationTab(tab === 'resumo' ? 'evaluation' : tab === 'spin' ? 'feedback' : 'conversation')}
                      className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                        (tab === 'resumo' && activeEvaluationTab === 'evaluation') ||
                        (tab === 'spin' && activeEvaluationTab === 'feedback') ||
                        (tab === 'transcricao' && activeEvaluationTab === 'conversation')
                          ? 'bg-green-500/20 text-green-400'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      {tab === 'resumo' && 'Resumo'}
                      {tab === 'spin' && 'Análise SPIN'}
                      {tab === 'transcricao' && 'Transcrição'}
                    </button>
                  ))}
                </div>

                {/* Conteúdo das tabs */}
                {/* Tab Resumo (evaluation) */}
                {activeEvaluationTab === 'evaluation' && (
                  <div className="space-y-4">
                    {/* Resumo executivo */}
                    {evaluation.executive_summary && (
                      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                          Resumo Executivo
                        </h4>
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {evaluation.executive_summary}
                        </p>
                      </div>
                    )}

                    {/* Grid de insights */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Pontos fortes */}
                      {evaluation.top_strengths?.length > 0 && (
                        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                          <h4 className="flex items-center gap-2 text-sm font-medium text-green-400 mb-3">
                            <TrendingUp className="w-4 h-4" />
                            Pontos Fortes
                          </h4>
                          <ul className="space-y-2">
                            {evaluation.top_strengths.map((strength: string, i: number) => (
                              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-green-400 mt-0.5">•</span>
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Gaps críticos */}
                      {evaluation.critical_gaps?.length > 0 && (
                        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                          <h4 className="flex items-center gap-2 text-sm font-medium text-red-400 mb-3">
                            <AlertTriangle className="w-4 h-4" />
                            Pontos a Melhorar
                          </h4>
                          <ul className="space-y-2">
                            {evaluation.critical_gaps.map((gap: string, i: number) => (
                              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                <span className="text-red-400 mt-0.5">•</span>
                                {gap}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Prioridades de melhoria */}
                    {evaluation.priority_improvements?.length > 0 && (
                      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                        <h4 className="flex items-center gap-2 text-sm font-medium text-yellow-400 mb-3">
                          <Lightbulb className="w-4 h-4" />
                          Prioridades de Melhoria
                        </h4>
                        <div className="space-y-3">
                          {evaluation.priority_improvements.map((imp: any, i: number) => (
                            <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  imp.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                  imp.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                  {imp.priority === 'critical' ? 'Crítico' :
                                   imp.priority === 'high' ? 'Alta' : 'Média'}
                                </span>
                                <span className="text-sm font-medium text-white">{imp.area}</span>
                              </div>
                              <p className="text-xs text-gray-400">{imp.action_plan}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab Análise SPIN (feedback) */}
                {activeEvaluationTab === 'feedback' && evaluation.spin_evaluation && (
                  <div className="space-y-4">
                    {/* Grid de scores SPIN */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: 'S', label: 'Situação', color: 'text-blue-400' },
                        { key: 'P', label: 'Problema', color: 'text-purple-400' },
                        { key: 'I', label: 'Implicação', color: 'text-orange-400' },
                        { key: 'N', label: 'Necessidade', color: 'text-green-400' }
                      ].map(({ key, label, color }) => {
                        const score = evaluation.spin_evaluation[key]?.final_score || 0
                        return (
                          <div key={key} className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 text-center">
                            <div className={`text-3xl font-bold mb-1 ${color}`}>
                              {score.toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider">
                              {label}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Média SPIN */}
                    <div className="bg-green-500/10 rounded-xl border border-green-500/20 p-4 text-center">
                      <div className="text-2xl font-bold text-green-400 mb-1">
                        {(
                          ((evaluation.spin_evaluation.S?.final_score || 0) +
                          (evaluation.spin_evaluation.P?.final_score || 0) +
                          (evaluation.spin_evaluation.I?.final_score || 0) +
                          (evaluation.spin_evaluation.N?.final_score || 0)) / 4
                        ).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">
                        Média Geral SPIN
                      </div>
                    </div>

                    {/* Detalhes de cada pilar */}
                    {['S', 'P', 'I', 'N'].map((letter) => {
                      const data = evaluation.spin_evaluation[letter]
                      if (!data) return null

                      const labels: Record<string, string> = {
                        'S': 'Situação',
                        'P': 'Problema',
                        'I': 'Implicação',
                        'N': 'Necessidade'
                      }

                      return (
                        <details key={letter} className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden group">
                          <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold text-green-400">
                                {letter}
                              </span>
                              <span className="font-medium text-white">{labels[letter]}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-white">
                                {data.final_score?.toFixed(1)}
                              </span>
                              <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
                            </div>
                          </summary>
                          <div className="p-4 pt-0 space-y-3">
                            {/* Feedback */}
                            {data.technical_feedback && (
                              <p className="text-sm text-gray-300 leading-relaxed">
                                {data.technical_feedback}
                              </p>
                            )}

                            {/* Indicadores */}
                            {data.indicators && Object.keys(data.indicators).length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(data.indicators).map(([key, value]: [string, any]) => {
                                  const score = typeof value === 'number' ? value : 0
                                  const getIndicatorStyle = (s: number) => {
                                    if (s >= 8) return 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-300'
                                    if (s >= 6) return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-300'
                                    return 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/30 text-red-300'
                                  }
                                  const getIndicatorScoreStyle = (s: number) => {
                                    if (s >= 8) return 'text-green-400 font-semibold'
                                    if (s >= 6) return 'text-yellow-400 font-semibold'
                                    return 'text-red-400 font-semibold'
                                  }
                                  return (
                                    <span
                                      key={key}
                                      className={`text-xs px-3 py-1.5 rounded-lg border backdrop-blur-sm transition-all hover:scale-105 ${getIndicatorStyle(score)}`}
                                    >
                                      {translateIndicator(key)}: <span className={getIndicatorScoreStyle(score)}>{value}/10</span>
                                    </span>
                                  )
                                })}
                              </div>
                            )}

                            {/* Oportunidades perdidas */}
                            {data.missed_opportunities?.length > 0 && (
                              <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
                                <p className="text-xs font-medium text-orange-400 mb-2">Oportunidades Perdidas</p>
                                <ul className="space-y-1">
                                  {data.missed_opportunities.map((opp: string, i: number) => (
                                    <li key={i} className="text-xs text-orange-300">• {opp}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </details>
                      )
                    })}

                    {/* Análise de objeções */}
                    {evaluation.objections_analysis?.length > 0 && (
                      <details className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden group">
                        <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
                              <Target className="w-4 h-4 text-green-400" />
                            </span>
                            <span className="font-medium text-white">Análise de Objeções</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400">
                              {evaluation.objections_analysis.length} objeções
                            </span>
                            <ChevronDown className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform" />
                          </div>
                        </summary>
                        <div className="p-4 pt-0 space-y-3">
                          {evaluation.objections_analysis.map((obj: any, idx: number) => (
                            <div key={idx} className="bg-gray-800/50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs px-2 py-0.5 bg-gray-700 rounded text-gray-300">
                                  {obj.objection_type}
                                </span>
                                <span className={`text-sm font-bold ${getScoreColor(obj.score)}`}>
                                  {obj.score}/10
                                </span>
                              </div>
                              <p className="text-sm text-gray-300 italic mb-2">
                                "{obj.objection_text}"
                              </p>
                              {obj.detailed_analysis && (
                                <p className="text-xs text-gray-400">{obj.detailed_analysis}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* Tab Transcrição (conversation) */}
                {activeEvaluationTab === 'conversation' && (
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                      {messages.length} mensagens
                    </h4>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {messages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex gap-3 ${msg.role === 'seller' ? 'flex-row-reverse' : ''}`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            msg.role === 'client'
                              ? 'bg-gray-800'
                              : 'bg-green-500/20'
                          }`}>
                            <User className={`w-4 h-4 ${
                              msg.role === 'client' ? 'text-gray-400' : 'text-green-400'
                            }`} />
                          </div>
                          <div className={`flex-1 max-w-[80%] ${msg.role === 'seller' ? 'text-right' : ''}`}>
                            <div className="text-xs text-gray-500 mb-1">
                              {msg.role === 'client' ? 'Cliente' : 'Você'}
                            </div>
                            <div className={`inline-block p-3 rounded-xl text-sm ${
                              msg.role === 'client'
                                ? 'bg-gray-800 text-gray-300 rounded-tl-none'
                                : 'bg-green-500/20 text-green-100 rounded-tr-none'
                            }`}>
                              {msg.text}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowEvaluationSummary(false)}
                    className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl font-medium hover:bg-gray-800 transition-colors text-gray-300 text-sm"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => {
                      setShowEvaluationSummary(false);
                      if (onNavigateToHistory) {
                        onNavigateToHistory();
                      } else {
                        window.location.href = '/?view=historico';
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-medium transition-colors text-white text-sm"
                  >
                    Ver Análise Completa no Histórico
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  )
}
