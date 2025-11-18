'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Users, Loader2, CheckCircle, AlertCircle, Square } from 'lucide-react'
import Image from 'next/image'

interface CompanyConfig {
  company: {
    id: string
    name: string
    subdomain: string
  }
  roleplayLink: {
    is_active: boolean
    config: {
      age: string
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
  const [linkId, setLinkId] = useState<string | null>(null) // ID do roleplay_link

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
      // Buscar linkCode da URL
      const urlParams = new URLSearchParams(window.location.search)
      const linkCode = urlParams.get('link')

      if (!linkCode) {
        throw new Error('Link de roleplay não fornecido na URL')
      }

      // Tentar carregar configuração do localStorage primeiro
      const cachedConfigKey = `roleplay_config_${linkCode}`
      const cachedConfig = localStorage.getItem(cachedConfigKey)

      if (cachedConfig) {
        const data = JSON.parse(cachedConfig)
        setCompanyConfig(data)

        // Restaurar configurações salvas
        if (data.roleplayLink?.config) {
          const config = data.roleplayLink.config
          setSelectedAge(config.age)
          setSelectedTemperament(config.temperament)
          setSelectedPersona(config.persona_id)
          setSelectedObjections(config.objection_ids || [])
        }

        setLoading(false)
        return
      }

      // Se não tiver cache, buscar da API
      const response = await fetch(`/api/public/roleplay/config?link=${linkCode}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao carregar configuração')
      }

      const data = await response.json()
      setCompanyConfig(data)

      // Salvar linkId para usar no startRoleplay
      setLinkId(data.roleplayLink.id)

      // Salvar no localStorage
      localStorage.setItem(cachedConfigKey, JSON.stringify(data))

      // Usar configuração pré-definida pelo gestor
      if (data.roleplayLink?.config) {
        const config = data.roleplayLink.config
        setSelectedAge(config.age)
        setSelectedTemperament(config.temperament)
        setSelectedPersona(config.persona_id)
        setSelectedObjections(config.objection_ids || [])
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
          linkId: linkId, // Passar o ID do link para associar à sessão
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
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
        {/* Fundo espacial verde */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-green-950/60 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>

        <Loader2 className="w-12 h-12 text-green-400 animate-spin relative z-10" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center p-4">
        {/* Fundo espacial verde */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-green-950/60 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_50%)]"></div>

        <div className="bg-gray-900/60 backdrop-blur-md border border-green-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl shadow-green-900/50 relative z-10">
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
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center p-4">
        {/* Fundo espacial verde */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-green-950/60 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_50%)]"></div>

        <div className="bg-gray-900/60 backdrop-blur-md border border-green-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl shadow-green-900/50 relative z-10">
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
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center p-4">
        {/* Fundo espacial verde */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-green-950/60 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_50%)]"></div>

        <div className="bg-gray-900/60 backdrop-blur-md border border-green-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl shadow-green-900/50 relative z-10">
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
      <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center p-4">
        {/* Fundo espacial verde Ramppy */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-green-950/60 to-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-md rounded-3xl p-6 max-w-2xl w-full border border-green-500/30 shadow-2xl shadow-green-900/50 relative z-10">
          <div className="text-center mb-5">
            {/* Logo Ramppy */}
            <div className="w-80 h-80 mx-auto -mb-8 relative -mt-8">
              <Image
                src="/images/ramppy-logo.png"
                alt="Ramppy Logo"
                width={320}
                height={320}
                className="drop-shadow-[0_0_50px_rgba(34,197,94,0.8)]"
              />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Roleplay de Vendas - {companyConfig?.company.name}
            </h1>
            <p className="text-base text-gray-300">
              Pratique suas habilidades de vendas com nosso simulador inteligente
            </p>
          </div>

          <div className="space-y-5">
            {/* Informações do Roleplay Configurado */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-green-500/30 rounded-xl p-5">
              <h3 className="text-base font-semibold text-green-400 mb-3">
                Cenário do Roleplay
              </h3>
              <div className="space-y-2 text-base text-gray-200">
                <p>
                  <span className="text-gray-400">Cliente:</span>{' '}
                  {companyConfig.roleplayLink.config.age} anos, {companyConfig.roleplayLink.config.temperament.toLowerCase()}
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
              <label className="block text-base font-semibold text-gray-200 mb-2">
                Seu Nome
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-800/50 backdrop-blur-sm border border-green-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-500/60 focus:bg-gray-800/70 transition-all text-lg"
                placeholder="Digite seu nome para começar"
                autoFocus
              />
            </div>

            {/* Botão Iniciar */}
            <button
              onClick={startRoleplay}
              disabled={isProcessing || !participantName.trim()}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-bold text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 text-lg"
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
    <div className="min-h-screen relative overflow-hidden bg-black p-4">
      {/* Fundo espacial verde Ramppy */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-green-950/60 to-black"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="bg-gray-900/60 backdrop-blur-md rounded-3xl p-8 border border-green-500/30 shadow-2xl shadow-green-900/50">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">
              Roleplay em Andamento
            </h2>
            <p className="text-gray-300">
              Olá {participantName}, converse com o cliente virtual
            </p>
          </div>

          {/* Área de mensagens */}
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-6 min-h-[400px] max-h-[600px] overflow-y-auto mb-6 border border-green-500/20">
            {messages.length === 0 ? (
              <p className="text-gray-400 text-center">
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
                          ? 'bg-gradient-to-r from-green-600 to-green-500 border border-green-400/30 shadow-lg shadow-green-500/20'
                          : 'bg-gray-800/60 border border-green-500/30'
                      }`}
                    >
                      <p className={`text-xs font-semibold mb-1 ${msg.role === 'seller' ? 'text-white/90' : 'text-green-400'}`}>
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
                className="p-4 bg-gradient-to-r from-green-600 to-green-500 hover:scale-110 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 shadow-xl shadow-green-500/50"
              >
                <Mic className="w-6 h-6 text-white" />
                {isProcessing && <Loader2 className="w-5 h-5 text-white animate-spin" />}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-6 py-4 bg-red-500 hover:bg-red-600 rounded-full transition-all animate-pulse flex items-center gap-2 shadow-xl shadow-red-500/50"
              >
                <Square className="w-6 h-6 text-white" />
                <span className="text-white font-bold">Finalizar Fala</span>
              </button>
            )}

            <button
              onClick={endRoleplay}
              disabled={isProcessing}
              className="px-6 py-3 bg-gray-800/50 hover:bg-gray-800/70 backdrop-blur-sm border border-green-500/30 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Finalizar Roleplay
            </button>
          </div>

          {/* Indicadores de estado */}
          {isPlayingAudio && (
            <div className="text-center mt-4">
              <p className="text-green-400 font-semibold animate-pulse">
                🔊 Cliente está falando...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}