'use client'

import { useState, useEffect, useMemo } from 'react'
import { Video, ArrowRight, LinkIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  meetLink: string
}

interface AgendaWidgetProps {
  userId: string
  onNavigateToCalendar: () => void
}

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function InlineMiniCalendar({ eventDates }: { eventDates: Set<string> }) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days: Array<{ date: Date; currentMonth: boolean }> = []

    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), currentMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), currentMonth: true })
    }
    const totalCells = days.length <= 35 ? 35 : 42
    const remaining = totalCells - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), currentMonth: false })
    }

    return days
  }, [year, month])

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  return (
    <div className="select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-0.5 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <span className="text-xs font-medium text-gray-700">
          {MONTHS[month]} {year}
        </span>
        <button onClick={nextMonth} className="p-0.5 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-gray-400 py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map(({ date, currentMonth }, i) => {
          const isToday = isSameDay(date, today)
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          const hasEvent = eventDates.has(dateKey)

          return (
            <div
              key={i}
              className={`
                relative text-[11px] h-[24px] w-full flex items-center justify-center
                ${!currentMonth ? 'text-gray-300' : isToday ? 'text-white font-semibold' : 'text-gray-600'}
              `}
            >
              {isToday && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-[22px] h-[22px] bg-green-600 rounded-full" />
                </span>
              )}
              <span className="relative z-[1]">{date.getDate()}</span>
              {hasEvent && !isToday && currentMonth && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AgendaWidget({ userId, onNavigateToCalendar }: AgendaWidgetProps) {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    loadAgenda()
  }, [userId])

  const loadAgenda = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const statusRes = await fetch('/api/calendar/status', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const statusData = await statusRes.json()

      if (!statusData.connected) {
        setConnected(false)
        return
      }

      setConnected(true)

      const eventsRes = await fetch('/api/calendar/events?view=all', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const eventsData = await eventsRes.json()

      if (eventsData.events) {
        setAllEvents(eventsData.events)

        const today = new Date()
        const todayStr = today.toDateString()

        const todayEvents = eventsData.events
          .filter((e: CalendarEvent) => new Date(e.start).toDateString() === todayStr)
          .sort((a: CalendarEvent, b: CalendarEvent) => new Date(a.start).getTime() - new Date(b.start).getTime())
          .slice(0, 5)

        setEvents(todayEvents)
      }
    } catch (err) {
      console.error('AgendaWidget error:', err)
    } finally {
      setLoading(false)
    }
  }

  const eventDates = useMemo(() => {
    const dates = new Set<string>()
    allEvents.forEach(e => {
      const d = new Date(e.start)
      dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    })
    return dates
  }, [allEvents])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
        <div className="space-y-3">
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-10 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Agenda</h3>
        <button
          type="button"
          onClick={onNavigateToCalendar}
          className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1 transition-colors"
        >
          {connected ? 'Ver completo' : 'Conectar'} <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Mini Calendar */}
      <InlineMiniCalendar eventDates={connected ? eventDates : new Set()} />

      {/* Today's events */}
      {connected && events.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Hoje</p>
          {events.map((event) => {
            const now = new Date()
            const start = new Date(event.start)
            const isPast = start < now
            const hasMeet = event.meetLink && event.meetLink.length > 0

            return (
              <div
                key={event.id}
                className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors ${
                  isPast ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200 hover:border-green-200'
                }`}
              >
                <span className={`text-[11px] font-semibold flex-shrink-0 ${isPast ? 'text-gray-400' : 'text-green-600'}`}>
                  {formatTime(event.start)}
                </span>
                <p className="text-xs text-gray-900 truncate flex-1 min-w-0">{event.title}</p>
                {hasMeet && (
                  <Video className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}

      {connected && events.length === 0 && (
        <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 text-center">Sem reuniões hoje</p>
      )}

      {!connected && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={onNavigateToCalendar}
            className="text-xs font-medium text-green-600 hover:text-green-700 flex items-center gap-1 transition-colors mx-auto"
          >
            <LinkIcon className="w-3 h-3" />
            Conectar Google Calendar
          </button>
        </div>
      )}
    </div>
  )
}
