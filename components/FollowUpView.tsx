'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle, AlertCircle, X, FileText, Lightbulb, BarChart3, MessageSquare, RefreshCw, LogOut, Smartphone, Search, ChevronRight, ChevronLeft, Send, Smile, Paperclip, Mic, Trash2, Image as ImageIcon } from 'lucide-react'
import SalesCopilot from './SalesCopilot'

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

type ConnectionStatus = 'disconnected' | 'initializing' | 'qr_ready' | 'connecting' | 'connected'

const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
  '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗',
  '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑',
  '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑',
  '😶', '😏', '😒', '🙄', '😬', '😔', '😪', '😴',
  '👍', '👎', '👌', '🤌', '✌️', '🤞', '🤟', '🤘',
  '👋', '🤚', '✋', '👊', '✊', '👏', '🙌', '🤝',
  '🙏', '💪', '🫶', '❤️', '🧡', '💛', '💚', '💙',
  '💜', '🖤', '🤍', '💯', '💥', '🔥', '⭐', '🎉',
  '✅', '❌', '⚠️', '❓', '❗', '💬', '👀', '🎯',
]

export default function FollowUpView() {
  // WhatsApp state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Message input state
  const [messageInput, setMessageInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedConvRef = useRef<WhatsAppConversation | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  // Media send state
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [voiceVolumeBars, setVoiceVolumeBars] = useState<number[]>(new Array(30).fill(4))
  const [selectedFile, setSelectedFile] = useState<{ file: File; type: 'image' | 'document'; previewUrl?: string } | null>(null)
  const [mediaCaption, setMediaCaption] = useState('')
  const voiceRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const voiceStreamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const voiceAnalyserRef = useRef<AnalyserNode | null>(null)
  const voiceAnimFrameRef = useRef<number | null>(null)
  const voiceAudioCtxRef = useRef<AudioContext | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<FollowUpAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAnalyses, setSavedAnalyses] = useState<Record<string, { analysis: FollowUpAnalysis; date: string }>>({})
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false)

  // Sync status from backend
  const [syncStatus, setSyncStatus] = useState<'pending' | 'syncing' | 'synced' | 'error' | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Auth token for API calls
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Helper to get auth headers
  const getAuthHeaders = (): HeadersInit => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
    return headers
  }

  // Load auth token on mount (robust: handles subdomains, different browsers)
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')

        // Strategy 1: getSession (works in most cases)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          setAuthToken(session.access_token)
          return
        }

        // Strategy 2: refreshSession (forces token refresh from Supabase)
        const { data: { session: refreshed } } = await supabase.auth.refreshSession()
        if (refreshed?.access_token) {
          setAuthToken(refreshed.access_token)
          return
        }

        // Strategy 3: getUser validates the cookie, then retry getSession
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: { session: retried } } = await supabase.auth.getSession()
          if (retried?.access_token) {
            setAuthToken(retried.access_token)
            return
          }
        }

        console.warn('[Auth] Could not retrieve auth token after all strategies')
      } catch (e) {
        console.error('Error loading auth:', e)
      }
    }
    loadAuth()

    // Also listen for auth state changes (handles token refresh, login from other tabs)
    let subscription: any
    ;(async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.access_token) {
          setAuthToken(session.access_token)
        }
      })
      subscription = data.subscription
    })()

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Load saved analyses from Supabase on mount (with localStorage fallback)
  useEffect(() => {
    const loadSavedAnalyses = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data, error } = await supabase
            .from('followup_analyses')
            .select('whatsapp_chat_id, whatsapp_contact_name, avaliacao, nota_final, classificacao, created_at')
            .eq('user_id', user.id)
            .not('whatsapp_chat_id', 'is', null)
            .order('created_at', { ascending: false })

          if (data && !error) {
            const analysesMap: Record<string, { analysis: FollowUpAnalysis; date: string }> = {}
            for (const row of data) {
              if (row.whatsapp_chat_id && !analysesMap[row.whatsapp_chat_id]) {
                analysesMap[row.whatsapp_chat_id] = {
                  analysis: row.avaliacao as FollowUpAnalysis,
                  date: row.created_at
                }
              }
            }
            setSavedAnalyses(analysesMap)
            localStorage.setItem('whatsapp_followup_analyses', JSON.stringify(analysesMap))
            return
          }
        }
      } catch (e) {
        console.error('Error loading analyses from Supabase:', e)
      }

      const saved = localStorage.getItem('whatsapp_followup_analyses')
      if (saved) {
        try {
          setSavedAnalyses(JSON.parse(saved))
        } catch (e) {
          console.error('Error loading saved analyses:', e)
        }
      }
    }

    loadSavedAnalyses()
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
  }, [])

  // Check connection status on mount and when auth token is available
  useEffect(() => {
    if (authToken) {
      checkConnectionStatus()
    }
  }, [authToken])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [])

  // Click-outside handler for attachment menu and emoji picker
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup voice recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (voiceAnimFrameRef.current) cancelAnimationFrame(voiceAnimFrameRef.current)
      voiceAudioCtxRef.current?.close().catch(() => {})
      voiceStreamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  // Disconnect WhatsApp when page unloads/refreshes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (connectionStatus === 'connected' && authToken) {
        // Use sendBeacon for reliable delivery during page unload
        navigator.sendBeacon('/api/whatsapp/disconnect', JSON.stringify({ token: authToken }))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [connectionStatus, authToken])

  // Heartbeat: keep server-side WhatsApp session alive
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (connectionStatus === 'connected' && authToken) {
      // Send initial heartbeat immediately
      fetch('/api/whatsapp/heartbeat', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).catch(() => {})

      interval = setInterval(async () => {
        try {
          const response = await fetch('/api/whatsapp/heartbeat', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
          })

          if (response.status === 404) {
            // Server lost our session (restart, crash, TTL expired)
            console.warn('[Heartbeat] Server has no active client, resetting connection state')
            setConnectionStatus('disconnected')
            setPhoneNumber(null)
            setConversations([])
            setSelectedConversation(null)
            setMessages([])
          }
        } catch {
          // Network error - server TTL will handle cleanup if heartbeats consistently fail
          console.warn('[Heartbeat] Failed to send heartbeat')
        }
      }, 20000) // Every 20 seconds
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [connectionStatus, authToken])

  // Keep ref in sync with selectedConversation for polling
  useEffect(() => {
    selectedConvRef.current = selectedConversation
  }, [selectedConversation])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll for new messages when a conversation is selected
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (connectionStatus === 'connected' && selectedConversation && authToken) {
      interval = setInterval(async () => {
        const currentConv = selectedConvRef.current
        if (!currentConv) return

        try {
          const response = await fetch(
            `/api/whatsapp/messages?contactPhone=${encodeURIComponent(currentConv.contact_phone)}`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
          )
          const data = await response.json()

          if (data.messages) {
            setMessages(prev => {
              const realPrev = prev.filter(m => !m.id.startsWith('temp_'))
              if (data.messages.length !== realPrev.length) {
                return data.messages
              }
              const lastNew = data.messages[data.messages.length - 1]
              const lastOld = realPrev[realPrev.length - 1]
              if (lastNew && lastOld && lastNew.id !== lastOld.id) {
                return data.messages
              }
              return prev
            })
          }
        } catch (e) {
          // Silent fail for polling
        }
      }, 30000) // Anti-ban: Reduced polling frequency (was 5s, now 30s)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [connectionStatus, selectedConversation, authToken])

  // Poll for conversation list updates
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (connectionStatus === 'connected' && authToken) {
      interval = setInterval(async () => {
        try {
          const response = await fetch('/api/whatsapp/conversations', {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
          const data = await response.json()

          if (data.conversations) {
            setConversations(data.conversations)
            const currentConv = selectedConvRef.current
            if (currentConv) {
              const updated = data.conversations.find((c: WhatsAppConversation) => c.contact_phone === currentConv.contact_phone)
              if (updated) {
                setSelectedConversation(prev => prev ? {
                  ...prev,
                  unread_count: updated.unread_count,
                  last_message_preview: updated.last_message_preview,
                  last_message_at: updated.last_message_at,
                  message_count: updated.message_count
                } : prev)
              }
            }
          }
        } catch (e) {
          // Silent fail for polling
        }
      }, 30000) // Anti-ban: Reduced polling frequency (was 10s, now 30s)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [connectionStatus, authToken])

  const checkConnectionStatus = async () => {
    if (!authToken) return

    try {
      const response = await fetch('/api/whatsapp/status', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await response.json()

      if (data.connected) {
        setConnectionStatus('connected')
        setPhoneNumber(data.phone_number || null)
        loadConversations()
        // Extended retries in case sync is still in progress
        setTimeout(() => loadConversations(), 5000)
        setTimeout(() => loadConversations(), 15000)
        setTimeout(() => loadConversations(), 30000)
        setTimeout(() => loadConversations(), 60000)
      } else {
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      console.error('Error checking status:', error)
    }
  }

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const startPolling = () => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      if (!authToken) return
      try {
        const response = await fetch('/api/whatsapp/connect', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
        const data = await response.json()

        if (data.status === 'connected') {
          stopPolling()
          setConnectionStatus('connected')
          setPhoneNumber(data.phoneNumber || null)
          setQrCode(null)
          setIsInitializing(false)
          setSyncStatus(data.syncStatus || 'pending')
          // Load conversations with extended retries (sync can take up to 2min)
          loadConversations()
          setTimeout(() => loadConversations(), 5000)
          setTimeout(() => loadConversations(), 15000)
          setTimeout(() => loadConversations(), 30000)
          setTimeout(() => loadConversations(), 60000)
          setTimeout(() => loadConversations(), 120000)
        } else if (data.status === 'qr_ready' && data.qrcode) {
          setQrCode(data.qrcode)
          setConnectionStatus('qr_ready')
        } else if (data.status === 'connecting') {
          setConnectionStatus('connecting')
          setQrCode(null)
        } else if (data.status === 'error') {
          stopPolling()
          setError(data.error || 'Erro na conexao')
          setConnectionStatus('disconnected')
          setIsInitializing(false)
        } else if (data.status === 'no_client' || data.status === 'disconnected_needs_reconnect') {
          // Server lost the client (PM2 restart) - stop polling and reset
          stopPolling()
          setQrCode(null)
          setIsInitializing(false)
          setConnectionStatus('disconnected')
          setError('Conexao perdida. Clique em Conectar novamente.')
        }
      } catch {
        // Silent fail for polling
      }
    }, 2000)
  }

  const connectWhatsApp = async () => {
    if (!authToken) {
      setError('Sessão expirada. Recarregue a página.')
      return
    }
    setIsInitializing(true)
    setError(null)
    setConnectionStatus('initializing')
    setQrCode(null)

    try {
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: getAuthHeaders()
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar conexao')
      }

      if (data.status === 'connected') {
        setConnectionStatus('connected')
        setIsInitializing(false)
        loadConversations()
        setTimeout(() => loadConversations(), 5000)
        setTimeout(() => loadConversations(), 15000)
        setTimeout(() => loadConversations(), 30000)
        setTimeout(() => loadConversations(), 60000)
        return
      }

      if (data.qrcode) {
        setQrCode(data.qrcode)
        setConnectionStatus('qr_ready')
      }

      // Start polling for status updates (QR regeneration, connection)
      startPolling()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar')
      setConnectionStatus('disconnected')
      setIsInitializing(false)
    }
  }

  const disconnectWhatsApp = async () => {
    // Optimistic: reset UI immediately (don't wait for server)
    setConnectionStatus('disconnected')
    setPhoneNumber(null)
    setConversations([])
    setSelectedConversation(null)
    setMessages([])

    // Fire-and-forget: server cleanup happens in background
    fetch('/api/whatsapp/disconnect', {
      method: 'POST',
      headers: getAuthHeaders()
    }).catch(err => console.error('Error disconnecting:', err))
  }

  const triggerManualSync = async () => {
    if (!authToken || isSyncing) return
    setIsSyncing(true)
    setSyncStatus('syncing')
    try {
      const response = await fetch('/api/whatsapp/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await response.json()
      if (data.success) {
        setSyncStatus('synced')
        loadConversations()
      } else {
        setSyncStatus('error')
        console.error('Sync failed:', data.error)
      }
    } catch (error) {
      setSyncStatus('error')
      console.error('Error triggering sync:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const loadConversations = async () => {
    if (!authToken) return

    setIsLoadingConversations(true)
    try {
      const response = await fetch('/api/whatsapp/conversations', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await response.json()

      if (data.conversations) {
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }

  const loadMessages = async (contactPhone: string) => {
    if (!authToken) return

    setIsLoadingMessages(true)
    setMessages([])
    try {
      const response = await fetch(
        `/api/whatsapp/messages?contactPhone=${encodeURIComponent(contactPhone)}`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      )
      const data = await response.json()

      if (data.messages) {
        setMessages(data.messages)
      }

      // Try to sync more history from WhatsApp in background
      // Only if we have few messages (less than 10)
      if (connectionStatus === 'connected' && (!data.messages || data.messages.length < 10)) {
        syncHistoryFromWhatsApp(contactPhone, data.messages?.length || 0)
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Sync historical messages from WhatsApp
  const syncHistoryFromWhatsApp = async (contactPhone: string, currentCount: number) => {
    if (!authToken) return

    try {
      console.log(`[Sync] Attempting to sync history for ${contactPhone} (current: ${currentCount} msgs)`)
      const response = await fetch('/api/whatsapp/sync-history', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contactPhone, limit: 50 })
      })

      const data = await response.json()

      if (data.synced > 0) {
        console.log(`[Sync] Synced ${data.synced} new messages, reloading...`)
        // Reload messages to show the new ones
        const reloadResponse = await fetch(
          `/api/whatsapp/messages?contactPhone=${encodeURIComponent(contactPhone)}`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        )
        const reloadData = await reloadResponse.json()
        if (reloadData.messages) {
          setMessages(reloadData.messages)
        }
      }
    } catch (error) {
      // Silently fail - sync is optional enhancement
      console.error('[Sync] Error syncing history:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageInput.trim() || isSending) return

    const text = messageInput.trim()
    setMessageInput('')
    setIsSending(true)

    // Optimistic update
    const tempMsg: WhatsAppMessage = {
      id: `temp_${Date.now()}`,
      body: text,
      fromMe: true,
      timestamp: new Date().toISOString(),
      type: 'text',
      hasMedia: false
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          to: selectedConversation.contact_phone,
          message: text
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem')
      }

      // Replace temp message with real one
      setMessages(prev => prev.map(msg =>
        msg.id === tempMsg.id ? data.message : msg
      ))
    } catch (err) {
      console.error('Error sending message:', err)
      setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id))
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (selectedFile) {
        handleSendMedia()
      } else {
        handleSendMessage()
      }
    }
  }

  // ============================================
  // Media send handlers
  // ============================================

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith('image/')
    const maxSize = isImage ? 16 * 1024 * 1024 : 100 * 1024 * 1024
    if (file.size > maxSize) {
      setError(`Arquivo muito grande. Limite: ${isImage ? '16MB' : '100MB'}`)
      return
    }

    const previewUrl = isImage ? URL.createObjectURL(file) : undefined

    setSelectedFile({ file, type: isImage ? 'image' : 'document', previewUrl })
    setMediaCaption('')
    e.target.value = ''
  }

  const clearSelectedFile = () => {
    if (selectedFile?.previewUrl) {
      URL.revokeObjectURL(selectedFile.previewUrl)
    }
    setSelectedFile(null)
    setMediaCaption('')
  }

  const handleSendMedia = async () => {
    if (!selectedConversation || !selectedFile || isSending) return

    setIsSending(true)
    const { file, type } = selectedFile
    const caption = mediaCaption.trim()

    const tempMsg: WhatsAppMessage = {
      id: `temp_${Date.now()}`,
      body: caption || '',
      fromMe: true,
      timestamp: new Date().toISOString(),
      type: type,
      hasMedia: true,
      mediaId: selectedFile.previewUrl || null,
      mimetype: file.type,
    }
    setMessages(prev => [...prev, tempMsg])
    clearSelectedFile()

    try {
      const formData = new FormData()
      formData.append('to', selectedConversation.contact_phone)
      formData.append('file', file)
      formData.append('type', type)
      if (caption) formData.append('caption', caption)

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar midia')
      }

      setMessages(prev => prev.map(msg =>
        msg.id === tempMsg.id ? data.message : msg
      ))
    } catch (err) {
      console.error('Error sending media:', err)
      setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id))
      setError(err instanceof Error ? err.message : 'Erro ao enviar midia')
    } finally {
      setIsSending(false)
    }
  }

  const insertEmoji = (emoji: string) => {
    if (selectedFile) {
      setMediaCaption(prev => prev + emoji)
    } else {
      setMessageInput(prev => prev + emoji)
    }
    setShowEmojiPicker(false)
  }

  // ============================================
  // Voice recording
  // ============================================

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceStreamRef.current = stream

      // Set up Web Audio API analyser for real-time volume
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)
      voiceAudioCtxRef.current = audioCtx
      voiceAnalyserRef.current = analyser

      // Animate volume bars from real mic input
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateBars = () => {
        analyser.getByteFrequencyData(dataArray)
        const bars: number[] = []
        const binCount = dataArray.length
        const barsCount = 30
        for (let i = 0; i < barsCount; i++) {
          const idx = Math.floor((i / barsCount) * binCount)
          const val = dataArray[idx] / 255
          bars.push(Math.max(3, val * 24))
        }
        setVoiceVolumeBars(bars)
        voiceAnimFrameRef.current = requestAnimationFrame(updateBars)
      }
      voiceAnimFrameRef.current = requestAnimationFrame(updateBars)

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      })
      voiceRecorderRef.current = recorder
      voiceChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data)
      }

      recorder.start(100)
      setIsRecordingVoice(true)
      setRecordingDuration(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } catch {
      setError('Nao foi possivel acessar o microfone')
    }
  }

  const cleanupVoiceAnalyser = () => {
    if (voiceAnimFrameRef.current) {
      cancelAnimationFrame(voiceAnimFrameRef.current)
      voiceAnimFrameRef.current = null
    }
    if (voiceAudioCtxRef.current) {
      voiceAudioCtxRef.current.close().catch(() => {})
      voiceAudioCtxRef.current = null
    }
    voiceAnalyserRef.current = null
    setVoiceVolumeBars(new Array(30).fill(4))
  }

  const stopAndSendVoiceRecording = async () => {
    if (!voiceRecorderRef.current || !selectedConversation) return

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    cleanupVoiceAnalyser()
    setIsRecordingVoice(false)

    const recorder = voiceRecorderRef.current
    const audioBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(voiceChunksRef.current, { type: recorder.mimeType }))
      }
      recorder.stop()
    })

    voiceStreamRef.current?.getTracks().forEach(t => t.stop())
    voiceStreamRef.current = null
    voiceRecorderRef.current = null

    if (audioBlob.size === 0) return

    setIsSending(true)
    const tempMsg: WhatsAppMessage = {
      id: `temp_${Date.now()}`,
      body: '',
      fromMe: true,
      timestamp: new Date().toISOString(),
      type: 'ptt',
      hasMedia: true,
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const formData = new FormData()
      formData.append('to', selectedConversation.contact_phone)
      formData.append('file', audioBlob, `voice_${Date.now()}.ogg`)
      formData.append('type', 'audio')

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar audio')

      setMessages(prev => prev.map(msg =>
        msg.id === tempMsg.id ? data.message : msg
      ))
    } catch (err) {
      console.error('Error sending voice:', err)
      setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id))
      setError(err instanceof Error ? err.message : 'Erro ao enviar audio')
    } finally {
      setIsSending(false)
    }
  }

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    cleanupVoiceAnalyser()
    if (voiceRecorderRef.current?.state === 'recording') {
      voiceRecorderRef.current.stop()
    }
    voiceStreamRef.current?.getTracks().forEach(t => t.stop())
    voiceStreamRef.current = null
    voiceRecorderRef.current = null
    voiceChunksRef.current = []
    setIsRecordingVoice(false)
    setRecordingDuration(0)
  }

  const selectConversation = (conv: WhatsAppConversation) => {
    setSelectedConversation(conv)
    setError(null)

    // Mark as read
    if (conv.unread_count > 0 && authToken) {
      fetch('/api/whatsapp/conversations', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ contactPhone: conv.contact_phone })
      }).catch(() => {})
      // Optimistic update
      setConversations(prev => prev.map(c =>
        c.contact_phone === conv.contact_phone ? { ...c, unread_count: 0 } : c
      ))
    }

    // Check if there's a saved analysis for this conversation
    const saved = savedAnalyses[conv.contact_phone]
    if (saved) {
      setAnalysis(saved.analysis)
      setShowAnalysisPanel(false)
    } else {
      setAnalysis(null)
      setShowAnalysisPanel(false)
    }

    loadMessages(conv.contact_phone)
  }

  const handleAnalyze = async () => {
    if (!selectedConversation || !authToken) {
      setError('Selecione uma conversa')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const messagesResponse = await fetch(
        `/api/whatsapp/messages?contactPhone=${encodeURIComponent(selectedConversation.contact_phone)}&format=analysis`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      )
      const messagesData = await messagesResponse.json()

      if (!messagesResponse.ok) {
        throw new Error(messagesData.error || 'Erro ao buscar mensagens')
      }

      const response = await fetch('/api/followup/analyze', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          transcricao: messagesData.formatted,
          avaliacao: { canal: 'WhatsApp' },
          dados_empresa: companyData,
          whatsapp_chat_id: selectedConversation.contact_phone,
          whatsapp_contact_name: selectedConversation.contact_name
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao analisar follow-up')
      }

      setAnalysis(data.analysis)
      setShowAnalysisPanel(true)

      // Save analysis
      if (selectedConversation && data.analysis) {
        const newSavedAnalyses = {
          ...savedAnalyses,
          [selectedConversation.contact_phone]: {
            analysis: data.analysis,
            date: new Date().toISOString()
          }
        }
        setSavedAnalyses(newSavedAnalyses)
        localStorage.setItem('whatsapp_followup_analyses', JSON.stringify(newSavedAnalyses))
      }
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Erro ao analisar follow-up')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Get initials from name
  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Format phone number for display
  const formatPhone = (phone: string) => {
    // Handle LID contacts (stored with lid_ prefix when phone couldn't be resolved)
    if (phone.startsWith('lid_')) {
      // Show a shortened identifier for LID contacts
      const lidId = phone.replace('lid_', '')
      return `ID: ...${lidId.slice(-6)}`
    }
    if (phone.length >= 12) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`
    }
    return `+${phone}`
  }

  // Format time for conversation list
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

  // Build media URL from mediaId using the proxy endpoint
  const getMediaSrc = (mediaId: string) => {
    if (!authToken) return ''
    // URL-encode the mediaId to handle paths with slashes (e.g., userId/timestamp.ogg)
    return `/api/whatsapp/media/${encodeURIComponent(mediaId)}?token=${encodeURIComponent(authToken)}`
  }

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv =>
    (conv.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contact_phone.includes(searchQuery) ||
    (conv.last_message_preview || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Render disconnected state
  const renderDisconnected = () => (
    <div className="flex-1 flex items-center justify-center bg-[#222e35]">
      <div className="text-center max-w-md px-8">
        <div className="w-[320px] h-[320px] mx-auto mb-8 flex items-center justify-center">
          <div className="relative">
            <Smartphone className="w-40 h-40 text-[#8696a0]" />
            <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-[#25d366] rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-9 h-9 text-white" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
          </div>
        </div>
        <h1 className="text-[32px] font-light text-[#e9edef] mb-4">
          WhatsApp Follow-Up
        </h1>
        <p className="text-[#8696a0] text-sm mb-8">
          Conecte seu WhatsApp via QR Code para analisar suas conversas de follow-up automaticamente.
          Selecione uma conversa e receba feedback detalhado em segundos.
        </p>
        <button
          onClick={connectWhatsApp}
          disabled={isInitializing || !authToken}
          className="bg-[#00a884] hover:bg-[#06cf9c] text-white px-6 py-3 rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
        >
          {isInitializing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Iniciando...
            </>
          ) : !authToken ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando...
            </>
          ) : (
            <>
              <Smartphone className="w-5 h-5" />
              Conectar WhatsApp
            </>
          )}
        </button>
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
        <p className="text-[#8696a0] text-xs mt-6">
          Voce precisara escanear o QR Code com seu celular.
        </p>
      </div>
    </div>
  )

  // Render QR code / connecting state
  const renderConnecting = () => (
    <div className="flex-1 flex items-center justify-center bg-[#222e35]">
      <div className="text-center max-w-md px-8">
        {connectionStatus === 'qr_ready' && qrCode ? (
          <>
            <div className="bg-white p-4 rounded-2xl inline-block mb-6">
              <img
                src={qrCode}
                alt="QR Code WhatsApp"
                className="w-[256px] h-[256px]"
              />
            </div>
            <h2 className="text-[#e9edef] text-xl mb-2">Escaneie o QR Code</h2>
            <p className="text-[#8696a0] text-sm mb-4">
              Abra o WhatsApp no seu celular, va em Aparelhos Conectados e escaneie o codigo acima.
            </p>
            <p className="text-[#8696a0] text-xs">
              O QR Code atualiza automaticamente. Mantenha esta pagina aberta.
            </p>
            <button
              onClick={() => {
                stopPolling()
                setConnectionStatus('disconnected')
                setQrCode(null)
                setIsInitializing(false)
              }}
              className="mt-4 text-[#8696a0] hover:text-[#e9edef] text-sm transition-colors"
            >
              Cancelar
            </button>
          </>
        ) : connectionStatus === 'connecting' ? (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-[#00a884] mx-auto mb-4" />
            <h2 className="text-[#e9edef] text-xl mb-2">Conectando...</h2>
            <p className="text-[#8696a0] text-sm">QR Code escaneado. Autenticando...</p>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-[#00a884] mx-auto mb-4" />
            <h2 className="text-[#e9edef] text-xl mb-2">Inicializando...</h2>
            <p className="text-[#8696a0] text-sm">Preparando o QR Code. Aguarde...</p>
          </>
        )}
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )

  // Render conversation sidebar
  const renderChatSidebar = () => (
    <div className="w-[400px] bg-[#111b21] border-r border-[#222d34] flex flex-col h-full">
      {/* Header */}
      <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-[#e9edef] font-medium">WhatsApp IA+</span>
            {phoneNumber && (
              <p className="text-[#8696a0] text-[10px]">{phoneNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadConversations()
              // If no conversations loaded, also trigger sync
              if (conversations.length === 0) {
                triggerManualSync()
              }
            }}
            className="p-2 hover:bg-[#2a3942] rounded-full transition-colors"
            title={conversations.length === 0 ? 'Sincronizar conversas' : 'Atualizar'}
          >
            <RefreshCw className={`w-5 h-5 text-[#aebac1] ${isLoadingConversations || isSyncing ? 'animate-spin' : ''}`} />
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
            placeholder="Pesquisar conversa"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-[#e9edef] text-sm placeholder-[#8696a0] outline-none"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingConversations ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#00a884]" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="w-12 h-12 text-[#364147] mx-auto mb-3" />
            <p className="text-[#8696a0] text-sm">
              {conversations.length === 0
                ? (syncStatus === 'syncing' || isSyncing
                    ? 'Sincronizando conversas...'
                    : syncStatus === 'error'
                    ? 'Erro ao sincronizar conversas'
                    : 'Aguardando sincronizacao...')
                : 'Nenhuma conversa encontrada'}
            </p>
            {conversations.length === 0 && (
              <>
                {(syncStatus === 'syncing' || isSyncing) ? (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Loader2 className="w-4 h-4 animate-spin text-[#00a884]" />
                    <p className="text-[#8696a0] text-xs">Isso pode levar alguns segundos...</p>
                  </div>
                ) : (
                  <button
                    onClick={triggerManualSync}
                    className="mt-3 px-4 py-2 bg-[#00a884] text-white text-sm rounded-lg hover:bg-[#00967d] transition-colors flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Sincronizar Conversas
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={`w-full flex items-center px-3 py-3 hover:bg-[#202c33] transition-colors ${
                selectedConversation?.contact_phone === conv.contact_phone ? 'bg-[#2a3942]' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0 mr-3">
                {conv.profile_pic_url ? (
                  <img
                    src={conv.profile_pic_url}
                    alt={conv.contact_name || 'Contact'}
                    className="w-12 h-12 rounded-full object-cover"
                    onError={(e) => {
                      // Fallback to initials on error
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                ) : null}
                <div className={`w-12 h-12 rounded-full bg-[#6b7c85] flex items-center justify-center ${conv.profile_pic_url ? 'hidden' : ''}`}>
                  <span className="text-white text-lg font-medium">
                    {getInitials(conv.contact_name)}
                  </span>
                </div>
                {conv.unread_count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#00a884] text-white text-[10px] font-bold min-w-[20px] h-[20px] flex items-center justify-center rounded-full px-1">
                    {conv.unread_count}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 border-b border-[#222d34] py-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#e9edef] text-base truncate">
                      {conv.contact_name || formatPhone(conv.contact_phone)}
                    </span>
                  </div>
                  <span className={`text-xs flex-shrink-0 ${conv.unread_count > 0 ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                    {formatTime(conv.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[#8696a0] text-sm truncate pr-2">{conv.last_message_preview || 'Sem mensagens'}</p>
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
    if (!selectedConversation) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#222e35]">
          <div className="text-center">
            <div className="w-[320px] h-[200px] mx-auto mb-8 flex items-center justify-center">
              <MessageSquare className="w-32 h-32 text-[#364147]" />
            </div>
            <h2 className="text-[#e9edef] text-2xl font-light mb-2">Selecione uma conversa</h2>
            <p className="text-[#8696a0] text-sm">
              Escolha uma conversa a esquerda para analisar o follow-up
            </p>
          </div>
        </div>
      )
    }

    const displayName = selectedConversation.contact_name || formatPhone(selectedConversation.contact_phone)

    return (
      <div className="flex-1 flex bg-[#0b141a] relative overflow-hidden">
        {/* Messages Column */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Chat Header */}
          <div className="h-[60px] flex-shrink-0 bg-[#202c33] px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedConversation.profile_pic_url ? (
                <img
                  src={selectedConversation.profile_pic_url}
                  alt={selectedConversation.contact_name || 'Contact'}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    target.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <div className={`w-10 h-10 rounded-full bg-[#6b7c85] flex items-center justify-center ${selectedConversation.profile_pic_url ? 'hidden' : ''}`}>
                <span className="text-white font-medium">
                  {getInitials(selectedConversation.contact_name)}
                </span>
              </div>
              <div>
                <h3 className="text-[#e9edef] font-medium">{displayName}</h3>
                <p className="text-[#8696a0] text-xs">
                  {selectedConversation.contact_name ? formatPhone(selectedConversation.contact_phone) : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-16 py-4" style={{
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
                {messages
                  .filter(msg => {
                    const hiddenTypes = ['reaction']
                    return !hiddenTypes.includes(msg.type)
                  })
                  .map((msg, idx, filtered) => {
                  const showDate = idx === 0 ||
                    new Date(msg.timestamp).toDateString() !== new Date(filtered[idx - 1].timestamp).toDateString()

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
                        } ${msg.id.startsWith('temp_') ? 'opacity-60' : ''}`}>
                          {/* Image */}
                          {msg.hasMedia && msg.mediaId && (msg.type === 'image' || msg.mimetype?.startsWith('image/')) && msg.type !== 'sticker' && (
                            <div className="mb-1 rounded-md overflow-hidden" style={{ margin: '-4px -6px 4px -6px' }}>
                              <img
                                src={getMediaSrc(msg.mediaId)}
                                alt="Imagem"
                                className="w-full max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setLightboxImage(getMediaSrc(msg.mediaId!))}
                              />
                            </div>
                          )}
                          {/* Sticker */}
                          {msg.type === 'sticker' && msg.mediaId && (
                            <div className="mb-1">
                              <img src={getMediaSrc(msg.mediaId)} alt="Sticker" className="max-w-[150px] max-h-[150px]" />
                            </div>
                          )}
                          {/* Audio */}
                          {(msg.type === 'audio' || msg.type === 'ptt') && msg.mediaId && (
                            <div className="mb-1 min-w-[240px]">
                              <audio controls className="w-full h-8" style={{ filter: 'invert(1) hue-rotate(180deg)' }}>
                                <source src={getMediaSrc(msg.mediaId)} type={msg.mimetype || 'audio/ogg'} />
                              </audio>
                            </div>
                          )}
                          {/* Video */}
                          {msg.type === 'video' && msg.mediaId && (
                            <div className="mb-1 rounded-md overflow-hidden" style={{ margin: '-4px -6px 4px -6px' }}>
                              <video controls className="w-full max-h-[300px]">
                                <source src={getMediaSrc(msg.mediaId)} type={msg.mimetype || 'video/mp4'} />
                              </video>
                            </div>
                          )}
                          {/* Document */}
                          {msg.type === 'document' && (
                            <div className="flex items-center gap-2 mb-1 bg-[#0b141a]/40 rounded px-2 py-1.5">
                              <span className="text-2xl">📄</span>
                              <span className="text-[#e9edef] text-sm truncate">{msg.body || 'Documento'}</span>
                              {msg.mediaId && (
                                <a href={getMediaSrc(msg.mediaId)} download className="text-[#00a884] text-xs hover:underline ml-auto flex-shrink-0">Baixar</a>
                              )}
                            </div>
                          )}
                          {/* Media with no mediaId (failed to load) */}
                          {msg.hasMedia && !msg.mediaId && msg.type !== 'text' && (
                            <p className="text-[#8696a0] text-xs italic mb-1">
                              {msg.type === 'image' ? '📷 Imagem' :
                               msg.type === 'sticker' ? '🎨 Sticker' :
                               msg.type === 'video' ? '🎥 Video' :
                               msg.type === 'audio' || msg.type === 'ptt' ? '🎵 Audio' :
                               msg.type === 'document' ? '📄 Documento' :
                               `📎 ${msg.type}`}
                            </p>
                          )}
                          {/* Special message types */}
                          {!msg.body && !msg.hasMedia && msg.type !== 'text' && (
                            <p className="text-[#8696a0] text-xs italic">
                              {msg.type === 'location' ? '📍 Localizacao' :
                               msg.type === 'contacts' ? '👤 Contato' :
                               msg.type === 'sticker' ? '🎨 Sticker' :
                               `[${msg.type}]`}
                            </p>
                          )}
                          {/* Text body */}
                          {msg.body && msg.type !== 'sticker' && msg.type !== 'document' && msg.type !== 'audio' && msg.type !== 'ptt' && (
                            <p className="text-[#e9edef] text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] text-[#8696a0]">
                              {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {msg.fromMe && msg.id.startsWith('temp_') ? (
                              <svg className="w-3.5 h-3.5 text-[#8696a0] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" strokeDasharray="50" strokeDashoffset="15" />
                              </svg>
                            ) : msg.fromMe && (
                              <svg className={`w-4 h-4 ${msg.status === 'read' ? 'text-[#53bdeb]' : 'text-[#8696a0]'}`} viewBox="0 0 16 15" fill="currentColor">
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.88a.32.32 0 0 1-.484.032L1.892 7.77a.366.366 0 0 0-.516.005l-.423.433a.364.364 0 0 0 .006.514l3.255 3.185a.32.32 0 0 0 .484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message Input Bar */}
          <div className="px-4 py-3 bg-[#202c33] flex-shrink-0">
            {/* File Preview Strip */}
            {selectedFile && (
              <div className="mb-2 p-2 bg-[#2a3942] rounded-lg flex items-center gap-3">
                {selectedFile.type === 'image' && selectedFile.previewUrl ? (
                  <img src={selectedFile.previewUrl} alt="Preview" className="w-16 h-16 rounded object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-[#00a884]/20 rounded flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[#00a884]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[#e9edef] text-sm truncate">{selectedFile.file.name}</p>
                  <p className="text-[#8696a0] text-xs">{(selectedFile.file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={clearSelectedFile} className="p-1 hover:bg-[#111b21] rounded-full transition-colors">
                  <X className="w-5 h-5 text-[#8696a0]" />
                </button>
              </div>
            )}

            {/* Voice Recording Mode */}
            {isRecordingVoice ? (
              <div className="flex items-center gap-3 h-[44px]">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-sm font-mono">
                    {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                  </span>
                  <div className="flex-1 flex items-center gap-0.5 px-2">
                    {voiceVolumeBars.map((h, i) => (
                      <div
                        key={i}
                        className="w-1 bg-[#00a884] rounded-full transition-[height] duration-75"
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                </div>
                <button onClick={cancelVoiceRecording} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#2a3942] transition-colors">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </button>
                <button onClick={stopAndSendVoiceRecording} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-white transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            ) : (
              /* Normal Input Mode */
              <div className="flex items-end gap-2">
                {/* Emoji Button */}
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false) }}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#2a3942] transition-colors flex-shrink-0"
                  >
                    <Smile className="w-6 h-6 text-[#8696a0]" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-12 left-0 bg-[#233138] rounded-xl shadow-lg p-3 w-[320px] max-h-[280px] overflow-y-auto z-50">
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJI_LIST.map((emoji, i) => (
                          <button
                            key={i}
                            onClick={() => insertEmoji(emoji)}
                            className="w-8 h-8 flex items-center justify-center text-xl hover:bg-[#182229] rounded transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Attachment Button */}
                <div className="relative" ref={attachMenuRef}>
                  <button
                    onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false) }}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#2a3942] transition-colors flex-shrink-0"
                  >
                    <Paperclip className="w-6 h-6 text-[#8696a0]" />
                  </button>
                  {showAttachMenu && (
                    <div className="absolute bottom-12 left-0 bg-[#233138] rounded-xl shadow-lg py-2 w-[180px] z-50">
                      <button
                        onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click() } setShowAttachMenu(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#182229] transition-colors"
                      >
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[#e9edef] text-sm">Fotos</span>
                      </button>
                      <button
                        onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = '*/*'; fileInputRef.current.click() } setShowAttachMenu(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#182229] transition-colors"
                      >
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <FileText className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[#e9edef] text-sm">Documento</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Text Input */}
                <div className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2">
                  <textarea
                    value={selectedFile ? mediaCaption : messageInput}
                    onChange={(e) => selectedFile ? setMediaCaption(e.target.value) : setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedFile ? "Adicionar legenda..." : "Digite uma mensagem"}
                    rows={1}
                    className="w-full bg-transparent text-[#e9edef] text-sm placeholder-[#8696a0] outline-none resize-none max-h-[120px] overflow-y-auto"
                    style={{ minHeight: '20px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement
                      target.style.height = '20px'
                      target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                    }}
                  />
                </div>

                {/* Mic / Send Button */}
                {(messageInput.trim() || selectedFile) ? (
                  <button
                    onClick={selectedFile ? handleSendMedia : handleSendMessage}
                    disabled={isSending || (!messageInput.trim() && !selectedFile)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-[#00a884] hover:bg-[#06cf9c] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                ) : (
                  <button
                    onClick={startVoiceRecording}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#2a3942] transition-colors flex-shrink-0"
                  >
                    <Mic className="w-6 h-6 text-[#8696a0]" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
        </div>

      </div>
    )
  }

  // Render analysis results
  const renderAnalysisResults = () => {
    const savedData = selectedConversation ? savedAnalyses[selectedConversation.contact_phone] : null
    const analysisDate = savedData?.date ? new Date(savedData.date) : null

    return (
    <div className="space-y-3">
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
          <h3 className="text-sm font-semibold text-[#e9edef]">Notas por Criterio</h3>
        </div>
        <div className="space-y-2">
          {Object.entries(analysis!.notas).map(([key, value]) => {
            const fieldLabels: Record<string, string> = {
              'valor_agregado': 'Valor Agregado',
              'personalizacao': 'Personalizacao',
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
          <h3 className="text-sm font-semibold text-[#53bdeb]">Versao Melhorada</h3>
        </div>
        <div className="bg-[#111b21] rounded-lg p-2">
          <pre className="whitespace-pre-wrap text-[#e9edef] text-xs font-sans">{analysis!.versao_reescrita}</pre>
        </div>
      </div>
    </div>
  )}

  return (
    <div className="flex h-screen overflow-hidden bg-[#111b21]">
      {connectionStatus === 'connected' ? (
        <>
          {renderChatSidebar()}
          {renderMainContent()}
          <SalesCopilot
            selectedConversation={selectedConversation}
            messages={messages}
            authToken={authToken}
            companyData={companyData}
            isVisible={connectionStatus === 'connected' && !!selectedConversation}
          />
        </>
      ) : connectionStatus === 'initializing' || connectionStatus === 'qr_ready' || connectionStatus === 'connecting' ? (
        renderConnecting()
      ) : (
        renderDisconnected()
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl font-light z-10"
            onClick={() => setLightboxImage(null)}
          >
            ✕
          </button>
          <img
            src={lightboxImage}
            alt="Imagem ampliada"
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
