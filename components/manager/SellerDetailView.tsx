'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Loader2, CalendarDays, Clock, ChevronDown, Video, X } from 'lucide-react'
import CalendarWeekView from '../CalendarWeekView'
import MiniCalendar from '../MiniCalendar'
import MeetHistoryContent from '../MeetHistoryContent'
import type { SellerPerformance } from './SellerGrid'

// ── Types ───────────────────────────────────────────────────────────────────

interface CalendarConnection {
  connected: boolean
  googleEmail: string | null
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
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRaw[]>([])
  const [upcomingMeetings, setUpcomingMeetings] = useState<CalendarEventRaw[]>([])

  // Collapsible sections
  const [meetingsOpen, setMeetingsOpen] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)

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

      const calendarRes = await fetch(`/api/admin/seller-calendar?sellerId=${seller.user_id}`, { headers, signal })
      const calendarData = await calendarRes.json()

      setConnection(calendarData.connection || { connected: false, googleEmail: null })
      setCalendarEvents(calendarData.allEvents || [])
      setUpcomingMeetings(calendarData.upcomingMeetings || [])
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* ── Left Column ──────────────────────────────────────────────────── */}
      <div className="lg:col-span-4 space-y-4">
        {/* Google Calendar Connection */}
        <div className={`bg-white rounded-xl border p-4 flex items-center gap-3 ${
          connection.connected ? 'border-green-200' : 'border-gray-200'
        }`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
            connection.connected ? 'bg-white ring-2 ring-green-200' : 'bg-gray-100'
          }`}>
            <GoogleIcon className={connection.connected ? 'w-4 h-4' : 'w-4 h-4 opacity-30'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${connection.connected ? 'text-gray-900' : 'text-gray-500'}`}>
              Google Calendar
            </p>
            <p className="text-xs text-gray-400 truncate">
              {connection.connected ? connection.googleEmail : 'Nao conectado'}
            </p>
          </div>
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
            connection.connected ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
          }`}>
            {connection.connected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>

        {/* Mini Calendar + History button side by side */}
        <div className="flex gap-3">
          <div className="flex-1 bg-white rounded-xl border border-gray-200 p-3">
            <MiniCalendar
              currentWeekStart={currentWeekStart}
              onDateClick={handleDateClick}
            />
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="w-20 bg-white rounded-xl border border-gray-200 p-3 flex flex-col items-center justify-center gap-2 hover:border-green-300 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-50">
              <Video className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-[10px] font-medium text-gray-600 leading-tight text-center">Historico</span>
          </button>
        </div>

        {/* Upcoming Meetings (collapsible) */}
        <div className="bg-white rounded-xl border border-blue-100">
          <button
            onClick={() => setMeetingsOpen(!meetingsOpen)}
            className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors rounded-xl"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#E3F2FD' }}>
              <CalendarDays className="w-4.5 h-4.5" style={{ color: MEET_BLUE }} />
            </div>
            <div className="flex-1 text-left">
              <h2 className="text-sm font-bold text-gray-900">Proximas Reunioes</h2>
              <p className="text-[10px] text-gray-500">
                {upcomingMeetings.length} {upcomingMeetings.length === 1 ? 'agendada' : 'agendadas'}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${meetingsOpen ? 'rotate-180' : ''}`} />
          </button>

          {meetingsOpen && (
            <div className="px-5 pb-5">
              {upcomingMeetings.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma reuniao agendada</p>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-[7px] top-2 bottom-2 w-0.5 rounded-full" style={{ backgroundColor: '#90CAF9' }} />
                  <div className="space-y-3">
                    {upcomingMeetings.map((meeting) => {
                      const status = botStatusConfig[meeting.botStatus] || botStatusConfig.pending
                      const attendeeCount = meeting.attendees?.length || 0
                      return (
                        <div key={meeting.id} className="relative">
                          <div
                            className="absolute -left-6 top-3 w-3 h-3 rounded-full border-2 border-white"
                            style={{ backgroundColor: MEET_BLUE }}
                          />
                          <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                            <p className="text-sm font-medium text-gray-900 mb-1">{meeting.eventTitle}</p>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-2">
                              <Clock className="w-3 h-3" />
                              <span>
                                {formatDateShort(meeting.eventStart)}, {formatTime(meeting.eventStart)}
                                {meeting.eventEnd && ` – ${formatTime(meeting.eventEnd)}`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex -space-x-1">
                                {meeting.attendees.slice(0, 4).map((a, i) => (
                                  <div
                                    key={i}
                                    className="w-5 h-5 rounded-full bg-blue-100 border border-white flex items-center justify-center"
                                    title={a.displayName || a.email}
                                  >
                                    <span className="text-[8px] font-bold" style={{ color: MEET_BLUE }}>
                                      {(a.displayName || a.email).charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                ))}
                                {attendeeCount > 4 && (
                                  <span className="text-[9px] text-gray-400 ml-1.5 self-center">+{attendeeCount - 4}</span>
                                )}
                              </div>
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${status.color} ${status.bg}`}>
                                {status.dot && <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />}
                                {status.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Right Column: Calendar or Meet History ─────────────────────── */}
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

            {/* History Content */}
            <MeetHistoryContent sellerId={seller.user_id} />
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
  )
}
