'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Play, Clock, MessageCircle, Send, Calendar, User, Zap, Mic, MicOff, Volume2, UserCircle2, CheckCircle, Loader2, X, AlertCircle, ChevronDown, ChevronUp, Lock, Target, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react'
import { getPersonas, getObjections, getCompanyType, getTags, getPersonaTags, getRoleplayObjectives, type Persona, type PersonaB2B, type PersonaB2C, type Objection, type Tag, type RoleplayObjective } from '@/lib/config'
import { createRoleplaySession, addMessageToSession, endRoleplaySession, getRoleplaySession, type RoleplayMessage } from '@/lib/roleplay'
import { processWhisperTranscription } from '@/lib/utils/whisperValidation'
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
  const [showConfig, setShowConfig] = useState(false)
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

  // Configurações do roleplay
  const [age, setAge] = useState(30)
  const [temperament, setTemperament] = useState('Analítico')
  const [selectedPersona, setSelectedPersona] = useState('')
  const [selectedObjections, setSelectedObjections] = useState<string[]>([])
  const [selectedObjective, setSelectedObjective] = useState('')

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

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [])

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

    // Carregar tags de cada persona
    const newPersonaTags = new Map<string, Tag[]>()
    for (const persona of personasData) {
      if (persona.id) {
        const personaTagsData = await getPersonaTags(persona.id)
        newPersonaTags.set(persona.id, personaTagsData)
      }
    }
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
  }

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

    setShowConfig(false)
    setIsSimulating(true)
    setIsLoading(true)

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

      // Enviar todos os dados da persona para o agente
      let personaData: any = {}
      if (selectedPersonaData) {
        if (selectedPersonaData.business_type === 'B2B') {
          const persona = selectedPersonaData as PersonaB2B
          personaData = {
            business_type: 'B2B',
            job_title: persona.job_title,
            company_type: persona.company_type,
            context: persona.context,
            company_goals: persona.company_goals,
            business_challenges: persona.business_challenges,
            prior_knowledge: persona.prior_knowledge
          }
        } else {
          const persona = selectedPersonaData as PersonaB2C
          personaData = {
            business_type: 'B2C',
            profession: persona.profession,
            context: persona.context,
            what_seeks: persona.what_seeks,
            main_pains: persona.main_pains,
            prior_knowledge: persona.prior_knowledge
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
- Cargo: ${personaData.job_title || 'Não especificado'}
- Empresa: ${personaData.company_type || 'Não especificado'}
- Contexto: ${personaData.context || 'Não especificado'}
- O que busca para a empresa: ${personaData.company_goals || 'Não especificado'}
- Principais desafios do negócio: ${personaData.business_challenges || 'Não especificado'}
- O que já sabe sobre sua empresa: ${personaData.prior_knowledge || 'Não sabe nada ainda'}`
      } else if (personaData.business_type === 'B2C') {
        personaInfo = `
PERFIL DO CLIENTE B2C:
- Profissão: ${personaData.profession || 'Não especificado'}
- Contexto: ${personaData.context || 'Não especificado'}
- O que busca/valoriza: ${personaData.what_seeks || 'Não especificado'}
- Principais dores/problemas: ${personaData.main_pains || 'Não especificado'}
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

      // Criar nova sessão com N8N
      const response = await fetch('/api/roleplay/chat', {
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
        segmentDescription = personaData.job_title
        if (personaData.company_type) segmentDescription += ` de ${personaData.company_type}`
      } else if (personaData.business_type === 'B2C') {
        segmentDescription = personaData.profession
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
        personaData: selectedPersonaData?.job_title || selectedPersonaData?.profile_type,
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

      // Enviar para API (N8N)
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
        objections: objectionsWithRebuttals
      }

      console.log('📦 PAYLOAD COMPLETO sendo enviado:', JSON.stringify(payload, null, 2))

      const response = await fetch('/api/roleplay/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Erro ao enviar mensagem')
      }

      const data = await response.json()
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
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      alert('Erro ao enviar mensagem. Tente novamente.')
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
      setCurrentTranscription('') // Limpar transcrição anterior
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

      // Quando o áudio terminar, limpar visualizador e possivelmente finalizar
      audio.onended = () => {
        setIsPlayingAudio(false)
        setAudioVolume(0)
        URL.revokeObjectURL(audioUrl)

        // Limpar animação
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

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

      // Tocar o áudio
      await audio.play()
      console.log('🔊 Áudio tocando')
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
      <div className="min-h-screen py-20 px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`text-center mb-12 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            Treinamento de Roleplay
          </h1>
          <p className="text-xl text-gray-400">
            Pratique suas habilidades de vendas com nosso cliente virtual inteligente.
          </p>
        </div>

        {/* Session Info Card */}
        <div className={`max-w-2xl mx-auto mb-8 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl"></div>
            <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-green-500/30">
              {/* Contador de Créditos Mensais */}
              {planUsage && (
                <div className="flex justify-center mb-6">
                  <div className={`px-4 py-2 rounded-xl flex items-center gap-3 ${
                    planUsage.training?.credits?.limit !== null && planUsage.training?.credits?.used >= planUsage.training?.credits?.limit
                      ? 'bg-red-900/30 border border-red-500/40'
                      : 'bg-green-900/30 border border-green-500/40'
                  }`}>
                    <Zap className={`w-5 h-5 ${
                      planUsage.training?.credits?.limit !== null && planUsage.training?.credits?.used >= planUsage.training?.credits?.limit
                        ? 'text-red-400'
                        : 'text-green-400'
                    }`} />
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${
                        planUsage.training?.credits?.limit !== null && planUsage.training?.credits?.used >= planUsage.training?.credits?.limit
                          ? 'text-red-400'
                          : 'text-green-400'
                      }`}>
                        Créditos este mês: {planUsage.training?.credits?.used || 0}/{planUsage.training?.credits?.limit === null ? '∞' : planUsage.training?.credits?.limit || 0}
                      </span>
                      {planUsage.training?.credits?.limit !== null && planUsage.training?.credits?.used === planUsage.training?.credits?.limit - 1 && (
                        <span className="text-xs text-yellow-400 font-semibold animate-pulse">
                          ⚠️ Último crédito disponível!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-4 mb-6">
                {!isSimulating && (
                  <button
                    onClick={() => setShowConfig(true)}
                    disabled={roleplayLimitReached}
                    className={`px-8 py-4 rounded-2xl font-semibold text-lg flex items-center gap-3 transition-transform ${
                      roleplayLimitReached
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                        : 'bg-gradient-to-r from-green-600 to-green-500 hover:scale-105 glow-green'
                    }`}
                  >
                    {roleplayLimitReached ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                    {roleplayLimitReached ? 'Limite Semanal Atingido' : 'Iniciar Simulação'}
                  </button>
                )}
              </div>

              {/* Data e Hora Atual */}
              <div className="flex items-center justify-center gap-2 text-gray-300 pt-4 border-t border-green-500/20">
                <Calendar className="w-5 h-5 text-green-400" />
                <span className="text-sm">
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
            </div>
          </div>
        </div>

        {/* Main Chat Section - Centralizado */}
        <div className="flex justify-center max-w-3xl mx-auto">
          {/* Chat da Simulação */}
          <div className={`w-full ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '200ms' }}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-6 border border-green-500/30">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-green-500/20">
                  <MessageCircle className="w-5 h-5 text-green-400" />
                  <h3 className="text-xl font-bold">Chat da Simulação</h3>
                </div>

                <div className="space-y-4 mb-4 h-96 overflow-y-auto pr-2">
                  {/* Real messages from OpenAI Assistant */}
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${msg.role === 'seller' ? 'justify-end' : ''} animate-slide-up`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {msg.role === 'client' && (
                        <div className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-green-400" />
                        </div>
                      )}
                      <div className={`flex-1 ${msg.role === 'seller' ? 'flex flex-col items-end' : ''}`}>
                        <div className="text-xs text-gray-400 mb-1">
                          {msg.role === 'client' ? 'Cliente virtual (IA)' : 'Vendedor (você)'}
                        </div>
                        <div
                          className={`${
                            msg.role === 'client'
                              ? 'bg-gray-800/50 rounded-2xl rounded-tl-none'
                              : `${
                                  msg.text === lastUserMessage && lastUserMessage !== ''
                                    ? 'bg-gradient-to-r from-green-600/30 to-green-500/30 border border-green-500/40'
                                    : 'bg-green-600/20'
                                } rounded-2xl rounded-tr-none max-w-md`
                          } p-4 text-sm text-gray-300 transition-all duration-300`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-400 mb-1">Cliente virtual (IA)</div>
                        <div className="bg-gray-800/50 rounded-2xl rounded-tl-none p-4 text-sm text-gray-300">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Audio playing indicator */}
                  {isPlayingAudio && (
                    <div className="flex items-center justify-center py-2">
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-600/20 rounded-full">
                        <Volume2 className="w-4 h-4 text-green-400 animate-pulse" />
                        <span className="text-xs text-green-400">Cliente falando...</span>
                      </div>
                    </div>
                  )}

                  {/* Recording indicator */}
                  {isRecording && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 rounded-full animate-pulse">
                          <Mic className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-red-400">🎤 Gravando...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status da transcrição - sempre visível quando tem conteúdo */}
                  {currentTranscription && (
                    <div className="mx-4 animate-slide-up">
                      <div className={`p-4 rounded-xl border transition-all duration-300 ${
                        currentTranscription.includes('✅')
                          ? 'bg-green-900/20 border-green-500/30 shadow-lg shadow-green-500/10'
                          : currentTranscription.includes('📤')
                          ? 'bg-blue-900/20 border-blue-500/30 shadow-lg shadow-blue-500/10'
                          : currentTranscription.includes('❌')
                          ? 'bg-red-900/20 border-red-500/30 shadow-lg shadow-red-500/10'
                          : 'bg-gray-800/50 border-green-500/20'
                      }`}>
                        <p className="text-sm text-center font-medium">
                          {currentTranscription}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mensagem de Finalização Automática */}
                  {showFinalizingMessage && (
                    <div className="mx-4 animate-slide-up">
                      <div className="p-4 rounded-xl border bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-500/40 shadow-lg shadow-yellow-500/20">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-400 animate-pulse" />
                            <p className="text-sm font-semibold text-yellow-400">
                              Roleplay Finalizado pela IA
                            </p>
                          </div>
                          <p className="text-xs text-gray-300 text-center">
                            Finalizando automaticamente...
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Empty state when no simulation */}
                  {!isSimulating && messages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500 text-sm">Clique em "Iniciar Simulação" para começar</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 pt-4 border-t border-green-500/20">
                  {/* Botões de controle de gravação */}
                  {isSimulating && (
                    <div className="flex items-center gap-3">
                      {isPlayingAudio && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-600/20 rounded-full">
                          <Volume2 className="w-4 h-4 text-green-400 animate-pulse" />
                          <span className="text-sm text-green-400">Aguarde o cliente terminar...</span>
                        </div>
                      )}

                      {isLoading && !isRecording && !isPlayingAudio && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-600/20 rounded-full">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-gray-400">Processando...</span>
                        </div>
                      )}

                      {/* Container flex para botões lado a lado */}
                      <div className="flex items-center gap-4">
                        {/* Botão de Iniciar Gravação / Finalizar Fala */}
                        {!isPlayingAudio && !isRecording && !isLoading && (
                          <button
                            onClick={startRecording}
                            disabled={showFinalizingMessage}
                            className={`p-4 border rounded-full transition-all ${
                              showFinalizingMessage
                                ? 'bg-gray-800/20 border-gray-600/30 cursor-not-allowed opacity-50'
                                : 'bg-green-600/20 border-green-500/30 hover:bg-green-600/30'
                            }`}
                            title={showFinalizingMessage ? "Finalizando sessão..." : "Clique para começar a falar"}
                          >
                            <Mic className={`w-6 h-6 ${showFinalizingMessage ? 'text-gray-500' : 'text-green-400'}`} />
                          </button>
                        )}

                        {isRecording && (
                          <button
                            onClick={stopRecording}
                            disabled={showFinalizingMessage}
                            className={`px-6 py-3 border rounded-xl transition-all flex items-center gap-2 ${
                              showFinalizingMessage
                                ? 'bg-gray-800/20 border-gray-600/30 cursor-not-allowed opacity-50'
                                : 'bg-red-600/20 border-red-500/30 hover:bg-red-600/30'
                            }`}
                            title={showFinalizingMessage ? "Finalizando sessão..." : "Clique para finalizar e enviar"}
                          >
                            <MicOff className={`w-5 h-5 ${showFinalizingMessage ? 'text-gray-500' : 'text-red-400'}`} />
                            <span className={`text-sm font-medium ${showFinalizingMessage ? 'text-gray-500' : 'text-red-400'}`}>Finalizar Fala</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {!isSimulating && (
                    <p className="text-gray-500 text-sm">Clique em "Iniciar Simulação" para começar a conversa por voz</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Modal */}
        {showConfig && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
            <div className="min-h-screen py-8 px-4 sm:px-6">
              <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Configuração da Sessão</h1>
                    <p className="text-gray-400 text-sm">Configure os parâmetros do seu roleplay</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowConfig(false);
                    }}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    type="button"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Coluna Esquerda - Cliente */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Perfil do Cliente</h3>

                    {/* Idade do Cliente */}
                    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-300">Idade do Cliente</label>
                        <span className="text-lg font-bold text-green-400">{age} anos</span>
                      </div>
                      <input
                        type="range"
                        min="18"
                        max="60"
                        value={age}
                        onChange={(e) => setAge(Number(e.target.value))}
                        className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>18</span>
                        <span>60</span>
                      </div>

                      {/* Info da faixa etária */}
                      <div className="mt-4 bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                        {age >= 18 && age <= 24 && (
                          <div>
                            <p className="text-sm font-medium text-blue-400 mb-2">18 a 24 anos</p>
                            <div className="space-y-1 text-xs text-gray-400">
                              <p><span className="text-gray-300">Tom:</span> Informal e moderno</p>
                              <p><span className="text-gray-300">Comportamento:</span> Aceita novidades • Referências digitais</p>
                            </div>
                          </div>
                        )}
                        {age >= 25 && age <= 34 && (
                          <div>
                            <p className="text-sm font-medium text-green-400 mb-2">25 a 34 anos</p>
                            <div className="space-y-1 text-xs text-gray-400">
                              <p><span className="text-gray-300">Tom:</span> Pragmático e orientado a resultados</p>
                              <p><span className="text-gray-300">Comportamento:</span> Foco em ROI • Aceita risco calculado</p>
                            </div>
                          </div>
                        )}
                        {age >= 35 && age <= 44 && (
                          <div>
                            <p className="text-sm font-medium text-yellow-400 mb-2">35 a 44 anos</p>
                            <div className="space-y-1 text-xs text-gray-400">
                              <p><span className="text-gray-300">Tom:</span> Equilibrado entre desempenho e estabilidade</p>
                              <p><span className="text-gray-300">Comportamento:</span> Valoriza compliance • Cauteloso</p>
                            </div>
                          </div>
                        )}
                        {age >= 45 && age <= 60 && (
                          <div>
                            <p className="text-sm font-medium text-orange-400 mb-2">45 a 60 anos</p>
                            <div className="space-y-1 text-xs text-gray-400">
                              <p><span className="text-gray-300">Tom:</span> Conservador e formal</p>
                              <p><span className="text-gray-300">Comportamento:</span> Foco em segurança • Avesso a riscos</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Temperamento */}
                    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                      <label className="text-sm font-medium text-gray-300 mb-3 block">Temperamento</label>
                      <div className="flex flex-wrap gap-2">
                        {temperaments.map((temp) => (
                          <button
                            key={temp}
                            onClick={() => setTemperament(temp)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              temperament === temp
                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-300'
                            }`}
                          >
                            {temp}
                          </button>
                        ))}
                      </div>

                      {/* Info do temperamento */}
                      <div className="mt-4 bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                        {temperament === 'Analítico' && (
                          <div>
                            <p className="text-sm font-medium text-green-400 mb-2">Analítico</p>
                            <div className="space-y-1 text-xs text-gray-400">
                              <p><span className="text-gray-300">Estilo:</span> Formal, racional, calmo e preciso</p>
                              <p><span className="text-gray-300">Gatilhos:</span> Dados concretos, estatísticas, provas de eficácia</p>
                            </div>
                          </div>
                        )}
                        {temperament === 'Empático' && (
                          <div>
                            <p className="text-sm font-medium text-pink-400 mb-2">Empático</p>
                            <div className="space-y-1 text-xs text-gray-400">
                              <p><span className="text-gray-300">Estilo:</span> Afável, próximo, gentil e emocional</p>
                              <p><span className="text-gray-300">Gatilhos:</span> Histórias reais, propósito, apoio humano</p>
                            </div>
                          </div>
                        )}
                        {temperament === 'Determinado' && (
                          <div>
                            <p className="text-sm font-medium text-red-400 mb-2">Determinado</p>
                            <div className="space-y-1 text-xs text-gray-400">
                              <p><span className="text-gray-300">Estilo:</span> Objetivo, seguro, impaciente e assertivo</p>
                              <p><span className="text-gray-300">Gatilhos:</span> Soluções rápidas, eficiência, resultado imediato</p>
                            </div>
                          </div>
                        )}
                        {temperament === 'Indeciso' && (
                          <div>
                            <p className="text-sm font-medium text-yellow-400 mb-2">Indeciso</p>
                            <div className="space-y-1 text-xs text-gray-400">
                              <p><span className="text-gray-300">Estilo:</span> Hesitante, cauteloso e questionador</p>
                              <p><span className="text-gray-300">Gatilhos:</span> Depoimentos, garantias, segurança, prova social</p>
                            </div>
                          </div>
                        )}
                        {temperament === 'Sociável' && (
                          <div>
                            <p className="text-sm font-medium text-cyan-400 mb-2">Sociável</p>
                            <div className="space-y-1 text-xs text-gray-400">
                              <p><span className="text-gray-300">Estilo:</span> Leve, animado, entusiasmado e informal</p>
                              <p><span className="text-gray-300">Gatilhos:</span> Amizade, humor, interesse genuíno, energia positiva</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita - Cenário */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Cenário do Roleplay</h3>

                    {/* Persona */}
                    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                      <label className="text-sm font-medium text-gray-300 mb-3 block">Persona</label>
                      {(businessType === 'Ambos' ? personas : personas.filter(p => p.business_type === businessType)).length === 0 ? (
                        <div className="text-gray-500 text-sm py-4 text-center">
                          Nenhuma persona {businessType} cadastrada.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                          {(() => {
                            const { sortedGroups, noTagPersonas } = getGroupedPersonas()
                            return (
                              <>
                                {sortedGroups.map(({ tag, personas: groupPersonas }) => (
                                  <div key={tag.id} className="space-y-2">
                                    <div className="flex items-center gap-2 py-1">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{tag.name}</span>
                                    </div>
                                    {groupPersonas.map((persona) => (
                                      <div
                                        key={persona.id}
                                        onClick={() => setSelectedPersona(persona.id!)}
                                        className={`cursor-pointer rounded-lg p-3 border transition-all ${
                                          selectedPersona === persona.id
                                            ? 'bg-green-500/10 border-green-500/50'
                                            : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            selectedPersona === persona.id ? 'bg-green-500/20' : 'bg-gray-800'
                                          }`}>
                                            <UserCircle2 className={`w-5 h-5 ${selectedPersona === persona.id ? 'text-green-400' : 'text-gray-500'}`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">
                                              {persona.business_type === 'B2B' ? (persona as PersonaB2B).job_title : (persona as PersonaB2C).profession}
                                            </p>
                                            {personaTags.get(persona.id!) && personaTags.get(persona.id!)!.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {personaTags.get(persona.id!)!.map((t) => (
                                                  <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
                                                ))}
                                              </div>
                                            )}
                                            <p className="text-xs text-gray-500 mt-1 truncate">
                                              {persona.business_type === 'B2B' ? (persona as PersonaB2B).company_type : (persona as PersonaB2C).what_seeks}
                                            </p>
                                          </div>
                                          {selectedPersona === persona.id && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setExpandedPersonaId(expandedPersonaId === persona.id ? null : persona.id!) }}
                                            className="p-1 text-gray-500 hover:text-gray-300"
                                          >
                                            {expandedPersonaId === persona.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                          </button>
                                        </div>
                                        {expandedPersonaId === persona.id && (
                                          <div className="mt-3 pt-3 border-t border-gray-700 space-y-1 text-xs text-gray-400">
                                            {persona.business_type === 'B2B' ? (
                                              <>
                                                <p><span className="text-gray-300">Empresa:</span> {(persona as PersonaB2B).company_type}</p>
                                                <p><span className="text-gray-300">Contexto:</span> {(persona as PersonaB2B).business_challenges}</p>
                                                <p><span className="text-gray-300">Busca:</span> {(persona as PersonaB2B).company_goals}</p>
                                              </>
                                            ) : (
                                              <>
                                                <p><span className="text-gray-300">Busca:</span> {(persona as PersonaB2C).what_seeks}</p>
                                                <p><span className="text-gray-300">Dores:</span> {(persona as PersonaB2C).main_pains}</p>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                                {noTagPersonas.length > 0 && (
                                  <div className="space-y-2">
                                    {sortedGroups.length > 0 && (
                                      <div className="flex items-center gap-2 py-1">
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sem Etiqueta</span>
                                      </div>
                                    )}
                                    {noTagPersonas.map((persona) => (
                                      <div
                                        key={persona.id}
                                        onClick={() => setSelectedPersona(persona.id!)}
                                        className={`cursor-pointer rounded-lg p-3 border transition-all ${
                                          selectedPersona === persona.id
                                            ? 'bg-green-500/10 border-green-500/50'
                                            : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            selectedPersona === persona.id ? 'bg-green-500/20' : 'bg-gray-800'
                                          }`}>
                                            <UserCircle2 className={`w-5 h-5 ${selectedPersona === persona.id ? 'text-green-400' : 'text-gray-500'}`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">
                                              {persona.business_type === 'B2B' ? (persona as PersonaB2B).job_title : (persona as PersonaB2C).profession}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1 truncate">
                                              {persona.business_type === 'B2B' ? (persona as PersonaB2B).company_type : (persona as PersonaB2C).what_seeks}
                                            </p>
                                          </div>
                                          {selectedPersona === persona.id && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setExpandedPersonaId(expandedPersonaId === persona.id ? null : persona.id!) }}
                                            className="p-1 text-gray-500 hover:text-gray-300"
                                          >
                                            {expandedPersonaId === persona.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                          </button>
                                        </div>
                                        {expandedPersonaId === persona.id && (
                                          <div className="mt-3 pt-3 border-t border-gray-700 space-y-1 text-xs text-gray-400">
                                            {persona.business_type === 'B2B' ? (
                                              <>
                                                <p><span className="text-gray-300">Empresa:</span> {(persona as PersonaB2B).company_type}</p>
                                                <p><span className="text-gray-300">Contexto:</span> {(persona as PersonaB2B).business_challenges}</p>
                                              </>
                                            ) : (
                                              <>
                                                <p><span className="text-gray-300">Busca:</span> {(persona as PersonaB2C).what_seeks}</p>
                                                <p><span className="text-gray-300">Dores:</span> {(persona as PersonaB2C).main_pains}</p>
                                              </>
                                            )}
                                          </div>
                                        )}
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

                    {/* Objeções */}
                    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-300">Objeções</label>
                        <span className="text-xs text-green-400 font-medium">{selectedObjections.length} selecionadas</span>
                      </div>
                      {objections.length === 0 ? (
                        <div className="text-gray-500 text-sm py-4 text-center">Nenhuma objeção cadastrada.</div>
                      ) : (
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                          {objections.map((objection) => (
                            <div
                              key={objection.id}
                              className={`group rounded-lg p-3 border transition-all ${
                                selectedObjections.includes(objection.id)
                                  ? 'bg-green-500/10 border-green-500/50'
                                  : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  onClick={() => toggleObjection(objection.id)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all mt-0.5 ${
                                    selectedObjections.includes(objection.id)
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-600 group-hover:border-gray-500'
                                  }`}
                                >
                                  {selectedObjections.includes(objection.id) && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleObjection(objection.id)}>
                                  <span className={`text-sm ${expandedObjectionId === objection.id ? '' : 'truncate block'} ${
                                    selectedObjections.includes(objection.id) ? 'text-white font-medium' : 'text-gray-300'
                                  }`}>{objection.name}</span>
                                  {expandedObjectionId === objection.id && objection.rebuttals && objection.rebuttals.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                                      <p className="text-xs text-green-400 font-medium">Rebatidas:</p>
                                      {objection.rebuttals.map((rebuttal, idx) => (
                                        <p key={idx} className="text-xs text-gray-400">• {rebuttal}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedObjectionId(expandedObjectionId === objection.id ? null : objection.id) }}
                                  className="p-1 text-gray-500 hover:text-gray-300 flex-shrink-0"
                                >
                                  {expandedObjectionId === objection.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Objetivo */}
                    <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                      <label className="text-sm font-medium text-gray-300 mb-3 block">
                        Objetivo do Roleplay <span className="text-red-400">*</span>
                      </label>
                      {objectives.length === 0 ? (
                        <div className="text-gray-500 text-sm py-4 text-center">Nenhum objetivo cadastrado.</div>
                      ) : (
                        <div className="space-y-2">
                          {objectives.map((objective) => (
                            <div
                              key={objective.id}
                              onClick={() => setSelectedObjective(objective.id)}
                              className={`cursor-pointer rounded-lg p-3 border transition-all ${
                                selectedObjective === objective.id
                                  ? 'bg-green-500/10 border-green-500/50'
                                  : 'bg-gray-800/30 border-gray-700 hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                  selectedObjective === objective.id ? 'bg-green-500 border-green-500' : 'border-gray-600'
                                }`}>
                                  {selectedObjective === objective.id && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className={`text-sm font-medium ${selectedObjective === objective.id ? 'text-white' : 'text-gray-300'}`}>
                                    {objective.name}
                                  </p>
                                  {objective.description && (
                                    <p className="text-xs text-gray-500 mt-1">{objective.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Aviso de configuração incompleta */}
                {(!selectedPersona || selectedObjections.length === 0 || !selectedObjective) && (
                  <div className="mt-6 bg-yellow-500/10 rounded-xl border border-yellow-500/30 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-400 mb-2">Configure os itens obrigatórios:</p>
                        <ul className="space-y-1 text-xs text-yellow-300/80">
                          {!selectedPersona && <li>• Selecione uma Persona</li>}
                          {selectedObjections.length === 0 && <li>• Selecione pelo menos uma Objeção</li>}
                          {!selectedObjective && <li>• Selecione um Objetivo</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowConfig(false); }}
                    type="button"
                    className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl font-medium hover:bg-gray-800 transition-colors text-gray-300 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleStartSimulation}
                    type="button"
                    disabled={!selectedPersona || selectedObjections.length === 0 || !selectedObjective}
                    className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all text-sm ${
                      !selectedPersona || selectedObjections.length === 0 || !selectedObjective
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    Iniciar Roleplay
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
      </div>
    </div>
    </>
  )
}
