'use client'

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Send, Bot, User, Loader2, Plus, History, X } from 'lucide-react'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface ChatSession {
  session_id: string
  created_at: string
  message_count: number
  last_message: string
}

export interface ChatInterfaceHandle {
  requestLeave: () => Promise<boolean>
}

interface ChatInterfaceProps {
  onRequestLeave?: (callback: () => void) => void
}

const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(
  ({ onRequestLeave }, ref) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [showEndSessionModal, setShowEndSessionModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasUnsavedMessages = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Expor função para Dashboard verificar antes de sair
  useImperativeHandle(ref, () => ({
    requestLeave: () => {
      return new Promise<boolean>((resolve) => {
        if (messages.length > 0 && sessionId) {
          setPendingAction(() => () => {
            saveSessionToLocalStorage()
            console.log('💾 Sessão salva ao sair do Chat IA')
            resolve(true)
          })
          setShowEndSessionModal(true)
        } else {
          resolve(true)
        }
      })
    }
  }))

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Gerar session_id único quando o componente monta
  useEffect(() => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    setSessionId(newSessionId)
  }, [])

  // Marcar que há mensagens não salvas
  useEffect(() => {
    if (messages.length > 0) {
      hasUnsavedMessages.current = true
    }
  }, [messages])

  // Salvar sessão automaticamente quando o componente desmonta (usuário sai da aba)
  useEffect(() => {
    return () => {
      // Cleanup: salvar sessão atual se houver mensagens não salvas
      if (hasUnsavedMessages.current && messages.length > 0 && sessionId) {
        saveSessionToLocalStorage()
        console.log('💾 Sessão salva automaticamente ao sair do Chat IA')
      }
    }
  }, [messages, sessionId])

  const saveSessionToLocalStorage = () => {
    // Salvar no localStorage como backup (caso o usuário volte)
    try {
      localStorage.setItem(`chat_session_${sessionId}`, JSON.stringify({
        sessionId,
        messages,
        savedAt: new Date().toISOString()
      }))
    } catch (error) {
      console.error('Erro ao salvar sessão:', error)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const userInput = input
    setInput('')
    setIsLoading(true)

    try {
      // Buscar user_id
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id

      // Buscar resumo de performance do usuário
      let performanceSummary = null
      if (userId) {
        const { data: summaryData, error: summaryError } = await supabase
          .from('user_performance_summaries')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!summaryError && summaryData) {
          // Formatar pontos fortes
          const strengthsList = Array.isArray(summaryData.top_strengths)
            ? summaryData.top_strengths.map((s: any, i: number) => `${i + 1}. ${s.text} (${s.count}x)`).join('\n')
            : 'Nenhum ponto forte registrado ainda'

          // Formatar gaps críticos
          const gapsList = Array.isArray(summaryData.critical_gaps)
            ? summaryData.critical_gaps.map((g: any, i: number) => `${i + 1}. ${g.text} (${g.count}x)`).join('\n')
            : 'Nenhum gap crítico registrado ainda'

          // Formatar melhorias prioritárias
          const improvementsList = Array.isArray(summaryData.priority_improvements)
            ? summaryData.priority_improvements.map((imp: any, i: number) =>
                `${i + 1}. ${imp.area || imp.text || 'N/A'} - Prioridade: ${imp.priority || 'N/A'}`
              ).join('\n')
            : 'Nenhuma melhoria prioritária registrada ainda'

          // Criar template de texto formatado
          performanceSummary = `PERFIL DE PERFORMANCE DO USUÁRIO

Nome: ${summaryData.user_name}
Nota Média Geral: ${summaryData.overall_average}/10

NOTAS POR CATEGORIA SPIN:
- Situation (S): ${summaryData.spin_s_average}/10
- Problem (P): ${summaryData.spin_p_average}/10
- Implication (I): ${summaryData.spin_i_average}/10
- Need-Payoff (N): ${summaryData.spin_n_average}/10

PONTOS FORTES RECORRENTES:
${strengthsList}

GAPS CRÍTICOS RECORRENTES:
${gapsList}

MELHORIAS PRIORITÁRIAS:
${improvementsList}

Total de Sessões: ${summaryData.total_sessions}
Tendência: ${summaryData.trend || 'N/A'}`

          console.log('📊 Resumo de performance carregado:', performanceSummary)
        } else {
          console.log('⚠️ Nenhum resumo de performance encontrado para o usuário')
        }
      }

      // Chamar o agente N8N com session_id, user_id e performance summary
      const response = await fetch('https://ezboard.app.n8n.cloud/webhook/6ca93480-7567-4d51-914a-6f16fcf39bc8/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          chatInput: userInput,
          sessionId: sessionId,
          userId: userId,
          performanceSummary: performanceSummary
        })
      })

      if (!response.ok) {
        throw new Error('Erro ao enviar mensagem')
      }

      const data = await response.json()

      console.log('📥 Resposta do N8N:', JSON.stringify(data, null, 2))

      // Extrair resposta do agente (aceitar múltiplos formatos)
      let content = ''
      if (Array.isArray(data) && data.length > 0) {
        // Formato array: [{ output: "..." }]
        content = data[0].output || data[0].response || ''
      } else if (data.output) {
        // Formato objeto: { output: "..." }
        content = data.output
      } else if (data.response) {
        // Formato objeto: { response: "..." }
        content = data.response
      } else if (data.message?.content) {
        // Formato LangChain: { message: { content: "...", type: "ai" } }
        content = data.message.content
        console.log('✅ Extraído de message.content')
      } else if (typeof data === 'string') {
        // String direta
        content = data
      } else {
        // Tentar extrair qualquer chave que pareça ser a resposta
        const possibleKeys = Object.keys(data)
        console.log('🔍 Chaves disponíveis:', possibleKeys)

        // Ignorar chaves de metadados
        const ignoredKeys = ['id', 'session_id', 'created_at', 'user_id', 'message']

        // Tentar chaves comuns
        for (const key of possibleKeys) {
          if (!ignoredKeys.includes(key) && typeof data[key] === 'string' && data[key].length > 0) {
            content = data[key]
            console.log(`✅ Usando chave "${key}":`, content)
            break
          }
        }
      }

      if (!content) {
        content = 'Desculpe, não consegui processar sua mensagem.'
        console.error('❌ Formato de resposta inesperado:', JSON.stringify(data, null, 2))
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content,
        role: 'assistant',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewSession = () => {
    // Se há mensagens, mostrar popup de confirmação
    if (messages.length > 0 && sessionId) {
      setPendingAction(() => () => {
        saveSessionToLocalStorage()
        console.log('💾 Sessão finalizada ao criar nova sessão')
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        setSessionId(newSessionId)
        setMessages([])
        hasUnsavedMessages.current = false
      })
      setShowEndSessionModal(true)
    } else {
      // Se não há mensagens, criar sessão diretamente
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      setSessionId(newSessionId)
      setMessages([])
      hasUnsavedMessages.current = false
    }
  }

  const confirmEndSession = async () => {
    // Enviar session_id e user_id para o webhook
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id

      if (sessionId && userId) {
        console.log('📤 Enviando finalização de sessão para N8N:', { sessionId, userId })

        await fetch('https://ezboard.app.n8n.cloud/webhook/6b6ee058-e7f6-480f-ac0a-2ba409835c9a', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionId,
            userId: userId
          })
        })

        console.log('✅ Notificação de finalização enviada')
      }
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de finalização:', error)
    }

    // Executar ação pendente (salvar e mudar de sessão/view)
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
    setShowEndSessionModal(false)
  }

  const loadSessionHistory = async () => {
    setLoadingSessions(true)
    try {
      const { supabase } = await import('@/lib/supabase')

      // Buscar user_id atual
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id

      console.log('🔍 Buscando sessões do banco para usuário:', userId)

      // Buscar apenas sessões do usuário atual
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('session_id, created_at, message')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      console.log('📊 Resultado da query:', { data, error })

      if (error) {
        console.error('❌ Erro na query:', error)
        throw error
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ Nenhuma sessão encontrada no banco')
        setSessions([])
        return
      }

      console.log(`✅ Encontradas ${data.length} mensagens no total`)

      // Agrupar por session_id e contar mensagens
      const sessionsMap = new Map<string, ChatSession>()

      data?.forEach((row) => {
        if (!sessionsMap.has(row.session_id)) {
          // Primeira mensagem da sessão
          let lastMessage = ''
          try {
            const msg = row.message
            // Tentar diferentes formatos de mensagem
            if (msg?.data?.content) {
              lastMessage = msg.data.content
            } else if (msg?.content) {
              lastMessage = msg.content
            } else if (typeof msg === 'string') {
              lastMessage = msg
            }

            console.log('📝 Mensagem parseada:', { msg, lastMessage })
          } catch (e) {
            console.error('Erro ao parsear mensagem:', e)
            lastMessage = 'Mensagem não disponível'
          }

          sessionsMap.set(row.session_id, {
            session_id: row.session_id,
            created_at: row.created_at,
            message_count: 1,
            last_message: lastMessage
          })
        } else {
          // Incrementar contador de mensagens
          const session = sessionsMap.get(row.session_id)!
          session.message_count++
        }
      })

      const sessionsList = Array.from(sessionsMap.values())
      console.log(`✅ Agrupadas em ${sessionsList.length} sessões únicas`)
      setSessions(sessionsList)
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error)
    } finally {
      setLoadingSessions(false)
    }
  }

  const loadSession = async (selectedSessionId: string) => {
    // Fechar histórico
    setShowHistory(false)

    // Se há mensagens, mostrar popup de confirmação
    if (messages.length > 0 && sessionId) {
      setPendingAction(() => async () => {
        saveSessionToLocalStorage()
        console.log('💾 Sessão atual salva ao carregar outra sessão')
        await executeLoadSession(selectedSessionId)
      })
      setShowEndSessionModal(true)
    } else {
      await executeLoadSession(selectedSessionId)
    }
  }

  const executeLoadSession = async (selectedSessionId: string) => {
    try {

      const { supabase } = await import('@/lib/supabase')

      // Buscar todas as mensagens da sessão
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('message, created_at')
        .eq('session_id', selectedSessionId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Converter para formato Message
      const loadedMessages: Message[] = []
      data?.forEach((row, index) => {
        try {
          const msg = row.message
          let content = ''
          let role: 'user' | 'assistant' = 'assistant'

          // Tentar diferentes formatos
          if (msg?.data?.content) {
            content = msg.data.content
            role = msg.type === 'human' ? 'user' : 'assistant'
          } else if (msg?.content) {
            content = msg.content
            role = msg.type === 'human' ? 'user' : 'assistant'
          } else if (typeof msg === 'string') {
            content = msg
          }

          if (content) {
            loadedMessages.push({
              id: `${index}`,
              content,
              role,
              timestamp: new Date(row.created_at)
            })
          }

          console.log('📨 Mensagem carregada:', { msg, content, role })
        } catch (e) {
          console.error('Erro ao processar mensagem:', e)
        }
      })

      setMessages(loadedMessages)
      setSessionId(selectedSessionId)
      // Resetar flag pois esta é uma sessão existente (já salva no banco)
      hasUnsavedMessages.current = false
    } catch (error) {
      console.error('Erro ao carregar sessão:', error)
    }
  }

  return (
    <div className="min-h-screen py-20 px-6 relative z-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-400 rounded-2xl flex items-center justify-center">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Assistente de Vendas IA</h1>
                <p className="text-gray-400">Tire suas dúvidas sobre SPIN Selling, técnicas e psicologia de vendas</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowHistory(true)
                  loadSessionHistory()
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-medium hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/30"
              >
                <History className="w-5 h-5" />
                Histórico
              </button>
              <button
                onClick={handleNewSession}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-xl font-medium hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-green-500/30"
              >
                <Plus className="w-5 h-5" />
                Nova Sessão
              </button>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl border border-purple-500/30 overflow-hidden">
          {/* Messages Area */}
          <div className="h-[60vh] overflow-y-auto p-6 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white'
                      : 'bg-gray-800/50 border border-gray-700/50 text-gray-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  <p
                    className={`text-xs mt-2 ${
                      message.role === 'user'
                        ? 'text-purple-200/70'
                        : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {message.role === 'user' && (
                  <div className="w-10 h-10 bg-gray-700/50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-gray-300" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-400 rounded-xl flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    <span className="text-gray-400">Digitando...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-700/50 p-4 bg-gray-900/50">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Faça uma pergunta sobre vendas ou treinamento..."
                className="flex-1 resize-none rounded-xl border border-gray-700/50 bg-gray-800/50 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 shadow-lg shadow-purple-500/30"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal de Histórico */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-3xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl border border-blue-500/30 shadow-2xl">
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-blue-500/20 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <History className="w-7 h-7 text-blue-400" />
                    Histórico de Sessões
                  </h2>
                  <p className="text-gray-400 mt-1">Acesse suas conversas anteriores</p>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Fechar
                </button>
              </div>

              <div className="p-6 space-y-3">
                {loadingSessions ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" />
                    <p className="text-gray-400">Carregando histórico...</p>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Nenhuma sessão encontrada</p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.session_id}
                      onClick={() => loadSession(session.session_id)}
                      className="w-full text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-blue-500/50 rounded-2xl p-4 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="text-sm text-gray-400">
                              {new Date(session.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="text-xs text-gray-500">
                              {session.message_count} mensagens
                            </span>
                          </div>
                          <p className="text-gray-300 truncate group-hover:text-white transition-colors">
                            {session.last_message || 'Sem mensagens'}
                          </p>
                        </div>
                        <div className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          →
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Popup de Confirmação de Encerramento */}
        {showEndSessionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl border border-yellow-500/40 shadow-2xl p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-yellow-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Você está encerrando essa sessão
                </h3>
                <p className="text-gray-400 mb-8">
                  A conversa atual será salva no histórico
                </p>
                <button
                  onClick={confirmEndSession}
                  className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white text-lg font-semibold rounded-xl hover:scale-105 transition-all shadow-lg shadow-purple-500/30"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

ChatInterface.displayName = 'ChatInterface'

export default ChatInterface