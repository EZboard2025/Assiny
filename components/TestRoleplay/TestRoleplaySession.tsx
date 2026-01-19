'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Square, Loader2, Volume2, User, Sparkles, Clock } from 'lucide-react'
import { PersonaB2B, PersonaB2C, Objection, CompanyInfo } from './TestRoleplayPage'

interface TestRoleplaySessionProps {
  sessionId: string
  threadId: string
  clientName: string
  clientAge: number
  clientTemperament: string
  persona: PersonaB2B | PersonaB2C
  objections: Objection[]
  companyInfo: CompanyInfo
  businessType: 'B2B' | 'B2C'
  objective: string
  firstMessage: string
  onEnd: (evaluation: any) => void
}

interface Message {
  role: 'client' | 'seller'
  text: string
  timestamp: string
}

export default function TestRoleplaySession({
  sessionId,
  threadId,
  clientName,
  clientAge,
  clientTemperament,
  persona,
  objections,
  companyInfo,
  businessType,
  objective,
  firstMessage,
  onEnd
}: TestRoleplaySessionProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [audioVolume, setAudioVolume] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasInitializedRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioSourceCreatedRef = useRef(false)

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    const initFirstMessage = async () => {
      if (firstMessage) {
        const firstClientMessage: Message = {
          role: 'client',
          text: firstMessage,
          timestamp: new Date().toISOString()
        }
        setMessages([firstClientMessage])
        await playTTS(firstMessage)
      }
      setIsLoading(false)
    }

    initFirstMessage()
  }, [])

  // Audio visualizer - simplificado para mobile
  const setupAudioVisualizer = (audio: HTMLAudioElement) => {
    try {
      // Evitar criar múltiplas sources para o mesmo elemento
      if (audioSourceCreatedRef.current) {
        return
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      const audioContext = audioContextRef.current

      // Resumir se suspenso
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.3
      analyserRef.current = analyser

      try {
        const source = audioContext.createMediaElementSource(audio)
        source.connect(analyser)
        analyser.connect(audioContext.destination)
        audioSourceCreatedRef.current = true
      } catch (sourceError) {
        // Source já foi criada para este elemento, ignorar
        console.warn('Audio source já existe:', sourceError)
      }

      const updateVolume = () => {
        if (!analyserRef.current) return

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)

        const relevantFrequencies = dataArray.slice(5, 40)
        const average = relevantFrequencies.reduce((a, b) => a + b, 0) / relevantFrequencies.length
        const normalizedVolume = Math.min((average / 80) * 2.5, 1.2)

        setAudioVolume(normalizedVolume)
        animationRef.current = requestAnimationFrame(updateVolume)
      }

      updateVolume()
    } catch (error) {
      console.error('Erro ao configurar visualizador:', error)
    }
  }

  // Função para reproduzir áudio pendente (quando usuário clica)
  const playPendingAudio = async () => {
    if (!pendingAudioUrl) return

    try {
      // Inicializar AudioContext na interação do usuário
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }

      const audio = new Audio(pendingAudioUrl)
      audioRef.current = audio
      audio.setAttribute('playsinline', 'true')

      setIsPlayingAudio(true)

      audio.onplay = () => {
        setupAudioVisualizer(audio)
      }

      audio.onended = () => {
        setIsPlayingAudio(false)
        setAudioVolume(0)
        setPendingAudioUrl(null)
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }

      audio.onerror = () => {
        setIsPlayingAudio(false)
        setPendingAudioUrl(null)
      }

      await audio.play()
    } catch (error) {
      console.error('Erro ao reproduzir áudio pendente:', error)
      setIsPlayingAudio(false)
      setPendingAudioUrl(null)
    }
  }

  const playTTS = async (text: string) => {
    try {
      setIsPlayingAudio(true)
      const response = await fetch('/api/teste/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        audioRef.current = audio

        // Configurações para mobile
        audio.setAttribute('playsinline', 'true')
        audio.setAttribute('webkit-playsinline', 'true')

        audio.onplay = () => {
          // Resumir AudioContext se estiver suspenso (necessário para mobile)
          if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume()
          }
          setupAudioVisualizer(audio)
        }

        audio.onended = () => {
          setIsPlayingAudio(false)
          setAudioVolume(0)
          setPendingAudioUrl(null)
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current)
          }
          URL.revokeObjectURL(audioUrl)
        }

        audio.onerror = (e) => {
          console.error('Erro ao reproduzir áudio:', e)
          setIsPlayingAudio(false)
          setAudioVolume(0)
          setPendingAudioUrl(null)
          URL.revokeObjectURL(audioUrl)
        }

        // Tentar reproduzir - se falhar no mobile, salvar URL para reproduzir depois
        try {
          await audio.play()
        } catch (playError) {
          console.warn('Autoplay bloqueado, salvando áudio para reprodução manual:', playError)
          // Salvar URL do áudio para o usuário clicar e reproduzir
          setPendingAudioUrl(audioUrl)
          setIsPlayingAudio(false)
        }
      } else {
        setIsPlayingAudio(false)
      }
    } catch (error) {
      console.error('Erro no TTS:', error)
      setIsPlayingAudio(false)
    }
  }

  const startRecording = async () => {
    try {
      // Inicializar/resumir AudioContext na interação do usuário (necessário para mobile)
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        await handleTranscription(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error)
      alert('Não foi possível acessar o microfone. Verifique as permissões.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleTranscription = async (audioBlob: Blob) => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')

      const transcribeResponse = await fetch('/api/teste/transcribe', {
        method: 'POST',
        body: formData
      })

      if (!transcribeResponse.ok) {
        throw new Error('Erro na transcrição')
      }

      const { text: transcribedText } = await transcribeResponse.json()

      if (!transcribedText || transcribedText.trim() === '') {
        setIsLoading(false)
        return
      }

      const sellerMessage: Message = {
        role: 'seller',
        text: transcribedText,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, sellerMessage])

      const chatResponse = await fetch('/api/teste/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          threadId,
          message: transcribedText,
          clientName,
          age: clientAge,
          temperament: clientTemperament,
          persona,
          objections,
          companyInfo,
          businessType,
          objective
        })
      })

      if (chatResponse.ok) {
        const data = await chatResponse.json()

        const clientMessage: Message = {
          role: 'client',
          text: data.message,
          timestamp: new Date().toISOString()
        }
        setMessages(prev => [...prev, clientMessage])

        await playTTS(data.message)

        const messageText = data.message.toLowerCase()
        if (messageText.includes('roleplay finalizado') || messageText.includes('finalizar sessão') || messageText.includes('encerrar por aqui')) {
          setTimeout(() => {
            handleEndSession(true)
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEndSession = async (autoFinalize = false) => {
    if (!autoFinalize && messages.length < 2) {
      alert('Converse um pouco mais antes de finalizar.')
      return
    }

    setIsEnding(true)
    try {
      const response = await fetch('/api/teste/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (response.ok) {
        const data = await response.json()
        onEnd(data.evaluation)
      } else {
        throw new Error('Erro ao finalizar sessão')
      }
    } catch (error) {
      console.error('Erro ao finalizar:', error)
      alert('Erro ao finalizar sessão. Tente novamente.')
      setIsEnding(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header com info do cliente */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar animado */}
            <div className="relative">
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg transition-all duration-300 ${
                  isPlayingAudio ? 'scale-110 shadow-green-500/50' : ''
                }`}
                style={{
                  transform: isPlayingAudio ? `scale(${1 + audioVolume * 0.15})` : 'scale(1)'
                }}
              >
                <User className="w-8 h-8 text-white" />
              </div>
              {/* Indicador de status */}
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-black flex items-center justify-center ${
                isPlayingAudio ? 'bg-green-500' : isLoading ? 'bg-yellow-500' : 'bg-gray-500'
              }`}>
                {isPlayingAudio && <Volume2 className="w-3 h-3 text-white animate-pulse" />}
                {isLoading && !isPlayingAudio && <Loader2 className="w-3 h-3 text-white animate-spin" />}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                {clientName}
                {isPlayingAudio && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full animate-pulse">
                    Falando...
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  {clientAge} anos
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-600" />
                <span className="text-emerald-400 font-medium">{clientTemperament}</span>
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 bg-gray-800/60 px-4 py-2 rounded-xl border border-gray-700/50">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-white font-mono font-medium">{formatTime(elapsedTime)}</span>
          </div>
        </div>
      </div>

      {/* Container principal */}
      <div className="bg-gradient-to-b from-gray-900/80 to-gray-950/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 overflow-hidden shadow-2xl">
        {/* Mensagens */}
        <div className="h-[450px] overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'seller' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${
                  msg.role === 'seller'
                    ? 'bg-gradient-to-br from-green-600/30 to-emerald-600/20 border border-green-500/30 rounded-br-md'
                    : 'bg-gray-800/70 border border-gray-700/50 rounded-bl-md'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-medium ${
                    msg.role === 'seller' ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    {msg.role === 'seller' ? 'Você' : clientName}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[15px] text-white leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}


          <div ref={messagesEndRef} />
        </div>

        {/* Área de controles */}
        <div className="relative border-t border-gray-700/50 bg-gradient-to-t from-gray-900/50 to-transparent p-6">
          {/* Visualização de áudio tocando */}
          {isPlayingAudio && (
            <div className="absolute inset-x-0 -top-1 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent animate-pulse" />
          )}

          <div className="flex flex-col items-center">
            {/* Botão para ouvir áudio pendente (mobile) */}
            {pendingAudioUrl && !isPlayingAudio && (
              <button
                onClick={playPendingAudio}
                className="mb-4 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium flex items-center gap-2 animate-pulse hover:animate-none hover:scale-105 transition-transform shadow-lg shadow-blue-500/30"
              >
                <Volume2 className="w-5 h-5" />
                Toque para ouvir o cliente
              </button>
            )}

            {/* Botão principal de gravação */}
            <div className="relative">
              {/* Anel animado quando está tocando áudio */}
              {isPlayingAudio && (
                <div
                  className="absolute inset-0 rounded-full bg-green-500/20 animate-ping"
                  style={{ transform: `scale(${1.2 + audioVolume * 0.3})` }}
                />
              )}

              {/* Anel de gravação */}
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-4 border-red-500/50 animate-pulse scale-[1.15]" />
              )}

              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || isPlayingAudio || isEnding || !!pendingAudioUrl}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isEnding
                    ? 'bg-gradient-to-br from-purple-500 to-violet-600 shadow-xl shadow-purple-500/30'
                    : isRecording
                    ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-xl shadow-red-500/40 scale-105'
                    : 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-xl shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105'
                }`}
              >
                {isEnding ? (
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                ) : isRecording ? (
                  <MicOff className="w-10 h-10 text-white" />
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}
              </button>
            </div>

            {/* Status text */}
            <p className={`mt-4 text-sm font-medium transition-all ${
              pendingAudioUrl
                ? 'text-blue-400'
                : isEnding
                ? 'text-purple-400'
                : isRecording
                ? 'text-red-400'
                : isPlayingAudio
                ? 'text-green-400'
                : 'text-gray-400'
            }`}>
              {pendingAudioUrl
                ? 'Áudio pronto - toque no botão acima para ouvir'
                : isEnding
                ? 'Processando sua avaliação...'
                : isRecording
                ? 'Gravando... Clique para enviar'
                : isPlayingAudio
                ? 'Ouça o cliente responder...'
                : isLoading
                ? 'Processando...'
                : 'Clique no microfone para falar'}
            </p>

            {/* Dica */}
            {isEnding ? (
              <p className="mt-2 text-xs text-purple-400/70">
                Aguarde enquanto analisamos sua performance...
              </p>
            ) : !isRecording && !isPlayingAudio && !isLoading && messages.length > 0 && (
              <p className="mt-2 text-xs text-gray-600">
                Dica: Escute atentamente e responda de forma natural
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé com info */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-500">
        <span>{messages.length} mensagens</span>
        <span className="w-1 h-1 rounded-full bg-gray-600" />
        <span>Sessão #{sessionId.slice(-6)}</span>
      </div>
    </div>
  )
}
