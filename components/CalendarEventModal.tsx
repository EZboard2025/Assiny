'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Calendar,
  Clock,
  Users,
  Video,
  Loader2,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FreeBusySlot {
  start: string
  end: string
}

interface FreeBusyResult {
  email: string
  busy: FreeBusySlot[]
}

interface EditEventData {
  id: string
  title: string
  start: string
  end: string | null
  meetLink?: string
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>
  description?: string | null
}

interface CalendarEventModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateEventData) => Promise<void>
  prefillDate?: Date
  prefillHour?: number
  editEvent?: EditEventData | null
}

export interface CreateEventData {
  eventId?: string
  title: string
  startDateTime: string
  endDateTime: string
  description: string
  attendees: string[]
  addMeetLink: boolean
}

export default function CalendarEventModal({
  isOpen,
  onClose,
  onSubmit,
  prefillDate,
  prefillHour,
  editEvent,
}: CalendarEventModalProps) {
  const isEditMode = !!editEvent
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [newAttendee, setNewAttendee] = useState('')
  const [addMeetLink, setAddMeetLink] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [freeBusy, setFreeBusy] = useState<FreeBusyResult[]>([])
  const [freeBusyLoading, setFreeBusyLoading] = useState(false)
  const freeBusyTimerRef = useRef<NodeJS.Timeout | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // Prefill date/time from clicked calendar cell OR from editEvent
  useEffect(() => {
    if (isOpen) {
      setError('')

      if (editEvent) {
        // Edit mode: prefill from existing event
        setTitle(editEvent.title || '')
        setDescription(editEvent.description || '')
        setAttendees((editEvent.attendees || []).map(a => a.email))
        setAddMeetLink(!!editEvent.meetLink)

        const startD = new Date(editEvent.start)
        const y = startD.getFullYear()
        const m = String(startD.getMonth() + 1).padStart(2, '0')
        const d = String(startD.getDate()).padStart(2, '0')
        setDate(`${y}-${m}-${d}`)
        setStartTime(`${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`)

        if (editEvent.end) {
          const endD = new Date(editEvent.end)
          setEndTime(`${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`)
        } else {
          const endH = Math.min(startD.getHours() + 1, 23)
          setEndTime(`${String(endH).padStart(2, '0')}:00`)
        }
      } else {
        // Create mode: prefill from clicked cell or defaults
        if (prefillDate) {
          const y = prefillDate.getFullYear()
          const m = String(prefillDate.getMonth() + 1).padStart(2, '0')
          const d = String(prefillDate.getDate()).padStart(2, '0')
          setDate(`${y}-${m}-${d}`)
        } else {
          const now = new Date()
          const y = now.getFullYear()
          const m = String(now.getMonth() + 1).padStart(2, '0')
          const d = String(now.getDate()).padStart(2, '0')
          setDate(`${y}-${m}-${d}`)
        }

        if (prefillHour !== undefined) {
          setStartTime(`${String(prefillHour).padStart(2, '0')}:00`)
          const endH = Math.min(prefillHour + 1, 23)
          setEndTime(`${String(endH).padStart(2, '0')}:00`)
        } else {
          const now = new Date()
          const h = now.getHours()
          setStartTime(`${String(h).padStart(2, '0')}:00`)
          setEndTime(`${String(Math.min(h + 1, 23)).padStart(2, '0')}:00`)
        }
      }

      setTimeout(() => titleRef.current?.focus(), 100)
    }
  }, [isOpen, prefillDate, prefillHour, editEvent])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTitle('')
      setDescription('')
      setAttendees([])
      setNewAttendee('')
      setAddMeetLink(true)
      setSubmitting(false)
      setError('')
      setFreeBusy([])
      setFreeBusyLoading(false)
      if (freeBusyTimerRef.current) clearTimeout(freeBusyTimerRef.current)
    }
  }, [isOpen])

  // Check free/busy when attendees or date changes
  const checkFreeBusy = useCallback(async (emails: string[], selectedDate: string) => {
    if (!emails.length || !selectedDate) {
      setFreeBusy([])
      return
    }
    setFreeBusyLoading(true)
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (!authSession?.access_token) return

      const dayStart = `${selectedDate}T00:00:00`
      const dayEnd = `${selectedDate}T23:59:59`

      const res = await fetch('/api/calendar/freebusy', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ timeMin: dayStart, timeMax: dayEnd, emails }),
      })

      if (res.ok) {
        const data = await res.json()
        setFreeBusy(data.results || [])
      }
    } catch (e) {
      console.error('FreeBusy check failed:', e)
    } finally {
      setFreeBusyLoading(false)
    }
  }, [])

  // Debounced FreeBusy check when attendees or date changes
  useEffect(() => {
    if (freeBusyTimerRef.current) clearTimeout(freeBusyTimerRef.current)
    if (attendees.length > 0 && date) {
      freeBusyTimerRef.current = setTimeout(() => {
        checkFreeBusy(attendees, date)
      }, 500)
    } else {
      setFreeBusy([])
    }
    return () => { if (freeBusyTimerRef.current) clearTimeout(freeBusyTimerRef.current) }
  }, [attendees, date, checkFreeBusy])

  const addAttendee = () => {
    const email = newAttendee.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email inválido')
      return
    }
    if (attendees.includes(email)) {
      setError('Email já adicionado')
      return
    }
    setAttendees(prev => [...prev, email])
    setNewAttendee('')
    setError('')
  }

  const removeAttendee = (email: string) => {
    setAttendees(prev => prev.filter(a => a !== email))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addAttendee()
    }
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Título é obrigatório')
      return
    }
    if (!date || !startTime || !endTime) {
      setError('Data e horário são obrigatórios')
      return
    }

    const startDateTime = `${date}T${startTime}:00`
    const endDateTime = `${date}T${endTime}:00`

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      setError('Horário de término deve ser após o início')
      return
    }

    // Auto-add pending attendee from input field (user may not have pressed Enter)
    const finalAttendees = [...attendees]
    if (newAttendee.trim()) {
      const pendingEmail = newAttendee.trim().toLowerCase()
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pendingEmail) && !finalAttendees.includes(pendingEmail)) {
        finalAttendees.push(pendingEmail)
      }
    }

    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        ...(editEvent ? { eventId: editEvent.id } : {}),
        title: title.trim(),
        startDateTime,
        endDateTime,
        description: description.trim(),
        attendees: finalAttendees,
        addMeetLink,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || (isEditMode ? 'Erro ao editar evento' : 'Erro ao criar evento'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{isEditMode ? 'Editar Evento' : 'Novo Evento'}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]">
            {/* Title */}
            <div>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Adicionar título"
                className="w-full text-xl font-medium text-gray-900 placeholder-gray-300 border-0 border-b-2 border-gray-200 focus:border-blue-500 focus:ring-0 pb-2 outline-none transition-colors"
              />
            </div>

            {/* Date & Time */}
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                  <span className="text-gray-400 text-sm">até</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Attendees */}
            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={newAttendee}
                    onChange={e => { setNewAttendee(e.target.value); setError('') }}
                    onKeyDown={handleKeyDown}
                    placeholder="Adicionar participante (email)"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                  <button
                    onClick={addAttendee}
                    disabled={!newAttendee.trim()}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {attendees.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attendees.map(email => {
                      const fb = freeBusy.find(f => f.email === email)
                      const busyCount = fb?.busy?.length || 0
                      return (
                        <div key={email} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg group">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-gray-700 truncate">{email}</span>
                            {freeBusyLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin text-gray-300 flex-shrink-0" />
                            ) : fb ? (
                              <span className={`text-[10px] font-medium flex-shrink-0 ${busyCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                {busyCount > 0 ? `${busyCount} compromisso${busyCount > 1 ? 's' : ''}` : 'Livre'}
                              </span>
                            ) : null}
                          </div>
                          <button
                            onClick={() => removeAttendee(email)}
                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* FreeBusy mini-timeline */}
                {freeBusy.length > 0 && freeBusy.some(f => f.busy?.length > 0) && (
                  <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Disponibilidade ({new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })})</p>
                    {freeBusy.filter(f => f.busy?.length > 0).map(fb => (
                      <div key={fb.email} className="mb-1.5 last:mb-0">
                        <p className="text-[10px] text-gray-600 mb-0.5 truncate">{fb.email}</p>
                        <div className="relative h-3 bg-green-100 rounded-full overflow-hidden">
                          {fb.busy.map((slot, i) => {
                            const slotStart = new Date(slot.start)
                            const slotEnd = new Date(slot.end)
                            const dayStartMinutes = 8 * 60 // 8 AM
                            const dayEndMinutes = 20 * 60 // 8 PM
                            const totalMinutes = dayEndMinutes - dayStartMinutes
                            const startMin = Math.max(slotStart.getHours() * 60 + slotStart.getMinutes() - dayStartMinutes, 0)
                            const endMin = Math.min(slotEnd.getHours() * 60 + slotEnd.getMinutes() - dayStartMinutes, totalMinutes)
                            const leftPct = (startMin / totalMinutes) * 100
                            const widthPct = Math.max(((endMin - startMin) / totalMinutes) * 100, 1)
                            return (
                              <div
                                key={i}
                                className="absolute top-0 bottom-0 bg-red-400 rounded-full"
                                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                title={`${slotStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} – ${slotEnd.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                              />
                            )
                          })}
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                          <span>8h</span>
                          <span>14h</span>
                          <span>20h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Adicionar descrição (opcional)"
                rows={2}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
              />
            </div>

            {/* Google Meet toggle */}
            <div className="flex items-center gap-3 bg-blue-50 px-4 py-3 rounded-xl">
              <Video className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-800">
                  {isEditMode && editEvent?.meetLink ? 'Google Meet' : 'Adicionar Google Meet'}
                </span>
                <p className="text-[11px] text-gray-500">
                  {isEditMode && editEvent?.meetLink ? 'Link de videoconferência ativo' : 'Cria link de videoconferência + bot automático'}
                </p>
              </div>
              <button
                onClick={() => setAddMeetLink(!addMeetLink)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  addMeetLink ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                  addMeetLink ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`} />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEditMode ? 'Salvando...' : 'Criando...'}
                </>
              ) : (
                isEditMode ? 'Salvar alterações' : 'Criar evento'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
