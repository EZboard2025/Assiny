'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Play, Clock, MessageCircle, Send, Calendar, User, Zap, Mic, MicOff, Volume2, UserCircle2, CheckCircle, Loader2, X, AlertCircle, ChevronDown, ChevronUp, Lock, Target, TrendingUp, AlertTriangle, Lightbulb, Video, VideoOff, PhoneOff, Phone, Shuffle, EyeOff, Eye, Trophy } from 'lucide-react'
import { getPersonas, getObjections, getCompanyType, getTags, getPersonaTags, getRoleplayObjectives, type Persona, type PersonaB2B, type PersonaB2C, type Objection, type Tag, type RoleplayObjective } from '@/lib/config'
import { createRoleplaySession, addMessageToSession, endRoleplaySession, getRoleplaySession, type RoleplayMessage } from '@/lib/roleplay'
import { processWhisperTranscription } from '@/lib/utils/whisperValidation'
import { generateAvatarWithAI, generateAvatarUrl, preloadImage } from '@/lib/utils/generateAvatar'
import { updatePersona } from '@/lib/config'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { PlanLimitWarning } from '@/components/PlanLimitWarning'
import RoleplayConfigScreen from './roleplay/RoleplayConfigScreen'

interface ChallengeConfig {
  title: string
  description: string
  target_weakness: string
  roleplay_config: {
    persona_id: string
    objection_ids: string[]
    age_range: string
    temperament: string
    objective_id?: string
  }
  success_criteria: {
    spin_letter_target: string
    spin_min_score: number
    primary_indicator: string
    primary_min_score: number
    objection_handling_min: number
  }
  coaching_tips: string[]
}

interface MeetSimulationConfig {
  persona: {
    business_type: 'B2B' | 'B2C'
    cargo?: string
    tipo_empresa_faturamento?: string
    contexto?: string
    busca?: string
    dores?: string
    profissao?: string
    perfil_socioeconomico?: string
  }
  objections: Array<{
    name: string
    rebuttals: string[]
    source: 'meeting' | 'coaching'
  }>
  age: number
  temperament: string
  objective: {
    name: string
    description: string
  }
  simulation_justification?: string
  coaching_focus: Array<{
    area: string
    spin_score?: number
    severity?: 'critical' | 'high' | 'medium'
    diagnosis?: string
    transcript_evidence?: string
    business_impact?: string
    practice_goal?: string
    example_phrases?: string[]
    // Legacy fields (backward compat)
    what_to_improve?: string
    tips?: string[]
  }>
  meeting_context: string
}

interface NicoleConfig {
  persona_id?: string
  objection_ids?: string[]
  objective_id?: string
  age?: number
  temperament?: string
  auto_start?: boolean
}

interface RoleplayViewProps {
  onNavigateToHistory?: (historyType?: string) => void
  challengeConfig?: ChallengeConfig
  challengeId?: string
  onChallengeComplete?: () => void
  meetSimulationConfig?: MeetSimulationConfig
  meetSimulationId?: string
  nicoleConfig?: NicoleConfig
  onNicoleConfigApplied?: () => void
}

export default function RoleplayView({ onNavigateToHistory, challengeConfig, challengeId, onChallengeComplete, meetSimulationConfig, meetSimulationId, nicoleConfig, onNicoleConfigApplied }: RoleplayViewProps = {}) {
  const router = useRouter()

  // Hook para verificar limites do plano
  const {
    checkRoleplayLimit,
    incrementRoleplay,
    planUsage,
    trainingPlan,
    loading: planLoading
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

  // Helper function to extract just the SPIN letter (S, P, I, or N) from various formats
  const extractSpinLetter = (input: string): string => {
    if (!input) return ''
    const upper = input.toUpperCase()
    if (upper.startsWith('SPIN_')) {
      return upper.replace('SPIN_', '')
    }
    if (['S', 'P', 'I', 'N'].includes(upper)) {
      return upper
    }
    return input
  }

  // Helper function to format SPIN letter to full name
  const formatSpinLetter = (letter: string): string => {
    const extracted = extractSpinLetter(letter)
    const labels: Record<string, string> = {
      'S': 'Situação',
      'P': 'Problema',
      'I': 'Implicação',
      'N': 'Necessidade',
    }
    return labels[extracted] || letter
  }

  // Clean up text containing SPIN_X patterns
  const cleanSpinText = (text: string): string => {
    if (!text) return ''
    return text
      .replace(/SPIN_S/gi, 'Situação (S)')
      .replace(/SPIN_P/gi, 'Problema (P)')
      .replace(/SPIN_I/gi, 'Implicação (I)')
      .replace(/SPIN_N/gi, 'Necessidade (N)')
      .replace(/spin selling/gi, 'SPIN Selling')
  }

  // Helper function to safely render values (prevents rendering objects as React children)
  const safeRender = (value: any): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    // If it's an object, try to extract common text fields or stringify
    if (typeof value === 'object') {
      // Common text fields that might contain the actual content
      if (value.text) return safeRender(value.text)
      if (value.content) return safeRender(value.content)
      if (value.message) return safeRender(value.message)
      if (value.analysis) return safeRender(value.analysis)
      if (value.description) return safeRender(value.description)
      // Fallback: stringify the object
      return JSON.stringify(value)
    }
    return String(value)
  }

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
  const userStoppedRef = useRef(false) // Tracks whether user explicitly clicked stop
  const [recordingCooldown, setRecordingCooldown] = useState(0) // Countdown seconds remaining (0 = no cooldown)
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const startRecordingRef = useRef<(() => Promise<void>) | null>(null)

  // Estados e refs para interface de videochamada
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const [showChallengeTips, setShowChallengeTips] = useState(true) // Mostrar dicas do desafio por padrão
  const [isChallengeTipsMinimized, setIsChallengeTipsMinimized] = useState(false) // Painel de dicas expandido por padrão
  const [isMeetTipsMinimized, setIsMeetTipsMinimized] = useState(false) // Painel de coaching Meet minimizado

  // Configurações do roleplay
  const [age, setAge] = useState(30)
  const [temperament, setTemperament] = useState('Analítico')
  const [selectedPersona, setSelectedPersona] = useState('')
  const [selectedObjections, setSelectedObjections] = useState<string[]>([])
  const [selectedObjective, setSelectedObjective] = useState('')
  const [hiddenMode, setHiddenMode] = useState(false) // Modo oculto - esconde seleções

  // Tracking de objeções em tempo real (DEBUG)
  type ObjectionTrackingStatus = 'pending' | 'raised' | 'overcome' | 'not_overcome'
  interface ObjectionTracking { id: string; name: string; status: ObjectionTrackingStatus }
  const [objectionTracking, setObjectionTracking] = useState<ObjectionTracking[]>([])

  // Estados para avatar da persona
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)

  // Estado para modal de aviso ao encerrar
  const [showEndSessionWarning, setShowEndSessionWarning] = useState(false)

  // Quando há um desafio ativo ou simulação de meet, as configurações ficam travadas
  const isChallengeLocked = !!challengeConfig
  const isMeetSimulation = !!meetSimulationConfig
  const isConfigLocked = isChallengeLocked || isMeetSimulation

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
  const [clientName, setClientName] = useState<string>('Cliente') // Nome do cliente virtual
  const [roleplayConfig, setRoleplayConfig] = useState<any>(null) // Armazena toda a configuração do roleplay
  const [dataLoading, setDataLoading] = useState(true) // Loading state para dados iniciais
  const [isChallengeExpanded, setIsChallengeExpanded] = useState(false) // Estado para expandir/colapsar card do desafio

  // DEBUG: Função para visualizar modal de avaliação sem fazer sessão
  const showMockEvaluation = () => {
    const mockEvaluation = {
      overall_score: 6.8,
      performance_level: 'good',
      executive_summary: 'Você demonstrou habilidades sólidas ao iniciar a conversa com perguntas abertas, o que é fundamental para entender a situação do cliente. No entanto, houve oportunidades perdidas para aprofundar nas implicações dos problemas identificados.',
      top_strengths: [
        'Boa abertura com perguntas situacionais',
        'Tom de voz adequado e profissional',
        'Demonstrou empatia genuína com o cliente'
      ],
      critical_gaps: [
        'Faltou explorar as consequências do problema',
        'Não quantificou o impacto financeiro',
        'Fechamento precipitado sem criar urgência'
      ],
      priority_improvements: [
        { area: 'Implicação', current_gap: 'Não explorou consequências de inação', action_plan: 'Perguntar sobre impacto futuro caso problema persista', priority: 'critical' },
        { area: 'Problema', current_gap: 'Superficial na identificação', action_plan: 'Usar técnica 5 Whys para aprofundar', priority: 'high' }
      ],
      spin_evaluation: {
        S: { final_score: 7.2, technical_feedback: 'Boas perguntas iniciais sobre a estrutura da equipe.', indicators: { open_questions_score: 7, scenario_mapping_score: 7, adaptability_score: 8 }, missed_opportunities: [] },
        P: { final_score: 6.5, technical_feedback: 'Identificou problema mas não aprofundou.', indicators: { problem_identification_score: 7, consequences_exploration_score: 6, depth_score: 6, empathy_score: 7, impact_understanding_score: 6 }, missed_opportunities: ['Poderia ter perguntado há quanto tempo o problema existe'] },
        I: { final_score: 5.8, technical_feedback: 'Não explorou consequências de forma adequada.', indicators: { inaction_consequences_score: 5, urgency_amplification_score: 6, concrete_risks_score: 6, non_aggressive_urgency_score: 6 }, missed_opportunities: ['Deveria ter quantificado perdas', 'Faltou criar cenário de inação'] },
        N: { final_score: 6.2, technical_feedback: 'Apresentou solução sem conectar aos problemas.', indicators: { solution_clarity_score: 7, personalization_score: 6, benefits_clarity_score: 6, credibility_score: 6, cta_effectiveness_score: 6 }, missed_opportunities: ['CTA poderia ser mais específico'] }
      },
      objections_analysis: [
        { objection_id: 'obj-1', objection_type: 'timing', objection_text: 'Não tenho tempo agora para avaliar isso', score: 6, detailed_analysis: 'Respondeu de forma adequada mas não transformou em oportunidade.' }
      ],
      challenge_performance: {
        goal_achieved: false,
        target_letter: 'S',
        achieved_score: 6.0,
        target_score: 7.0,
        challenge_feedback: 'Você fez um bom trabalho ao iniciar a conversa com perguntas abertas, o que é fundamental. No entanto, há espaço para aprofundar mais na situação do cliente e explorar suas necessidades de forma mais detalhada. Continue praticando e buscando entender o contexto completo, isso tornará suas interações ainda mais eficazes!',
        coaching_tips_applied: ['O vendedor fez perguntas abertas.'],
        coaching_tips_missed: [
          'Quando o cliente disser que não vê urgência, deveria ter respondido com "Se esse problema persistir, que impacto você prevê para os próximos meses?"',
          'Não praticou o silêncio após fazer perguntas abertas.'
        ],
        key_moments: [
          { moment: 'Exploração inicial do time comercial', analysis: 'O vendedor perguntou sobre a estrutura do time comercial.', suggestion: 'Além da estrutura, quais desafios você e sua equipe enfrentam no dia a dia para fechar vendas?' },
          { moment: 'Resposta à falta de urgência', analysis: 'O cliente disse que não via uma urgência para a solução.', suggestion: 'Se essa situação persistir, que impacto você prevê para os resultados da clínica nos próximos meses?' },
          { moment: 'Discussão sobre o fechamento', analysis: 'O vendedor fez uma pergunta sobre o que estava causando o travamento.', suggestion: 'O que especificamente está impedindo que vocês avancem com mais confiança no processo de vendas?' }
        ],
        target_letter_deep_analysis: 'Na fase de Situação, você demonstrou boa iniciativa ao fazer perguntas abertas sobre a estrutura da equipe. No entanto, as perguntas poderiam ter sido mais estratégicas para mapear não apenas a estrutura, mas também os processos, ferramentas utilizadas e histórico de tentativas anteriores.'
      }
    }
    setEvaluation(mockEvaluation)
    setShowEvaluationSummary(true)
  }

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [])

  // Auto-start meet simulation (skip config screen)
  // Must wait for planLoading to finish, otherwise checkRoleplayLimit() returns {allowed: false}
  const meetAutoStarted = useRef(false)
  useEffect(() => {
    if (isMeetSimulation && mounted && !planLoading && !isSimulating && !meetAutoStarted.current) {
      meetAutoStarted.current = true
      handleStartSimulation()
    }
  }, [isMeetSimulation, mounted, planLoading])

  // Auto-start challenge (skip config screen — config is already locked by the challenge)
  // Must wait for dataLoading to finish so persona/objections/objective are set from challenge config
  const challengeAutoStarted = useRef(false)
  const nicoleAutoStarted = useRef(false)
  useEffect(() => {
    if (challengeConfig && mounted && !planLoading && !dataLoading && !isSimulating && !challengeAutoStarted.current) {
      challengeAutoStarted.current = true
      handleStartSimulation()
    }
  }, [challengeConfig, mounted, planLoading, dataLoading])

  // Auto-start Nicole AI suggested roleplay
  useEffect(() => {
    if (nicoleConfig?.auto_start && mounted && !planLoading && !dataLoading && !isSimulating && !nicoleAutoStarted.current) {
      nicoleAutoStarted.current = true
      handleStartSimulation()
    }
  }, [nicoleConfig, mounted, planLoading, dataLoading])

  // Verificar limite de créditos mensais
  useEffect(() => {
    if (planUsage && trainingPlan) {
      const used = planUsage.training?.credits?.used || 0
      const limit = planUsage.training?.credits?.limit

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

      // Apply challenge configuration if present
      if (challengeConfig) {
        console.log('🎯 Aplicando configuração do desafio:', challengeConfig)

        // Set persona
        if (challengeConfig.roleplay_config.persona_id) {
          setSelectedPersona(challengeConfig.roleplay_config.persona_id)
        }

        // Set objections
        if (challengeConfig.roleplay_config.objection_ids?.length > 0) {
          setSelectedObjections(challengeConfig.roleplay_config.objection_ids)
        }

        // Set objective
        if (challengeConfig.roleplay_config.objective_id) {
          setSelectedObjective(challengeConfig.roleplay_config.objective_id)
        }

        // Set temperament
        if (challengeConfig.roleplay_config.temperament) {
          setTemperament(challengeConfig.roleplay_config.temperament)
        }

        // Set age from range (e.g., "35-44" -> 40)
        if (challengeConfig.roleplay_config.age_range) {
          const [minAge, maxAge] = challengeConfig.roleplay_config.age_range.split('-').map(Number)
          if (!isNaN(minAge) && !isNaN(maxAge)) {
            setAge(Math.floor((minAge + maxAge) / 2))
          }
        }
      }

      // Apply meet simulation configuration if present
      if (meetSimulationConfig) {
        console.log('🎯 Aplicando configuracao da simulacao Meet:', meetSimulationConfig)
        setAge(meetSimulationConfig.age)
        setTemperament(meetSimulationConfig.temperament)
        // Persona/objections/objective are passed inline in handleStartSimulation
        // No need to set selectedPersona/selectedObjections/selectedObjective by DB ID
      }

      // Apply Nicole AI config (user can still edit - NOT locked)
      if (nicoleConfig) {
        if (nicoleConfig.persona_id && personasData.some((p: any) => p.id === nicoleConfig.persona_id)) {
          setSelectedPersona(nicoleConfig.persona_id)
        }
        if (nicoleConfig.objection_ids) {
          const validIds = nicoleConfig.objection_ids.filter((id: string) => objectionsData.some((o: any) => o.id === id))
          if (validIds.length > 0) setSelectedObjections(validIds)
        }
        if (nicoleConfig.objective_id && objectivesData.some((o: any) => o.id === nicoleConfig.objective_id)) {
          setSelectedObjective(nicoleConfig.objective_id)
        }
        if (nicoleConfig.age) setAge(nicoleConfig.age)
        if (nicoleConfig.temperament) setTemperament(nicoleConfig.temperament)
        onNicoleConfigApplied?.()
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
    if (!isSimulating || hiddenMode) return

    // Resolve persona: meet simulation inline OR from dropdown
    let personaForAvatar: any = null
    let avatarAge = age
    let avatarTemperament = temperament

    if (isMeetSimulation && meetSimulationConfig?.persona) {
      personaForAvatar = {
        id: 'meet_persona',
        business_type: meetSimulationConfig.persona.business_type || 'B2B',
        cargo: meetSimulationConfig.persona.cargo,
        profissao: meetSimulationConfig.persona.profissao,
      }
      avatarAge = meetSimulationConfig.age || age
      avatarTemperament = meetSimulationConfig.temperament || temperament
    } else if (selectedPersona) {
      personaForAvatar = personas.find(p => p.id === selectedPersona)
    }

    if (!personaForAvatar) return

    // Já tem avatar? Não regenera
    if (avatarUrl) return

    // Gera novo avatar usando DALL-E 3
    const generateAvatar = async () => {
      setIsLoadingAvatar(true)

      try {
        // Tenta gerar com DALL-E 3
        const aiUrl = await generateAvatarWithAI(personaForAvatar, avatarAge, avatarTemperament)

        if (aiUrl) {
          setAvatarUrl(aiUrl)
        } else {
          // Fallback para Pravatar se DALL-E falhar
          console.warn('DALL-E falhou, usando fallback Pravatar')
          const fallbackUrl = generateAvatarUrl(personaForAvatar, avatarAge, avatarTemperament)
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

  const temperaments = ['Analítico', 'Empático', 'Determinado', 'Indeciso', 'Sociável']

  // Função para converter idade numérica em faixa etária para TTS
  const getAgeRangeFromAge = (ageValue: number): string => {
    if (ageValue >= 18 && ageValue <= 24) return '18-24'
    if (ageValue >= 25 && ageValue <= 34) return '25-34'
    if (ageValue >= 35 && ageValue <= 44) return '35-44'
    if (ageValue >= 45 && ageValue <= 60) return '45-60'
    // Fallback para idades fora do range
    if (ageValue < 18) return '18-24'
    return '45-60'
  }

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
    // Skip validation when using meet simulation or challenge (data is pre-configured)
    if (!isMeetSimulation && !challengeConfig) {
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

      // Assemble persona, objections, and objective data
      let personaData: any = {}
      let objectionsWithRebuttals: any[]
      let selectedObjectiveData: any
      let selectedPersonaData: any = null

      if (isMeetSimulation && meetSimulationConfig) {
        // USE INLINE MEET SIMULATION CONFIG (not from database)
        console.log('🎯 Using meet simulation config:', meetSimulationConfig)
        personaData = meetSimulationConfig.persona
        objectionsWithRebuttals = meetSimulationConfig.objections.map((obj, idx) => ({
          id: `meet_obj_${idx}`,
          name: obj.name,
          rebuttals: obj.rebuttals || []
        }))
        selectedObjectiveData = {
          id: 'meet_objective',
          name: meetSimulationConfig.objective.name,
          description: meetSimulationConfig.objective.description
        }
      } else {
        // STANDARD FLOW: look up from database
        selectedPersonaData = personas.find(p => p.id === selectedPersona)
        const selectedObjectionsData = objections.filter(o => selectedObjections.includes(o.id))
        selectedObjectiveData = objectives.find(o => o.id === selectedObjective)

        // Enviar todos os dados da persona para o agente (usando nomes do banco de dados)
        if (selectedPersonaData) {
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

        objectionsWithRebuttals = selectedObjectionsData.map(o => ({
          id: o.id,
          name: o.name,
          rebuttals: o.rebuttals || []
        }))
      }

      // Salvar configuração completa para usar em todas as mensagens
      const simAge = isMeetSimulation && meetSimulationConfig ? meetSimulationConfig.age : age
      const simTemperament = isMeetSimulation && meetSimulationConfig ? meetSimulationConfig.temperament : temperament
      const fullConfig = {
        age: simAge,
        temperament: simTemperament,
        selectedPersona: selectedPersonaData,
        objections: objectionsWithRebuttals,
        objective: selectedObjectiveData,
        personaData: personaData
      }
      setRoleplayConfig(fullConfig)
      console.log('💾 Configuração do roleplay salva:', fullConfig)

      // Inicializar tracking de objeções
      setObjectionTracking(objectionsWithRebuttals.map((obj: any) => ({
        id: obj.id,
        name: obj.name,
        status: 'pending' as ObjectionTrackingStatus
      })))
      console.log('🎯 Objection tracking inicializado:', objectionsWithRebuttals.length, 'objeções')

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
- Profissão: ${personaData.profissao || 'Não especificado'}${personaData.perfil_socioeconomico ? `\n- Perfil Socioeconômico: ${personaData.perfil_socioeconomico}` : ''}
- Contexto: ${personaData.contexto || 'Não especificado'}
- O que busca/valoriza: ${personaData.busca || 'Não especificado'}
- Principais dores/problemas: ${personaData.dores || 'Não especificado'}
- O que já sabe sobre sua empresa: ${personaData.prior_knowledge || 'Não sabe nada ainda'}`
      }

      const contextMessage = `Você está em uma simulação de venda. Características do cliente:
- Idade: ${simAge} anos
- Temperamento: ${simTemperament}
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
            age: isMeetSimulation && meetSimulationConfig ? meetSimulationConfig.age : age,
            temperament: isMeetSimulation && meetSimulationConfig ? meetSimulationConfig.temperament : temperament,
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

      // Processar objection tracking updates do início
      if (data.objectionUpdates && Array.isArray(data.objectionUpdates)) {
        console.log('🎯 Objection updates (início):', data.objectionUpdates)
        setObjectionTracking(prev => {
          const updated = [...prev]
          for (const upd of data.objectionUpdates) {
            const idx = updated.findIndex(o => o.id === upd.objection_id)
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], status: upd.status as ObjectionTrackingStatus }
            }
          }
          return updated
        })
      }

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
        age: simAge,
        temperament: simTemperament,
        segment: segmentDescription,
        objections: objectionsWithRebuttals,
        client_name: data.clientName,
        objective: selectedObjectiveData,
        ...(isMeetSimulation && meetSimulationConfig ? {
          is_meet_correction: true,
          meet_simulation_config: meetSimulationConfig,
        } : {}),
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
    userStoppedRef.current = true // Evitar que onstop processe áudio
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
      audioRef.current.src = '';
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

        // Enviar para avaliação (incluir challengeId se for um desafio)
        const evaluationResponse = await fetch('/api/roleplay/evaluate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            messages: messages?.messages || [],
            config: messages?.config || {},
            challengeId: challengeId || null, // Passar diretamente o ID do desafio
            meetCoachingContext: isMeetSimulation && meetSimulationConfig?.coaching_focus?.length
              ? meetSimulationConfig.coaching_focus
              : null
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

            // Complete challenge if this is a challenge roleplay
            if (challengeId && sessionId) {
              try {
                const completeResponse = await fetch('/api/challenges/complete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    challengeId,
                    roleplaySessionId: sessionId
                  })
                })
                const completeResult = await completeResponse.json()
                console.log('🎯 Desafio completado:', completeResult)

                if (onChallengeComplete) {
                  onChallengeComplete()
                }
              } catch (error) {
                console.error('Erro ao completar desafio:', error)
              }
            }

            // Mark meet simulation as completed
            if (meetSimulationId && sessionId) {
              try {
                await supabase
                  .from('saved_simulations')
                  .update({ status: 'completed', roleplay_session_id: sessionId })
                  .eq('id', meetSimulationId)
                console.log('✅ Simulação de correção marcada como concluída')
              } catch (error) {
                console.error('Erro ao marcar simulação como concluída:', error)
              }
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
    userStoppedRef.current = true // Evitar que onstop processe áudio
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
      audioRef.current.src = '';
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

    // Marcar sessão como abandonada (sem avaliação)
    if (sessionId) {
      try {
        await endRoleplaySession(sessionId, 'abandoned');
        console.log('📝 Sessão marcada como abandonada (sem avaliação)');
      } catch (error) {
        console.error('Erro ao marcar sessão como abandonada:', error);
      }
    }

    // NÃO inicia avaliação - sessão encerrada manualmente
    console.log('⚠️ Avaliação pulada - encerramento manual pelo usuário');

    // Meet simulation: redirect back to dashboard so user sees the simulation still pending
    if (meetSimulationId) {
      console.log('🔄 Redirecionando de volta — simulação de correção continua pendente')
      router.push('/')
    }
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
        chatHistory: messages,
        // Tracking de objeções
        objectionStatus: Object.fromEntries(objectionTracking.map(o => [o.id, o.status])),
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

      // Processar objection tracking updates
      if (data.objectionUpdates && Array.isArray(data.objectionUpdates)) {
        console.log('🎯 Objection updates recebidos:', data.objectionUpdates)
        setObjectionTracking(prev => {
          const updated = [...prev]
          for (const upd of data.objectionUpdates) {
            const idx = updated.findIndex(o => o.id === upd.objection_id)
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], status: upd.status as ObjectionTrackingStatus }
            }
          }
          return updated
        })
      }

      // Adicionar resposta do cliente
      setMessages(prev => [...prev, { role: 'client', text: data.message }])

      // Verificar se a mensagem contém a frase de finalização
      const isFinalizationMessage = data.message.includes('Roleplay finalizado, aguarde sua avaliação')

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
      userStoppedRef.current = false

      // Fechar AudioContext anterior (evita conflito com microfone no macOS)
      if (audioContextRef.current) {
        await audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }

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

      // Monitorar saúde da track de áudio
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        console.log('🎤 Audio track:', audioTrack.label, '| readyState:', audioTrack.readyState)
        audioTrack.onended = () => {
          console.warn('⚠️ Audio track ended unexpectedly! userStopped:', userStoppedRef.current)
          if (!userStoppedRef.current) {
            // Track morreu sozinha — parar MediaRecorder para salvar o que temos
            if (mediaRecorderRef.current?.state === 'recording') {
              console.warn('⚠️ Parando MediaRecorder porque a track morreu')
              mediaRecorderRef.current.stop()
            }
          }
        }
        audioTrack.onmute = () => {
          console.warn('⚠️ Audio track was muted!')
        }
        audioTrack.onunmute = () => {
          console.log('🎤 Audio track unmuted')
        }
      }

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

      mediaRecorder.onerror = (event: any) => {
        console.error('❌ MediaRecorder error:', event.error?.name, event.error?.message)
      }

      mediaRecorder.onstop = async () => {
        console.log('🛑 MediaRecorder.onstop disparado! userStopped:', userStoppedRef.current)
        console.log('🛑 Chunks de áudio capturados:', audioChunksRef.current.length)

        // Garantir que o indicador seja removido imediatamente
        setIsRecording(false)

        // Se a gravação parou inesperadamente (não pelo usuário), avisar e não processar
        if (!userStoppedRef.current) {
          console.warn('⚠️ Gravação interrompida inesperadamente (track do microfone morreu)')
          setCurrentTranscription('⚠️ Gravação interrompida. Clique no microfone para tentar novamente.')
          setTimeout(() => setCurrentTranscription(''), 4000)
          // Limpar stream e referências
          stream.getTracks().forEach(track => track.stop())
          mediaRecorderRef.current = null
          streamRef.current = null
          return
        }

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

      mediaRecorder.start(500) // Chunks a cada 500ms para não perder áudio em stops inesperados
      setIsRecording(true)

      // Cooldown de 5 segundos — evita clique duplo acidental no botão de parar
      setRecordingCooldown(5)
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
      cooldownTimerRef.current = setInterval(() => {
        setRecordingCooldown(prev => {
          if (prev <= 1) {
            clearInterval(cooldownTimerRef.current!)
            cooldownTimerRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)

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

  // Manter ref atualizada para uso em closures (ex: audio.onended)
  startRecordingRef.current = startRecording

  const stopRecording = () => {
    console.log('🛑 stopRecording chamada')
    console.log('🛑 Estado atual - isRecording:', isRecording)
    console.log('🛑 MediaRecorder existe?', !!mediaRecorderRef.current)
    console.log('🛑 MediaRecorder state:', mediaRecorderRef.current?.state)

    // Marcar como parada explícita pelo usuário
    userStoppedRef.current = true

    // Limpar cooldown
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current)
      cooldownTimerRef.current = null
    }
    setRecordingCooldown(0)

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
      // Obter faixa etária para selecionar a voz correta
      const ageRange = getAgeRangeFromAge(age)
      console.log('🔊 Enviando texto para TTS:', text, '| Faixa etária:', ageRange)
      setIsPlayingAudio(true)

      // Enviar texto para TTS via API proxy com a faixa etária
      const response = await fetch('/api/roleplay/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, ageRange }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Erro na resposta TTS:', response.status, errorText)
        throw new Error(`Erro ao gerar áudio: ${response.status}`)
      }

      // Receber o áudio
      const audioBlob = await response.blob()
      console.log('🔊 Blob de áudio recebido:', audioBlob.size, 'bytes, tipo:', audioBlob.type)

      if (audioBlob.size === 0) {
        throw new Error('Áudio recebido está vazio')
      }

      // Tocar via HTML Audio element (compatível com Electron + Browser)
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.volume = 1.0
      audioRef.current = audio

      // Forçar dispositivo de saída padrão (fix para Electron no Windows)
      if (typeof (audio as any).setSinkId === 'function') {
        try {
          await (audio as any).setSinkId('default')
          console.log('🔊 Audio output device set to default')
        } catch (e) {
          console.warn('⚠️ setSinkId failed:', e)
        }
      }

      console.log('🔊 Tocando áudio via Audio element, src:', audioUrl)

      // Função para limpar estado do áudio
      const cleanupAudio = () => {
        setIsPlayingAudio(false)
        setAudioVolume(0)

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.src = ''
          audioRef.current = null
        }

        URL.revokeObjectURL(audioUrl)
      }

      // Quando o áudio terminar
      audio.onended = () => {
        cleanupAudio()
        console.log('🔊 Áudio do cliente finalizado')

        if (isFinalizationMessage) {
          console.log('🎯 Finalizando roleplay automaticamente...')
          setShowFinalizingMessage(true)
          setTimeout(() => {
            handleEndSession()
          }, 2000)
        } else {
          console.log('🎙️ Auto-ativando microfone após fala do cliente')
          setTimeout(() => {
            startRecordingRef.current?.()
          }, 500)
        }
      }

      audio.onerror = (e) => {
        console.error('❌ Audio element error:', e)
        cleanupAudio()
      }

      await audio.play()
      console.log('🔊 Audio playing, duration:', audio.duration)
    } catch (error) {
      console.error('❌ Erro ao converter texto em áudio:', error)
      setIsPlayingAudio(false)
      setAudioVolume(0)
    }
  }

  // Configurar visualizador de áudio
  const setupAudioVisualizer = async (audio: HTMLAudioElement) => {
    try {
      // Criar contexto de áudio se não existir
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const audioContext = audioContextRef.current

      // Resumir AudioContext se estiver suspenso (política de autoplay)
      if (audioContext.state === 'suspended') {
        console.log('🔊 Resumindo AudioContext suspenso...')
        await audioContext.resume()
      }

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 128 // Menor FFT = mais responsivo aos picos
      analyser.smoothingTimeConstant = 0.3 // Menos suavização = mais reativo

      // Usar captureStream para não redirecionar o áudio pelo Web Audio API
      // Assim o som sai normalmente pelo elemento <audio> e o analyser apenas observa
      const stream = (audio as any).captureStream?.() || (audio as any).mozCaptureStream?.()
      if (!stream) {
        console.warn('captureStream not supported, skipping visualizer')
        throw new Error('captureStream not supported')
      }
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      // NÃO conectar ao destination — o áudio já toca pelo elemento

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
      throw error // Propagar erro para ser capturado no textToSpeech
    }
  }

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />

      {/* Interface de Videochamada - Exibida durante a sessão ativa */}
      {isSimulating && (
        <div className="fixed inset-0 bg-[#1a1a1a] z-[70] flex flex-col">
          {/* Header minimalista */}
          <div className="flex justify-between items-center px-6 py-3 border-b border-gray-800">
            <div className="flex items-center gap-3">
              {roleplayConfig?.objective?.name && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 rounded-lg border border-green-500/30">
                  <Target size={14} className="text-green-400" />
                  <span className="text-green-400 text-sm font-medium">{roleplayConfig.objective.name}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Botão de Dicas do Desafio - Expande/Minimiza */}
              {challengeConfig && (
                <button
                  onClick={() => setIsChallengeTipsMinimized(!isChallengeTipsMinimized)}
                  className={`p-2 rounded-lg transition-colors ${!isChallengeTipsMinimized ? 'bg-purple-600/20 text-purple-400' : 'hover:bg-gray-800 text-white/70'}`}
                  title={isChallengeTipsMinimized ? "Expandir Dicas do Desafio" : "Minimizar Dicas do Desafio"}
                >
                  <Lightbulb size={20} />
                </button>
              )}
              {/* Botão de Coaching Meet - Expande/Minimiza */}
              {isMeetSimulation && meetSimulationConfig && (
                <button
                  onClick={() => setIsMeetTipsMinimized(!isMeetTipsMinimized)}
                  className={`p-2 rounded-lg transition-colors ${!isMeetTipsMinimized ? 'bg-purple-600/20 text-purple-400' : 'hover:bg-gray-800 text-white/70'}`}
                  title={isMeetTipsMinimized ? "Expandir Coaching" : "Minimizar Coaching"}
                >
                  <Lightbulb size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Painel de Dicas do Desafio - Flutuante na esquerda */}
            {challengeConfig && showChallengeTips && (
              <div className={`${isChallengeTipsMinimized ? 'w-16' : 'w-72'} bg-gray-900/95 border-r border-gray-700 flex flex-col flex-shrink-0 backdrop-blur-sm transition-all duration-300`}>
                {/* Header */}
                <button
                  onClick={() => setIsChallengeTipsMinimized(!isChallengeTipsMinimized)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-700/50 transition-colors text-left border-b border-gray-700"
                >
                  {!isChallengeTipsMinimized ? (
                    <>
                      <div className="w-9 h-9 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Target size={18} className="text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-100">Desafio Ativo</h3>
                        <span className="text-xs font-medium text-green-400 bg-green-500/20 px-2 py-0.5 rounded border border-green-500/30 inline-block mt-1">
                          {extractSpinLetter(challengeConfig.success_criteria.spin_letter_target)} ≥ {challengeConfig.success_criteria.spin_min_score}
                        </span>
                      </div>
                      <ChevronDown size={16} className="text-gray-400" />
                    </>
                  ) : (
                    <div className="w-full flex flex-col items-center gap-2">
                      <div className="w-9 h-9 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Target size={18} className="text-green-400" />
                      </div>
                      <ChevronUp size={14} className="text-gray-400" />
                    </div>
                  )}
                </button>

                {/* Conteúdo expandido */}
                {!isChallengeTipsMinimized && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 whatsapp-scrollbar">
                    {/* Título e Descrição */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-100 mb-1">{cleanSpinText(challengeConfig.title)}</h4>
                      <p className="text-xs text-gray-400 leading-relaxed">{cleanSpinText(challengeConfig.description)}</p>
                    </div>

                    {/* Meta */}
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Target size={14} className="text-green-400" />
                        <span className="text-xs font-semibold text-green-400">Meta</span>
                      </div>
                      <p className="text-sm text-gray-300">
                        Alcançar <span className="font-bold text-green-400">{challengeConfig.success_criteria.spin_min_score}+</span> em {formatSpinLetter(challengeConfig.success_criteria.spin_letter_target)}
                      </p>
                    </div>

                    {/* Dicas de Coaching */}
                    {challengeConfig.coaching_tips && challengeConfig.coaching_tips.length > 0 && (
                      <details className="group" open>
                        <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-200 mb-2">
                          <Lightbulb size={14} className="text-green-400" />
                          <span className="font-medium">Dicas de coaching</span>
                          <ChevronDown size={12} className="group-open:rotate-180 transition-transform ml-auto text-gray-500" />
                        </summary>
                        <ul className="space-y-1.5">
                          {challengeConfig.coaching_tips.map((tip, index) => (
                            <li key={index} className="text-xs text-gray-400 flex items-start gap-2">
                              <span className="w-4 h-4 bg-green-500/20 text-green-400 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                {index + 1}
                              </span>
                              <span className="leading-relaxed">{cleanSpinText(tip)}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {/* Foco SPIN */}
                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                      <p className="text-xs text-gray-400 mb-2">Foque em perguntas de:</p>
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-green-600 text-white text-sm font-bold rounded-lg flex items-center justify-center">
                          {extractSpinLetter(challengeConfig.success_criteria.spin_letter_target)}
                        </span>
                        <span className="text-gray-100 text-sm font-medium">
                          {formatSpinLetter(challengeConfig.success_criteria.spin_letter_target)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Versão minimizada - mostrar meta e letra */}
                {isChallengeTipsMinimized && (
                  <div className="flex-1 flex flex-col items-center py-4 gap-3">
                    <span className="w-8 h-8 bg-green-600 text-white text-sm font-bold rounded-lg flex items-center justify-center">
                      {extractSpinLetter(challengeConfig.success_criteria.spin_letter_target)}
                    </span>
                    <span className="text-xs text-gray-400 font-semibold">
                      ≥{challengeConfig.success_criteria.spin_min_score}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Meet Simulation Coaching Panel */}
            {isMeetSimulation && meetSimulationConfig && (
              <div className={`${isMeetTipsMinimized ? 'w-14' : 'w-80'} bg-gray-900/95 border-r border-gray-700 flex flex-col flex-shrink-0 backdrop-blur-sm transition-all duration-300`}>
                {/* Header - clickable to toggle */}
                <button
                  onClick={() => setIsMeetTipsMinimized(!isMeetTipsMinimized)}
                  className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-gray-700/50 transition-colors text-left border-b border-gray-700"
                >
                  {!isMeetTipsMinimized ? (
                    <>
                      <Target size={16} className="text-purple-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-gray-100 flex-1">Coaching</span>
                      <ChevronDown size={14} className="text-gray-400" />
                    </>
                  ) : (
                    <div className="w-full flex flex-col items-center gap-1.5">
                      <Target size={16} className="text-purple-400" />
                      <ChevronUp size={12} className="text-gray-400" />
                    </div>
                  )}
                </button>

                {/* Expanded content */}
                {!isMeetTipsMinimized && (
                  <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
                    {/* Coaching Focus Areas */}
                    {meetSimulationConfig.coaching_focus.map((focus, idx) => {
                      const cleanText = (text: string) => text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/—/g, '-').replace(/\s{2,}/g, ' ').trim()
                      const borderColor = focus.severity === 'critical' ? 'border-l-red-400' : focus.severity === 'high' ? 'border-l-amber-400' : 'border-l-yellow-400'
                      const scoreColor = (focus.spin_score ?? 10) < 4 ? 'text-red-400' : (focus.spin_score ?? 10) < 6 ? 'text-amber-400' : 'text-yellow-400'
                      const phrases = (focus.example_phrases || focus.tips || []).map((p: string) => cleanText(p))

                      return (
                        <div key={idx} className={`border-b border-gray-700 border-l-[3px] ${borderColor}`}>
                          {/* Area + Score */}
                          <div className="px-3 py-2 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-100">{focus.area}</span>
                            {focus.spin_score !== undefined && (
                              <span className={`text-xs font-bold ${scoreColor}`}>{focus.spin_score.toFixed(1)}</span>
                            )}
                          </div>

                          {/* Practice Goal */}
                          {focus.practice_goal && (
                            <div className="px-3 pb-1.5">
                              <p className="text-xs text-gray-400 leading-relaxed">{cleanText(focus.practice_goal)}</p>
                            </div>
                          )}

                          {/* One example phrase */}
                          {phrases.length > 0 && (
                            <div className="px-3 pb-2.5">
                              <p className="text-xs text-emerald-400 leading-relaxed italic">&ldquo;{phrases[0]}&rdquo;</p>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Objections - just names */}
                    <div className="border-b border-gray-700">
                      <div className="px-3 py-2">
                        <span className="text-xs font-bold text-gray-100">Objecoes esperadas</span>
                      </div>
                      <div className="px-3 pb-2.5 space-y-1.5">
                        {meetSimulationConfig.objections.map((obj, idx) => {
                          const cleanText = (text: string) => text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/—/g, '-').replace(/\s{2,}/g, ' ').trim()
                          return (
                            <div key={idx} className="flex items-start gap-1.5">
                              <span className={`text-[10px] px-1 py-0.5 rounded font-medium mt-px flex-shrink-0 ${
                                obj.source === 'meeting' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                              }`}>
                                {obj.source === 'meeting' ? 'Meet' : 'Coach'}
                              </span>
                              <span className="text-xs text-gray-300 leading-relaxed">{cleanText(obj.name)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Minimized state */}
                {isMeetTipsMinimized && (
                  <div className="flex-1 flex flex-col items-center gap-2.5 pt-3">
                    {meetSimulationConfig.coaching_focus.map((focus, idx) => {
                      const dotColor = focus.severity === 'critical' ? 'bg-red-500' : focus.severity === 'high' ? 'bg-amber-500' : 'bg-yellow-500'
                      return (
                        <div key={idx} className={`w-2.5 h-2.5 rounded-full ${dotColor}`} title={`${focus.area}: ${focus.spin_score?.toFixed(1) || '?'}/10`} />
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* DEBUG: Painel de Tracking de Objeções (oculto — descomentar para testar) */}
            {false && isSimulating && objectionTracking.length > 0 && (
              <div className="absolute top-4 right-4 z-50 bg-gray-950/95 border border-gray-600 rounded-xl p-5 w-[420px] backdrop-blur-md shadow-2xl">
                <div className="text-sm font-bold text-yellow-400 mb-4 flex items-center gap-2 border-b border-gray-700 pb-3">
                  <span className="text-base">⚠️</span>
                  <span>DEBUG: Objection Tracking</span>
                  <span className="ml-auto text-xs font-normal text-gray-500">
                    {objectionTracking.filter(o => o.status === 'overcome').length}/{objectionTracking.length} superadas
                  </span>
                </div>
                <div className="space-y-3">
                  {objectionTracking.map(obj => (
                    <div key={obj.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                      obj.status === 'pending' ? 'bg-gray-800/50 border-gray-700' :
                      obj.status === 'raised' ? 'bg-blue-950/40 border-blue-700/50' :
                      obj.status === 'overcome' ? 'bg-green-950/40 border-green-700/50' :
                      'bg-red-950/40 border-red-700/50'
                    }`}>
                      <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                        obj.status === 'pending' ? 'bg-gray-500' :
                        obj.status === 'raised' ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50' :
                        obj.status === 'overcome' ? 'bg-green-500 shadow-lg shadow-green-500/30' :
                        'bg-red-500 shadow-lg shadow-red-500/30'
                      }`} />
                      <span className="text-sm text-gray-200 flex-1 leading-snug">{obj.name}</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${
                        obj.status === 'pending' ? 'bg-gray-700 text-gray-400' :
                        obj.status === 'raised' ? 'bg-blue-800 text-blue-200' :
                        obj.status === 'overcome' ? 'bg-green-800 text-green-200' :
                        'bg-red-800 text-red-200'
                      }`}>
                        {obj.status === 'pending' ? '⏳ Pendente' :
                         obj.status === 'raised' ? '💬 Em discussão' :
                         obj.status === 'overcome' ? '✅ Superada' :
                         '❌ Não superada'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Área dos vídeos */}
            <div className="flex-1 flex items-center justify-center gap-4 p-6 transition-all">
              {/* Avatar do Cliente Virtual (gerado por IA) */}
              <div className="flex-1 max-w-[600px] aspect-video bg-gray-800 rounded-xl flex items-center justify-center relative overflow-hidden">
                {isLoadingAvatar ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700">
                    <Loader2 className="w-16 h-16 text-green-400 animate-spin" />
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

            {/* Botão Microfone — só permite parar (auto-inicia após fala do cliente) */}
            <button
              onClick={isRecording ? stopRecording : undefined}
              disabled={!isRecording || isPlayingAudio || isLoading || showFinalizingMessage || (isRecording && recordingCooldown > 0)}
              className={`p-4 rounded-full transition-colors relative ${
                isRecording
                  ? recordingCooldown > 0
                    ? 'bg-green-500/60 text-white/60 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-700 text-white opacity-50 cursor-not-allowed'
              } ${(isPlayingAudio || isLoading || showFinalizingMessage) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isRecording ? (recordingCooldown > 0 ? `Aguarde ${recordingCooldown}s...` : 'Finalizar sua fala') : 'Aguardando cliente falar...'}
            >
              {isRecording ? <Mic size={24} /> : <MicOff size={24} />}
              {isRecording && recordingCooldown > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">{recordingCooldown}</span>
              )}
              {isRecording && recordingCooldown === 0 && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-green-400 animate-pulse font-medium">
                  aperte para finalizar sua fala
                </span>
              )}
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

      {/* Tela de carregamento do desafio - enquanto auto-start está pendente */}
      {challengeConfig && !isSimulating && (
        <div className="fixed inset-0 bg-[#1a1a1a] z-[70] flex flex-col items-center justify-center">
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes challengePulse {
              0%, 100% { opacity: 0.4; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1); }
            }
            .challenge-dot-1 { animation: challengePulse 1.4s ease-in-out infinite; }
            .challenge-dot-2 { animation: challengePulse 1.4s ease-in-out infinite; animation-delay: 0.2s; }
            .challenge-dot-3 { animation: challengePulse 1.4s ease-in-out infinite; animation-delay: 0.4s; }
          `}} />
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center">
              <Target className="w-8 h-8 text-green-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Iniciando Desafio...</h2>
              <p className="text-white/50 text-sm">Preparando sua simulação</p>
            </div>
            <div className="flex gap-2 mt-2">
              <div className="w-2.5 h-2.5 bg-green-400 rounded-full challenge-dot-1" />
              <div className="w-2.5 h-2.5 bg-green-400 rounded-full challenge-dot-2" />
              <div className="w-2.5 h-2.5 bg-green-400 rounded-full challenge-dot-3" />
            </div>
          </div>
        </div>
      )}

      {/* Tela de Configuração - Redesigned */}
      <div className={`${isSimulating || challengeConfig ? 'hidden' : ''}`}>
        <RoleplayConfigScreen
          personas={personas}
          objections={objections}
          objectives={objectives}
          tags={tags}
          personaTags={personaTags}
          businessType={businessType}
          age={age}
          onAgeChange={setAge}
          temperament={temperament}
          onTemperamentChange={setTemperament}
          selectedPersona={selectedPersona}
          onPersonaSelect={(id) => setSelectedPersona(id)}
          selectedObjections={selectedObjections}
          onObjectionToggle={toggleObjection}
          selectedObjective={selectedObjective}
          onObjectiveSelect={(id) => setSelectedObjective(id)}
          hiddenMode={hiddenMode}
          onToggleHidden={() => setHiddenMode(!hiddenMode)}
          isConfigLocked={isConfigLocked}
          isMeetSimulation={isMeetSimulation}
          dataLoading={dataLoading}
          roleplayLimitReached={roleplayLimitReached}
          mounted={mounted}
          onStart={handleStartSimulation}
          onRandomize={handleRandomSelection}
          challengeConfig={challengeConfig}
          meetSimulationConfig={meetSimulationConfig}
          isChallengeExpanded={isChallengeExpanded}
          onToggleChallengeExpanded={() => setIsChallengeExpanded(!isChallengeExpanded)}
          cleanSpinText={cleanSpinText}
          extractSpinLetter={extractSpinLetter}
          formatSpinLetter={formatSpinLetter}
        />
      </div>

      {/* OLD CONFIG SCREEN CODE REMOVED - replaced by RoleplayConfigScreen component above */}

      {/* Modal de Loading - Avaliação */}
        {isEvaluating && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Analisando sua performance...</h3>
              <p className="text-gray-500 text-sm">Nosso agente está avaliando sua conversa com base em metodologia SPIN Selling</p>
            </div>
          </div>
        )}

        {/* Modal de Conclusão - Redireciona para Histórico */}
        {showEvaluationSummary && evaluation && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Simulação Finalizada!</h2>
              <p className="text-gray-500 text-sm mb-8">
                Sua avaliação está pronta. Confira os detalhes no histórico.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowEvaluationSummary(false);
                    const historyTab = challengeConfig ? 'desafios' : isMeetSimulation ? 'correcoes' : 'simulacoes'
                    if (onNavigateToHistory) {
                      onNavigateToHistory(historyTab);
                    } else {
                      window.location.href = '/?view=historico';
                    }
                  }}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-medium transition-colors text-white text-sm"
                >
                  Ver Avaliação
                </button>
                <button
                  onClick={() => setShowEvaluationSummary(false)}
                  className="w-full px-4 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

    </>
  )
}
