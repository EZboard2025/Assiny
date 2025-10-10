import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { aiAgent } from '../mcp/agent'
import type { MCPMessage, MCPContext } from '../mcp/types'

export function useChat(userId: string) {
  const [messages, setMessages] = useState<MCPMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<MCPContext | null>(null)

  // Carregar histórico de mensagens
  useEffect(() => {
    loadMessages()
    loadContext()
  }, [userId])

  const loadMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(50)

    if (data) {
      const formattedMessages: MCPMessage[] = data.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.message,
        timestamp: new Date(msg.created_at)
      }))
      setMessages(formattedMessages)
    }
  }

  const loadContext = async () => {
    // Buscar informações do usuário
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    // Buscar progresso
    const progress = await aiAgent.analyzePerformance(userId)

    if (userData) {
      setContext({
        userId,
        userName: userData.name || undefined,
        userRole: userData.role,
        conversationHistory: messages,
        userProgress: progress
      })
    }
  }

  const sendMessage = useCallback(async (content: string) => {
    if (!context) return

    setLoading(true)

    // Adicionar mensagem do usuário
    const userMessage: MCPMessage = {
      role: 'user',
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      // Processar com IA
      const response = await aiAgent.processMessage({
        message: content,
        context: {
          ...context,
          conversationHistory: [...messages, userMessage]
        }
      })

      // Adicionar resposta da IA
      const assistantMessage: MCPMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        metadata: response.metadata
      }
      setMessages(prev => [...prev, assistantMessage])

      return response
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [context, messages])

  return {
    messages,
    loading,
    sendMessage,
    context
  }
}