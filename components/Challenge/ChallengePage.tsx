'use client'

import { useState, useRef, useEffect } from 'react'
import { User, Mail, Loader2, Sparkles, PenTool, Mic, MicOff, Phone, Volume2, Trophy, Target, TrendingUp, AlertCircle, CheckCircle, XCircle, Lightbulb } from 'lucide-react'
import Image from 'next/image'

interface Message {
  role: 'client' | 'seller'
  text: string
  timestamp: Date
}

type Step = 'form' | 'roleplay' | 'evaluating' | 'completed'

interface SpinCategory {
  final_score: number
  technical_feedback?: string
  evidence_from_transcript?: string
  missed_opportunities?: string[]
  indicators?: Record<string, number>
}

interface Evaluation {
  // Novo formato SPIN
  spin_evaluation?: {
    S?: SpinCategory
    P?: SpinCategory
    I?: SpinCategory
    N?: SpinCategory
  }
  sale_completed?: boolean
  overall_score?: number
  performance_level?: string
  executive_summary?: string
  top_strengths?: string[]
  critical_gaps?: string[]
  key_lesson?: string
  // Formato antigo (fallback)
  score?: number
  feedback?: string
  strengths?: string[]
  improvements?: string[]
  verdict?: string
  [key: string]: any
}

export default function ChallengePage() {
  // Estados do formulário
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState('')
  const [submittingForm, setSubmittingForm] = useState(false)

  // Estados do roleplay
  const [step, setStep] = useState<Step>('form')
  const [sessionId, setSessionId] = useState('')
  const [leadId, setLeadId] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null) // OpenAI Assistants thread
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)

  // Estados de áudio
  const [isRecording, setIsRecording] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [currentTranscription, setCurrentTranscription] = useState('')
  const [audioVolume, setAudioVolume] = useState(0)

  // Função para normalizar score (N8N pode retornar 0-10 ou 0-100)
  const normalizeScore = (score: number | null | undefined): number => {
    if (score === null || score === undefined) return 0
    // Se score > 10, está na escala 0-100, dividir por 10
    // Se score <= 10, já está na escala 0-10
    return score > 10 ? score / 10 : score
  }

  // Destravar áudio no iOS - deve ser chamado em resposta a interação do usuário
  const unlockAudioForIOS = () => {
    // Criar elemento de áudio se não existir
    if (!audioRef.current) {
      const audio = new Audio()
      audioRef.current = audio

      // Configurar atributos para iOS
      ;(audio as any).playsInline = true
      audio.setAttribute('playsinline', 'true')
      audio.setAttribute('webkit-playsinline', 'true')
    }

    // Criar AudioContext se não existir
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    // Resumir AudioContext se suspenso (iOS suspende por padrão)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }

    // Tocar um som silencioso para destravar o áudio no iOS
    const audio = audioRef.current
    audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAwAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dX/////////////////////////////////'
    audio.volume = 0.01
    audio.play().then(() => {
      console.log('🔓 Áudio destravado para iOS')
      audio.pause()
      audio.currentTime = 0
      audio.volume = 1
    }).catch((e) => {
      console.log('⚠️ Não foi possível destravar áudio:', e.message)
    })
  }

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioAnalyserRef = useRef<AnalyserNode | null>(null)
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<Message[]>([])

  // Manter ref sincronizada com state (evita closure stale)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Auto-scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Submeter formulário e iniciar desafio
  const handleStartChallenge = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!name.trim()) {
      setFormError('Digite seu nome')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setFormError('Digite um email válido')
      return
    }

    // IMPORTANTE: Destravar áudio no iOS durante a interação do usuário
    unlockAudioForIOS()

    setSubmittingForm(true)

    try {
      const newSessionId = `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      const response = await fetch('/api/challenge/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          sessionId: newSessionId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar desafio')
      }

      setSessionId(newSessionId)
      setLeadId(data.leadId)
      setStep('roleplay')

      // Buscar primeira mensagem do agente N8N
      await getInitialMessage(newSessionId, data.leadId)

    } catch (error: any) {
      console.error('Erro ao iniciar desafio:', error)
      setFormError(error.message || 'Erro ao iniciar. Tente novamente.')
    } finally {
      setSubmittingForm(false)
    }
  }

  // Iniciar gravação
  const startRecording = async () => {
    try {
      console.log('🎤 Iniciando gravação...')
      setCurrentTranscription('')

      // Destravar áudio novamente (interação do usuário)
      unlockAudioForIOS()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Detectar formato suportado (Safari/iOS não suporta webm)
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg',
        ''  // fallback para default do browser
      ]

      let selectedMimeType = ''
      for (const mimeType of mimeTypes) {
        if (mimeType === '' || MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }

      console.log('🎙️ Formato de áudio selecionado:', selectedMimeType || 'default')

      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 32000
      }

      if (selectedMimeType) {
        options.mimeType = selectedMimeType
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
        console.log('🛑 Gravação parada')
        setIsRecording(false)

        if (audioChunksRef.current.length === 0) {
          console.log('⚠️ Nenhum chunk de áudio capturado!')
          return
        }

        // Usar o mimeType real do MediaRecorder
        const actualMimeType = mediaRecorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType })
        console.log('📦 Blob de áudio criado, tipo:', actualMimeType, 'tamanho:', audioBlob.size, 'bytes')

        stream.getTracks().forEach(track => track.stop())
        mediaRecorderRef.current = null
        streamRef.current = null

        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)

    } catch (error) {
      console.error('Erro ao acessar microfone:', error)
      alert('Erro ao acessar o microfone. Verifique as permissões.')
    }
  }

  // Parar gravação
  const stopRecording = () => {
    console.log('🛑 Parando gravação...')

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  // Transcrever áudio
  const transcribeAudio = async (audioBlob: Blob) => {
    console.log('📝 Transcrevendo áudio...')
    setCurrentTranscription('⏳ Processando sua fala...')
    setIsLoading(true)

    try {
      // Determinar extensão baseado no mimeType
      const mimeType = audioBlob.type
      let extension = 'webm'
      if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        extension = 'mp4'
      } else if (mimeType.includes('ogg')) {
        extension = 'ogg'
      } else if (mimeType.includes('aac')) {
        extension = 'aac'
      } else if (mimeType.includes('wav')) {
        extension = 'wav'
      }

      const formData = new FormData()
      formData.append('audio', audioBlob, `recording.${extension}`)

      const response = await fetch('/api/roleplay/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao transcrever áudio')
      }

      console.log('✅ Texto transcrito:', data.text)

      if (data.text && data.text.trim()) {
        setCurrentTranscription(`✅ "${data.text}"`)

        // Adicionar mensagem do vendedor
        const sellerMessage: Message = {
          role: 'seller',
          text: data.text.trim(),
          timestamp: new Date()
        }
        setMessages(prev => [...prev, sellerMessage])

        // Enviar para o N8N
        await sendMessage(data.text.trim())
      } else {
        setCurrentTranscription('❌ Não consegui entender, tente novamente')
        setTimeout(() => setCurrentTranscription(''), 2000)
      }

    } catch (error) {
      console.error('Erro ao transcrever:', error)
      setCurrentTranscription('❌ Erro ao processar áudio')
      setTimeout(() => setCurrentTranscription(''), 2000)
    } finally {
      setIsLoading(false)
    }
  }

  // Buscar mensagem inicial do agente (OpenAI Assistants)
  const getInitialMessage = async (sessId: string, leadIdParam: string) => {
    setIsLoading(true)

    try {
      // Enviar mensagem para iniciar a simulação usando OpenAI Assistants
      const response = await fetch('/api/challenge/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'inicie a simulação',
          sessionId: sessId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar conversa')
      }

      // Salvar threadId para mensagens futuras
      if (data.threadId) {
        setThreadId(data.threadId)
        console.log('🧵 Thread ID salvo:', data.threadId)
      }

      // Adicionar mensagem inicial do cliente
      const clientMessage: Message = {
        role: 'client',
        text: data.response,
        timestamp: new Date()
      }
      setMessages([clientMessage])

      // Tocar TTS da mensagem inicial
      await textToSpeech(data.response)

    } catch (error: any) {
      console.error('Erro ao buscar mensagem inicial:', error)
      // Fallback para mensagem padrão se der erro
      const fallbackMessage = 'Olá! Estou ocupado, mas me disseram que você quer me vender algo. O que você tem?'
      setMessages([{
        role: 'client',
        text: fallbackMessage,
        timestamp: new Date()
      }])
      await textToSpeech(fallbackMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Enviar mensagem para OpenAI Assistants
  const sendMessage = async (message: string) => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/challenge/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId,
          threadId // Reutilizar thread existente
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem')
      }

      // Atualizar threadId caso tenha mudado (não deveria, mas por segurança)
      if (data.threadId && data.threadId !== threadId) {
        setThreadId(data.threadId)
      }

      // Adicionar resposta do cliente
      const clientMessage: Message = {
        role: 'client',
        text: data.response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, clientMessage])

      // Verificar se o roleplay foi finalizado
      const isFinalized = data.response.toLowerCase().includes('roleplay finalizado')

      // Tocar TTS da resposta
      await textToSpeech(data.response, isFinalized)

      setCurrentTranscription('')

    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error)
      setCurrentTranscription('❌ Erro ao processar')
    } finally {
      setIsLoading(false)
    }
  }

  // Text to Speech - Otimizado para iOS
  const textToSpeech = async (text: string, shouldFinalize: boolean = false) => {
    try {
      console.log('🔊 Gerando TTS:', text.substring(0, 50) + '...')
      setIsPlayingAudio(true)

      const response = await fetch('/api/roleplay/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error('Erro ao gerar áudio')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // Reutilizar o elemento de áudio existente (importante para iOS)
      let audio = audioRef.current

      if (!audio) {
        audio = new Audio()
        audioRef.current = audio

        // Configurar uma vez só - atributos para iOS
        ;(audio as any).playsInline = true
        audio.setAttribute('playsinline', 'true')
        audio.setAttribute('webkit-playsinline', 'true')
      } else {
        // Parar áudio anterior se estiver tocando
        audio.pause()
        audio.currentTime = 0
      }

      // Revogar URL anterior se existir
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src)
      }

      // Definir nova fonte
      audio.src = audioUrl

      // IMPORTANTE: Garantir volume máximo (pode ter ficado baixo do unlock)
      audio.volume = 1

      // Configurar visualizador
      setupAudioVisualizer(audio)

      // Handler para quando terminar
      audio.onended = () => {
        setIsPlayingAudio(false)
        setAudioVolume(0)

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }

        console.log('🔊 Áudio finalizado')

        // Se o roleplay foi finalizado, encerrar automaticamente
        if (shouldFinalize) {
          console.log('🏁 Roleplay finalizado - encerrando sessão automaticamente')
          handleEndCall()
        }
      }

      // Handler para erro
      audio.onerror = (e) => {
        console.error('❌ Erro ao reproduzir áudio:', e)
        setIsPlayingAudio(false)
        setAudioVolume(0)

        if (shouldFinalize) {
          handleEndCall()
        }
      }

      // Carregar e tocar - essencial para iOS
      audio.load()

      // Tentar tocar com retry para iOS
      try {
        await audio.play()
        console.log('🔊 Tocando áudio')
      } catch (playError: any) {
        console.warn('⚠️ Primeira tentativa de play falhou:', playError.message)

        // iOS às vezes precisa de um pequeno delay
        await new Promise(resolve => setTimeout(resolve, 100))

        try {
          await audio.play()
          console.log('🔊 Tocando áudio (segunda tentativa)')
        } catch (retryError) {
          console.error('❌ Falha ao tocar áudio após retry:', retryError)
          throw retryError
        }
      }

    } catch (error) {
      console.error('Erro no TTS:', error)
      setIsPlayingAudio(false)
      setAudioVolume(0)

      // Se der erro no TTS mas o roleplay foi finalizado, encerrar mesmo assim
      if (shouldFinalize) {
        handleEndCall()
      }
    }
  }

  // Configurar visualizador de áudio
  const setupAudioVisualizer = (audio: HTMLAudioElement) => {
    try {
      // Cancelar animação anterior se existir
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }

      // Criar AudioContext se não existir
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const audioContext = audioContextRef.current

      // Resumir contexto se estiver suspenso (necessário para iOS)
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }

      // Criar analyser se não existir
      if (!audioAnalyserRef.current) {
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 128
        analyser.smoothingTimeConstant = 0.3
        audioAnalyserRef.current = analyser
      }

      const analyser = audioAnalyserRef.current

      // Criar source apenas uma vez por elemento de áudio
      // (createMediaElementSource só pode ser chamado uma vez por elemento)
      if (!audioSourceRef.current) {
        try {
          const source = audioContext.createMediaElementSource(audio)
          source.connect(analyser)
          analyser.connect(audioContext.destination)
          audioSourceRef.current = source
          console.log('🔊 Audio source criado e conectado')
        } catch (sourceError: any) {
          // Se o elemento já foi conectado, apenas continue
          if (sourceError.message?.includes('already connected')) {
            console.log('🔊 Audio source já conectado, reutilizando')
          } else {
            throw sourceError
          }
        }
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateVolume = () => {
        if (!audioAnalyserRef.current) return

        analyser.getByteFrequencyData(dataArray)

        const relevantFrequencies = dataArray.slice(5, 40)
        const average = relevantFrequencies.reduce((a, b) => a + b, 0) / relevantFrequencies.length

        const normalizedVolume = Math.min((average / 80) * 2.5, 1.2)
        setAudioVolume(normalizedVolume)

        animationFrameRef.current = requestAnimationFrame(updateVolume)
      }

      updateVolume()
    } catch (error) {
      console.error('Erro no visualizador:', error)
    }
  }

  // Encerrar chamada e avaliar
  const handleEndCall = async () => {
    // Parar áudio se estiver tocando
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsPlayingAudio(false)

    // Ir para tela de avaliação
    setStep('evaluating')

    // Usar ref para pegar o valor mais atualizado (evita closure stale)
    const currentMessages = messagesRef.current

    console.log('📋 Messages no estado:', messages.length, 'mensagens')
    console.log('📋 Messages na ref:', currentMessages.length, 'mensagens')
    console.log('📋 Messages completo:', JSON.stringify(currentMessages, null, 2))

    const transcription = currentMessages
      .map(msg => `${msg.role === 'seller' ? 'Vendedor' : 'Cliente'}: ${msg.text}`)
      .join('\n')

    console.log('📋 Transcrição montada:', transcription.substring(0, 500))
    console.log('📋 Tamanho da transcrição:', transcription.length, 'caracteres')

    try {
      console.log('📊 Enviando para avaliação...')

      const response = await fetch('/api/challenge/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          sessionId,
          leadId
        })
      })

      const data = await response.json()

      if (response.ok && data.evaluation) {
        console.log('✅ Avaliação recebida:', data.evaluation)
        setEvaluation(data.evaluation)

        // Salvar avaliação no banco de dados
        try {
          console.log('💾 Salvando avaliação no banco...')
          const completeResponse = await fetch('/api/challenge/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId,
              sessionId,
              evaluation: data.evaluation,
              transcription
            })
          })

          if (completeResponse.ok) {
            console.log('✅ Avaliação salva no banco de dados')
          } else {
            console.error('❌ Erro ao salvar avaliação no banco')
          }
        } catch (saveError) {
          console.error('❌ Erro ao salvar avaliação:', saveError)
        }
      } else {
        console.error('Erro na avaliação:', data.error)
        setEvaluation(null)
      }
    } catch (error) {
      console.error('Erro ao avaliar:', error)
      setEvaluation(null)
    }

    setStep('completed')
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-400/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6 flex justify-center">
          <div className="relative w-[280px] h-[80px]">
            <Image
              src="/images/ramppy-logo.png"
              alt="Ramppy Logo"
              fill
              className="object-contain scale-[2.2]"
              priority
            />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4">
          {/* STEP 1: Formulário */}
          {step === 'form' && (
            <div className="w-full max-w-md animate-fade-in">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-green-400/10 rounded-3xl blur-2xl" />

                <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 border border-emerald-500/30 shadow-2xl shadow-emerald-500/20">
                  {/* Ícone e Título */}
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-green-400/20 rounded-2xl mb-4 border border-emerald-500/30">
                      <PenTool className="w-10 h-10 text-emerald-400" />
                    </div>

                    <h1 className="text-3xl font-bold mb-3">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-500">
                        Venda uma Caneta
                      </span>
                    </h1>

                    <p className="text-gray-400 text-sm leading-relaxed">
                      O clássico desafio do <span className="text-emerald-400 font-semibold">Lobo de Wall Street</span>.
                      Convença um executivo ocupado a comprar sua caneta.
                    </p>
                  </div>

                  {/* Formulário */}
                  <form onSubmit={handleStartChallenge} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Seu Nome
                      </label>
                      <div className="relative">
                        <User className="w-5 h-5 text-emerald-400 absolute left-3 top-3.5" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 transition-all"
                          placeholder="Digite seu nome"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Seu Email
                      </label>
                      <div className="relative">
                        <Mail className="w-5 h-5 text-emerald-400 absolute left-3 top-3.5" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-emerald-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/60 transition-all"
                          placeholder="seu@email.com"
                        />
                      </div>
                    </div>

                    {formError && (
                      <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl text-sm">
                        {formError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingForm}
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:scale-[1.02]"
                    >
                      {submittingForm ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Iniciando...
                        </>
                      ) : (
                        <>
                          <Phone className="w-5 h-5" />
                          Iniciar Desafio
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Roleplay por Voz */}
          {step === 'roleplay' && (
            <div className="w-full max-w-2xl animate-fade-in">
              <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 border border-emerald-500/30 shadow-2xl shadow-emerald-500/20">
                {/* Header da Ligação */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full border border-green-500/40 mb-4">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-green-400 text-sm font-medium">Ligação em andamento</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">Desafio: Venda uma Caneta</h2>
                  <p className="text-gray-400 text-sm mt-1">Convença o executivo a comprar sua caneta</p>
                </div>

                {/* Blob Animado do Cliente */}
                <div className="flex justify-center mb-8">
                  <div className="relative">
                    {/* Blob Principal */}
                    <div
                      className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center transition-all duration-100"
                      style={{
                        transform: `scale(${1 + audioVolume * 0.3})`,
                        boxShadow: `0 0 ${30 + audioVolume * 50}px ${10 + audioVolume * 20}px rgba(16, 185, 129, ${0.3 + audioVolume * 0.3})`
                      }}
                    >
                      <Volume2 className={`w-12 h-12 text-white ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                    </div>

                    {/* Ondas de áudio */}
                    {isPlayingAudio && (
                      <>
                        <div className="absolute inset-0 rounded-full border-2 border-emerald-400/50 animate-ping" />
                        <div className="absolute inset-[-10px] rounded-full border border-emerald-400/30 animate-ping" style={{ animationDelay: '0.2s' }} />
                      </>
                    )}
                  </div>
                </div>

                {/* Status / Transcrição */}
                <div className="text-center mb-6 min-h-[60px]">
                  {isLoading && (
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processando...</span>
                    </div>
                  )}
                  {currentTranscription && !isLoading && (
                    <p className="text-gray-300 text-sm">{currentTranscription}</p>
                  )}
                  {isPlayingAudio && !isLoading && !currentTranscription && (
                    <p className="text-emerald-400 text-sm">Cliente falando...</p>
                  )}
                  {!isPlayingAudio && !isLoading && !currentTranscription && !isRecording && (
                    <p className="text-gray-500 text-sm">Clique no microfone para falar</p>
                  )}
                  {isRecording && (
                    <p className="text-red-400 text-sm animate-pulse">Gravando... Clique para parar</p>
                  )}
                </div>

                {/* Histórico de Mensagens (colapsado) */}
                <div className="mb-6 max-h-40 overflow-y-auto bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <div className="space-y-2">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`text-sm ${msg.role === 'seller' ? 'text-emerald-400' : 'text-gray-300'}`}
                      >
                        <span className="font-medium">{msg.role === 'seller' ? 'Você: ' : 'Cliente: '}</span>
                        {msg.text}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Botão de Controle */}
                <div className="flex justify-center">
                  {/* Botão do Microfone */}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isPlayingAudio || isLoading}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                        : 'bg-emerald-500 hover:bg-emerald-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed shadow-lg`}
                  >
                    {isRecording ? (
                      <MicOff className="w-8 h-8 text-white" />
                    ) : (
                      <Mic className="w-8 h-8 text-white" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Avaliando */}
          {step === 'evaluating' && (
            <div className="w-full max-w-md animate-fade-in text-center">
              <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 border border-emerald-500/30 shadow-2xl shadow-emerald-500/20">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500/20 to-green-400/20 rounded-2xl mb-4 border border-emerald-500/30">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-4">Avaliando seu desempenho...</h2>
                <p className="text-gray-400">
                  Nossa IA está analisando sua performance no desafio.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Completado */}
          {step === 'completed' && (
            <div className="w-full max-w-3xl animate-fade-in px-4 py-4">
              <div className="relative">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-green-400/10 rounded-3xl blur-2xl" />

                <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-3xl border border-emerald-500/30 shadow-2xl shadow-emerald-500/20 max-h-[85vh] overflow-y-auto">
                  {/* Header com Score Principal */}
                  <div className="relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-green-500/10 to-transparent" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                    <div className="relative p-6 sm:p-8 text-center">
                      {/* Status Badge */}
                      {evaluation?.sale_completed !== undefined && (
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${
                          evaluation.sale_completed
                            ? 'bg-emerald-500/30 border-2 border-emerald-400/50'
                            : 'bg-red-500/30 border-2 border-red-400/50'
                        }`}>
                          {evaluation.sale_completed ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                          <span className={`font-bold ${evaluation.sale_completed ? 'text-emerald-400' : 'text-red-400'}`}>
                            {evaluation.sale_completed ? 'VENDA REALIZADA!' : 'VENDA NÃO CONCLUÍDA'}
                          </span>
                        </div>
                      )}

                      {/* Score Principal */}
                      {evaluation && (evaluation.overall_score !== undefined || evaluation.score !== undefined) && (
                        <div className="mb-4">
                          <div className="relative inline-flex items-center justify-center">
                            {/* Ring animado */}
                            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
                            <svg className="w-36 h-36 transform -rotate-90">
                              <circle
                                cx="72"
                                cy="72"
                                r="64"
                                fill="none"
                                stroke="rgba(16, 185, 129, 0.2)"
                                strokeWidth="8"
                              />
                              <circle
                                cx="72"
                                cy="72"
                                r="64"
                                fill="none"
                                stroke="url(#scoreGradient)"
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={`${(normalizeScore(evaluation.overall_score ?? evaluation.score) / 10) * 402} 402`}
                                className="transition-all duration-1000 ease-out"
                              />
                              <defs>
                                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#10b981" />
                                  <stop offset="100%" stopColor="#34d399" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-5xl font-black text-white">
                                {normalizeScore(evaluation.overall_score ?? evaluation.score).toFixed(1)}
                              </span>
                              <span className="text-gray-400 text-xs mt-1">de 10</span>
                            </div>
                          </div>

                          {/* Performance Level Badge */}
                          {evaluation.performance_level && (
                            <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${
                              evaluation.performance_level === 'legendary' ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-purple-300 border border-purple-400/30' :
                              evaluation.performance_level === 'excellent' ? 'bg-gradient-to-r from-emerald-600/30 to-green-600/30 text-emerald-300 border border-emerald-400/30' :
                              evaluation.performance_level === 'very_good' ? 'bg-gradient-to-r from-green-600/30 to-teal-600/30 text-green-300 border border-green-400/30' :
                              evaluation.performance_level === 'good' ? 'bg-gradient-to-r from-blue-600/30 to-cyan-600/30 text-blue-300 border border-blue-400/30' :
                              evaluation.performance_level === 'needs_improvement' ? 'bg-gradient-to-r from-yellow-600/30 to-orange-600/30 text-yellow-300 border border-yellow-400/30' :
                              'bg-gradient-to-r from-red-600/30 to-orange-600/30 text-red-300 border border-red-400/30'
                            }`}>
                              <span className="text-lg">
                                {evaluation.performance_level === 'legendary' ? '🏆' :
                                 evaluation.performance_level === 'excellent' ? '⭐' :
                                 evaluation.performance_level === 'very_good' ? '✨' :
                                 evaluation.performance_level === 'good' ? '👍' :
                                 evaluation.performance_level === 'needs_improvement' ? '📈' : '🎯'}
                              </span>
                              {evaluation.performance_level === 'legendary' ? 'LENDÁRIO' :
                               evaluation.performance_level === 'excellent' ? 'EXCELENTE' :
                               evaluation.performance_level === 'very_good' ? 'MUITO BOM' :
                               evaluation.performance_level === 'good' ? 'BOM' :
                               evaluation.performance_level === 'needs_improvement' ? 'PRECISA MELHORAR' : 'INICIANTE'}
                            </div>
                          )}
                        </div>
                      )}

                      <h2 className="text-2xl font-bold text-white">Desafio Concluído!</h2>
                    </div>
                  </div>

                  {/* Conteúdo da Avaliação */}
                  {evaluation ? (
                    <div className="p-6 sm:p-8 pt-0 space-y-5">
                      {/* CTA Banner - Ramppy */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 p-[2px] shadow-lg shadow-emerald-500/40">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-400 opacity-50 animate-pulse" />
                        <div className="relative bg-gradient-to-r from-emerald-600/95 via-green-500/95 to-emerald-600/95 backdrop-blur-sm rounded-2xl p-5">
                          <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
                          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl translate-x-1/2 translate-y-1/2" />

                          <div className="relative text-center space-y-3">
                            <p className="text-white font-bold text-lg leading-tight">
                              Aqui foi caneta. Na <span className="text-yellow-300">Ramppy</span>, seu time treina SPIN Selling com o seu produto, suas objeções, seus clientes.
                            </p>
                            <p className="text-emerald-100 text-sm">
                              Todo dia, com IA.
                            </p>
                            <a
                              href="https://wa.me/5531994713357?text=Oi!%20Acabei%20de%20fazer%20o%20desafio%20%22Venda%20uma%20Caneta%22%20e%20quero%20saber%20mais%20sobre%20a%20Ramppy!"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block px-6 py-3 bg-white hover:bg-gray-100 text-emerald-600 font-bold rounded-xl transition-all hover:scale-105 shadow-lg"
                            >
                              Quero personalizar para meu negócio
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* SPIN Cards */}
                      {evaluation.spin_evaluation && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {(['S', 'P', 'I', 'N'] as const).map((letter, idx) => {
                            const spin = evaluation.spin_evaluation?.[letter]
                            const score = normalizeScore(spin?.final_score)
                            const labels = { S: 'Situação', P: 'Problema', I: 'Implicação', N: 'Necessidade' }
                            const colors = {
                              S: 'from-blue-500 to-cyan-500',
                              P: 'from-orange-500 to-red-500',
                              I: 'from-purple-500 to-pink-500',
                              N: 'from-emerald-500 to-green-500'
                            }
                            const bgColors = {
                              S: 'bg-blue-500/10 border-blue-500/30',
                              P: 'bg-orange-500/10 border-orange-500/30',
                              I: 'bg-purple-500/10 border-purple-500/30',
                              N: 'bg-emerald-500/10 border-emerald-500/30'
                            }
                            return (
                              <div
                                key={letter}
                                className={`relative overflow-hidden rounded-2xl border ${bgColors[letter]} p-4`}
                                style={{ animationDelay: `${idx * 100}ms` }}
                              >
                                {/* Barra de progresso visual */}
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/50">
                                  <div
                                    className={`h-full bg-gradient-to-r ${colors[letter]} transition-all duration-1000`}
                                    style={{ width: `${score * 10}%` }}
                                  />
                                </div>

                                <div className="text-center">
                                  <div className={`text-3xl font-black bg-gradient-to-r ${colors[letter]} bg-clip-text text-transparent`}>
                                    {letter}
                                  </div>
                                  <div className={`text-2xl font-bold mt-1 ${
                                    score >= 7 ? 'text-emerald-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {score.toFixed(1)}
                                  </div>
                                  <div className="text-gray-400 text-xs mt-1">{labels[letter]}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Resumo Executivo */}
                      {(evaluation.executive_summary || evaluation.verdict || evaluation.feedback) && (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-800/40 border border-gray-700/50 p-5">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
                          <div className="relative">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <Target className="w-5 h-5 text-emerald-400" />
                              </div>
                              <h3 className="text-lg font-bold text-white">Resumo da Performance</h3>
                            </div>
                            <p className="text-gray-300 leading-relaxed">
                              {evaluation.executive_summary || evaluation.verdict || evaluation.feedback}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Grid de Pontos Fortes e Gaps */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        {/* Pontos Fortes */}
                        {((evaluation.top_strengths && evaluation.top_strengths.length > 0) ||
                          (evaluation.strengths && evaluation.strengths.length > 0)) && (
                          <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/30 p-5">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                              </div>
                              <h3 className="text-lg font-bold text-emerald-400">Pontos Fortes</h3>
                            </div>
                            <ul className="space-y-3">
                              {(evaluation.top_strengths || evaluation.strengths || []).map((item: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-3">
                                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                  </div>
                                  <span className="text-gray-300 text-sm">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Gaps Críticos */}
                        {((evaluation.critical_gaps && evaluation.critical_gaps.length > 0) ||
                          (evaluation.improvements && evaluation.improvements.length > 0)) && (
                          <div className="rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/30 p-5">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-red-400" />
                              </div>
                              <h3 className="text-lg font-bold text-red-400">Gaps Críticos</h3>
                            </div>
                            <ul className="space-y-3">
                              {(evaluation.critical_gaps || evaluation.improvements || []).map((item: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-3">
                                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <XCircle className="w-4 h-4 text-red-400" />
                                  </div>
                                  <span className="text-gray-300 text-sm">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Lição Principal - Destacada */}
                      {evaluation.key_lesson && (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 border border-blue-500/30 p-5">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 animate-pulse" />
                          <div className="relative">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                                <Lightbulb className="w-5 h-5 text-blue-400" />
                              </div>
                              <h3 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Lição Principal
                              </h3>
                            </div>
                            <p className="text-gray-200 leading-relaxed text-sm sm:text-base">
                              {evaluation.key_lesson}
                            </p>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="p-6 sm:p-8 text-center">
                      <p className="text-gray-400">
                        Obrigado por participar do desafio "Venda uma Caneta".
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="p-4 text-center">
          <p className="text-gray-500 text-xs">
            Powered by Ramppy - Treinamento de Vendas com IA
          </p>
        </footer>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}
