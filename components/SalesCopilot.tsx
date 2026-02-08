'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Copy, ThumbsUp, ThumbsDown, Sparkles, Loader2 } from 'lucide-react'

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
}

const QUICK_SUGGESTIONS = [
  'O que responder agora?',
  'Analise essa conversa',
  'Como fechar essa venda?',
  'Sugira um follow-up',
]

export default function SalesCopilot({
  selectedConversation,
  messages,
  authToken,
  companyData,
  isVisible
}: SalesCopilotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedbackStates, setFeedbackStates] = useState<Record<string, 'up' | 'down' | null>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevConvRef = useRef<string | null>(null)

  // Reset copilot when conversation changes
  useEffect(() => {
    const currentPhone = selectedConversation?.contact_phone || null
    if (currentPhone !== prevConvRef.current) {
      prevConvRef.current = currentPhone
      setCopilotMessages([])
      setFeedbackStates({})
      setInput('')
    }
  }, [selectedConversation?.contact_phone])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [copilotMessages])

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
    let selected = [...messages]
    if (selected.length > 30) {
      selected = [...selected.slice(0, 5), ...selected.slice(-25)]
    }
    return selected
      .filter(m => m.type !== 'reaction' && m.type !== 'e2e_notification')
      .map(m => {
        const sender = m.fromMe ? 'Vendedor' : (selectedConversation?.contact_name || 'Cliente')
        const time = new Date(m.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        let content = m.body
        if (!content && m.hasMedia) {
          const mediaLabels: Record<string, string> = {
            image: 'Imagem enviada', audio: 'Áudio', ptt: 'Áudio',
            video: 'Vídeo', document: 'Documento', sticker: 'Sticker'
          }
          content = `[${mediaLabels[m.type] || m.type}]`
        }
        if (!content) content = `[${m.type}]`
        return `[${time}] ${sender}: ${content}`
      })
      .join('\n')
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isVisible) return null

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-[60] transition-all hover:scale-110"
          title="Copiloto de Vendas"
        >
          <Sparkles className="w-7 h-7 text-white" />
        </button>
      )}

      {/* Side panel */}
      {isOpen && (
        <div className="fixed top-0 right-0 h-screen w-full sm:w-[400px] bg-[#111b21] border-l border-[#222d34] z-[65] flex flex-col shadow-2xl"
          style={{ animation: 'slideInRight 0.2s ease-out' }}
        >
          {/* Header */}
          <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="text-[#e9edef] font-medium">Copiloto de Vendas</span>
              <span className="text-[10px] bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded-full">IA</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-[#8696a0] hover:text-[#e9edef] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Context indicator */}
          {selectedConversation && (
            <div className="px-4 py-2 bg-[#182229] border-b border-[#222d34] shrink-0">
              <p className="text-[#8696a0] text-xs">
                Analisando conversa com{' '}
                <span className="text-[#e9edef]">
                  {selectedConversation.contact_name || selectedConversation.contact_phone}
                </span>
                <span className="text-[#8696a0]"> ({messages.length} msgs)</span>
              </p>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* Welcome message */}
            {copilotMessages.length === 0 && (
              <div className="text-center py-8">
                <Sparkles className="w-10 h-10 text-purple-400/50 mx-auto mb-3" />
                <p className="text-[#8696a0] text-sm mb-1">Olá! Sou seu copiloto de vendas.</p>
                <p className="text-[#8696a0] text-xs">Posso ajudar a responder clientes, analisar conversas e sugerir estratégias.</p>
              </div>
            )}

            {/* Messages */}
            {copilotMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-[#005c4b] text-[#e9edef]'
                    : 'bg-[#202c33] text-[#e9edef]'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>

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

                      {msg.feedbackId && (
                        <>
                          <div className="w-px h-3 bg-white/10 mx-1" />
                          <button
                            onClick={() => handleFeedback(msg.feedbackId!, true)}
                            className={`p-1 rounded hover:bg-white/10 transition-colors ${
                              feedbackStates[msg.feedbackId] === 'up' ? 'text-green-400' : 'text-[#8696a0]'
                            }`}
                            title="Útil"
                            disabled={!!feedbackStates[msg.feedbackId]}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.feedbackId!, false)}
                            className={`p-1 rounded hover:bg-white/10 transition-colors ${
                              feedbackStates[msg.feedbackId] === 'down' ? 'text-red-400' : 'text-[#8696a0]'
                            }`}
                            title="Não útil"
                            disabled={!!feedbackStates[msg.feedbackId]}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#202c33] rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-[#8696a0] text-sm">Pensando...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions */}
          {copilotMessages.length === 0 && !isLoading && (
            <div className="px-4 py-2 flex flex-wrap gap-2 shrink-0 border-t border-[#222d34]">
              {QUICK_SUGGESTIONS.map(suggestion => (
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
                placeholder="Pergunte ao copiloto..."
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

      {/* CSS animation */}
      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
