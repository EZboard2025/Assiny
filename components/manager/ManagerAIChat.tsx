'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Copy, Sparkles, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Score color helpers
const getScoreColor = (score: number) => {
  if (score >= 7) return '#22c55e'
  if (score >= 5) return '#eab308'
  return '#ef4444'
}

const getScoreBg = (score: number) => {
  if (score >= 7) return 'rgba(34,197,94,0.15)'
  if (score >= 5) return 'rgba(234,179,8,0.15)'
  return 'rgba(239,68,68,0.15)'
}

// Visual component renderers
function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-bold text-sm mx-1"
      style={{ backgroundColor: getScoreBg(score), color: getScoreColor(score) }}
    >
      {score.toFixed(1)}
    </span>
  )
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="my-2 w-full">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[#8696a0]">{label}</span>
        <span className="font-bold" style={{ color: getScoreColor(value) }}>{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: getScoreColor(value) }}
        />
      </div>
    </div>
  )
}

function SpinBars({ data }: { data: string }) {
  const entries = data.split('|').map(s => {
    const [key, val] = s.trim().split('=')
    return { key: key.trim(), value: parseFloat(val) || 0 }
  })
  const labels: Record<string, string> = { S: 'Situação', P: 'Problema', I: 'Implicação', N: 'Necessidade' }

  return (
    <div className="my-2 p-2.5 bg-white/5 rounded-lg w-full">
      <div className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider mb-2">SPIN Selling</div>
      <div className="space-y-1.5">
        {entries.map(({ key, value }) => {
          const pct = Math.min((value / 10) * 100, 100)
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-4 text-xs font-bold text-purple-300 text-center">{key}</span>
              <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: getScoreColor(value) }}
                />
              </div>
              <span className="w-8 text-right text-xs font-bold" style={{ color: getScoreColor(value) }}>{value.toFixed(1)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Ranking({ data }: { data: string }) {
  const items = data.split(',').map(s => {
    const [name, val] = s.trim().split('|')
    return { name: name.trim(), value: parseFloat(val) || 0 }
  }).sort((a, b) => b.value - a.value)

  const maxVal = Math.max(...items.map(i => i.value), 10)

  return (
    <div className="my-2 p-2.5 bg-white/5 rounded-lg w-full">
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const pct = Math.min((item.value / maxVal) * 100, 100)
          return (
            <div key={i} className="flex items-center gap-2">
              <span className={`w-5 text-xs font-bold text-center ${i === 0 ? 'text-yellow-400' : 'text-[#8696a0]'}`}>
                {i + 1}.
              </span>
              <span className="w-20 text-xs text-[#e9edef] truncate">{item.name}</span>
              <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: getScoreColor(item.value) }}
                />
              </div>
              <span className="w-8 text-right text-xs font-bold" style={{ color: getScoreColor(item.value) }}>
                {item.value.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrendBadge({ trend }: { trend: string }) {
  const t = trend.trim().toLowerCase()
  if (t === 'melhorando') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 mx-1">
        <TrendingUp className="w-3 h-3" /> Melhorando
      </span>
    )
  }
  if (t === 'piorando') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 mx-1">
        <TrendingDown className="w-3 h-3" /> Piorando
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400 mx-1">
      <Minus className="w-3 h-3" /> Estável
    </span>
  )
}

function ComparisonBars({ data }: { data: string }) {
  const items = data.split(',').map(s => {
    const [name, val] = s.trim().split('|')
    return { name: name.trim(), value: parseFloat(val) || 0 }
  })

  const maxVal = Math.max(...items.map(i => i.value), 10)

  return (
    <div className="my-2 p-2.5 bg-white/5 rounded-lg w-full">
      <div className="space-y-2">
        {items.map((item, i) => {
          const pct = Math.min((item.value / maxVal) * 100, 100)
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-[#e9edef]">{item.name}</span>
                <span className="font-bold" style={{ color: getScoreColor(item.value) }}>{item.value.toFixed(1)}</span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: getScoreColor(item.value) }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Styled text renderer for plain text segments
function StyledText({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let bulletBuffer: string[] = []
  let numberedBuffer: { num: string; text: string }[] = []

  const flushBullets = (key: string) => {
    if (bulletBuffer.length === 0) return
    elements.push(
      <div key={key} className="my-1.5 space-y-1 pl-1">
        {bulletBuffer.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-[7px] shrink-0" />
            <span className="text-[#d1d7db] text-sm leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    )
    bulletBuffer = []
  }

  const flushNumbered = (key: string) => {
    if (numberedBuffer.length === 0) return
    elements.push(
      <div key={key} className="my-1.5 space-y-1.5 pl-1">
        {numberedBuffer.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {item.num}
            </span>
            <span className="text-[#d1d7db] text-sm leading-relaxed">{item.text}</span>
          </div>
        ))}
      </div>
    )
    numberedBuffer = []
  }

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const trimmed = line.trim()

    // Empty line = spacer
    if (!trimmed) {
      flushBullets(`bl_${li}`)
      flushNumbered(`nl_${li}`)
      continue
    }

    // Bullet point (- text)
    if (/^[-–•]\s/.test(trimmed)) {
      flushNumbered(`nl_${li}`)
      bulletBuffer.push(trimmed.replace(/^[-–•]\s+/, ''))
      continue
    }

    // Numbered item (1. text or 1) text)
    const numMatch = trimmed.match(/^(\d+)[.\)]\s+(.+)/)
    if (numMatch) {
      flushBullets(`bl_${li}`)
      numberedBuffer.push({ num: numMatch[1], text: numMatch[2] })
      continue
    }

    // Flush any pending lists before rendering other elements
    flushBullets(`bl_${li}`)
    flushNumbered(`nl_${li}`)

    // Section header (line ending with : and not too long)
    if (trimmed.endsWith(':') && trimmed.length < 100 && !trimmed.startsWith('Erro')) {
      elements.push(
        <div key={`hdr_${li}`} className="flex items-center gap-2 mt-3 mb-1">
          <div className="w-1 h-4 bg-purple-500 rounded-full shrink-0" />
          <span className="text-purple-300 text-[13px] font-semibold">{trimmed}</span>
        </div>
      )
      continue
    }

    // Regular text line
    elements.push(
      <p key={`p_${li}`} className="text-[#d1d7db] text-sm leading-relaxed">{trimmed}</p>
    )
  }

  flushBullets('bl_end')
  flushNumbered('nl_end')

  return <>{elements}</>
}

// Parse and render message content with visual tags
function RichMessage({ content }: { content: string }) {
  const tagRegex = /\{\{(NOTA|BARRA|SPIN|RANKING|TENDENCIA|COMPARAR):([^}]+)\}\}/g
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match
  let keyIdx = 0

  while ((match = tagRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    const [, tag, data] = match
    const key = `tag_${keyIdx++}`

    switch (tag) {
      case 'NOTA':
        parts.push(<ScoreBadge key={key} score={parseFloat(data) || 0} />)
        break
      case 'BARRA': {
        const barParts = data.split('|')
        parts.push(<ProgressBar key={key} label={barParts[0] || ''} value={parseFloat(barParts[1]) || 0} max={parseFloat(barParts[2]) || 10} />)
        break
      }
      case 'SPIN':
        parts.push(<SpinBars key={key} data={data} />)
        break
      case 'RANKING':
        parts.push(<Ranking key={key} data={data} />)
        break
      case 'TENDENCIA':
        parts.push(<TrendBadge key={key} trend={data} />)
        break
      case 'COMPARAR':
        parts.push(<ComparisonBars key={key} data={data} />)
        break
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return (
    <div className="text-sm break-words space-y-0.5">
      {parts.map((part, i) =>
        typeof part === 'string'
          ? <StyledText key={`text_${i}`} text={part} />
          : part
      )}
    </div>
  )
}

export default function ManagerAIChat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load auth token and user name on mount (same pattern as FollowUpView)
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')

        // Strategy 1: getSession
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          setAuthToken(session.access_token)
        } else {
          // Strategy 2: refreshSession (forces token refresh)
          const { data: { session: refreshed } } = await supabase.auth.refreshSession()
          if (refreshed?.access_token) {
            setAuthToken(refreshed.access_token)
          } else {
            // Strategy 3: getUser then retry
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: { session: retried } } = await supabase.auth.getSession()
              if (retried?.access_token) {
                setAuthToken(retried.access_token)
              }
            }
          }
        }

        // Load user name
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: emp } = await supabase
            .from('employees')
            .select('name')
            .eq('user_id', user.id)
            .single()
          if (emp?.name) {
            setUserName(emp.name.split(' ')[0])
          }
        }
      } catch (e) {
        console.error('[ManagerAIChat] Error loading auth:', e)
      }
    }
    loadAuth()

    // Listen for auth changes
    let subscription: any
    ;(async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthToken(session?.access_token || null)
      })
      subscription = data.subscription
    })()
    return () => subscription?.unsubscribe()
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 200)
    }
  }, [isOpen])

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim()
    if (!text || isLoading) return

    setInput('')

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      // Get fresh token if needed
      let token = authToken
      if (!token) {
        const { supabase } = await import('@/lib/supabase')
        const { data: { session } } = await supabase.auth.refreshSession()
        token = session?.access_token || null
        if (token) setAuthToken(token)
      }
      if (!token) throw new Error('Não autorizado. Recarregue a página.')

      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }))

      const response = await fetch('/api/manager/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userMessage: text,
          conversationHistory
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar')
      }

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Erro: ${error.message || 'Não foi possível processar'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerate = (aiMsgId: string) => {
    const aiIndex = messages.findIndex(m => m.id === aiMsgId)
    if (aiIndex <= 0) return

    const userMsg = messages[aiIndex - 1]
    if (userMsg?.role !== 'user') return

    setMessages(prev => prev.filter(m => m.id !== aiMsgId))
    handleSend(userMsg.content)
  }

  // Strip visual tags for plain text copy
  const getPlainText = (content: string) => {
    return content.replace(/\{\{(NOTA|BARRA|SPIN|RANKING|TENDENCIA|COMPARAR):[^}]+\}\}/g, '').replace(/\n{3,}/g, '\n\n').trim()
  }

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(getPlainText(text))
    setCopiedId(msgId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-[60] transition-all hover:scale-110"
          title="Assistente da Equipe"
        >
          <Sparkles className="w-7 h-7 text-white" />
        </button>
      )}

      {/* Side panel */}
      {isOpen && (
        <div
          className="fixed top-0 right-0 h-screen w-full sm:w-[400px] bg-[#111b21] border-l border-[#222d34] z-[65] flex flex-col shadow-2xl"
          style={{ animation: 'slideInRight 0.2s ease-out' }}
        >
          {/* Header */}
          <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="text-[#e9edef] font-medium">Assistente da Equipe</span>
              <span className="text-[10px] bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded-full">IA</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-[#8696a0] hover:text-[#e9edef] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Sparkles className="w-10 h-10 text-purple-400/50 mx-auto mb-3" />
                <p className="text-[#8696a0] text-sm mb-1">Olá{userName ? ` ${userName}` : ''}! Sou o assistente da equipe.</p>
                <p className="text-[#8696a0] text-xs">Posso ajudar com análises de vendedores, comparações, coaching e tendências.</p>
              </div>
            )}

            {/* Messages */}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animation: 'msgFadeIn 0.3s ease-out' }}
              >
                <div className={`max-w-[95%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-[#005c4b] text-[#e9edef]'
                    : 'bg-[#202c33] text-[#e9edef]'
                }`}>
                  {msg.role === 'assistant'
                    ? <RichMessage content={msg.content} />
                    : <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  }

                  {/* Action buttons for AI messages */}
                  {msg.role === 'assistant' && !msg.content.startsWith('Erro:') && (
                    <div className="flex items-center gap-1 mt-2 pt-1 border-t border-white/10">
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        title="Copiar"
                      >
                        <Copy className={`w-3.5 h-3.5 ${copiedId === msg.id ? 'text-green-400' : 'text-[#8696a0]'}`} />
                      </button>
                      {copiedId === msg.id && (
                        <span className="text-[10px] text-green-400">Copiado!</span>
                      )}
                      <button
                        onClick={() => handleRegenerate(msg.id)}
                        className="p-1 rounded hover:bg-white/10 transition-colors text-[#8696a0]"
                        title="Gerar outra resposta"
                        disabled={isLoading}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start" style={{ animation: 'msgFadeIn 0.3s ease-out' }}>
                <div className="bg-[#202c33] rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-[#8696a0] text-sm">Analisando dados da equipe...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions */}
          {messages.length === 0 && !isLoading && (
            <div className="px-4 py-2 flex flex-wrap gap-2 shrink-0 border-t border-[#222d34]">
              {['Quem precisa de atenção?', 'Compare os vendedores', 'Média da equipe', 'Quem mais evoluiu?'].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="text-xs bg-[#202c33] text-purple-300 px-3 py-1.5 rounded-full hover:bg-[#2a3942] transition-colors border border-purple-500/20"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="px-4 py-3 bg-[#202c33] border-t border-[#222d34] shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre a equipe..."
                className="flex-1 bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 resize-none outline-none placeholder-[#8696a0] max-h-[100px] min-h-[40px]"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-full bg-purple-600 hover:bg-purple-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes msgFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
