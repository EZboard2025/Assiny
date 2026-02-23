'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, X, Send, Loader2, TrendingUp, Dumbbell, CalendarDays, Share2, Users, BarChart3, Trophy, Target, UserCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

type ViewContext = 'home' | 'perfil' | 'roleplay' | string

interface SellerAgentChatProps {
  userName?: string
  userRole?: string
  currentView?: ViewContext
}

type Suggestion = { text: string; icon: any; color: string }

// Max 3 suggestions total per page — vendedor vs gestor
const SELLER_SUGGESTIONS: Record<string, Suggestion[]> = {
  home: [
    { text: 'Como está minha performance?', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
    { text: 'O que devo treinar hoje?', icon: Dumbbell, color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' },
    { text: 'Gerenciar minha agenda', icon: CalendarDays, color: 'text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100' },
  ],
  perfil: [
    { text: 'Analise minha evolução', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
    { text: 'Onde devo melhorar?', icon: Target, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
    { text: 'Compartilhar dados com a equipe', icon: Share2, color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  ],
  roleplay: [
    { text: 'Dicas para esta simulação', icon: Dumbbell, color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' },
    { text: 'Como lidar com objeções?', icon: Target, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
    { text: 'Meus pontos fracos no SPIN', icon: UserCircle2, color: 'text-sky-600 bg-sky-50 border-sky-200 hover:bg-sky-100' },
  ],
}

const MANAGER_SUGGESTIONS: Record<string, Suggestion[]> = {
  home: [
    { text: 'Quem precisa de atenção?', icon: Users, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
    { text: 'Compare os vendedores', icon: BarChart3, color: 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
    { text: 'Como está minha performance?', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
  ],
  perfil: [
    { text: 'Analise minha evolução', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
    { text: 'Compare os vendedores', icon: BarChart3, color: 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
    { text: 'Quem precisa de atenção?', icon: Users, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
  ],
  roleplay: [
    { text: 'Quem treinou hoje?', icon: Users, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
    { text: 'Dicas para esta simulação', icon: Dumbbell, color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100' },
    { text: 'Quem mais evoluiu?', icon: Trophy, color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
  ],
  manager: [
    { text: 'Quem precisa de atenção?', icon: Users, color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100' },
    { text: 'Compare os vendedores', icon: BarChart3, color: 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100' },
    { text: 'Quem mais evoluiu?', icon: Trophy, color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
  ],
}

const MIN_PANEL_W = 340
const MAX_PANEL_W = 700
const DEFAULT_PANEL_W = 380

export default function SellerAgentChat({ userName, userRole, currentView = 'home' }: SellerAgentChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [detectedRole, setDetectedRole] = useState<string | null>(null)
  const [detectedUserName, setDetectedUserName] = useState<string | null>(null)

  const effectiveRole = userRole || detectedRole
  const isManager = effectiveRole?.toLowerCase() === 'admin' || effectiveRole?.toLowerCase() === 'gestor'
  const displayName = userName || detectedUserName

  // Context-aware suggestions — exactly 3 total
  const suggestions = isManager
    ? (MANAGER_SUGGESTIONS[currentView] || MANAGER_SUGGESTIONS.home).slice(0, 3)
    : (SELLER_SUGGESTIONS[currentView] || SELLER_SUGGESTIONS.home).slice(0, 3)

  // Resizable panel width
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_W)
  const [isResizing, setIsResizing] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resizeRef = useRef<{ startX: number; origW: number } | null>(null)

  // Load auth token on mount
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) { setAuthToken(session.access_token) }
        else {
          const { data: { session: refreshed } } = await supabase.auth.refreshSession()
          if (refreshed?.access_token) { setAuthToken(refreshed.access_token) }
          else {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: { session: retried } } = await supabase.auth.getSession()
              if (retried?.access_token) { setAuthToken(retried.access_token) }
            }
            if (!session && !refreshed) console.warn('[SellerAgent] No auth token found after all strategies')
          }
        }
      } catch (e) {
        console.error('[SellerAgent] Auth error:', e)
      }

      // Auto-detect role and name if not provided via props
      if (!userRole || !userName) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: emp } = await supabase
              .from('employees')
              .select('role, name')
              .eq('user_id', user.id)
              .single()
            if (emp?.role && !userRole) setDetectedRole(emp.role)
            if (emp?.name && !userName) setDetectedUserName(emp.name)
          }
        } catch {}
      }
    }
    loadAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) setAuthToken(session.access_token)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Left-edge resize handler
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeRef.current = { startX: e.clientX, origW: panelWidth }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dx = resizeRef.current.startX - ev.clientX
      const newW = Math.max(MIN_PANEL_W, Math.min(MAX_PANEL_W, resizeRef.current.origW + dx))
      setPanelWidth(newW)
    }

    const onUp = () => {
      setIsResizing(false)
      resizeRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelWidth])

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
  }

  // ─── Visual Tag Parser ─────────────────────────────────────────────
  const parseVisualTags = (content: string) => {
    const TAG_REGEX = /\{\{(score|spin|trend|metric|meeting|eval_card|teammate|ranking|comparison)\|([^}]+)\}\}/g
    const parts: Array<{ type: 'text' | 'score' | 'spin' | 'trend' | 'metric' | 'meeting' | 'eval_card' | 'teammate' | 'ranking' | 'comparison'; data: string }> = []
    let lastIndex = 0
    let match

    while ((match = TAG_REGEX.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', data: content.slice(lastIndex, match.index) })
      }
      parts.push({ type: match[1] as any, data: match[2] })
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', data: content.slice(lastIndex) })
    }

    return parts
  }

  // ─── Visual Components ──────────────────────────────────────────────
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

  // ─── Eval Card ──────────────────────────────────────────────────────
  const EvalCard = ({ id, type, title, date, score, spinS, spinP, spinI, spinN }: {
    id: string; type: string; title: string; date: string; score: number;
    spinS?: number; spinP?: number; spinI?: number; spinN?: number
  }) => {
    const typeConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
      meet: { label: 'Meet', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
      roleplay: { label: 'Roleplay', bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
      desafio: { label: 'Desafio', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    }
    const tc = typeConfig[type] || { label: type, bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' }
    const scoreColors = getScoreColor(score)
    const hasSpin = spinS !== undefined && spinP !== undefined && spinI !== undefined && spinN !== undefined

    return (
      <div className="bg-gray-50 rounded-xl p-3 my-1.5 border border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tc.bg} ${tc.text} ${tc.border} border`}>
                {tc.label}
              </span>
              <span className="text-xs text-gray-400">{date}</span>
            </div>
            <div className="font-semibold text-sm text-gray-800 truncate">{title}</div>
          </div>
          <div className="flex flex-col items-center ml-2 flex-shrink-0">
            <span className={`text-xl font-bold ${scoreColors.text}`}>{score.toFixed(1)}</span>
            <span className="text-[9px] text-gray-400">/10</span>
          </div>
        </div>
        {hasSpin && (
          <div className="flex items-center gap-3 mt-2">
            {[
              { key: 'S', value: spinS! },
              { key: 'P', value: spinP! },
              { key: 'I', value: spinI! },
              { key: 'N', value: spinN! },
            ].map(b => {
              const c = getScoreColor(b.value)
              return (
                <div key={b.key} className="flex items-center gap-1 flex-1">
                  <span className="text-[10px] text-gray-400 font-medium">{b.key}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div className={`${c.bar} h-full rounded-full`} style={{ width: `${Math.min(100, (b.value / 10) * 100)}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold ${c.text} tabular-nums`}>{b.value.toFixed(1)}</span>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={() => sendMessage(`Compartilha a avaliação "${title}" do dia ${date} (ID: ${id}, tipo: ${type}) com a equipe. Quem deve receber?`)}
            disabled={isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#10b981', color: '#fff', cursor: 'pointer', opacity: isLoading ? 0.4 : 1, border: 'none' }}
          >
            <Share2 size={13} />
            Compartilhar
          </button>
        </div>
      </div>
    )
  }

  // ─── Teammate Card ────────────────────────────────────────────────
  const TeammateCard = ({ userId, name, role }: { userId: string; name: string; role?: string }) => {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    const colors = [
      'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700', 'bg-indigo-100 text-indigo-700',
    ]
    const colorIdx = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length

    return (
      <button
        onClick={() => sendMessage(`Compartilha com ${name} (user_id: ${userId})`)}
        disabled={isLoading}
        className="flex items-center gap-3 w-full p-2.5 rounded-lg border border-gray-100 bg-white hover:bg-green-50 hover:border-green-200 transition-all duration-150 text-left group"
        style={{ opacity: isLoading ? 0.4 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${colors[colorIdx]}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800 truncate">{name}</div>
          {role && <div className="text-[11px] text-gray-400">{role}</div>}
        </div>
        <div className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Share2 size={14} />
        </div>
      </button>
    )
  }

  // ─── Ranking & Comparison ─────────────────────────────────────────
  const RankingBars = ({ items }: { items: Array<{ name: string; value: number }> }) => {
    const sorted = [...items].sort((a, b) => b.value - a.value)
    const maxVal = Math.max(...sorted.map(i => i.value), 10)

    return (
      <div className="bg-gray-50 rounded-xl p-3 my-1.5">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Ranking</div>
        <div className="space-y-2">
          {sorted.map((item, i) => {
            const colors = getScoreColor(item.value)
            const pct = Math.min((item.value / maxVal) * 100, 100)
            return (
              <div key={i} className="flex items-center gap-2">
                <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-amber-500' : 'text-gray-400'}`}>{i + 1}.</span>
                <span className="text-xs text-gray-600 font-medium w-20 truncate">{item.name}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className={`${colors.bar} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-xs font-bold ${colors.text} w-7 text-right tabular-nums`}>{item.value.toFixed(1)}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const ComparisonBars = ({ items }: { items: Array<{ name: string; value: number }> }) => {
    const maxVal = Math.max(...items.map(i => i.value), 10)

    return (
      <div className="bg-gray-50 rounded-xl p-3 my-1.5">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">Comparação</div>
        <div className="space-y-2.5">
          {items.map((item, i) => {
            const colors = getScoreColor(item.value)
            const pct = Math.min((item.value / maxVal) * 100, 100)
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{item.name}</span>
                  <span className={`font-bold ${colors.text}`}>{item.value.toFixed(1)}</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className={`${colors.bar} h-full rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Rich Text Renderer ────────────────────────────────────────────
  const renderTextBlock = (text: string, keyPrefix: number) => {
    const lines = text.split('\n')

    type LineType = 'header' | 'bullet' | 'numbered' | 'empty' | 'paragraph'
    const classified = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed) return { type: 'empty' as LineType, raw: line, content: '' }
      if (trimmed.match(/^#{1,4}\s+/)) return { type: 'header' as LineType, raw: line, content: trimmed.replace(/^#{1,4}\s+/, '') }
      if (trimmed.match(/^\*\*[^*]+\*\*:?$/) && trimmed.length < 120) return { type: 'header' as LineType, raw: line, content: trimmed.replace(/\*\*/g, '') }
      if (trimmed.match(/^[-•]\s/)) return { type: 'bullet' as LineType, raw: line, content: trimmed.slice(2) }
      if (trimmed.match(/^\d+[\.\)]\s/)) return { type: 'numbered' as LineType, raw: line, content: trimmed.replace(/^\d+[\.\)]\s/, '') }
      return { type: 'paragraph' as LineType, raw: line, content: trimmed }
    })

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
        case 'eval_card': {
          const segs = part.data.split('|')
          const parseNum = (s: string | undefined) => {
            if (!s || s === '_') return undefined
            const n = parseFloat(s)
            return isNaN(n) ? undefined : n
          }
          return <EvalCard key={`ec-${idx}`} id={segs[0] || ''} type={segs[1] || 'meet'} title={segs[2] || ''} date={segs[3] || ''} score={parseNum(segs[4]) ?? 0} spinS={parseNum(segs[5])} spinP={parseNum(segs[6])} spinI={parseNum(segs[7])} spinN={parseNum(segs[8])} />
        }
        case 'teammate': {
          const segs = part.data.split('|')
          return <TeammateCard key={`tm-${idx}`} userId={segs[0] || ''} name={segs[1] || ''} role={segs[2]} />
        }
        case 'ranking': {
          const items = part.data.split(',').map(entry => {
            const [name, val] = entry.split('|')
            return { name: name?.trim() || '', value: parseFloat(val) || 0 }
          })
          return <RankingBars key={`rk-${idx}`} items={items} />
        }
        case 'comparison': {
          const items = part.data.split(',').map(entry => {
            const [name, val] = entry.split('|')
            return { name: name?.trim() || '', value: parseFloat(val) || 0 }
          })
          return <ComparisonBars key={`cp-${idx}`} items={items} />
        }
        case 'text':
          return renderTextBlock(part.data, idx)
      }
    })
  }

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

      {/* Fixed right sidebar panel */}
      {isOpen && (
        <div
          className="fixed top-0 right-0 z-40 h-screen bg-white border-l border-gray-200 flex flex-col shadow-xl"
          style={{ width: panelWidth, userSelect: isResizing ? 'none' : undefined }}
        >
          {/* Left-edge resize handle */}
          <div
            onMouseDown={onResizeStart}
            className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize z-50 group hover:bg-green-400/30 transition-colors"
          >
            <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-12 rounded-full bg-gray-300 group-hover:bg-green-500 transition-colors" />
          </div>

          {/* Header */}
          <div className="h-[60px] bg-white border-b border-gray-200 px-4 flex items-center shrink-0 relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-600" />
                <span className="text-gray-900 text-sm font-medium">Assistente Ramppy</span>
                <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">IA</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1 relative z-10">
              <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors" title="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ============ INITIAL SCREEN ============ */}
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="mb-4">
                  <Sparkles className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-gray-900 text-lg font-semibold mb-1 text-center">
                  Olá{displayName ? <>, <span>{displayName.split(' ')[0]}</span></> : ''}! Sou seu assistente pessoal.
                </h2>
                <p className="text-gray-400 text-xs text-center mb-6">{isManager ? 'Performance, reuniões, treinos, agenda e gestão da equipe' : 'Performance, reuniões, treinos e agenda'}</p>

                {/* Input field */}
                <form onSubmit={handleSubmit} className="w-full bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 mb-6">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pergunte qualquer coisa..."
                    disabled={isLoading}
                    className="w-full bg-transparent text-gray-900 text-sm outline-none placeholder-gray-400"
                  />
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button type="submit" disabled={!input.trim() || isLoading} className="p-1.5 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
                    </button>
                  </div>
                </form>

                {/* Quick suggestions (contextual, max 3 total) */}
                <div className="w-full space-y-2">
                  {suggestions.map((suggestion) => {
                    const Icon = suggestion.icon
                    return (
                      <button
                        key={suggestion.text}
                        onClick={() => sendMessage(suggestion.text)}
                        disabled={isLoading}
                        className="w-full flex items-center gap-2.5 text-left px-4 py-3 bg-gray-50 text-gray-900 text-sm rounded-xl border border-gray-200 hover:border-green-300 hover:bg-gray-50 transition-all disabled:opacity-50"
                      >
                        <Icon className="w-4 h-4 text-green-600 flex-shrink-0" />
                        {suggestion.text}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* ============ CHAT SCREEN ============ */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-5 py-4 space-y-6 flex flex-col" style={{ minHeight: '100%' }}>
                  {messages.map((msg, i) => (
                    <div key={i}>
                      {msg.role === 'user' && (
                        <div className="flex justify-end">
                          <div className="max-w-[85%] bg-gray-100 text-gray-900 rounded-2xl rounded-br-md px-4 py-2.5">
                            <p className="text-sm">{msg.content}</p>
                          </div>
                        </div>
                      )}
                      {msg.role === 'assistant' && (
                        <div className="flex gap-3 items-start">
                          <div className="w-7 h-7 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Sparkles className="w-3.5 h-3.5 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0 text-sm text-gray-800">
                            {renderContent(msg.content)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 items-start">
                      <div className="w-7 h-7 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div className="flex-grow" />
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Quick suggestions pills (max 3, contextual) */}
              {!isLoading && (
                <div className="px-4 py-2 flex flex-wrap gap-1.5 shrink-0 border-t border-gray-200">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.text}
                      onClick={() => sendMessage(suggestion.text)}
                      className="text-xs text-gray-400 px-3 py-1.5 rounded-full hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      {suggestion.text}
                    </button>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <form onSubmit={handleSubmit} className="px-4 py-3 shrink-0">
                <div className="flex items-center gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-3 py-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pergunte qualquer coisa..."
                    disabled={isLoading}
                    className="flex-1 bg-transparent text-gray-900 text-sm outline-none placeholder-gray-400"
                  />
                  <button type="submit" disabled={!input.trim() || isLoading} className="p-1.5 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0">
                    {isLoading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
