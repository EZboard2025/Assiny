'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Play, Clock, MessageCircle, Send, Calendar, User, Zap, Mic, MicOff, Volume2, UserCircle2, CheckCircle, Loader2, X, AlertCircle } from 'lucide-react'
import { getPersonas, getObjections, getCompanyType, type Persona, type PersonaB2B, type PersonaB2C, type Objection } from '@/lib/config'
import { createRoleplaySession, addMessageToSession, endRoleplaySession, type RoleplayMessage } from '@/lib/roleplay'

export default function RoleplayView() {
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
  const [threadId, setThreadId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTranscription, setCurrentTranscription] = useState<string>('') // Para mostrar transcrição em tempo real
  const [isProcessingTranscription, setIsProcessingTranscription] = useState(false) // Para mostrar que está processando
  const [lastUserMessage, setLastUserMessage] = useState<string>('') // Para destacar última mensagem do usuário
  const [sessionId, setSessionId] = useState<string | null>(null) // ID da sessão no Supabase
  const [isEvaluating, setIsEvaluating] = useState(false) // Loading durante avaliação
  const [showEvaluationSummary, setShowEvaluationSummary] = useState(false) // Modal de resumo
  const [evaluation, setEvaluation] = useState<any>(null) // Avaliação recebida

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
      // Buscar persona selecionada
      const selectedPersonaData = personas.find(p => p.id === selectedPersona)
      const selectedObjectionsData = objections.filter(o => selectedObjections.includes(o.id))

      // Montar descrição da persona baseado no tipo
      let personaDescription = ''
      if (selectedPersonaData) {
        if (selectedPersonaData.business_type === 'B2B') {
          const persona = selectedPersonaData as PersonaB2B
          personaDescription = `${persona.job_title}`
          if (persona.company_type) personaDescription += ` de ${persona.company_type}`
        } else {
          const persona = selectedPersonaData as PersonaB2C
          personaDescription = persona.profession
        }
      }

      // Criar nova thread com configuração
      const response = await fetch('/api/roleplay/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            age,
            temperament,
            segment: personaDescription || 'Não especificado',
            objections: selectedObjectionsData.map(o => o.name),
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Erro da API:', data)
        throw new Error(data.error || 'Erro ao iniciar roleplay')
      }

      setThreadId(data.threadId)

      // Criar sessão no Supabase
      const session = await createRoleplaySession(data.threadId, {
        age,
        temperament,
        segment: personaDescription || 'Não especificado',
        objections: selectedObjectionsData.map(o => o.name),
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

      // Salvar mensagem no Supabase
      if (session) {
        await addMessageToSession(session.id, firstMessage)
      }

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

  const handleSendMessage = async (messageToSend?: string) => {
    console.log('🔍 handleSendMessage chamada com:', messageToSend)
    console.log('🔍 inputMessage atual:', inputMessage)
    console.log('🔍 isLoading:', isLoading)
    console.log('🔍 threadId:', threadId)
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

    if (!threadId) {
      console.log('❌ Sem threadId, não enviando')
      return
    }

    if (isLoading) {
      console.log('⚠️ Já está carregando, não enviando')
      return
    }

    const userMessage = message
    console.log('📤 Enviando mensagem:', userMessage)
    setInputMessage('')

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
      // Enviar para API
      const response = await fetch('/api/roleplay/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          message: userMessage,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao enviar mensagem')
      }

      const data = await response.json()
      console.log('✅ Resposta do cliente recebida:', data.message)

      // Adicionar resposta do cliente
      setMessages(prev => [...prev, { role: 'client', text: data.message }])

      // Salvar mensagem do cliente no Supabase
      if (sessionId) {
        const clientMessage: RoleplayMessage = {
          role: 'client',
          text: data.message,
          timestamp: new Date().toISOString()
        }
        await addMessageToSession(sessionId, clientMessage)
      }

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

      // Criar analisador de áudio para detectar silêncio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      microphone.connect(analyser)

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      let isCheckingRef = { current: true }
      let hasSpoken = false  // Flag para saber se o usuário já falou algo
      let volumeHistory: number[] = []  // Histórico de volumes para análise
      let consecutiveLowVolume = 0  // Contador de frames consecutivos com volume baixo
      let consecutiveHighVolume = 0  // Contador de frames consecutivos com volume alto

      // Detectar silêncio
      const checkSilence = () => {
        if (!isCheckingRef.current) {
          console.log('⏹️ Checagem de silêncio parada')
          return
        }

        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

        // Manter histórico dos últimos 20 volumes para análise mais precisa
        volumeHistory.push(average)
        if (volumeHistory.length > 20) volumeHistory.shift()

        // Log do volume para debug (apenas a cada 60 frames = ~1 segundo)
        if (Math.random() < 0.016) {
          console.log('🎤 Volume médio:', average.toFixed(2), '| Histórico:', volumeHistory.map(v => v.toFixed(0)).join(','))
        }

        // NOVO: Detectar fala real (não ruído) - precisa de volume consistente
        if (average > 35) {  // Aumentado threshold para detectar fala real
          consecutiveHighVolume++
          consecutiveLowVolume = 0  // Reset contador de silêncio

          // Só considera como fala após 5 frames consecutivos com volume alto (evita ruídos pontuais)
          if (consecutiveHighVolume >= 5 && !hasSpoken) {
            hasSpoken = true
            console.log('🗣️ Fala real detectada! Volume consistente acima de 35')
          }
        } else if (average < 20) {  // Threshold para silêncio
          consecutiveLowVolume++
          consecutiveHighVolume = 0  // Reset contador de fala
        } else {
          // Volume médio - reset ambos contadores
          consecutiveLowVolume = 0
          consecutiveHighVolume = 0
        }

        // NOVO: Só detecta fim da fala se teve volume baixo consistente
        // Precisa de 30 frames consecutivos de silêncio (cerca de 0.5 segundos)
        if (consecutiveLowVolume >= 30 && hasSpoken) {
          if (!silenceTimerRef.current) {
            console.log('🤫 Silêncio consistente detectado, iniciando timer de 1s...')
            // Timer de 1 segundo após detectar silêncio consistente
            silenceTimerRef.current = setTimeout(() => {
              console.log('🔇 Finalizando gravação após silêncio prolongado')
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                console.log('📝 Chamando stopRecording()...')
                stopRecording()
              } else {
                console.log('⚠️ MediaRecorder não está gravando')
              }
            }, 1000)  // Reduzido para 1 segundo
          }
        } else if (average > 25) {  // Se detectar qualquer som significativo, cancelar timer
          // Cancelar o timer se detectar som
          if (silenceTimerRef.current) {
            console.log('🔊 Som detectado, cancelando timer de silêncio')
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }
        }

        // Continuar checando
        if (isCheckingRef.current) {
          requestAnimationFrame(checkSilence)
        }
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log('🛑 MediaRecorder.onstop disparado!')
        console.log('🛑 Chunks de áudio capturados:', audioChunksRef.current.length)
        isCheckingRef.current = false

        // Garantir que o indicador seja removido imediatamente
        setIsRecording(false)

        if (audioChunksRef.current.length === 0) {
          console.log('⚠️ Nenhum chunk de áudio capturado!')
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        console.log('📦 Blob de áudio criado, tamanho:', audioBlob.size, 'bytes')

        // Fechar stream e contexto de áudio
        stream.getTracks().forEach(track => {
          track.stop()
          console.log('🔇 Track parada:', track.label)
        })
        audioContext.close()
        console.log('🔇 AudioContext fechado')

        // Limpar referências
        mediaRecorderRef.current = null
        streamRef.current = null

        // Transcrever o áudio
        console.log('📝 Enviando para transcrição...')
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)

      // Iniciar detecção de silêncio
      checkSilence()

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

      // Quando o áudio terminar, apenas liberar para o usuário falar
      audio.onended = () => {
        setIsPlayingAudio(false)
        URL.revokeObjectURL(audioUrl)
        console.log('🔊 Áudio do cliente finalizado - aguardando usuário clicar no microfone')
      }

      // Tocar o áudio
      await audio.play()
      console.log('🔊 Áudio tocando')
    } catch (error) {
      console.error('❌ Erro ao converter texto em áudio:', error)
      setIsPlayingAudio(false)
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
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent rounded-3xl blur-xl"></div>
            <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30">
              <div className="flex flex-wrap items-center justify-center gap-6 mb-6">
                {/* Tempo Limite */}
                <div className="flex items-center gap-2 text-gray-300">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <span className="text-sm">Tempo limite:</span>
                  <span className="text-green-400 font-semibold">10 minutos restantes</span>
                </div>

                {/* Modo */}
                <div className="flex items-center gap-2 text-gray-300">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <span className="text-sm">Modo: {isSimulating ? 'Simulação Ativa' : 'Simulação IA Ativa'}</span>
                </div>

                {/* Data */}
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <span className="text-sm">2024-10-26, 14:30</span>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                {!isSimulating ? (
                  <button
                    onClick={() => setShowConfig(true)}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-500 rounded-2xl font-semibold text-lg flex items-center gap-3 hover:scale-105 transition-transform glow-purple"
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
                            console.log('✅ Resposta completa:', result);
                            const { evaluation } = result;
                            console.log('✅ Avaliação recebida!', evaluation);
                            setEvaluation(evaluation);
                            setShowEvaluationSummary(true);
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
                      setThreadId(null);
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
            </div>
          </div>
        </div>

        {/* Main Chat Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Purple Blob Illustration */}
          <div className={`${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '100ms' }}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent rounded-3xl blur-2xl"></div>
              <div className="relative flex items-center justify-center p-12">
                <div className="w-64 h-64 bg-gradient-to-br from-purple-400/30 to-purple-600/30 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>

          {/* Chat da Simulação */}
          <div className={`${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '200ms' }}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent rounded-3xl blur-xl"></div>
              <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-3xl p-6 border border-purple-500/30">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-purple-500/20">
                  <MessageCircle className="w-5 h-5 text-purple-400" />
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
                        <div className="w-8 h-8 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-purple-400" />
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
                                    ? 'bg-gradient-to-r from-purple-600/30 to-purple-500/30 border border-purple-500/40'
                                    : 'bg-purple-600/20'
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
                      <div className="w-8 h-8 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-gray-400 mb-1">Cliente virtual (IA)</div>
                        <div className="bg-gray-800/50 rounded-2xl rounded-tl-none p-4 text-sm text-gray-300">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Audio playing indicator */}
                  {isPlayingAudio && (
                    <div className="flex items-center justify-center py-2">
                      <div className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 rounded-full">
                        <Volume2 className="w-4 h-4 text-purple-400 animate-pulse" />
                        <span className="text-xs text-purple-400">Cliente falando...</span>
                      </div>
                    </div>
                  )}

                  {/* Recording indicator */}
                  {isRecording && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 rounded-full animate-pulse">
                          <Mic className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-red-400">🎤 Ouvindo... (pare de falar para enviar)</span>
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
                          : 'bg-gray-800/50 border-purple-500/20'
                      }`}>
                        <p className="text-sm text-center font-medium">
                          {currentTranscription}
                        </p>
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

                <div className="flex items-center justify-center gap-2 pt-4 border-t border-purple-500/20">
                  {/* Apenas botão de microfone para conversa por voz */}
                  {isSimulating && (
                    <div className="flex items-center gap-3">
                      {isPlayingAudio && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 rounded-full">
                          <Volume2 className="w-4 h-4 text-purple-400 animate-pulse" />
                          <span className="text-sm text-purple-400">Aguarde o cliente terminar...</span>
                        </div>
                      )}

                      {isRecording && (
                        <div className="flex flex-col gap-2 items-center">
                          <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 rounded-full">
                            <Mic className="w-4 h-4 text-red-400 animate-pulse" />
                            <span className="text-sm text-red-400">Fale agora (pare para enviar)</span>
                          </div>
                          {currentTranscription && (
                            <div className="px-4 py-2 bg-gray-800/50 rounded-lg max-w-md">
                              <p className="text-xs text-gray-400">"{currentTranscription}"</p>
                            </div>
                          )}
                        </div>
                      )}

                      {isLoading && !isRecording && !isPlayingAudio && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-600/20 rounded-full">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-gray-400">Processando...</span>
                        </div>
                      )}

                      {/* Botão manual de microfone (apenas para backup/emergência) */}
                      {!isPlayingAudio && !isRecording && !isLoading && (
                        <button
                          onClick={startRecording}
                          className="p-4 bg-purple-600/20 border border-purple-500/30 rounded-full hover:bg-purple-600/30 transition-all"
                          title="Clique para falar"
                        >
                          <Mic className="w-6 h-6 text-purple-400" />
                        </button>
                      )}
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="relative max-w-2xl w-full">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent rounded-3xl blur-xl"></div>
              <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-3xl font-bold">Configuração da Sessão</h2>
                  <button
                    onClick={() => setShowConfig(false)}
                    className="text-gray-400 hover:text-white transition-colors text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Idade do Cliente */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Idade do Cliente: <span className="text-purple-400 text-lg font-bold">{age} anos</span>
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
                              ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                              : 'bg-gray-800/50 text-gray-400 border border-purple-500/20 hover:border-purple-500/40'
                          }`}
                        >
                          {temp}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Persona */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Persona
                    </label>
                    {personas.filter(p => p.business_type === businessType).length === 0 ? (
                      <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4 text-gray-400 text-sm">
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
                                  ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                                  : 'border-purple-500/30 hover:border-purple-500/50'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center flex-shrink-0">
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
                                          <span className="font-bold text-purple-400">Tipo de Empresa:</span>{' '}
                                          {(persona as PersonaB2B).company_type}
                                        </p>
                                      )}
                                      {(persona as PersonaB2B).company_goals && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-purple-400">Busca:</span>{' '}
                                          {(persona as PersonaB2B).company_goals}
                                        </p>
                                      )}
                                      {(persona as PersonaB2B).business_challenges && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-purple-400">Desafios:</span>{' '}
                                          {(persona as PersonaB2B).business_challenges}
                                        </p>
                                      )}
                                    </>
                                  )}

                                  {persona.business_type === 'B2C' && (
                                    <>
                                      {(persona as PersonaB2C).what_seeks && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-purple-400">Busca:</span>{' '}
                                          {(persona as PersonaB2C).what_seeks}
                                        </p>
                                      )}
                                      {(persona as PersonaB2C).main_pains && (
                                        <p className="text-xs text-gray-300">
                                          <span className="font-bold text-purple-400">Dores:</span>{' '}
                                          {(persona as PersonaB2C).main_pains}
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>

                                {selectedPersona === persona.id && (
                                  <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
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
                      <div className="bg-gray-800/50 border border-purple-500/20 rounded-xl p-4 text-gray-400 text-sm">
                        Nenhuma objeção cadastrada. Configure no Hub de Configuração.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {objections.map((objection) => (
                          <label
                            key={objection.id}
                            className="flex items-center gap-3 bg-gray-800/50 border border-purple-500/20 rounded-xl px-4 py-3 cursor-pointer hover:border-purple-500/40 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedObjections.includes(objection.id)}
                              onChange={() => toggleObjection(objection.id)}
                              className="w-5 h-5 rounded border-purple-500/30 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                            />
                            <span className="text-gray-300">{objection.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setShowConfig(false)}
                    className="flex-1 px-6 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl font-semibold hover:bg-gray-700/50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleStartSimulation}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-semibold hover:scale-105 transition-transform glow-purple"
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
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-purple-500/30 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
              <Loader2 className="w-16 h-16 text-purple-400 animate-spin mx-auto" />
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Analisando sua performance...</h3>
                <p className="text-gray-400">Nosso agente está avaliando sua conversa com base em metodologia SPIN Selling</p>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Resumo Rápido */}
        {showEvaluationSummary && evaluation && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-purple-500/30 rounded-2xl p-8 max-w-2xl w-full space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white">Avaliação Completa ✨</h3>
                <button
                  onClick={() => setShowEvaluationSummary(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Score */}
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-400/10 border border-purple-500/30 rounded-xl p-6 text-center">
                <div className="text-6xl font-bold text-white mb-2">{evaluation.overall_score}</div>
                <div className="text-lg text-purple-300 uppercase tracking-wider">
                  {evaluation.performance_level === 'legendary' && '🏆 Lendário'}
                  {evaluation.performance_level === 'excellent' && '⭐ Excelente'}
                  {evaluation.performance_level === 'very_good' && '✨ Muito Bom'}
                  {evaluation.performance_level === 'good' && '👍 Bom'}
                  {evaluation.performance_level === 'needs_improvement' && '📈 Precisa Melhorar'}
                  {evaluation.performance_level === 'poor' && '📚 Em Desenvolvimento'}
                </div>
              </div>

              {/* Resumo Executivo */}
              <div className="space-y-3">
                <h4 className="font-bold text-white text-lg">Resumo da Performance</h4>
                <p className="text-gray-300 leading-relaxed">{evaluation.executive_summary}</p>
              </div>

              {/* Pontos Fortes */}
              {evaluation.top_strengths && evaluation.top_strengths.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-green-400 text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Pontos Fortes
                  </h4>
                  <ul className="space-y-2">
                    {evaluation.top_strengths.map((strength: string, idx: number) => (
                      <li key={idx} className="text-gray-300 flex items-start gap-2">
                        <span className="text-green-400 mt-1">•</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Áreas de Melhoria */}
              {evaluation.critical_gaps && evaluation.critical_gaps.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-orange-400 text-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Principais Gaps
                  </h4>
                  <ul className="space-y-2">
                    {evaluation.critical_gaps.map((gap: string, idx: number) => (
                      <li key={idx} className="text-gray-300 flex items-start gap-2">
                        <span className="text-orange-400 mt-1">•</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowEvaluationSummary(false)}
                  className="flex-1 px-6 py-3 bg-gray-800/50 border border-purple-500/20 rounded-xl font-medium hover:bg-gray-700/50 transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setShowEvaluationSummary(false);
                    // Navegar para histórico (você pode implementar navegação aqui)
                    window.location.href = '/?view=historico';
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl font-medium hover:scale-105 transition-transform"
                >
                  Ver Análise Completa no Histórico
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .slider-purple::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: linear-gradient(to right, #9333ea, #a855f7);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }

        .slider-purple::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: linear-gradient(to right, #9333ea, #a855f7);
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }
      `}</style>
    </div>
  )
}
