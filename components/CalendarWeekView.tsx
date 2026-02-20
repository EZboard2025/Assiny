'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Video, Loader2 } from 'lucide-react'

const DEFAULT_EVENT_COLOR = '#039be5'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  meetLink?: string
  colorId?: string
  botEnabled?: boolean
  botStatus?: string
  scheduledBotId?: string | null
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>
  evaluation?: { overall_score: number; performance_level: string } | null
}

interface CalendarWeekViewProps {
  events: CalendarEvent[]
  loading?: boolean
  currentWeekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
  onEventClick?: (event: CalendarEvent) => void
  onCreateEvent?: (date: Date, hour: number) => void
}

const HOUR_HEIGHT = 60
const START_HOUR = 0
const END_HOUR = 24
const TOTAL_HOURS = END_HOUR - START_HOUR
const TIME_GUTTER = 56
const WEEK_DAYS_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    days.push(d)
  }
  return days
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date())
}

function formatWeekRange(weekStart: Date): string {
  const days = getWeekDays(weekStart)
  const first = days[0]
  const last = days[6]
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}–${last.getDate()} ${MONTHS_PT[first.getMonth()]} ${first.getFullYear()}`
  }
  return `${first.getDate()} ${MONTHS_PT[first.getMonth()]} – ${last.getDate()} ${MONTHS_PT[last.getMonth()]} ${first.getFullYear()}`
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

export default function CalendarWeekView({
  events,
  loading,
  currentWeekStart,
  onPrevWeek,
  onNextWeek,
  onToday,
  onEventClick,
  onCreateEvent,
}: CalendarWeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * HOUR_HEIGHT - 20
    }
  }, [currentWeekStart])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {}
    for (let i = 0; i < 7; i++) map[i] = []
    for (const ev of events) {
      const start = new Date(ev.start)
      for (let i = 0; i < 7; i++) {
        if (isSameDay(start, weekDays[i])) { map[i].push(ev); break }
      }
    }
    return map
  }, [events, weekDays])

  function getEventStyle(ev: CalendarEvent) {
    const start = new Date(ev.start)
    const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 3600000)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = end.getHours() * 60 + end.getMinutes()
    const top = (startMin / 60) * HOUR_HEIGHT
    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24)
    return { top, height }
  }

  function layoutEventsForDay(dayEvents: CalendarEvent[]) {
    if (!dayEvents.length) return []
    const sorted = [...dayEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    const columns: CalendarEvent[][] = []
    for (const ev of sorted) {
      const evStart = new Date(ev.start).getTime()
      let placed = false
      for (const col of columns) {
        const last = col[col.length - 1]
        const lastEnd = (last.end ? new Date(last.end) : new Date(new Date(last.start).getTime() + 3600000)).getTime()
        if (evStart >= lastEnd) { col.push(ev); placed = true; break }
      }
      if (!placed) columns.push([ev])
    }
    const result: Array<{ event: CalendarEvent; colIndex: number; totalCols: number }> = []
    for (let c = 0; c < columns.length; c++) {
      for (const ev of columns[c]) result.push({ event: ev, colIndex: c, totalCols: columns.length })
    }
    return result
  }

  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT
  const todayIndex = weekDays.findIndex(d => isToday(d))
  const showNowLine = todayIndex >= 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: '600px' }}>
      {/* Navigation bar - fixed */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={onPrevWeek} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={onNextWeek} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={onToday}
            className="px-3 py-1 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors ml-2"
          >
            Hoje
          </button>
        </div>
        <h2 className="text-base font-medium text-gray-800">{formatWeekRange(currentWeekStart)}</h2>
        <div className="w-[120px]" />
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="flex items-center justify-center py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-2" />
          <span className="text-xs text-blue-600">Carregando eventos...</span>
        </div>
      )}

      {/* Single scroll container for header + grid (ensures perfect column alignment) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Use CSS grid: 1 fixed column for time gutter + 7 equal columns for days */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${TIME_GUTTER}px repeat(7, 1fr)`,
            minHeight: TOTAL_HOURS * HOUR_HEIGHT,
          }}
        >
          {/* === STICKY DAY HEADERS (row 1) === */}
          {/* Gutter corner - empty */}
          <div className="sticky top-0 z-[3] bg-white border-b border-gray-200" />

          {/* Day header cells */}
          {weekDays.map((day, i) => {
            const today = isToday(day)
            return (
              <div
                key={`header-${i}`}
                className={`sticky top-0 z-[3] bg-white text-center py-2 border-b border-gray-200 ${i > 0 ? 'border-l border-l-gray-200' : ''}`}
              >
                <div className={`text-[11px] font-medium tracking-wider ${today ? 'text-blue-600' : 'text-gray-500'}`}>
                  {WEEK_DAYS_PT[day.getDay()]}
                </div>
                <div className={`text-[26px] font-normal leading-none mt-1 ${
                  today
                    ? 'w-11 h-11 bg-blue-600 text-white rounded-full inline-flex items-center justify-center'
                    : 'text-gray-800'
                }`}>
                  {day.getDate()}
                </div>
                <div className={`text-[10px] mt-0.5 ${today ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {MONTHS_PT[day.getMonth()]}
                </div>
              </div>
            )
          })}

          {/* === TIME GRID (row 2: spans all hours) === */}
          {/* Time gutter with labels */}
          <div className="relative" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={`label-${i}`}
                className="absolute text-[11px] text-gray-400 text-right pr-2 leading-none"
                style={{ top: i * HOUR_HEIGHT - 6, left: 0, right: 0 }}
              >
                {i > 0 ? formatHour(i + START_HOUR) : ''}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIdx) => {
            const dayEvents = eventsByDay[dayIdx] || []
            const laid = layoutEventsForDay(dayEvents)

            return (
              <div
                key={`col-${dayIdx}`}
                className={`relative ${dayIdx > 0 ? 'border-l border-gray-200' : ''}`}
                style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
              >
                {/* Horizontal hour lines */}
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                  <div
                    key={`hl-${i}`}
                    className="absolute left-0 right-0 border-t border-gray-200"
                    style={{ top: i * HOUR_HEIGHT }}
                  />
                ))}

                {/* Clickable hour cells */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={`cell-${i}`}
                    className="absolute left-0 right-0 cursor-pointer hover:bg-blue-50/40 transition-colors"
                    style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    onClick={() => onCreateEvent?.(day, i + START_HOUR)}
                  />
                ))}

                {/* Events */}
                {laid.map(({ event, colIndex, totalCols }) => {
                  const { top, height } = getEventStyle(event)
                  const wPct = 100 / totalCols
                  const lPct = colIndex * wPct
                  const startTime = new Date(event.start)
                  const timeStr = startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const hasMeet = !!event.meetLink
                  const isRecording = event.botStatus === 'recording'
                  const isCompleted = event.botStatus === 'completed'
                  const evalScore = event.evaluation?.overall_score

                  return (
                    <div
                      key={event.id}
                      className="absolute rounded-[4px] cursor-pointer transition-shadow hover:shadow-lg overflow-hidden z-10"
                      style={{
                        top, height,
                        left: `calc(${lPct}% + 2px)`,
                        width: `calc(${wPct}% - 4px)`,
                        backgroundColor: DEFAULT_EVENT_COLOR,
                      }}
                      onClick={(e) => { e.stopPropagation(); onEventClick?.(event) }}
                    >
                      {isRecording && (
                        <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      )}
                      <div className="px-2 py-1 h-full flex flex-col overflow-hidden">
                        <div className="flex items-center gap-1">
                          {hasMeet && <Video className="w-3 h-3 text-white/80 flex-shrink-0" />}
                          <span className="text-[11px] font-semibold text-white truncate leading-tight">
                            {event.title || 'Sem título'}
                          </span>
                        </div>
                        {height > 32 && (
                          <span className="text-[10px] text-white/80 leading-tight mt-0.5">{timeStr}</span>
                        )}
                        {height > 55 && event.attendees && event.attendees.length > 0 && (
                          <span className="text-[10px] text-white/70 truncate mt-0.5">
                            {event.attendees.length} participante{event.attendees.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {isCompleted && evalScore != null && (
                          <div className="mt-auto">
                            <span className="text-[10px] bg-white/30 text-white px-1 rounded font-medium">
                              {(evalScore / 10).toFixed(1)}/10
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Current time red line */}
                {showNowLine && dayIdx === todayIndex && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 flex-shrink-0" />
                      <div className="flex-1 h-[2px] bg-red-500" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
