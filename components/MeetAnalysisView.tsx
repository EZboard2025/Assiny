'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  CalendarDays,
  Power,
  Plus,
  Mic,
  Sparkles,
  Globe,
  LogOut,
  Monitor,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'
import { supabase } from '@/lib/supabase'
import CalendarWeekView from './CalendarWeekView'
import CalendarEventPopover from './CalendarEventPopover'
import CalendarEventModal, { CreateEventData } from './CalendarEventModal'
import MiniCalendar from './MiniCalendar'

type BotStatus = 'idle' | 'sending' | 'joining' | 'waiting_room' | 'in_meeting' | 'transcribing' | 'ended' | 'evaluating' | 'error'

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

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  meetLink: string
  colorId?: string
  description?: string | null
  attendees: Array<{ email: string; displayName?: string; responseStatus?: string }>
  botEnabled: boolean
  botStatus: string
  botId: string | null
  evaluationId: string | null
  scheduledBotId: string | null
  evaluation?: { overall_score: number; performance_level: string } | null
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

  // Calendar integration state
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [calendarEmail, setCalendarEmail] = useState('')
  const [calendarLoading, setCalendarLoading] = useState(true)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [calendarEventsLoading, setCalendarEventsLoading] = useState(false)
  const [connectingCalendar, setConnectingCalendar] = useState(false)
  const [togglingEventId, setTogglingEventId] = useState<string | null>(null)
  const [popoverEvent, setPopoverEvent] = useState<CalendarEvent | null>(null)
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null)
  const [calendarNoticeType, setCalendarNoticeType] = useState<'success' | 'error' | 'warning'>('success')
  const [hasWriteAccess, setHasWriteAccess] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)
  const [showCreateEventModal, setShowCreateEventModal] = useState(false)
  const [createEventDate, setCreateEventDate] = useState<Date | undefined>(undefined)
  const [createEventHour, setCreateEventHour] = useState<number | undefined>(undefined)
  const [editEventData, setEditEventData] = useState<{ id: string; title: string; start: string; end: string | null; meetLink?: string; attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>; description?: string | null } | null>(null)

  // Tab & calendar week state
  type MeetTab = 'calendar' | 'manual' | 'transcricoes'
  const [activeTab, setActiveTab] = useState<MeetTab>('calendar')
  const [desktopTranscriptions, setDesktopTranscriptions] = useState<any[]>([])
  const [loadingTranscriptions, setLoadingTranscriptions] = useState(false)
  const [expandedTranscription, setExpandedTranscription] = useState<string | null>(null)
  const [liveSession, setLiveSession] = useState<any | null>(null)
  const liveTranscriptEndRef = useRef<HTMLDivElement>(null)
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day // Sunday start
    const sunday = new Date(now)
    sunday.setDate(diff)
    sunday.setHours(0, 0, 0, 0)
    return sunday
  })

  const handlePrevWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }, [])

  const handleNextWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }, [])

  const handleToday = useCallback(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day
    const sunday = new Date(now)
    sunday.setDate(diff)
    sunday.setHours(0, 0, 0, 0)
    setCurrentWeekStart(sunday)
  }, [])

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
        const activeStatuses: BotStatus[] = ['sending', 'joining', 'waiting_room', 'in_meeting', 'transcribing', 'evaluating']
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

  // Load desktop transcriptions when tab is active
  const loadDesktopTranscriptions = useCallback(async () => {
    setLoadingTranscriptions(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('meet_evaluations')
        .select('id, meeting_id, seller_name, transcript, evaluation, overall_score, performance_level, spin_s_score, spin_p_score, spin_i_score, spin_n_score, created_at')
        .eq('user_id', user.id)
        .like('meeting_id', 'desktop_%')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setDesktopTranscriptions(data)
      }
    } catch (e) {
      console.error('Error loading desktop transcriptions:', e)
    } finally {
      setLoadingTranscriptions(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'transcricoes') {
      loadDesktopTranscriptions()
    }
  }, [activeTab, loadDesktopTranscriptions])

  // Subscribe to live recording sessions via Supabase Realtime
  useEffect(() => {
    let channel: any = null

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check for existing live session
      const { data: existing } = await supabase
        .from('meet_live_sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['recording', 'evaluating'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        setLiveSession(existing)
      }

      // Subscribe to changes
      channel = supabase
        .channel('live-session-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meet_live_sessions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const row = payload.new
              if (row.status === 'recording' || row.status === 'evaluating') {
                setLiveSession(row)
              } else {
                // completed or error — remove live card, refresh list
                setLiveSession(null)
                if (activeTab === 'transcricoes') {
                  loadDesktopTranscriptions()
                }
              }
            }
            if (payload.eventType === 'DELETE') {
              setLiveSession(null)
              if (activeTab === 'transcricoes') {
                loadDesktopTranscriptions()
              }
            }
          }
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [activeTab, loadDesktopTranscriptions])

  // Auto-scroll live transcript to bottom
  useEffect(() => {
    if (liveTranscriptEndRef.current && liveSession?.status === 'recording') {
      liveTranscriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [liveSession?.transcript?.length, liveSession?.status])

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

  // Calendar: check connection status + handle URL params on mount
  useEffect(() => {
    checkCalendarStatus()

    const params = new URLSearchParams(window.location.search)
    const calendarParam = params.get('calendar')
    if (calendarParam === 'connected') {
      setCalendarNoticeType('success')
      setCalendarNotice('Google Calendar conectado com sucesso!')
      window.history.replaceState({}, '', window.location.pathname + '?view=meet-analysis')
    } else if (calendarParam === 'denied') {
      setCalendarNoticeType('warning')
      setCalendarNotice('Conexão com Google Calendar foi negada.')
      window.history.replaceState({}, '', window.location.pathname + '?view=meet-analysis')
    } else if (calendarParam === 'error') {
      const reason = params.get('reason') || ''
      const errorMessages: Record<string, string> = {
        'table_not_found': 'Erro: tabela google_calendar_connections não existe no banco. Execute o SQL de migração.',
        'db_error': 'Erro ao salvar no banco de dados.',
        'token_exchange_failed': 'Erro ao trocar código OAuth por tokens. Tente novamente.',
        'missing_tokens': 'Google não retornou refresh_token. Remova o app em myaccount.google.com/permissions e tente novamente.',
        'missing_params': 'Parâmetros faltando no callback.',
        'invalid_state': 'State param inválido.',
      }
      const msg = errorMessages[reason] || `Erro ao conectar Google Calendar. ${reason ? `(${reason})` : 'Tente novamente.'}`
      setCalendarNoticeType('error')
      setCalendarNotice(msg)
      window.history.replaceState({}, '', window.location.pathname + '?view=meet-analysis')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              case 'waiting_room':
                newStatus = 'waiting_room'
                break
              case 'in_meeting':
                newStatus = 'in_meeting'
                break
              case 'transcribing':
                newStatus = 'transcribing'
                break
              case 'ended':
                // Check if bot timed out in waiting room
                if (statusData.subCode === 'timeout_exceeded_waiting_room') {
                  newStatus = 'error'
                  setError('O bot não foi aceito na reunião. Verifique se você admitiu o "Ramppy" pela sala de espera do Google Meet.')
                  stopPolling()
                  break
                }
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
    botId: string,
    smartNotes?: any
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
        spin_n_score: evalData.spin_evaluation?.N?.final_score || 0,
        ...(smartNotes ? { smart_notes: smartNotes } : {})
      }

      console.log('💾 Salvando avaliação no histórico...', insertData.meeting_id)

      // Check if evaluation already exists (background process may have saved it)
      const { data: existingEval } = await supabase
        .from('meet_evaluations')
        .select('id')
        .eq('meeting_id', botId)
        .maybeSingle()

      if (existingEval) {
        console.log('✅ Avaliação já existe (salva pelo background), pulando insert')
      } else {
        const { error } = await supabase
          .from('meet_evaluations')
          .insert(insertData)

        if (error) {
          // Ignore unique constraint violation (race condition with background process)
          if (error.code === '23505') {
            console.log('✅ Avaliação já existe (race condition), pulando')
          } else {
            console.error('❌ Erro ao salvar avaliação:', error)
            return false
          }
        }
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
          ? saveEvaluationToHistory(data.evaluation, transcriptToUse, session.botId, data.smartNotes || null)
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

  // === Calendar Integration Functions ===

  const checkCalendarStatus = async () => {
    try {
      setCalendarLoading(true)
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession?.access_token) {
        setCalendarLoading(false)
        return
      }

      const res = await fetch('/api/calendar/status', {
        headers: { Authorization: `Bearer ${authSession.access_token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setCalendarConnected(data.connected)
        setCalendarEmail(data.email || '')
        setHasWriteAccess(data.hasWriteAccess || false)
        if (data.connected) {
          loadCalendarEvents(authSession.access_token)
        } else if (activeTab === 'calendar') {
          setActiveTab('manual')
        }
      }
    } catch (e) {
      console.error('Calendar status check failed:', e)
    } finally {
      setCalendarLoading(false)
    }
  }

  const loadCalendarEvents = async (token?: string) => {
    try {
      setCalendarEventsLoading(true)
      let authToken = token
      if (!authToken) {
        const { data: { session: authSession } } = await supabase.auth.getSession()
        authToken = authSession?.access_token || ''
      }

      const res = await fetch('/api/calendar/events?view=all', {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        const allEvents: CalendarEvent[] = [...(data.events || [])]
        const seenIds = new Set(allEvents.map((e: CalendarEvent) => e.id))
        for (const past of data.pastEvents || []) {
          if (!seenIds.has(past.id)) {
            allEvents.push(past)
          }
        }
        setCalendarEvents(allEvents)
      }
    } catch (e) {
      console.error('Failed to load calendar events:', e)
    } finally {
      setCalendarEventsLoading(false)
    }
  }

  const connectCalendar = async () => {
    try {
      setConnectingCalendar(true)
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession?.access_token) return

      const res = await fetch('/api/calendar/connect', {
        headers: { Authorization: `Bearer ${authSession.access_token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.authUrl) {
          window.location.href = data.authUrl
        }
      }
    } catch (e) {
      console.error('Failed to start calendar connection:', e)
    } finally {
      setConnectingCalendar(false)
    }
  }

  const disconnectCalendar = async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession?.access_token) return

      await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authSession.access_token}` }
      })
      setCalendarConnected(false)
      setCalendarEmail('')
      setCalendarEvents([])
    } catch (e) {
      console.error('Failed to disconnect calendar:', e)
    }
  }

  const toggleCalendarBot = async (scheduledBotId: string, enabled: boolean) => {
    try {
      setTogglingEventId(scheduledBotId)
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession?.access_token) return

      const res = await fetch('/api/calendar/toggle-bot', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ scheduledBotId, enabled })
      })

      if (res.ok) {
        setCalendarEvents(prev => prev.map(e =>
          e.scheduledBotId === scheduledBotId
            ? { ...e, botEnabled: enabled, botStatus: enabled ? 'pending' : 'skipped' }
            : e
        ))
      }
    } catch (e) {
      console.error('Failed to toggle bot:', e)
    } finally {
      setTogglingEventId(null)
    }
  }

  const handleCreateEvent = async (data: CreateEventData) => {
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession?.access_token) throw new Error('Não autenticado')

    const isEdit = !!data.eventId

    if (isEdit) {
      // Update existing event
      const res = await fetch('/api/calendar/events/update', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: data.eventId,
          title: data.title,
          startDateTime: data.startDateTime,
          endDateTime: data.endDateTime,
          description: data.description,
          attendees: data.attendees,
          addMeetLink: data.addMeetLink,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao editar evento')
      }

      await loadCalendarEvents()
      setPopoverEvent(null)
      setPopoverAnchor(null)
      setEditEventData(null)
      setCalendarNoticeType('success')
      setCalendarNotice('Evento atualizado com sucesso!')
      setTimeout(() => setCalendarNotice(null), 4000)
    } else {
      // Create new event
      const res = await fetch('/api/calendar/events/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar evento')
      }

      await loadCalendarEvents()
      setCalendarNoticeType('success')
      setCalendarNotice('Evento criado com sucesso!')
      setTimeout(() => setCalendarNotice(null), 4000)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession?.access_token) return

    const res = await fetch('/api/calendar/events/delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authSession.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventId }),
    })

    if (res.ok) {
      setCalendarEvents(prev => prev.filter(e => e.id !== eventId))
      setPopoverEvent(null)
      setPopoverAnchor(null)
      setCalendarNoticeType('success')
      setCalendarNotice('Evento removido com sucesso')
      setTimeout(() => setCalendarNotice(null), 4000)
    } else {
      const err = await res.json()
      setCalendarNoticeType('error')
      setCalendarNotice(err.error || 'Erro ao apagar evento')
    }
  }

  const handleAddAttendees = async (eventId: string, emails: string[]) => {
    const { data: { session: authSession } } = await supabase.auth.getSession()
    if (!authSession?.access_token) return null

    const res = await fetch('/api/calendar/events/update', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authSession.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ eventId, attendees: emails }),
    })

    if (res.ok) {
      const data = await res.json()
      // Update the event in calendarEvents list
      setCalendarEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, attendees: data.attendees } : e
      ))
      return data.attendees
    } else {
      const err = await res.json()
      setCalendarNoticeType('error')
      setCalendarNotice(err.error || 'Erro ao adicionar convidado')
      return null
    }
  }

  const [sendingBotEventId, setSendingBotEventId] = useState<string | null>(null)

  const sendCalendarBot = async (event: CalendarEvent) => {
    if (!event.meetLink || !event.scheduledBotId) return
    try {
      setSendingBotEventId(event.scheduledBotId)
      const { data: { session: authSession } } = await supabase.auth.getSession()
      const { data: { user } } = await supabase.auth.getUser()
      if (!authSession?.access_token || !user) return

      const companyId = await getCompanyId()
      if (!companyId) return

      // Create Recall bot with the meet link
      const res = await fetch('/api/recall/create-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meetingUrl: event.meetLink,
          userId: user.id,
          companyId,
          botName: 'Ramppy'
        })
      })

      if (res.ok) {
        const data = await res.json()
        // Update the calendar_scheduled_bot with the bot_id
        const supabaseAdmin = await fetch('/api/calendar/update-bot-id', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authSession.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            scheduledBotId: event.scheduledBotId,
            botId: data.botId,
            botStatus: 'scheduled'
          })
        })

        setCalendarEvents(prev => prev.map(e =>
          e.scheduledBotId === event.scheduledBotId
            ? { ...e, botStatus: 'scheduled', botId: data.botId }
            : e
        ))
      } else {
        const err = await res.json()
        console.error('Failed to create bot:', err)
        alert('Erro ao enviar bot: ' + (err.error || 'Tente novamente'))
      }
    } catch (e) {
      console.error('Failed to send calendar bot:', e)
    } finally {
      setSendingBotEventId(null)
    }
  }

  // Auto-schedule: check every 2 minutes for meetings starting within 5 min
  useEffect(() => {
    if (!calendarConnected || calendarEvents.length === 0) return

    const autoSchedule = async () => {
      const now = Date.now()
      const fiveMinFromNow = now + 5 * 60 * 1000

      for (const event of calendarEvents) {
        // Only auto-send for pending events that are enabled and starting within 5 min
        if (event.botEnabled && event.botStatus === 'pending' && event.meetLink && event.scheduledBotId) {
          const eventStart = new Date(event.start).getTime()
          if (eventStart >= now && eventStart <= fiveMinFromNow) {
            console.log(`[Auto-schedule] Sending bot for "${event.title}" starting at ${event.start}`)
            await sendCalendarBot(event)
          }
        }
      }
    }

    // Run immediately on mount
    autoSchedule()

    // Then every 2 minutes
    const interval = setInterval(autoSchedule, 2 * 60 * 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarConnected, calendarEvents])



  // Get status display
  const getStatusDisplay = () => {
    if (!session) return null

    const statusConfig: Record<BotStatus, { icon: any; text: string; color: string }> = {
      idle: { icon: Clock, text: 'Aguardando', color: 'text-gray-500' },
      sending: { icon: Loader2, text: 'Criando bot...', color: 'text-amber-600' },
      joining: { icon: Loader2, text: 'Entrando na reunião...', color: 'text-amber-600' },
      waiting_room: { icon: AlertTriangle, text: 'Na sala de espera — aceite o Ramppy!', color: 'text-amber-600' },
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
    <div className={`min-h-screen bg-gray-50 px-6 flex items-start justify-center ${!session && !calendarConnected && !calendarLoading ? 'pt-[22vh]' : 'pt-8'}`}>
      <div className={`w-full ${(calendarConnected || calendarLoading) && activeTab === 'calendar' ? 'max-w-[1400px]' : 'max-w-4xl'}`}>
        {/* Compact Header */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {calendarConnected || calendarLoading ? 'Calendário & Análise Meet' : 'Análise Meet'}
            </h1>
            <p className="text-sm text-gray-500">
              {calendarConnected || calendarLoading ? 'Gerencie sua agenda e avalie reuniões com IA' : 'Avaliação automática de reuniões com IA'}
            </p>
          </div>
        </div>

        {/* Calendar connection notice */}
        {calendarNotice && (
          <div className={`mb-4 flex items-center justify-between rounded-xl px-4 py-3 ${
            calendarNoticeType === 'error' ? 'bg-red-50 border border-red-200' :
            calendarNoticeType === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-green-50 border border-green-200'
          }`}>
            <div className={`flex items-center gap-2 text-sm ${
              calendarNoticeType === 'error' ? 'text-red-700' :
              calendarNoticeType === 'warning' ? 'text-yellow-700' :
              'text-green-700'
            }`}>
              {calendarNoticeType === 'error' ? <XCircle className="w-4 h-4" /> :
               calendarNoticeType === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
               <CheckCircle className="w-4 h-4" />}
              {calendarNotice}
            </div>
            <button onClick={() => setCalendarNotice(null)} className={`${
              calendarNoticeType === 'error' ? 'text-red-400 hover:text-red-600' :
              calendarNoticeType === 'warning' ? 'text-yellow-400 hover:text-yellow-600' :
              'text-green-400 hover:text-green-600'
            }`}>
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading skeleton while checking calendar status */}
        {calendarLoading && !session && (
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-56 h-10" />
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="h-[400px] bg-gray-100 rounded-lg" />
            </div>
          </div>
        )}

        {/* Live recording banner (visible on all tabs) */}
        {liveSession && activeTab !== 'transcricoes' && (
          <div
            className="mb-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:from-green-600 hover:to-emerald-600 transition-all shadow-md"
            onClick={() => setActiveTab('transcricoes')}
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="text-sm font-semibold text-white">
                {liveSession.status === 'recording' ? 'Reunião sendo gravada pelo App' : 'Avaliando reunião...'}
              </span>
              <span className="text-xs text-white/70">
                {liveSession.segment_count || 0} segmentos • {liveSession.word_count || 0} palavras
              </span>
            </div>
            <span className="text-xs text-white/80 font-medium flex items-center gap-1">
              Ver transcrição ao vivo
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        )}

        {/* Content Section */}
        {!session && (
          <>
            {/* Google Calendar Connection Card (not connected) — Enhanced onboarding */}
            {!calendarConnected && !calendarLoading && (
              <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500 rounded-2xl p-6 mb-4 text-white shadow-lg shadow-blue-200/50 relative overflow-hidden">
                <img src="/google-calendar-logo.png" alt="Google Calendar" className="absolute -top-2 -left-2 w-28 h-28 object-contain drop-shadow-md opacity-90" />
                <div className="flex items-start gap-4">
                  <div className="w-28 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold mb-1">Conecte seu Google Calendar</h3>
                    <p className="text-sm text-blue-100 mb-4">Suas reuniões com Meet serão gravadas e avaliadas automaticamente</p>
                    <div className="space-y-2 mb-5">
                      {[
                        { icon: Mic, text: 'Bot entra automaticamente nas reuniões' },
                        { icon: Globe, text: 'Transcrição em PT-BR com Deepgram' },
                        { icon: Sparkles, text: 'Avaliação SPIN automática ao final' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="w-5 h-5 bg-green-400/90 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm text-blue-50">{item.text}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={connectCalendar}
                      disabled={connectingCalendar}
                      className="px-5 py-2.5 bg-white text-blue-600 hover:bg-blue-50 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      {connectingCalendar ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src="/google-calendar-logo.png" alt="" className="w-4 h-4 object-contain" />}
                      Conectar Google Calendar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Navigation (when NOT connected — show Manual + Transcrições) */}
            {!calendarConnected && !calendarLoading && (
              <div className="mb-4">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                  {([
                    { id: 'manual' as MeetTab, icon: Link2, label: 'Manual' },
                    { id: 'transcricoes' as MeetTab, icon: Monitor, label: 'Transcrições App' },
                  ]).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Re-auth banner (write scopes needed) */}
            {calendarConnected && !hasWriteAccess && (
              <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Atualize as permissões para criar eventos no calendário</span>
                </div>
                <button
                  onClick={connectCalendar}
                  disabled={connectingCalendar}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {connectingCalendar ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Reautorizar
                </button>
              </div>
            )}

            {/* Tab Navigation (when connected) */}
            {calendarConnected && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                    {([
                      { id: 'calendar' as MeetTab, icon: CalendarDays, label: 'Calendário' },
                      { id: 'manual' as MeetTab, icon: Link2, label: 'Manual' },
                      { id: 'transcricoes' as MeetTab, icon: Monitor, label: 'Transcrições App' },
                    ]).map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          activeTab === tab.id
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {calendarEmail && (
                      <div className="flex items-center gap-1.5 hidden sm:flex">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-xs text-gray-400">{calendarEmail}</span>
                      </div>
                    )}

                    {hasWriteAccess && (
                      <button
                        onClick={() => { setCreateEventDate(undefined); setCreateEventHour(undefined); setShowCreateEventModal(true) }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl shadow-md hover:shadow-lg transition-all"
                        title="Criar evento"
                      >
                        <Plus className="w-6 h-6 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700 hidden sm:inline">Criar</span>
                      </button>
                    )}
                    <button
                      onClick={() => loadCalendarEvents()}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Sincronizar eventos"
                    >
                      <RefreshCw className={`w-4 h-4 ${calendarEventsLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowDisconnectConfirm(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs"
                        title="Sair do Google Calendar"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Sair</span>
                      </button>

                      {/* Disconnect confirmation popover */}
                      {showDisconnectConfirm && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
                          <p className="text-sm font-medium text-gray-900 mb-1">Desconectar Google Calendar?</p>
                          <p className="text-xs text-gray-500 mb-3">A gravação automática das reuniões será desativada.</p>
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => setShowDisconnectConfirm(false)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => { setShowDisconnectConfirm(false); disconnectCalendar() }}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                            >
                              Sim, desconectar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ========== TAB: Calendário (Google Calendar style) ========== */}
            {calendarConnected && activeTab === 'calendar' && (
              <div className="flex gap-4">
                {/* Mini month calendar sidebar */}
                <MiniCalendar
                  currentWeekStart={currentWeekStart}
                  onDateClick={(date) => {
                    const d = new Date(date)
                    const day = d.getDay()
                    d.setDate(d.getDate() - day) // go to Sunday
                    d.setHours(0, 0, 0, 0)
                    setCurrentWeekStart(d)
                  }}
                />

                {/* Main week view */}
                <div className="flex-1 min-w-0">
                  <CalendarWeekView
                    events={calendarEvents}
                    loading={calendarEventsLoading}
                    currentWeekStart={currentWeekStart}
                    onPrevWeek={handlePrevWeek}
                    onNextWeek={handleNextWeek}
                    onToday={handleToday}
                    onEventClick={(event, anchorRect) => {
                      setPopoverEvent(event as CalendarEvent)
                      setPopoverAnchor(anchorRect)
                    }}
                    onCreateEvent={hasWriteAccess ? (date, hour) => {
                      setCreateEventDate(date)
                      setCreateEventHour(hour)
                      setShowCreateEventModal(true)
                    } : undefined}
                    onEventTimeUpdate={hasWriteAccess ? async (eventId, newStart, newEnd) => {
                      const { data: { session: authSession } } = await supabase.auth.getSession()
                      if (!authSession?.access_token) return

                      // Optimistic UI: update local state immediately
                      setCalendarEvents(prev => prev.map(ev =>
                        ev.id === eventId ? { ...ev, start: newStart, end: newEnd } : ev
                      ))

                      try {
                        const res = await fetch('/api/calendar/events/update', {
                          method: 'POST',
                          headers: {
                            Authorization: `Bearer ${authSession.access_token}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            eventId,
                            startDateTime: newStart,
                            endDateTime: newEnd,
                          }),
                        })

                        if (!res.ok) {
                          // Revert on error
                          await loadCalendarEvents()
                          const err = await res.json()
                          setCalendarNoticeType('error')
                          setCalendarNotice(err.error || 'Erro ao mover evento')
                        }
                      } catch {
                        await loadCalendarEvents()
                        setCalendarNoticeType('error')
                        setCalendarNotice('Erro ao atualizar evento')
                      }
                    } : undefined}
                  />
                </div>
              </div>
            )}

            {/* Popover for event details */}
            {popoverEvent && (
              <CalendarEventPopover
                event={popoverEvent as any}
                anchorRect={popoverAnchor}
                onClose={() => { setPopoverEvent(null); setPopoverAnchor(null) }}
                onToggleBot={(scheduledBotId, enabled) => {
                  toggleCalendarBot(scheduledBotId, enabled)
                  setPopoverEvent(prev => prev ? { ...prev, botEnabled: enabled, botStatus: enabled ? 'pending' : 'skipped' } : null)
                }}
                onViewEvaluation={(ev) => {
                  const evalId = ev.evaluationId
                  router.push(evalId ? `/history?tab=meet&evaluationId=${evalId}` : '/history?tab=meet')
                }}
                onResetStatus={(scheduledBotId) => toggleCalendarBot(scheduledBotId, true)}
                onDeleteEvent={hasWriteAccess ? handleDeleteEvent : undefined}
                onAddAttendees={hasWriteAccess ? handleAddAttendees : undefined}
                onEditEvent={hasWriteAccess ? (ev) => {
                  // Find full event data (popoverEvent has the CalendarEvent with description)
                  const fullEvent = calendarEvents.find(e => e.id === ev.id)
                  setEditEventData({
                    id: ev.id,
                    title: ev.title,
                    start: ev.start,
                    end: ev.end,
                    meetLink: ev.meetLink,
                    attendees: ev.attendees,
                    description: fullEvent?.description || null,
                  })
                  setShowCreateEventModal(true)
                  setPopoverEvent(null)
                  setPopoverAnchor(null)
                } : undefined}
                togglingEventId={togglingEventId}
              />
            )}

            {/* Create/Edit Event Modal */}
            <CalendarEventModal
              isOpen={showCreateEventModal}
              onClose={() => { setShowCreateEventModal(false); setEditEventData(null) }}
              onSubmit={handleCreateEvent}
              prefillDate={createEventDate}
              prefillHour={createEventHour}
              editEvent={editEventData}
            />

            {/* ========== TAB: Manual (or when not connected and on manual tab) ========== */}
            {(activeTab === 'manual') && (
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
            )}

            {/* Steps + Background notice (only when calendar not connected and on manual tab) */}
            {!calendarConnected && !calendarLoading && activeTab === 'manual' && (
              <>
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

                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-8">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span>A avaliação é gerada em background automaticamente</span>
                </div>
              </>
            )}

            {/* ========== TAB: Transcrições App (desktop recordings) ========== */}
            {activeTab === 'transcricoes' && (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-green-600" />
                    <h2 className="text-sm font-semibold text-gray-700">Transcrições do App Desktop</h2>
                  </div>
                  <button
                    onClick={loadDesktopTranscriptions}
                    disabled={loadingTranscriptions}
                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Atualizar"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingTranscriptions ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* How it works */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Transcrição automática via App Desktop</p>
                      <p className="text-xs text-green-600 mt-1">
                        O app Ramppy detecta automaticamente quando um Google Meet abre no seu computador, grava o áudio e transcreve em tempo real. Ao final da reunião, a avaliação SPIN é gerada automaticamente.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ===== LIVE SESSION CARD ===== */}
                {liveSession && (
                  <div className="bg-white rounded-xl border-2 border-green-400 shadow-lg overflow-hidden animate-in">
                    {/* Live header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {liveSession.status === 'recording' ? 'Gravando reunião ao vivo' : 'Avaliando reunião...'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-white/80 text-xs">
                        <span>{liveSession.segment_count || 0} segmentos</span>
                        <span>•</span>
                        <span>{liveSession.word_count || 0} palavras</span>
                        {liveSession.seller_name && (
                          <>
                            <span>•</span>
                            <span>{liveSession.seller_name}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Live transcript */}
                    <div className="max-h-96 overflow-y-auto p-4 space-y-2">
                      {liveSession.status === 'evaluating' && (
                        <div className="flex items-center justify-center py-6 gap-3">
                          <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                          <span className="text-sm text-gray-600">Gerando avaliação SPIN...</span>
                        </div>
                      )}
                      {(() => {
                        const transcript = Array.isArray(liveSession.transcript) ? liveSession.transcript : []
                        if (transcript.length === 0 && liveSession.status === 'recording') {
                          return (
                            <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
                              <Mic className="w-4 h-4 mr-2 animate-pulse" />
                              Aguardando fala...
                            </div>
                          )
                        }
                        return transcript.map((seg: any, idx: number) => {
                          const spNum = parseInt(seg.speaker?.replace('Speaker ', '') || '0')
                          return (
                            <div key={idx} className="flex gap-2 animate-in">
                              <span className={`text-xs font-semibold whitespace-nowrap min-w-[70px] ${spNum > 0 ? 'text-blue-600' : 'text-green-600'}`}>
                                {seg.speaker || `#${idx + 1}`}
                              </span>
                              <p className="text-sm text-gray-700">{seg.text}</p>
                            </div>
                          )
                        })
                      })()}
                      <div ref={liveTranscriptEndRef} />
                    </div>

                    {/* Live footer with elapsed time */}
                    {liveSession.status === 'recording' && (
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          Iniciado às {new Date(liveSession.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          Transcrição em tempo real
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Loading state */}
                {loadingTranscriptions && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                  </div>
                )}

                {/* Empty state */}
                {!loadingTranscriptions && desktopTranscriptions.length === 0 && !liveSession && (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                    <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Nenhuma transcrição do app ainda</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Abra o app desktop Ramppy e entre em um Google Meet para gravar automaticamente.
                    </p>
                  </div>
                )}

                {/* Transcription list */}
                {!loadingTranscriptions && desktopTranscriptions.map((item) => {
                  const rawScore = item.overall_score || 0
                  const score = rawScore > 10 ? rawScore / 10 : rawScore
                  const scoreColor = score >= 7 ? 'text-green-600 bg-green-50 border-green-200' :
                    score >= 5 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                    'text-red-600 bg-red-50 border-red-200'
                  const date = new Date(item.created_at)
                  const isExpanded = expandedTranscription === item.id
                  const transcript = Array.isArray(item.transcript) ? item.transcript : []
                  const wordCount = transcript.reduce((acc: number, seg: any) => acc + (seg.text?.split(' ').length || 0), 0)
                  const evaluation = item.evaluation || {}

                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      {/* Card header */}
                      <div
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedTranscription(isExpanded ? null : item.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${scoreColor}`}>
                              <span className="text-sm font-bold">{score.toFixed(1)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {item.seller_name || 'Reunião'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-400">
                                  {date.toLocaleDateString('pt-BR')} às {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs text-gray-400">{transcript.length} segmentos</span>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs text-gray-400">{wordCount} palavras</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* SPIN mini scores */}
                            <div className="hidden sm:flex items-center gap-1.5">
                              {['S', 'P', 'I', 'N'].map((letter) => {
                                const key = `spin_${letter.toLowerCase()}_score` as keyof typeof item
                                const val = parseFloat(item[key]) || 0
                                const color = val >= 7 ? 'text-green-600' : val >= 5 ? 'text-amber-600' : 'text-red-500'
                                return (
                                  <span key={letter} className={`text-xs font-medium ${color}`}>
                                    {letter}:{val.toFixed(0)}
                                  </span>
                                )
                              })}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/history?tab=meet&evaluationId=${item.id}`) }}
                              className="px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors border border-green-200"
                            >
                              Ver Análise
                            </button>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </div>

                        {/* Executive summary preview */}
                        {evaluation.executive_summary && !isExpanded && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{evaluation.executive_summary}</p>
                        )}
                      </div>

                      {/* Expanded: Transcript */}
                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          {/* Summary */}
                          {evaluation.executive_summary && (
                            <div className="px-4 py-3 bg-gray-50">
                              <p className="text-xs font-medium text-gray-600 mb-1">Resumo</p>
                              <p className="text-sm text-gray-700">{evaluation.executive_summary}</p>
                            </div>
                          )}

                          {/* Strengths + Gaps */}
                          {(evaluation.top_strengths?.length > 0 || evaluation.critical_gaps?.length > 0) && (
                            <div className="px-4 py-3 grid grid-cols-2 gap-4 bg-gray-50 border-t border-gray-100">
                              {evaluation.top_strengths?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-green-700 mb-1">Pontos Fortes</p>
                                  {evaluation.top_strengths.slice(0, 3).map((s: string, i: number) => (
                                    <p key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                                      {s}
                                    </p>
                                  ))}
                                </div>
                              )}
                              {evaluation.critical_gaps?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-red-700 mb-1">Gaps Críticos</p>
                                  {evaluation.critical_gaps.slice(0, 3).map((g: string, i: number) => (
                                    <p key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                      <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                                      {g}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Transcript segments */}
                          <div className="px-4 py-3 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-600 mb-2">Transcrição ({transcript.length} segmentos)</p>
                            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                              {transcript.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Sem transcrição disponível</p>
                              ) : (
                                transcript.map((seg: any, idx: number) => (
                                  <div key={idx} className="flex gap-2">
                                    <span className="text-xs font-medium text-green-600 whitespace-nowrap min-w-[60px]">
                                      {seg.speaker || `#${idx + 1}`}
                                    </span>
                                    <p className="text-xs text-gray-700">{seg.text}</p>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Recent Analyses */}
            {recentEvaluations.length > 0 && activeTab !== 'transcricoes' && (
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
                    const rawScore = ev.overall_score || 0
                    const score = rawScore > 10 ? rawScore / 10 : rawScore
                    const scoreColor = score >= 7 ? 'text-green-600 bg-green-50 border-green-200' :
                      score >= 5 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                      'text-red-600 bg-red-50 border-red-200'
                    const date = new Date(ev.created_at)
                    return (
                      <div
                        key={ev.id}
                        onClick={() => router.push(`/history?tab=meet&evaluationId=${ev.id}`)}
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

            {recentEvaluations.length === 0 && activeTab !== 'transcricoes' && (
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
            {session.status !== 'ended' && session.status !== 'error' && session.status !== 'sending' && session.status !== 'waiting_room' && (
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
                    Lembre-se de aceitar o &quot;Ramppy&quot; quando ele pedir para entrar!
                  </p>
                </div>
              </div>
            )}
            {/* Waiting room alert */}
            {session.status === 'waiting_room' && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-6">
                <div className="flex flex-col items-center justify-center">
                  <AlertTriangle className="w-8 h-8 mb-3 text-amber-600" />
                  <p className="text-amber-800 font-semibold">O Ramppy está na sala de espera</p>
                  <p className="text-sm text-amber-700 mt-2 text-center">
                    Abra o Google Meet, vá em <strong>Pessoas</strong> → <strong>Sala de espera</strong> e clique em <strong>Admitir</strong> para o Ramppy entrar na reunião.
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

            {/* Error state */}
            {session.status === 'error' && error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-semibold">Falha na análise</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
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

              {/* Content — Report style */}
              <div className="px-8 py-6 max-h-[70vh] overflow-y-auto text-[15px] leading-relaxed text-gray-700">

                {/* Executive Summary */}
                {evaluation.executive_summary && (
                  <section className="mb-6">
                    <p className="whitespace-pre-line">{evaluation.executive_summary}</p>
                  </section>
                )}

                {/* SPIN */}
                <section className="mb-6">
                  <h3 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">Metodologia SPIN</h3>
                  <div className="space-y-4">
                    {(['S', 'P', 'I', 'N'] as const).map((letter) => {
                      const spinData = evaluation.spin_evaluation?.[letter as keyof typeof evaluation.spin_evaluation]
                      if (!spinData) return null
                      const score = spinData.final_score ?? 0
                      const scoreColor = score >= 7 ? 'text-green-600' : score >= 5 ? 'text-amber-600' : 'text-red-600'
                      const labels: Record<string, string> = { S: 'Situação', P: 'Problema', I: 'Implicação', N: 'Necessidade' }
                      return (
                        <div key={letter}>
                          <p className="mb-0.5">
                            <span className="font-semibold text-gray-900">{labels[letter]}</span>
                            <span className={`ml-2 font-bold ${scoreColor}`}>{score.toFixed(1)}</span>
                          </p>
                          {spinData.technical_feedback && (
                            <p className="text-gray-600 text-sm">{spinData.technical_feedback}</p>
                          )}
                          {spinData.missed_opportunities && spinData.missed_opportunities.length > 0 && (
                            <ul className="mt-1 ml-4 text-sm text-amber-700 list-disc">
                              {spinData.missed_opportunities.map((opp: string, i: number) => (
                                <li key={i}>{opp}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Strengths & Gaps */}
                {((evaluation.top_strengths && evaluation.top_strengths.length > 0) || (evaluation.critical_gaps && evaluation.critical_gaps.length > 0)) && (
                  <section className="mb-6">
                    <h3 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">Pontos Fortes e Gaps</h3>
                    {evaluation.top_strengths && evaluation.top_strengths.length > 0 && (
                      <div className="mb-3">
                        <p className="font-semibold text-green-700 text-sm mb-1">Pontos Fortes</p>
                        <ul className="ml-4 list-disc space-y-0.5">
                          {evaluation.top_strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {evaluation.critical_gaps && evaluation.critical_gaps.length > 0 && (
                      <div>
                        <p className="font-semibold text-amber-700 text-sm mb-1">Gaps Críticos</p>
                        <ul className="ml-4 list-disc space-y-0.5">
                          {evaluation.critical_gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}
                        </ul>
                      </div>
                    )}
                  </section>
                )}

                {/* Objections */}
                {evaluation.objections_analysis && evaluation.objections_analysis.length > 0 && (
                  <section className="mb-6">
                    <h3 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">Objeções Identificadas</h3>
                    <div className="space-y-3">
                      {evaluation.objections_analysis.map((obj: any, idx: number) => (
                        <div key={idx}>
                          <p className="mb-0.5">
                            <span className="font-semibold text-gray-900">{obj.objection_type || `Objeção ${idx + 1}`}</span>
                            <span className={`ml-2 text-sm font-bold ${(obj.score ?? 0) >= 7 ? 'text-green-600' : (obj.score ?? 0) >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                              {obj.score}/10
                            </span>
                          </p>
                          {obj.objection_text && <p className="text-gray-500 text-sm italic">"{obj.objection_text}"</p>}
                          {obj.detailed_analysis && <p className="text-sm">{obj.detailed_analysis}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Playbook Adherence */}
                {evaluation.playbook_adherence && (
                  <section className="mb-6">
                    <h3 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">
                      Aderência ao Playbook
                      <span className={`ml-2 text-sm font-bold ${
                        (evaluation.playbook_adherence.overall_adherence_score ?? 0) >= 70 ? 'text-green-600' :
                        (evaluation.playbook_adherence.overall_adherence_score ?? 0) >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {evaluation.playbook_adherence.overall_adherence_score}%
                      </span>
                    </h3>

                    {evaluation.playbook_adherence.dimensions && (
                      <div className="mb-3">
                        {Object.entries(evaluation.playbook_adherence.dimensions).map(([key, dim]: [string, any]) => {
                          if (!dim) return null
                          const dimLabels: Record<string, string> = { opening: 'Abertura', closing: 'Fechamento', conduct: 'Conduta', required_scripts: 'Scripts', process: 'Processo' }
                          const scoreColor = dim.score >= 70 ? 'text-green-600' : dim.score >= 50 ? 'text-amber-600' : 'text-red-600'
                          return (
                            <p key={key} className="text-sm">
                              <span className="text-gray-600">{dimLabels[key] || key}:</span>
                              <span className={`ml-1 font-semibold ${scoreColor}`}>{dim.score}%</span>
                            </p>
                          )
                        })}
                      </div>
                    )}

                    {evaluation.playbook_adherence.violations && evaluation.playbook_adherence.violations.length > 0 && (
                      <div className="mb-2">
                        <p className="font-semibold text-red-700 text-sm mb-1">Violações</p>
                        <ul className="ml-4 list-disc text-sm text-red-700 space-y-0.5">
                          {evaluation.playbook_adherence.violations.map((v: any, i: number) => (
                            <li key={i}>{typeof v === 'string' ? v : v?.criterion || v?.description || JSON.stringify(v)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.playbook_adherence.exemplary_moments && evaluation.playbook_adherence.exemplary_moments.length > 0 && (
                      <div className="mb-2">
                        <p className="font-semibold text-green-700 text-sm mb-1">Momentos Exemplares</p>
                        <ul className="ml-4 list-disc text-sm text-green-700 space-y-0.5">
                          {evaluation.playbook_adherence.exemplary_moments.map((m: any, i: number) => (
                            <li key={i}>{typeof m === 'string' ? m : m?.criterion || ''}{typeof m === 'object' && m?.evidence ? ` — ${m.evidence}` : ''}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.playbook_adherence.coaching_notes && (
                      <p className="text-sm text-gray-600 mt-2"><span className="font-semibold">Coaching:</span> {evaluation.playbook_adherence.coaching_notes}</p>
                    )}
                  </section>
                )}

                {/* Priority Improvements */}
                {evaluation.priority_improvements && evaluation.priority_improvements.length > 0 && (
                  <section className="mb-6">
                    <h3 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2 mb-3">Melhorias Prioritárias</h3>
                    <div className="space-y-3">
                      {evaluation.priority_improvements.map((imp: any, idx: number) => (
                        <div key={idx}>
                          <p className="font-semibold text-gray-900 text-sm">
                            {imp.area}
                            <span className={`ml-2 text-xs font-medium ${
                              imp.priority === 'critical' ? 'text-red-600' : imp.priority === 'high' ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              ({imp.priority === 'critical' ? 'Crítico' : imp.priority === 'high' ? 'Alta' : 'Média'})
                            </span>
                          </p>
                          {imp.current_gap && <p className="text-sm text-gray-600">{imp.current_gap}</p>}
                          {imp.action_plan && <p className="text-sm text-gray-700"><span className="font-medium">Plano:</span> {imp.action_plan}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
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
