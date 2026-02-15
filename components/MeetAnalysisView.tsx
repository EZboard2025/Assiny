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
  X,
  BookOpen,
  FileText,
  Save,
  Link,
  UserPlus,
  Mic,
  BarChart3,
  Sparkles
} from 'lucide-react'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'
import { supabase } from '@/lib/supabase'

type BotStatus = 'idle' | 'sending' | 'joining' | 'in_meeting' | 'transcribing' | 'ended' | 'evaluating' | 'error'

interface TranscriptSegment {
  speaker: string
  text: string
  timestamp: string
}

interface MeetingSession {
  botId: string // UUID from Recall.ai
  meetingUrl: string
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
  playbook_adherence?: {
    overall_adherence_score: number
    adherence_level: string
    dimensions: {
      opening?: { score: number; status: string; dimension_feedback: string }
      closing?: { score: number; status: string; dimension_feedback: string }
      conduct?: { score: number; status: string; dimension_feedback: string }
      required_scripts?: { score: number; status: string; dimension_feedback: string }
      process?: { score: number; status: string; dimension_feedback: string }
    }
    violations: any[]
    missed_requirements: any[]
    exemplary_moments: any[]
    coaching_notes: string
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

// Speaker avatar colors
const speakerColors = [
  { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
  { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' },
]

const getSpeakerColor = (speaker: string, speakerMap: Map<string, number>) => {
  const key = speaker.trim().toLowerCase()
  if (!speakerMap.has(key)) {
    speakerMap.set(key, speakerMap.size % speakerColors.length)
  }
  return speakerColors[speakerMap.get(key)!]
}

const getScoreColor = (score: number) => {
  if (score >= 7) return 'text-green-600'
  if (score >= 5) return 'text-amber-600'
  return 'text-red-600'
}

const getScoreBg = (score: number) => {
  if (score >= 7) return 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
  if (score >= 5) return 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
  return 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
}

const getPerformanceLabel = (level: string) => {
  const labels: Record<string, string> = {
    'legendary': 'Lendário',
    'excellent': 'Excelente',
    'very_good': 'Muito Bom',
    'good': 'Bom',
    'needs_improvement': 'Precisa Melhorar',
    'poor': 'Em Desenvolvimento'
  }
  return labels[level] || level
}

export default function MeetAnalysisView() {
  const [meetUrl, setMeetUrl] = useState('')
  const [session, setSession] = useState<MeetingSession | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [evaluation, setEvaluation] = useState<MeetEvaluation | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedToHistory, setSavedToHistory] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasTriggeredAutoEvalRef = useRef<boolean>(false)
  const speakerMapRef = useRef<Map<string, number>>(new Map())
  const sessionRef = useRef<MeetingSession | null>(null)

  // Keep ref in sync with state so async callbacks always see latest session
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // Validate Google Meet URL
  const isValidMeetUrl = (url: string): boolean => {
    const pattern = /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i
    return pattern.test(url)
  }

  // Handle URL input change
  const handleUrlChange = (value: string) => {
    setMeetUrl(value)
    setError('')
  }

  // Send bot to meeting using Recall.ai
  const sendBot = async () => {
    if (!meetUrl) {
      setError('Por favor, insira um link do Google Meet')
      return
    }

    let fullUrl = meetUrl.trim()
    if (!fullUrl.startsWith('http')) {
      fullUrl = 'https://' + fullUrl
    }

    if (!isValidMeetUrl(fullUrl)) {
      setError('Por favor, insira um link válido do Google Meet (ex: meet.google.com/abc-defg-hij)')
      return
    }

    setEvaluation(null)
    setSavedToHistory(false)
    hasTriggeredAutoEvalRef.current = false
    speakerMapRef.current = new Map()

    setSession({
      botId: '',
      meetingUrl: fullUrl,
      status: 'sending',
      transcript: []
    })
    setError('')

    try {
      console.log('🤖 Enviando bot para reunião:', fullUrl)

      const response = await fetch('/api/recall/create-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingUrl: fullUrl,
          botName: 'Ramppy'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao criar bot')
      }

      console.log('✅ Bot criado:', data.botId)

      setSession(prev => prev ? {
        ...prev,
        botId: data.botId,
        status: 'joining',
        startTime: new Date()
      } : null)

      startPolling(data.botId)

    } catch (err: any) {
      console.error('❌ Error sending bot:', err)
      setError(err.message || 'Erro ao enviar bot')
      setSession(prev => prev ? { ...prev, status: 'error' } : null)
    }
  }

  // Poll for bot status and transcripts
  const startPolling = (botId: string) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
    }

    const poll = async () => {
      try {
        const statusRes = await fetch(`/api/recall/bot-status?botId=${botId}`)

        if (statusRes.ok) {
          const statusData = await statusRes.json()
          console.log('📊 Bot status:', statusData.status, '(recall:', statusData.recallStatus, ')')

          setSession(prev => {
            if (!prev) return null

            let newStatus: BotStatus = prev.status

            switch (statusData.status) {
              case 'ready':
              case 'joining':
                newStatus = 'joining'
                break
              case 'in_meeting':
                newStatus = 'in_meeting'
                break
              case 'transcribing':
                newStatus = 'transcribing'
                break
              case 'ended':
                if (!hasTriggeredAutoEvalRef.current && prev.status !== 'ended') {
                  console.log('🤖 Bot saiu automaticamente, iniciando avaliação...')
                  hasTriggeredAutoEvalRef.current = true
                  stopPolling()
                  setTimeout(() => triggerAutoEvaluation(botId), 500)
                }
                newStatus = 'ended'
                break
              case 'error':
                newStatus = 'error'
                stopPolling()
                break
            }

            return { ...prev, status: newStatus }
          })
        }

        const transcriptRes = await fetch(`/api/recall/webhook?botId=${botId}`)

        if (transcriptRes.ok) {
          const transcriptData = await transcriptRes.json()

          if (transcriptData.transcript && transcriptData.transcript.length > 0) {
            const segments: TranscriptSegment[] = transcriptData.transcript.map((seg: any) => ({
              speaker: seg.speaker || 'Participante',
              text: seg.text || '',
              timestamp: seg.timestamp || ''
            }))

            const consolidatedTranscript = consolidateTranscript(segments)

            setSession(prev => {
              if (!prev) return null

              const newStatus = prev.status === 'in_meeting' || prev.status === 'joining'
                ? 'transcribing'
                : prev.status

              return {
                ...prev,
                status: newStatus,
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

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  const triggerAutoEvaluation = async (botId: string) => {
    console.log('🔄 Iniciando avaliação automática...')

    setSession(prev => prev ? { ...prev, status: 'evaluating' } : null)

    console.log('⏳ Aguardando processamento da transcrição final...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Use ref to read the latest session state (avoids stale closure + React 18 batching issues)
    const currentSession = sessionRef.current
    let transcriptToEvaluate: TranscriptSegment[] = currentSession?.transcript || []

    if (transcriptToEvaluate.length === 0) {
      console.log(`📡 Sem transcrição local, buscando da API...`)
      try {
        const response = await fetch(`/api/recall/webhook?botId=${botId}&fallback=true`)
        const data = await response.json()
        if (data.transcript && data.transcript.length > 0) {
          transcriptToEvaluate = data.transcript
          setSession(prev => prev ? { ...prev, transcript: data.transcript } : null)
          console.log(`✅ Transcrição da API: ${data.transcript.length} segmentos`)
        }
      } catch (err) {
        console.error('Error fetching final transcript:', err)
      }
    } else {
      console.log(`📝 Usando transcrição local: ${transcriptToEvaluate.length} segmentos`)
    }

    if (transcriptToEvaluate.length > 0) {
      await evaluateTranscript(transcriptToEvaluate, botId)
    } else {
      console.log('⚠️ Nenhuma transcrição encontrada para avaliar')
      setSession(prev => prev ? { ...prev, status: 'ended' } : null)
      setError('Nenhuma transcrição foi capturada. A reunião pode não ter tido áudio ou o bot não conseguiu gravar.')
    }

    try {
      await fetch(`/api/recall/webhook?botId=${botId}`, {
        method: 'DELETE'
      })
    } catch (err) {
      console.error('Error cleaning up transcript:', err)
    }
  }

  const endSession = async () => {
    hasTriggeredAutoEvalRef.current = true
    setIsEnding(true)
    stopPolling()

    // Use ref to get the latest session (avoids stale closure)
    const currentSession = sessionRef.current
    const botId = currentSession?.botId

    if (botId) {
      try {
        console.log('🛑 Parando bot:', botId)
        await fetch('/api/recall/stop-bot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botId })
        })
      } catch (err) {
        console.error('Error stopping bot:', err)
      }
    }

    setSession(prev => prev ? { ...prev, status: 'evaluating' } : null)

    console.log('⏳ Aguardando processamento da transcrição...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Re-read ref after the 5s wait to get any transcript updates
    const latestSession = sessionRef.current
    let transcriptToEvaluate = latestSession?.transcript || []

    if (botId && transcriptToEvaluate.length === 0) {
      console.log(`📡 Sem transcrição local, buscando da API...`)
      try {
        const response = await fetch(`/api/recall/webhook?botId=${botId}&fallback=true`)
        const data = await response.json()
        if (data.transcript && data.transcript.length > 0) {
          transcriptToEvaluate = data.transcript
          setSession(prev => prev ? { ...prev, transcript: data.transcript } : null)
          console.log(`✅ Transcrição da API: ${data.transcript.length} segmentos`)
        }
      } catch (err) {
        console.error('Error fetching final transcript:', err)
      }
    } else if (transcriptToEvaluate.length > 0) {
      console.log(`📝 Usando transcrição local: ${transcriptToEvaluate.length} segmentos`)
    }

    if (transcriptToEvaluate.length > 0) {
      await evaluateTranscript(transcriptToEvaluate, botId)
    } else {
      console.log('⚠️ Nenhuma transcrição encontrada para avaliar')
      setSession(prev => prev ? { ...prev, status: 'ended' } : null)
      setError('Nenhuma transcrição foi capturada. A reunião pode não ter tido áudio ou o bot não conseguiu gravar.')
    }

    if (botId) {
      try {
        await fetch(`/api/recall/webhook?botId=${botId}`, {
          method: 'DELETE'
        })
      } catch (err) {
        console.error('Error cleaning up transcript:', err)
      }
    }

    setIsEnding(false)
  }

  const saveEvaluationToHistory = async (
    evalData: MeetEvaluation,
    transcriptData: TranscriptSegment[],
    botId: string
  ) => {
    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('❌ User not authenticated, cannot save evaluation')
        return false
      }

      const companyId = await getCompanyId()
      if (!companyId) {
        console.error('❌ Company ID not found, cannot save evaluation')
        return false
      }

      let overallScore = evalData.overall_score
      if (overallScore && overallScore <= 10) {
        overallScore = overallScore * 10
      }

      const insertData = {
        user_id: user.id,
        company_id: companyId,
        meeting_id: botId,
        seller_name: evalData.seller_identification?.name || 'Não identificado',
        call_objective: null,
        funnel_stage: null,
        transcript: transcriptData,
        evaluation: evalData,
        overall_score: Math.round(overallScore || 0),
        performance_level: evalData.performance_level || 'needs_improvement',
        spin_s_score: evalData.spin_evaluation?.S?.final_score || 0,
        spin_p_score: evalData.spin_evaluation?.P?.final_score || 0,
        spin_i_score: evalData.spin_evaluation?.I?.final_score || 0,
        spin_n_score: evalData.spin_evaluation?.N?.final_score || 0
      }

      console.log('💾 Salvando avaliação no histórico...', insertData.meeting_id)

      const { error } = await supabase
        .from('meet_evaluations')
        .insert(insertData)

      if (error) {
        console.error('❌ Erro ao salvar avaliação:', error)
        return false
      }

      console.log('✅ Avaliação salva no histórico com sucesso!')
      setSavedToHistory(true)
      return true
    } catch (err) {
      console.error('❌ Erro ao salvar avaliação:', err)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const evaluateTranscript = async (transcriptData?: TranscriptSegment[], botIdOverride?: string) => {
    // Use ref for latest session to avoid stale closure issues
    const currentSession = sessionRef.current
    const transcriptToUse = transcriptData || currentSession?.transcript || []
    const botId = botIdOverride || currentSession?.botId

    if (transcriptToUse.length === 0) {
      console.log('⚠️ evaluateTranscript: sem transcrição para avaliar')
      return
    }

    setIsEvaluating(true)
    setError('')

    try {
      const transcriptText = transcriptToUse
        .map(s => `${s.speaker}: ${s.text}`)
        .join('\n')

      console.log('📊 Enviando transcrição para avaliação...', { botId, segments: transcriptToUse.length })

      const companyId = await getCompanyId()
      console.log('🏢 Company ID para avaliação:', companyId || 'não encontrado')

      const response = await fetch('/api/meet/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          meetingId: botId,
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
        if (data.evaluation.playbook_adherence) {
          console.log('📖 Playbook Adherence:', data.evaluation.playbook_adherence.overall_adherence_score + '%')
        }
        setEvaluation(data.evaluation)
        setShowEvaluationModal(true)

        if (botId) {
          await saveEvaluationToHistory(data.evaluation, transcriptToUse, botId)
        }
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

  const resetSession = () => {
    stopPolling()
    hasTriggeredAutoEvalRef.current = false
    speakerMapRef.current = new Map()
    setSession(null)
    setMeetUrl('')
    setError('')
    setEvaluation(null)
    setIsEvaluating(false)
    setSavedToHistory(false)
  }

  const copyMeetUrl = () => {
    navigator.clipboard.writeText(meetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [session?.transcript])

  useEffect(() => {
    return () => stopPolling()
  }, [])

  // Get status config
  const getStatusConfig = () => {
    if (!session) return null

    const statusConfig: Record<BotStatus, { icon: any; text: string; color: string; dotColor: string; bgColor: string }> = {
      idle: { icon: Clock, text: 'Aguardando', color: 'text-gray-500', dotColor: 'bg-gray-400', bgColor: 'bg-gray-50' },
      sending: { icon: Loader2, text: 'Criando bot...', color: 'text-amber-600', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50' },
      joining: { icon: Loader2, text: 'Entrando na reunião...', color: 'text-amber-600', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50' },
      in_meeting: { icon: Video, text: 'Na reunião', color: 'text-green-600', dotColor: 'bg-green-500', bgColor: 'bg-green-50' },
      transcribing: { icon: Video, text: 'Transcrevendo...', color: 'text-green-600', dotColor: 'bg-green-500', bgColor: 'bg-green-50' },
      evaluating: { icon: Loader2, text: 'Avaliando performance...', color: 'text-emerald-600', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50' },
      ended: { icon: CheckCircle, text: 'Encerrado', color: 'text-blue-600', dotColor: 'bg-blue-500', bgColor: 'bg-blue-50' },
      error: { icon: XCircle, text: 'Erro', color: 'text-red-600', dotColor: 'bg-red-500', bgColor: 'bg-red-50' }
    }

    return statusConfig[session.status]
  }

  const isLive = session?.status === 'in_meeting' || session?.status === 'transcribing' || session?.status === 'sending' || session?.status === 'joining'
  const isSpinning = session?.status === 'sending' || session?.status === 'joining' || session?.status === 'evaluating'

  return (
    <div className="min-h-screen bg-[#F8F9FA] py-8 px-6">
      <div className="max-w-4xl mx-auto">

        {/* ==================== HERO / INITIAL STATE ==================== */}
        {!session && (
          <div className="animate-fade-in pt-10">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-emerald-500/20 to-green-400/10 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <Video className="w-10 h-10 text-emerald-600" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent mb-3">
                Análise de Google Meet
              </h1>
              <p className="text-gray-500 text-lg max-w-md mx-auto">
                Cole o link da reunião e nosso bot entrará para transcrever e avaliar a conversa
              </p>
            </div>

            {/* Input Card */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg mb-8">
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Link className="w-4 h-4 text-emerald-600" />
                Link do Google Meet
              </label>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={meetUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    className="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                  {meetUrl && isValidMeetUrl(meetUrl) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-medium">
                        Válido
                      </span>
                      <button
                        onClick={copyMeetUrl}
                        className="text-gray-400 hover:text-emerald-600 transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={sendBot}
                  disabled={!meetUrl}
                  className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl font-semibold text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Send className="w-5 h-5" />
                  Enviar Bot
                </button>
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-200">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {/* Step Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { icon: Link, label: 'Cole o link', desc: 'Insira o link da reunião do Google Meet', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                { icon: Send, label: 'Envie o bot', desc: 'Clique em "Enviar Bot" e "Ramppy" pedirá para entrar', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                { icon: UserPlus, label: 'Aceite na reunião', desc: 'Aceite o participante "Ramppy" no Google Meet', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                { icon: BarChart3, label: 'Receba a análise', desc: 'Encerre e receba a avaliação SPIN completa', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={`${step.bg} border ${step.border} rounded-2xl p-4 text-center hover:shadow-md transition-all duration-300`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className={`w-10 h-10 mx-auto mb-3 rounded-xl ${step.bg} flex items-center justify-center`}>
                    <step.icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                  <div className={`text-xs font-bold ${step.color} mb-0.5`}>Passo {idx + 1}</div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{step.label}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-700">Importante</p>
                  <p className="text-sm text-amber-600 mt-0.5">
                    Ao terminar a reunião, clique no botão <strong>"Encerrar"</strong> para finalizar a gravação e gerar a avaliação automaticamente.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== ACTIVE SESSION ==================== */}
        {session && (
          <div className="space-y-5 animate-fade-in">
            {/* Status Bar */}
            {(() => {
              const config = getStatusConfig()
              if (!config) return null
              const Icon = config.icon
              return (
                <div className={`bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-lg overflow-hidden`}>
                  <div className={`h-1 ${isLive ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 animate-shimmer' : session.status === 'evaluating' ? 'bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 animate-shimmer' : session.status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-2.5 ${config.color}`}>
                        {isLive && (
                          <span className="relative flex h-3 w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-75`} />
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${config.dotColor}`} />
                          </span>
                        )}
                        <Icon className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
                        <span className="font-semibold text-sm">{config.text}</span>
                      </div>
                      {session.startTime && (
                        <span className="text-sm text-gray-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Iniciado às {session.startTime.toLocaleTimeString('pt-BR')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {session.status !== 'ended' && session.status !== 'error' && (
                        <button
                          onClick={endSession}
                          disabled={isEnding}
                          className={`px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 text-sm font-semibold ${
                            isEnding
                              ? 'bg-amber-50 text-amber-600 border border-amber-200 cursor-not-allowed'
                              : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md shadow-red-500/20 hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]'
                          }`}
                        >
                          {isEnding ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Encerrando...
                            </>
                          ) : (
                            <>
                              <StopCircle className="w-4 h-4" />
                              Encerrar
                            </>
                          )}
                        </button>
                      )}
                      {(session.status === 'ended' || session.status === 'error') && (
                        <button
                          onClick={resetSession}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-200 flex items-center gap-2 text-sm font-semibold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Nova Análise
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Error display */}
            {error && session.status === 'ended' && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-200">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* In Progress / Transcript - Hidden during evaluation */}
            {session.status !== 'evaluating' && !isEvaluating && session.status !== 'ended' && session.status !== 'error' && (
              <>
                {session.transcript.length === 0 ? (
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-lg p-12 flex flex-col items-center justify-center">
                    {session.status === 'joining' || session.status === 'sending' ? (
                      <>
                        <div className="w-14 h-14 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin mb-5" />
                        <p className="text-gray-800 font-semibold text-lg">Entrando na reunião...</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Isso geralmente leva de 10 a 30 segundos
                        </p>
                        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                          <p className="text-sm text-amber-600 font-medium flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Lembre-se de aceitar o "Ramppy" quando ele pedir para entrar!
                          </p>
                        </div>
                      </>
                    ) : session.status === 'in_meeting' || session.status === 'transcribing' ? (
                      <>
                        <div className="w-14 h-14 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin mb-5" />
                        <p className="text-gray-800 font-semibold text-lg">Reunião em andamento</p>
                        <p className="text-sm text-gray-400 mt-1">Gravando e transcrevendo a conversa...</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-full border-4 border-gray-200 border-t-gray-400 animate-spin mb-5" />
                        <p className="text-gray-400 font-medium">Aguardando...</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <div className="w-1.5 h-5 bg-gradient-to-b from-emerald-500 to-green-400 rounded-full" />
                        <Users className="w-4 h-4 text-emerald-600" />
                        Transcrição
                      </h3>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                        {session.transcript.length} {session.transcript.length === 1 ? 'fala' : 'falas'}
                      </span>
                    </div>

                    <div
                      ref={transcriptRef}
                      className="h-[420px] overflow-y-auto p-5 space-y-4 custom-scrollbar"
                    >
                      {session.transcript.map((segment, idx) => {
                        const color = getSpeakerColor(segment.speaker, speakerMapRef.current)
                        return (
                          <div key={idx} className="flex gap-3 animate-fade-in">
                            <div className={`flex-shrink-0 w-9 h-9 rounded-full ${color.bg} flex items-center justify-center`}>
                              <span className={`text-xs font-bold ${color.text}`}>
                                {segment.speaker.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className={`font-semibold text-sm ${color.text}`}>
                                  {segment.speaker}
                                </span>
                                {segment.timestamp && (
                                  <span className="text-xs text-gray-300">
                                    {segment.timestamp}
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-700 text-sm leading-relaxed">
                                {segment.text}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Evaluation Loading */}
            {(session.status === 'evaluating' || isEvaluating) && (
              <div className="bg-gradient-to-br from-emerald-500/5 to-green-400/5 rounded-2xl p-8 border border-emerald-500/20 shadow-lg flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin mb-6" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">Avaliando Performance...</h3>
                <p className="text-gray-500 text-sm mb-5">Analisando a reunião com metodologia SPIN Selling</p>
                <div className="w-full max-w-xs h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full animate-shimmer" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {/* Evaluation Results - Compact View */}
            {session.status === 'ended' && evaluation && (
              <div className="space-y-4 animate-fade-in">
                {/* Score Header */}
                <div
                  onClick={() => setShowEvaluationModal(true)}
                  className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-lg cursor-pointer hover:shadow-xl hover:border-emerald-500/30 transition-all duration-300 overflow-hidden"
                >
                  <div className="h-1 bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500" />
                  <div className="p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Avaliação da Reunião</h3>
                      {evaluation.seller_identification?.name && (
                        <p className="text-gray-500 text-sm">Vendedor: {evaluation.seller_identification.name}</p>
                      )}
                      <p className="text-emerald-600 text-sm mt-2 font-medium flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        Clique para ver detalhes completos
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-5xl font-black ${getScoreColor(evaluation.overall_score || 0)}`}>
                        {evaluation.overall_score?.toFixed(1)}
                      </div>
                      <div className="text-gray-500 text-sm font-medium mt-1">
                        {getPerformanceLabel(evaluation.performance_level || '')}
                      </div>
                      {evaluation.playbook_adherence && (
                        <div className="mt-2 flex items-center gap-1 justify-end text-gray-500">
                          <BookOpen className="w-4 h-4" />
                          <span className="text-sm">
                            Playbook: {evaluation.playbook_adherence.overall_adherence_score}%
                          </span>
                        </div>
                      )}
                      {savedToHistory && (
                        <div className="mt-1.5 flex items-center gap-1 justify-end text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Salvo no histórico</span>
                        </div>
                      )}
                      {isSaving && (
                        <div className="mt-1.5 flex items-center gap-1 justify-end text-gray-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-xs">Salvando...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick SPIN Scores */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 border border-gray-200 shadow-lg">
                  <div className="grid grid-cols-4 gap-3">
                    {['S', 'P', 'I', 'N'].map((letter) => {
                      const score = evaluation.spin_evaluation?.[letter as keyof typeof evaluation.spin_evaluation]?.final_score || 0
                      const labels: Record<string, string> = { S: 'Situação', P: 'Problema', I: 'Implicação', N: 'Necessidade' }
                      return (
                        <div key={letter} className={`rounded-xl p-3.5 text-center border ${getScoreBg(score)}`}>
                          <div className={`text-2xl font-black ${getScoreColor(score)}`}>{score.toFixed(1)}</div>
                          <div className="text-gray-600 text-xs font-semibold mt-0.5">{labels[letter]}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowEvaluationModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 flex items-center gap-2 font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <FileText className="w-4 h-4" />
                    Ver Avaliação Completa
                  </button>
                  <button
                    onClick={() => {
                      const text = session.transcript
                        .map(s => `${s.speaker}: ${s.text}`)
                        .join('\n')
                      navigator.clipboard.writeText(text)
                    }}
                    className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium border border-gray-200 hover:border-gray-300 shadow-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar Transcrição
                  </button>
                  <button
                    onClick={resetSession}
                    className="px-5 py-2.5 bg-white hover:bg-gray-50 text-emerald-600 rounded-xl transition-all duration-200 flex items-center gap-2 border border-gray-200 hover:border-emerald-500/30 font-medium shadow-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Nova Análise
                  </button>
                </div>
              </div>
            )}

            {/* Session ended without evaluation and without transcript */}
            {session.status === 'ended' && !evaluation && session.transcript.length === 0 && !isEvaluating && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg text-center">
                <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Sessão encerrada sem transcrição</h3>
                <p className="text-gray-500 mb-5 text-sm">
                  Não foi possível capturar a transcrição desta reunião. Isso pode acontecer se o bot não conseguiu gravar ou se houve um erro na conexão.
                </p>
                <button
                  onClick={resetSession}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 flex items-center gap-2 font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tentar Novamente
                </button>
              </div>
            )}

            {/* Session ended without evaluation (has transcript) */}
            {session.status === 'ended' && !evaluation && session.transcript.length > 0 && !isEvaluating && (
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 shadow-lg">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Sessão Encerrada</h3>
                <p className="text-gray-500 mb-5">
                  A transcrição foi capturada. Você pode avaliar a performance ou copiar a transcrição.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => evaluateTranscript()}
                    disabled={isEvaluating}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 flex items-center gap-2 font-semibold disabled:opacity-50 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isEvaluating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
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
                    className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium border border-gray-200 hover:border-gray-300 shadow-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar Transcrição
                  </button>
                  <button
                    onClick={resetSession}
                    className="px-5 py-2.5 bg-white hover:bg-gray-50 text-emerald-600 rounded-xl transition-all duration-200 flex items-center gap-2 border border-gray-200 hover:border-emerald-500/30 font-medium shadow-sm"
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

      {/* ==================== EVALUATION MODAL ==================== */}
      {showEvaluationModal && evaluation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] overflow-y-auto">
          <div className="min-h-screen py-8 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 animate-scale-in">
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-11 h-11 bg-gradient-to-br from-emerald-500/20 to-green-400/10 rounded-xl flex items-center justify-center">
                      <Video className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Avaliação da Reunião</h2>
                      {evaluation.seller_identification?.name && (
                        <p className="text-gray-400 text-sm">Vendedor: {evaluation.seller_identification.name}</p>
                      )}
                    </div>
                  </div>
                  {savedToHistory && (
                    <div className="mt-2 flex items-center gap-1 text-green-600 text-sm ml-14">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Salvo no histórico</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-4xl font-black ${getScoreColor(evaluation.overall_score || 0)}`}>
                      {evaluation.overall_score?.toFixed(1)}
                    </div>
                    <div className="text-gray-400 text-sm font-medium">
                      {getPerformanceLabel(evaluation.performance_level || '')}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEvaluationModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* SPIN Scores */}
                <div className="rounded-2xl p-5 border border-gray-200">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                    Metodologia SPIN
                  </h3>
                  <div className="grid grid-cols-4 gap-4">
                    {['S', 'P', 'I', 'N'].map((letter) => {
                      const spinData = evaluation.spin_evaluation?.[letter as keyof typeof evaluation.spin_evaluation]
                      const score = spinData?.final_score || 0
                      const labels: Record<string, string> = { S: 'Situação', P: 'Problema', I: 'Implicação', N: 'Necessidade' }
                      return (
                        <div key={letter} className={`rounded-xl p-4 border ${getScoreBg(score)}`}>
                          <div className={`text-3xl font-black ${getScoreColor(score)}`}>{score.toFixed(1)}</div>
                          <div className="text-gray-600 text-sm font-semibold">{labels[letter]}</div>
                          {spinData?.technical_feedback && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-3 leading-relaxed">{spinData.technical_feedback}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Playbook Adherence */}
                {evaluation.playbook_adherence && (
                  <div className="rounded-2xl p-5 border border-gray-200">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-base font-bold text-gray-900">Aderência ao Playbook</h3>
                      <span className={`ml-auto px-3 py-1 rounded-full text-sm font-bold ${
                        evaluation.playbook_adherence.adherence_level === 'exemplary' ? 'bg-green-100 text-green-800' :
                        evaluation.playbook_adherence.adherence_level === 'compliant' ? 'bg-green-50 text-green-700' :
                        evaluation.playbook_adherence.adherence_level === 'partial' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {evaluation.playbook_adherence.overall_adherence_score}% - {
                          evaluation.playbook_adherence.adherence_level === 'exemplary' ? 'Exemplar' :
                          evaluation.playbook_adherence.adherence_level === 'compliant' ? 'Conforme' :
                          evaluation.playbook_adherence.adherence_level === 'partial' ? 'Parcial' : 'Não Conforme'
                        }
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-3 mb-4">
                      {Object.entries(evaluation.playbook_adherence.dimensions || {}).map(([key, dim]) => {
                        if (!dim) return null
                        const dimLabels: Record<string, string> = {
                          opening: 'Abertura',
                          closing: 'Fechamento',
                          conduct: 'Conduta',
                          required_scripts: 'Scripts',
                          process: 'Processo'
                        }
                        const dimScoreBg = dim.score >= 70 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : dim.score >= 50 ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200' : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
                        const dimScoreColor = dim.score >= 70 ? 'text-green-600' : dim.score >= 50 ? 'text-amber-600' : 'text-red-600'
                        return (
                          <div key={key} className={`rounded-xl p-3 text-center border ${dimScoreBg}`}>
                            <div className={`text-xl font-black ${dimScoreColor}`}>{dim.score}%</div>
                            <div className="text-xs text-gray-600 font-medium">{dimLabels[key] || key}</div>
                          </div>
                        )
                      })}
                    </div>

                    {evaluation.playbook_adherence.violations && evaluation.playbook_adherence.violations.length > 0 && (
                      <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 mb-3 border border-red-200">
                        <h4 className="text-sm font-bold text-red-800 mb-2">Violações</h4>
                        <ul className="space-y-1.5">
                          {evaluation.playbook_adherence.violations.map((v: any, i: number) => (
                            <li key={i} className="text-sm text-red-700 flex items-start gap-1.5">
                              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              {typeof v === 'string' ? v : v.criterion || v.evidence || JSON.stringify(v)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.playbook_adherence.exemplary_moments && evaluation.playbook_adherence.exemplary_moments.length > 0 && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 mb-3 border border-green-200">
                        <h4 className="text-sm font-bold text-green-800 mb-2">Momentos Exemplares</h4>
                        <ul className="space-y-2">
                          {evaluation.playbook_adherence.exemplary_moments.map((m: any, i: number) => (
                            <li key={i} className="text-sm text-green-700">
                              <div className="flex items-start gap-1.5">
                                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="font-medium">{typeof m === 'string' ? m : m.criterion || ''}</span>
                                  {typeof m === 'object' && m.evidence && (
                                    <p className="text-green-600 text-xs mt-0.5 italic">"{m.evidence}"</p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.playbook_adherence.coaching_notes && (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-700 mb-1">Notas de Coaching</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">{evaluation.playbook_adherence.coaching_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Executive Summary */}
                <div className="rounded-2xl p-5 border border-gray-200">
                  <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    Resumo Executivo
                  </h3>
                  <p className="text-gray-700 whitespace-pre-line leading-relaxed text-sm">{evaluation.executive_summary}</p>
                </div>

                {/* Strengths & Gaps */}
                <div className="grid grid-cols-2 gap-4">
                  {evaluation.top_strengths && evaluation.top_strengths.length > 0 && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Pontos Fortes
                      </h4>
                      <ul className="space-y-2">
                        {evaluation.top_strengths.map((strength: any, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-gray-700 text-sm">
                            <span className="text-green-500 mt-0.5 font-bold">•</span>
                            <span>{typeof strength === 'string' ? strength : strength?.text || strength?.description || JSON.stringify(strength)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.critical_gaps && evaluation.critical_gaps.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200">
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        Gaps Críticos
                      </h4>
                      <ul className="space-y-2">
                        {evaluation.critical_gaps.map((gap: any, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-gray-700 text-sm">
                            <span className="text-amber-500 mt-0.5 font-bold">•</span>
                            <span>{typeof gap === 'string' ? gap : gap?.text || gap?.description || JSON.stringify(gap)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Objections Analysis */}
                {evaluation.objections_analysis && evaluation.objections_analysis.length > 0 && (
                  <div className="rounded-2xl p-5 border border-gray-200">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-emerald-600" />
                      Análise de Objeções
                    </h3>
                    <div className="space-y-4">
                      {evaluation.objections_analysis.map((obj, idx) => (
                        <div key={idx} className="border-l-4 border-emerald-500/40 pl-4 py-2 bg-gray-50 rounded-r-xl">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                              {obj.objection_type}
                            </span>
                            <span className={`text-sm font-bold ${getScoreColor(obj.score)}`}>
                              Nota: {obj.score}/10
                            </span>
                          </div>
                          <p className="text-gray-500 text-sm italic mb-2">"{obj.objection_text}"</p>
                          <p className="text-gray-700 text-sm leading-relaxed">{obj.detailed_analysis}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Priority Improvements */}
                {evaluation.priority_improvements && evaluation.priority_improvements.length > 0 && (
                  <div className="rounded-2xl p-5 border border-gray-200">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-600" />
                      Melhorias Prioritárias
                    </h3>
                    <div className="space-y-3">
                      {evaluation.priority_improvements.map((imp, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                              imp.priority === 'critical' ? 'bg-red-100 text-red-700' :
                              imp.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {imp.priority === 'critical' ? 'Crítico' : imp.priority === 'high' ? 'Alta' : 'Média'}
                            </span>
                            <span className="font-semibold text-gray-900 text-sm">{imp.area}</span>
                          </div>
                          <p className="text-gray-500 text-sm mb-1"><strong className="text-gray-700">Gap:</strong> {imp.current_gap}</p>
                          <p className="text-gray-600 text-sm"><strong className="text-gray-700">Plano:</strong> {imp.action_plan}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => {
                    if (session) {
                      const text = session.transcript
                        .map(s => `${s.speaker}: ${s.text}`)
                        .join('\n')
                      navigator.clipboard.writeText(text)
                    }
                  }}
                  className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium border border-gray-200 hover:border-gray-300"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Transcrição
                </button>
                <button
                  onClick={() => setShowEvaluationModal(false)}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 flex items-center gap-2 font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
