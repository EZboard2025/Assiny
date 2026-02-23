'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Loader2, CalendarDays, Clock, ChevronDown, Video, X, TrendingUp, TrendingDown, Search, Settings, Zap, Target } from 'lucide-react'
import CalendarWeekView from '../CalendarWeekView'
import MiniCalendar from '../MiniCalendar'
import MeetHistoryContent from '../MeetHistoryContent'
import type { SellerPerformance } from './SellerGrid'

// ── Types ───────────────────────────────────────────────────────────────────

interface CalendarConnection {
  connected: boolean
  googleEmail: string | null
}

interface WhatsAppConnection {
  connected: boolean
  phone: string | null
}

interface CalendarEventRaw {
  id: string
  eventTitle: string
  eventStart: string
  eventEnd: string | null
  meetLink: string
  attendees: Array<{ email: string; displayName?: string }>
  botEnabled: boolean
  botStatus: string
  evaluationId?: string | null
}

interface SellerDetailViewProps {
  seller: SellerPerformance
  whatsappSummary: { count: number; avg: number }
  onBack: () => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const MEET_BLUE = '#039BE5'

const getScoreColor = (score: number) => {
  if (score >= 8) return 'text-green-600'
  if (score >= 6) return 'text-yellow-600'
  if (score > 0) return 'text-red-500'
  return 'text-gray-400'
}

const getBarColor = (score: number) => {
  if (score >= 8) return 'bg-green-500'
  if (score >= 6) return 'bg-yellow-500'
  if (score > 0) return 'bg-red-400'
  return 'bg-gray-200'
}

const spinPillars = [
  { key: 'S', label: 'Situação', icon: Search, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { key: 'P', label: 'Problema', icon: Settings, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'I', label: 'Implicação', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'N', label: 'Necessidade', icon: Target, color: 'text-pink-600', bg: 'bg-pink-50' },
] as const

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const formatDateShort = (date: string) =>
  new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

const botStatusConfig: Record<string, { label: string; color: string; bg: string; dot?: string }> = {
  pending: { label: 'Aguardando', color: 'text-gray-500', bg: 'bg-gray-100' },
  scheduled: { label: 'Agendado', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  joining: { label: 'Entrando...', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  recording: { label: 'Gravando', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' },
}

const GoogleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

// Get the Sunday of the current week
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SellerDetailView({ seller, whatsappSummary, onBack }: SellerDetailViewProps) {
  const [loading, setLoading] = useState(true)
  const [connection, setConnection] = useState<CalendarConnection>({ connected: false, googleEmail: null })
  const [whatsappConn, setWhatsappConn] = useState<WhatsAppConnection>({ connected: false, phone: null })
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRaw[]>([])
  const [upcomingMeetings, setUpcomingMeetings] = useState<CalendarEventRaw[]>([])

  // Collapsible sections
  const [meetingsOpen, setMeetingsOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [allMeetingsOpen, setAllMeetingsOpen] = useState(false)

  // Calendar navigation
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    loadData()
    return () => { abortRef.current?.abort() }
  }, [seller.user_id])

  const loadData = async () => {
    const signal = abortRef.current?.signal
    try {
      setLoading(true)
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()
      const headers = { 'x-company-id': companyId || '' }

      const [calendarRes, connectionsRes] = await Promise.all([
        fetch(`/api/admin/seller-calendar?sellerId=${seller.user_id}`, { headers, signal }),
        fetch('/api/admin/seller-connections', { headers, signal })
      ])
      const calendarData = await calendarRes.json()
      const connectionsData = await connectionsRes.json()

      setConnection(calendarData.connection || { connected: false, googleEmail: null })
      setCalendarEvents(calendarData.allEvents || [])
      setUpcomingMeetings(calendarData.upcomingMeetings || [])

      // WhatsApp connection status
      const sellerConn = connectionsData.data?.[seller.user_id]
      setWhatsappConn({
        connected: sellerConn?.whatsapp || false,
        phone: sellerConn?.whatsappPhone || null
      })
    } catch (error: any) {
      if (error?.name === 'AbortError') return
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  // Convert calendar events to CalendarWeekView format
  const weekViewEvents = useMemo(() =>
    calendarEvents.map(e => ({
      id: e.id,
      title: e.eventTitle,
      start: e.eventStart,
      end: e.eventEnd,
      meetLink: e.meetLink,
      attendees: e.attendees,
      botEnabled: e.botEnabled,
      botStatus: e.botStatus,
      botId: null,
      evaluationId: e.evaluationId || null,
      scheduledBotId: e.id,
      evaluation: null,
    })),
    [calendarEvents]
  )

  // Calendar navigation handlers
  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart)
    d.setDate(d.getDate() - 7)
    setCurrentWeekStart(d)
  }
  const handleNextWeek = () => {
    const d = new Date(currentWeekStart)
    d.setDate(d.getDate() + 7)
    setCurrentWeekStart(d)
  }
  const handleToday = () => setCurrentWeekStart(getWeekStart(new Date()))
  const handleDateClick = (date: Date) => setCurrentWeekStart(getWeekStart(date))

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: MEET_BLUE }} />
        <p className="text-gray-500 text-sm">Carregando calendario...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Performance Summary (full width) ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-6 flex-wrap lg:flex-nowrap">
          {/* Score */}
          <div className="text-center flex-shrink-0">
            <p className={`text-3xl font-bold ${seller.total_sessions > 0 ? getScoreColor(seller.overall_average) : 'text-gray-300'}`}>
              {seller.total_sessions > 0 ? seller.overall_average.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">Nota Geral</p>
          </div>
          <div className="h-10 w-px bg-gray-200 hidden lg:block" />
          {/* Sessions + Trend */}
          <div className="flex gap-6 flex-shrink-0">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{seller.total_sessions}</p>
              <p className="text-[10px] text-gray-400 font-medium">Treinos</p>
            </div>
            <div className="text-center">
              {seller.trend === 'improving' ? (
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-bold text-green-600">Subindo</span>
                </div>
              ) : seller.trend === 'declining' ? (
                <div className="flex items-center justify-center gap-1">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-bold text-red-500">Caindo</span>
                </div>
              ) : (
                <p className="text-sm font-bold text-gray-400">Estável</p>
              )}
              <p className="text-[10px] text-gray-400 font-medium">Tendência</p>
            </div>
          </div>
          <div className="h-10 w-px bg-gray-200 hidden lg:block" />
          {/* SPIN Bars */}
          <div className="flex-1 min-w-0 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2">
            {spinPillars.map(pillar => {
              const score = seller[`spin_${pillar.key.toLowerCase()}_average` as keyof typeof seller] as number || 0
              const PillarIcon = pillar.icon
              return (
                <div key={pillar.key} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${pillar.bg}`}>
                    <PillarIcon className={`w-3 h-3 ${pillar.color}`} />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 w-5">{pillar.key}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getBarColor(score)}`}
                      style={{ width: `${Math.max((score / 10) * 100, 0)}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-bold w-7 text-right ${score > 0 ? getScoreColor(score) : 'text-gray-300'}`}>
                    {score > 0 ? score.toFixed(1) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
          {/* WhatsApp Follow-up stats */}
          {(whatsappSummary.count > 0) && (
            <>
              <div className="h-10 w-px bg-gray-200 hidden lg:block" />
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[10px] text-gray-400 font-medium">Follow-up</span>
                <span className="text-[10px] text-gray-500">{whatsappSummary.count} análises</span>
                <span className={`text-xs font-bold ${getScoreColor(whatsappSummary.avg)}`}>
                  {whatsappSummary.avg.toFixed(1)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Grid: Left + Right ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Left Column ──────────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">
          {/* Connection Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Google */}
          <div className={`bg-white rounded-xl border p-3 flex items-center gap-2.5 ${
            connection.connected ? 'border-green-200' : 'border-gray-200'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              connection.connected ? 'bg-white ring-2 ring-green-200' : 'bg-gray-100'
            }`}>
              <GoogleIcon className={connection.connected ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 opacity-30'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${connection.connected ? 'text-gray-900' : 'text-gray-500'}`}>Google</p>
              <p className="text-[10px] text-gray-400 truncate">
                {connection.connected ? connection.googleEmail : 'Desconectado'}
              </p>
            </div>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              connection.connected ? 'bg-green-500' : 'bg-gray-300'
            }`} />
          </div>

          {/* WhatsApp */}
          <div className={`bg-white rounded-xl border p-3 flex items-center gap-2.5 ${
            whatsappConn.connected ? 'border-green-200' : 'border-gray-200'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              whatsappConn.connected ? 'bg-white ring-2 ring-green-200' : 'bg-gray-100'
            }`}>
              <svg className={`w-3.5 h-3.5 ${whatsappConn.connected ? 'text-green-600' : 'text-gray-400 opacity-30'}`} viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${whatsappConn.connected ? 'text-gray-900' : 'text-gray-500'}`}>WhatsApp</p>
              <p className="text-[10px] text-gray-400 truncate">
                {whatsappConn.connected ? (whatsappConn.phone || 'Conectado') : 'Desconectado'}
              </p>
            </div>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              whatsappConn.connected ? 'bg-green-500' : 'bg-gray-300'
            }`} />
          </div>
        </div>

        {/* Mini Calendar + History button */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <MiniCalendar
            currentWeekStart={currentWeekStart}
            onDateClick={handleDateClick}
          />
          <button
            onClick={() => setHistoryOpen(true)}
            className="w-full mt-3 flex items-center gap-2.5 px-3 py-2.5 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
          >
            <Video className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-green-700 flex-1 text-left">Historico de Reunioes</span>
            <span className="text-[10px] text-green-500">&rsaquo;</span>
          </button>
        </div>

        {/* Upcoming Meetings (collapsible, compact) */}
        <div className="bg-white rounded-xl border border-blue-100">
          <button
            onClick={() => setMeetingsOpen(!meetingsOpen)}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors rounded-xl"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E3F2FD' }}>
              <CalendarDays className="w-3.5 h-3.5" style={{ color: MEET_BLUE }} />
            </div>
            <div className="flex-1 text-left">
              <h2 className="text-xs font-bold text-gray-900">Proximas Reunioes</h2>
              <p className="text-[10px] text-gray-500">
                {upcomingMeetings.length} {upcomingMeetings.length === 1 ? 'agendada' : 'agendadas'}
              </p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${meetingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {meetingsOpen && (
            <div className="px-3 pb-3">
              {upcomingMeetings.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-3">Nenhuma reuniao agendada</p>
              ) : (
                <div className="space-y-1.5">
                  {upcomingMeetings.slice(0, 2).map((meeting) => {
                    const status = botStatusConfig[meeting.botStatus] || botStatusConfig.pending
                    return (
                      <div key={meeting.id} className="flex items-center gap-2.5 bg-gray-50 rounded-lg border border-gray-100 px-2.5 py-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MEET_BLUE }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-gray-900 truncate">{meeting.eventTitle}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            <Clock className="w-2.5 h-2.5" />
                            <span>
                              {formatDateShort(meeting.eventStart)}, {formatTime(meeting.eventStart)}
                              {meeting.eventEnd && ` – ${formatTime(meeting.eventEnd)}`}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 ${status.color} ${status.bg}`}>
                          {status.dot && <span className={`w-1 h-1 rounded-full ${status.dot} animate-pulse`} />}
                          {status.label}
                        </span>
                      </div>
                    )
                  })}
                  {upcomingMeetings.length > 2 && (
                    <button
                      onClick={() => { setAllMeetingsOpen(true); setHistoryOpen(false) }}
                      className="w-full text-center text-[11px] font-semibold py-1.5 rounded-lg transition-colors hover:bg-blue-50"
                      style={{ color: MEET_BLUE }}
                    >
                      Ver todas ({upcomingMeetings.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Right Column: Calendar / Meet History / All Meetings ────── */}
      <div className="lg:col-span-8">
        {historyOpen ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* History Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-50">
                <Video className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-gray-900">Historico de Reunioes</h2>
                <p className="text-[10px] text-gray-500">{seller.user_name}</p>
              </div>
              <button
                onClick={() => setHistoryOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <MeetHistoryContent sellerId={seller.user_id} />
          </div>
        ) : allMeetingsOpen ? (
          <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
            {/* All Meetings Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#E3F2FD' }}>
                <CalendarDays className="w-4 h-4" style={{ color: MEET_BLUE }} />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-gray-900">Todas as Reunioes</h2>
                <p className="text-[10px] text-gray-500">{upcomingMeetings.length} agendadas</p>
              </div>
              <button
                onClick={() => setAllMeetingsOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {/* All Meetings List */}
            <div className="p-4 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
              {upcomingMeetings.map((meeting) => {
                const status = botStatusConfig[meeting.botStatus] || botStatusConfig.pending
                const attendeeCount = meeting.attendees?.length || 0
                return (
                  <div key={meeting.id} className="flex items-center gap-3 bg-gray-50 rounded-lg border border-gray-100 px-3 py-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: MEET_BLUE }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{meeting.eventTitle}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <Clock className="w-2.5 h-2.5" />
                        <span>
                          {formatDateShort(meeting.eventStart)}, {formatTime(meeting.eventStart)}
                          {meeting.eventEnd && ` – ${formatTime(meeting.eventEnd)}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex -space-x-1">
                        {meeting.attendees.slice(0, 3).map((a, i) => (
                          <div
                            key={i}
                            className="w-5 h-5 rounded-full bg-blue-100 border border-white flex items-center justify-center"
                            title={a.displayName || a.email}
                          >
                            <span className="text-[7px] font-bold" style={{ color: MEET_BLUE }}>
                              {(a.displayName || a.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                        ))}
                        {attendeeCount > 3 && (
                          <span className="text-[9px] text-gray-400 ml-1 self-center">+{attendeeCount - 3}</span>
                        )}
                      </div>
                      <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${status.color} ${status.bg}`}>
                        {status.dot && <span className={`w-1 h-1 rounded-full ${status.dot} animate-pulse`} />}
                        {status.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
            <CalendarWeekView
              events={weekViewEvents}
              loading={false}
              currentWeekStart={currentWeekStart}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
              onToday={handleToday}
            />
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
