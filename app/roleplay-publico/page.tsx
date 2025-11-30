'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Mic, MicOff, Users, Loader2, CheckCircle, AlertCircle, Square, X } from 'lucide-react'
import Image from 'next/image'

// Keyframes CSS globais para animação das estrelas
const globalStyles = `
  @keyframes twinkle {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
  @keyframes float {
    from {
      transform: translateY(0px) translateX(0px);
    }
    to {
      transform: translateY(-150vh) translateX(var(--float-x));
    }
  }

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(31, 41, 55, 0.5);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(34, 197, 94, 0.5);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(34, 197, 94, 0.7);
  }
`

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

  // Gerar estrelas uma única vez (memoizado para evitar re-render)
  const stars = useMemo(() => {
    return [...Array(100)].map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      opacity: Math.random() * 0.7 + 0.3,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 5,
      floatX: (Math.random() > 0.5 ? 1 : -1) * Math.random() * 100,
      twinkleDuration: Math.random() * 2 + 1,
      twinkleDelay: Math.random() * 3
    }))
  }, [])

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
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<any>(null)
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)

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

      // IMPORTANTE: SEMPRE buscar do servidor para garantir dados atualizados
      // (Desabilitado cache temporariamente para debug)
      const cachedConfigKey = `roleplay_config_${linkCode}`

      // Limpar cache antigo
      localStorage.removeItem(cachedConfigKey)

      console.log('🌐 Buscando configuração do servidor (cache desabilitado)')

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
    console.log('🛑 Finalizando roleplay...')
    console.log('📋 Session ID:', sessionId)

    if (!sessionId) {
      console.error('❌ Session ID não encontrado!')
      alert('Erro: Sessão não encontrada')
      return
    }

    // Prevenir cliques múltiplos
    if (isEvaluating) {
      console.log('⚠️ Avaliação já está em andamento')
      return
    }

    setIsEvaluating(true)

    try {
      console.log('📤 Enviando requisição para /api/public/roleplay/end')
      const response = await fetch('/api/public/roleplay/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      console.log('📥 Resposta recebida:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Erro na resposta:', errorData)
        throw new Error(errorData.error || 'Erro ao finalizar roleplay')
      }

      const data = await response.json()
      console.log('✅ Dados recebidos:', data)

      const { evaluation } = data

      // Parse evaluation se necessário
      let parsedEvaluation = evaluation
      if (parsedEvaluation && typeof parsedEvaluation === 'object' && 'output' in parsedEvaluation) {
        console.log('🔄 Parseando evaluation.output...')
        try {
          parsedEvaluation = JSON.parse(parsedEvaluation.output)
        } catch (e) {
          console.error('❌ Erro ao fazer parse da avaliação:', e)
        }
      }

      console.log('📊 Evaluation final:', parsedEvaluation)
      setEvaluation(parsedEvaluation)
      setShowEvaluationModal(true)
      console.log('✅ Modal de avaliação deve aparecer agora')
    } catch (error) {
      console.error('❌ Erro ao finalizar roleplay:', error)
      alert('Erro ao finalizar roleplay: ' + (error as Error).message)
    } finally {
      setIsEvaluating(false)
    }
  }

  const closeEvaluationAndReset = () => {
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

    setIsProcessing(true)
    try {
      const requestData = {
        participantName,
        companyId: companyConfig?.company.id,
        linkId: linkId, // Passar o ID do link para associar à sessão
        config: {
          age: selectedAge,
          temperament: selectedTemperament,
          personaId: selectedPersona,
          objectionIds: selectedObjections
        }
      }

      console.log('🚀 Iniciando roleplay com dados:', requestData)

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

      // Se tiver primeira mensagem do cliente, adicionar ao chat e reproduzir áudio
      if (data.firstMessage) {
        setMessages([{ role: 'client', text: data.firstMessage }])

        // Reproduzir áudio da primeira mensagem
        await playAudioResponse(data.firstMessage)
      }

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
      <>
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center">
          {/* Fundo preto */}
          <div className="absolute inset-0 bg-black"></div>

          {/* Estrelas */}
          <div className="absolute inset-0 overflow-hidden">
            {stars.map((star) => (
              <div
                key={star.id}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  top: `${star.top}%`,
                  left: `${star.left}%`,
                  opacity: star.opacity,
                  ['--float-x' as any]: `${star.floatX}px`,
                  animation: `twinkle ${star.twinkleDuration}s ease-in-out ${star.twinkleDelay}s infinite, float ${star.duration}s linear ${star.delay}s infinite`
                }}
              />
            ))}
          </div>

          <Loader2 className="w-12 h-12 text-green-400 animate-spin relative z-10" />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center p-4">
          {/* Fundo preto */}
          <div className="absolute inset-0 bg-black"></div>

          {/* Estrelas */}
          <div className="absolute inset-0 overflow-hidden">
            {stars.map((star) => (
              <div
                key={star.id}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  top: `${star.top}%`,
                  left: `${star.left}%`,
                  opacity: star.opacity,
                  ['--float-x' as any]: `${star.floatX}px`,
                  animation: `twinkle ${star.twinkleDuration}s ease-in-out ${star.twinkleDelay}s infinite, float ${star.duration}s linear ${star.delay}s infinite`
                }}
              />
            ))}
          </div>

          <div className="bg-gray-900/60 backdrop-blur-md border border-green-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl shadow-green-900/50 relative z-10">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4 mx-auto" />
            <h2 className="text-xl font-bold text-white text-center mb-2">Erro</h2>
            <p className="text-gray-300 text-center">{error}</p>
          </div>
        </div>
      </>
    )
  }

  // Verificar se o roleplay está ativo
  if (!companyConfig?.roleplayLink?.is_active) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center p-4">
          {/* Fundo preto */}
          <div className="absolute inset-0 bg-black"></div>

          {/* Estrelas */}
          <div className="absolute inset-0 overflow-hidden">
            {stars.map((star) => (
              <div
                key={star.id}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  top: `${star.top}%`,
                  left: `${star.left}%`,
                  opacity: star.opacity,
                  ['--float-x' as any]: `${star.floatX}px`,
                  animation: `twinkle ${star.twinkleDuration}s ease-in-out ${star.twinkleDelay}s infinite, float ${star.duration}s linear ${star.delay}s infinite`
                }}
              />
            ))}
          </div>

          <div className="bg-gray-900/60 backdrop-blur-md border border-green-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl shadow-green-900/50 relative z-10">
            <AlertCircle className="w-12 h-12 text-yellow-400 mb-4 mx-auto" />
            <h2 className="text-xl font-bold text-white text-center mb-2">Roleplay Desativado</h2>
            <p className="text-gray-300 text-center">
              O roleplay público desta empresa está temporariamente desativado.
            </p>
          </div>
        </div>
      </>
    )
  }

  // Verificar se a configuração está completa
  if (!companyConfig?.roleplayLink?.config?.persona_id ||
      !companyConfig?.roleplayLink?.config?.objection_ids?.length) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center p-4">
          {/* Fundo preto */}
          <div className="absolute inset-0 bg-black"></div>

          {/* Estrelas */}
          <div className="absolute inset-0 overflow-hidden">
            {stars.map((star) => (
              <div
                key={star.id}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  top: `${star.top}%`,
                  left: `${star.left}%`,
                  opacity: star.opacity,
                  ['--float-x' as any]: `${star.floatX}px`,
                  animation: `twinkle ${star.twinkleDuration}s ease-in-out ${star.twinkleDelay}s infinite, float ${star.duration}s linear ${star.delay}s infinite`
                }}
              />
            ))}
          </div>

          <div className="bg-gray-900/60 backdrop-blur-md border border-green-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl shadow-green-900/50 relative z-10">
            <AlertCircle className="w-12 h-12 text-yellow-400 mb-4 mx-auto" />
            <h2 className="text-xl font-bold text-white text-center mb-2">Configuração Incompleta</h2>
            <p className="text-gray-300 text-center">
              O roleplay ainda não foi configurado pelo administrador.
            </p>
          </div>
        </div>
      </>
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
      <>
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <div className="min-h-screen relative overflow-hidden bg-black flex items-center justify-center p-4">
          {/* Fundo preto */}
          <div className="absolute inset-0 bg-black"></div>

          {/* Estrelas animadas */}
          <div className="absolute inset-0 overflow-hidden">
            {stars.map((star) => (
              <div
                key={star.id}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  top: `${star.top}%`,
                  left: `${star.left}%`,
                  opacity: star.opacity,
                  ['--float-x' as any]: `${star.floatX}px`,
                  animation: `twinkle ${star.twinkleDuration}s ease-in-out ${star.twinkleDelay}s infinite, float ${star.duration}s linear ${star.delay}s infinite`
                }}
              />
            ))}
          </div>


        <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-5 max-w-lg w-full border border-green-500/30 shadow-2xl shadow-green-900/50 relative z-10">
          <div className="text-center mb-4">
            {/* Logo Ramppy */}
            <div className="w-52 h-52 mx-auto -mb-4 relative">
              <Image
                src="/images/ramppy-logo.png"
                alt="Ramppy Logo"
                width={208}
                height={208}
                className="drop-shadow-[0_0_50px_rgba(34,197,94,0.9)]"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              Roleplay de Vendas - <span className="text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]">{companyConfig?.company.name}</span>
            </h1>
            <p className="text-sm text-gray-300">
              Pratique suas habilidades de vendas com nosso simulador inteligente
            </p>
          </div>

          <div className="space-y-4">
            {/* Informações do Roleplay Configurado */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-green-500/30 rounded-xl p-4 max-h-[180px] overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-semibold text-green-400 mb-2">
                Cenário do Roleplay
              </h3>
              <div className="space-y-2 text-sm text-gray-200">
                {/* Cliente (Idade + Temperamento) */}
                <div>
                  <p className="text-gray-400 font-semibold mb-1">Cliente:</p>
                  <p className="text-green-400 font-semibold">
                    {companyConfig.roleplayLink.config.age} anos, {companyConfig.roleplayLink.config.temperament.toLowerCase()}
                  </p>
                </div>

                {/* Persona */}
                <div>
                  <p className="text-gray-400 font-semibold mb-1">Persona:</p>
                  <p className="text-green-400 font-semibold">
                    {selectedPersonaData ? (
                      selectedPersonaData.job_title ||
                      selectedPersonaData.cargo ||
                      selectedPersonaData.profession ||
                      selectedPersonaData.profissao ||
                      'Cliente'
                    ) : (
                      <span className="text-yellow-400 text-xs">Não configurada</span>
                    )}
                  </p>
                </div>

                {/* Objeções */}
                {selectedObjectionsData && selectedObjectionsData.length > 0 && (
                  <div>
                    <p className="text-gray-400 font-semibold mb-1">Objeções ({selectedObjectionsData.length}):</p>
                    <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                      {selectedObjectionsData.map((objection: any, index: number) => (
                        <div key={index} className="text-xs">
                          <p className="text-green-400 font-semibold">{index + 1}. {objection.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-1.5">
                Seu Nome
              </label>
              <input
                type="text"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-sm border border-green-500/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-500/60 focus:bg-gray-800/70 transition-all"
                placeholder="Digite seu nome para começar"
                autoFocus
              />
            </div>

            {/* Botão Iniciar */}
            <button
              onClick={startRoleplay}
              disabled={isProcessing || !participantName.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-bold text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
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
      </>
    )
  }

  // Interface de Roleplay
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div className="min-h-screen relative overflow-hidden bg-black p-4">
        {/* Fundo preto */}
        <div className="absolute inset-0 bg-black"></div>

        {/* Estrelas animadas */}
        <div className="absolute inset-0 overflow-hidden">
          {stars.map((star) => (
            <div
              key={star.id}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                top: `${star.top}%`,
                left: `${star.left}%`,
                opacity: star.opacity,
                ['--float-x' as any]: `${star.floatX}px`,
                animation: `twinkle ${star.twinkleDuration}s ease-in-out ${star.twinkleDelay}s infinite, float ${star.duration}s linear ${star.delay}s infinite`
              }}
            />
          ))}
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
              disabled={isProcessing || isEvaluating}
              className="px-6 py-3 bg-gray-800/50 hover:bg-gray-800/70 backdrop-blur-sm border border-green-500/30 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Avaliando...
                </>
              ) : (
                'Finalizar Roleplay'
              )}
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

        {/* Modal de Avaliação */}
        {showEvaluationModal && evaluation && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] overflow-hidden flex items-center justify-center p-4">
            <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto">
              {/* Close Button */}
              <button
                onClick={closeEvaluationAndReset}
                className="absolute -top-4 -right-4 z-10 w-10 h-10 bg-gray-800/90 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors border border-green-500/30"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              {/* Header */}
              <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-t-3xl border-t border-x border-green-500/30 p-5">
                <h2 className="text-2xl font-bold text-center text-white mb-4">🎯 RESULTADO DA AVALIAÇÃO</h2>

                {/* Score Geral */}
                <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20">
                  <div className="text-center">
                    <div className="text-5xl font-bold text-green-400 mb-2">
                      {((evaluation.overall_score || 0) / 10).toFixed(1)}/10
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-b-3xl border-b border-x border-green-500/30 p-5 space-y-4">
                {/* Resumo Executivo */}
                {evaluation.executive_summary && (
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20">
                    <h3 className="text-base font-bold text-green-400 mb-2">📋 Resumo Executivo</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">{evaluation.executive_summary}</p>
                  </div>
                )}

                {/* SPIN Scores */}
                {evaluation.spin_evaluation && (
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20">
                    <h3 className="text-base font-bold text-green-400 mb-3">📊 Métricas SPIN</h3>
                    <div className="grid grid-cols-4 gap-3">
                      {['S', 'P', 'I', 'N'].map((key) => (
                        <div key={key} className="text-center bg-gray-900/50 rounded-lg p-3 border border-green-500/10">
                          <div className="text-xs text-gray-400 mb-1">{key}</div>
                          <div className="text-2xl font-bold text-white">
                            {evaluation.spin_evaluation[key]?.final_score?.toFixed(1) || '0.0'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pontos Fortes */}
                {evaluation.top_strengths && evaluation.top_strengths.length > 0 && (
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-green-500/20">
                    <h3 className="text-base font-bold text-green-400 mb-2">✅ Pontos Fortes</h3>
                    <ul className="space-y-2">
                      {evaluation.top_strengths.map((strength: string, index: number) => (
                        <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">•</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Gaps Críticos */}
                {evaluation.critical_gaps && evaluation.critical_gaps.length > 0 && (
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-red-500/20">
                    <h3 className="text-base font-bold text-red-400 mb-2">⚠️ Gaps Críticos</h3>
                    <ul className="space-y-2">
                      {evaluation.critical_gaps.map((gap: string, index: number) => (
                        <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                          <span className="text-red-400 mt-0.5">•</span>
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Melhorias Prioritárias */}
                {evaluation.priority_improvements && evaluation.priority_improvements.length > 0 && (
                  <div className="bg-gray-800/40 rounded-xl p-4 border border-yellow-500/20">
                    <h3 className="text-base font-bold text-yellow-400 mb-3">🎯 Melhorias Prioritárias</h3>
                    <div className="space-y-3">
                      {evaluation.priority_improvements.map((improvement: any, index: number) => (
                        <div key={index} className="bg-gray-900/50 rounded-lg p-3 border border-yellow-500/10">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs uppercase font-bold text-yellow-400">
                              {improvement.priority}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-300">{improvement.area}</span>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{improvement.current_gap}</p>
                          <p className="text-sm text-gray-300">{improvement.action_plan}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botão Fechar */}
                <button
                  onClick={closeEvaluationAndReset}
                  className="w-full py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-bold text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/50 transition-all"
                >
                  Fechar e Voltar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}