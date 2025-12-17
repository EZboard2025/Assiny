'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Video, Play, AlertCircle, Radio } from 'lucide-react'

export function AnaliseVendaRealView() {
  const [meetLink, setMeetLink] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [botStatus, setBotStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'blocked'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [transcript, setTranscript] = useState<Array<{
    timestamp: string
    speaker: string
    text: string
  }>>([])
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const validateMeetLink = (link: string) => {
    // Valida se é um link do Google Meet
    const meetRegex = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/
    return meetRegex.test(link)
  }

  const showMessage = (type: 'success' | 'error', message: string) => {
    if (type === 'error') {
      setErrorMessage(message)
      setTimeout(() => setErrorMessage(''), 5000)
    } else {
      console.log('Success:', message)
    }
  }

  const startAnalysis = async () => {
    if (!meetLink) {
      showMessage('error', 'Por favor, insira o link do Google Meet')
      return
    }

    if (!validateMeetLink(meetLink)) {
      showMessage('error', 'Por favor, insira um link válido (ex: https://meet.google.com/abc-defg-hij)')
      return
    }

    setIsLoading(true)
    setBotStatus('connecting')
    setErrorMessage('')

    try {
      // Criar sessão no backend (sem autenticação por enquanto)
      const response = await fetch('/api/real-call/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetLink,
          userId: 'test-user', // Temporário
          userName: 'Test User'
        })
      })

      if (!response.ok) {
        throw new Error('Falha ao iniciar análise')
      }

      const data = await response.json()
      setSessionId(data.sessionId)
      setBotStatus('connected')
      showMessage('success', 'Bot conectado! O bot entrou na reunião e está capturando as legendas')

      // Poll para obter transcrição (temporário, sem realtime)
      if (data.sessionId) {
        startPollingTranscript(data.sessionId)
      }

    } catch (error) {
      console.error('Erro ao iniciar análise:', error)
      setBotStatus('error')
      showMessage('error', 'Não foi possível enviar o bot para a reunião')
    } finally {
      setIsLoading(false)
    }
  }

  const startPollingTranscript = (sessionId: string) => {
    // Poll a cada 3 segundos para obter transcrição
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/real-call/transcript/${sessionId}`)
        if (response.ok) {
          const data = await response.json()

          // Check if meeting is blocked
          if (data.status === 'blocked') {
            setBotStatus('blocked')
            setErrorMessage('A reunião requer aprovação do organizador')
            clearInterval(pollIntervalRef.current!)
            pollIntervalRef.current = null
            return
          }

          if (data.transcript && data.transcript.length > 0) {
            setTranscript(data.transcript)
          }
        }
      } catch (error) {
        console.error('Error polling transcript:', error)
      }
    }, 3000)

    // Store interval ID for cleanup
    pollIntervalRef.current = pollInterval
  }

  const stopAnalysis = async () => {
    if (!sessionId) return

    // Stop polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    try {
      await fetch('/api/real-call/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      setBotStatus('idle')
      setSessionId(null)
      showMessage('success', 'Análise finalizada! A transcrição foi salva na pasta "transcripts"')
    } catch (error) {
      console.error('Erro ao parar análise:', error)
      showMessage('error', 'Não foi possível finalizar a análise')
    }
  }

  const getStatusIcon = () => {
    switch (botStatus) {
      case 'connecting':
        return <Loader2 className="animate-spin text-yellow-500" size={20} />
      case 'connected':
        return <Radio className="text-green-500 animate-pulse" size={20} />
      case 'error':
        return <AlertCircle className="text-red-500" size={20} />
      case 'blocked':
        return <AlertCircle className="text-orange-500" size={20} />
      default:
        return <Video className="text-gray-400" size={20} />
    }
  }

  const getStatusText = () => {
    switch (botStatus) {
      case 'connecting':
        return 'Conectando bot à reunião...'
      case 'connected':
        return 'Bot conectado - Capturando transcrição'
      case 'error':
        return 'Erro na conexão'
      case 'blocked':
        return 'Reunião bloqueada - Precisa de aprovação do organizador'
      default:
        return 'Bot desconectado'
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-2 text-white">
          Análise de Venda Real
        </h2>
        <p className="text-gray-300">
          Cole o link do Google Meet para analisar a performance do vendedor em tempo real
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Input Section */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 space-y-4">
        <div>
          <label htmlFor="meet-link" className="block text-sm font-medium text-gray-200 mb-2">
            Link do Google Meet
          </label>
          <div className="flex space-x-3">
            <input
              id="meet-link"
              type="url"
              placeholder="https://meet.google.com/abc-defg-hij"
              value={meetLink}
              onChange={(e) => setMeetLink(e.target.value)}
              className="flex-1 px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={botStatus === 'connected'}
            />
            {botStatus !== 'connected' ? (
              <>
                <button
                  onClick={startAnalysis}
                  disabled={isLoading}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>Conectando...</span>
                    </>
                  ) : (
                    <>
                      <Play size={20} />
                      <span>Iniciar Análise</span>
                    </>
                  )}
                </button>
                <button
                  onClick={async () => {
                    if (!meetLink) {
                      showMessage('error', 'Por favor, insira um link do Google Meet')
                      return
                    }
                    console.log('Executando teste de legendas...')
                    setIsLoading(true)
                    try {
                      const response = await fetch('/api/real-call/test-captions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ meetLink })
                      })
                      const data = await response.json()
                      console.log('Resultados do teste:', data)
                      alert('Teste executado! Verifique o console do navegador (F12) para ver os resultados detalhados.')
                    } catch (error) {
                      console.error('Teste falhou:', error)
                      showMessage('error', 'Erro ao executar teste')
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                  disabled={isLoading || !meetLink}
                  className="px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  title="Testa a detecção de legendas manualmente"
                >
                  <span>Testar</span>
                </button>
              </>
            ) : (
              <button
                onClick={stopAnalysis}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center space-x-2"
              >
                <span>Parar Análise</span>
              </button>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center space-x-2 text-sm">
          {getStatusIcon()}
          <span className="text-gray-300">{getStatusText()}</span>
        </div>

        {/* Instructions */}
        {botStatus === 'idle' && (
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h3 className="text-blue-400 font-semibold mb-2">Como funciona:</h3>
            <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
              <li>Cole o link da reunião do Google Meet</li>
              <li>Clique em "Iniciar Análise"</li>
              <li>Um bot entrará na reunião (nome: "Assistente Ramppy")</li>
              <li>O bot ativará legendas automaticamente para capturar a conversa</li>
              <li>A transcrição será salva na pasta "transcripts" no servidor</li>
            </ol>
            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-400">
                ⚠️ <strong>Importante:</strong> Se a reunião estiver bloqueada, o organizador precisa aprovar a entrada do bot ou desativar a aprovação prévia nas configurações da reunião.
              </p>
            </div>
          </div>
        )}

        {/* Blocked Meeting Warning */}
        {botStatus === 'blocked' && (
          <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <h3 className="text-orange-400 font-semibold mb-2">🔒 Reunião Bloqueada</h3>
            <p className="text-sm text-gray-300 mb-3">
              A reunião está configurada para exigir aprovação do organizador. Para continuar:
            </p>
            <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
              <li>Peça ao organizador para aprovar "Assistente Ramppy" quando aparecer a notificação</li>
              <li>Ou peça para desativar a aprovação prévia nas configurações da reunião</li>
              <li>Ou use uma reunião sem restrições para teste</li>
            </ol>
            <div className="mt-3">
              <button
                onClick={() => {
                  setBotStatus('idle')
                  setSessionId(null)
                }}
                className="text-sm text-orange-400 hover:text-orange-300 underline"
              >
                Tentar com outro link
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Real-time Transcript */}
      {botStatus === 'connected' && (
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Radio className="text-green-500 animate-pulse" size={20} />
            <span>Transcrição ao Vivo</span>
          </h3>
          <div className="bg-black/30 rounded-lg p-4 h-96 overflow-y-auto space-y-2 font-mono text-sm">
            {transcript.length === 0 ? (
              <p className="text-gray-400 italic">
                Aguardando legendas... (Verifique o console para logs em tempo real)
              </p>
            ) : (
              transcript.map((entry, index) => (
                <div key={index} className="flex space-x-2">
                  <span className="text-gray-500">
                    [{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}]
                  </span>
                  <span className="text-purple-400">{entry.speaker}:</span>
                  <span className="text-white">{entry.text}</span>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            💡 A transcrição completa está sendo salva em: transcripts/session_*.json
          </p>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-lg p-4 border border-purple-500/30">
          <h4 className="font-semibold text-purple-300 mb-2">💡 Dica</h4>
          <p className="text-sm text-gray-300">
            O bot aparecerá como participante na reunião. Você pode ocultá-lo fixando apenas os vídeos principais.
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-600/20 to-blue-600/20 backdrop-blur-sm rounded-lg p-4 border border-green-500/30">
          <h4 className="font-semibold text-green-300 mb-2">📁 Arquivo</h4>
          <p className="text-sm text-gray-300">
            A transcrição é salva automaticamente na pasta "transcripts" com timestamp único.
          </p>
        </div>
      </div>
    </div>
  )
}