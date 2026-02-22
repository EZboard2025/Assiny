'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, X, Send, Loader2, TrendingUp, Target, Video, Dumbbell, CalendarDays, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SellerAgentChatProps {
  userName?: string
}

const QUICK_SUGGESTIONS = [
  { text: 'Como está minha performance?', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
  { text: 'Qual meu ponto mais fraco?', icon: Target, color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { text: 'Analise minha última reunião', icon: Video, color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { text: 'O que devo treinar hoje?', icon: Dumbbell, color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { text: 'Quais reuniões tenho essa semana?', icon: CalendarDays, color: 'text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100' },
  { text: 'Quando estou livre amanhã?', icon: Clock, color: 'text-teal-600 bg-teal-50 border-teal-200 hover:bg-teal-100' },
]

const MIN_W = 340
const MIN_H = 380
const DEFAULT_W = 400
const DEFAULT_H = 600

export default function SellerAgentChat({ userName }: SellerAgentChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Position & size (top-left corner based)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; dir: string } | null>(null)

  // Load auth token on mount using singleton supabase client (same as FollowUpView)
  useEffect(() => {
    const loadAuth = async () => {
      try {
        // Strategy 1: getSession
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) { setAuthToken(session.access_token); return }

        // Strategy 2: refreshSession
        const { data: { session: refreshed } } = await supabase.auth.refreshSession()
        if (refreshed?.access_token) { setAuthToken(refreshed.access_token); return }

        // Strategy 3: getUser + retry getSession
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: { session: retried } } = await supabase.auth.getSession()
          if (retried?.access_token) { setAuthToken(retried.access_token); return }
        }

        console.warn('[SellerAgent] No auth token found after all strategies')
      } catch (e) {
        console.error('[SellerAgent] Auth error:', e)
      }
    }
    loadAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) setAuthToken(session.access_token)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Set initial position when opening
  useEffect(() => {
    if (isOpen) {
      setPos({
        x: window.innerWidth - DEFAULT_W - 24,
        y: window.innerHeight - DEFAULT_H - 24,
      })
      setSize({ w: DEFAULT_W, h: DEFAULT_H })
    }
  }, [isOpen])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // --- Drag (move) ---
  const onDragStart = useCallback((e: React.MouseEvent) => {
    // Only drag from header area
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    setIsDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      const newX = Math.max(0, Math.min(window.innerWidth - size.w, dragRef.current.origX + dx))
      const newY = Math.max(0, Math.min(window.innerHeight - size.h, dragRef.current.origY + dy))
      setPos({ x: newX, y: newY })
    }

    const onUp = () => {
      setIsDragging(false)
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [pos, size])

  // --- Resize ---
  const onResizeStart = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: pos.x, origY: pos.y,
      origW: size.w, origH: size.h,
      dir,
    }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const r = resizeRef.current
      const dx = ev.clientX - r.startX
      const dy = ev.clientY - r.startY

      let newX = r.origX, newY = r.origY, newW = r.origW, newH = r.origH

      if (r.dir.includes('right')) {
        newW = Math.max(MIN_W, r.origW + dx)
      }
      if (r.dir.includes('left')) {
        const w = Math.max(MIN_W, r.origW - dx)
        newX = r.origX + (r.origW - w)
        newW = w
      }
      if (r.dir.includes('bottom')) {
        newH = Math.max(MIN_H, r.origH + dy)
      }
      if (r.dir.includes('top')) {
        const h = Math.max(MIN_H, r.origH - dy)
        newY = r.origY + (r.origH - h)
        newH = h
      }

      // Clamp to viewport
      newX = Math.max(0, newX)
      newY = Math.max(0, newY)
      if (newX + newW > window.innerWidth) newW = window.innerWidth - newX
      if (newY + newH > window.innerHeight) newH = window.innerHeight - newY

      setPos({ x: newX, y: newY })
      setSize({ w: newW, h: newH })
    }

    const onUp = () => {
      setIsResizing(false)
      resizeRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [pos, size])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      if (!authToken) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sessão expirada. Por favor, recarregue a página.' }])
        return
      }

      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory: messages,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro na resposta do servidor')
      }

      const data = await response.json()
      if (data._debug) console.log('[SellerAgent] DEBUG:', JSON.stringify(data._debug, null, 2))
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch (error) {
      console.error('[SellerAgent] Error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro. Tente novamente.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleClose = () => {
    setIsOpen(false)
    // Messages persist in memory — only cleared on page close/navigation
  }

  // ─── Visual Tag Parser ─────────────────────────────────────────────
  const parseVisualTags = (content: string) => {
    const TAG_REGEX = /\{\{(score|spin|trend|metric)\|([^}]+)\}\}/g
    const parts: Array<{ type: 'text' | 'score' | 'spin' | 'trend' | 'metric'; data: string }> = []
    let lastIndex = 0
    let match

    while ((match = TAG_REGEX.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', data: content.slice(lastIndex, match.index) })
      }
      parts.push({ type: match[1] as 'score' | 'spin' | 'trend' | 'metric', data: match[2] })
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', data: content.slice(lastIndex) })
    }

    return parts
  }

  // ─── Visual Components (matched to app design system) ──────────────
  const getScoreColor = (value: number, max: number = 10) => {
    const pct = (value / max) * 100
    if (pct >= 70) return { text: 'text-green-600', bar: 'bg-green-500', indicator: 'bg-green-500' }
    if (pct >= 50) return { text: 'text-amber-600', bar: 'bg-amber-500', indicator: 'bg-amber-500' }
    return { text: 'text-red-600', bar: 'bg-red-500', indicator: 'bg-red-500' }
  }

  const ScoreDisplay = ({ value, max, label }: { value: number; max: number; label: string }) => {
    const pct = Math.min(100, (value / max) * 100)
    const colors = getScoreColor(value, max)

    return (
      <div className="bg-gray-50 rounded-xl p-3 my-1.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
          <div className="flex items-baseline gap-0.5">
            <span className={`text-2xl font-bold ${colors.text}`}>{value.toFixed(1)}</span>
            <span className="text-xs text-gray-400">/{max}</span>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div className={`${colors.bar} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  const SpinBars = ({ s, p, i: iVal, n }: { s: number; p: number; i: number; n: number }) => {
    const bars = [
      { key: 'S', value: s },
      { key: 'P', value: p },
      { key: 'I', value: iVal },
      { key: 'N', value: n },
    ]

    return (
      <div className="bg-gray-50 rounded-xl p-3 my-1.5">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Scores SPIN</div>
        <div className="space-y-2">
          {bars.map(bar => {
            const colors = getScoreColor(bar.value)
            return (
              <div key={bar.key} className="flex items-center gap-2">
                <div className={`w-2 h-6 rounded-full ${colors.indicator} flex-shrink-0`} />
                <span className="text-xs text-gray-500 font-medium w-3">{bar.key}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className={`${colors.bar} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${Math.min(100, (bar.value / 10) * 100)}%` }} />
                </div>
                <span className={`text-xs font-bold ${colors.text} w-7 text-right tabular-nums`}>{bar.value.toFixed(1)}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const TrendBadge = ({ direction, label }: { direction: string; label: string }) => {
    const config = direction === 'improving'
      ? { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: '↗' }
      : direction === 'declining'
      ? { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: '↘' }
      : { bg: 'bg-gray-100', border: 'border-gray-200', text: 'text-gray-600', icon: '→' }

    return (
      <div className={`inline-flex items-center gap-1.5 ${config.bg} border ${config.border} rounded-full px-3 py-1 my-1`}>
        <span className="text-xs">{config.icon}</span>
        <span className={`text-xs font-medium ${config.text}`}>{label}</span>
      </div>
    )
  }

  const MetricCard = ({ value, label }: { value: string; label: string }) => (
    <div className="inline-flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 my-0.5 mr-1.5">
      <span className="text-lg font-bold text-gray-800">{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  )

  // ─── Text Renderer (markdown-like) ──────────────────────────────────
  const renderTextBlock = (text: string, keyPrefix: number) => {
    const lines = text.split('\n')
    return (
      <div key={`text-${keyPrefix}`}>
        {lines.map((line, i) => {
          let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>')
          if (processed.match(/^[-•]\s/)) {
            processed = `<span class="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-2 mt-2 flex-shrink-0"></span><span>${processed.slice(2)}</span>`
            return <div key={`${keyPrefix}-${i}`} className="flex items-start ml-2 my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />
          }
          if (processed.match(/^\d+\.\s/)) {
            return <div key={`${keyPrefix}-${i}`} className="ml-2 my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />
          }
          if (!processed.trim()) return <div key={`${keyPrefix}-${i}`} className="h-2" />
          return <div key={`${keyPrefix}-${i}`} className="my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />
        })}
      </div>
    )
  }

  // ─── Main Content Renderer ──────────────────────────────────────────
  const renderContent = (content: string) => {
    const parts = parseVisualTags(content)

    // If no visual tags found, fall back to simple text rendering
    if (parts.length === 1 && parts[0].type === 'text') {
      return renderTextBlock(content, 0)
    }

    return parts.map((part, idx) => {
      switch (part.type) {
        case 'score': {
          const segs = part.data.split('|')
          const val = parseFloat(segs[0])
          const max = parseFloat(segs[1]) || 10
          return <ScoreDisplay key={`s-${idx}`} value={isNaN(val) ? 0 : val} max={max} label={segs[2] || 'Score'} />
        }
        case 'spin': {
          const vals = part.data.split('|').map(v => parseFloat(v))
          return <SpinBars key={`sp-${idx}`} s={vals[0] || 0} p={vals[1] || 0} i={vals[2] || 0} n={vals[3] || 0} />
        }
        case 'trend': {
          const [direction, ...rest] = part.data.split('|')
          return <TrendBadge key={`t-${idx}`} direction={direction} label={rest.join('|') || direction} />
        }
        case 'metric': {
          const [value, ...rest] = part.data.split('|')
          return <MetricCard key={`m-${idx}`} value={value} label={rest.join('|')} />
        }
        case 'text':
          return renderTextBlock(part.data, idx)
      }
    })
  }

  const interacting = isDragging || isResizing

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 group"
        >
          <Sparkles className="w-6 h-6 text-white" />
          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-visible border border-gray-200"
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            width: `${size.w}px`,
            height: `${size.h}px`,
            userSelect: interacting ? 'none' : 'auto',
          }}
        >
          {/* ===== Resize handles (8 directions) ===== */}
          {/* Top */}
          <div onMouseDown={e => onResizeStart(e, 'top')} className="absolute -top-1 left-3 right-3 h-2 cursor-n-resize z-20" />
          {/* Bottom */}
          <div onMouseDown={e => onResizeStart(e, 'bottom')} className="absolute -bottom-1 left-3 right-3 h-2 cursor-s-resize z-20" />
          {/* Left */}
          <div onMouseDown={e => onResizeStart(e, 'left')} className="absolute top-3 -left-1 w-2 bottom-3 cursor-w-resize z-20" />
          {/* Right */}
          <div onMouseDown={e => onResizeStart(e, 'right')} className="absolute top-3 -right-1 w-2 bottom-3 cursor-e-resize z-20" />
          {/* Top-left */}
          <div onMouseDown={e => onResizeStart(e, 'top-left')} className="absolute -top-1 -left-1 w-4 h-4 cursor-nw-resize z-30" />
          {/* Top-right */}
          <div onMouseDown={e => onResizeStart(e, 'top-right')} className="absolute -top-1 -right-1 w-4 h-4 cursor-ne-resize z-30" />
          {/* Bottom-left */}
          <div onMouseDown={e => onResizeStart(e, 'bottom-left')} className="absolute -bottom-1 -left-1 w-4 h-4 cursor-sw-resize z-30" />
          {/* Bottom-right */}
          <div onMouseDown={e => onResizeStart(e, 'bottom-right')} className="absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize z-30" />

          {/* Header (draggable) */}
          <div
            onMouseDown={onDragStart}
            className="bg-[#0D4A3A] px-4 py-3 flex items-center justify-between flex-shrink-0 cursor-grab active:cursor-grabbing rounded-t-2xl"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-green-300" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">Assistente Ramppy</h3>
                <p className="text-green-300/70 text-[10px]">Coach pessoal de vendas</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm text-gray-700">
                    Olá{userName ? <>, <span className="font-semibold">{userName.split(' ')[0]}</span></> : ''}! Sou seu assistente pessoal.
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Performance, reuniões, treinos e agenda</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {QUICK_SUGGESTIONS.map((suggestion) => {
                    const Icon = suggestion.icon
                    return (
                      <button
                        key={suggestion.text}
                        onClick={() => sendMessage(suggestion.text)}
                        className={`flex items-start gap-2 text-left px-3 py-2.5 rounded-xl border transition-all duration-200 ${suggestion.color}`}
                      >
                        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="text-xs leading-snug font-medium">{suggestion.text}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'max-w-[85%] bg-[#0D4A3A] text-white rounded-br-md'
                          : 'max-w-[92%] bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions after first message */}
          {messages.length > 0 && !isLoading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1">
              {QUICK_SUGGESTIONS.slice(0, 3).map((suggestion) => {
                const Icon = suggestion.icon
                return (
                  <button
                    key={suggestion.text}
                    onClick={() => sendMessage(suggestion.text)}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 bg-gray-50 hover:bg-green-50 text-gray-500 hover:text-green-700 rounded-full transition-colors border border-gray-100 hover:border-green-200"
                  >
                    <Icon className="w-3 h-3" />
                    {suggestion.text}
                  </button>
                )
              })}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-2.5 border-t border-gray-100 flex items-center gap-2 flex-shrink-0 rounded-b-2xl">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte qualquer coisa..."
              disabled={isLoading}
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 disabled:opacity-50 placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 bg-[#0D4A3A] hover:bg-[#0D5A4A] text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-30 flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  )
}
