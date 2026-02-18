'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Video,
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Users,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  BookOpen,
  FileText,
  Save,
  Target,
  Play,
  Lightbulb,
  Link2,
  UserCheck,
  ChevronRight,
  CalendarDays
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

// Strip GPT markdown formatting from text (bold **text**, em dashes —, etc.)
function cleanGptText(text: string): string {
  return text
    .replace(/\*\*/g, '')       // Remove **bold**
    .replace(/\*/g, '')         // Remove *italic*
    .replace(/\s*—\s*/g, ': ') // Replace em dash with colon
    .replace(/\s*–\s*/g, ': ') // Replace en dash with colon
    .replace(/^Tecnica:\s*/i, '') // Remove leading "Tecnica:" if already have colon from dash
    .trim()
}

export default function MeetAnalysisView() {
  const router = useRouter()
  const [meetUrl, setMeetUrl] = useState('')
  const [session, setSession] = useState<MeetingSession | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [evaluation, setEvaluation] = useState<MeetEvaluation | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [showEvaluationModal, setShowEvaluationModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedToHistory, setSavedToHistory] = useState(false)
  const [isGeneratingSimulation, setIsGeneratingSimulation] = useState(false)
  const [simulationConfig, setSimulationConfig] = useState<any>(null)
  const [savedSimulation, setSavedSimulation] = useState<any>(null)
  const [isSavingSimulation, setIsSavingSimulation] = useState(false)
  const [currentSimSaved, setCurrentSimSaved] = useState(false)
  const [recentEvaluations, setRecentEvaluations] = useState<any[]>([])
  const simulationRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasTriggeredAutoEvalRef = useRef<boolean>(false)
  const hasRestoredSessionRef = useRef<boolean>(false)

  // Restore active session from localStorage + load data on mount
  useEffect(() => {
    let restoredBotId: string | null = null

    // Restore session FIRST before any other effect can clear it
    try {
      const saved = localStorage.getItem('meetActiveSession')
      if (saved) {
        const parsed = JSON.parse(saved)
        const restored: MeetingSession = {
          ...parsed,
          startTime: parsed.startTime ? new Date(parsed.startTime) : undefined
        }
        const activeStatuses: BotStatus[] = ['sending', 'joining', 'in_meeting', 'transcribing', 'evaluating']
        if (activeStatuses.includes(restored.status) && restored.botId) {
          setSession(restored)
          setMeetUrl(restored.meetingUrl)
          hasRestoredSessionRef.current = true
          restoredBotId = restored.botId
          setTimeout(() => startPolling(restored.botId), 0)
        } else {
          localStorage.removeItem('meetActiveSession')
        }
      }
    } catch (e) {
      console.error('Error restoring session:', e)
      localStorage.removeItem('meetActiveSession')
    }

    // Load saved simulation + recent evaluations + check if evaluation already completed
    const loadSaved = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // If we restored a session, check if evaluation already completed in background
        if (restoredBotId) {
          const { data: existingEval } = await supabase
            .from('meet_evaluations')
            .select('evaluation')
            .eq('user_id', user.id)
            .eq('meeting_id', restoredBotId)
            .maybeSingle()

          if (existingEval?.evaluation) {
            // Evaluation already done — show results instead of polling
            stopPolling()
            setEvaluation(existingEval.evaluation)
            setSavedToHistory(true)
            setSession(prev => prev ? { ...prev, status: 'ended' } : null)
            localStorage.removeItem('meetActiveSession')
          }
        }

        const { data, error } = await supabase
          .from('saved_simulations')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!error && data) {
          setSavedSimulation(data)
        }

        const { data: evals } = await supabase
          .from('meet_evaluations')
          .select('id, overall_score, executive_summary, created_at, meeting_url')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (evals) {
          setRecentEvaluations(evals)
        }
      } catch (e) {
        console.error('Error loading data:', e)
      }
    }
    loadSaved()

    // Mark mount complete so persist effect can start working
    hasRestoredSessionRef.current = true
  }, [])

  // Persist session to localStorage (skip initial null before restore)
  useEffect(() => {
    if (!hasRestoredSessionRef.current) return
    if (session) {
      const toSave = {
        ...session,
        startTime: session.startTime?.toISOString() || null
      }
      localStorage.setItem('meetActiveSession', JSON.stringify(toSave))
    } else {
      localStorage.removeItem('meetActiveSession')
    }
  }, [session])

  // Save simulation for later (Supabase)
  const saveSimulationForLater = async () => {
    if (!simulationConfig || !evaluation) return
    setIsSavingSimulation(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const companyId = await getCompanyId()
      if (!companyId) return

      const { data, error } = await supabase
        .from('saved_simulations')
        .insert({
          user_id: user.id,
          company_id: companyId,
          simulation_config: simulationConfig,
          simulation_justification: simulationConfig.simulation_justification || null,
          meeting_context: simulationConfig.meeting_context || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving simulation:', error)
        return
      }

      setSavedSimulation(data)
      setCurrentSimSaved(true)
      setShowEvaluationModal(false)
    } catch (e) {
      console.error('Error saving simulation:', e)
    } finally {
      setIsSavingSimulation(false)
    }
  }

  // Discard saved simulation (Supabase)
  const discardSavedSimulation = async () => {
    if (!savedSimulation?.id) return
    try {
      await supabase
        .from('saved_simulations')
        .delete()
        .eq('id', savedSimulation.id)
    } catch (e) {
      console.error('Error deleting saved simulation:', e)
    }
    setSavedSimulation(null)
  }

  // Start saved simulation
  const startSavedSimulation = async () => {
    if (!savedSimulation) return
    // Pass simulation data to roleplay page via sessionStorage
    const meetSimData = {
      simulation_config: savedSimulation.simulation_config,
    }
    sessionStorage.setItem('meetSimulation', JSON.stringify(meetSimData))

    // Delete from Supabase (or mark as completed)
    if (savedSimulation.id) {
      try {
        await supabase
          .from('saved_simulations')
          .delete()
          .eq('id', savedSimulation.id)
      } catch (e) {
        console.error('Error deleting saved simulation:', e)
      }
    }

    setSavedSimulation(null)
    router.push('/roleplay')
  }

  // Validate Google Meet URL
  const isValidMeetUrl = (url: string): boolean => {
    // Patterns:
    // https://meet.google.com/abc-defg-hij
    // meet.google.com/abc-defg-hij
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

    // Ensure URL is properly formatted
    let fullUrl = meetUrl.trim()
    if (!fullUrl.startsWith('http')) {
      fullUrl = 'https://' + fullUrl
    }

    if (!isValidMeetUrl(fullUrl)) {
      setError('Por favor, insira um link válido do Google Meet (ex: meet.google.com/abc-defg-hij)')
      return
    }

    // Clear any previous evaluation state
    setEvaluation(null)
    setSavedToHistory(false)
    hasTriggeredAutoEvalRef.current = false

    setSession({
      botId: '',
      meetingUrl: fullUrl,
      status: 'sending',
      transcript: []
    })
    setError('')

    try {
      console.log('🤖 Enviando bot para reunião:', fullUrl)

      // Get user and company for background processing
      const { data: { user } } = await supabase.auth.getUser()
      const currentCompanyId = await getCompanyId()

      if (!user?.id || !currentCompanyId) {
        setError('Erro: usuário não autenticado ou empresa não encontrada')
        setSession(null)
        return
      }

      const response = await fetch('/api/recall/create-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingUrl: fullUrl,
          botName: 'Ramppy',
          userId: user.id,
          companyId: currentCompanyId
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

      // Start polling for status and transcripts
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
        // Get bot status
        const statusRes = await fetch(`/api/recall/bot-status?botId=${botId}`)

        if (statusRes.ok) {
          const statusData = await statusRes.json()
          console.log('📊 Bot status:', statusData.status, '(recall:', statusData.recallStatus, ')')

          // Update session status
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
                // Bot left automatically - trigger auto-evaluation
                if (!hasTriggeredAutoEvalRef.current && prev.status !== 'ended') {
                  console.log('🤖 Bot saiu automaticamente, iniciando avaliação...')
                  hasTriggeredAutoEvalRef.current = true
                  stopPolling()
                  // Trigger auto-evaluation after a short delay
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

        // Get transcript from webhook storage
        const transcriptRes = await fetch(`/api/recall/webhook?botId=${botId}`)

        if (transcriptRes.ok) {
          const transcriptData = await transcriptRes.json()

          if (transcriptData.transcript && transcriptData.transcript.length > 0) {
            // Map segments to our format
            const segments: TranscriptSegment[] = transcriptData.transcript.map((seg: any) => ({
              speaker: seg.speaker || 'Participante',
              text: seg.text || '',
              timestamp: seg.timestamp || ''
            }))

            // Consolidate consecutive messages from same speaker
            const consolidatedTranscript = consolidateTranscript(segments)

            setSession(prev => {
              if (!prev) return null

              // Update to transcribing status if we have content
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

  // Auto-evaluation when bot leaves automatically
  const triggerAutoEvaluation = async (botId: string) => {
    console.log('🔄 Iniciando avaliação automática...')

    // Check if background processing already created the evaluation
    try {
      const { data: existingEval } = await supabase
        .from('meet_evaluations')
        .select('id, evaluation')
        .eq('meeting_id', botId)
        .single()

      if (existingEval) {
        console.log('✅ Avaliação já existe (processada em background), carregando...')
        setEvaluation(existingEval.evaluation)
        setSavedToHistory(true)
        setSession(prev => prev ? { ...prev, status: 'ended' } : null)
        setShowEvaluationModal(true)
        return
      }
    } catch {
      // No existing evaluation, proceed normally
    }

    // Set status to evaluating
    setSession(prev => prev ? { ...prev, status: 'evaluating' } : null)

    // Wait for Recall.ai to process the final transcript
    console.log('⏳ Aguardando processamento da transcrição final...')
    await new Promise(resolve => setTimeout(resolve, 5000)) // Increased wait time

    // Fetch the final transcript
    let transcriptToEvaluate: TranscriptSegment[] = []
    let localTranscriptLength = 0

    // First, get current session transcript
    setSession(prev => {
      if (prev) {
        transcriptToEvaluate = prev.transcript
        localTranscriptLength = prev.transcript.length
      }
      return prev
    })

    // Only fetch from API if we have NO local transcript (avoid getting old data)
    if (localTranscriptLength === 0) {
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
      console.log(`📝 Usando transcrição local: ${localTranscriptLength} segmentos`)
    }

    // Evaluate if we have transcript
    if (transcriptToEvaluate.length > 0) {
      await evaluateTranscript(transcriptToEvaluate)
    } else {
      console.log('⚠️ Nenhuma transcrição encontrada para avaliar')
      setSession(prev => prev ? { ...prev, status: 'ended' } : null)
      setError('Nenhuma transcrição foi capturada. A reunião pode não ter tido áudio ou o bot não conseguiu gravar.')
    }

    // Clean up transcript storage
    try {
      await fetch(`/api/recall/webhook?botId=${botId}`, {
        method: 'DELETE'
      })
    } catch (err) {
      console.error('Error cleaning up transcript:', err)
    }
  }


  // Save evaluation to database
  const saveEvaluationToHistory = async (
    evalData: MeetEvaluation,
    transcriptData: TranscriptSegment[],
    botId: string
  ) => {
    setIsSaving(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('❌ User not authenticated, cannot save evaluation')
        return false
      }

      // Get company ID
      const companyId = await getCompanyId()
      if (!companyId) {
        console.error('❌ Company ID not found, cannot save evaluation')
        return false
      }

      // Calculate overall_score as integer 0-100
      let overallScore = evalData.overall_score
      if (overallScore && overallScore <= 10) {
        overallScore = overallScore * 10 // Convert from 0-10 to 0-100
      }

      // Prepare data for insertion
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

  // Evaluate the transcript
  const evaluateTranscript = async (transcriptData?: TranscriptSegment[]) => {
    const transcriptToUse = transcriptData || session?.transcript || []
    if (!session || transcriptToUse.length === 0) return

    setIsEvaluating(true)
    setError('')

    try {
      // Format transcript for evaluation
      const transcriptText = transcriptToUse
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
          meetingId: session.botId,
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

        // Save to history + generate simulation in parallel
        const savePromise = session?.botId
          ? saveEvaluationToHistory(data.evaluation, transcriptToUse, session.botId)
          : Promise.resolve()

        // Auto-generate simulation based on evaluation
        const simPromise = generateSimulation(data.evaluation, transcriptText)

        await Promise.all([savePromise, simPromise])
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
    hasTriggeredAutoEvalRef.current = false
    localStorage.removeItem('meetActiveSession')
    setSession(null)
    setMeetUrl('')
    setError('')
    setEvaluation(null)
    setIsEvaluating(false)
    setSavedToHistory(false)
    setSimulationConfig(null)
  }

  // Generate simulation from evaluation (accepts params directly to avoid stale state)
  const generateSimulation = async (evalData: MeetEvaluation, transcriptText: string) => {
    setIsGeneratingSimulation(true)

    try {
      const companyId = await getCompanyId()

      const response = await fetch('/api/meet/generate-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluation: evalData,
          transcript: transcriptText,
          companyId
        })
      })

      const data = await response.json()
      if (data.success && data.simulationConfig) {
        setSimulationConfig(data.simulationConfig)
        setCurrentSimSaved(false)
        // Auto-scroll to simulation section after render
        setTimeout(() => {
          simulationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      } else {
        console.error('Erro ao gerar simulacao:', data.error)
      }
    } catch (err: any) {
      console.error('Error generating simulation:', err)
    } finally {
      setIsGeneratingSimulation(false)
    }
  }

  // Start simulation - navigate to roleplay with pre-configured params
  const startSimulation = () => {
    if (!simulationConfig) return

    sessionStorage.setItem('meetSimulation', JSON.stringify({
      simulation_config: simulationConfig,
      source_evaluation: {
        overall_score: evaluation?.overall_score,
        meeting_id: session?.botId
      }
    }))

    setShowEvaluationModal(false)
    router.push('/roleplay')
  }

  // Copy meeting URL
  const copyMeetUrl = () => {
    navigator.clipboard.writeText(meetUrl)
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
      sending: { icon: Loader2, text: 'Criando bot...', color: 'text-amber-600' },
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
    <div className="min-h-screen bg-gray-50 px-6 flex items-start justify-center pt-[22vh]">
      <div className="max-w-4xl w-full">
        {/* Compact Header */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Análise Meet</h1>
            <p className="text-sm text-gray-500">Avaliação automática de reuniões com IA</p>
          </div>
        </div>

        {/* Input Section */}
        {!session && (
          <>
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={meetUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                  />
                  {meetUrl && isValidMeetUrl(meetUrl) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded font-medium">
                        Válido
                      </span>
                      <button
                        onClick={copyMeetUrl}
                        className="text-gray-400 hover:text-green-600 transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={sendBot}
                  disabled={!meetUrl}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
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
            </div>

            {/* Steps - 3 horizontal cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm text-gray-700">Cole o link da reunião</span>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-sm text-gray-700">Aceite o bot na reunião</span>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm text-gray-700">Receba a avaliação</span>
              </div>
            </div>

            {/* Background notice - subtle pill */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span>A avaliação é gerada em background automaticamente</span>
            </div>

            {/* Recent Analyses */}
            {recentEvaluations.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">Análises Recentes</h2>
                  <button
                    onClick={() => router.push('/history?tab=meet')}
                    className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1 transition-colors"
                  >
                    Ver todo histórico
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {recentEvaluations.map((ev) => {
                    const score = ev.overall_score || 0
                    const scoreColor = score >= 7 ? 'text-green-600 bg-green-50 border-green-200' :
                      score >= 5 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                      'text-red-600 bg-red-50 border-red-200'
                    const date = new Date(ev.created_at)
                    return (
                      <div
                        key={ev.id}
                        onClick={() => router.push('/history?tab=meet')}
                        className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-4 cursor-pointer hover:border-green-300 hover:shadow-sm transition-all"
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border font-bold text-lg ${scoreColor}`}>
                          {score.toFixed(1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">
                            {ev.executive_summary || 'Avaliação de reunião'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {recentEvaluations.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma análise ainda</p>
            )}
          </>
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

            {/* Background processing notice */}
            {session.status !== 'ended' && session.status !== 'error' && session.status !== 'sending' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    Análise em background ativada
                  </p>
                  <p className="text-sm text-green-600 mt-0.5">
                    Você pode sair desta página ou navegar para outra área. A avaliação será gerada automaticamente quando a reunião terminar e você será notificado.
                  </p>
                </div>
              </div>
            )}

            {/* Status indicator while waiting/in meeting */}
            {session.transcript.length === 0 && (session.status === 'joining' || session.status === 'sending') && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-green-600" />
                  <p className="text-gray-600">Aguardando bot entrar na reunião...</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Isso geralmente leva de 10 a 30 segundos
                  </p>
                  <p className="text-sm text-amber-600 mt-2 font-medium">
                    Lembre-se de aceitar o "Ramppy" quando ele pedir para entrar!
                  </p>
                </div>
              </div>
            )}
            {session.transcript.length === 0 && session.status === 'in_meeting' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <Video className="w-8 h-8 mb-3 text-green-600" />
                  <p className="text-gray-600">Bot na reunião. Gravando...</p>
                </div>
              </div>
            )}
            {session.transcript.length > 0 && !(session.status === 'evaluating' || isEvaluating) && !evaluation && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <Video className="w-8 h-8 mb-3 text-green-600" />
                  <p className="text-gray-600">Reunião em andamento...</p>
                  <p className="text-sm text-gray-500 mt-1">{session.transcript.length} falas capturadas</p>
                </div>
              </div>
            )}

            {/* Evaluation Loading */}
            {(session.status === 'evaluating' || isEvaluating) && (
              <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Avaliando Performance...</h3>
                    <p className="text-gray-600 text-sm">Analisando a reunião com metodologia SPIN Selling</p>
                  </div>
                </div>
              </div>
            )}

            {/* Evaluation Results - Compact View */}
            {session.status === 'ended' && evaluation && (
              <div className="space-y-4">
                {/* Score Header - Click to open modal */}
                <div
                  onClick={() => setShowEvaluationModal(true)}
                  className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:border-green-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Avaliação da Reunião</h3>
                      {evaluation.seller_identification?.name && (
                        <p className="text-gray-600 text-sm">Vendedor: {evaluation.seller_identification.name}</p>
                      )}
                      <p className="text-green-600 text-sm mt-2 font-medium">Clique para ver detalhes completos →</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-5xl font-bold ${
                        (evaluation.overall_score || 0) >= 7 ? 'text-green-600' :
                        (evaluation.overall_score || 0) >= 5 ? 'text-amber-600' : 'text-red-600'
                      }`}>{evaluation.overall_score?.toFixed(1)}</div>
                      <div className="text-gray-500 text-sm capitalize">{evaluation.performance_level?.replace('_', ' ')}</div>
                      {evaluation.playbook_adherence && (
                        <div className="mt-2 flex items-center gap-1 justify-end text-gray-600">
                          <BookOpen className="w-4 h-4" />
                          <span className="text-sm">
                            Playbook: {evaluation.playbook_adherence.overall_adherence_score}%
                          </span>
                        </div>
                      )}
                      {savedToHistory && (
                        <div className="mt-2 flex items-center gap-1 justify-end text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm">Salvo no histórico</span>
                        </div>
                      )}
                      {isSaving && (
                        <div className="mt-2 flex items-center gap-1 justify-end text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Salvando...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick SPIN Scores */}
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="grid grid-cols-4 gap-3">
                    {['S', 'P', 'I', 'N'].map((letter) => {
                      const score = evaluation.spin_evaluation?.[letter as keyof typeof evaluation.spin_evaluation]?.final_score || 0
                      const color = score >= 7 ? 'text-green-600 bg-green-50' : score >= 5 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
                      const labels: Record<string, string> = { S: 'S', P: 'P', I: 'I', N: 'N' }
                      return (
                        <div key={letter} className={`rounded-lg p-3 text-center ${color.split(' ')[1]}`}>
                          <div className={`text-2xl font-bold ${color.split(' ')[0]}`}>{score.toFixed(1)}</div>
                          <div className="text-gray-600 text-xs font-medium">{labels[letter]}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowEvaluationModal(true)}
                    className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
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
                    className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors flex items-center gap-2 font-medium border border-gray-200"
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
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Sessão Encerrada</h3>
                <p className="text-gray-600 mb-4">
                  A transcrição foi capturada. Você pode avaliar a performance ou copiar a transcrição.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => evaluateTranscript()}
                    disabled={isEvaluating}
                    className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
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
                    className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors flex items-center gap-2 font-medium border border-gray-200"
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

      {/* Modal de Avaliação Flutuante */}
      {showEvaluationModal && evaluation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] overflow-y-auto">
          <div className="min-h-screen py-8 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white rounded-t-2xl">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <Video className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Avaliação da Reunião</h2>
                      {evaluation.seller_identification?.name && (
                        <p className="text-gray-500 text-sm">Vendedor: {evaluation.seller_identification.name}</p>
                      )}
                    </div>
                  </div>
                  {savedToHistory && (
                    <div className="mt-2 flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>Salvo no histórico</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-4xl font-bold ${
                      (evaluation.overall_score || 0) >= 7 ? 'text-green-600' :
                      (evaluation.overall_score || 0) >= 5 ? 'text-amber-600' : 'text-red-600'
                    }`}>{evaluation.overall_score?.toFixed(1)}</div>
                    <div className="text-gray-500 text-sm capitalize">{evaluation.performance_level?.replace('_', ' ')}</div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* SPIN Scores */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Metodologia SPIN</h3>
                  <div className="grid grid-cols-4 gap-4">
                    {['S', 'P', 'I', 'N'].map((letter) => {
                      const spinData = evaluation.spin_evaluation?.[letter as keyof typeof evaluation.spin_evaluation]
                      const score = spinData?.final_score || 0
                      const color = score >= 7 ? 'text-green-600 bg-green-50 border-green-200' : score >= 5 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200'
                      const labels: Record<string, string> = { S: 'Situação', P: 'Problema', I: 'Implicação', N: 'Necessidade' }
                      return (
                        <div key={letter} className={`rounded-xl p-4 border ${color.split(' ').slice(1).join(' ')}`}>
                          <div className={`text-3xl font-bold ${color.split(' ')[0]}`}>{score.toFixed(1)}</div>
                          <div className="text-gray-600 text-sm font-medium">{labels[letter]}</div>
                          {spinData?.technical_feedback && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-3">{spinData.technical_feedback}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Playbook Adherence */}
                {evaluation.playbook_adherence && (
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="w-5 h-5 text-green-600" />
                      <h3 className="text-lg font-bold text-gray-900">Aderência ao Playbook</h3>
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

                    {/* Dimensions */}
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
                        const scoreColor = dim.score >= 70 ? 'text-green-600 bg-green-50 border-green-200' : dim.score >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200'
                        return (
                          <div key={key} className={`rounded-lg p-3 text-center border ${scoreColor.split(' ').slice(1).join(' ')}`}>
                            <div className={`text-xl font-bold ${scoreColor.split(' ')[0]}`}>{dim.score}%</div>
                            <div className="text-xs text-gray-600">{dimLabels[key] || key}</div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Violations */}
                    {evaluation.playbook_adherence.violations && evaluation.playbook_adherence.violations.length > 0 && (
                      <div className="bg-red-50 rounded-lg p-3 mb-3 border border-red-200">
                        <h4 className="text-sm font-bold text-red-800 mb-2">Violações</h4>
                        <ul className="space-y-1">
                          {evaluation.playbook_adherence.violations.map((v: any, i: number) => (
                            <li key={i} className="text-sm text-red-700 flex items-start gap-1">
                              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              {typeof v === 'string' ? v : v?.criterion || v?.description || JSON.stringify(v)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Exemplary Moments */}
                    {evaluation.playbook_adherence.exemplary_moments && evaluation.playbook_adherence.exemplary_moments.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-3 mb-3 border border-green-200">
                        <h4 className="text-sm font-bold text-green-800 mb-2">Momentos Exemplares</h4>
                        <ul className="space-y-2">
                          {evaluation.playbook_adherence.exemplary_moments.map((m: any, i: number) => (
                            <li key={i} className="text-sm text-green-700">
                              <div className="flex items-start gap-1">
                                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span className="font-medium">{typeof m === 'string' ? m : m?.criterion || ''}</span>
                              </div>
                              {typeof m === 'object' && m?.evidence && (
                                <p className="text-green-600 text-xs ml-5 mt-0.5">{m.evidence}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Coaching Notes */}
                    {evaluation.playbook_adherence.coaching_notes && (
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-700 mb-1">Notas de Coaching</h4>
                        <p className="text-sm text-gray-600">{evaluation.playbook_adherence.coaching_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Executive Summary */}
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Resumo Executivo</h3>
                  <p className="text-gray-700 whitespace-pre-line">{evaluation.executive_summary}</p>
                </div>

                {/* Strengths & Gaps */}
                <div className="grid grid-cols-2 gap-4">
                  {evaluation.top_strengths && evaluation.top_strengths.length > 0 && (
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                      <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Pontos Fortes
                      </h4>
                      <ul className="space-y-2">
                        {evaluation.top_strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-gray-700 text-sm">
                            <span className="text-green-500 mt-0.5">•</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.critical_gaps && evaluation.critical_gaps.length > 0 && (
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                      <h4 className="text-md font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        Gaps Críticos
                      </h4>
                      <ul className="space-y-2">
                        {evaluation.critical_gaps.map((gap, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-gray-700 text-sm">
                            <span className="text-amber-500 mt-0.5">•</span>
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
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Análise de Objeções</h3>
                    <div className="space-y-4">
                      {evaluation.objections_analysis.map((obj, idx) => (
                        <div key={idx} className="border-l-4 border-green-400 pl-4 py-2 bg-gray-50 rounded-r-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
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
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Melhorias Prioritárias</h3>
                    <div className="space-y-3">
                      {evaluation.priority_improvements.map((imp, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              imp.priority === 'critical' ? 'bg-red-100 text-red-700' :
                              imp.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {imp.priority === 'critical' ? 'Crítico' : imp.priority === 'high' ? 'Alta' : 'Média'}
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

                {/* Simulation Loading */}
                {isGeneratingSimulation && !simulationConfig && (
                  <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                      <div>
                        <h3 className="text-base font-bold text-gray-900">Gerando Simulação de Treino...</h3>
                        <p className="text-gray-600 text-sm">Criando cenário personalizado baseado nos erros identificados</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Simulation Proposal - Cards Layout */}
                {simulationConfig && (
                  <div ref={simulationRef} className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Target className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Simulação de Treino Sugerida</h3>
                        <p className="text-sm text-gray-500">Baseada nos erros identificados na reunião</p>
                      </div>
                    </div>

                    {/* Meeting Context */}
                    {simulationConfig.meeting_context && (
                      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                        <p className="text-sm text-gray-700 italic">{simulationConfig.meeting_context}</p>
                      </div>
                    )}

                    {/* Simulation Justification Banner */}
                    {simulationConfig.simulation_justification && (
                      <div className="bg-purple-50 rounded-xl p-4 border-l-4 border-purple-500 border-t border-r border-b border-t-purple-200 border-r-purple-200 border-b-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-purple-600" />
                          <h4 className="text-sm font-bold text-gray-900">Por que esta simulacao?</h4>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.simulation_justification}</p>
                      </div>
                    )}

                    {/* Persona Header with badges */}
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-purple-600" />
                      <h4 className="text-sm font-bold text-gray-900">Persona do Cliente</h4>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        {simulationConfig.age} anos
                      </span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        {simulationConfig.temperament}
                      </span>
                    </div>

                    {/* Persona Fields - Individual Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      {simulationConfig.persona?.business_type === 'B2B' ? (<>
                        {simulationConfig.persona.cargo && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1.5">Cargo</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.cargo}</p>
                          </div>
                        )}
                        {simulationConfig.persona.tipo_empresa_faturamento && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1.5">Empresa</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.tipo_empresa_faturamento}</p>
                          </div>
                        )}
                        {simulationConfig.persona.contexto && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200 col-span-2">
                            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1.5">Contexto</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.contexto}</p>
                          </div>
                        )}
                        {simulationConfig.persona.busca && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1.5">O que busca</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.busca}</p>
                          </div>
                        )}
                        {simulationConfig.persona.dores && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1.5">Dores</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.dores}</p>
                          </div>
                        )}
                      </>) : (<>
                        {simulationConfig.persona?.profissao && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1.5">Perfil</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.profissao}</p>
                          </div>
                        )}
                        {simulationConfig.persona?.perfil_socioeconomico && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1.5">Perfil Socioeconomico</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.perfil_socioeconomico}</p>
                          </div>
                        )}
                        {simulationConfig.persona?.contexto && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200 col-span-2">
                            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1.5">Contexto</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.contexto}</p>
                          </div>
                        )}
                        {simulationConfig.persona?.busca && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1.5">O que busca</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.busca}</p>
                          </div>
                        )}
                        {simulationConfig.persona?.dores && (
                          <div className="bg-white rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1.5">Dores</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{simulationConfig.persona.dores}</p>
                          </div>
                        )}
                      </>)}
                    </div>

                    {/* Objective Card */}
                    <div className="bg-white rounded-xl p-5 border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-purple-600" />
                        <h4 className="text-sm font-bold text-gray-900">Objetivo</h4>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">{simulationConfig.objective?.name}</p>
                      {simulationConfig.objective?.description && (
                        <p className="text-sm text-gray-600">{simulationConfig.objective.description}</p>
                      )}
                    </div>

                    {/* Objections Card */}
                    {simulationConfig.objections && simulationConfig.objections.length > 0 && (
                      <div className="bg-white rounded-xl p-5 border border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-purple-600" />
                          <h4 className="text-sm font-bold text-gray-900">Objecoes para Treinar</h4>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{simulationConfig.objections.length}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {simulationConfig.objections.map((obj: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                              <div className="flex items-start gap-2 mb-1.5">
                                <p className="text-sm font-medium text-gray-900 flex-1">{cleanGptText(obj.name)}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                  obj.source === 'meeting'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {obj.source === 'meeting' ? 'Da reuniao' : 'Coaching'}
                                </span>
                              </div>
                              {obj.rebuttals && obj.rebuttals.length > 0 && (
                                <div className="space-y-1 mt-2">
                                  <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Como quebrar:</p>
                                  {obj.rebuttals.map((r: string, ri: number) => (
                                    <p key={ri} className="text-xs text-green-700 flex items-start gap-1.5 bg-green-50 rounded px-2 py-1">
                                      <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                      {cleanGptText(r)}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Coaching Focus Cards */}
                    {simulationConfig.coaching_focus && simulationConfig.coaching_focus.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-500" />
                          <h4 className="text-sm font-bold text-gray-900">Foco de Coaching</h4>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{simulationConfig.coaching_focus.length} {simulationConfig.coaching_focus.length === 1 ? 'area' : 'areas'}</span>
                        </div>

                        {simulationConfig.coaching_focus.map((focus: any, idx: number) => {
                          const severityColors = {
                            critical: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-700', label: 'Critico', impact: 'bg-red-50 border-red-100', dot: 'bg-red-500' },
                            high: { border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'Alto', impact: 'bg-amber-50 border-amber-100', dot: 'bg-amber-500' },
                            medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-700', label: 'Medio', impact: 'bg-yellow-50 border-yellow-100', dot: 'bg-yellow-500' }
                          }
                          const sev = severityColors[focus.severity as keyof typeof severityColors] || severityColors.high
                          const phrases = focus.example_phrases || focus.tips || []
                          const diagnosisText = focus.diagnosis || focus.what_to_improve || ''

                          return (
                            <div key={idx} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${sev.border} overflow-hidden`}>
                              {/* Header: Severity + Area + Score */}
                              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                  {focus.severity && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${sev.badge}`}>
                                      {sev.label}
                                    </span>
                                  )}
                                  <span className="text-sm font-bold text-gray-900">{focus.area}</span>
                                </div>
                                {focus.spin_score !== undefined && (
                                  <span className={`text-sm font-bold ${focus.spin_score < 4 ? 'text-red-600' : focus.spin_score < 6 ? 'text-amber-600' : 'text-yellow-600'}`}>
                                    {focus.spin_score.toFixed(1)}/10
                                  </span>
                                )}
                              </div>

                              <div className="p-4 space-y-3">
                                {/* Diagnosis */}
                                {diagnosisText && (
                                  <div>
                                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Diagnostico</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{cleanGptText(diagnosisText)}</p>
                                  </div>
                                )}

                                {/* Transcript Evidence */}
                                {focus.transcript_evidence && (
                                  <div className="bg-gray-50 rounded-lg p-3 border-l-3 border-l-gray-300 border border-gray-100">
                                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Evidencia da Reuniao</p>
                                    <p className="text-xs text-gray-600 italic leading-relaxed">{cleanGptText(focus.transcript_evidence)}</p>
                                  </div>
                                )}

                                {/* Business Impact */}
                                {focus.business_impact && (
                                  <div className={`rounded-lg p-3 border ${sev.impact}`}>
                                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-1">Por que importa</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{cleanGptText(focus.business_impact)}</p>
                                  </div>
                                )}

                                {/* Practice Goal */}
                                {focus.practice_goal && (
                                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                    <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">O que praticar</p>
                                    <p className="text-xs text-green-800 leading-relaxed font-medium">{cleanGptText(focus.practice_goal)}</p>
                                  </div>
                                )}

                                {/* Example Phrases */}
                                {phrases.length > 0 && (
                                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                    <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1.5">Frases para usar</p>
                                    <div className="space-y-1.5">
                                      {phrases.map((phrase: string, pi: number) => (
                                        <p key={pi} className="text-xs text-blue-800 flex items-start gap-1.5">
                                          <span className="text-blue-400 mt-0.5 flex-shrink-0">&ldquo;</span>
                                          <span className="leading-relaxed">{cleanGptText(phrase)}</span>
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={startSimulation}
                        className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:shadow-lg"
                      >
                        <Play className="w-5 h-5" />
                        Fazer Agora
                      </button>
                      <button
                        onClick={saveSimulationForLater}
                        disabled={isSavingSimulation}
                        className="flex-1 py-3.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border-2 border-gray-200 hover:border-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSavingSimulation ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isSavingSimulation ? 'Salvando...' : 'Deixar para Depois'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                <button
                  onClick={() => {
                    if (session) {
                      const text = session.transcript
                        .map(s => `${s.speaker}: ${s.text}`)
                        .join('\n')
                      navigator.clipboard.writeText(text)
                    }
                  }}
                  className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors flex items-center gap-2 font-medium border border-gray-200"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Transcricao
                </button>
                <button
                  onClick={async () => {
                    if (simulationConfig && !currentSimSaved) {
                      await saveSimulationForLater()
                    } else {
                      setShowEvaluationModal(false)
                    }
                  }}
                  disabled={isGeneratingSimulation && !simulationConfig || isSavingSimulation}
                  className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 font-medium ${
                    isGeneratingSimulation && !simulationConfig || isSavingSimulation
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isSavingSimulation ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                  ) : isGeneratingSimulation && !simulationConfig ? (
                    'Aguarde...'
                  ) : (
                    'Fechar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
