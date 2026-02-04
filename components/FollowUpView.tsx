'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, AlertCircle, X, FileText, Lightbulb, BarChart3, MessageSquare, RefreshCw, LogOut, Smartphone, QrCode, Search, ChevronRight, ChevronLeft } from 'lucide-react'

interface FollowUpAnalysis {
  notas: {
    valor_agregado: {
      nota: number
      peso: number
      comentario: string
    }
    personalizacao: {
      nota: number
      peso: number
      comentario: string
    }
    tom_consultivo: {
      nota: number
      peso: number
      comentario: string
    }
    objetividade: {
      nota: number
      peso: number
      comentario: string
    }
    cta: {
      nota: number
      peso: number
      comentario: string
    }
    timing: {
      nota: number
      peso: number
      comentario: string
    }
  }
  nota_final: number
  classificacao: string
  pontos_positivos: string[]
  pontos_melhorar: Array<{
    problema: string
    como_resolver: string
  }>
  versao_reescrita: string
  dica_principal: string
}

interface WhatsAppChat {
  id: string
  name: string
  lastMessage: string
  lastMessageTime: string | null
  unreadCount: number
}

interface WhatsAppMessage {
  id: string
  body: string
  fromMe: boolean
  timestamp: string
  type: string
  hasMedia: boolean
}

type ConnectionStatus = 'disconnected' | 'qr' | 'connecting' | 'connected'

export default function FollowUpView() {
  // WhatsApp state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [chats, setChats] = useState<WhatsAppChat[]>([])
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<FollowUpAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAnalyses, setSavedAnalyses] = useState<Record<string, { analysis: FollowUpAnalysis; date: string }>>({})
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false)

  // Load saved analyses from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('whatsapp_followup_analyses')
    if (saved) {
      try {
        setSavedAnalyses(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading saved analyses:', e)
      }
    }
  }, [])

  // Company data state
  const [companyData, setCompanyData] = useState<any>(null)

  // Load company data on mount
  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')

        const companyId = await getCompanyId()
        if (!companyId) {
          console.warn('company_id not found')
          return
        }

        const { data, error } = await supabase
          .from('company_data')
          .select('*')
          .eq('company_id', companyId)
          .single()

        if (data && !error) {
          setCompanyData(data)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadCompanyData()
    checkConnectionStatus()
  }, [])

  // Poll for connection status
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (connectionStatus === 'qr' || connectionStatus === 'connecting') {
      interval = setInterval(checkConnectionStatus, 2000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [connectionStatus])

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp-web/status')
      const data = await response.json()

      setConnectionStatus(data.status)
      if (data.qrCode) {
        setQrCode(data.qrCode)
      }

      if (data.status === 'connected' && chats.length === 0) {
        loadChats()
      }
    } catch (error) {
      console.error('Error checking status:', error)
    }
  }

  const initWhatsApp = async () => {
    setIsInitializing(true)
    setError(null)

    try {
      const response = await fetch('/api/whatsapp-web/init', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error initializing WhatsApp')
      }

      if (data.qrCode) {
        setQrCode(data.qrCode)
        setConnectionStatus('qr')
      } else if (data.status === 'connected') {
        setConnectionStatus('connected')
        loadChats()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection error')
    } finally {
      setIsInitializing(false)
    }
  }

  const disconnectWhatsApp = async () => {
    try {
      await fetch('/api/whatsapp-web/disconnect', { method: 'POST' })
      setConnectionStatus('disconnected')
      setQrCode(null)
      setChats([])
      setSelectedChat(null)
    } catch (error) {
      console.error('Error disconnecting:', error)
    }
  }

  const loadChats = async () => {
    setIsLoadingChats(true)
    try {
      const response = await fetch('/api/whatsapp-web/chats')
      const data = await response.json()

      if (data.chats) {
        setChats(data.chats)
      }
    } catch (error) {
      console.error('Error loading chats:', error)
    } finally {
      setIsLoadingChats(false)
    }
  }

  const loadMessages = async (chatId: string) => {
    setIsLoadingMessages(true)
    setMessages([])
    try {
      const response = await fetch(`/api/whatsapp-web/messages?chatId=${encodeURIComponent(chatId)}`)
      const data = await response.json()

      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const selectChat = (chat: WhatsAppChat) => {
    setSelectedChat(chat)
    setError(null)

    // Check if there's a saved analysis for this chat
    const saved = savedAnalyses[chat.id]
    if (saved) {
      setAnalysis(saved.analysis)
      setShowAnalysisPanel(false) // Don't auto-open, let user click the card
    } else {
      setAnalysis(null)
      setShowAnalysisPanel(false)
    }

    loadMessages(chat.id)
  }

  const handleAnalyze = async () => {
    if (!selectedChat) {
      setError('Select a conversation')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const messagesResponse = await fetch(
        `/api/whatsapp-web/messages?chatId=${encodeURIComponent(selectedChat.id)}&format=analysis`
      )
      const messagesData = await messagesResponse.json()

      if (!messagesResponse.ok) {
        throw new Error(messagesData.error || 'Error fetching messages')
      }

      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()

      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/followup/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transcricao: messagesData.formatted,
          avaliacao: {
            canal: 'WhatsApp'
          },
          dados_empresa: companyData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error analyzing follow-up')
      }

      setAnalysis(data.analysis)
      setShowAnalysisPanel(true) // Auto-open panel when new analysis completes

      // Save analysis to localStorage
      if (selectedChat && data.analysis) {
        const newSavedAnalyses = {
          ...savedAnalyses,
          [selectedChat.id]: {
            analysis: data.analysis,
            date: new Date().toISOString()
          }
        }
        setSavedAnalyses(newSavedAnalyses)
        localStorage.setItem('whatsapp_followup_analyses', JSON.stringify(newSavedAnalyses))
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Error analyzing follow-up')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Format time for chat list
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Ontem'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    }
  }

  // Filter chats by search
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Render disconnected state
  const renderDisconnected = () => (
    <div className="flex-1 flex items-center justify-center bg-[#222e35]">
      <div className="text-center max-w-md px-8">
        <div className="w-[320px] h-[320px] mx-auto mb-8 flex items-center justify-center">
          <Smartphone className="w-40 h-40 text-[#8696a0]" />
        </div>
        <h1 className="text-[32px] font-light text-[#e9edef] mb-4">
          Análise de Follow-up
        </h1>
        <p className="text-[#8696a0] text-sm mb-8">
          Conecte seu WhatsApp para analisar suas conversas de follow-up automaticamente.
          Selecione uma conversa e receba feedback detalhado em segundos.
        </p>
        <button
          onClick={initWhatsApp}
          disabled={isInitializing}
          className="bg-[#00a884] hover:bg-[#06cf9c] text-white px-6 py-3 rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
        >
          {isInitializing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Inicializando...
            </>
          ) : (
            <>
              <QrCode className="w-5 h-5" />
              Conectar WhatsApp
            </>
          )}
        </button>
        <p className="text-[#8696a0] text-xs mt-6">
          Esta integração usa WhatsApp Web. Use com cautela.
        </p>
      </div>
    </div>
  )

  // Render QR code state
  const renderQRCode = () => (
    <div className="flex-1 flex items-center justify-center bg-[#222e35]">
      <div className="text-center">
        <h2 className="text-[#e9edef] text-xl mb-2">Escaneie o QR Code</h2>
        <p className="text-[#8696a0] text-sm mb-6">
          Abra o WhatsApp no celular → Menu → Dispositivos conectados → Conectar
        </p>
        {qrCode ? (
          <div className="bg-white p-4 rounded-lg inline-block">
            <img src={qrCode} alt="QR Code" className="w-64 h-64" />
          </div>
        ) : (
          <div className="w-64 h-64 mx-auto bg-[#2a3942] rounded-lg flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#8696a0]" />
          </div>
        )}
        <div className="mt-6 flex items-center justify-center gap-2 text-[#00a884]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Aguardando conexão...</span>
        </div>
      </div>
    </div>
  )

  // Render connecting state
  const renderConnecting = () => (
    <div className="flex-1 flex items-center justify-center bg-[#222e35]">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#00a884] mx-auto mb-4" />
        <h2 className="text-[#e9edef] text-xl mb-2">Conectando...</h2>
        <p className="text-[#8696a0] text-sm">Aguarde enquanto estabelecemos a conexão.</p>
      </div>
    </div>
  )

  // Render chat sidebar
  const renderChatSidebar = () => (
    <div className="w-[400px] bg-[#111b21] border-r border-[#222d34] flex flex-col h-full">
      {/* Header */}
      <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-[#e9edef] font-medium">Follow-up</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadChats}
            className="p-2 hover:bg-[#2a3942] rounded-full transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 text-[#aebac1] ${isLoadingChats ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={disconnectWhatsApp}
            className="p-2 hover:bg-[#2a3942] rounded-full transition-colors"
            title="Desconectar"
          >
            <LogOut className="w-5 h-5 text-[#aebac1]" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-[#111b21]">
        <div className="flex items-center bg-[#202c33] rounded-lg px-4 py-2">
          <Search className="w-5 h-5 text-[#8696a0] mr-4" />
          <input
            type="text"
            placeholder="Pesquisar ou começar uma nova conversa"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[#e9edef] text-sm placeholder-[#8696a0] outline-none"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingChats ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#00a884]" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-[#8696a0] text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => selectChat(chat)}
              className={`w-full flex items-center px-3 py-3 hover:bg-[#202c33] transition-colors ${
                selectedChat?.id === chat.id ? 'bg-[#2a3942]' : ''
              }`}
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-[#6b7c85] flex items-center justify-center flex-shrink-0 mr-3">
                <span className="text-white text-lg font-medium">
                  {getInitials(chat.name)}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 border-b border-[#222d34] py-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#e9edef] text-base truncate">{chat.name}</span>
                    {savedAnalyses[chat.id] && (
                      <span className="flex-shrink-0 bg-[#00a884] text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        {savedAnalyses[chat.id].analysis.nota_final.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs flex-shrink-0 ${chat.unreadCount > 0 ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                    {formatTime(chat.lastMessageTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[#8696a0] text-sm truncate pr-2">{chat.lastMessage || 'Sem mensagens'}</p>
                  {chat.unreadCount > 0 && (
                    <span className="bg-[#00a884] text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )

  // Render main content area
  const renderMainContent = () => {
    if (!selectedChat) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#222e35]">
          <div className="text-center">
            <div className="w-[320px] h-[200px] mx-auto mb-8 flex items-center justify-center">
              <MessageSquare className="w-32 h-32 text-[#364147]" />
            </div>
            <h2 className="text-[#e9edef] text-2xl font-light mb-2">Selecione uma conversa</h2>
            <p className="text-[#8696a0] text-sm">
              Escolha uma conversa à esquerda para analisar o follow-up
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex-1 flex bg-[#0b141a] relative">
        {/* Messages Column */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${showAnalysisPanel ? 'mr-[400px]' : ''}`}>
          {/* Chat Header */}
          <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#6b7c85] flex items-center justify-center">
                <span className="text-white font-medium">
                  {getInitials(selectedChat.name)}
                </span>
              </div>
              <div>
                <h3 className="text-[#e9edef] font-medium">{selectedChat.name}</h3>
                <p className="text-[#8696a0] text-xs">
                  {selectedChat.lastMessageTime ? `Última msg: ${formatTime(selectedChat.lastMessageTime)}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || messages.length === 0}
                className="bg-[#00a884] hover:bg-[#06cf9c] text-white px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-4 h-4" />
                    {analysis ? 'Re-analisar' : 'Analisar'}
                  </>
                )}
              </button>

              {/* Analysis Score Card (when analysis exists) */}
              {analysis && !showAnalysisPanel && (
                <button
                  onClick={() => setShowAnalysisPanel(true)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    analysis.nota_final >= 8 ? 'bg-green-900/50 border border-green-700 hover:bg-green-900/70' :
                    analysis.nota_final >= 6 ? 'bg-yellow-900/50 border border-yellow-700 hover:bg-yellow-900/70' :
                    analysis.nota_final >= 4 ? 'bg-orange-900/50 border border-orange-700 hover:bg-orange-900/70' :
                    'bg-red-900/50 border border-red-700 hover:bg-red-900/70'
                  }`}
                >
                  <span className={`text-lg font-bold ${
                    analysis.nota_final >= 8 ? 'text-green-400' :
                    analysis.nota_final >= 6 ? 'text-yellow-400' :
                    analysis.nota_final >= 4 ? 'text-orange-400' :
                    'text-red-400'
                  }`}>{analysis.nota_final.toFixed(1)}</span>
                  <span className="text-[#8696a0] text-xs">Ver avaliação</span>
                  <ChevronRight className="w-4 h-4 text-[#8696a0]" />
                </button>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-16 py-4" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}>
            {error && (
              <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {isLoadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-[#00a884]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[#8696a0] text-sm">Nenhuma mensagem encontrada</p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg, idx) => {
                  const showDate = idx === 0 ||
                    new Date(msg.timestamp).toDateString() !== new Date(messages[idx - 1].timestamp).toDateString()

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1 rounded-lg shadow">
                            {new Date(msg.timestamp).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[65%] rounded-lg px-3 py-2 shadow ${
                          msg.fromMe
                            ? 'bg-[#005c4b] rounded-tr-none'
                            : 'bg-[#202c33] rounded-tl-none'
                        }`}>
                          {msg.hasMedia && msg.type !== 'chat' && (
                            <div className="text-[#8696a0] text-xs italic mb-1">
                              [{msg.type === 'image' ? '📷 Imagem' :
                                msg.type === 'video' ? '🎥 Vídeo' :
                                msg.type === 'audio' ? '🎵 Áudio' :
                                msg.type === 'document' ? '📄 Documento' :
                                msg.type === 'sticker' ? '🎨 Sticker' :
                                `📎 ${msg.type}`}]
                            </div>
                          )}
                          <p className="text-[#e9edef] text-sm whitespace-pre-wrap break-words">
                            {msg.body || (msg.hasMedia ? '' : '[Mensagem sem texto]')}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-[#8696a0]">
                              {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {msg.fromMe && (
                              <svg className="w-4 h-4 text-[#53bdeb]" viewBox="0 0 16 15" fill="currentColor">
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Analysis Panel (slides in from right) */}
        {analysis && (
          <div className={`absolute top-0 right-0 h-full w-[400px] bg-[#111b21] border-l border-[#222d34] flex flex-col transition-transform duration-300 ${showAnalysisPanel ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Panel Header */}
            <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAnalysisPanel(false)}
                  className="p-1 hover:bg-[#2a3942] rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-[#aebac1]" />
                </button>
                <span className="text-[#e9edef] font-medium">Avaliação</span>
              </div>
              <button
                onClick={() => setShowAnalysisPanel(false)}
                className="p-2 hover:bg-[#2a3942] rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#aebac1]" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {renderAnalysisResults()}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render analysis results
  const renderAnalysisResults = () => {
    const savedData = selectedChat ? savedAnalyses[selectedChat.id] : null
    const analysisDate = savedData?.date ? new Date(savedData.date) : null

    return (
    <div className="space-y-3">
      {/* Analysis Header with Date */}
      {analysisDate && (
        <p className="text-[#8696a0] text-xs text-center">
          {analysisDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      )}

      {/* Overall Score */}
      <div className={`rounded-xl p-4 text-center ${
        analysis!.nota_final >= 8 ? 'bg-green-900/50 border border-green-700' :
        analysis!.nota_final >= 6 ? 'bg-yellow-900/50 border border-yellow-700' :
        analysis!.nota_final >= 4 ? 'bg-orange-900/50 border border-orange-700' :
        'bg-red-900/50 border border-red-700'
      }`}>
        <p className={`text-4xl font-bold ${
          analysis!.nota_final >= 8 ? 'text-green-400' :
          analysis!.nota_final >= 6 ? 'text-yellow-400' :
          analysis!.nota_final >= 4 ? 'text-orange-400' :
          'text-red-400'
        }`}>{analysis!.nota_final.toFixed(1)}</p>
        <span className={`text-xs font-medium uppercase ${
          analysis!.nota_final >= 8 ? 'text-green-300' :
          analysis!.nota_final >= 6 ? 'text-yellow-300' :
          analysis!.nota_final >= 4 ? 'text-orange-300' :
          'text-red-300'
        }`}>
          {analysis!.classificacao}
        </span>
      </div>

      {/* Detailed Scores */}
      <div className="bg-[#202c33] rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-[#00a884]" />
          <h3 className="text-sm font-semibold text-[#e9edef]">Notas por Critério</h3>
        </div>
        <div className="space-y-2">
          {Object.entries(analysis!.notas).map(([key, value]) => {
            const fieldLabels: Record<string, string> = {
              'valor_agregado': 'Valor Agregado',
              'personalizacao': 'Personalização',
              'tom_consultivo': 'Tom Consultivo',
              'objetividade': 'Objetividade',
              'cta': 'CTA',
              'timing': 'Timing'
            }
            const getColor = (nota: number) => {
              if (nota >= 8) return { bar: 'bg-green-500', text: 'text-green-400' }
              if (nota >= 6) return { bar: 'bg-yellow-500', text: 'text-yellow-400' }
              if (nota >= 4) return { bar: 'bg-orange-500', text: 'text-orange-400' }
              return { bar: 'bg-red-500', text: 'text-red-400' }
            }
            const colors = getColor(value.nota)

            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#e9edef] text-xs">{fieldLabels[key] || key}</span>
                  <span className={`text-xs font-bold ${colors.text}`}>{value.nota.toFixed(1)}</span>
                </div>
                <div className="bg-[#111b21] h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${value.nota * 10}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Positive Points */}
      {analysis!.pontos_positivos.length > 0 && (
        <div className="bg-green-900/30 rounded-xl p-3 border border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-green-400">Pontos Positivos</h3>
          </div>
          <div className="space-y-1">
            {analysis!.pontos_positivos.map((ponto, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="w-1 h-1 bg-green-400 rounded-full mt-1.5 flex-shrink-0" />
                <span className="text-[#e9edef] text-xs">{ponto}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points to Improve */}
      {analysis!.pontos_melhorar.length > 0 && (
        <div className="bg-orange-900/30 rounded-xl p-3 border border-orange-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-orange-400">Pontos para Melhorar</h3>
          </div>
          <div className="space-y-2">
            {analysis!.pontos_melhorar.map((item, idx) => (
              <div key={idx} className="bg-[#111b21] rounded-lg p-2">
                <p className="text-[#e9edef] text-xs font-medium mb-1">{item.problema}</p>
                <p className="text-[#8696a0] text-xs">{item.como_resolver}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Tip */}
      <div className="bg-[#00a884]/20 rounded-xl p-3 border border-[#00a884]/50">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-[#00a884]" />
          <h3 className="text-sm font-semibold text-[#00a884]">Dica Principal</h3>
        </div>
        <p className="text-[#e9edef] text-xs">{analysis!.dica_principal}</p>
      </div>

      {/* Rewritten Version */}
      <div className="bg-[#202c33] rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#53bdeb]" />
          <h3 className="text-sm font-semibold text-[#53bdeb]">Versão Melhorada</h3>
        </div>
        <div className="bg-[#111b21] rounded-lg p-2">
          <pre className="whitespace-pre-wrap text-[#e9edef] text-xs font-sans">{analysis!.versao_reescrita}</pre>
        </div>
      </div>
    </div>
  )}

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#111b21]">
      {connectionStatus === 'connected' ? (
        <>
          {renderChatSidebar()}
          {renderMainContent()}
        </>
      ) : connectionStatus === 'qr' ? (
        renderQRCode()
      ) : connectionStatus === 'connecting' ? (
        renderConnecting()
      ) : (
        renderDisconnected()
      )}
    </div>
  )
}
