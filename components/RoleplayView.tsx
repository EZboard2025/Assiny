'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Play, Clock, MessageCircle, Send, Calendar, User, Zap, Mic, MicOff, Volume2, UserCircle2, CheckCircle, Loader2, X, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { getPersonas, getObjections, getCompanyType, getTags, getPersonaTags, type Persona, type PersonaB2B, type PersonaB2C, type Objection, type Tag } from '@/lib/config'
import { createRoleplaySession, addMessageToSession, endRoleplaySession, getRoleplaySession, type RoleplayMessage } from '@/lib/roleplay'
import { processWhisperTranscription } from '@/lib/utils/whisperValidation'

interface RoleplayViewProps {
  onNavigateToHistory?: () => void
}

export default function RoleplayView({ onNavigateToHistory }: RoleplayViewProps = {}) {
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

  // Dados do banco
  const [businessType, setBusinessType] = useState<'B2B' | 'B2C'>('B2C')
  const [personas, setPersonas] = useState<Persona[]>([])
  const [objections, setObjections] = useState<Objection[]>([])
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

  const loadData = async () => {
    const [businessTypeData, personasData, objectionsData, tagsData] = await Promise.all([
      getCompanyType(),
      getPersonas(),
      getObjections(),
      getTags(),
    ])
    setBusinessType(businessTypeData)
    setPersonas(personasData)
    setObjections(objectionsData)
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
    const filteredPersonas = personasData.filter(p => p.business_type === businessTypeData)
    if (filteredPersonas.length > 0) {
      setSelectedPersona(filteredPersonas[0].id!)
    }
  }

  const temperaments = ['Analítico', 'Empático', 'Determinado', 'Indeciso', 'Sociável']

  // Função para agrupar e ordenar personas por tags
  const getGroupedPersonas = () => {
    const filtered = personas.filter(p => p.business_type === businessType)

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

      // Formatar objeções com suas formas de quebra
      const objectionsWithRebuttals = selectedObjectionsData.map(o => ({
        name: o.name,
        rebuttals: o.rebuttals || []
      }))

      // Salvar configuração completa para usar em todas as mensagens
      const fullConfig = {
        age,
        temperament,
        selectedPersona: selectedPersonaData,
        objections: objectionsWithRebuttals,
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
      })

      if (session) {
        setSessionId(session.id)
        console.log('💾 Sessão salva no Supabase:', session.id)
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

        // Formatar objeções com suas formas de quebra
        objectionsWithRebuttals = selectedObjectionsData.map(o => ({
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
              <div className="flex justify-center gap-4 mb-6">
                {!isSimulating && (
                  <button
                    onClick={() => setShowConfig(true)}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 rounded-2xl font-semibold text-lg flex items-center gap-3 hover:scale-105 transition-transform glow-green"
                  >
                    <Play className="w-5 h-5" />
                    Iniciar Simulação
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

                        {/* Botão Finalizar Sessão - sempre visível ao lado do microfone */}
                        {sessionId && !isEvaluating && (
                          <button
                            onClick={handleEndSession}
                            disabled={showFinalizingMessage}
                            className={`px-4 py-2 border rounded-lg transition-all flex items-center gap-2 text-sm ${
                              showFinalizingMessage
                                ? 'bg-gray-800/20 border-gray-600/30 cursor-not-allowed opacity-50'
                                : 'bg-red-600/20 border-red-500/30 hover:bg-red-600/30'
                            }`}
                            title={showFinalizingMessage ? "Finalizando automaticamente..." : "Encerrar e avaliar sessão"}
                          >
                            <X className={`w-4 h-4 ${showFinalizingMessage ? 'text-gray-500' : 'text-red-400'}`} />
                            <span className={`font-medium ${showFinalizingMessage ? 'text-gray-500' : 'text-red-400'}`}>Finalizar Sessão</span>
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 pt-24">
            <div className="relative max-w-5xl w-full">
              <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl"></div>
              <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-3xl p-6 border border-green-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Configuração da Sessão</h2>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowConfig(false);
                    }}
                    className="text-gray-400 hover:text-white transition-colors text-2xl z-50 cursor-pointer"
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Coluna Esquerda */}
                  <div className="space-y-4">
                    {/* Idade do Cliente */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Idade do Cliente: <span className="text-green-400 text-lg font-bold">{age} anos</span>
                      </label>
                      <input
                        type="range"
                        min="18"
                        max="60"
                        value={age}
                        onChange={(e) => setAge(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-purple"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>18</span>
                        <span>60</span>
                      </div>

                      {/* Caixa de Comportamento por Faixa Etária */}
                      <div className="mt-3 bg-gradient-to-br from-blue-900/20 to-green-900/20 border border-blue-500/30 rounded-xl p-3">
                        {age >= 18 && age <= 24 && (
                          <div>
                            <p className="text-sm font-semibold text-blue-400 mb-2">18 a 24 anos</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Tom:</span> Informal e moderno</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Vocabulário:</span> "Preciso ver o retorno disso", "Quanto isso impacta no CPA?"</p>
                            <p className="text-xs text-gray-300"><span className="font-semibold">Comportamento:</span> Aceita novidades • Referências digitais • Trends</p>
                          </div>
                        )}
                        {age >= 25 && age <= 34 && (
                          <div>
                            <p className="text-sm font-semibold text-green-400 mb-2">25 a 34 anos</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Tom:</span> Pragmático e orientado a resultados</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Vocabulário:</span> "Preciso ver o retorno disso", "Quanto isso impacta no CPA?"</p>
                            <p className="text-xs text-gray-300"><span className="font-semibold">Comportamento:</span> Foco em ROI • Aceita risco calculado • Profissional</p>
                          </div>
                        )}
                        {age >= 35 && age <= 44 && (
                          <div>
                            <p className="text-sm font-semibold text-yellow-400 mb-2">35 a 44 anos</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Tom:</span> Equilibrado entre desempenho e estabilidade</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Vocabulário:</span> "Preciso garantir que isso não quebra nada"</p>
                            <p className="text-xs text-gray-300"><span className="font-semibold">Comportamento:</span> Valoriza compliance • Cauteloso • Validação prática</p>
                          </div>
                        )}
                        {age >= 45 && age <= 60 && (
                          <div>
                            <p className="text-sm font-semibold text-orange-400 mb-2">45 a 60 anos</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Tom:</span> Conservador e formal</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Vocabulário:</span> "Não posso me dar ao luxo de instabilidade"</p>
                            <p className="text-xs text-gray-300"><span className="font-semibold">Comportamento:</span> Foco em segurança • Avesso a riscos • Suporte dedicado</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Temperamento */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Temperamento
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {temperaments.map((temp) => (
                          <button
                            key={temp}
                            onClick={() => setTemperament(temp)}
                            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              temperament === temp
                                ? 'bg-gradient-to-r from-green-600 to-green-500 text-white'
                                : 'bg-gray-800/50 text-gray-400 border border-green-500/20 hover:border-green-500/40'
                            }`}
                          >
                            {temp}
                          </button>
                        ))}
                      </div>

                      {/* Caixa de Descrição do Temperamento */}
                      <div className="mt-3 bg-gradient-to-br from-green-900/20 to-pink-900/20 border border-green-500/30 rounded-xl p-3">
                        {temperament === 'Analítico' && (
                          <div>
                            <p className="text-sm font-semibold text-green-400 mb-2">Analítico</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Comportamento:</span> Tom formal e lógico • Faz perguntas técnicas • Desconfia de argumentos subjetivos</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Estilo:</span> Formal, racional, calmo e preciso</p>
                            <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Dados concretos, estatísticas, provas de eficácia, garantias</p>
                          </div>
                        )}
                        {temperament === 'Empático' && (
                          <div>
                            <p className="text-sm font-semibold text-pink-400 mb-2">Empático</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Comportamento:</span> Demonstra empatia genuína • Compartilha experiências pessoais • Pergunta sobre impacto humano</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Estilo:</span> Afável, próximo, gentil e emocional</p>
                            <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Histórias reais, propósito, apoio humano, relacionamento</p>
                          </div>
                        )}
                        {temperament === 'Determinado' && (
                          <div>
                            <p className="text-sm font-semibold text-red-400 mb-2">Determinado</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Comportamento:</span> Postura firme e objetiva • Corta rodeios • Perguntas estratégicas • Demonstra impaciência</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Estilo:</span> Objetivo, seguro, impaciente e assertivo</p>
                            <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Soluções rápidas, eficiência, autoridade, resultado imediato</p>
                          </div>
                        )}
                        {temperament === 'Indeciso' && (
                          <div>
                            <p className="text-sm font-semibold text-yellow-400 mb-2">Indeciso</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Comportamento:</span> Demonstra insegurança e dúvida • Faz perguntas repetidas • Expressa medo • Busca garantias</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Estilo:</span> Hesitante, cauteloso e questionador</p>
                            <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Depoimentos, garantias, segurança, prova social</p>
                          </div>
                        )}
                        {temperament === 'Sociável' && (
                          <div>
                            <p className="text-sm font-semibold text-cyan-400 mb-2">Sociável</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Comportamento:</span> Animado e espontâneo • Usa humor leve • Faz comentários fora do tema • Mostra tédio se vendedor for frio</p>
                            <p className="text-xs text-gray-300 mb-1"><span className="font-semibold">Estilo:</span> Leve, animado, entusiasmado e informal</p>
                            <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Amizade, humor, interesse genuíno, energia positiva</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita */}
                  <div className="space-y-4">
                    {/* Persona */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Persona
                      </label>
                      {personas.filter(p => p.business_type === businessType).length === 0 ? (
                        <div className="bg-gray-800/50 border border-green-500/20 rounded-xl p-3 text-gray-400 text-sm">
                          Nenhuma persona {businessType} cadastrada.
                        </div>
                      ) : (
                        <div
                          className="space-y-3 overflow-y-auto pr-2"
                          style={{ height: '200px', maxHeight: '200px', overflowY: 'scroll' }}
                        >
                          {(() => {
                            const { sortedGroups, noTagPersonas } = getGroupedPersonas()

                            return (
                              <>
                                {/* Personas agrupadas por tag */}
                                {sortedGroups.map(({ tag, personas: groupPersonas }) => (
                                  <div key={tag.id} className="space-y-2">
                                    {/* Separador de tag */}
                                    <div className="flex items-center gap-2 px-2 py-1">
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: tag.color }}
                                      />
                                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        {tag.name}
                                      </span>
                                      <div className="flex-1 h-px bg-gray-700/50" />
                                    </div>

                                    {/* Personas do grupo */}
                                    {groupPersonas.map((persona) => (
                              <div
                                key={persona.id}
                                className={`bg-gradient-to-br from-gray-900/80 to-gray-900/40 border rounded-xl p-3 transition-all ${
                                  selectedPersona === persona.id
                                    ? 'border-green-500 shadow-lg shadow-green-500/20'
                                    : 'border-green-500/30 hover:border-green-500/50'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    onClick={() => setSelectedPersona(persona.id!)}
                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center flex-shrink-0 cursor-pointer"
                                  >
                                    <UserCircle2 className="w-6 h-6 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0" onClick={() => setSelectedPersona(persona.id!)}>
                                    <h4 className="font-semibold text-white text-sm cursor-pointer">
                                      {persona.business_type === 'B2B'
                                        ? (persona as PersonaB2B).job_title
                                        : (persona as PersonaB2C).profession}
                                    </h4>
                                    {/* Tags da persona */}
                                    {personaTags.get(persona.id!) && personaTags.get(persona.id!)!.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {personaTags.get(persona.id!)!.map((tag) => (
                                          <span
                                            key={tag.id}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-white"
                                            style={{ backgroundColor: tag.color }}
                                          >
                                            {tag.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {expandedPersonaId === persona.id ? (
                                      <div className="text-xs text-gray-400 mt-2 space-y-1">
                                        {persona.business_type === 'B2B' ? (
                                          <>
                                            <p><span className="text-green-400 font-medium">Empresa:</span> {(persona as PersonaB2B).company_type}</p>
                                            <p><span className="text-green-400 font-medium">Contexto:</span> {(persona as PersonaB2B).business_challenges}</p>
                                            <p><span className="text-green-400 font-medium">Busca:</span> {(persona as PersonaB2B).company_goals}</p>
                                            <p><span className="text-green-400 font-medium">Dores:</span> {(persona as PersonaB2B).prior_knowledge}</p>
                                          </>
                                        ) : (
                                          <>
                                            <p><span className="text-green-400 font-medium">Busca:</span> {(persona as PersonaB2C).what_seeks}</p>
                                            <p><span className="text-green-400 font-medium">Dores:</span> {(persona as PersonaB2C).main_pains}</p>
                                            <p><span className="text-green-400 font-medium">Conhecimento:</span> {(persona as PersonaB2C).prior_knowledge}</p>
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 mt-1 line-clamp-1 cursor-pointer">
                                        {persona.business_type === 'B2B'
                                          ? (persona as PersonaB2B).company_type
                                          : (persona as PersonaB2C).what_seeks}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                    {selectedPersona === persona.id && (
                                      <CheckCircle className="w-5 h-5 text-green-500" />
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedPersonaId(expandedPersonaId === persona.id ? null : persona.id!)
                                      }}
                                      className="text-green-400 hover:text-green-300 transition-colors p-1"
                                    >
                                      {expandedPersonaId === persona.id ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                                    ))}
                                  </div>
                                ))}

                                {/* Personas sem tag */}
                                {noTagPersonas.length > 0 && (
                                  <div className="space-y-2">
                                    {/* Separador "Sem Etiqueta" */}
                                    {sortedGroups.length > 0 && (
                                      <div className="flex items-center gap-2 px-2 py-1">
                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                          Sem Etiqueta
                                        </span>
                                        <div className="flex-1 h-px bg-gray-700/50" />
                                      </div>
                                    )}

                                    {/* Personas sem tag */}
                                    {noTagPersonas.map((persona) => (
                              <div
                                key={persona.id}
                                className={`bg-gradient-to-br from-gray-900/80 to-gray-900/40 border rounded-xl p-3 transition-all ${
                                  selectedPersona === persona.id
                                    ? 'border-green-500 shadow-lg shadow-green-500/20'
                                    : 'border-green-500/30 hover:border-green-500/50'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    onClick={() => setSelectedPersona(persona.id!)}
                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center flex-shrink-0 cursor-pointer"
                                  >
                                    <UserCircle2 className="w-6 h-6 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0" onClick={() => setSelectedPersona(persona.id!)}>
                                    <h4 className="font-semibold text-white text-sm cursor-pointer">
                                      {persona.business_type === 'B2B'
                                        ? (persona as PersonaB2B).job_title
                                        : (persona as PersonaB2C).profession}
                                    </h4>
                                    {/* Tags da persona */}
                                    {personaTags.get(persona.id!) && personaTags.get(persona.id!)!.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {personaTags.get(persona.id!)!.map((tag) => (
                                          <span
                                            key={tag.id}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-white"
                                            style={{ backgroundColor: tag.color }}
                                          >
                                            {tag.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {expandedPersonaId === persona.id ? (
                                      <div className="text-xs text-gray-400 mt-2 space-y-1">
                                        {persona.business_type === 'B2B' ? (
                                          <>
                                            <p><span className="text-green-400 font-medium">Empresa:</span> {(persona as PersonaB2B).company_type}</p>
                                            <p><span className="text-green-400 font-medium">Contexto:</span> {(persona as PersonaB2B).business_challenges}</p>
                                            <p><span className="text-green-400 font-medium">Busca:</span> {(persona as PersonaB2B).company_goals}</p>
                                            <p><span className="text-green-400 font-medium">Dores:</span> {(persona as PersonaB2B).prior_knowledge}</p>
                                          </>
                                        ) : (
                                          <>
                                            <p><span className="text-green-400 font-medium">Busca:</span> {(persona as PersonaB2C).what_seeks}</p>
                                            <p><span className="text-green-400 font-medium">Dores:</span> {(persona as PersonaB2C).main_pains}</p>
                                            <p><span className="text-green-400 font-medium">Conhecimento:</span> {(persona as PersonaB2C).prior_knowledge}</p>
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 mt-1 line-clamp-1 cursor-pointer">
                                        {persona.business_type === 'B2B'
                                          ? (persona as PersonaB2B).company_type
                                          : (persona as PersonaB2C).what_seeks}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                    {selectedPersona === persona.id && (
                                      <CheckCircle className="w-5 h-5 text-green-500" />
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedPersonaId(expandedPersonaId === persona.id ? null : persona.id!)
                                      }}
                                      className="text-green-400 hover:text-green-300 transition-colors p-1"
                                    >
                                      {expandedPersonaId === persona.id ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
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

                    {/* Objeções */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Objeções <span className="text-green-400 text-xs font-semibold">({selectedObjections.length} selecionadas)</span>
                      </label>
                      {objections.length === 0 ? (
                        <div className="bg-gray-800/50 border border-green-500/20 rounded-xl p-3 text-gray-400 text-sm">
                          Nenhuma objeção cadastrada.
                        </div>
                      ) : (
                        <div
                          className="space-y-2 pr-2 overflow-y-auto"
                          style={{ height: '200px', maxHeight: '200px', overflowY: 'scroll' }}
                        >
                          {objections.map((objection) => (
                            <div
                              key={objection.id}
                              className={`group border rounded-xl px-4 py-2.5 transition-all duration-200 ${
                                selectedObjections.includes(objection.id)
                                  ? 'bg-gradient-to-r from-green-900/40 to-green-800/20 border-green-500 shadow-md shadow-green-500/10'
                                  : 'bg-gray-800/40 border-green-500/20 hover:border-green-500/40 hover:bg-gray-800/60'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  onClick={() => toggleObjection(objection.id)}
                                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 mt-0.5 cursor-pointer ${
                                    selectedObjections.includes(objection.id)
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-green-500/40 group-hover:border-green-500/60'
                                  }`}
                                >
                                  {selectedObjections.includes(objection.id) && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleObjection(objection.id)}>
                                  <span className={`text-sm transition-colors duration-200 ${
                                    expandedObjectionId === objection.id ? '' : 'truncate block'
                                  } ${
                                    selectedObjections.includes(objection.id)
                                      ? 'text-white font-medium'
                                      : 'text-gray-300 group-hover:text-gray-200'
                                  }`}>{objection.name}</span>
                                  {expandedObjectionId === objection.id && objection.rebuttals && objection.rebuttals.length > 0 && (
                                    <div className="mt-2 pl-2 border-l-2 border-green-500/30 space-y-1">
                                      <p className="text-xs text-green-400 font-medium">Rebatidas:</p>
                                      {objection.rebuttals.map((rebuttal, idx) => (
                                        <p key={idx} className="text-xs text-gray-400">• {rebuttal}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setExpandedObjectionId(expandedObjectionId === objection.id ? null : objection.id)
                                  }}
                                  className="text-green-400 hover:text-green-300 transition-colors p-1 flex-shrink-0"
                                >
                                  {expandedObjectionId === objection.id ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 mt-5">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowConfig(false);
                    }}
                    type="button"
                    className="flex-1 px-6 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-base font-semibold hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleStartSimulation}
                    type="button"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl text-base font-semibold hover:scale-105 transition-transform glow-green cursor-pointer"
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

        {/* Modal de Avaliação - Novo Design */}
        {showEvaluationSummary && evaluation && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] overflow-hidden flex items-center justify-center">
            <div className="relative w-full max-w-4xl mx-auto p-4 max-h-[85vh] overflow-y-auto">
              {/* Close Button */}
              <button
                onClick={() => setShowEvaluationSummary(false)}
                className="absolute -top-4 -right-4 z-10 w-10 h-10 bg-gray-800/90 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors border border-green-500/30"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              {/* Header com Tabs */}
              <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-t-3xl border-t border-x border-green-500/30 p-5">
                <h2 className="text-2xl font-bold text-center text-white mb-4">DESEMPENHO DO VENDEDOR</h2>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setActiveEvaluationTab('conversation')}
                    className={`px-5 py-2 text-sm rounded-lg transition-colors ${
                      activeEvaluationTab === 'conversation'
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                    }`}>
                    Conversa
                  </button>
                  <button
                    onClick={() => setActiveEvaluationTab('evaluation')}
                    className={`px-5 py-2 text-sm rounded-lg transition-colors ${
                      activeEvaluationTab === 'evaluation'
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                    }`}>
                    Avaliação
                  </button>
                  <button
                    onClick={() => setActiveEvaluationTab('feedback')}
                    className={`px-5 py-2 text-sm rounded-lg transition-colors ${
                      activeEvaluationTab === 'feedback'
                        ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                    }`}>
                    Feedback
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-b-3xl border-b border-x border-green-500/30 p-5">
                {/* Aba Conversa */}
                {activeEvaluationTab === 'conversation' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white mb-4">Transcrição da Conversa</h3>
                    <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20 max-h-[400px] overflow-y-auto">
                      <div className="space-y-3">
                        {messages.map((msg, index) => (
                          <div key={index} className={`flex ${msg.role === 'seller' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-xl ${
                              msg.role === 'seller'
                                ? 'bg-green-600/20 border border-green-500/30'
                                : 'bg-gray-700/50 border border-gray-600/30'
                            }`}>
                              <div className="text-xs text-gray-400 mb-1">
                                {msg.role === 'seller' ? '👤 Vendedor (você)' : '🤖 Cliente (IA)'}
                              </div>
                              <div className="text-sm text-white">
                                {msg.text}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Aba Avaliação */}
                {activeEvaluationTab === 'evaluation' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* Left Side - SPIN Radar Chart */}
                  <div className="space-y-4">
                    <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20">
                      <h3 className="text-base font-bold text-white mb-4 text-center">Métricas de Competências SPIN</h3>

                      {/* Radar Chart Visual - Diamond Shape */}
                      <div className="relative w-full aspect-square max-w-[220px] mx-auto mb-4">
                        <svg viewBox="0 0 240 240" className="w-full h-full">
                          {/* Background diamonds (losangos) - 10 níveis */}
                          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((level) => {
                            const size = level * 8; // Cada nível representa 8 pixels
                            return (
                              <polygon
                                key={level}
                                points={`120,${120-size} ${120+size},120 120,${120+size} ${120-size},120`}
                                fill="none"
                                stroke={level % 2 === 0 ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.08)"}
                                strokeWidth="1"
                              />
                            );
                          })}

                          {/* Diagonal lines connecting opposite vertices (forming X inside diamond) */}
                          <line x1="120" y1="40" x2="120" y2="200" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="0.5" />
                          <line x1="40" y1="120" x2="200" y2="120" stroke="rgba(139, 92, 246, 0.2)" strokeWidth="0.5" />

                          {/* Data polygon */}
                          {evaluation.spin_evaluation && (() => {
                            const S = evaluation.spin_evaluation.S?.final_score || 0
                            const P = evaluation.spin_evaluation.P?.final_score || 0
                            const I = evaluation.spin_evaluation.I?.final_score || 0
                            const N = evaluation.spin_evaluation.N?.final_score || 0

                            // Calculate positions for diamond (4 vertices)
                            const sY = 120 - (S * 8)  // Top (S)
                            const pX = 120 + (P * 8)  // Right (P)
                            const iY = 120 + (I * 8)  // Bottom (I)
                            const nX = 120 - (N * 8)  // Left (N)

                            return (
                              <>
                                <polygon
                                  points={`120,${sY} ${pX},120 120,${iY} ${nX},120`}
                                  fill="rgba(168, 85, 247, 0.3)"
                                  stroke="rgb(168, 85, 247)"
                                  strokeWidth="2"
                                />
                                {/* Data points */}
                                <circle cx="120" cy={sY} r="5" fill="rgb(168, 85, 247)" />
                                <circle cx={pX} cy="120" r="5" fill="rgb(168, 85, 247)" />
                                <circle cx="120" cy={iY} r="5" fill="rgb(168, 85, 247)" />
                                <circle cx={nX} cy="120" r="5" fill="rgb(168, 85, 247)" />
                              </>
                            )
                          })()}

                          {/* Labels */}
                          <text x="120" y="32" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">S</text>
                          <text x="208" y="125" textAnchor="start" fill="white" fontSize="14" fontWeight="bold">P</text>
                          <text x="120" y="215" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">I</text>
                          <text x="32" y="125" textAnchor="end" fill="white" fontSize="14" fontWeight="bold">N</text>
                        </svg>
                      </div>

                      {/* SPIN Scores */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {evaluation.spin_evaluation && (
                          <>
                            <div className="text-center">
                              <div className="text-xs text-gray-400 mb-1">S</div>
                              <div className="text-base font-bold text-white">{evaluation.spin_evaluation.S?.final_score?.toFixed(1) || '0'}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-400 mb-1">P</div>
                              <div className="text-base font-bold text-white">{evaluation.spin_evaluation.P?.final_score?.toFixed(1) || '0'}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-400 mb-1">I</div>
                              <div className="text-base font-bold text-white">{evaluation.spin_evaluation.I?.final_score?.toFixed(1) || '0'}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-gray-400 mb-1">N</div>
                              <div className="text-base font-bold text-white">{evaluation.spin_evaluation.N?.final_score?.toFixed(1) || '0'}</div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Detalhamento SPIN */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center bg-gray-900/50 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-gray-300">Situação</span>
                          <span className="text-xs font-semibold text-white">{evaluation.spin_evaluation?.S?.final_score || 0}/10</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-900/50 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-gray-300">Problema</span>
                          <span className="text-xs font-semibold text-white">{evaluation.spin_evaluation?.P?.final_score || 0}/10</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-900/50 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-gray-300">Implicação</span>
                          <span className="text-xs font-semibold text-white">{evaluation.spin_evaluation?.I?.final_score || 0}/10</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-900/50 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-gray-300">Necessidade</span>
                          <span className="text-xs font-semibold text-white">{evaluation.spin_evaluation?.N?.final_score || 0}/10</span>
                        </div>
                      </div>

                      {/* Média Geral */}
                      <div className="mt-4 bg-gradient-to-r from-green-600 to-green-500 rounded-xl px-4 py-2.5 text-center">
                        <div className="text-xs text-purple-100 mb-1">Média Geral</div>
                        <div className="text-xl font-bold text-white">
                          {evaluation.spin_evaluation ? (
                            ((evaluation.spin_evaluation.S?.final_score || 0) +
                             (evaluation.spin_evaluation.P?.final_score || 0) +
                             (evaluation.spin_evaluation.I?.final_score || 0) +
                             (evaluation.spin_evaluation.N?.final_score || 0)) / 4
                          ).toFixed(1) : '0'}/10
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Performance Metrics */}
                  <div className="space-y-4">
                    {/* Overall Score */}
                    <div className="bg-gradient-to-br from-green-600/20 to-green-400/10 border border-green-500/30 rounded-xl p-4">
                      <h3 className="text-center text-sm text-gray-400 mb-2">Performance Geral</h3>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">
                          {evaluation.performance_level === 'legendary' && 'Lendário'}
                          {evaluation.performance_level === 'excellent' && 'Excelente'}
                          {evaluation.performance_level === 'very_good' && 'Muito Bom'}
                          {evaluation.performance_level === 'good' && 'Bom'}
                          {evaluation.performance_level === 'needs_improvement' && 'Precisa Melhorar'}
                          {evaluation.performance_level === 'poor' && 'Insuficiente'}
                          {!evaluation.performance_level && 'N/A'}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
                )}

                {/* Aba Feedback */}
                {activeEvaluationTab === 'feedback' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white mb-4">Feedback Detalhado</h3>

                    {/* Pontos Fortes */}
                    {evaluation?.top_strengths && evaluation.top_strengths.length > 0 && (
                      <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-xl p-4 border border-green-500/30">
                        <h4 className="text-base font-bold text-green-400 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          Seus Pontos Fortes
                        </h4>
                        <ul className="space-y-2">
                          {evaluation.top_strengths.map((strength: string, index: number) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-green-400 mt-1">•</span>
                              <span className="text-sm text-gray-200">{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Gaps Críticos */}
                    {evaluation?.critical_gaps && evaluation.critical_gaps.length > 0 && (
                      <div className="bg-gradient-to-br from-red-900/20 to-red-800/10 rounded-xl p-4 border border-red-500/30">
                        <h4 className="text-base font-bold text-red-400 mb-3 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5" />
                          Áreas para Desenvolvimento
                        </h4>
                        <ul className="space-y-2">
                          {evaluation.critical_gaps.map((gap: string, index: number) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-red-400 mt-1">•</span>
                              <span className="text-sm text-gray-200">{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Melhorias Prioritárias */}
                    {evaluation?.priority_improvements && evaluation.priority_improvements.length > 0 && (
                      <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 rounded-xl p-4 border border-purple-500/30">
                        <h4 className="text-base font-bold text-purple-400 mb-3 flex items-center gap-2">
                          <Zap className="w-5 h-5" />
                          Melhorias Prioritárias
                        </h4>
                        <div className="space-y-3">
                          {evaluation.priority_improvements.map((improvement: any, index: number) => (
                            <div key={index} className="bg-gray-800/40 rounded-lg p-3">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-semibold text-purple-300">{improvement.area}</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  improvement.priority === 'high'
                                    ? 'bg-red-500/20 text-red-300'
                                    : improvement.priority === 'medium'
                                    ? 'bg-yellow-500/20 text-yellow-300'
                                    : 'bg-green-500/20 text-green-300'
                                }`}>
                                  {improvement.priority === 'high' ? 'Alta' : improvement.priority === 'medium' ? 'Média' : 'Baixa'} Prioridade
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mb-2">Gap: {improvement.current_gap}</p>
                              <p className="text-sm text-gray-200">{improvement.action_plan}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resumo Executivo */}
                    {evaluation?.executive_summary && (
                      <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20">
                        <h4 className="text-base font-bold text-white mb-3">Resumo Executivo</h4>
                        <p className="text-sm text-gray-200 leading-relaxed">{evaluation.executive_summary}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => setShowEvaluationSummary(false)}
                    className="flex-1 px-6 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl font-medium hover:bg-gray-700/50 transition-colors text-white"
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
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-medium hover:scale-105 transition-transform text-white shadow-lg shadow-green-500/30"
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
