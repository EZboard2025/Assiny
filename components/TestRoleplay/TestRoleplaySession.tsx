'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Square, Loader2, Volume2 } from 'lucide-react'
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
  const [isLoading, setIsLoading] = useState(true) // Começa carregando primeira mensagem
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [firstMessageLoaded, setFirstMessageLoaded] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll para o final das mensagens
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Carregar primeira mensagem do cliente (já vem do /api/teste/start)
  useEffect(() => {
    let isCancelled = false

    const initFirstMessage = async () => {
      // Evitar execução duplicada (React StrictMode)
      if (firstMessageLoaded) return

      // Usar a mensagem que já veio do /api/teste/start
      if (firstMessage) {
        const firstClientMessage: Message = {
          role: 'client',
          text: firstMessage,
          timestamp: new Date().toISOString()
        }
        setMessages([firstClientMessage])

        // Tocar TTS da primeira mensagem
        if (!isCancelled) {
          await playTTS(firstMessage)
        }
      }

      if (!isCancelled) {
        setIsLoading(false)
        setFirstMessageLoaded(true)
      }
    }

    initFirstMessage()

    return () => {
      isCancelled = true
    }
  }, [])

  // Tocar TTS
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

        audio.onended = () => {
          setIsPlayingAudio(false)
          URL.revokeObjectURL(audioUrl)
        }

        audio.onerror = () => {
          setIsPlayingAudio(false)
          URL.revokeObjectURL(audioUrl)
        }

        await audio.play()
      } else {
        setIsPlayingAudio(false)
      }
    } catch (error) {
      console.error('Erro no TTS:', error)
      setIsPlayingAudio(false)
    }
  }

  // Iniciar gravação
  const startRecording = async () => {
    try {
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

  // Parar gravação
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // Transcrever e enviar mensagem
  const handleTranscription = async (audioBlob: Blob) => {
    setIsLoading(true)
    try {
      // Transcrever áudio
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

      // Adicionar mensagem do vendedor
      const sellerMessage: Message = {
        role: 'seller',
        text: transcribedText,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, sellerMessage])

      // Enviar para o chat e receber resposta
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

        // Adicionar resposta do cliente
        const clientMessage: Message = {
          role: 'client',
          text: data.message,
          timestamp: new Date().toISOString()
        }
        setMessages(prev => [...prev, clientMessage])

        // Tocar TTS da resposta
        await playTTS(data.message)
      }
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Finalizar sessão
  const handleEndSession = async () => {
    if (messages.length < 2) {
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
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl border border-green-500/20 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-green-500/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">
              Conversa com {clientName}
            </h3>
            <p className="text-xs text-gray-400">
              {clientAge} anos | {clientTemperament}
            </p>
          </div>
          <button
            onClick={handleEndSession}
            disabled={isEnding || isLoading || messages.length < 2}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isEnding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Avaliando...
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                Finalizar
              </>
            )}
          </button>
        </div>

        {/* Mensagens */}
        <div className="h-[400px] overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'seller' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'seller'
                    ? 'bg-green-500/20 text-white rounded-br-md'
                    : 'bg-gray-800/50 text-gray-200 rounded-bl-md'
                }`}
              >
                <p className="text-xs text-gray-500 mb-1">
                  {msg.role === 'seller' ? 'Você' : clientName}
                </p>
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800/50 rounded-2xl px-4 py-3 rounded-bl-md">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-green-400" />
                  <span className="text-sm text-gray-400">Pensando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Controles */}
        <div className="p-4 border-t border-green-500/10">
          {/* Indicador de áudio tocando */}
          {isPlayingAudio && (
            <div className="flex items-center justify-center gap-2 mb-4 text-green-400">
              <Volume2 className="w-5 h-5 animate-pulse" />
              <span className="text-sm">Cliente falando...</span>
            </div>
          )}

          {/* Botão de gravação */}
          <div className="flex justify-center">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isLoading || isPlayingAudio || !firstMessageLoaded}
                className="w-20 h-20 rounded-full bg-gradient-to-r from-green-600 to-green-500 text-white flex items-center justify-center hover:scale-105 hover:shadow-xl hover:shadow-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Mic className="w-8 h-8" />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-gradient-to-r from-red-600 to-red-500 text-white flex items-center justify-center hover:scale-105 hover:shadow-xl hover:shadow-red-500/50 transition-all animate-pulse"
              >
                <MicOff className="w-8 h-8" />
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-3">
            {isRecording
              ? 'Clique para parar de gravar'
              : isPlayingAudio
              ? 'Aguarde o cliente terminar de falar'
              : 'Clique para começar a falar'}
          </p>
        </div>
      </div>
    </div>
  )
}
