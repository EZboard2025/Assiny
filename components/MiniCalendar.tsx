'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MiniCalendarProps {
  /** The currently viewed week's Sunday */
  currentWeekStart: Date
  /** Navigate to a specific date's week */
  onDateClick: (date: Date) => void
}

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date())
}

/** Check if a date falls within the currently viewed week (Sun–Sat) */
function isInCurrentWeek(date: Date, weekStart: Date): boolean {
  const start = new Date(weekStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d >= start && d < end
}

export default function MiniCalendar({ currentWeekStart, onDateClick }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(() => new Date(currentWeekStart))
  const prevWeekStartRef = useRef(currentWeekStart)

  // Sync viewDate month only when currentWeekStart actually changes
  // (e.g. user navigates weeks past the current viewDate month)
  useEffect(() => {
    if (prevWeekStartRef.current === currentWeekStart) return
    prevWeekStartRef.current = currentWeekStart

    const weekMid = new Date(currentWeekStart)
    weekMid.setDate(weekMid.getDate() + 3)

    setViewDate(prev => {
      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const viewMonth = prev.getMonth()
      const viewYear = prev.getFullYear()
      const weekStartInView = currentWeekStart.getMonth() === viewMonth && currentWeekStart.getFullYear() === viewYear
      const weekEndInView = weekEnd.getMonth() === viewMonth && weekEnd.getFullYear() === viewYear
      if (!weekStartInView && !weekEndInView) {
        return new Date(weekMid.getFullYear(), weekMid.getMonth(), 1)
      }
      return prev
    })
  }, [currentWeekStart])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startOffset = firstDay.getDay() // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days: Array<{ date: Date; currentMonth: boolean }> = []

    // Previous month fill
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        currentMonth: false,
      })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: new Date(year, month, d),
        currentMonth: true,
      })
    }

    // Next month fill (complete to 6 rows = 42 cells, or fewer if fits in 5)
    const totalCells = days.length <= 35 ? 35 : 42
    const remaining = totalCells - days.length
    for (let d = 1; d <= remaining; d++) {
      days.push({
        date: new Date(year, month + 1, d),
        currentMonth: false,
      })
    }

    return days
  }, [year, month])

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 w-[220px] flex-shrink-0 select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-sm font-medium text-gray-800">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
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
          const today = isToday(date)
          const inWeek = isInCurrentWeek(date, currentWeekStart)
          const isSun = date.getDay() === 0
          const isSat = date.getDay() === 6

          return (
            <button
              key={i}
              onClick={() => onDateClick(date)}
              className={`
                relative text-[12px] h-[26px] w-full flex items-center justify-center
                transition-colors duration-100
                ${!currentMonth ? 'text-gray-300' : today ? 'text-white font-semibold' : inWeek ? 'text-blue-700 font-medium' : 'text-gray-700'}
                ${inWeek && !today ? `bg-blue-50 ${isSun ? 'rounded-l-full' : ''} ${isSat ? 'rounded-r-full' : ''}` : ''}
                ${!inWeek && !today ? 'hover:bg-gray-100 rounded-full' : ''}
              `}
            >
              {today && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-[24px] h-[24px] bg-blue-600 rounded-full" />
                </span>
              )}
              <span className="relative z-[1]">{date.getDate()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
