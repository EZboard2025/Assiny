'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap, ChevronDown, ChevronUp, MessageSquare, Clock, Send, AlertTriangle, CheckCircle, Bot, X, Radio } from 'lucide-react'

interface AutopilotEvent {
  id: string
  type: 'message_detected' | 'debounce_started' | 'debounce_reset' | 'debounce_fired' |
        'complement_detected' | 'processing' | 'waiting_delay' | 'response_sent' |
        'response_skipped' | 'flagged_human' | 'objective_reached'
  contactPhone: string
  contactName: string | null
  detail: string
  timestamp: number
  userId: string
}

const EVENT_CONFIG: Record<string, { icon: typeof Zap; color: string; bg: string; label: string }> = {
  message_detected: { icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Msg detectada' },
  debounce_started: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Timer iniciado' },
  debounce_reset: { icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Timer resetado' },
  debounce_fired: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Timer disparou' },
  complement_detected: { icon: Bot, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Complemento' },
  processing: { icon: Bot, color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Processando IA' },
  waiting_delay: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'Aguardando delay' },
  response_sent: { icon: Send, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Enviado' },
  response_skipped: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Pulado' },
  flagged_human: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Humano' },
  objective_reached: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Objetivo!' },
}

function formatPhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 11) {
    return `(${digits.slice(-11, -9)}) ${digits.slice(-9, -4)}-${digits.slice(-4)}`
  }
  return digits.slice(-9)
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5) return 'agora'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

export default function AutopilotActivityIndicator({ authToken }: { authToken: string | null }) {
  const [events, setEvents] = useState<AutopilotEvent[]>([])
  const [expanded, setExpanded] = useState(true)
  const [visible, setVisible] = useState(true)
  const lastTimestamp = useRef(0)
  const [newEventFlash, setNewEventFlash] = useState(false)

  const fetchEvents = useCallback(async () => {
    if (!authToken) return
    try {
      const res = await fetch(`/api/autopilot/events?since=${lastTimestamp.current}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.events && data.events.length > 0) {
        setEvents(prev => {
          const merged = [...prev, ...data.events]
          // Keep last 30 events
          return merged.slice(-30)
        })
        lastTimestamp.current = data.events[data.events.length - 1].timestamp
        // Flash animation
        setNewEventFlash(true)
        setTimeout(() => setNewEventFlash(false), 600)
      }
    } catch {
      // Silent fail
    }
  }, [authToken])

  useEffect(() => {
    if (!authToken) return
    fetchEvents()
    const interval = setInterval(fetchEvents, 3000)
    return () => clearInterval(interval)
  }, [authToken, fetchEvents])

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 left-4 z-[55] w-10 h-10 rounded-full bg-[#202c33] border border-[#2a3942] flex items-center justify-center hover:bg-[#2a3942] transition-all shadow-lg"
        title="Mostrar atividade do Autopilot"
      >
        <Radio className={`w-4 h-4 ${events.length > 0 ? 'text-green-400' : 'text-[#8696a0]'}`} />
        {events.length > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </button>
    )
  }

  const recentEvents = events.slice(-20).reverse()
  const hasActivity = events.some(e => Date.now() - e.timestamp < 120000) // activity in last 2min

  return (
    <div
      className={`fixed bottom-4 left-4 z-[55] transition-all duration-300 ${
        expanded ? 'w-[340px]' : 'w-[220px]'
      }`}
    >
      <div className={`bg-[#111b21] border rounded-xl shadow-2xl overflow-hidden transition-all ${
        newEventFlash ? 'border-green-500/60' : 'border-[#2a3942]'
      }`}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#202c33] transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <Radio className={`w-4 h-4 ${hasActivity ? 'text-green-400' : 'text-[#8696a0]'}`} />
              {hasActivity && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className="text-[11px] font-medium text-[#e9edef] tracking-wide uppercase">
              Autopilot Activity
            </span>
            {!expanded && events.length > 0 && (
              <span className="text-[10px] text-[#8696a0]">
                ({events.length})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setVisible(false) }}
              className="p-0.5 hover:bg-[#2a3942] rounded text-[#8696a0] hover:text-[#e9edef]"
            >
              <X className="w-3 h-3" />
            </button>
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-[#8696a0]" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-[#8696a0]" />
            )}
          </div>
        </div>

        {/* Events list */}
        {expanded && (
          <div className="max-h-[280px] overflow-y-auto border-t border-[#2a3942]">
            {recentEvents.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <Radio className="w-5 h-5 text-[#3b4a54] mx-auto mb-1.5" />
                <p className="text-[11px] text-[#8696a0]">Nenhuma atividade detectada</p>
                <p className="text-[10px] text-[#3b4a54] mt-0.5">Eventos aparecem quando o autopilot processa mensagens</p>
              </div>
            ) : (
              recentEvents.map((event, idx) => {
                const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.message_detected
                const Icon = config.icon
                const isNew = Date.now() - event.timestamp < 5000

                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-2 px-3 py-2 border-b border-[#2a3942]/50 transition-all ${
                      isNew ? 'bg-[#202c33] animate-fade-in' : ''
                    } ${idx === 0 ? '' : 'opacity-90'}`}
                  >
                    <div className={`mt-0.5 p-1 rounded ${config.bg} flex-shrink-0`}>
                      <Icon className={`w-3 h-3 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-medium ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-[9px] text-[#3b4a54]">
                          {timeAgo(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8696a0] leading-tight mt-0.5">
                        {event.contactName || formatPhone(event.contactPhone)}
                      </p>
                      <p className="text-[10px] text-[#aebac1] leading-tight break-words">
                        {event.detail}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
