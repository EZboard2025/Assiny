'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar, ExternalLink, Link2Off } from 'lucide-react'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  meetLink?: string | null
}

function formatEventDate(dateStr: string) {
  const date = new Date(dateStr)
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  const day = date.getDate()
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${weekday}, ${day} ${month} · ${time}`
}

export default function MeetingsCard() {
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    loadCalendarData()
  }, [])

  const loadCalendarData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setLoading(false)
        return
      }

      const headers = { Authorization: `Bearer ${session.access_token}` }

      // Check connection status
      const statusRes = await fetch('/api/calendar/status', { headers })
      const statusData = await statusRes.json()

      if (!statusData.connected) {
        setConnected(false)
        setLoading(false)
        return
      }

      setConnected(true)

      // Fetch events
      const eventsRes = await fetch('/api/calendar/events?view=all', { headers })
      const eventsData = await eventsRes.json()

      if (eventsData.events && Array.isArray(eventsData.events)) {
        // Sort by start date and take first 5
        const sorted = eventsData.events
          .sort((a: CalendarEvent, b: CalendarEvent) => new Date(a.start).getTime() - new Date(b.start).getTime())
          .slice(0, 5)
        setEvents(sorted)
      }
    } catch (error) {
      console.error('Erro ao carregar calendario:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch('/api/calendar/connect', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()

      if (data.authUrl) {
        window.open(data.authUrl, '_blank')
      }
    } catch (error) {
      console.error('Erro ao conectar calendario:', error)
    } finally {
      setConnecting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-pulse">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-gray-100 rounded-xl" />
          <div className="h-5 bg-gray-200 rounded w-40" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="h-4 bg-gray-100 rounded w-36" />
              <div className="h-4 bg-gray-100 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Not connected state
  if (!connected) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Minhas Reunioes</h3>
        </div>
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Link2Off className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm mb-4">Conecte seu Google Calendar para ver suas reunioes aqui</p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
          >
            {connecting ? 'Conectando...' : 'Conectar Google Calendar'}
          </button>
        </div>
      </div>
    )
  }

  // Connected, no events
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Minhas Reunioes</h3>
        </div>
        <p className="text-gray-500 text-sm text-center py-6">
          Nenhuma reuniao nos proximos 7 dias
        </p>
      </div>
    )
  }

  // Connected with events
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Minhas Reunioes</h3>
      </div>

      <div className="divide-y divide-gray-100">
        {events.map((event) => (
          <div key={event.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <span className="text-sm text-gray-500 flex-shrink-0">
              {formatEventDate(event.start)}
            </span>
            <div className="flex items-center gap-2 ml-4 min-w-0">
              <span className="text-sm font-medium text-gray-900 truncate">
                {event.title}
              </span>
              {event.meetLink && (
                <a
                  href={event.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                  title="Abrir reuniao"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
