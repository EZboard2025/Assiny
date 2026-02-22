'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, X, Send, Loader2, TrendingUp, Dumbbell, CalendarDays } from 'lucide-react'
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
  { text: 'O que devo treinar hoje?', icon: Dumbbell, color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { text: 'Gerenciar minha agenda', icon: CalendarDays, color: 'text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100' },
]

const MIN_W = 340
const MIN_H = 380
const DEFAULT_W = 400
const DEFAULT_H = 600

export default function SellerAgentChat({ userName }: SellerAgentChatProps) {
  const [isOpen, setIsOpen] = useState(true)
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
    const TAG_REGEX = /\{\{(score|spin|trend|metric|meeting)\|([^}]+)\}\}/g
    const parts: Array<{ type: 'text' | 'score' | 'spin' | 'trend' | 'metric' | 'meeting'; data: string }> = []
    let lastIndex = 0
    let match

    while ((match = TAG_REGEX.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', data: content.slice(lastIndex, match.index) })
      }
      parts.push({ type: match[1] as 'score' | 'spin' | 'trend' | 'metric' | 'meeting', data: match[2] })
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

  const MeetingCard = ({ title, date, time, link, participants, botStatus }: {
    title: string; date: string; time: string; link?: string; participants?: string; botStatus?: string
  }) => {
    return (
      <div className="bg-gray-50 rounded-xl p-3 my-1.5 border border-gray-100">
        <div className="flex items-start gap-3">
          {/* Calendar icon */}
          <div className="w-10 h-10 bg-green-50 rounded-lg flex flex-col items-center justify-center flex-shrink-0 border border-green-100">
            <span className="text-[9px] font-bold text-green-600 uppercase leading-none">{date.split('/')[1] ? ['', 'Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(date.split('/')[1])] || date.split('/')[1] : ''}</span>
            <span className="text-sm font-bold text-green-700 leading-none">{date.split('/')[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-800 truncate">{title}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-xs text-gray-500">{time}</span>
            </div>
            {participants && (
              <div className="flex items-center gap-1.5 mt-1">
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-xs text-gray-500 truncate">{participants}</span>
              </div>
            )}
            {botStatus && (
              <div className="mt-1">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  botStatus === 'completed' ? 'bg-green-50 text-green-600' :
                  botStatus === 'scheduled' || botStatus === 'pending' ? 'bg-amber-50 text-amber-600' :
                  botStatus === 'error' ? 'bg-red-50 text-red-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {botStatus === 'completed' ? 'Avaliado' : botStatus === 'scheduled' ? 'Bot agendado' : botStatus === 'pending' ? 'Pendente' : botStatus === 'error' ? 'Erro' : botStatus}
                </span>
              </div>
            )}
          </div>
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
          {link && link !== 'none' && (
            <a href={link} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#10b981', color: '#fff', textDecoration: 'none' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Entrar
            </a>
          )}
          <button onClick={() => sendMessage(`Reagenda a reunião "${title}" do dia ${date}. Para quando?`)} disabled={isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', cursor: 'pointer', opacity: isLoading ? 0.4 : 1 }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Reagendar
          </button>
          <button onClick={() => sendMessage(`Adiciona convidados na reunião "${title}" do dia ${date}. Quem devo adicionar?`)} disabled={isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', cursor: 'pointer', opacity: isLoading ? 0.4 : 1 }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Convidados
          </button>
          {link && link !== 'none' && botStatus !== 'completed' && botStatus !== 'recording' && (
            <button onClick={() => sendMessage(
              botStatus === 'scheduled' || botStatus === 'pending'
                ? `Desativa o bot de análise na reunião "${title}" do dia ${date}`
                : `Ativa o bot de análise na reunião "${title}" do dia ${date}`
            )} disabled={isLoading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: botStatus === 'scheduled' || botStatus === 'pending' ? '#fef3c7' : '#faf5ff', color: botStatus === 'scheduled' || botStatus === 'pending' ? '#92400e' : '#7e22ce', border: `1px solid ${botStatus === 'scheduled' || botStatus === 'pending' ? '#fde68a' : '#e9d5ff'}`, cursor: 'pointer', opacity: isLoading ? 0.4 : 1 }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              {botStatus === 'scheduled' || botStatus === 'pending' ? 'Desativar bot' : 'Ativar bot'}
            </button>
          )}
          <button onClick={() => sendMessage(`Cancela a reunião "${title}" do dia ${date}`)} disabled={isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', cursor: 'pointer', opacity: isLoading ? 0.4 : 1 }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // ─── Rich Text Renderer ────────────────────────────────────────────
  const renderTextBlock = (text: string, keyPrefix: number) => {
    const lines = text.split('\n')

    // Classify each line
    type LineType = 'header' | 'bullet' | 'numbered' | 'empty' | 'paragraph'
    const classified = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed) return { type: 'empty' as LineType, raw: line, content: '' }
      // Markdown headers: ### Title or ## Title
      if (trimmed.match(/^#{1,4}\s+/)) return { type: 'header' as LineType, raw: line, content: trimmed.replace(/^#{1,4}\s+/, '') }
      // Bold-only line ending with : is a section header — e.g. **Recomendações:**
      if (trimmed.match(/^\*\*[^*]+\*\*:?$/) && trimmed.length < 120) return { type: 'header' as LineType, raw: line, content: trimmed.replace(/\*\*/g, '') }
      // Bullet items
      if (trimmed.match(/^[-•]\s/)) return { type: 'bullet' as LineType, raw: line, content: trimmed.slice(2) }
      // Numbered items
      if (trimmed.match(/^\d+[\.\)]\s/)) return { type: 'numbered' as LineType, raw: line, content: trimmed.replace(/^\d+[\.\)]\s/, '') }
      return { type: 'paragraph' as LineType, raw: line, content: trimmed }
    })

    // Group consecutive items of same type into blocks
    type Block = { type: LineType; items: string[] }
    const blocks: Block[] = []
    for (const line of classified) {
      const last = blocks[blocks.length - 1]
      if (line.type === 'empty') {
        blocks.push({ type: 'empty', items: [] })
      } else if (last && last.type === line.type && (line.type === 'bullet' || line.type === 'numbered')) {
        last.items.push(line.content)
      } else {
        blocks.push({ type: line.type, items: [line.content] })
      }
    }

    const inlineMarkdown = (s: string) => {
      let out = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      out = out.replace(/\*(.*?)\*/g, '<em>$1</em>')
      out = out.replace(/`([^`]+)`/g, '<code class="bg-gray-200 text-gray-700 px-1 py-0.5 rounded text-xs">$1</code>')
      return out
    }

    return (
      <div key={`text-${keyPrefix}`} className="space-y-1.5">
        {blocks.map((block, bi) => {
          switch (block.type) {
            case 'empty':
              return <div key={`${keyPrefix}-${bi}`} className="h-1" />

            case 'header':
              return (
                <div key={`${keyPrefix}-${bi}`} className="flex items-center gap-2 pt-2 pb-0.5">
                  <div className="w-1 h-4 bg-green-500 rounded-full flex-shrink-0" />
                  <span className="text-sm font-bold text-gray-800" dangerouslySetInnerHTML={{ __html: inlineMarkdown(block.items[0]) }} />
                </div>
              )

            case 'bullet':
              return (
                <div key={`${keyPrefix}-${bi}`} className="bg-gray-50 rounded-lg px-3 py-2 space-y-1.5">
                  {block.items.map((item, ii) => (
                    <div key={`${keyPrefix}-${bi}-${ii}`} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-[6px] flex-shrink-0" />
                      <span className="text-sm text-gray-700 leading-snug" dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
                    </div>
                  ))}
                </div>
              )

            case 'numbered':
              return (
                <div key={`${keyPrefix}-${bi}`} className="bg-gray-50 rounded-lg px-3 py-2 space-y-1.5">
                  {block.items.map((item, ii) => (
                    <div key={`${keyPrefix}-${bi}-${ii}`} className="flex items-start gap-2">
                      <span className="text-xs font-bold text-green-600 bg-green-50 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{ii + 1}</span>
                      <span className="text-sm text-gray-700 leading-snug" dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
                    </div>
                  ))}
                </div>
              )

            case 'paragraph':
              return (
                <div key={`${keyPrefix}-${bi}`} className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(block.items[0]) }} />
              )

            default:
              return null
          }
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
        case 'meeting': {
          const segs = part.data.split('|')
          return <MeetingCard key={`mt-${idx}`} title={segs[0] || ''} date={segs[1] || ''} time={segs[2] || ''} link={segs[3]} participants={segs[4]} botStatus={segs[5]} />
        }
        case 'text':
          return renderTextBlock(part.data, idx)
      }
    })
  }

  const interacting = isDragging || isResizing

  return (
    <>
      {/* Floating button when closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 group"
        >
          <Sparkles className="w-6 h-6 text-white" />
          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-20" />
        </button>
      )}

      {/* Sidebar panel */}
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
