'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Video,
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Users,
  StopCircle,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

// Vexa API config - production uses relative path via Nginx proxy
const isDevelopment = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.port === '3000' ||
  window.location.hostname.startsWith('192.168.')
)
const VEXA_API_URL = isDevelopment
  ? 'http://localhost:8056'  // Development
  : '/vexa-api'              // Production (proxied via Nginx)
const VEXA_API_KEY = 'q7ZeKSTwiAhjPH1pMFNmNNgx5bPdyDYBv5Nl8jZ5'

type BotStatus = 'idle' | 'sending' | 'joining' | 'in_meeting' | 'transcribing' | 'ended' | 'evaluating' | 'error'

interface TranscriptSegment {
  speaker: string
  text: string
  timestamp: string
}

interface MeetingSession {
  botId: number
  meetingId: string
  status: BotStatus
  startTime?: Date
  transcript: TranscriptSegment[]
}

interface MeetEvaluation {
  overall_score: number
  performance_level: string
  executive_summary: string
  top_strengths: string[]
  critical_gaps: string[]
  spin_evaluation: {
    S: { final_score: number; technical_feedback: string }
    P: { final_score: number; technical_feedback: string }
    I: { final_score: number; technical_feedback: string }
    N: { final_score: number; technical_feedback: string }
  }
  objections_analysis: Array<{
    objection_type: string
    objection_text: string
    score: number
    detailed_analysis: string
  }>
  priority_improvements: Array<{
    area: string
    current_gap: string
    action_plan: string
    priority: string
  }>
  seller_identification?: {
    name: string
    speaking_time_percentage: number
  }
}

// Consolidate consecutive messages from the same speaker
const consolidateTranscript = (segments: TranscriptSegment[]): TranscriptSegment[] => {
  if (segments.length === 0) return []

  const consolidated: TranscriptSegment[] = []
  let current: TranscriptSegment | null = null

  for (const segment of segments) {
    // Normalize speaker names for comparison (case-insensitive, trimmed)
    const currentSpeaker = current?.speaker?.trim().toLowerCase() || ''
    const segmentSpeaker = segment.speaker?.trim().toLowerCase() || ''

    if (current && currentSpeaker === segmentSpeaker) {
      // Same speaker - append text
      current.text = (current.text + ' ' + segment.text).trim()
    } else {
      // Different speaker - save current and start new
      if (current) {
        consolidated.push(current)
      }
      current = { ...segment }
    }
  }

  // Don't forget the last one
  if (current) {
    consolidated.push(current)
  }

  console.log(`Consolidation: ${segments.length} segments -> ${consolidated.length} messages`)
  return consolidated
}

export default function MeetAnalysisView() {
  const [meetUrl, setMeetUrl] = useState('')
  const [meetingId, setMeetingId] = useState('')
  const [session, setSession] = useState<MeetingSession | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [evaluation, setEvaluation] = useState<MeetEvaluation | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Extract meeting ID from Google Meet URL
  const extractMeetingId = (url: string): string | null => {
    // Patterns:
    // https://meet.google.com/abc-defg-hij
    // meet.google.com/abc-defg-hij
    const patterns = [
      /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i,
      /^([a-z]{3}-[a-z]{4}-[a-z]{3})$/i
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1].toLowerCase()
    }
    return null
  }

  // Handle URL input change
  const handleUrlChange = (value: string) => {
    setMeetUrl(value)
    setError('')
    const id = extractMeetingId(value)
    setMeetingId(id || '')
  }

  // Send bot to meeting
  const sendBot = async () => {
    if (!meetingId) {
      setError('Por favor, insira um link válido do Google Meet')
      return
    }

    setSession({
      botId: 0,
      meetingId,
      status: 'sending',
      transcript: []
    })
    setError('')

    try {
      const response = await fetch(`${VEXA_API_URL}/bots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': VEXA_API_KEY
        },
        body: JSON.stringify({
          platform: 'google_meet',
          native_meeting_id: meetingId,
          language: 'pt'  // Forçar transcrição em português
        })
      })

      if (!response.ok) {
        throw new Error('Falha ao enviar bot para a reunião')
      }

      const data = await response.json()

      setSession(prev => prev ? {
        ...prev,
        botId: data.id,
        status: 'joining',
        startTime: new Date()
      } : null)

      // Start polling for status and transcripts using meeting ID
      startPolling(meetingId)

    } catch (err: any) {
      console.error('Error sending bot:', err)
      setError(err.message || 'Erro ao enviar bot')
      setSession(prev => prev ? { ...prev, status: 'error' } : null)
    }
  }

  // Poll for bot status and transcripts
  const startPolling = (nativeMeetingId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    const poll = async () => {
      try {
        // Get all bots status using /bots/status endpoint
        const statusRes = await fetch(`${VEXA_API_URL}/bots/status`, {
          headers: { 'X-API-Key': VEXA_API_KEY }
        })

        if (statusRes.ok) {
          const statusData = await statusRes.json()
          console.log('All bots status:', statusData)

          // Find our bot by native_meeting_id
          const ourBot = statusData.running_bots?.find(
            (bot: any) => bot.native_meeting_id === nativeMeetingId
          )

          // Update session status based on bot status
          setSession(prev => {
            if (!prev) return null

            let newStatus: BotStatus = prev.status

            if (ourBot) {
              const normalizedStatus = ourBot.normalized_status?.toLowerCase()
              if (normalizedStatus === 'up' || normalizedStatus === 'running') {
                newStatus = 'in_meeting'
              } else if (normalizedStatus === 'exited' || normalizedStatus === 'stopped') {
                newStatus = 'ended'
              }
            } else if (prev.status === 'joining') {
              // Bot might still be starting up
              newStatus = 'joining'
            } else if (prev.status === 'in_meeting' || prev.status === 'transcribing') {
              // Bot was running but now not in list - might have ended
              newStatus = 'ended'
            }

            return { ...prev, status: newStatus }
          })
        }

        // Get transcripts
        const transcriptRes = await fetch(
          `${VEXA_API_URL}/transcripts/google_meet/${nativeMeetingId}`,
          { headers: { 'X-API-Key': VEXA_API_KEY } }
        )

        if (transcriptRes.ok) {
          const transcriptData = await transcriptRes.json()
          console.log('Transcript data:', transcriptData)

          // Handle different response formats
          let segments = []
          if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
            segments = transcriptData.segments
          } else if (transcriptData.transcript && Array.isArray(transcriptData.transcript)) {
            segments = transcriptData.transcript
          } else if (Array.isArray(transcriptData)) {
            segments = transcriptData
          }

          if (segments.length > 0) {
            // Map raw segments to our format
            const mappedSegments = segments.map((seg: any) => ({
              speaker: seg.speaker || seg.speaker_id || 'Participante',
              text: seg.text || seg.content || '',
              timestamp: seg.start_time || seg.timestamp || ''
            }))

            // Consolidate consecutive messages from the same speaker
            const consolidatedTranscript = consolidateTranscript(mappedSegments)

            setSession(prev => {
              if (!prev) return null
              return {
                ...prev,
                status: 'transcribing',
                transcript: consolidatedTranscript
              }
            })
          }
        }

      } catch (err) {
        console.error('Polling error:', err)
      }
    }

    // Initial poll
    poll()

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(poll, 2000)
  }

  // Stop polling
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  // End session and evaluate
  const endSession = async () => {
    stopPolling()

    if (session?.meetingId) {
      try {
        // Use correct endpoint: DELETE /bots/{platform}/{native_meeting_id}
        await fetch(`${VEXA_API_URL}/bots/google_meet/${session.meetingId}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': VEXA_API_KEY }
        })
      } catch (err) {
        console.error('Error stopping bot:', err)
      }
    }

    // Set status to evaluating and trigger evaluation
    setSession(prev => prev ? { ...prev, status: 'evaluating' } : null)

    // Only evaluate if there's a transcript
    if (session && session.transcript.length > 0) {
      await evaluateTranscript()
    } else {
      setSession(prev => prev ? { ...prev, status: 'ended' } : null)
    }
  }

  // Evaluate the transcript
  const evaluateTranscript = async () => {
    if (!session || session.transcript.length === 0) return

    setIsEvaluating(true)
    setError('')

    try {
      // Format transcript for evaluation
      const transcriptText = session.transcript
        .map(s => `${s.speaker}: ${s.text}`)
        .join('\n')

      console.log('📊 Enviando transcrição para avaliação...')

      // Get company ID for playbook evaluation
      const companyId = await getCompanyId()
      console.log('🏢 Company ID para avaliação:', companyId || 'não encontrado')

      const response = await fetch('/api/meet/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          meetingId: session.meetingId,
          companyId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao avaliar reunião')
      }

      const data = await response.json()

      if (data.success && data.evaluation) {
        console.log('✅ Avaliação recebida:', data.evaluation.overall_score)
        setEvaluation(data.evaluation)
      } else {
        throw new Error('Resposta inválida da API')
      }

    } catch (err: any) {
      console.error('❌ Erro na avaliação:', err)
      setError(`Erro ao avaliar: ${err.message}`)
    } finally {
      setIsEvaluating(false)
      setSession(prev => prev ? { ...prev, status: 'ended' } : null)
    }
  }

  // Reset session
  const resetSession = () => {
    stopPolling()
    setSession(null)
    setMeetUrl('')
    setMeetingId('')
    setError('')
    setEvaluation(null)
    setIsEvaluating(false)
  }

  // Copy meeting ID
  const copyMeetingId = () => {
    navigator.clipboard.writeText(meetingId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Scroll to bottom of transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [session?.transcript])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [])

  // Get status display
  const getStatusDisplay = () => {
    if (!session) return null

    const statusConfig: Record<BotStatus, { icon: any; text: string; color: string }> = {
      idle: { icon: Clock, text: 'Aguardando', color: 'text-gray-500' },
      sending: { icon: Loader2, text: 'Enviando bot...', color: 'text-amber-600' },
      joining: { icon: Loader2, text: 'Entrando na reunião...', color: 'text-amber-600' },
      in_meeting: { icon: Video, text: 'Na reunião', color: 'text-green-600' },
      transcribing: { icon: Video, text: 'Transcrevendo...', color: 'text-green-600' },
      evaluating: { icon: Loader2, text: 'Avaliando performance...', color: 'text-purple-600' },
      ended: { icon: CheckCircle, text: 'Encerrado', color: 'text-blue-600' },
      error: { icon: XCircle, text: 'Erro', color: 'text-red-600' }
    }

    const config = statusConfig[session.status]
    const Icon = config.icon

    return (
      <div className={`flex items-center gap-2 ${config.color}`}>
        <Icon className={`w-5 h-5 ${session.status === 'sending' || session.status === 'joining' || session.status === 'evaluating' ? 'animate-spin' : ''}`} />
        <span className="font-medium">{config.text}</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-2xl flex items-center justify-center">
            <Video className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Análise de Google Meet
          </h1>
          <p className="text-gray-500">
            Cole o link da reunião e nosso bot entrará para transcrever a conversa
          </p>
        </div>

        {/* Input Section */}
        {!session && (
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Link do Google Meet
            </label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={meetUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                />
                {meetingId && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded font-medium">
                      {meetingId}
                    </span>
                    <button
                      onClick={copyMeetingId}
                      className="text-gray-400 hover:text-green-600 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={sendBot}
                disabled={!meetingId}
                className="px-6 py-3.5 bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                <Send className="w-5 h-5" />
                Enviar Bot
              </button>
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Instructions */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Como funciona:</h3>
              <ol className="text-sm text-gray-600 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">1.</span>
                  Cole o link da reunião do Google Meet acima
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">2.</span>
                  Clique em "Enviar Bot" - um participante chamado "VexaBot" pedirá para entrar
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">3.</span>
                  <strong className="text-amber-600">Aceite o bot na reunião</strong> quando ele pedir para participar
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">4.</span>
                  A transcrição aparecerá em tempo real aqui
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Session Active */}
        {session && (
          <div className="space-y-6">
            {/* Status Bar */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {getStatusDisplay()}
                  {session.startTime && (
                    <span className="text-sm text-gray-500">
                      Iniciado às {session.startTime.toLocaleTimeString('pt-BR')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">
                    Meeting: {session.meetingId}
                  </span>
                  {session.status !== 'ended' && session.status !== 'error' && (
                    <button
                      onClick={endSession}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors flex items-center gap-2 border border-red-200"
                    >
                      <StopCircle className="w-4 h-4" />
                      Encerrar
                    </button>
                  )}
                  {(session.status === 'ended' || session.status === 'error') && (
                    <button
                      onClick={resetSession}
                      className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors flex items-center gap-2 border border-green-200"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Nova Análise
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-600" />
                  Transcrição em Tempo Real
                  {session.transcript.length > 0 && (
                    <span className="text-xs text-gray-500">
                      ({session.transcript.length} {session.transcript.length === 1 ? 'fala' : 'falas'})
                    </span>
                  )}
                </h3>
              </div>

              <div
                ref={transcriptRef}
                className="h-[400px] overflow-y-auto p-4 space-y-4 bg-white"
              >
                {session.transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    {session.status === 'joining' || session.status === 'sending' ? (
                      <>
                        <Loader2 className="w-8 h-8 animate-spin mb-3 text-green-600" />
                        <p className="text-gray-600">Aguardando bot entrar na reunião...</p>
                        <p className="text-sm text-gray-500 mt-2">
                          Isso geralmente leva de 10 a 15 segundos
                        </p>
                        <p className="text-sm text-amber-600 mt-2 font-medium">
                          Lembre-se de aceitar o "VexaBot" quando ele pedir para entrar!
                        </p>
                      </>
                    ) : session.status === 'in_meeting' ? (
                      <>
                        <Video className="w-8 h-8 mb-3 text-green-600" />
                        <p className="text-gray-600">Bot na reunião. Aguardando transcrição...</p>
                      </>
                    ) : (
                      <>
                        <Clock className="w-8 h-8 mb-3 text-gray-400" />
                        <p className="text-gray-500">Nenhuma transcrição ainda</p>
                      </>
                    )}
                  </div>
                ) : (
                  session.transcript.map((segment, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-green-700 text-sm">
                            {segment.speaker}
                          </span>
                          {segment.timestamp && (
                            <span className="text-xs text-gray-400">
                              {segment.timestamp}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {segment.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Evaluation Loading */}
            {(session.status === 'evaluating' || isEvaluating) && (
              <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Avaliando Performance...</h3>
                    <p className="text-gray-600 text-sm">Analisando a reunião com metodologia SPIN Selling</p>
                  </div>
                </div>
              </div>
            )}

            {/* Evaluation Results */}
            {session.status === 'ended' && evaluation && (
              <div className="space-y-4">
                {/* Score Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold mb-1">Avaliação da Reunião</h3>
                      {evaluation.seller_identification?.name && (
                        <p className="text-purple-200">Vendedor: {evaluation.seller_identification.name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-5xl font-bold">{evaluation.overall_score?.toFixed(1)}</div>
                      <div className="text-purple-200 text-sm capitalize">{evaluation.performance_level?.replace('_', ' ')}</div>
                    </div>
                  </div>
                </div>

                {/* SPIN Scores */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-4">Metodologia SPIN</h4>
                  <div className="grid grid-cols-4 gap-4">
                    {['S', 'P', 'I', 'N'].map((letter) => {
                      const score = evaluation.spin_evaluation?.[letter as keyof typeof evaluation.spin_evaluation]?.final_score || 0
                      const color = score >= 7 ? 'text-green-600 bg-green-50' : score >= 5 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
                      const labels: Record<string, string> = {
                        S: 'Situação',
                        P: 'Problema',
                        I: 'Implicação',
                        N: 'Necessidade'
                      }
                      return (
                        <div key={letter} className={`rounded-xl p-4 ${color.split(' ')[1]}`}>
                          <div className={`text-3xl font-bold ${color.split(' ')[0]}`}>{score.toFixed(1)}</div>
                          <div className="text-gray-600 text-sm font-medium">{labels[letter]}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-3">Resumo Executivo</h4>
                  <p className="text-gray-700 whitespace-pre-line">{evaluation.executive_summary}</p>
                </div>

                {/* Strengths & Gaps */}
                <div className="grid grid-cols-2 gap-4">
                  {evaluation.top_strengths && evaluation.top_strengths.length > 0 && (
                    <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                      <h4 className="text-md font-bold text-green-800 mb-3">Pontos Fortes</h4>
                      <ul className="space-y-2">
                        {evaluation.top_strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-green-700 text-sm">
                            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.critical_gaps && evaluation.critical_gaps.length > 0 && (
                    <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                      <h4 className="text-md font-bold text-red-800 mb-3">Gaps Críticos</h4>
                      <ul className="space-y-2">
                        {evaluation.critical_gaps.map((gap, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-red-700 text-sm">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{gap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Objections Analysis */}
                {evaluation.objections_analysis && evaluation.objections_analysis.length > 0 && (
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Análise de Objeções</h4>
                    <div className="space-y-4">
                      {evaluation.objections_analysis.map((obj, idx) => (
                        <div key={idx} className="border-l-4 border-purple-400 pl-4 py-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                              {obj.objection_type}
                            </span>
                            <span className={`text-sm font-bold ${obj.score >= 7 ? 'text-green-600' : obj.score >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                              Nota: {obj.score}/10
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm italic mb-2">"{obj.objection_text}"</p>
                          <p className="text-gray-700 text-sm">{obj.detailed_analysis}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Priority Improvements */}
                {evaluation.priority_improvements && evaluation.priority_improvements.length > 0 && (
                  <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
                    <h4 className="text-lg font-bold text-amber-800 mb-4">Melhorias Prioritárias</h4>
                    <div className="space-y-3">
                      {evaluation.priority_improvements.map((imp, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-4 border border-amber-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              imp.priority === 'critical' ? 'bg-red-100 text-red-700' :
                              imp.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {imp.priority}
                            </span>
                            <span className="font-semibold text-gray-900">{imp.area}</span>
                          </div>
                          <p className="text-gray-600 text-sm mb-1"><strong>Gap:</strong> {imp.current_gap}</p>
                          <p className="text-gray-700 text-sm"><strong>Plano:</strong> {imp.action_plan}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      const text = session.transcript
                        .map(s => `${s.speaker}: ${s.text}`)
                        .join('\n')
                      navigator.clipboard.writeText(text)
                    }}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar Transcrição
                  </button>
                  <button
                    onClick={resetSession}
                    className="px-4 py-2.5 bg-white hover:bg-gray-50 text-green-600 rounded-lg transition-colors flex items-center gap-2 border border-gray-200 font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Nova Análise
                  </button>
                </div>
              </div>
            )}

            {/* Session ended without evaluation (no transcript) */}
            {session.status === 'ended' && !evaluation && session.transcript.length > 0 && !isEvaluating && (
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Sessão Encerrada</h3>
                <p className="text-gray-600 mb-4">
                  A transcrição foi capturada. Você pode avaliar a performance ou copiar a transcrição.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={evaluateTranscript}
                    disabled={isEvaluating}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
                  >
                    {isEvaluating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Avaliar Performance
                  </button>
                  <button
                    onClick={() => {
                      const text = session.transcript
                        .map(s => `${s.speaker}: ${s.text}`)
                        .join('\n')
                      navigator.clipboard.writeText(text)
                    }}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar Transcrição
                  </button>
                  <button
                    onClick={resetSession}
                    className="px-4 py-2.5 bg-white hover:bg-gray-50 text-green-600 rounded-lg transition-colors flex items-center gap-2 border border-gray-200 font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Nova Análise
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
