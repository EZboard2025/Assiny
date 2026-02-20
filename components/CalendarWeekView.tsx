'use client'

import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Video, Loader2 } from 'lucide-react'
import { getEventColor } from '@/lib/calendar-colors'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  meetLink?: string
  colorId?: string
  botEnabled?: boolean
  botStatus?: string
  botId?: string | null
  evaluationId?: string | null
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
  onEventClick?: (event: CalendarEvent, anchorRect: { top: number; left: number; width: number; height: number }) => void
  onCreateEvent?: (date: Date, hour: number) => void
  onEventTimeUpdate?: (eventId: string, newStart: string, newEnd: string) => void
}

const HOUR_HEIGHT = 60
const START_HOUR = 0
const END_HOUR = 24
const TOTAL_HOURS = END_HOUR - START_HOUR
const TIME_GUTTER = 56
const SNAP_MINUTES = 15
const DRAG_THRESHOLD = 5 // pixels before drag activates (allows clean clicks)
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

function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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
  onEventTimeUpdate,
}: CalendarWeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const timeAreaRef = useRef<HTMLDivElement>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart])

  // Drag state
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize-top' | 'resize-bottom'
    eventId: string
    dayIndex: number
    originalStart: number
    originalEnd: number
    currentStart: number
    currentEnd: number
    offsetMinutes: number
    currentDayIndex: number
  } | null>(null)
  const [isDragActive, setIsDragActive] = useState(false) // true from pickup until drop animation ends
  const [isDropping, setIsDropping] = useState(false) // brief animation on release
  const rafRef = useRef<number>(0)

  // Pending drag: captures mousedown info, only activates after DRAG_THRESHOLD px of movement
  const pendingDragRef = useRef<{
    type: 'move' | 'resize-top' | 'resize-bottom'
    event: CalendarEvent
    dayIndex: number
    startX: number
    startY: number
  } | null>(null)

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

  /**
   * Get minutes from Y position.
   * Uses timeAreaRef (the time gutter div) as reference - its top edge = midnight (0:00).
   * getBoundingClientRect().top already accounts for scroll, so no manual scrollTop needed.
   */
  const getMinutesFromY = useCallback((clientY: number): number => {
    const ref = timeAreaRef.current
    if (!ref) return 0
    const rect = ref.getBoundingClientRect()
    const relativeY = clientY - rect.top
    const rawMinutes = (relativeY / HOUR_HEIGHT) * 60
    return snapMinutes(Math.max(0, Math.min(rawMinutes, TOTAL_HOURS * 60 - SNAP_MINUTES)))
  }, [])

  /** Get day index from X position */
  const getDayIndexFromX = useCallback((clientX: number): number => {
    if (!gridRef.current) return 0
    const gridRect = gridRef.current.getBoundingClientRect()
    const relativeX = clientX - gridRect.left - TIME_GUTTER
    const dayWidth = (gridRect.width - TIME_GUTTER) / 7
    const idx = Math.floor(relativeX / dayWidth)
    return Math.max(0, Math.min(6, idx))
  }, [])

  // Handle drag move/resize with rAF for smooth updates
  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      // Cancel previous frame to avoid stale updates
      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      rafRef.current = requestAnimationFrame(() => {
        const minutes = getMinutesFromY(e.clientY)

        if (dragState.type === 'resize-bottom') {
          const newEnd = Math.max(dragState.currentStart + SNAP_MINUTES, minutes)
          setDragState(prev => prev ? { ...prev, currentEnd: newEnd } : null)
        } else if (dragState.type === 'resize-top') {
          const newStart = Math.min(minutes, dragState.currentEnd - SNAP_MINUTES)
          setDragState(prev => prev ? { ...prev, currentStart: Math.max(0, newStart) } : null)
        } else {
          const duration = dragState.originalEnd - dragState.originalStart
          const newStart = snapMinutes(minutes - dragState.offsetMinutes)
          const clampedStart = Math.max(0, Math.min(newStart, TOTAL_HOURS * 60 - duration))
          const newDayIndex = getDayIndexFromX(e.clientX)
          setDragState(prev => prev ? {
            ...prev,
            currentStart: clampedStart,
            currentEnd: clampedStart + duration,
            currentDayIndex: newDayIndex,
          } : null)
        }
      })
    }

    const handleMouseUp = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      if (!dragState || !onEventTimeUpdate) {
        setDragState(null)
        setIsDragActive(false)
        return
      }

      const { eventId, currentStart, currentEnd, currentDayIndex, originalStart, originalEnd, dayIndex, type } = dragState
      const startChanged = currentStart !== originalStart || (type === 'move' && currentDayIndex !== dayIndex)
      const endChanged = currentEnd !== originalEnd

      // Drop animation: brief settle effect
      setIsDropping(true)
      setTimeout(() => {
        if (startChanged || endChanged) {
          const targetDay = weekDays[type === 'move' ? currentDayIndex : dayIndex]
          const y = targetDay.getFullYear()
          const m = String(targetDay.getMonth() + 1).padStart(2, '0')
          const d = String(targetDay.getDate()).padStart(2, '0')
          const dateStr = `${y}-${m}-${d}`
          const newStartStr = `${dateStr}T${minutesToTimeStr(currentStart)}:00`
          const newEndStr = `${dateStr}T${minutesToTimeStr(currentEnd)}:00`
          onEventTimeUpdate(eventId, newStartStr, newEndStr)
        }
        setDragState(null)
        setIsDragActive(false)
        setIsDropping(false)
      }, 150)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, weekDays, getMinutesFromY, getDayIndexFromX, onEventTimeUpdate])

  /** mousedown on event: don't start drag yet, just record intent */
  const handleEventMouseDown = (
    e: React.MouseEvent,
    event: CalendarEvent,
    dayIndex: number,
    type: 'move' | 'resize-top' | 'resize-bottom'
  ) => {
    if (!onEventTimeUpdate) return
    e.preventDefault()
    e.stopPropagation()

    pendingDragRef.current = {
      type,
      event,
      dayIndex,
      startX: e.clientX,
      startY: e.clientY,
    }
  }

  /** Activate the actual drag (called once threshold is exceeded) */
  const activateDrag = useCallback((pending: NonNullable<typeof pendingDragRef.current>, clientY: number) => {
    const { type, event, dayIndex } = pending
    const start = new Date(event.start)
    const end = event.end ? new Date(event.end) : new Date(start.getTime() + 3600000)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = end.getHours() * 60 + end.getMinutes()
    const mouseMin = getMinutesFromY(clientY)

    setIsDragActive(true)
    setDragState({
      type,
      eventId: event.id,
      dayIndex,
      originalStart: startMin,
      originalEnd: endMin,
      currentStart: startMin,
      currentEnd: endMin,
      offsetMinutes: type === 'move' ? mouseMin - startMin : 0,
      currentDayIndex: dayIndex,
    })
    pendingDragRef.current = null
  }, [getMinutesFromY])

  // Pending drag listener: detect threshold or cancel on mouseup
  useEffect(() => {
    const handlePendingMove = (e: MouseEvent) => {
      const pending = pendingDragRef.current
      if (!pending) return

      const dx = e.clientX - pending.startX
      const dy = e.clientY - pending.startY
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        activateDrag(pending, e.clientY)
      }
    }

    const handlePendingUp = () => {
      pendingDragRef.current = null
    }

    document.addEventListener('mousemove', handlePendingMove)
    document.addEventListener('mouseup', handlePendingUp)
    return () => {
      document.removeEventListener('mousemove', handlePendingMove)
      document.removeEventListener('mouseup', handlePendingUp)
    }
  }, [activateDrag])

  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT
  const todayIndex = weekDays.findIndex(d => isToday(d))
  const showNowLine = todayIndex >= 0

  const getDragPreviewStyle = (event: CalendarEvent, dayIndex: number) => {
    if (!dragState || dragState.eventId !== event.id) return null
    if (dragState.type === 'move' && dragState.currentDayIndex !== dayIndex) return null
    if ((dragState.type === 'resize-top' || dragState.type === 'resize-bottom') && dragState.dayIndex !== dayIndex) return null

    const previewTop = (dragState.currentStart / 60) * HOUR_HEIGHT
    const previewHeight = Math.max(((dragState.currentEnd - dragState.currentStart) / 60) * HOUR_HEIGHT, 24)
    return { top: previewTop, height: previewHeight }
  }

  const isEventBeingDragged = (eventId: string) => isDragActive && dragState?.eventId === eventId
  const isResizing = dragState?.type === 'resize-top' || dragState?.type === 'resize-bottom'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: '600px' }}>
      {/* Navigation bar */}
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

      {/* Scroll container */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
          ref={gridRef}
          className="grid"
          style={{
            gridTemplateColumns: `${TIME_GUTTER}px repeat(7, 1fr)`,
            minHeight: TOTAL_HOURS * HOUR_HEIGHT,
            cursor: isDragActive ? (isResizing ? 'ns-resize' : 'grabbing') : undefined,
            userSelect: isDragActive ? 'none' : undefined,
          }}
        >
          {/* === STICKY DAY HEADERS === */}
          <div className="sticky top-0 z-[3] bg-white border-b border-gray-200" />
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

          {/* === TIME GRID === */}
          {/* Time gutter - also serves as Y reference for drag calculations */}
          <div ref={timeAreaRef} className="relative" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
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
                {/* Hour lines */}
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
                    onClick={() => {
                      if (!isDragActive) onCreateEvent?.(day, i + START_HOUR)
                    }}
                  />
                ))}

                {/* Drag ghost: event moved to a different day */}
                {dragState?.type === 'move' && dragState.currentDayIndex === dayIdx && dragState.dayIndex !== dayIdx && (() => {
                  const event = events.find(e => e.id === dragState.eventId)
                  if (!event) return null
                  const previewTop = (dragState.currentStart / 60) * HOUR_HEIGHT
                  const previewHeight = Math.max(((dragState.currentEnd - dragState.currentStart) / 60) * HOUR_HEIGHT, 24)
                  return (
                    <div
                      className="absolute rounded-lg z-30 overflow-hidden pointer-events-none border-2 border-dashed border-white/60"
                      style={{
                        top: previewTop,
                        height: previewHeight,
                        left: '2px',
                        right: '2px',
                        backgroundColor: getEventColor(event.colorId),
                        opacity: isDropping ? 1 : 0.75,
                        transform: isDropping ? 'scale(1)' : 'scale(1.01)',
                        transition: 'top 80ms ease-out, height 80ms ease-out, opacity 150ms ease, transform 150ms ease',
                      }}
                    >
                      <div className="px-2 py-1">
                        <span className="text-[11px] font-semibold text-white truncate">
                          {event.title || 'Sem título'}
                        </span>
                        <div className="text-[10px] text-white/80">
                          {minutesToTimeStr(dragState.currentStart)} – {minutesToTimeStr(dragState.currentEnd)}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Events */}
                {laid.map(({ event, colIndex, totalCols }) => {
                  const isDragging = isEventBeingDragged(event.id)
                  const dragPreview = getDragPreviewStyle(event, dayIdx)

                  // Event moved to different day → show faded ghost in original column
                  if (isDragging && dragState?.type === 'move' && dragState.currentDayIndex !== dayIdx) {
                    return (
                      <div
                        key={event.id}
                        className="absolute rounded-lg overflow-hidden z-10"
                        style={{
                          ...getEventStyle(event),
                          left: `calc(${(colIndex * 100) / totalCols}% + 2px)`,
                          width: `calc(${100 / totalCols}% - 4px)`,
                          backgroundColor: getEventColor(event.colorId),
                          opacity: 0.2,
                          transition: 'opacity 200ms ease',
                        }}
                      >
                        <div className="px-2 py-1 h-full">
                          <span className="text-[11px] font-semibold text-white truncate">{event.title}</span>
                        </div>
                      </div>
                    )
                  }

                  const { top, height } = dragPreview || getEventStyle(event)
                  const wPct = 100 / totalCols
                  const lPct = colIndex * wPct
                  const startTimeObj = new Date(event.start)
                  const timeStr = isDragging && dragPreview
                    ? `${minutesToTimeStr(dragState!.currentStart)} – ${minutesToTimeStr(dragState!.currentEnd)}`
                    : startTimeObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const hasMeet = !!event.meetLink
                  const isRecording = event.botStatus === 'recording'
                  const isCompleted = event.botStatus === 'completed'
                  const evalScore = event.evaluation?.overall_score

                  // Smooth transition styles based on drag phase
                  const dragTransition = isDragging
                    ? isDropping
                      ? 'top 150ms ease, height 150ms ease, transform 150ms ease, box-shadow 150ms ease'
                      : 'top 70ms ease-out, height 70ms ease-out'
                    : 'box-shadow 200ms ease, transform 200ms ease'

                  return (
                    <div
                      key={event.id}
                      className={`absolute rounded-lg overflow-hidden ${
                        isDragging
                          ? 'z-30 ring-2 ring-white/40'
                          : 'z-10 cursor-pointer hover:shadow-lg hover:brightness-105'
                      }`}
                      style={{
                        top, height,
                        left: `calc(${lPct}% + 2px)`,
                        width: `calc(${wPct}% - 4px)`,
                        backgroundColor: getEventColor(event.colorId),
                        opacity: isDragging ? (isDropping ? 1 : 0.92) : 1,
                        transform: isDragging
                          ? isDropping ? 'scale(1)' : 'scale(1.03)'
                          : undefined,
                        boxShadow: isDragging
                          ? isDropping
                            ? '0 4px 12px rgba(0,0,0,0.15)'
                            : '0 12px 28px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.15)'
                          : undefined,
                        transition: dragTransition,
                      }}
                      onClick={(e) => {
                        if (isDragActive) return
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        onEventClick?.(event, { top: rect.top, left: rect.left, width: rect.width, height: rect.height })
                      }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return
                        const target = e.target as HTMLElement
                        if (target.dataset.resizeHandle) return
                        if (onEventTimeUpdate) {
                          handleEventMouseDown(e, event, dayIdx, 'move')
                        }
                      }}
                    >
                      {isRecording && (
                        <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      )}

                      {/* Resize handle at TOP */}
                      {onEventTimeUpdate && !isDragging && (
                        <div
                          data-resize-handle="true"
                          className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize group z-[2]"
                          onMouseDown={(e) => handleEventMouseDown(e, event, dayIdx, 'resize-top')}
                        >
                          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-white/0 rounded-full group-hover:bg-white/60 transition-all duration-150" />
                        </div>
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
                        {height > 55 && event.attendees && event.attendees.length > 0 && !isDragging && (
                          <span className="text-[10px] text-white/70 truncate mt-0.5">
                            {event.attendees.length} participante{event.attendees.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {isCompleted && evalScore != null && !isDragging && (
                          <div className="mt-auto">
                            <span className="text-[10px] bg-white/30 text-white px-1 rounded font-medium">
                              {(evalScore / 10).toFixed(1)}/10
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Resize handle at BOTTOM */}
                      {onEventTimeUpdate && !isDragging && (
                        <div
                          data-resize-handle="true"
                          className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize group z-[2]"
                          onMouseDown={(e) => handleEventMouseDown(e, event, dayIdx, 'resize-bottom')}
                        >
                          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-[3px] bg-white/30 rounded-full group-hover:bg-white/60 transition-all duration-150" />
                        </div>
                      )}
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
