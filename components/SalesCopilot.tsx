'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Copy, ThumbsUp, ThumbsDown, Sparkles, Loader2, RefreshCw, ArrowLeft, Mic, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface WhatsAppConversation {
  id: string
  contact_phone: string
  contact_name: string | null
  profile_pic_url: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  message_count: number
}

interface WhatsAppMessage {
  id: string
  body: string
  fromMe: boolean
  timestamp: string
  type: string
  hasMedia: boolean
  mediaId?: string | null
  mimetype?: string | null
  contactName?: string | null
  status?: string
  transcription?: string | null
}

interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  feedbackId?: string
  timestamp: Date
}

interface SalesCopilotProps {
  selectedConversation: WhatsAppConversation | null
  messages: WhatsAppMessage[]
  authToken: string | null
  companyData: any | null
  isVisible: boolean
  isOpen: boolean
  onClose: () => void
  onSendToChat?: (text: string) => void
}

const QUICK_SUGGESTIONS = [
  'O que responder agora?',
  'Analise essa conversa',
  'Como fechar essa venda?',
  'Sugira um follow-up',
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

function TrendBadge({ trend }: { trend: string }) {
  const t = trend.trim().toLowerCase()
  if (t === 'quente' || t === 'melhorando') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 mx-1">
        <TrendingUp className="w-3 h-3" /> {t === 'quente' ? 'Lead Quente' : 'Melhorando'}
      </span>
    )
  }
  if (t === 'frio' || t === 'piorando') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 mx-1">
        <TrendingDown className="w-3 h-3" /> {t === 'frio' ? 'Lead Frio' : 'Piorando'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400 mx-1">
      <Minus className="w-3 h-3" /> {t === 'morno' ? 'Lead Morno' : 'Estável'}
    </span>
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
  const tagRegex = /\{\{(NOTA|BARRA|TENDENCIA):([^}]+)\}\}/g
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
      case 'TENDENCIA':
        parts.push(<TrendBadge key={key} trend={data} />)
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

// Extract only the client-ready message from the AI response
// Removes AI framing like "Sugestão de mensagem:" and strips surrounding quotes
function extractCleanMessage(text: string): string {
  // First strip visual tags
  const cleaned0 = text.replace(/\{\{(NOTA|BARRA|TENDENCIA):[^}]+\}\}/g, '').replace(/\n{3,}/g, '\n\n').trim()
  // Try to find the last quoted block (between " " or « »)
  const quoteMatches = cleaned0.match(/"([^"]+)"/g) || cleaned0.match(/«([^»]+)»/g) || cleaned0.match(/"([^"]+)"/g)
  if (quoteMatches && quoteMatches.length > 0) {
    // Take the longest quoted block (usually the actual message)
    const longest = quoteMatches
      .map(q => q.replace(/^["«"]|["»"]$/g, ''))
      .sort((a, b) => b.length - a.length)[0]
    if (longest && longest.length > 20) return longest
  }

  // No quotes found — strip common AI prefixes/labels
  let cleaned = cleaned0
    .replace(/^(sugest[ãa]o\s*(de\s*)?mensagem|mensagem\s*sugerida|resposta\s*sugerida|aqui\s*vai|tente\s*(algo\s*como|enviar|responder)|segue|minha\s*sugest[ãa]o)[^:]*:\s*/i, '')
    .replace(/^\*\*[^*]+\*\*\s*:?\s*/, '') // Remove **bold labels**:
    .trim()

  // Strip leading/trailing quotes if the whole thing is wrapped
  cleaned = cleaned.replace(/^["'""«]|["'""»]$/g, '').trim()

  return cleaned
}

export default function SalesCopilot({
  selectedConversation,
  messages,
  authToken,
  companyData,
  isVisible,
  isOpen,
  onClose,
  onSendToChat
}: SalesCopilotProps) {
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedbackStates, setFeedbackStates] = useState<Record<string, 'up' | 'down' | null>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sentMsgIds, setSentMsgIds] = useState<Set<string>>(new Set())
  const [revealingMsgId, setRevealingMsgId] = useState<string | null>(null)
  const [revealedChunks, setRevealedChunks] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevConvRef = useRef<string | null>(null)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Split text into word-based chunks for animated reveal (strips visual tags)
  const splitIntoChunks = (text: string): string[] => {
    const plainText = text.replace(/\{\{(NOTA|BARRA|TENDENCIA):[^}]+\}\}/g, '')
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

  // Reset copilot when conversation changes
  useEffect(() => {
    const currentPhone = selectedConversation?.contact_phone || null
    if (currentPhone !== prevConvRef.current) {
      prevConvRef.current = currentPhone
      // Cancel any in-progress recording
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      mediaRecorderRef.current = null
      setIsRecording(false)
      setRecordingDuration(0)
      setCopilotMessages([])
      setFeedbackStates({})
      setSentMsgIds(new Set())
      setInput('')
      setRevealingMsgId(null)
      setRevealedChunks(0)
    }
  }, [selectedConversation?.contact_phone])

  // Word-by-word reveal: animated fade-in during writing, then switch to rich design
  useEffect(() => {
    if (copilotMessages.length === 0) return
    const lastMsg = copilotMessages[copilotMessages.length - 1]
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
  }, [copilotMessages])

  // Auto-scroll: scroll last user message to top of viewport (Gemini behavior)
  useEffect(() => {
    if (lastUserMsgRef.current) {
      lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [copilotMessages, isLoading])

  // Periodic check for no-response messages (every 30 min)
  useEffect(() => {
    if (!authToken) return
    const check = () => {
      fetch('/api/copilot/check-no-response', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).catch(() => {})
    }
    check() // Run once on mount
    const interval = setInterval(check, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [authToken])

  // Periodic round evaluation (every 15 min)
  useEffect(() => {
    if (!authToken) return
    const evaluate = () => {
      fetch('/api/copilot/evaluate-rounds', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).catch(() => {})
    }
    evaluate()
    const interval = setInterval(evaluate, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [authToken])

  const formatConversationContext = (): string => {
    const now = new Date()
    const clientName = selectedConversation?.contact_name || 'Cliente'

    let selected = [...messages]
    if (selected.length > 30) {
      selected = [...selected.slice(0, 5), ...selected.slice(-25)]
    }

    const filtered = selected.filter(m => m.type !== 'reaction' && m.type !== 'e2e_notification')

    // Build conversation analysis header
    let analysis = `DATA E HORA ATUAL: ${now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`

    if (filtered.length > 0) {
      const lastMsg = filtered[filtered.length - 1]
      const lastMsgDate = new Date(lastMsg.timestamp)
      const diffMs = now.getTime() - lastMsgDate.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      const timeAgo = diffDays > 0 ? `${diffDays} dia(s)` : diffHours > 0 ? `${diffHours} hora(s)` : 'menos de 1 hora'

      analysis += `ULTIMA MENSAGEM: ${lastMsg.fromMe ? 'Vendedor' : clientName}, ha ${timeAgo}\n`

      // Check if seller is being ghosted
      const lastSellerIdx = [...filtered].reverse().findIndex(m => m.fromMe)
      const lastClientIdx = [...filtered].reverse().findIndex(m => !m.fromMe)

      if (lastSellerIdx !== -1 && (lastClientIdx === -1 || lastSellerIdx < lastClientIdx)) {
        // Seller sent last - client hasn't responded
        const sellerMsg = filtered[filtered.length - 1 - lastSellerIdx]
        const sellerMsgDate = new Date(sellerMsg.timestamp)
        const sellerDiffMs = now.getTime() - sellerMsgDate.getTime()
        const sellerDiffHours = Math.floor(sellerDiffMs / (1000 * 60 * 60))
        const sellerDiffDays = Math.floor(sellerDiffMs / (1000 * 60 * 60 * 24))

        if (sellerDiffHours > 2) {
          const vacuoTime = sellerDiffDays > 0 ? `${sellerDiffDays} dia(s)` : `${sellerDiffHours} hora(s)`
          analysis += `SITUACAO: CLIENTE NAO RESPONDEU a ultima mensagem do vendedor (ha ${vacuoTime}). O vendedor esta tentando retomar contato.\n`
        } else {
          analysis += `SITUACAO: Vendedor mandou a ultima mensagem (recente). Aguardando resposta do cliente.\n`
        }
      } else if (lastClientIdx !== -1 && (lastSellerIdx === -1 || lastClientIdx < lastSellerIdx)) {
        // Client sent last - seller needs to respond
        analysis += `SITUACAO: Cliente respondeu e aguarda resposta do vendedor (lead QUENTE).\n`
      }
    }

    // Format messages with dates
    const lines = filtered.map(m => {
      const sender = m.fromMe ? 'Vendedor' : clientName
      const msgDate = new Date(m.timestamp)
      const dateStr = msgDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const timeStr = msgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      let content = m.body
      if ((m.type === 'audio' || m.type === 'ptt') && m.transcription) {
        content = `[Áudio transcrito]: ${m.transcription}`
      } else if (!content && m.hasMedia) {
        const mediaLabels: Record<string, string> = {
          image: 'Imagem enviada', audio: 'Áudio', ptt: 'Áudio',
          video: 'Vídeo', document: 'Documento', sticker: 'Sticker'
        }
        content = `[${mediaLabels[m.type] || m.type}]`
      }
      if (!content) content = `[${m.type}]`
      return `[${dateStr} ${timeStr}] ${sender}: ${content}`
    })

    return analysis + '\n' + lines.join('\n')
  }

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim()
    if (!text || isLoading || !authToken || !selectedConversation) return

    setInput('')

    const userMsg: CopilotMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    }
    setCopilotMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const conversationContext = formatConversationContext()
      const copilotHistory = copilotMessages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }))

      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          userMessage: text,
          conversationContext,
          contactPhone: selectedConversation.contact_phone,
          contactName: selectedConversation.contact_name,
          copilotHistory
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Erro ao processar')
      }

      const aiMsg: CopilotMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.suggestion,
        feedbackId: data.feedbackId,
        timestamp: new Date()
      }
      setCopilotMessages(prev => [...prev, aiMsg])
    } catch (error: any) {
      const errorMsg: CopilotMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Erro: ${error.message || 'Não foi possível gerar sugestão'}`,
        timestamp: new Date()
      }
      setCopilotMessages(prev => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFeedback = async (feedbackId: string, wasHelpful: boolean) => {
    if (!authToken || !feedbackId) return

    setFeedbackStates(prev => ({ ...prev, [feedbackId]: wasHelpful ? 'up' : 'down' }))

    try {
      await fetch('/api/copilot/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ feedbackId, wasHelpful })
      })
    } catch (err) {
      console.error('Feedback error:', err)
    }
  }

  const getPlainText = (content: string) => {
    return content.replace(/\{\{(NOTA|BARRA|TENDENCIA):[^}]+\}\}/g, '').replace(/\n{3,}/g, '\n\n').trim()
  }

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(getPlainText(text))
    setCopiedId(msgId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRegenerate = (aiMsgId: string) => {
    // Find the user message that came before this AI message
    const aiIndex = copilotMessages.findIndex(m => m.id === aiMsgId)
    if (aiIndex <= 0) return

    const userMsg = copilotMessages[aiIndex - 1]
    if (userMsg?.role !== 'user') return

    // Remove the AI message and resend the user question
    setCopilotMessages(prev => prev.filter(m => m.id !== aiMsgId))
    handleSend(userMsg.content)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Voice recording functions
  const startRecording = async () => {
    try {
      // Check if mediaDevices API is available (requires secure context)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicError('Microfone requer HTTPS ou localhost')
        setTimeout(() => setMicError(null), 4000)
        return
      }

      // Enumerate devices to diagnose issues
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      console.log('[Copilot Mic] Audio inputs found:', audioInputs.length, audioInputs.map(d => ({ label: d.label, id: d.deviceId })))

      if (audioInputs.length === 0) {
        setMicError('Nenhum microfone detectado pelo navegador')
        setTimeout(() => setMicError(null), 4000)
        return
      }

      // If devices exist but have no label, permission hasn't been granted yet - that's OK, getUserMedia will prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
        audioBitsPerSecond: 32000
      })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.start(100)
      setIsRecording(true)
      setRecordingDuration(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error('Mic error:', err)
      const msg = err?.name === 'NotFoundError'
        ? 'Microfone não encontrado'
        : err?.name === 'NotAllowedError'
          ? 'Permissão de microfone negada'
          : 'Erro ao acessar microfone'
      setMicError(msg)
      setTimeout(() => setMicError(null), 3000)
    }
  }

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    setIsRecording(false)
    setRecordingDuration(0)
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
      formData.append('audio', audioBlob, 'copilot-voice.webm')

      if (companyData?.company_id) {
        formData.append('companyId', companyData.company_id)
      }

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

  if (!isVisible || !isOpen) return null

  const hasMessages = copilotMessages.length > 0

  return (
      <div className="h-full w-[400px] min-w-[400px] bg-[#111b21] flex flex-col shrink-0 relative">
        {/* Header border — neutral */}
        <div className="absolute left-0 top-0 h-[60px] w-px bg-[#222d34]" />
        {/* Neon glow line — only below header */}
        <div className="absolute left-0 top-[60px] bottom-0 w-px bg-[#00a884]/30 z-10 pointer-events-none" style={{ boxShadow: '-4px 0 20px 2px rgba(0, 200, 150, 0.25), -2px 0 8px rgba(0, 255, 180, 0.15)' }} />
        {/* Header - minimal */}
        <div className="h-[60px] bg-[#202c33] px-4 flex items-center shrink-0 relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00a884]" />
              <span className="text-[#e9edef] text-sm font-medium">Copiloto de Vendas</span>
              <span className="text-[9px] bg-[#00a884]/20 text-[#00a884] px-1.5 py-0.5 rounded-full">IA</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1 relative z-10">
            {hasMessages && (
              <button
                onClick={() => {
                  setCopilotMessages([])
                  setFeedbackStates({})
                  setSentMsgIds(new Set())
                  setInput('')
                }}
                className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors" title="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============ INITIAL SCREEN (no messages) ============ */}
        {!hasMessages && (
          <div className="flex-1 flex flex-col">
            {/* Centered hero section */}
            <div className="flex-1 flex flex-col items-center justify-center px-6">
              <div className="copilot-hero-icon mb-4">
                <Sparkles className="w-12 h-12 text-[#00a884]" />
              </div>
              <h2 className="text-[#e9edef] text-xl font-semibold mb-1">Como posso ajudar?</h2>
              <p className="text-[#8696a0] text-xs text-center mb-6">
                Analiso conversas, sugiro respostas e ajudo a fechar vendas.
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
                    placeholder={isTranscribing ? 'Transcrevendo...' : 'Pergunte ao copiloto...'}
                    className="w-full bg-transparent text-[#e9edef] text-sm resize-none outline-none placeholder-[#8696a0] max-h-[80px] min-h-[36px]"
                    rows={1}
                    disabled={isLoading || isTranscribing}
                  />
                )}
                <div className="flex items-center justify-end gap-2 mt-1">
                  {isRecording ? (
                    <>
                      <button
                        onClick={cancelRecording}
                        className="p-1.5 rounded-full text-red-400 hover:bg-[#2a3942] transition-colors"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={stopAndTranscribe}
                        className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] transition-colors"
                        title="Enviar"
                      >
                        <Send className="w-3.5 h-3.5 text-white" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={startRecording}
                        disabled={isLoading || isTranscribing}
                        className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Gravar mensagem de voz"
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        {isLoading || isTranscribing ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
                      </button>
                    </>
                  )}
                </div>
                {micError && (
                  <p className="text-red-400 text-[11px] mt-1">{micError}</p>
                )}
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

            {/* Context indicator at bottom */}
            {selectedConversation && (
              <div className="px-4 py-2 border-t border-[#222d34] shrink-0">
                <p className="text-[#8696a0] text-[11px] text-center">
                  Analisando conversa com{' '}
                  <span className="text-[#e9edef]">
                    {selectedConversation.contact_name || selectedConversation.contact_phone}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============ CHAT SCREEN (Gemini-style) ============ */}
        {hasMessages && (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
              <div className="px-5 py-4 space-y-6 flex flex-col" style={{ minHeight: '100%' }}>
              {(() => {
                const lastUserIdx = copilotMessages.reduce((last, m, i) => m.role === 'user' ? i : last, -1)
                return copilotMessages.map((msg, msgIdx) => (
                <div key={msg.id} className="copilot-msg-fade-in">
                  {/* User message - subtle bubble on the right */}
                  {msg.role === 'user' && (
                    <div ref={msgIdx === lastUserIdx ? lastUserMsgRef : undefined} className="flex justify-end">
                      <div className="max-w-[85%] bg-[#2a3942] text-[#e9edef] rounded-2xl rounded-br-md px-4 py-2.5">
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  )}

                  {/* AI message - Gemini style: icon + flowing text, no bubble */}
                  {msg.role === 'assistant' && (() => {
                    const isRevealing = revealingMsgId === msg.id
                    const doneRevealing = !isRevealing
                    const chunks = splitIntoChunks(msg.content)
                    const visibleCount = isRevealing ? revealedChunks : chunks.length

                    return (
                    <div className="flex gap-3 items-start">
                      {/* Sparkle icon - animated ring while revealing */}
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4aa] flex items-center justify-center flex-shrink-0 mt-0.5 ${isRevealing ? 'copilot-thinking-ring' : ''}`}>
                        <Sparkles className={`w-3.5 h-3.5 text-white ${isRevealing ? 'copilot-sparkle-thinking' : ''}`} />
                      </div>

                      {/* Animated word-by-word during reveal, rich design after */}
                      <div className="flex-1 min-w-0">
                        {doneRevealing ? (
                          <RichMessage content={msg.content} />
                        ) : (
                          <div className="text-[#e9edef] text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {chunks.map((chunk, i) => (
                              <span
                                key={i}
                                className={
                                  i >= visibleCount
                                    ? 'invisible'
                                    : 'copilot-chunk-reveal'
                                }
                              >{chunk === '\n' ? '\n' : chunk}</span>
                            ))}
                          </div>
                        )}

                        {/* Action bar - Gemini style icons row (only after reveal completes) */}
                        {doneRevealing && !msg.content.startsWith('Erro:') && (
                          <div className="flex items-center gap-0.5 mt-3">
                            {/* Send to chat */}
                            {onSendToChat && (
                              <button
                                onClick={() => {
                                  onSendToChat(extractCleanMessage(msg.content))
                                  setSentMsgIds(prev => new Set(prev).add(msg.id))
                                }}
                                disabled={sentMsgIds.has(msg.id)}
                                className={`p-1.5 rounded-full transition-colors ${
                                  sentMsgIds.has(msg.id)
                                    ? 'text-[#00a884]'
                                    : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
                                }`}
                                title={sentMsgIds.has(msg.id) ? 'Enviado!' : 'Enviar para o chat'}
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            {/* Thumbs up */}
                            {msg.feedbackId && (
                              <button
                                onClick={() => handleFeedback(msg.feedbackId!, true)}
                                className={`p-1.5 rounded-full transition-colors ${
                                  feedbackStates[msg.feedbackId!] === 'up' ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
                                }`}
                                title="Útil"
                                disabled={!!feedbackStates[msg.feedbackId!]}
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                            )}
                            {/* Thumbs down */}
                            {msg.feedbackId && (
                              <button
                                onClick={() => handleFeedback(msg.feedbackId!, false)}
                                className={`p-1.5 rounded-full transition-colors ${
                                  feedbackStates[msg.feedbackId!] === 'down' ? 'text-red-400' : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'
                                }`}
                                title="Não útil"
                                disabled={!!feedbackStates[msg.feedbackId!]}
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                            )}
                            {/* Regenerate */}
                            <button
                              onClick={() => handleRegenerate(msg.id)}
                              className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition-colors"
                              title="Gerar outra sugestão"
                              disabled={isLoading}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            {/* Copy */}
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

              {/* Loading - sparkle icon with spinning ring */}
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

              {/* Spacer - fills remaining viewport so user message can scroll to top */}
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

            {/* Input bar - clean minimal style */}
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
                    <button
                      onClick={cancelRecording}
                      className="p-1.5 rounded-full text-red-400 hover:bg-[#2a3942] transition-colors shrink-0"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={stopAndTranscribe}
                      className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] transition-colors shrink-0"
                      title="Enviar"
                    >
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
                      placeholder={isTranscribing ? 'Transcrevendo...' : 'Pergunte ao copiloto...'}
                      className="flex-1 bg-transparent text-[#e9edef] text-sm resize-none outline-none placeholder-[#8696a0] max-h-[100px] min-h-[36px]"
                      rows={1}
                      disabled={isLoading || isTranscribing}
                    />
                    <button
                      onClick={startRecording}
                      disabled={isLoading || isTranscribing}
                      className="p-1.5 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                      title="Gravar mensagem de voz"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      {isLoading || isTranscribing ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                    </button>
                  </>
                )}
              </div>
              {micError && (
                <p className="text-red-400 text-[11px] mt-1 px-1">{micError}</p>
              )}
            </div>
          </>
        )}
      </div>
  )
}
