'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Users, Loader2, CheckCircle, AlertCircle, Square, X, User, FileText, Lightbulb, AlertTriangle, Video, VideoOff, UserCircle2, Volume2 } from 'lucide-react'
import Image from 'next/image'
import { processWhisperTranscription } from '@/lib/utils/whisperValidation'
import { generateAvatarWithAI, generateAvatarUrl, preloadImage, type PersonaBase } from '@/lib/utils/generateAvatar'

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
      objective_id: string | null
    }
  }
  personas: any[]
  objections: any[]
  objectives: any[]
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
  const [selectedObjective, setSelectedObjective] = useState('')
  const [linkId, setLinkId] = useState<string | null>(null)

  // Sessão de roleplay
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<any>(null)
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)
  const [showAutoFinalizingMessage, setShowAutoFinalizingMessage] = useState(false)

  // Referências para áudio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Webcam states and refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)

  // Avatar states
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false)

  useEffect(() => {
    loadCompanyConfig()
  }, [])

  // Connect webcam stream to video element
  useEffect(() => {
    if (isCameraOn && webcamStream && videoRef.current) {
      videoRef.current.srcObject = webcamStream
    }
  }, [isCameraOn, webcamStream, sessionStarted])

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [webcamStream])

  // Generate avatar when session starts
  useEffect(() => {
    if (!sessionStarted || !companyConfig || avatarUrl) return

    const selectedPersonaData = companyConfig.personas.find(
      p => p.id === companyConfig.roleplayLink.config.persona_id
    )
    if (!selectedPersonaData) return

    const generateAvatar = async () => {
      setIsLoadingAvatar(true)
      try {
        const persona: PersonaBase = {
          id: selectedPersonaData.id,
          business_type: selectedPersonaData.business_type || 'B2C',
          job_title: selectedPersonaData.job_title,
          cargo: selectedPersonaData.cargo,
          profession: selectedPersonaData.profession,
          profissao: selectedPersonaData.profissao,
        }

        const ageString = companyConfig.roleplayLink.config.age || '30-40'
        const [minAge, maxAge] = ageString.split('-').map(Number)
        const age = Math.floor((minAge + maxAge) / 2) || 35
        const temperament = companyConfig.roleplayLink.config.temperament || 'Neutro'

        const aiUrl = await generateAvatarWithAI(persona, age, temperament)
        if (aiUrl) {
          setAvatarUrl(aiUrl)
        } else {
          const fallbackUrl = generateAvatarUrl(persona, age, temperament)
          await preloadImage(fallbackUrl)
          setAvatarUrl(fallbackUrl)
        }
      } catch (error) {
        console.error('Error generating avatar:', error)
        setAvatarUrl(null)
      } finally {
        setIsLoadingAvatar(false)
      }
    }

    generateAvatar()
  }, [sessionStarted, companyConfig, avatarUrl])

  const loadCompanyConfig = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const linkCode = urlParams.get('link')

      if (!linkCode) {
        throw new Error('Link de roleplay não fornecido na URL')
      }

      const cachedConfigKey = `roleplay_config_${linkCode}`
      localStorage.removeItem(cachedConfigKey)

      const response = await fetch(`/api/public/roleplay/config?link=${linkCode}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao carregar configuração')
      }

      const data = await response.json()
      setCompanyConfig(data)
      setLinkId(data.roleplayLink.id)
      localStorage.setItem(cachedConfigKey, JSON.stringify(data))

      if (data.roleplayLink?.config) {
        const config = data.roleplayLink.config
        setSelectedAge(config.age)
        setSelectedTemperament(config.temperament)
        setSelectedPersona(config.persona_id)
        setSelectedObjections(config.objection_ids || [])
        setSelectedObjective(config.objective_id || (data.objectives?.length > 0 ? data.objectives[0].id : ''))
      } else if (data.objectives?.length > 0) {
        setSelectedObjective(data.objectives[0].id)
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

      const transcriptionData = await transcribeResponse.json()
      const processed = processWhisperTranscription(transcriptionData.text)

      if (!processed.isValid) {
        setError('Não consegui entender. Por favor, fale novamente de forma mais clara.')
        return
      }

      setMessages(prev => [...prev, { role: 'seller', text: processed.text }])

      const chatResponse = await fetch('/api/public/roleplay/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          threadId,
          message: processed.text
        })
      })

      if (!chatResponse.ok) {
        throw new Error('Erro ao processar mensagem')
      }

      const { response, messages: updatedMessages } = await chatResponse.json()
      setMessages(updatedMessages)

      const isFinalizationMessage = response.includes('Roleplay finalizado, aperte em finalizar sessão')
      await playAudioResponse(response)

      if (isFinalizationMessage) {
        setShowAutoFinalizingMessage(true)
        setTimeout(() => {
          endRoleplay()
        }, 2000)
      }
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

  // Webcam management functions
  const startWebcam = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
      setWebcamStream(mediaStream)
      setIsCameraOn(true)
    } catch (err) {
      console.error('Erro ao acessar camera:', err)
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

  const endRoleplay = async () => {
    if (!sessionId) {
      alert('Erro: Sessão não encontrada')
      return
    }

    if (isEvaluating) return

    setIsEvaluating(true)

    try {
      const response = await fetch('/api/public/roleplay/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao finalizar roleplay')
      }

      const data = await response.json()
      const { evaluation } = data

      let parsedEvaluation = evaluation
      if (parsedEvaluation && typeof parsedEvaluation === 'object' && 'output' in parsedEvaluation) {
        try {
          parsedEvaluation = JSON.parse(parsedEvaluation.output)
        } catch (e) {
          console.error('Erro ao fazer parse da avaliação:', e)
        }
      }

      setEvaluation(parsedEvaluation)
      setShowAutoFinalizingMessage(false)
      setShowEvaluationModal(true)
    } catch (error) {
      console.error('Erro ao finalizar roleplay:', error)
      alert('Erro ao finalizar roleplay: ' + (error as Error).message)
      setShowAutoFinalizingMessage(false)
    } finally {
      setIsEvaluating(false)
    }
  }

  const closeEvaluationAndReset = () => {
    // Stop webcam and cleanup
    stopWebcam()
    setAvatarUrl(null)

    // Reset session state
    setShowEvaluationModal(false)
    setEvaluation(null)
    setSessionStarted(false)
    setSessionId(null)
    setThreadId(null)
    setMessages([])
    setParticipantName('')
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

    if (!selectedObjective) {
      alert('Por favor, selecione um objetivo para o roleplay')
      return
    }

    setIsProcessing(true)
    try {
      // Start webcam immediately
      await startWebcam()

      const requestData = {
        participantName,
        companyId: companyConfig?.company.id,
        linkId: linkId,
        config: {
          age: selectedAge,
          temperament: selectedTemperament,
          personaId: selectedPersona,
          objectionIds: selectedObjections,
          objectiveId: selectedObjective
        }
      }

      const response = await fetch('/api/public/roleplay/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error('Erro ao iniciar roleplay')
      }

      const data = await response.json()
      setSessionId(data.sessionId)
      setThreadId(data.threadId)

      if (data.firstMessage) {
        setMessages([{ role: 'client', text: data.firstMessage }])
        await playAudioResponse(data.firstMessage)
      }

      setSessionStarted(true)
    } catch (error) {
      // If session start fails, stop webcam
      stopWebcam()
      console.error('Erro ao iniciar roleplay:', error)
      alert('Erro ao iniciar roleplay')
    } finally {
      setIsProcessing(false)
    }
  }

  // Helper function for score colors
  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-green-600'
    if (score >= 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 7) return 'bg-green-50 border-green-200'
    if (score >= 5) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-gray-200 border-t-green-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 border border-red-200 max-w-md w-full shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Erro</h2>
          <p className="text-gray-600 text-center">{error}</p>
        </div>
      </div>
    )
  }

  // Inactive State
  if (!companyConfig?.roleplayLink?.is_active) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 border border-yellow-200 max-w-md w-full shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Simulação Desativada</h2>
          <p className="text-gray-600 text-center">
            O roleplay público desta empresa está temporariamente desativado.
          </p>
        </div>
      </div>
    )
  }

  // Incomplete Config State
  if (!companyConfig?.roleplayLink?.config?.persona_id ||
      !companyConfig?.roleplayLink?.config?.objection_ids?.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 border border-yellow-200 max-w-md w-full shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-yellow-50 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Configuração Incompleta</h2>
          <p className="text-gray-600 text-center">
            O roleplay ainda não foi configurado pelo administrador.
          </p>
        </div>
      </div>
    )
  }

  // Pre-Session Screen
  if (!sessionStarted) {
    const selectedPersonaData = companyConfig?.personas.find(
      p => p.id === companyConfig.roleplayLink.config.persona_id
    )
    const selectedObjectionsData = companyConfig?.objections.filter(
      o => companyConfig.roleplayLink.config.objection_ids.includes(o.id)
    )
    const selectedObjectiveData = companyConfig?.objectives?.find(
      o => o.id === (companyConfig.roleplayLink.config.objective_id || selectedObjective)
    )

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-gray-200 shadow-xl">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-[440px] h-[160px]">
              <Image
                src="/images/logo-preta.png"
                alt="Ramppy Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Simulação de Vendas
            </h1>
            <p className="text-gray-500 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              {companyConfig?.company.name}
            </p>
          </div>

          <div className="space-y-5">
            {/* Scenario Box */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-[220px] overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-6 h-6 bg-green-50 rounded-lg flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-green-600" />
                </div>
                Cenário da Simulação
              </h3>

              <div className="space-y-3 text-sm">
                {/* Client */}
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 font-medium min-w-[70px]">Cliente:</span>
                  <span className="text-gray-900 font-semibold">
                    {companyConfig.roleplayLink.config.age} anos, {companyConfig.roleplayLink.config.temperament.toLowerCase()}
                  </span>
                </div>

                {/* Persona */}
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 font-medium min-w-[70px]">Persona:</span>
                  <span className="text-gray-900 font-semibold">
                    {selectedPersonaData ? (
                      selectedPersonaData.job_title ||
                      selectedPersonaData.cargo ||
                      selectedPersonaData.profession ||
                      selectedPersonaData.profissao ||
                      'Cliente'
                    ) : (
                      <span className="text-yellow-600 text-xs">Não configurada</span>
                    )}
                  </span>
                </div>

                {/* Objections */}
                {selectedObjectionsData && selectedObjectionsData.length > 0 && (
                  <div>
                    <p className="text-gray-500 font-medium mb-2">Objeções ({selectedObjectionsData.length}):</p>
                    <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-1.5">
                      {selectedObjectionsData.map((objection: any, index: number) => (
                        <div key={index} className="text-xs flex items-start gap-2">
                          <span className="text-green-600 font-bold">{index + 1}.</span>
                          <span className="text-gray-700">{objection.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Objective */}
                {selectedObjectiveData && (
                  <div>
                    <p className="text-gray-500 font-medium mb-2 flex items-center gap-1.5">
                      <span className="w-4 h-4 bg-green-50 rounded flex items-center justify-center">
                        <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                      </span>
                      Objetivo:
                    </p>
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                      <p className="text-green-800 font-semibold text-sm">
                        {selectedObjectiveData.name}
                      </p>
                      {selectedObjectiveData.description && (
                        <p className="text-green-700 text-xs mt-1.5 leading-relaxed">
                          {selectedObjectiveData.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seu Nome Completo
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-green-600" />
                </div>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  className="w-full pl-16 pr-4 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                  placeholder="Digite seu nome completo para começar"
                  autoFocus
                />
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={startRoleplay}
              disabled={isProcessing || !participantName.trim()}
              className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Iniciar Simulação
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Active Roleplay Interface - Video Call Style
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Simulação em Andamento</h2>
              <p className="text-gray-500 text-sm">Olá {participantName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Conectado</span>
          </div>
        </div>
      </div>

      {/* Video Panels Area */}
      <div className="flex-1 flex items-center justify-center gap-6 p-6">
        {/* Client Avatar Panel */}
        <div className="flex-1 max-w-[600px] aspect-video bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden relative">
          {isLoadingAvatar ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
              <Loader2 className="w-16 h-16 text-green-500 animate-spin mb-4" />
              <span className="text-gray-600 text-sm font-medium">Gerando avatar com IA...</span>
              <span className="text-gray-400 text-xs mt-1">Aguarde ~10 segundos</span>
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

          {/* Speaking Indicator */}
          {isPlayingAudio && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg">
              <Volume2 size={18} className="animate-pulse" />
              <span className="text-sm font-medium">Falando...</span>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && !isPlayingAudio && !isLoadingAvatar && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-gray-800/80 text-white px-4 py-2 rounded-full">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Processando...</span>
            </div>
          )}

          {/* Panel Label */}
          <div className="absolute top-4 left-4 bg-black/30 text-white px-3 py-1 rounded-lg text-xs font-medium">
            Cliente Virtual
          </div>
        </div>

        {/* User Webcam Panel */}
        <div className="flex-1 max-w-[600px] aspect-video bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden relative">
          {isCameraOn ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <UserCircle2 className="w-24 h-24 text-gray-300" />
            </div>
          )}

          {/* Recording Indicator */}
          {isRecording && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-medium">Gravando...</span>
            </div>
          )}

          {/* Panel Label */}
          <div className="absolute top-4 left-4 bg-black/30 text-white px-3 py-1 rounded-lg text-xs font-medium">
            Você
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
          {/* Camera Toggle */}
          <button
            onClick={toggleCamera}
            className={`p-4 rounded-full transition-all shadow-md ${
              isCameraOn
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200'
            }`}
            title={isCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
          >
            {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>

          {/* Microphone Button */}
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isProcessing || isPlayingAudio}
              className="p-5 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title="Iniciar gravação"
            >
              <Mic className="w-7 h-7" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all shadow-lg flex items-center gap-2"
            >
              <Square className="w-5 h-5" />
              <span className="font-medium">Finalizar Fala</span>
            </button>
          )}

        </div>

        {/* Status Messages */}
        {isPlayingAudio && (
          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-green-700 font-medium text-sm">Cliente está falando...</p>
            </div>
          </div>
        )}

        {showAutoFinalizingMessage && (
          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl">
              <Loader2 className="w-4 h-4 text-yellow-600 animate-spin" />
              <p className="text-yellow-700 font-medium text-sm">Finalizando simulação automaticamente...</p>
            </div>
          </div>
        )}
      </div>

      {/* Evaluation Modal */}
        {showEvaluationModal && evaluation && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200 relative">
                <button
                  onClick={closeEvaluationAndReset}
                  className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>

                <h2 className="text-xl font-bold text-gray-900 text-center mb-4">Resultado da Avaliação</h2>

                {/* Score */}
                <div className="flex justify-center">
                  <div className={`w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center ${getScoreBg((evaluation.overall_score || 0) / 10)}`}>
                    <span className={`text-3xl font-bold ${getScoreColor((evaluation.overall_score || 0) / 10)}`}>
                      {((evaluation.overall_score || 0) / 10).toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-500">/10</span>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {/* Executive Summary */}
                {evaluation.executive_summary && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      Resumo Executivo
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{evaluation.executive_summary}</p>
                  </div>
                )}

                {/* SPIN Metrics */}
                {evaluation.spin_evaluation && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Métricas SPIN</h3>
                    <div className="grid grid-cols-4 gap-3">
                      {['S', 'P', 'I', 'N'].map((key) => {
                        const score = evaluation.spin_evaluation[key]?.final_score || 0
                        return (
                          <div key={key} className={`text-center p-3 rounded-xl border ${getScoreBg(score)}`}>
                            <div className="text-xs font-medium text-gray-500 mb-1">{key}</div>
                            <div className={`text-xl font-bold ${getScoreColor(score)}`}>
                              {score.toFixed(1)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Strengths */}
                {evaluation.top_strengths && evaluation.top_strengths.length > 0 && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Pontos Fortes
                    </h3>
                    <ul className="space-y-2">
                      {evaluation.top_strengths.map((strength: string, index: number) => (
                        <li key={index} className="text-sm text-green-800 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Critical Gaps */}
                {evaluation.critical_gaps && evaluation.critical_gaps.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Gaps Críticos
                    </h3>
                    <ul className="space-y-2">
                      {evaluation.critical_gaps.map((gap: string, index: number) => (
                        <li key={index} className="text-sm text-red-800 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></span>
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Priority Improvements */}
                {evaluation.priority_improvements && evaluation.priority_improvements.length > 0 && (
                  <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                    <h3 className="text-sm font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Melhorias Prioritárias
                    </h3>
                    <div className="space-y-3">
                      {evaluation.priority_improvements.map((improvement: any, index: number) => (
                        <div key={index} className="bg-white rounded-lg p-3 border border-yellow-200">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                              {improvement.priority}
                            </span>
                            <span className="text-xs text-gray-500">{improvement.area}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{improvement.current_gap}</p>
                          <p className="text-sm text-gray-800">{improvement.action_plan}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Close Button */}
                <button
                  onClick={closeEvaluationAndReset}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-white transition-all"
                >
                  Fechar e Voltar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
