'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Copy, Sparkles, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus, ArrowLeft, Mic } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_SUGGESTIONS = [
  'Quem precisa de atenção?',
  'Compare os vendedores',
  'Média da equipe',
  'Quem mais evoluiu?'
]

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
        <span className="font-bold" style={{ color: max === 100 ? getScoreColor(value / 10) : getScoreColor(value) }}>
          {max === 100 ? `${value.toFixed(0)}%` : `${value.toFixed(1)}/${max}`}
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: max === 100 ? getScoreColor(value / 10) : getScoreColor(value) }}
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

  return (
    <div className="my-2 p-2.5 bg-white/5 rounded-lg w-full">
      <div className="text-[10px] text-[#00a884] font-semibold uppercase tracking-wider mb-2">SPIN Selling</div>
      <div className="space-y-1.5">
        {entries.map(({ key, value }) => {
          const pct = Math.min((value / 10) * 100, 100)
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-4 text-xs font-bold text-[#00a884] text-center">{key}</span>
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
            <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] mt-[7px] shrink-0" />
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
            <span className="w-5 h-5 rounded-full bg-[#00a884]/20 text-[#00a884] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
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

    if (!trimmed) {
      flushBullets(`bl_${li}`)
      flushNumbered(`nl_${li}`)
      continue
    }

    if (/^[-–•]\s/.test(trimmed)) {
      flushNumbered(`nl_${li}`)
      bulletBuffer.push(trimmed.replace(/^[-–•]\s+/, ''))
      continue
    }

    const numMatch = trimmed.match(/^(\d+)[.\)]\s+(.+)/)
    if (numMatch) {
      flushBullets(`bl_${li}`)
      numberedBuffer.push({ num: numMatch[1], text: numMatch[2] })
      continue
    }

    flushBullets(`bl_${li}`)
    flushNumbered(`nl_${li}`)

    if (trimmed.endsWith(':') && trimmed.length < 100 && !trimmed.startsWith('Erro')) {
      elements.push(
        <div key={`hdr_${li}`} className="flex items-center gap-2 mt-3 mb-1">
          <div className="w-1 h-4 bg-[#00a884] rounded-full shrink-0" />
          <span className="text-[#00a884] text-[13px] font-semibold">{trimmed}</span>
        </div>
      )
      continue
    }

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

export default function ManagerAIChat({ onToggle }: { onToggle?: (open: boolean) => void } = {}) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleOpen = (open: boolean) => {
    setIsOpen(open)
    onToggle?.(open)
  }
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [revealingMsgId, setRevealingMsgId] = useState<string | null>(null)
  const [revealedChunks, setRevealedChunks] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Split text into word-based chunks for reveal (strips visual tags)
  const splitIntoChunks = (text: string): string[] => {
    const plainText = text.replace(/\{\{(NOTA|BARRA|SPIN|RANKING|TENDENCIA|COMPARAR):[^}]+\}\}/g, '')
    const chunks: string[] = []
    const lines = plainText.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const appendNewline = i < lines.length - 1

      if (line.trim() === '') {
        chunks.push('\n')
        continue
      }

      const words = line.split(/(\s+)/).filter(w => w.length > 0)
      for (let j = 0; j < words.length; j++) {
        if (/^\s+$/.test(words[j])) continue
        const trailing = j + 1 < words.length && /^\s+$/.test(words[j + 1]) ? words[j + 1] : ''
        chunks.push(words[j] + trailing)
      }

      if (appendNewline) chunks.push('\n')
    }

    return chunks
  }

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Phrase-by-phrase reveal
  useEffect(() => {
    if (messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role !== 'assistant' || lastMsg.id === revealingMsgId) return

    const chunks = splitIntoChunks(lastMsg.content)
    setRevealingMsgId(lastMsg.id)
    setRevealedChunks(0)

    let current = 0
    const revealNext = () => {
      current++
      setRevealedChunks(current)
      if (current < chunks.length) {
        const nextChunk = chunks[current]
        const delay = nextChunk === '\n' ? 150 : 30 + Math.random() * 25
        setTimeout(revealNext, delay)
      } else {
        setRevealingMsgId(null)
      }
    }

    const startTimeout = setTimeout(revealNext, 60)
    return () => clearTimeout(startTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // Auto-scroll
  useEffect(() => {
    if (lastUserMsgRef.current) {
      lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, revealedChunks])

  // Load auth token and user name
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')

        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          setAuthToken(session.access_token)
        } else {
          const { data: { session: refreshed } } = await supabase.auth.refreshSession()
          if (refreshed?.access_token) {
            setAuthToken(refreshed.access_token)
          } else {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: { session: retried } } = await supabase.auth.getSession()
              if (retried?.access_token) {
                setAuthToken(retried.access_token)
              }
            }
          }
        }

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

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 200)
    }
  }, [isOpen])

  // Voice recording
  const startRecording = async () => {
    try {
      setMicError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.start()
      setIsRecording(true)
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch {
      setMicError('Microfone não disponível')
    }
  }

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setIsRecording(false)
    setRecordingDuration(0)
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }

  const stopAndTranscribe = async () => {
    if (!mediaRecorderRef.current) return

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    setIsRecording(false)

    const recorder = mediaRecorderRef.current
    const audioBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(audioChunksRef.current, { type: recorder.mimeType }))
      }
      recorder.stop()
    })

    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null

    if (audioBlob.size === 0) return

    setIsTranscribing(true)

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'manager-voice.webm')

      const response = await fetch('/api/roleplay/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.text && data.isValid) {
        handleSend(data.text)
      } else if (data.text) {
        setInput(data.text)
      }
    } catch (err) {
      console.error('Transcription error:', err)
    } finally {
      setIsTranscribing(false)
      setRecordingDuration(0)
    }
  }

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

  const hasMessages = messages.length > 0

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => toggleOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-[#00a884] to-[#00d4aa] rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-[60] transition-all hover:scale-110"
          title="Assistente da Equipe"
        >
          <Sparkles className="w-7 h-7 text-white" />
        </button>
      )}

      {/* Side panel */}
      {isOpen && (
        <div className="fixed top-0 right-0 h-screen w-full sm:w-[400px] bg-[#111b21] z-[65] flex flex-col shadow-2xl animate-slide-in-right">
          {/* Neon glow line */}
          <div className="absolute left-0 top-0 h-[60px] w-px bg-[#222d34]" />
          <div className="absolute left-0 top-[60px] bottom-0 w-px bg-[#00a884]/30 z-10 pointer-events-none" style={{ boxShadow: '-4px 0 20px 2px rgba(0, 200, 150, 0.25), -2px 0 8px rgba(0, 255, 180, 0.15)' }} />

          {/* Header */}
          <div className="h-[60px] bg-[#202c33] px-4 flex items-center shrink-0 relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00a884]" />
                <span className="text-[#e9edef] text-sm font-medium">Assistente da Equipe</span>
                <span className="text-[9px] bg-[#00a884]/20 text-[#00a884] px-1.5 py-0.5 rounded-full">IA</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1 relative z-10">
              {hasMessages && (
                <button
                  onClick={() => {
                    setMessages([])
                    setInput('')
                    setRevealingMsgId(null)
                  }}
                  className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => toggleOpen(false)} className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors" title="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ============ INITIAL SCREEN ============ */}
          {!hasMessages && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="copilot-hero-icon mb-4">
                  <Sparkles className="w-12 h-12 text-[#00a884]" />
                </div>
                <h2 className="text-[#e9edef] text-xl font-semibold mb-1">Como posso ajudar?</h2>
                <p className="text-[#8696a0] text-xs text-center mb-6">
                  Analiso vendedores, comparo desempenhos e sugiro coaching.
                </p>

                {/* Input field */}
                <div className="w-full bg-[#202c33] rounded-xl border border-[#2a3942] px-3 py-2 mb-6">
                  {isRecording ? (
                    <div className="flex items-center gap-2 min-h-[36px]">
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-red-400 text-xs font-mono">
                        {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                      </span>
                      <span className="text-[#8696a0] text-xs">Gravando...</span>
                    </div>
                  ) : (
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isTranscribing ? 'Transcrevendo...' : 'Pergunte sobre a equipe...'}
                      className="w-full bg-transparent text-[#e9edef] text-sm resize-none outline-none placeholder-[#8696a0] max-h-[80px] min-h-[36px]"
                      rows={1}
                      disabled={isLoading || isTranscribing}
                    />
                  )}
                  <div className="flex items-center justify-end gap-2 mt-1">
                    {isRecording ? (
                      <>
                        <button onClick={cancelRecording} className="p-1.5 rounded-full text-red-400 hover:bg-[#2a3942] transition-colors" title="Cancelar">
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={stopAndTranscribe} className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] transition-colors" title="Enviar">
                          <Send className="w-3.5 h-3.5 text-white" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={startRecording} disabled={isLoading || isTranscribing} className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Gravar mensagem de voz">
                          <Mic className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          {isLoading || isTranscribing ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
                        </button>
                      </>
                    )}
                  </div>
                  {micError && <p className="text-red-400 text-[11px] mt-1">{micError}</p>}
                </div>

                {/* Quick suggestions as cards */}
                <div className="w-full space-y-2">
                  {QUICK_SUGGESTIONS.map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      disabled={isLoading}
                      className="w-full text-left px-4 py-3 bg-[#202c33] text-[#e9edef] text-sm rounded-xl border border-[#2a3942] hover:border-[#00a884]/40 hover:bg-[#182229] transition-all disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ CHAT SCREEN (Gemini-style) ============ */}
          {hasMessages && (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
                <div className="px-5 py-4 space-y-6 flex flex-col" style={{ minHeight: '100%' }}>
                {(() => {
                  const lastUserIdx = messages.reduce((last, m, i) => m.role === 'user' ? i : last, -1)
                  return messages.map((msg, msgIdx) => (
                  <div key={msg.id} className="copilot-msg-fade-in">
                    {/* User message */}
                    {msg.role === 'user' && (
                      <div ref={msgIdx === lastUserIdx ? lastUserMsgRef : undefined} className="flex justify-end">
                        <div className="max-w-[85%] bg-[#2a3942] text-[#e9edef] rounded-2xl rounded-br-md px-4 py-2.5">
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      </div>
                    )}

                    {/* AI message - Gemini style */}
                    {msg.role === 'assistant' && (() => {
                      const isRevealing = revealingMsgId === msg.id
                      const doneRevealing = !isRevealing

                      return (
                      <div className="flex gap-3 items-start">
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4aa] flex items-center justify-center flex-shrink-0 mt-0.5 ${isRevealing ? 'copilot-thinking-ring' : ''}`}>
                          <Sparkles className={`w-3.5 h-3.5 text-white ${isRevealing ? 'copilot-sparkle-thinking' : ''}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Rich content (shown after reveal) */}
                          <div className={isRevealing ? 'opacity-0 h-0 overflow-hidden' : ''}>
                            <RichMessage content={msg.content} />
                          </div>
                          {/* Plain text reveal overlay */}
                          {isRevealing && (() => {
                            const chunks = splitIntoChunks(msg.content)
                            const visibleCount = revealedChunks
                            return (
                              <div className="text-[#e9edef] text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {chunks.map((chunk, i) => (
                                  <span
                                    key={i}
                                    className={i >= visibleCount ? 'invisible' : 'copilot-chunk-reveal'}
                                  >{chunk === '\n' ? '\n' : chunk}</span>
                                ))}
                              </div>
                            )
                          })()}

                          {/* Action bar */}
                          {doneRevealing && !msg.content.startsWith('Erro:') && (
                            <div className="flex items-center gap-0.5 mt-3">
                              <button
                                onClick={() => handleRegenerate(msg.id)}
                                className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
                                title="Gerar outra resposta"
                                disabled={isLoading}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleCopy(msg.content, msg.id)}
                                className={`p-1.5 rounded-full transition-colors ${
                                  copiedId === msg.id ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
                                }`}
                                title="Copiar"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      )
                    })()}
                  </div>
                ))})()}

                {/* Loading */}
                {(isLoading || isTranscribing) && (
                  <div className="flex gap-3 items-start copilot-msg-fade-in">
                    <div className="copilot-thinking-ring w-7 h-7 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4aa] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-white copilot-sparkle-thinking" />
                    </div>
                    {isTranscribing && (
                      <span className="text-[#8696a0] text-xs self-center">Transcrevendo...</span>
                    )}
                  </div>
                )}

                <div className="flex-grow" />
                <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Quick suggestions - compact pills */}
              {!isLoading && (
                <div className="px-4 py-2 flex flex-wrap gap-1.5 shrink-0 border-t border-[#222d34]">
                  {QUICK_SUGGESTIONS.map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      className="text-xs text-[#8696a0] px-3 py-1.5 rounded-full hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors border border-[#2a3942]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {/* Input bar */}
              <div className="px-4 py-3 shrink-0">
                <div className="flex items-end gap-2 bg-[#202c33] rounded-2xl border border-[#2a3942] px-3 py-2">
                  {isRecording ? (
                    <>
                      <div className="flex items-center gap-2 flex-1 min-h-[36px]">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-red-400 text-xs font-mono">
                          {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                        </span>
                        <span className="text-[#8696a0] text-xs">Gravando...</span>
                      </div>
                      <button onClick={cancelRecording} className="p-1.5 rounded-full text-red-400 hover:bg-[#2a3942] transition-colors shrink-0" title="Cancelar">
                        <X className="w-4 h-4" />
                      </button>
                      <button onClick={stopAndTranscribe} className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] transition-colors shrink-0" title="Enviar">
                        <Send className="w-4 h-4 text-white" />
                      </button>
                    </>
                  ) : (
                    <>
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isTranscribing ? 'Transcrevendo...' : 'Pergunte sobre a equipe...'}
                        className="flex-1 bg-transparent text-[#e9edef] text-sm resize-none outline-none placeholder-[#8696a0] max-h-[100px] min-h-[36px]"
                        rows={1}
                        disabled={isLoading || isTranscribing}
                      />
                      <button onClick={startRecording} disabled={isLoading || isTranscribing} className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0" title="Gravar mensagem de voz">
                        <Mic className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0">
                        {isLoading || isTranscribing ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                      </button>
                    </>
                  )}
                </div>
                {micError && <p className="text-red-400 text-[11px] mt-1 px-1">{micError}</p>}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
