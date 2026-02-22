'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, X, Send, Loader2 } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SellerAgentChatProps {
  userName?: string
}

const QUICK_SUGGESTIONS = [
  'Como está minha performance?',
  'Qual meu ponto mais fraco?',
  'Analise minha última reunião',
  'O que devo treinar hoje?',
  'Quais reuniões tenho essa semana?',
  'Quando estou livre amanhã?',
]

export default function SellerAgentChat({ userName }: SellerAgentChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClientComponentClient()

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
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sessão expirada. Por favor, recarregue a página.' }])
        return
      }

      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
    setMessages([])
    setInput('')
  }

  // Simple markdown-like rendering
  const renderContent = (content: string) => {
    const lines = content.split('\n')
    return lines.map((line, i) => {
      // Bold
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>')
      // List items
      if (processed.match(/^[-•]\s/)) {
        processed = `<span class="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-2 mt-2 flex-shrink-0"></span><span>${processed.slice(2)}</span>`
        return <div key={i} className="flex items-start ml-2 my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />
      }
      // Numbered lists
      if (processed.match(/^\d+\.\s/)) {
        return <div key={i} className="ml-2 my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />
      }
      // Empty line
      if (!processed.trim()) return <div key={i} className="h-2" />
      // Normal text
      return <div key={i} className="my-0.5" dangerouslySetInnerHTML={{ __html: processed }} />
    })
  }

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
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-[#0D4A3A] px-4 py-3 flex items-center justify-between flex-shrink-0">
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
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ maxHeight: '400px' }}>
            {messages.length === 0 ? (
              <div className="space-y-4">
                {/* Welcome */}
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <p className="text-sm text-gray-700">
                    Olá{userName ? `, ${userName.split(' ')[0]}` : ''}! Sou seu assistente pessoal de vendas. Tenho acesso a toda sua performance, reuniões, treinos e agenda. Como posso ajudar?
                  </p>
                </div>

                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-green-50 hover:text-green-700 text-gray-600 rounded-full transition-colors border border-gray-200 hover:border-green-200"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-[#0D4A3A] text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
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
              {QUICK_SUGGESTIONS.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="text-[10px] px-2 py-1 bg-gray-50 hover:bg-green-50 text-gray-500 hover:text-green-700 rounded-full transition-colors border border-gray-100 hover:border-green-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-2.5 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
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
