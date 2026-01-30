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
  Check,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Award,
  AlertCircle,
  Lightbulb,
  X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

// Vexa API config - production uses relative path via Nginx proxy
const VEXA_API_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:8056'  // Development
  : '/vexa-api'              // Production (proxied via Nginx)
const VEXA_API_KEY = 'q7ZeKSTwiAhjPH1pMFNmNNgx5bPdyDYBv5Nl8jZ5'

type BotStatus = 'idle' | 'sending' | 'joining' | 'in_meeting' | 'transcribing' | 'ended' | 'error'

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
  call_metadata: {
    call_type: string
    duration_estimated: string
    participants_identified: string[]
    call_outcome: string
    transcription_quality: string
  }
  objections_analysis: Array<{
    objection_id: string
    objection_type: string
    objection_nature: string
    objection_text: string
    score: number
    detailed_analysis: string
    critical_errors: string[] | null
    ideal_response: string | null
  }>
  spin_evaluation: {
    S: { final_score: number; technical_feedback: string; key_questions_asked: string[]; missed_opportunities: string[] }
    P: { final_score: number; technical_feedback: string; problems_identified: string[]; missed_opportunities: string[] }
    I: { final_score: number; technical_feedback: string; implications_raised: string[]; missed_opportunities: string[] }
    N: { final_score: number; technical_feedback: string; value_propositions_used: string[]; missed_opportunities: string[] }
  }
  soft_skills_evaluation: {
    rapport_score: number
    rapport_feedback: string
    conversation_control_score: number
    control_feedback: string
    active_listening_score: number
    listening_feedback: string
    stakeholder_management_score: number | null
    stakeholder_feedback: string | null
  }
  overall_score: number
  performance_level: string
  executive_summary: string
  top_strengths: string[]
  critical_gaps: string[]
  key_moments: Array<{
    timestamp_approx: string
    moment_type: string
    description: string
    impact: string
  }>
  priority_improvements: Array<{
    area: string
    current_gap: string
    action_plan: string
    priority: string
    training_suggestion: string
  }>
  comparison_with_best_practices: {
    aligned_with: string[]
    deviated_from: string[]
  }
}

// Consolidate consecutive messages from the same speaker
const consolidateTranscript = (segments: TranscriptSegment[]): TranscriptSegment[] => {
  if (segments.length === 0) return []

  const consolidated: TranscriptSegment[] = []
  let current: TranscriptSegment | null = null

  for (const segment of segments) {
    const currentSpeaker = current?.speaker?.trim().toLowerCase() || ''
    const segmentSpeaker = segment.speaker?.trim().toLowerCase() || ''

    if (current && currentSpeaker === segmentSpeaker) {
      current.text = (current.text + ' ' + segment.text).trim()
    } else {
      if (current) {
        consolidated.push(current)
      }
      current = { ...segment }
    }
  }

  if (current) {
    consolidated.push(current)
  }

  console.log(`Consolidation: ${segments.length} segments -> ${consolidated.length} messages`)
  return consolidated
}

// Performance level colors and labels
const getPerformanceConfig = (level: string) => {
  const configs: Record<string, { color: string; bgColor: string; label: string }> = {
    poor: { color: 'text-red-500', bgColor: 'bg-red-500/20', label: 'Reprovado' },
    needs_improvement: { color: 'text-orange-500', bgColor: 'bg-orange-500/20', label: 'Precisa Melhorar' },
    good: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/20', label: 'Bom' },
    very_good: { color: 'text-green-400', bgColor: 'bg-green-500/20', label: 'Muito Bom' },
    excellent: { color: 'text-green-500', bgColor: 'bg-green-500/20', label: 'Excelente' },
    legendary: { color: 'text-purple-500', bgColor: 'bg-purple-500/20', label: 'Lendário' }
  }
  return configs[level] || configs.good
}

// Score color helper
const getScoreColor = (score: number) => {
  if (score >= 8) return 'text-green-400'
  if (score >= 6) return 'text-yellow-400'
  if (score >= 4) return 'text-orange-400'
  return 'text-red-400'
}

export default function MeetAnalysisView() {
  const [meetUrl, setMeetUrl] = useState('')
  const [meetingId, setMeetingId] = useState('')
  const [session, setSession] = useState<MeetingSession | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // User info (auto-fetched)
  const [sellerName, setSellerName] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Call context
  const [callObjective, setCallObjective] = useState('')

  // Evaluation states
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<MeetEvaluation | null>(null)
  const [evaluationError, setEvaluationError] = useState('')
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    spin: true,
    objections: false,
    softSkills: false,
    improvements: false,
    moments: false
  })

  // Fetch user info on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          // Get user name from employees table
          const { data: employee } = await supabase
            .from('employees')
            .select('name')
            .eq('id', user.id)
            .single()
          if (employee?.name) {
            setSellerName(employee.name)
          } else {
            // Fallback to email
            setSellerName(user.email?.split('@')[0] || 'Vendedor')
          }
        }
        // Get company ID
        const compId = await getCompanyId()
        setCompanyId(compId)
      } catch (err) {
        console.error('Error fetching user info:', err)
      }
    }
    fetchUserInfo()
  }, [])

  // Extract meeting ID from Google Meet URL
  const extractMeetingId = (url: string): string | null => {
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
    setEvaluation(null)
    setEvaluationError('')

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
          language: 'pt'
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
        const statusRes = await fetch(`${VEXA_API_URL}/bots/status`, {
          headers: { 'X-API-Key': VEXA_API_KEY }
        })

        if (statusRes.ok) {
          const statusData = await statusRes.json()

          const ourBot = statusData.running_bots?.find(
            (bot: any) => bot.native_meeting_id === nativeMeetingId
          )

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
              newStatus = 'joining'
            } else if (prev.status === 'in_meeting' || prev.status === 'transcribing') {
              newStatus = 'ended'
            }

            return { ...prev, status: newStatus }
          })
        }

        const transcriptRes = await fetch(
          `${VEXA_API_URL}/transcripts/google_meet/${nativeMeetingId}`,
          { headers: { 'X-API-Key': VEXA_API_KEY } }
        )

        if (transcriptRes.ok) {
          const transcriptData = await transcriptRes.json()

          let segments = []
          if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
            segments = transcriptData.segments
          } else if (transcriptData.transcript && Array.isArray(transcriptData.transcript)) {
            segments = transcriptData.transcript
          } else if (Array.isArray(transcriptData)) {
            segments = transcriptData
          }

          if (segments.length > 0) {
            const mappedSegments = segments.map((seg: any) => ({
              speaker: seg.speaker || seg.speaker_id || 'Participante',
              text: seg.text || seg.content || '',
              timestamp: seg.start_time || seg.timestamp || ''
            }))

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

    poll()
    pollIntervalRef.current = setInterval(poll, 2000)
  }

  // Stop polling
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  // End session
  const endSession = async () => {
    stopPolling()

    if (session?.meetingId) {
      try {
        await fetch(`${VEXA_API_URL}/bots/google_meet/${session.meetingId}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': VEXA_API_KEY }
        })
      } catch (err) {
        console.error('Error stopping bot:', err)
      }
    }

    setSession(prev => prev ? { ...prev, status: 'ended' } : null)
  }

  // Reset session
  const resetSession = () => {
    stopPolling()
    setSession(null)
    setMeetUrl('')
    setMeetingId('')
    setError('')
    setEvaluation(null)
    setEvaluationError('')
    setCallObjective('')
    // Note: sellerName is not reset because it's auto-fetched from user profile
  }

  // Copy meeting ID
  const copyMeetingId = () => {
    navigator.clipboard.writeText(meetingId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Evaluate call
  const evaluateCall = async () => {
    if (!session?.transcript || session.transcript.length === 0) {
      setEvaluationError('Nenhuma transcrição disponível para avaliar')
      return
    }

    if (!userId || !companyId) {
      setEvaluationError('Usuário não autenticado')
      return
    }

    setIsEvaluating(true)
    setEvaluationError('')

    try {
      // Fetch company objections from ConfigHub
      const { data: objectionsData } = await supabase
        .from('objections')
        .select('name, rebuttals')
        .eq('company_id', companyId)

      // Format objections for the AI
      let objectionsText = ''
      if (objectionsData && objectionsData.length > 0) {
        objectionsText = objectionsData.map(obj => {
          const rebuttals = obj.rebuttals && Array.isArray(obj.rebuttals)
            ? obj.rebuttals.join('; ')
            : ''
          return `- Objeção: "${obj.name}" | Formas de quebrar: ${rebuttals || 'Não configurado'}`
        }).join('\n')
      }

      const response = await fetch('/api/meet/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: session.transcript,
          sellerName: sellerName.trim(),
          callObjective: callObjective.trim() || null,
          objections: objectionsText || null,
          meetingId: session.meetingId,
          userId,
          companyId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Falha ao avaliar call')
      }

      const data = await response.json()
      setEvaluation(data.evaluation)
      setShowEvaluationModal(true)

    } catch (err: any) {
      console.error('Evaluation error:', err)
      setEvaluationError(err.message || 'Erro ao avaliar call')
    } finally {
      setIsEvaluating(false)
    }
  }

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
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
      idle: { icon: Clock, text: 'Aguardando', color: 'text-gray-400' },
      sending: { icon: Loader2, text: 'Enviando bot...', color: 'text-yellow-400' },
      joining: { icon: Loader2, text: 'Entrando na reunião...', color: 'text-yellow-400' },
      in_meeting: { icon: Video, text: 'Na reunião', color: 'text-green-400' },
      transcribing: { icon: Video, text: 'Transcrevendo...', color: 'text-green-400' },
      ended: { icon: CheckCircle, text: 'Encerrado', color: 'text-blue-400' },
      error: { icon: XCircle, text: 'Erro', color: 'text-red-400' }
    }

    const config = statusConfig[session.status]
    const Icon = config.icon

    return (
      <div className={`flex items-center gap-2 ${config.color}`}>
        <Icon className={`w-5 h-5 ${session.status === 'sending' || session.status === 'joining' ? 'animate-spin' : ''}`} />
        <span className="font-medium">{config.text}</span>
      </div>
    )
  }

  // Render SPIN score card
  const renderSpinScore = (letter: string, score: number, feedback: string) => (
    <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-bold text-white">{letter}</span>
        <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
          {score.toFixed(1)}
        </span>
      </div>
      <p className="text-sm text-gray-400 line-clamp-3">{feedback}</p>
    </div>
  )

  return (
    <div className="min-h-screen py-8 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-2xl flex items-center justify-center border border-green-500/30">
            <Video className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Análise de Google Meet
          </h1>
          <p className="text-gray-400">
            Cole o link da reunião e nosso bot entrará para transcrever e avaliar a conversa
          </p>
        </div>

        {/* Input Section */}
        {!session && (
          <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-green-500/30 mb-6">
            <div className="space-y-4">
              {/* Meet URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Link do Google Meet
                </label>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={meetUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      placeholder="https://meet.google.com/abc-defg-hij"
                      className="w-full px-4 py-3.5 bg-gray-800/60 border border-green-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60 focus:bg-gray-800/80 transition-all"
                    />
                    {meetingId && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">
                          {meetingId}
                        </span>
                        <button
                          onClick={copyMeetingId}
                          className="text-gray-400 hover:text-green-400 transition-colors"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Call Objective */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Objetivo da Call <span className="text-gray-500 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={callObjective}
                  onChange={(e) => setCallObjective(e.target.value)}
                  placeholder="Ex: Apresentar proposta comercial, Fazer discovery, Negociar contrato..."
                  className="w-full px-4 py-3 bg-gray-800/60 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60 focus:bg-gray-800/80 transition-all"
                />
              </div>

              {/* Send Button */}
              <button
                onClick={sendBot}
                disabled={!meetingId}
                className="w-full px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 hover:shadow-green-500/50"
              >
                <Send className="w-5 h-5" />
                Enviar Bot para a Reunião
              </button>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Instructions */}
            <div className="mt-6 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Como funciona:</h3>
              <ol className="text-sm text-gray-400 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 font-bold">1.</span>
                  Cole o link da reunião do Google Meet acima
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 font-bold">2.</span>
                  Clique em "Enviar Bot" - um participante chamado "VexaBot" pedirá para entrar
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 font-bold">3.</span>
                  <strong className="text-yellow-400">Aceite o bot na reunião</strong> quando ele pedir para participar
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 font-bold">4.</span>
                  A transcrição aparecerá em tempo real e você poderá avaliar ao final
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Session Active */}
        {session && (
          <div className="space-y-6">
            {/* Status Bar */}
            <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-4 border border-green-500/30">
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
                  <span className="text-xs text-gray-400 bg-gray-800/60 px-3 py-1.5 rounded-lg">
                    Meeting: {session.meetingId}
                  </span>
                  {session.status !== 'ended' && session.status !== 'error' && (
                    <button
                      onClick={endSession}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center gap-2 border border-red-500/30"
                    >
                      <StopCircle className="w-4 h-4" />
                      Encerrar
                    </button>
                  )}
                  {(session.status === 'ended' || session.status === 'error') && (
                    <button
                      onClick={resetSession}
                      className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors flex items-center gap-2 border border-green-500/30"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Nova Análise
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl border border-green-500/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-800/40">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
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
                className="h-[400px] overflow-y-auto p-4 space-y-4"
              >
                {session.transcript.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    {session.status === 'joining' || session.status === 'sending' ? (
                      <>
                        <Loader2 className="w-8 h-8 animate-spin mb-3" />
                        <p>Aguardando bot entrar na reunião...</p>
                        <p className="text-sm text-gray-400 mt-2">
                          Isso geralmente leva de 10 a 15 segundos
                        </p>
                        <p className="text-sm text-yellow-400 mt-2">
                          Lembre-se de aceitar o "VexaBot" quando ele pedir para entrar!
                        </p>
                      </>
                    ) : session.status === 'in_meeting' ? (
                      <>
                        <Video className="w-8 h-8 mb-3 text-green-400" />
                        <p>Bot na reunião. Aguardando transcrição...</p>
                      </>
                    ) : (
                      <>
                        <Clock className="w-8 h-8 mb-3" />
                        <p>Nenhuma transcrição ainda</p>
                      </>
                    )}
                  </div>
                ) : (
                  session.transcript.map((segment, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10 flex items-center justify-center border border-green-500/30">
                        <User className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-green-400 text-sm">
                            {segment.speaker}
                          </span>
                          {segment.timestamp && (
                            <span className="text-xs text-gray-500">
                              {segment.timestamp}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {segment.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Evaluation Section - Only when ended with transcript */}
            {session.status === 'ended' && session.transcript.length > 0 && (
              <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-2xl p-6 border border-blue-500/30">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Avaliar Desempenho do Vendedor
                </h3>

                {/* Info Summary */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="px-3 py-2 bg-gray-800/60 rounded-lg border border-gray-600/50">
                    <span className="text-xs text-gray-400">Vendedor:</span>
                    <span className="text-sm text-white ml-2">{sellerName}</span>
                  </div>
                  {callObjective && (
                    <div className="px-3 py-2 bg-gray-800/60 rounded-lg border border-gray-600/50">
                      <span className="text-xs text-gray-400">Objetivo:</span>
                      <span className="text-sm text-white ml-2">{callObjective}</span>
                    </div>
                  )}
                </div>

                {evaluationError && (
                  <div className="mb-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/30">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {evaluationError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={evaluateCall}
                    disabled={isEvaluating}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 rounded-xl font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30"
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Avaliando... (pode levar até 30s)
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-5 h-5" />
                        Avaliar Call com IA
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      const text = session.transcript
                        .map(s => `${s.speaker}: ${s.text}`)
                        .join('\n')
                      navigator.clipboard.writeText(text)
                    }}
                    className="px-4 py-3 bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 rounded-xl transition-colors flex items-center gap-2 border border-gray-600/50"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar
                  </button>
                </div>

                {/* Show evaluation result button if already evaluated */}
                {evaluation && (
                  <button
                    onClick={() => setShowEvaluationModal(true)}
                    className="w-full mt-4 px-4 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl transition-colors flex items-center justify-center gap-2 border border-green-500/30"
                  >
                    <Award className="w-5 h-5" />
                    Ver Resultado da Avaliação (Nota: {evaluation.overall_score})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Evaluation Modal */}
        {showEvaluationModal && evaluation && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl w-full max-w-4xl border border-gray-700/50 shadow-2xl">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm px-6 py-4 border-b border-gray-700/50 rounded-t-2xl flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                  <div className={`px-4 py-2 rounded-xl ${getPerformanceConfig(evaluation.performance_level).bgColor}`}>
                    <span className={`text-3xl font-bold ${getPerformanceConfig(evaluation.performance_level).color}`}>
                      {evaluation.overall_score}
                    </span>
                    <span className="text-gray-400 text-sm ml-1">/100</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Avaliação da Call</h2>
                    <p className={`text-sm ${getPerformanceConfig(evaluation.performance_level).color}`}>
                      {getPerformanceConfig(evaluation.performance_level).label}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEvaluationModal(false)}
                  className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Executive Summary */}
                <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    Resumo Executivo
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                    {evaluation.executive_summary}
                  </p>
                </div>

                {/* Strengths & Gaps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {evaluation.top_strengths.length > 0 && (
                    <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
                      <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Pontos Fortes
                      </h3>
                      <ul className="space-y-2">
                        {evaluation.top_strengths.map((strength, idx) => (
                          <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                            <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.critical_gaps.length > 0 && (
                    <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                      <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        Gaps Críticos
                      </h3>
                      <ul className="space-y-2">
                        {evaluation.critical_gaps.map((gap, idx) => (
                          <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            {gap}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* SPIN Evaluation */}
                <div className="border border-gray-700/50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('spin')}
                    className="w-full px-4 py-3 bg-gray-800/40 flex items-center justify-between hover:bg-gray-800/60 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <Target className="w-4 h-4 text-purple-400" />
                      Avaliação SPIN
                    </h3>
                    {expandedSections.spin ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </button>
                  {expandedSections.spin && (
                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {renderSpinScore('S', evaluation.spin_evaluation.S.final_score, evaluation.spin_evaluation.S.technical_feedback)}
                      {renderSpinScore('P', evaluation.spin_evaluation.P.final_score, evaluation.spin_evaluation.P.technical_feedback)}
                      {renderSpinScore('I', evaluation.spin_evaluation.I.final_score, evaluation.spin_evaluation.I.technical_feedback)}
                      {renderSpinScore('N', evaluation.spin_evaluation.N.final_score, evaluation.spin_evaluation.N.technical_feedback)}
                    </div>
                  )}
                </div>

                {/* Objections Analysis */}
                {evaluation.objections_analysis.length > 0 && (
                  <div className="border border-gray-700/50 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection('objections')}
                      className="w-full px-4 py-3 bg-gray-800/40 flex items-center justify-between hover:bg-gray-800/60 transition-colors"
                    >
                      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                        Análise de Objeções ({evaluation.objections_analysis.length})
                      </h3>
                      {expandedSections.objections ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSections.objections && (
                      <div className="p-4 space-y-4">
                        {evaluation.objections_analysis.map((obj, idx) => (
                          <div key={idx} className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded">
                                {obj.objection_type} • {obj.objection_nature}
                              </span>
                              <span className={`text-lg font-bold ${getScoreColor(obj.score)}`}>
                                {obj.score}/10
                              </span>
                            </div>
                            <p className="text-sm text-gray-300 italic mb-2">"{obj.objection_text}"</p>
                            <p className="text-sm text-gray-400">{obj.detailed_analysis}</p>
                            {obj.ideal_response && (
                              <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                                <p className="text-xs text-green-400 font-semibold mb-1">Resposta Ideal:</p>
                                <p className="text-sm text-gray-300">{obj.ideal_response}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Soft Skills */}
                <div className="border border-gray-700/50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection('softSkills')}
                    className="w-full px-4 py-3 bg-gray-800/40 flex items-center justify-between hover:bg-gray-800/60 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      Soft Skills
                    </h3>
                    {expandedSections.softSkills ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </button>
                  {expandedSections.softSkills && (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg">
                        <span className="text-sm text-gray-300">Rapport</span>
                        <span className={`font-bold ${getScoreColor(evaluation.soft_skills_evaluation.rapport_score)}`}>
                          {evaluation.soft_skills_evaluation.rapport_score}/10
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg">
                        <span className="text-sm text-gray-300">Controle da Conversa</span>
                        <span className={`font-bold ${getScoreColor(evaluation.soft_skills_evaluation.conversation_control_score)}`}>
                          {evaluation.soft_skills_evaluation.conversation_control_score}/10
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg">
                        <span className="text-sm text-gray-300">Escuta Ativa</span>
                        <span className={`font-bold ${getScoreColor(evaluation.soft_skills_evaluation.active_listening_score)}`}>
                          {evaluation.soft_skills_evaluation.active_listening_score}/10
                        </span>
                      </div>
                      {evaluation.soft_skills_evaluation.stakeholder_management_score !== null && (
                        <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg">
                          <span className="text-sm text-gray-300">Gestão de Stakeholders</span>
                          <span className={`font-bold ${getScoreColor(evaluation.soft_skills_evaluation.stakeholder_management_score)}`}>
                            {evaluation.soft_skills_evaluation.stakeholder_management_score}/10
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Priority Improvements */}
                {evaluation.priority_improvements.length > 0 && (
                  <div className="border border-gray-700/50 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection('improvements')}
                      className="w-full px-4 py-3 bg-gray-800/40 flex items-center justify-between hover:bg-gray-800/60 transition-colors"
                    >
                      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-yellow-400" />
                        Melhorias Prioritárias ({evaluation.priority_improvements.length})
                      </h3>
                      {expandedSections.improvements ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </button>
                    {expandedSections.improvements && (
                      <div className="p-4 space-y-4">
                        {evaluation.priority_improvements.map((imp, idx) => (
                          <div key={idx} className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/50">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                imp.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                imp.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {imp.priority === 'critical' ? 'Crítico' : imp.priority === 'high' ? 'Alta' : 'Média'}
                              </span>
                              <span className="text-sm font-semibold text-white">{imp.area}</span>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">{imp.current_gap}</p>
                            <p className="text-sm text-gray-300">{imp.action_plan}</p>
                            {imp.training_suggestion && (
                              <p className="text-xs text-blue-400 mt-2">💡 {imp.training_suggestion}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm px-6 py-4 border-t border-gray-700/50 rounded-b-2xl">
                <button
                  onClick={() => setShowEvaluationModal(false)}
                  className="w-full py-3 bg-gray-700/50 hover:bg-gray-700/70 rounded-xl font-semibold text-white transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
