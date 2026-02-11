'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Copy, Brain, Loader2, RefreshCw } from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
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

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-[60] transition-all hover:scale-110"
          title="Assistente da Equipe"
        >
          <Brain className="w-7 h-7 text-white" />
        </button>
      )}

      {/* Side panel */}
      {isOpen && (
        <div
          className="fixed top-0 right-0 h-screen w-full sm:w-[400px] bg-white border-l border-gray-200 z-[65] flex flex-col shadow-2xl"
          style={{ animation: 'managerChatSlideIn 0.2s ease-out' }}
        >
          {/* Header */}
          <div className="h-[60px] bg-gradient-to-r from-green-600 to-emerald-600 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Assistente da Equipe</span>
              <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">IA</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {/* Initial greeting */}
            {messages.length === 0 && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-lg px-3 py-2 bg-white text-gray-800 border border-gray-200 shadow-sm">
                  <p className="text-sm">Olá{userName ? ` ${userName}` : ''}, como posso te ajudar?</p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>

                  {/* Action buttons for AI messages */}
                  {msg.role === 'assistant' && !msg.content.startsWith('Erro:') && (
                    <div className="flex items-center gap-1 mt-2 pt-1 border-t border-gray-100">
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title="Copiar"
                      >
                        <Copy className={`w-3.5 h-3.5 ${copiedId === msg.id ? 'text-green-500' : 'text-gray-400'}`} />
                      </button>
                      {copiedId === msg.id && (
                        <span className="text-[10px] text-green-500">Copiado!</span>
                      )}
                      <button
                        onClick={() => handleRegenerate(msg.id)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400"
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
              <div className="flex justify-start">
                <div className="bg-white rounded-lg px-3 py-2 flex items-center gap-2 border border-gray-200 shadow-sm">
                  <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
                  <span className="text-gray-500 text-sm">Analisando dados da equipe...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre a equipe..."
                className="flex-1 bg-gray-100 text-gray-800 text-sm rounded-lg px-3 py-2 resize-none outline-none placeholder-gray-400 max-h-[100px] min-h-[40px] focus:ring-2 focus:ring-green-500/30"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS animation */}
      <style jsx>{`
        @keyframes managerChatSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
