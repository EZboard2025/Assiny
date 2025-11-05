'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Play, Clock, MessageCircle, Send, Calendar, User, Zap, Mic, MicOff, Volume2, UserCircle2, CheckCircle, Loader2, X, AlertCircle } from 'lucide-react'
import { getPersonas, getObjections, getCompanyType, type Persona, type PersonaB2B, type PersonaB2C, type Objection } from '@/lib/config'
import { createRoleplaySession, addMessageToSession, endRoleplaySession, getRoleplaySession, type RoleplayMessage } from '@/lib/roleplay'

interface RoleplayViewProps {
  onNavigateToHistory?: () => void
}

export default function RoleplayView({ onNavigateToHistory }: RoleplayViewProps = {}) {
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
  const [finalizingCountdown, setFinalizingCountdown] = useState(5) // Countdown de 5 segundos
  const finalizingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [])

  const loadData = async () => {
    const [businessTypeData, personasData, objectionsData] = await Promise.all([
      getCompanyType(),
      getPersonas(),
      getObjections(),
    ])
    setBusinessType(businessTypeData)
    setPersonas(personasData)
    setObjections(objectionsData)

    // Filtrar personas pelo tipo de empresa e selecionar a primeira
    const filteredPersonas = personasData.filter(p => p.business_type === businessTypeData)
    if (filteredPersonas.length > 0) {
      setSelectedPersona(filteredPersonas[0].id!)
    }
  }

  const temperaments = ['Analítico', 'Empático', 'Determinado', 'Indeciso', 'Sociável']

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

      // Salvar contexto e primeira mensagem do cliente na roleplay_chat_memory
      const { saveRoleplayChatMessage } = await import('@/lib/roleplayChatMemory')

      // Salvar contexto inicial (mensagem do sistema)
      await saveRoleplayChatMessage(
        data.sessionId,
        contextMessage,
        'human',
        userId,
        companyId,
        {
          age,
          temperament,
          persona: personaData,
          objections: objectionsWithRebuttals,
        }
      )

      // Salvar resposta do cliente
      await saveRoleplayChatMessage(
        data.sessionId,
        data.message,
        'ai',
        userId,
        companyId
      )

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

    // Limpar interval de finalização se existir
    if (finalizingIntervalRef.current) {
      clearInterval(finalizingIntervalRef.current)
      finalizingIntervalRef.current = null
    }

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
    setIsProcessingTranscription(false);
    setCurrentTranscription('');
    setLastUserMessage('');
    setShowFinalizingMessage(false);
    setFinalizingCountdown(5);

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

  const cancelFinalization = () => {
    // Cancelar o countdown
    if (finalizingIntervalRef.current) {
      clearInterval(finalizingIntervalRef.current)
      finalizingIntervalRef.current = null
    }
    setShowFinalizingMessage(false)
    setFinalizingCountdown(5)
  }

  const handleSendMessage = async (messageToSend?: string) => {
    console.log('🔍 handleSendMessage chamada com:', messageToSend)
    console.log('🔍 inputMessage atual:', inputMessage)
    console.log('🔍 isLoading:', isLoading)
    console.log('🔍 sessionIdN8N:', sessionIdN8N)
    console.log('🔍 isSimulating:', isSimulating)

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
      // Enviar para API (N8N)
      const response = await fetch('/api/roleplay/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionIdN8N,
          message: userMessage,
          userId: userId,
          companyId: companyId,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao enviar mensagem')
      }

      const data = await response.json()
      console.log('✅ Resposta do cliente recebida:', data.message)

      // Adicionar resposta do cliente
      setMessages(prev => [...prev, { role: 'client', text: data.message }])

      // Verificar se a mensagem contém a frase de finalização
      if (data.message.includes('Roleplay finalizado, aperte em finalizar sessão')) {
        console.log('🎯 Detectada mensagem de finalização do roleplay!')

        // Iniciar countdown de finalização
        setShowFinalizingMessage(true)
        setFinalizingCountdown(5)

        // Criar interval para countdown
        const interval = setInterval(() => {
          setFinalizingCountdown(prev => {
            if (prev <= 1) {
              clearInterval(interval)
              // Finalizar automaticamente
              console.log('⏰ Finalizando automaticamente...')
              handleEndSession()
              return 0
            }
            return prev - 1
          })
        }, 1000)

        finalizingIntervalRef.current = interval
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

      // Salvar mensagem do vendedor e resposta do cliente na roleplay_chat_memory
      const { saveRoleplayChatMessage } = await import('@/lib/roleplayChatMemory')

      // Salvar mensagem do vendedor (human)
      await saveRoleplayChatMessage(
        sessionIdN8N!,
        userMessage,
        'human',
        userId!,
        companyId!
      )

      // Salvar resposta do cliente (ai)
      await saveRoleplayChatMessage(
        sessionIdN8N!,
        data.message,
        'ai',
        userId!,
        companyId!
      )

      // Converter resposta em áudio e tocar
      await textToSpeech(data.message)
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

      const mediaRecorder = new MediaRecorder(stream)
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

      // Mostrar a transcrição na tela com destaque
      if (data.text) {
        setCurrentTranscription(`✅ Entendi: "${data.text}"`)
        setLastUserMessage(data.text)

        // Aguardar um momento para o usuário ver antes de enviar
        await new Promise(resolve => setTimeout(resolve, 800))
      }

      // Enviar automaticamente após transcrever se houver texto
      if (data.text && data.text.trim()) {
        console.log('📤 Enviando mensagem transcrita...')
        setCurrentTranscription('📤 Enviando sua mensagem...')

        // Chamar handleSendMessage diretamente com o texto
        await handleSendMessage(data.text.trim())

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
  const textToSpeech = async (text: string) => {
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

      // Quando o áudio terminar, limpar visualizador
      audio.onended = () => {
        setIsPlayingAudio(false)
        setAudioVolume(0)
        URL.revokeObjectURL(audioUrl)

        // Limpar animação
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

        console.log('🔊 Áudio do cliente finalizado - aguardando usuário clicar no microfone')
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
                {!isSimulating ? (
                  <button
                    onClick={() => setShowConfig(true)}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 rounded-2xl font-semibold text-lg flex items-center gap-3 hover:scale-105 transition-transform glow-green"
                  >
                    <Play className="w-5 h-5" />
                    Iniciar Simulação
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      console.log('🛑 Encerrando simulação...')

                      // Parar gravação imediatamente se estiver ativa
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

                      // Limpar timer de silêncio
                      if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                      }

                      // Parar áudio se estiver tocando
                      if (audioRef.current) {
                        try {
                          audioRef.current.pause();
                          audioRef.current = null;
                        } catch (e) {
                          console.log('Erro ao parar áudio:', e);
                        }
                      }

                      // Fechar todos os streams de mídia
                      if (streamRef.current) {
                        streamRef.current.getTracks().forEach(track => {
                          try {
                            track.stop();
                          } catch (e) {
                            console.log('Erro ao parar track:', e);
                          }
                        });
                        streamRef.current = null;
                      }

                      // Finalizar sessão no Supabase
                      console.log('🔍 Verificando sessionId:', sessionId);
                      if (sessionId) {
                        console.log('✅ SessionId encontrado:', sessionId);
                        console.log('📝 Finalizando sessão no Supabase...');
                        await endRoleplaySession(sessionId, 'completed');
                        console.log('✅ Sessão finalizada no Supabase');

                        // Iniciar avaliação
                        console.log('🎯 Iniciando processo de avaliação...');
                        setIsEvaluating(true);

                        try {
                          console.log('📊 Solicitando avaliação da sessão:', sessionId);

                          const evalResponse = await fetch('/api/roleplay/evaluate', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ sessionId })
                          });

                          console.log('📨 Resposta da API:', evalResponse.status, evalResponse.statusText);

                          if (evalResponse.ok) {
                            const result = await evalResponse.json();
                            console.log('✅ Resposta completa da API:', JSON.stringify(result, null, 2));
                            let { evaluation } = result;

                            // Se evaluation ainda tem estrutura N8N {output: "..."}, fazer parse
                            if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
                              console.log('🔄 Detectado evaluation com output, fazendo parse...');
                              evaluation = JSON.parse(evaluation.output);
                            }

                            console.log('✅ Avaliação extraída:', JSON.stringify(evaluation, null, 2));
                            console.log('🔍 overall_score:', evaluation?.overall_score);
                            console.log('🔍 performance_level:', evaluation?.performance_level);
                            console.log('🔍 executive_summary:', evaluation?.executive_summary?.substring(0, 100));
                            setEvaluation(evaluation);
                            setShowEvaluationSummary(true);

                            // Atualizar resumo de performance após avaliação bem-sucedida
                            console.log('📊 Atualizando resumo de performance...');
                            try {
                              const { supabase } = await import('@/lib/supabase')
                              const { data: { user } } = await supabase.auth.getUser()

                              if (user) {
                                const updateResponse = await fetch('/api/performance-summary/update', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userId: user.id })
                                });

                                if (updateResponse.ok) {
                                  console.log('✅ Resumo de performance atualizado');
                                } else {
                                  console.warn('⚠️ Falha ao atualizar resumo de performance');
                                }
                              }
                            } catch (perfError) {
                              console.error('❌ Erro ao atualizar resumo de performance:', perfError);
                              // Não bloqueia o fluxo principal
                            }
                          } else {
                            const errorText = await evalResponse.text();
                            console.error('❌ Erro ao avaliar sessão - Status:', evalResponse.status);
                            console.error('❌ Erro detalhado:', errorText);
                            alert('Não foi possível gerar a avaliação. A sessão foi salva no histórico.');
                          }
                        } catch (error) {
                          console.error('❌ Erro na avaliação:', error);
                          alert('Erro ao processar avaliação. A sessão foi salva no histórico.');
                        } finally {
                          setIsEvaluating(false);
                        }
                      } else {
                        console.warn('⚠️ Nenhum sessionId encontrado - avaliação não será executada');
                      }

                      // Resetar TODOS os estados
                      setIsRecording(false);
                      setIsSimulating(false);
                      setMessages([]);
                      setSessionIdN8N(null);
                      setIsPlayingAudio(false);
                      setIsLoading(false);
                      setCurrentTranscription('');
                      setIsProcessingTranscription(false);
                      setLastUserMessage('');
                      setSessionId(null);

                      console.log('✅ Simulação encerrada');
                    }}
                    className="px-6 py-3 bg-red-600/20 border border-red-500/30 rounded-xl hover:bg-red-600/30 transition-colors"
                  >
                    Encerrar Simulação
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
                            A simulação será encerrada automaticamente em
                          </p>
                          <div className="text-2xl font-bold text-yellow-400 animate-pulse">
                            {finalizingCountdown}
                          </div>
                          <button
                            onClick={() => {
                              // Cancelar finalização automática
                              if (finalizingIntervalRef.current) {
                                clearInterval(finalizingIntervalRef.current)
                                finalizingIntervalRef.current = null
                              }
                              setShowFinalizingMessage(false)
                              setFinalizingCountdown(5)
                            }}
                            className="mt-2 px-4 py-1 bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 text-xs rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
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
                            className="p-4 bg-green-600/20 border border-green-500/30 rounded-full hover:bg-green-600/30 transition-all"
                            title="Clique para começar a falar"
                          >
                            <Mic className="w-6 h-6 text-green-400" />
                          </button>
                        )}

                        {isRecording && (
                          <button
                            onClick={stopRecording}
                            className="px-6 py-3 bg-red-600/20 border border-red-500/30 rounded-xl hover:bg-red-600/30 transition-all flex items-center gap-2"
                            title="Clique para finalizar e enviar"
                          >
                            <MicOff className="w-5 h-5 text-red-400" />
                            <span className="text-sm font-medium text-red-400">Finalizar Fala</span>
                          </button>
                        )}

                        {/* Botão Finalizar Sessão - sempre visível ao lado do microfone */}
                        {sessionId && !isEvaluating && (
                          <button
                            onClick={handleEndSession}
                            className="px-4 py-2 bg-red-600/20 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-all flex items-center gap-2 text-sm"
                            title="Encerrar e avaliar sessão"
                          >
                            <X className="w-4 h-4 text-red-400" />
                            <span className="text-red-400 font-medium">Finalizar Sessão</span>
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
            <div className="relative max-w-2xl w-full">
              <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-transparent rounded-3xl blur-xl"></div>
              <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-3xl p-6 border border-green-500/30 max-h-[80vh] overflow-y-auto">
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

                <div className="space-y-4">
                  {/* Idade do Cliente */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
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
                    <div className="mt-4 bg-gradient-to-br from-blue-900/20 to-green-900/20 border border-blue-500/30 rounded-xl p-4">
                      {age >= 18 && age <= 24 && (
                        <div>
                          <p className="text-sm font-semibold text-blue-400 mb-2">18 a 24 anos</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Tom:</span> Informal e moderno</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Vocabulário:</span> "Mano", "Tipo assim", "Na moral", "Vi isso no Instagram"</p>
                          <p className="text-xs text-gray-300"><span className="font-semibold">Comportamento:</span> Aceita novidades facilmente • Teme risco operacional • Referências digitais e trends</p>
                        </div>
                      )}
                      {age >= 25 && age <= 34 && (
                        <div>
                          <p className="text-sm font-semibold text-green-400 mb-2">25 a 34 anos</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Tom:</span> Pragmático e orientado a resultados</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Vocabulário:</span> "Preciso ver o retorno disso", "Quanto isso impacta no CPA?"</p>
                          <p className="text-xs text-gray-300"><span className="font-semibold">Comportamento:</span> Foco em ROI e métricas • Aceita risco calculado • Profissional mas não engessado</p>
                        </div>
                      )}
                      {age >= 35 && age <= 44 && (
                        <div>
                          <p className="text-sm font-semibold text-yellow-400 mb-2">35 a 44 anos</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Tom:</span> Equilibrado entre desempenho e estabilidade</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Vocabulário:</span> "Preciso garantir que isso não quebra nada", "Como fica a parte de compliance?"</p>
                          <p className="text-xs text-gray-300"><span className="font-semibold">Comportamento:</span> Valoriza compliance e previsibilidade • Cauteloso com promessas • Exige validação prática</p>
                        </div>
                      )}
                      {age >= 45 && age <= 60 && (
                        <div>
                          <p className="text-sm font-semibold text-orange-400 mb-2">45 a 60 anos</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Tom:</span> Conservador e formal</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Vocabulário:</span> "Não posso me dar ao luxo de instabilidade", "Quem garante que isso funciona?"</p>
                          <p className="text-xs text-gray-300"><span className="font-semibold">Comportamento:</span> Foco em segurança e governança • Avesso a riscos • Exige suporte dedicado e validação ampla</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Temperamento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Temperamento
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {temperaments.map((temp) => (
                        <button
                          key={temp}
                          onClick={() => setTemperament(temp)}
                          className={`px-4 py-3 rounded-xl font-medium transition-all ${
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
                    <div className="mt-4 bg-gradient-to-br from-green-900/20 to-pink-900/20 border border-green-500/30 rounded-xl p-4">
                      {temperament === 'Analítico' && (
                        <div>
                          <p className="text-sm font-semibold text-green-400 mb-2">Analítico</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Comportamento:</span> Tom formal e lógico • Faz perguntas técnicas • Desconfia de argumentos subjetivos • Cobra detalhes quando vendedor é vago</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Estilo:</span> Formal, racional, calmo e preciso</p>
                          <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Dados concretos, estatísticas, provas de eficácia, garantias</p>
                        </div>
                      )}
                      {temperament === 'Empático' && (
                        <div>
                          <p className="text-sm font-semibold text-pink-400 mb-2">Empático</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Comportamento:</span> Demonstra empatia genuína • Compartilha experiências pessoais • Pergunta sobre impacto humano • Usa expressões emocionais • Reage positivamente a atenção</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Estilo:</span> Afável, próximo, gentil e emocional</p>
                          <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Histórias reais, propósito, apoio humano, relacionamento</p>
                        </div>
                      )}
                      {temperament === 'Determinado' && (
                        <div>
                          <p className="text-sm font-semibold text-red-400 mb-2">Determinado</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Comportamento:</span> Postura firme e objetiva • Corta rodeios • Perguntas estratégicas • Demonstra impaciência se vendedor demora • Mostra pressa e decisão rápida</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Estilo:</span> Objetivo, seguro, impaciente e assertivo</p>
                          <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Soluções rápidas, eficiência, autoridade, resultado imediato</p>
                        </div>
                      )}
                      {temperament === 'Indeciso' && (
                        <div>
                          <p className="text-sm font-semibold text-yellow-400 mb-2">Indeciso</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Comportamento:</span> Demonstra insegurança e dúvida • Faz perguntas repetidas • Expressa medo ("não sei se é o momento certo") • Busca garantias constantemente • Muda de opinião facilmente</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Estilo:</span> Hesitante, cauteloso e questionador</p>
                          <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Depoimentos, garantias, segurança, prova social</p>
                        </div>
                      )}
                      {temperament === 'Sociável' && (
                        <div>
                          <p className="text-sm font-semibold text-cyan-400 mb-2">Sociável</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Comportamento:</span> Animado e espontâneo • Usa humor leve e linguagem descontraída • Faz comentários fora do tema • Mostra tédio se vendedor for frio ou formal</p>
                          <p className="text-xs text-gray-300 mb-2"><span className="font-semibold">Estilo:</span> Leve, animado, entusiasmado e informal</p>
                          <p className="text-xs text-gray-300"><span className="font-semibold">Gatilhos:</span> Amizade, humor, interesse genuíno, energia positiva</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Persona */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Persona
                    </label>
                    {personas.filter(p => p.business_type === businessType).length === 0 ? (
                      <div className="bg-gray-800/50 border border-green-500/20 rounded-xl p-4 text-gray-400 text-sm">
                        Nenhuma persona {businessType} cadastrada. Configure no Hub de Configuração.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {personas
                          .filter(p => p.business_type === businessType)
                          .map((persona) => (
                            <div
                              key={persona.id}
                              onClick={() => setSelectedPersona(persona.id!)}
                              className={`cursor-pointer bg-gradient-to-br from-gray-900/80 to-gray-900/40 border rounded-xl p-4 transition-all ${
                                selectedPersona === persona.id
                                  ? 'border-green-500 shadow-lg shadow-green-500/20'
                                  : 'border-green-500/30 hover:border-green-500/50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center flex-shrink-0">
                                  <UserCircle2 className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1 space-y-2">
                                  <h4 className="font-bold text-white">
                                    {persona.business_type === 'B2B'
                                      ? (persona as PersonaB2B).job_title
                                      : (persona as PersonaB2C).profession}
                                  </h4>

                                  {persona.business_type === 'B2B' && (
                                    <>
                                      {(persona as PersonaB2B).company_type && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-green-400">Tipo de Empresa:</span>{' '}
                                          {(persona as PersonaB2B).company_type}
                                        </p>
                                      )}
                                      {(persona as PersonaB2B).company_goals && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-green-400">Busca:</span>{' '}
                                          {(persona as PersonaB2B).company_goals}
                                        </p>
                                      )}
                                      {(persona as PersonaB2B).business_challenges && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-green-400">Desafios:</span>{' '}
                                          {(persona as PersonaB2B).business_challenges}
                                        </p>
                                      )}
                                      {(persona as PersonaB2B).prior_knowledge && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-green-400">Conhecimento prévio:</span>{' '}
                                          {(persona as PersonaB2B).prior_knowledge}
                                        </p>
                                      )}
                                    </>
                                  )}

                                  {persona.business_type === 'B2C' && (
                                    <>
                                      {(persona as PersonaB2C).what_seeks && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-green-400">Busca:</span>{' '}
                                          {(persona as PersonaB2C).what_seeks}
                                        </p>
                                      )}
                                      {(persona as PersonaB2C).main_pains && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-green-400">Dores:</span>{' '}
                                          {(persona as PersonaB2C).main_pains}
                                        </p>
                                      )}
                                      {(persona as PersonaB2C).prior_knowledge && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-green-400">Conhecimento prévio:</span>{' '}
                                          {(persona as PersonaB2C).prior_knowledge}
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>

                                {selectedPersona === persona.id && (
                                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="w-4 h-4 text-white" />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Objeções */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Objeções (selecione as que deseja praticar)
                    </label>
                    {objections.length === 0 ? (
                      <div className="bg-gray-800/50 border border-green-500/20 rounded-xl p-4 text-gray-400 text-sm">
                        Nenhuma objeção cadastrada. Configure no Hub de Configuração.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {objections.map((objection) => (
                          <label
                            key={objection.id}
                            className="flex items-center gap-3 bg-gray-800/50 border border-green-500/20 rounded-xl px-4 py-3 cursor-pointer hover:border-green-500/40 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedObjections.includes(objection.id)}
                              onChange={() => toggleObjection(objection.id)}
                              className="w-5 h-5 rounded border-green-500/30 text-green-600 focus:ring-green-500 focus:ring-offset-0"
                            />
                            <span className="text-gray-300">{objection.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowConfig(false);
                    }}
                    type="button"
                    className="flex-1 px-6 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl font-semibold hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleStartSimulation}
                    type="button"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-semibold hover:scale-105 transition-transform glow-green cursor-pointer"
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
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="relative w-full max-w-5xl my-8">
              {/* Close Button */}
              <button
                onClick={() => setShowEvaluationSummary(false)}
                className="absolute -top-4 -right-4 z-10 w-10 h-10 bg-gray-800/90 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors border border-green-500/30"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              {/* Header com Tabs */}
              <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-t-3xl border-t border-x border-green-500/30 p-6">
                <h2 className="text-3xl font-bold text-center text-white mb-6">DESEMPENHO DO VENDEDOR</h2>
                <div className="flex justify-center gap-2">
                  <button className="px-6 py-2 bg-gray-800/50 text-gray-400 rounded-lg hover:bg-gray-700/50 transition-colors">
                    Conversa
                  </button>
                  <button className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-lg shadow-green-500/30">
                    Avaliação
                  </button>
                  <button className="px-6 py-2 bg-gray-800/50 text-gray-400 rounded-lg hover:bg-gray-700/50 transition-colors">
                    Feedback
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-b-3xl border-b border-x border-green-500/30 p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Left Side - SPIN Radar Chart */}
                  <div className="space-y-4">
                    <div className="bg-gray-800/40 rounded-2xl p-5 border border-green-500/20">
                      <h3 className="text-lg font-bold text-white mb-4 text-center">Métricas de Competências SPIN</h3>

                      {/* Radar Chart Visual - Diamond Shape */}
                      <div className="relative w-full aspect-square max-w-xs mx-auto mb-4">
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
                    <div className="bg-gradient-to-br from-green-600/20 to-green-400/10 border border-green-500/30 rounded-2xl p-5">
                      <h3 className="text-center text-xs text-gray-400 mb-2">Performance Geral</h3>
                      <div className="text-center">
                        <div className="text-4xl font-bold text-white">
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

                {/* Action Buttons */}
                <div className="flex gap-4 mt-8">
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
  )
}
