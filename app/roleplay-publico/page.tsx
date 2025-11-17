'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Users, Loader2, CheckCircle, AlertCircle, Square } from 'lucide-react'

interface CompanyConfig {
  company: {
    id: string
    name: string
    subdomain: string
  }
  roleplayLink: {
    is_active: boolean
    config: {
      age_range: string
      temperament: string
      persona_id: string | null
      objection_ids: string[]
    }
  }
  personas: any[]
  objections: any[]
}

export default function RoleplayPublico() {
  const [loading, setLoading] = useState(true)
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Formulário inicial
  const [participantName, setParticipantName] = useState('')
  const [selectedAge, setSelectedAge] = useState('')
  const [selectedTemperament, setSelectedTemperament] = useState('')
  const [selectedPersona, setSelectedPersona] = useState('')
  const [selectedObjections, setSelectedObjections] = useState<string[]>([])

  // Sessão de roleplay
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [evaluation, setEvaluation] = useState<any>(null)

  // Referências para áudio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    loadCompanyConfig()
  }, [])

  const loadCompanyConfig = async () => {
    try {
      const response = await fetch('/api/public/roleplay/config')
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao carregar configuração')
      }

      const data = await response.json()
      setCompanyConfig(data)

      // Usar configuração pré-definida pelo gestor
      if (data.roleplayLink?.config) {
        const config = data.roleplayLink.config
        setSelectedAge(config.age_range)
        setSelectedTemperament(config.temperament)
        setSelectedPersona(config.persona_id)
        setSelectedObjections(config.objection_ids)
      }
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error)
      setError(error.message || 'Erro ao carregar configuração')
    } finally {
      setLoading(false)
    }
  }

  const startRecording = async () => {
    if (isProcessing || isPlayingAudio) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        await sendAudioMessage(audioBlob)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error)
      alert('Erro ao acessar o microfone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const sendAudioMessage = async (audioBlob: Blob) => {
    setIsProcessing(true)

    try {
      // Transcrever áudio
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('sessionId', sessionId!)

      const transcribeResponse = await fetch('/api/public/roleplay/transcribe', {
        method: 'POST',
        body: formData
      })

      if (!transcribeResponse.ok) {
        throw new Error('Erro ao transcrever áudio')
      }

      const { text } = await transcribeResponse.json()

      // Adicionar mensagem do vendedor
      setMessages(prev => [...prev, { role: 'seller', text }])

      // Enviar para o chat
      const chatResponse = await fetch('/api/public/roleplay/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          threadId,
          message: text
        })
      })

      if (!chatResponse.ok) {
        throw new Error('Erro ao processar mensagem')
      }

      const { response, messages: updatedMessages } = await chatResponse.json()

      // Atualizar mensagens
      setMessages(updatedMessages)

      // Reproduzir resposta em áudio
      await playAudioResponse(response)
    } catch (error) {
      console.error('Erro ao processar áudio:', error)
      alert('Erro ao processar sua mensagem')
    } finally {
      setIsProcessing(false)
    }
  }

  const playAudioResponse = async (text: string) => {
    try {
      setIsPlayingAudio(true)

      const response = await fetch('/api/public/roleplay/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sessionId })
      })

      if (!response.ok) {
        throw new Error('Erro ao gerar áudio')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsPlayingAudio(false)
        URL.revokeObjectURL(audioUrl)
      }

      await audio.play()
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error)
      setIsPlayingAudio(false)
    }
  }

  const endRoleplay = async () => {
    if (!sessionId) return

    setIsProcessing(true)

    try {
      const response = await fetch('/api/public/roleplay/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (!response.ok) {
        throw new Error('Erro ao finalizar roleplay')
      }

      const { session } = await response.json()

      // Mostrar resultado ou voltar ao início
      alert('Roleplay finalizado com sucesso!')

      // Resetar estado
      setSessionStarted(false)
      setSessionId(null)
      setThreadId(null)
      setMessages([])
      setParticipantName('')
      setSelectedObjections([])
    } catch (error) {
      console.error('Erro ao finalizar roleplay:', error)
      alert('Erro ao finalizar roleplay')
    } finally {
      setIsProcessing(false)
    }
  }

  const startRoleplay = async () => {
    if (!participantName.trim()) {
      alert('Por favor, insira seu nome')
      return
    }

    if (selectedObjections.length === 0) {
      alert('Por favor, selecione pelo menos uma objeção')
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch('/api/public/roleplay/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName,
          companyId: companyConfig?.company.id,
          config: {
            age: selectedAge,
            temperament: selectedTemperament,
            personaId: selectedPersona,
            objectionIds: selectedObjections
          }
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao iniciar roleplay')
      }

      const data = await response.json()
      setSessionId(data.sessionId)
      setThreadId(data.threadId)
      setSessionStarted(true)
    } catch (error) {
      console.error('Erro ao iniciar roleplay:', error)
      alert('Erro ao iniciar roleplay')
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4 mx-auto" />
          <h2 className="text-xl font-bold text-white text-center mb-2">Erro</h2>
          <p className="text-gray-300 text-center">{error}</p>
        </div>
      </div>
    )
  }

  // Verificar se o roleplay está ativo
  if (!companyConfig?.roleplayLink?.is_active) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-yellow-400 mb-4 mx-auto" />
          <h2 className="text-xl font-bold text-white text-center mb-2">Roleplay Desativado</h2>
          <p className="text-gray-300 text-center">
            O roleplay público desta empresa está temporariamente desativado.
          </p>
        </div>
      </div>
    )
  }

  // Verificar se a configuração está completa
  if (!companyConfig?.roleplayLink?.config?.persona_id ||
      !companyConfig?.roleplayLink?.config?.objection_ids?.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-6 max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-yellow-400 mb-4 mx-auto" />
          <h2 className="text-xl font-bold text-white text-center mb-2">Configuração Incompleta</h2>
          <p className="text-gray-300 text-center">
            O roleplay ainda não foi configurado pelo administrador.
          </p>
        </div>
      </div>
    )
  }

  if (!sessionStarted) {
    // Buscar detalhes da persona e objeções selecionadas
    const selectedPersonaData = companyConfig?.personas.find(
      p => p.id === companyConfig.roleplayLink.config.persona_id
    )
    const selectedObjectionsData = companyConfig?.objections.filter(
      o => companyConfig.roleplayLink.config.objection_ids.includes(o.id)
    )

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 max-w-2xl w-full border border-purple-500/30">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Roleplay de Vendas - {companyConfig?.company.name}
            </h1>
            <p className="text-gray-400">
              Pratique suas habilidades de vendas com nosso simulador inteligente
            </p>
          </div>

          <div className="space-y-6">
            {/* Informações do Roleplay Configurado */}
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
              <h3 className="text-sm font-medium text-purple-300 mb-3">
                Cenário do Roleplay
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <p>
                  <span className="text-gray-400">Cliente:</span>{' '}
                  {companyConfig.roleplayLink.config.age_range} anos, {companyConfig.roleplayLink.config.temperament.toLowerCase()}
                </p>
                <p>
                  <span className="text-gray-400">Cargo:</span>{' '}
                  {selectedPersonaData?.cargo}
                </p>
                <p>
                  <span className="text-gray-400">Objeções:</span>{' '}
                  {selectedObjectionsData?.length} preparadas
                </p>
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Seu Nome
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/40"
                placeholder="Digite seu nome para começar"
                autoFocus
              />
            </div>

            {/* Botão Iniciar */}
            <button
              onClick={startRoleplay}
              disabled={isProcessing || !participantName.trim()}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-semibold text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Iniciar Roleplay
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Interface de Roleplay
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              Roleplay em Andamento
            </h2>
            <p className="text-gray-400">
              Olá {participantName}, converse com o cliente virtual
            </p>
          </div>

          {/* Área de mensagens */}
          <div className="bg-gray-900/50 rounded-xl p-6 min-h-[400px] max-h-[600px] overflow-y-auto mb-6">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center">
                Clique no microfone para começar a conversa
              </p>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'seller' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-4 rounded-xl ${
                        msg.role === 'seller'
                          ? 'bg-purple-600/20 border border-purple-500/30'
                          : 'bg-gray-700/50 border border-gray-600/30'
                      }`}
                    >
                      <p className="text-sm text-gray-400 mb-1">
                        {msg.role === 'seller' ? 'Você' : 'Cliente'}
                      </p>
                      <p className="text-white">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex justify-center gap-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isProcessing || isPlayingAudio}
                className="p-4 bg-purple-600 hover:bg-purple-700 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Mic className="w-6 h-6 text-white" />
                {isProcessing && <Loader2 className="w-5 h-5 text-white animate-spin" />}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="p-4 bg-red-600 hover:bg-red-700 rounded-full transition-all animate-pulse flex items-center gap-2"
              >
                <Square className="w-6 h-6 text-white" />
                <span className="text-white font-medium">Finalizar Fala</span>
              </button>
            )}

            <button
              onClick={endRoleplay}
              disabled={isProcessing}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Finalizar Roleplay
            </button>
          </div>

          {/* Indicadores de estado */}
          {isPlayingAudio && (
            <div className="text-center mt-4">
              <p className="text-purple-400 animate-pulse">
                Cliente está falando...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}