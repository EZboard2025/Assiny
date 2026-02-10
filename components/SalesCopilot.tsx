'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Copy, ThumbsUp, ThumbsDown, Sparkles, Loader2, RefreshCw, ArrowLeft, MoreVertical } from 'lucide-react'

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

// Extract only the client-ready message from the AI response
// Removes AI framing like "Sugestão de mensagem:" and strips surrounding quotes
function extractCleanMessage(text: string): string {
  // Try to find the last quoted block (between " " or « »)
  const quoteMatches = text.match(/"([^"]+)"/g) || text.match(/«([^»]+)»/g) || text.match(/"([^"]+)"/g)
  if (quoteMatches && quoteMatches.length > 0) {
    // Take the longest quoted block (usually the actual message)
    const longest = quoteMatches
      .map(q => q.replace(/^["«"]|["»"]$/g, ''))
      .sort((a, b) => b.length - a.length)[0]
    if (longest && longest.length > 20) return longest
  }

  // No quotes found — strip common AI prefixes/labels
  let cleaned = text
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevConvRef = useRef<string | null>(null)

  // Split text into line-based chunks for Gemini-style reveal
  const splitIntoChunks = (text: string): string[] => {
    // Split by double newlines (paragraphs) or single newlines (lines)
    return text.split(/\n/).map((line, i, arr) => {
      // Preserve empty lines as newlines
      if (line.trim() === '') return '\n'
      return line + (i < arr.length - 1 ? '\n' : '')
    })
  }

  // Reset copilot when conversation changes
  useEffect(() => {
    const currentPhone = selectedConversation?.contact_phone || null
    if (currentPhone !== prevConvRef.current) {
      prevConvRef.current = currentPhone
      setCopilotMessages([])
      setFeedbackStates({})
      setSentMsgIds(new Set())
      setInput('')
      setRevealingMsgId(null)
      setRevealedChunks(0)
    }
  }, [selectedConversation?.contact_phone])

  // Phrase-by-phrase reveal: when a new AI message appears, reveal chunks progressively
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
        // Skip empty newline chunks instantly, pause on real lines
        const nextChunk = chunks[current]
        const delay = nextChunk === '\n' ? 80 : 500 + Math.random() * 200
        setTimeout(revealNext, delay)
      } else {
        setRevealingMsgId(null)
      }
    }

    const startTimeout = setTimeout(revealNext, 100)
    return () => clearTimeout(startTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copilotMessages])

  // Auto-scroll during reveal
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [copilotMessages, revealedChunks])

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

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text)
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

  if (!isVisible || !isOpen) return null

  const hasMessages = copilotMessages.length > 0

  return (
      <div className="h-full w-[400px] min-w-[400px] bg-[#111b21] border-l border-[#222d34] flex flex-col shrink-0">
        {/* Header - minimal */}
        <div className="h-[50px] bg-[#202c33] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00a884]" />
            <span className="text-[#e9edef] text-sm font-medium">Copiloto de Vendas</span>
            <span className="text-[9px] bg-[#00a884]/20 text-[#00a884] px-1.5 py-0.5 rounded-full">IA</span>
          </div>
          <div className="flex items-center gap-1">
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
              <Sparkles className="w-10 h-10 text-[#00a884] mb-4" />
              <h2 className="text-[#e9edef] text-xl font-semibold mb-1">Como posso ajudar?</h2>
              <p className="text-[#8696a0] text-xs text-center mb-6">
                Analiso conversas, sugiro respostas e ajudo a fechar vendas.
              </p>

              {/* Input field */}
              <div className="w-full bg-[#202c33] rounded-xl border border-[#2a3942] px-3 py-2 mb-6">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte ao copiloto..."
                  className="w-full bg-transparent text-[#e9edef] text-sm resize-none outline-none placeholder-[#8696a0] max-h-[80px] min-h-[36px]"
                  rows={1}
                  disabled={isLoading}
                />
                <div className="flex items-center justify-end mt-1">
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
                  </button>
                </div>
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
                  {' '}({messages.length} msgs)
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============ CHAT SCREEN (Gemini-style) ============ */}
        {hasMessages && (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {copilotMessages.map(msg => (
                <div key={msg.id} className="copilot-msg-fade-in">
                  {/* User message - subtle bubble on the right */}
                  {msg.role === 'user' && (
                    <div className="flex justify-end">
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

                      {/* Message content - chunks fade in one by one */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[#e9edef] text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {chunks.slice(0, visibleCount).map((chunk, i) => (
                            <span
                              key={i}
                              className={isRevealing && i === visibleCount - 1 ? 'copilot-chunk-reveal' : ''}
                            >{chunk === '\n' ? '\n' : chunk}</span>
                          ))}
                        </div>

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
              ))}

              {/* Loading indicator - Gemini style with spinning ring */}
              {isLoading && (
                <div className="flex gap-3 items-start copilot-msg-fade-in">
                  <div className="copilot-thinking-ring w-7 h-7 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4aa] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-white copilot-sparkle-thinking" />
                  </div>
                  <div className="flex items-center pt-1">
                    <span className="text-[#8696a0] text-sm">Pensando...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
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
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte ao copiloto..."
                  className="flex-1 bg-transparent text-[#e9edef] text-sm resize-none outline-none placeholder-[#8696a0] max-h-[100px] min-h-[36px]"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="p-1.5 rounded-full bg-[#00a884] hover:bg-[#00917a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
  )
}
