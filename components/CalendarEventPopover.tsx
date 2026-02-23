'use client'

import { useRef, useEffect, useState } from 'react'
import {
  X,
  Clock,
  Link2,
  Users,
  Video,
  RefreshCw,
  ChevronRight,
  Trash2,
  Loader2,
  Plus,
  UserPlus,
  Pencil,
} from 'lucide-react'
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

interface CalendarEventPopoverProps {
  event: CalendarEvent
  anchorRect: { top: number; left: number; width: number; height: number } | null
  onClose: () => void
  onToggleBot?: (scheduledBotId: string, enabled: boolean) => void
  onViewEvaluation?: (event: CalendarEvent) => void
  onResetStatus?: (scheduledBotId: string) => void
  onDeleteEvent?: (eventId: string) => Promise<void>
  onAddAttendees?: (eventId: string, emails: string[]) => Promise<Array<{ email: string; displayName?: string; responseStatus?: string }> | null>
  onEditEvent?: (event: CalendarEvent) => void
  togglingEventId: string | null
}

const RSVP_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  accepted: { label: 'Confirmado', color: 'text-green-600', icon: '✓' },
  declined: { label: 'Recusado', color: 'text-red-500', icon: '✕' },
  tentative: { label: 'Talvez', color: 'text-amber-500', icon: '?' },
  needsAction: { label: 'Pendente', color: 'text-gray-400', icon: '–' },
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; dot?: string }> = {
  pending: { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Aguardando' },
  scheduled: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Bot agendado', dot: 'bg-blue-500' },
  joining: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Entrando...', dot: 'bg-amber-500' },
  recording: { color: 'text-red-600', bg: 'bg-red-50', label: 'Gravando', dot: 'bg-red-500' },
  completed: { color: 'text-green-600', bg: 'bg-green-50', label: 'Avaliado', dot: 'bg-green-500' },
  skipped: { color: 'text-gray-400', bg: 'bg-gray-50', label: 'Desabilitado' },
  error: { color: 'text-red-600', bg: 'bg-red-50', label: 'Erro', dot: 'bg-red-500' },
}

export default function CalendarEventPopover({
  event,
  anchorRect,
  onClose,
  onToggleBot,
  onViewEvaluation,
  onResetStatus,
  onDeleteEvent,
  onAddAttendees,
  onEditEvent,
  togglingEventId,
}: CalendarEventPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showAddAttendee, setShowAddAttendee] = useState(false)
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('')
  const [addingAttendee, setAddingAttendee] = useState(false)
  const [localAttendees, setLocalAttendees] = useState(event.attendees || [])
  const attendeeInputRef = useRef<HTMLInputElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const startDate = new Date(event.start)
  const endDate = event.end ? new Date(event.end) : null
  const startTime = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const endTime = endDate?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = startDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const hasMeet = !!event.meetLink
  const isToggling = togglingEventId === event.scheduledBotId
  const botEnabled = event.botEnabled ?? false
  const botStatus = event.botStatus || 'pending'
  const status = STATUS_CONFIG[botStatus] || STATUS_CONFIG.pending
  const evalScore = event.evaluation?.overall_score
  const isPast = startDate < new Date()

  // Position the popover near the event
  const getPopoverStyle = (): React.CSSProperties => {
    if (!anchorRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const popoverWidth = 340
    const popoverHeight = 400
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const margin = 8

    // Try to position to the right of the event
    let left = anchorRect.left + anchorRect.width + margin
    let top = anchorRect.top

    // If overflows right, position to the left
    if (left + popoverWidth > viewportWidth - margin) {
      left = anchorRect.left - popoverWidth - margin
    }

    // If overflows left too, center horizontally
    if (left < margin) {
      left = Math.max(margin, (viewportWidth - popoverWidth) / 2)
    }

    // If overflows bottom, shift up
    if (top + popoverHeight > viewportHeight - margin) {
      top = viewportHeight - popoverHeight - margin
    }

    // If overflows top, shift down
    if (top < margin) {
      top = margin
    }

    return { top, left, position: 'fixed' as const }
  }

  const attendees = localAttendees
  const acceptedCount = attendees.filter(a => a.responseStatus === 'accepted').length
  const declinedCount = attendees.filter(a => a.responseStatus === 'declined').length
  const pendingCount = attendees.filter(a => !a.responseStatus || a.responseStatus === 'needsAction').length

  const handleAddAttendee = async () => {
    const email = newAttendeeEmail.trim().toLowerCase()
    if (!email || !onAddAttendees) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    if (attendees.some(a => a.email.toLowerCase() === email)) {
      setNewAttendeeEmail('')
      return
    }

    setAddingAttendee(true)
    try {
      const updated = await onAddAttendees(event.id, [email])
      if (updated) {
        setLocalAttendees(updated)
        setNewAttendeeEmail('')
        setShowAddAttendee(false)
      }
    } finally {
      setAddingAttendee(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[50] bg-black/10" />

      {/* Popover */}
      <div
        ref={popoverRef}
        className="z-[51] bg-white rounded-xl shadow-2xl border border-gray-200 w-[340px] max-h-[85vh] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        style={getPopoverStyle()}
      >
        {/* Header with colored bar */}
        <div className="px-4 py-3 flex items-start justify-between" style={{ backgroundColor: getEventColor(event.colorId) }}>
          <div className="flex-1 min-w-0 mr-2">
            <h3 className="text-white font-semibold text-sm leading-tight truncate">
              {event.title || 'Sem título'}
            </h3>
            <p className="text-white/80 text-xs mt-0.5 capitalize">{dateStr}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            {onEditEvent && (
              <button
                onClick={() => onEditEvent(event)}
                className="text-white/70 hover:text-white transition-colors p-0.5"
                title="Editar evento"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-3 overflow-y-auto max-h-[calc(85vh-52px)]">
          {/* Time */}
          <div className="flex items-center gap-2.5 text-sm text-gray-700">
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span>
              {startTime}
              {endTime && ` – ${endTime}`}
            </span>
          </div>

          {/* Meet Link */}
          {hasMeet && (
            <div className="flex items-center gap-2.5 text-sm">
              <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a
                href={event.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate text-xs"
              >
                {event.meetLink}
              </a>
            </div>
          )}

          {/* Attendees */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 text-sm text-gray-700">
              <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="font-medium">
                {attendees.length > 0
                  ? `${attendees.length} participante${attendees.length > 1 ? 's' : ''}`
                  : 'Sem participantes'
                }
              </span>
              {(acceptedCount > 0 || declinedCount > 0) && (
                <span className="text-xs text-gray-400">
                  ({acceptedCount} confirmado{acceptedCount !== 1 ? 's' : ''}
                  {declinedCount > 0 && `, ${declinedCount} recusado${declinedCount !== 1 ? 's' : ''}`}
                  {pendingCount > 0 && `, ${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}`})
                </span>
              )}
              {onAddAttendees && (
                <button
                  onClick={() => {
                    setShowAddAttendee(!showAddAttendee)
                    setTimeout(() => attendeeInputRef.current?.focus(), 100)
                  }}
                  className="ml-auto text-blue-500 hover:text-blue-600 transition-colors"
                  title="Adicionar convidado"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {attendees.length > 0 && (
              <div className="ml-6.5 space-y-1 pl-[26px]">
                {attendees.map((attendee, i) => {
                  const rsvp = RSVP_CONFIG[attendee.responseStatus || 'needsAction'] || RSVP_CONFIG.needsAction
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`${rsvp.color} flex-shrink-0 w-3 text-center font-medium`}>{rsvp.icon}</span>
                      <span className="text-gray-700 truncate">
                        {attendee.displayName || attendee.email}
                      </span>
                      {attendee.displayName && (
                        <span className="text-gray-400 truncate hidden sm:inline">
                          {attendee.email}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {/* Add attendee inline input */}
            {showAddAttendee && onAddAttendees && (
              <div className="pl-[26px] flex items-center gap-1.5 mt-1">
                <input
                  ref={attendeeInputRef}
                  type="email"
                  value={newAttendeeEmail}
                  onChange={e => setNewAttendeeEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddAttendee() }}
                  placeholder="email@exemplo.com"
                  disabled={addingAttendee}
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                />
                <button
                  onClick={handleAddAttendee}
                  disabled={addingAttendee || !newAttendeeEmail.trim()}
                  className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {addingAttendee ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          {hasMeet && event.scheduledBotId && (
            <div className="border-t border-gray-100 pt-3">
              {/* Bot Status + Toggle (hide toggle for past events) */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bot de Análise</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${status.bg} ${status.color}`}>
                    {status.dot && (
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1 ${botStatus === 'recording' ? 'animate-pulse' : ''}`} />
                    )}
                    {status.label}
                  </span>
                </div>

              </div>

              {/* Evaluation score */}
              {botStatus === 'completed' && evalScore != null && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Nota da avaliação</span>
                  <span className={`text-sm font-bold ${
                    evalScore >= 70 ? 'text-green-600' :
                    evalScore >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {(evalScore / 10).toFixed(1)}/10
                  </span>
                </div>
              )}

              {/* View evaluation button */}
              {botStatus === 'completed' && event.evaluationId && onViewEvaluation && (
                <button
                  onClick={() => onViewEvaluation(event)}
                  className="w-full text-xs text-green-600 hover:text-green-700 font-medium flex items-center justify-center gap-1.5 mt-2 py-2 hover:bg-green-50 rounded-lg transition-colors border border-green-200"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Ver avaliação no histórico
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}

              {/* Reset status */}
              {botStatus === 'error' && event.scheduledBotId && onResetStatus && (
                <button
                  onClick={() => onResetStatus(event.scheduledBotId!)}
                  className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 mt-1 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Resetar status
                </button>
              )}
            </div>
          )}

          {/* No Meet link message */}
          {!hasMeet && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 italic">Este evento não tem link do Google Meet</p>
            </div>
          )}

          {/* Delete event */}
          {onDeleteEvent && (
            <div className="border-t border-gray-100 pt-3">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-xs text-red-500 hover:text-red-600 font-medium flex items-center justify-center gap-1 py-1.5 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Apagar evento
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-600 text-center font-medium">Tem certeza? O evento será removido do Google Calendar.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="flex-1 text-xs text-gray-600 hover:bg-gray-100 py-1.5 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        setDeleting(true)
                        try {
                          await onDeleteEvent(event.id)
                        } finally {
                          setDeleting(false)
                        }
                      }}
                      disabled={deleting}
                      className="flex-1 text-xs text-white bg-red-500 hover:bg-red-600 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
