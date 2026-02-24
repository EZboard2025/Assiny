'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, CheckCircle, AlertCircle, X, FileText, Lightbulb, BarChart3, MessageSquare, RefreshCw, LogOut, Smartphone, Search, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, ArrowLeft, Send, Smile, Paperclip, Mic, Trash2, Image as ImageIcon, Users, MoreVertical, Camera, Headphones, Contact, Sticker, Star, Bell, Lock, Shield, Heart, Ban, Flag, MapPin, Mail, Globe, Clock, Share2, Building2, Pencil, MessageCirclePlus, EllipsisVertical, Sparkles, Zap } from 'lucide-react'
import SalesCopilot from './SalesCopilot'
import AutopilotPanel from './autopilot/AutopilotPanel'
import AutopilotActivityIndicator from './AutopilotActivityIndicator'

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
  last_message_sender: string | null
  last_message_from_me: boolean
  unread_count: number
  message_count: number
}

interface WhatsAppMessage {
  id: string
  waMessageId?: string
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
  isAutopilot?: boolean
  quotedMsg?: {
    body: string
    fromMe: boolean
    type: string
    contactName?: string | null
  } | null
}

type ConnectionStatus = 'disconnected' | 'checking' | 'initializing' | 'qr_ready' | 'connecting' | 'connected'

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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking')
  const [copilotOpen, setCopilotOpen] = useState(true)
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [showAutopilotPanel, setShowAutopilotPanel] = useState(false)
  const [autopilotEnabled, setAutopilotEnabled] = useState(false)
  const [autopilotPhones, setAutopilotPhones] = useState<Map<string, { objective_reached: boolean, needs_human: boolean, enabled: boolean }>>(new Map())
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Message input state
  const [messageInput, setMessageInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const selectedConvRef = useRef<WhatsAppConversation | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  // Media send state
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showContactPicker, setShowContactPicker] = useState(false)
  const [contactSearchQuery, setContactSearchQuery] = useState('')
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all')
  const [contactDetailInfo, setContactDetailInfo] = useState<any>(null)
  const [isLoadingContactInfo, setIsLoadingContactInfo] = useState(false)
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

  // New conversation / contact state
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [showNewContactForm, setShowNewContactForm] = useState(false)
  const [newContactName, setNewContactName] = useState('')
  const [newContactSurname, setNewContactSurname] = useState('')
  const [newContactPhone, setNewContactPhone] = useState('')
  const [newConversationSearch, setNewConversationSearch] = useState('')

  // Message dropdown menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: WhatsAppMessage } | null>(null)
  const [isDeletingMessage, setIsDeletingMessage] = useState(false)
  const [editingMessage, setEditingMessage] = useState<WhatsAppMessage | null>(null)
  const [editInput, setEditInput] = useState('')
  const [replyingTo, setReplyingTo] = useState<WhatsAppMessage | null>(null)
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null)
  const [forwardingMessage, setForwardingMessage] = useState<WhatsAppMessage | null>(null)
  const [forwardSearch, setForwardSearch] = useState('')

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({})
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioProgressTimer = useRef<NodeJS.Timeout | null>(null)

  const playAudio = (msgId: string, mediaId: string) => {
    // If same audio is playing, pause it
    if (playingAudioId === msgId && audioRef.current) {
      audioRef.current.pause()
      setPlayingAudioId(null)
      if (audioProgressTimer.current) clearInterval(audioProgressTimer.current)
      return
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      if (audioProgressTimer.current) clearInterval(audioProgressTimer.current)
    }

    const audio = new Audio(getMediaSrc(mediaId))
    audioRef.current = audio
    setPlayingAudioId(msgId)

    audio.onloadedmetadata = () => {
      setAudioDurations(prev => ({ ...prev, [msgId]: audio.duration }))
    }

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setAudioProgress(prev => ({ ...prev, [msgId]: audio.currentTime / audio.duration }))
      }
    }

    audio.onended = () => {
      setPlayingAudioId(null)
      setAudioProgress(prev => ({ ...prev, [msgId]: 0 }))
      if (audioProgressTimer.current) clearInterval(audioProgressTimer.current)
    }

    audio.onerror = () => {
      console.error('[Audio] Failed to play:', mediaId)
      setPlayingAudioId(null)
    }

    audio.play().catch(err => {
      console.error('[Audio] Play error:', err)
      setPlayingAudioId(null)
    })
  }

  const formatAudioTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<FollowUpAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Helper: detect disconnection from API 404 responses and redirect to QR screen
  const handleApiDisconnect = (response: Response) => {
    if (response.status === 404) {
      setConnectionStatus('disconnected')
      setPhoneNumber(null)
      setConversations([])
      setSelectedConversation(null)
      setMessages([])
      setError('WhatsApp desconectado. Reconecte para continuar.')
      return true
    }
    return false
  }
  const [savedAnalyses, setSavedAnalyses] = useState<Record<string, { analysis: FollowUpAnalysis; date: string }>>({})
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false)

  // Sync status from backend
  const [syncStatus, setSyncStatus] = useState<'pending' | 'syncing' | 'synced' | 'error' | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Message search state
  const [isSearchingMessages, setIsSearchingMessages] = useState(false)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const [searchMatchIds, setSearchMatchIds] = useState<string[]>([])
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const messageSearchInputRef = useRef<HTMLInputElement>(null)

  // Auth token for API calls
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null)

  // Helper to get auth headers
  const getAuthHeaders = (): HeadersInit => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
    return headers
  }

  // NOTE: Auto-disconnect removed. Only the server-side TTL reaper (20 min inactivity)
  // should disconnect the client. API errors just show error messages, not full disconnect.

  // Load auth token on mount — uses getUser() first (server-validated, never stale)
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const { supabase } = await import('@/lib/supabase')

        // Strategy 1: getUser() → refreshSession() — server-validated, avoids stale localStorage
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setAuthEmail(user.email || null)
          const { data: { session } } = await supabase.auth.refreshSession()
          if (session?.access_token) {
            setAuthToken(session.access_token)
            console.log(`[Auth] Loaded token for ${user.email} (${user.id})`)
            return
          }
        }

        // Strategy 2: getSession fallback
        const { data: { session: fallback } } = await supabase.auth.getSession()
        if (fallback?.access_token) {
          setAuthToken(fallback.access_token)
          setAuthEmail(fallback.user?.email || null)
          console.log(`[Auth] Fallback token for ${fallback.user?.email}`)
          return
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
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.access_token) {
          setAuthToken(session.access_token)
        } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          // Session expired or user signed out - clear stale token
          setAuthToken(null)
        }
      })
      subscription = data.subscription
    })()

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Check Google Calendar connection status
  useEffect(() => {
    if (!authToken) return
    fetch('/api/calendar/status', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(r => r.json())
      .then(data => setCalendarConnected(data.connected === true))
      .catch(() => {})
  }, [authToken])

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

  // Load autopilot config + contacts on mount
  const loadAutopilotData = useCallback(() => {
    if (!authToken) return
    const headers = { 'Authorization': `Bearer ${authToken}` }
    fetch('/api/autopilot/config', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.config?.enabled) setAutopilotEnabled(true)
        else setAutopilotEnabled(false)
      })
      .catch(() => {})
    fetch('/api/autopilot/contacts', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.contacts) {
          const phoneMap = new Map<string, { objective_reached: boolean, needs_human: boolean, enabled: boolean }>()
          data.contacts.forEach((c: any) => {
            // Include enabled contacts AND disabled contacts that have objective_reached/needs_human (for status indicators)
            if (c.enabled || c.objective_reached || c.needs_human) {
              const suffix = c.contact_phone.replace(/@.*$/, '').replace(/[^0-9]/g, '').slice(-9)
              phoneMap.set(suffix, {
                objective_reached: !!c.objective_reached,
                needs_human: !!c.needs_human,
                enabled: !!c.enabled
              })
            }
          })
          setAutopilotPhones(phoneMap)
        }
      })
      .catch(() => {})
  }, [authToken])

  useEffect(() => {
    loadAutopilotData()
  }, [loadAutopilotData])

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

  // NOTE: We intentionally do NOT disconnect on page unload/refresh.
  // The WhatsApp client persists server-side so it survives page refreshes.
  // Disconnection is only triggered manually via the logout button.

  // Check for existing active connection on mount (survives page refresh)
  useEffect(() => {
    if (!authToken) return

    const checkExistingConnection = async () => {
      try {
        const response = await fetch('/api/whatsapp/status', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
        const data = await response.json()

        if (data.connected && data.status === 'active') {
          // Client is connected — restore UI
          console.log('[WA] Reconnecting to existing session:', data.phone_number)
          setConnectionStatus('connected')
          setPhoneNumber(data.phone_number || null)

          fetch('/api/whatsapp/heartbeat', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
          }).catch(() => {})

          loadConversations(true)
        } else if (data.status === 'qr_ready' && data.qrCode) {
          // QR pending — show it and start polling
          console.log('[WA] Resuming QR code session')
          setQrCode(data.qrCode)
          setConnectionStatus('qr_ready')
          setIsInitializing(true)
          startPolling()
        } else if (data.status === 'initializing' || data.status === 'connecting') {
          // Still initializing — show loading and start polling
          console.log('[WA] Resuming initialization:', data.status)
          setConnectionStatus(data.status as ConnectionStatus)
          setIsInitializing(true)
          startPolling()
        } else if (data.status === 'error') {
          // Stale error — show error and let user retry
          console.warn('[WA] Server has stale error client:', data.error)
          setError(data.error || 'Erro na conexão anterior. Tente novamente.')
          setConnectionStatus('disconnected')
        } else {
          // disconnected — stay on connect screen
          setConnectionStatus('disconnected')
        }
      } catch (err) {
        console.warn('[WA] Could not check existing connection:', err)
        setConnectionStatus('disconnected')
      }
    }

    if (connectionStatus === 'checking' || connectionStatus === 'disconnected') {
      checkExistingConnection()
    }
  }, [authToken])

  // Heartbeat: keep server-side WhatsApp session alive
  const heartbeatFailCountRef = useRef(0)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (connectionStatus === 'connected' && authToken) {
      heartbeatFailCountRef.current = 0

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
            const heartbeatData = await response.json().catch(() => ({}))

            // Client exists but lost connection (session expired → qr_ready, error, etc.)
            // Immediately show disconnected so user can re-scan QR
            if (heartbeatData.status === 'not_connected') {
              console.warn(`[Heartbeat] Client lost connection: ${heartbeatData.clientStatus}`)
              setConnectionStatus('disconnected')
              setPhoneNumber(null)
              setError('Sessão expirou. Reconecte o WhatsApp.')
              return
            }

            // Server has no client — try silent auto-reconnect using cached LocalAuth session
            console.warn('[Heartbeat] Server returned 404 — attempting silent auto-reconnect...')
            try {
              const reconnectRes = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
              })
              const reconnectData = await reconnectRes.json()
              if (reconnectData.status === 'connected') {
                console.log('[Heartbeat] Auto-reconnect succeeded!')
                heartbeatFailCountRef.current = 0
              } else if (reconnectData.status === 'qr_ready' || reconnectData.status === 'initializing' || reconnectData.status === 'connecting') {
                // Needs QR or still connecting — wait for next heartbeat
                heartbeatFailCountRef.current++
                console.log(`[Heartbeat] Reconnect in progress: ${reconnectData.status} (${heartbeatFailCountRef.current}/3)`)
                if (heartbeatFailCountRef.current >= 3) {
                  setConnectionStatus('disconnected')
                  setPhoneNumber(null)
                  setError('Conexao perdida. Reconecte o WhatsApp.')
                }
              } else {
                heartbeatFailCountRef.current++
                if (heartbeatFailCountRef.current >= 2) {
                  setConnectionStatus('disconnected')
                  setPhoneNumber(null)
                  setError('Conexao perdida. Reconecte o WhatsApp.')
                }
              }
            } catch {
              heartbeatFailCountRef.current++
              if (heartbeatFailCountRef.current >= 2) {
                setConnectionStatus('disconnected')
                setPhoneNumber(null)
                setError('Conexao perdida. Reconecte o WhatsApp.')
              }
            }
          } else {
            // Reset counter on success
            heartbeatFailCountRef.current = 0
          }
        } catch {
          console.warn('[Heartbeat] Network error')
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
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  // Poll for new messages when a conversation is selected
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (connectionStatus === 'connected' && selectedConversation && authToken) {
      interval = setInterval(async () => {
        const currentConv = selectedConvRef.current
        if (!currentConv) return

        try {
          // Fetch only recent messages for polling (50 is enough to detect new ones + status updates)
          const response = await fetch(
            `/api/whatsapp/messages?contactPhone=${encodeURIComponent(currentConv.contact_phone)}&limit=50`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
          )
          const data = await response.json()

          if (data.messages) {
            setMessages(prev => {
              const tempMessages = prev.filter(m => m.id.startsWith('temp_'))
              const realPrev = prev.filter(m => !m.id.startsWith('temp_'))

              const existingIds = new Set(realPrev.map(m => m.id))

              // Find truly new messages not in our current state
              const newMsgs = (data.messages as WhatsAppMessage[]).filter(m => !existingIds.has(m.id))

              // Update statuses of existing messages from fresh data
              const freshMap = new Map((data.messages as WhatsAppMessage[]).map((m: WhatsAppMessage) => [m.id, m]))
              let hasStatusChanges = false
              const updatedPrev = realPrev.map(m => {
                const fresh = freshMap.get(m.id)
                if (fresh && fresh.status !== m.status) {
                  hasStatusChanges = true
                  return { ...m, status: fresh.status }
                }
                return m
              })

              if (newMsgs.length === 0 && !hasStatusChanges) return prev

              // Build lookup of existing quotedMsg data to preserve across reloads
              const existingQuotedMsgs = new Map<string, WhatsAppMessage['quotedMsg']>()
              realPrev.forEach(m => {
                if (m.quotedMsg && (m.waMessageId || m.id)) {
                  existingQuotedMsgs.set(m.waMessageId || m.id, m.quotedMsg)
                }
              })

              // Merge new messages with quotedMsg preservation
              const mergedNew = newMsgs.map((m: WhatsAppMessage) => {
                if (!m.quotedMsg) {
                  const existing = existingQuotedMsgs.get(m.waMessageId || m.id)
                  if (existing) return { ...m, quotedMsg: existing }
                }
                return m
              })

              // Remove temp messages that now have a real DB version
              const remainingTemps = tempMessages.filter(t =>
                !newMsgs.some(n => n.body === t.body && n.fromMe === t.fromMe)
              )

              return [...updatedPrev, ...mergedNew, ...remainingTemps]
            })
          }
        } catch (e) {
          // Silent fail for polling
        }
      }, 5000) // Poll own DB every 5s (no WhatsApp API calls, no ban risk)
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
            // Preserve synthetic conversations and contact names across polling updates
            setConversations(prev => {
              // Build a map of names from previous state (synthetic + user-assigned)
              const prevNameMap = new Map<string, string>()
              prev.forEach(c => {
                if (c.contact_name) {
                  const suffix = c.contact_phone.replace(/[^0-9]/g, '').slice(-8)
                  prevNameMap.set(suffix, c.contact_name)
                }
              })

              // Preserve synthetic conversations that don't have a DB counterpart yet
              const syntheticConvs = prev.filter(c =>
                typeof c.id === 'string' && c.id.startsWith('new_') &&
                !data.conversations.some((dc: WhatsAppConversation) =>
                  dc.contact_phone.replace(/[^0-9]/g, '').slice(-8) === c.contact_phone.replace(/[^0-9]/g, '').slice(-8)
                )
              )

              // Enrich DB conversations: if DB has no name but previous state did, keep the name
              const enriched = data.conversations.map((dc: WhatsAppConversation) => {
                if (!dc.contact_name) {
                  const suffix = dc.contact_phone.replace(/[^0-9]/g, '').slice(-8)
                  const prevName = prevNameMap.get(suffix)
                  if (prevName) return { ...dc, contact_name: prevName }
                }
                return dc
              })

              return [...syntheticConvs, ...enriched]
            })
            const currentConv = selectedConvRef.current
            if (currentConv) {
              const updated = data.conversations.find((c: WhatsAppConversation) => c.contact_phone === currentConv.contact_phone)
              if (updated) {
                setSelectedConversation(prev => prev ? {
                  ...prev,
                  unread_count: updated.unread_count,
                  last_message_preview: updated.last_message_preview,
                  last_message_sender: updated.last_message_sender,
                  last_message_from_me: updated.last_message_from_me,
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
      const res = await fetch('/api/whatsapp/status', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await res.json()

      if (data.connected) {
        setConnectionStatus('connected')
        setPhoneNumber(data.phone_number || null)
        loadConversations(true)
        // One retry in case sync is still in progress (silent — no spinner)
        setTimeout(() => loadConversations(), 10000)
      } else {
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      console.error('Error checking status:', error)
      setConnectionStatus('disconnected')
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
          // Load conversations: initial + 2 retries while sync completes
          loadConversations(true)
          setTimeout(() => loadConversations(), 8000)
          setTimeout(() => loadConversations(), 25000)
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
        loadConversations(true)
        setTimeout(() => loadConversations(), 8000)
        setTimeout(() => loadConversations(), 25000)
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
      } else {
        setSyncStatus('error')
      }
    } catch (error) {
      setSyncStatus('error')
    } finally {
      setIsSyncing(false)
      // Always load conversations from DB — real-time messages create conversations
      // even when sync (getChats) fails
      loadConversations()
    }
  }

  const loadConversations = async (showSpinner = false) => {
    if (!authToken) return

    // Only show loading spinner on first load — subsequent refreshes update silently
    if (showSpinner) setIsLoadingConversations(true)
    try {
      const response = await fetch('/api/whatsapp/conversations', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.status === 404) {
        // Server may be temporarily unavailable — don't disconnect
        console.warn('[loadConversations] Got 404, ignoring (TTL reaper handles disconnect)')
        return
      }

      const data = await response.json()

      if (data.conversations) {
        setConversations(prev => {
          // Build name map from previous state to preserve user-assigned names
          const prevNameMap = new Map<string, string>()
          prev.forEach(c => {
            if (c.contact_name) {
              const suffix = c.contact_phone.replace(/[^0-9]/g, '').slice(-8)
              prevNameMap.set(suffix, c.contact_name)
            }
          })

          // Keep synthetic conversations not yet in DB
          const syntheticConvs = prev.filter(c =>
            typeof c.id === 'string' && c.id.startsWith('new_') &&
            !data.conversations.some((dc: WhatsAppConversation) =>
              dc.contact_phone.replace(/[^0-9]/g, '').slice(-8) === c.contact_phone.replace(/[^0-9]/g, '').slice(-8)
            )
          )

          // Enrich DB conversations with preserved names
          const enriched = data.conversations.map((dc: WhatsAppConversation) => {
            if (!dc.contact_name) {
              const suffix = dc.contact_phone.replace(/[^0-9]/g, '').slice(-8)
              const prevName = prevNameMap.get(suffix)
              if (prevName) return { ...dc, contact_name: prevName }
            }
            return dc
          })

          return [...syntheticConvs, ...enriched]
        })
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      if (showSpinner) setIsLoadingConversations(false)
    }
  }

  // Fetch detailed contact info (business profile, about, profile pic)
  const fetchContactInfo = async (contactPhone: string) => {
    if (!authToken) return
    setIsLoadingContactInfo(true)
    setContactDetailInfo(null)
    try {
      const res = await fetch(`/api/whatsapp/contact-info?contactPhone=${encodeURIComponent(contactPhone)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setContactDetailInfo(data.contactInfo || null)
      }
    } catch (err) {
      console.error('Error fetching contact info:', err)
    } finally {
      setIsLoadingContactInfo(false)
    }
  }

  const loadMessages = async (contactPhone: string) => {
    if (!authToken) return

    setIsLoadingMessages(true)
    setMessages([])
    setHasMoreMessages(false)
    try {
      const response = await fetch(
        `/api/whatsapp/messages?contactPhone=${encodeURIComponent(contactPhone)}`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      )
      const data = await response.json()

      if (data.messages) {
        setMessages(data.messages)
        setHasMoreMessages(data.hasMore === true)
      }

      // Try to sync more history from WhatsApp in background
      // Only if we have few messages (less than 10)
      // Skip sync for synthetic (new) conversations — no chat exists in WhatsApp yet
      const isSyntheticConv = selectedConvRef.current?.id?.startsWith('new_')
      if (connectionStatus === 'connected' && !isSyntheticConv && (!data.messages || data.messages.length < 10)) {
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

      if (!response.ok) return // Silently fail - sync is optional

      if (data.synced > 0) {
        console.log(`[Sync] Synced ${data.synced} new messages, reloading...`)
        // Reload messages to show the new ones
        const reloadResponse = await fetch(
          `/api/whatsapp/messages?contactPhone=${encodeURIComponent(contactPhone)}`,
          { headers: { 'Authorization': `Bearer ${authToken}` } }
        )
        const reloadData = await reloadResponse.json()
        if (reloadData.messages) {
          setMessages(prev => {
            // Preserve quotedMsg from existing state
            const existingQuotes = new Map<string, WhatsAppMessage['quotedMsg']>()
            prev.forEach(m => {
              if (m.quotedMsg && (m.waMessageId || m.id)) {
                existingQuotes.set(m.waMessageId || m.id, m.quotedMsg)
              }
            })
            return reloadData.messages.map((m: WhatsAppMessage) => {
              if (!m.quotedMsg) {
                const existing = existingQuotes.get(m.waMessageId || m.id)
                if (existing) return { ...m, quotedMsg: existing }
              }
              return m
            })
          })
          setHasMoreMessages(reloadData.hasMore === true)
        }
      }
    } catch (error) {
      // Silently fail - sync is optional enhancement
      console.error('[Sync] Error syncing history:', error)
    }
  }

  // Load older messages (pagination)
  const loadOlderMessages = async () => {
    if (!authToken || !selectedConversation || isLoadingMore || messages.length === 0) return

    setIsLoadingMore(true)
    try {
      const oldestTimestamp = messages[0]?.timestamp
      if (!oldestTimestamp) return

      const container = messagesContainerRef.current
      const prevScrollHeight = container?.scrollHeight || 0

      const response = await fetch(
        `/api/whatsapp/messages?contactPhone=${encodeURIComponent(selectedConversation.contact_phone)}&before=${encodeURIComponent(oldestTimestamp)}`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      )
      const data = await response.json()

      if (data.messages && data.messages.length > 0) {
        setMessages(prev => [...data.messages, ...prev])
        setHasMoreMessages(data.hasMore === true)

        // Preserve scroll position after prepending
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight
            container.scrollTop = newScrollHeight - prevScrollHeight
          }
        })
      } else {
        setHasMoreMessages(false)
      }
    } catch (error) {
      console.error('Error loading older messages:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleSendMessage = async (directText?: string) => {
    const text = directText?.trim() || messageInput.trim()
    if (!selectedConversation || !text || isSending) return

    if (!directText) setMessageInput('')
    const currentReply = replyingTo
    setReplyingTo(null)
    setIsSending(true)

    // Optimistic update
    const tempMsg: WhatsAppMessage = {
      id: `temp_${Date.now()}`,
      body: text,
      fromMe: true,
      timestamp: new Date().toISOString(),
      type: 'text',
      hasMedia: false,
      quotedMsg: currentReply ? {
        body: currentReply.body,
        fromMe: currentReply.fromMe,
        type: currentReply.type,
        contactName: currentReply.contactName
      } : null
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const sendBody: any = {
        to: selectedConversation.contact_phone,
        message: text
      }
      if (currentReply?.waMessageId) {
        sendBody.quotedMessageId = currentReply.waMessageId
      }

      let response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(sendBody)
      })

      if (handleApiDisconnect(response)) {
        setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id))
        return
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem')
      }

      // Replace temp message with real one (preserve quotedMsg from optimistic update)
      setMessages(prev => prev.map(msg =>
        msg.id === tempMsg.id ? { ...data.message, quotedMsg: tempMsg.quotedMsg } : msg
      ))
    } catch (err) {
      console.error('Error sending message:', err)
      setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id))
      const errMsg = err instanceof Error ? err.message : 'Erro ao enviar mensagem'
      // Improve whatsapp-web.js cryptic errors
      if (errMsg.includes('No LID') || errMsg.includes('no LID')) {
        setError('Este número não está registrado no WhatsApp. Verifique o número e tente novamente.')
      } else {
        setError(errMsg)
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (editingMessage) {
        e.preventDefault()
        cancelEdit()
        return
      }
      if (replyingTo) {
        e.preventDefault()
        setReplyingTo(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (editingMessage) {
        handleEditMessage()
      } else if (selectedFile) {
        handleSendMedia()
      } else {
        handleSendMessage()
      }
    }
  }

  // ============================================
  // Message context menu (right-click delete)
  // ============================================

  const handleMessageContextMenu = (e: React.MouseEvent, msg: WhatsAppMessage) => {
    e.preventDefault()
    if (msg.id.startsWith('temp_')) return // Can't delete temp messages
    setContextMenu({ x: e.clientX, y: e.clientY, message: msg })
  }

  const handleDeleteMessage = async (forEveryone: boolean) => {
    if (!contextMenu || !authToken) return

    const msg = contextMenu.message
    closeContextMenu()
    setIsDeletingMessage(true)

    try {
      const response = await fetch('/api/whatsapp/delete-message', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          waMessageId: msg.waMessageId || msg.id,
          deleteForEveryone: forEveryone
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao apagar mensagem')
      }

      if (forEveryone) {
        // Show "deleted" placeholder like WhatsApp
        setMessages(prev => prev.map(m =>
          m.id === msg.id
            ? { ...m, type: 'revoked', body: '', hasMedia: false, mediaId: null }
            : m
        ))
      } else {
        // Delete for me: just remove from view
        setMessages(prev => prev.filter(m => m.id !== msg.id))
      }
    } catch (err) {
      console.error('Error deleting message:', err)
      setError(err instanceof Error ? err.message : 'Erro ao apagar mensagem')
    } finally {
      setIsDeletingMessage(false)
    }
  }

  const startEditMessage = () => {
    if (!contextMenu) return
    const msg = contextMenu.message
    setEditingMessage(msg)
    setEditInput(msg.body || '')
    closeContextMenu()
  }

  const cancelEdit = () => {
    setEditingMessage(null)
    setEditInput('')
  }

  const handleEditMessage = async () => {
    if (!editingMessage || !authToken || !editInput.trim()) return

    const newContent = editInput.trim()
    if (newContent === editingMessage.body) {
      cancelEdit()
      return
    }

    try {
      const response = await fetch('/api/whatsapp/edit-message', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          waMessageId: editingMessage.waMessageId || editingMessage.id,
          newContent
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao editar mensagem')
      }

      // Update message in local state
      setMessages(prev => prev.map(m =>
        m.id === editingMessage.id ? { ...m, body: newContent } : m
      ))
      cancelEdit()
    } catch (err) {
      console.error('Error editing message:', err)
      setError(err instanceof Error ? err.message : 'Erro ao editar mensagem')
    }
  }

  const closeContextMenu = () => {
    setContextMenu(null)
    setHoveredMsgId(null)
  }

  const startForwardMessage = () => {
    if (!contextMenu) return
    setForwardingMessage(contextMenu.message)
    setForwardSearch('')
    closeContextMenu()
  }

  const handleForwardMessage = async (targetConversation: WhatsAppConversation) => {
    if (!forwardingMessage || !authToken) return
    const waMessageId = forwardingMessage.waMessageId
    if (!waMessageId) return

    const targetChatId = targetConversation.contact_phone.includes('@')
      ? targetConversation.contact_phone
      : targetConversation.contact_phone + '@c.us'

    setForwardingMessage(null)

    try {
      const response = await fetch('/api/whatsapp/forward-message', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ waMessageId, targetChatId })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao reencaminhar mensagem')
      }
    } catch (err) {
      console.error('Error forwarding message:', err)
      setError(err instanceof Error ? err.message : 'Erro ao reencaminhar mensagem')
    }
  }

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => closeContextMenu()
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

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
    const currentReply = replyingTo
    setReplyingTo(null)

    const tempMsg: WhatsAppMessage = {
      id: `temp_${Date.now()}`,
      body: caption || '',
      fromMe: true,
      timestamp: new Date().toISOString(),
      type: type,
      hasMedia: true,
      mediaId: selectedFile.previewUrl || null,
      mimetype: file.type,
      quotedMsg: currentReply ? {
        body: currentReply.body,
        fromMe: currentReply.fromMe,
        type: currentReply.type,
        contactName: currentReply.contactName
      } : null
    }
    setMessages(prev => [...prev, tempMsg])
    clearSelectedFile()

    try {
      const formData = new FormData()
      formData.append('to', selectedConversation.contact_phone)
      formData.append('file', file)
      formData.append('type', type)
      if (caption) formData.append('caption', caption)
      if (currentReply?.waMessageId) formData.append('quotedMessageId', currentReply.waMessageId)

      let response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      })

      if (handleApiDisconnect(response)) {
        setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id))
        return
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar midia')
      }

      setMessages(prev => prev.map(msg =>
        msg.id === tempMsg.id ? { ...data.message, quotedMsg: tempMsg.quotedMsg } : msg
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
  // Send contact
  // ============================================

  const handleSendContact = async (contact: WhatsAppConversation) => {
    if (!selectedConversation || isSending) return

    setShowContactPicker(false)
    setContactSearchQuery('')
    setIsSending(true)

    const tempMsg: WhatsAppMessage = {
      id: `temp_${Date.now()}`,
      body: `👤 ${contact.contact_name || formatPhone(contact.contact_phone)}`,
      fromMe: true,
      timestamp: new Date().toISOString(),
      type: 'contacts',
      hasMedia: false,
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      const contactPayload = {
        to: selectedConversation.contact_phone,
        type: 'contact',
        contactName: contact.contact_name || formatPhone(contact.contact_phone),
        contactPhone: contact.contact_phone
      }

      let response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(contactPayload)
      })

      if (handleApiDisconnect(response)) {
        setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id))
        return
      }

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar contato')

      setMessages(prev => prev.map(msg =>
        msg.id === tempMsg.id ? data.message : msg
      ))
    } catch (err) {
      console.error('Error sending contact:', err)
      setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id))
      setError(err instanceof Error ? err.message : 'Erro ao enviar contato')
    } finally {
      setIsSending(false)
    }
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

      if (handleApiDisconnect(response)) {
        setMessages(prev => prev.filter(msg => msg.id !== tempMsg.id))
        return
      }

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar audio')
      }

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

  // Message search functions
  const openMessageSearch = () => {
    setIsSearchingMessages(true)
    setMessageSearchQuery('')
    setSearchMatchIds([])
    setActiveSearchIndex(-1)
    setTimeout(() => messageSearchInputRef.current?.focus(), 100)
  }

  const closeMessageSearch = () => {
    setIsSearchingMessages(false)
    setMessageSearchQuery('')
    setSearchMatchIds([])
    setActiveSearchIndex(-1)
  }

  const handleMessageSearch = (query: string) => {
    setMessageSearchQuery(query)
    if (!query.trim()) {
      setSearchMatchIds([])
      setActiveSearchIndex(-1)
      return
    }
    const q = query.toLowerCase()
    const matches = messages
      .filter(msg => msg.body && msg.body.toLowerCase().includes(q))
      .map(msg => msg.id)
    setSearchMatchIds(matches)
    if (matches.length > 0) {
      setActiveSearchIndex(matches.length - 1)
      scrollToMessage(matches[matches.length - 1])
    } else {
      setActiveSearchIndex(-1)
    }
  }

  const navigateSearch = (direction: 'up' | 'down') => {
    if (searchMatchIds.length === 0) return
    let newIndex = activeSearchIndex
    if (direction === 'up') {
      newIndex = activeSearchIndex > 0 ? activeSearchIndex - 1 : searchMatchIds.length - 1
    } else {
      newIndex = activeSearchIndex < searchMatchIds.length - 1 ? activeSearchIndex + 1 : 0
    }
    setActiveSearchIndex(newIndex)
    scrollToMessage(searchMatchIds[newIndex])
  }

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`)
    const container = messagesContainerRef.current
    if (el && container) {
      const elTop = el.offsetTop
      const elHeight = el.offsetHeight
      const containerHeight = container.clientHeight
      container.scrollTo({ top: elTop - containerHeight / 2 + elHeight / 2, behavior: 'smooth' })
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      navigateSearch(e.shiftKey ? 'up' : 'down')
    } else if (e.key === 'Escape') {
      closeMessageSearch()
    }
  }

  const selectConversation = (conv: WhatsAppConversation) => {
    setSelectedConversation(conv)
    setError(null)
    closeMessageSearch()
    setShowContactInfo(false)
    setContactDetailInfo(null)
    cancelEdit()
    setReplyingTo(null)
    // Stop any playing audio
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setPlayingAudioId(null)
    setAudioProgress({})
    setAudioDurations({})

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

  const handleSaveNewContact = () => {
    const name = newContactName.trim()
    if (!name) return

    const cleanPhone = newContactPhone.replace(/[^0-9]/g, '')
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      setError('Telefone inválido. Digite DDD + número (ex: 31947133578)')
      return
    }

    const fullPhone = `55${cleanPhone}`
    const fullName = newContactSurname.trim()
      ? `${name} ${newContactSurname.trim()}`
      : name

    // Check if conversation already exists (suffix match on last 8 digits)
    const existingConv = conversations.find(c => {
      const cDigits = c.contact_phone.replace(/[^0-9]/g, '')
      return cDigits.slice(-8) === fullPhone.slice(-8)
    })

    if (existingConv) {
      selectConversation(existingConv)
    } else {
      const newConv: WhatsAppConversation = {
        id: `new_${Date.now()}`,
        contact_phone: fullPhone,
        contact_name: fullName,
        profile_pic_url: null,
        last_message_at: null,
        last_message_preview: null,
        last_message_sender: null,
        last_message_from_me: false,
        unread_count: 0,
        message_count: 0
      }
      setConversations(prev => [newConv, ...prev])
      setSelectedConversation(newConv)
      setMessages([])
    }

    // Reset form and close panels
    setNewContactName('')
    setNewContactSurname('')
    setNewContactPhone('')
    setNewConversationSearch('')
    setShowNewContactForm(false)
    setShowNewConversation(false)
    setError(null)
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
    if (phone.length === 13) {
      // 13 digits: +55 (31) 94713-3578
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`
    }
    if (phone.length >= 12) {
      // 12 digits: +55 (31) 9471-3357 (4 digits after hyphen)
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, phone.length - 4)}-${phone.slice(phone.length - 4)}`
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

  // Filter conversations by search and tab filter
  const filteredConversations = conversations.filter(conv => {
    // Search filter
    const matchesSearch = !searchQuery ||
      (conv.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.contact_phone.includes(searchQuery) ||
      (conv.last_message_preview || '').toLowerCase().includes(searchQuery.toLowerCase())

    // Tab filter
    if (chatFilter === 'unread') return matchesSearch && conv.unread_count > 0
    if (chatFilter === 'groups') return matchesSearch && conv.contact_phone.includes('@g.us')

    return matchesSearch
  })

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
            <h2 className="text-[#e9edef] text-xl mb-2">Conectando ao WhatsApp...</h2>
            <p className="text-[#8696a0] text-sm">Carregando suas conversas. Pode levar ate 3 minutos.</p>
            <p className="text-[#8696a0] text-xs mt-2">Mantenha esta pagina aberta.</p>
            <button
              onClick={disconnectWhatsApp}
              className="mt-4 text-[#8696a0] hover:text-[#e9edef] text-sm transition-colors"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-[#00a884] mx-auto mb-4" />
            <h2 className="text-[#e9edef] text-xl mb-2">Inicializando...</h2>
            <p className="text-[#8696a0] text-sm">Preparando o QR Code. Aguarde...</p>
            <button
              onClick={() => setConnectionStatus('disconnected')}
              className="mt-4 text-[#8696a0] hover:text-[#e9edef] text-sm transition-colors"
            >
              Cancelar
            </button>
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
      {showNewConversation ? (
        showNewContactForm ? (
          /* ─── Novo Contato Form ─── */
          <>
            <div className="h-[60px] bg-[#202c33] px-5 flex items-center gap-4">
              <button
                onClick={() => setShowNewContactForm(false)}
                className="p-1 hover:bg-[#2a3942] rounded-full transition-colors"
              >
                <ArrowLeft className="w-[20px] h-[20px] text-[#aebac1]" />
              </button>
              <span className="text-[#e9edef] text-[17px] font-medium">Novo contato</span>
            </div>
            <div className="flex-1 overflow-y-auto whatsapp-scrollbar p-5 space-y-5">
              <div>
                <label className="text-[#8696a0] text-xs mb-1.5 block">Nome *</label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Nome do contato"
                  className="w-full bg-transparent border-b-2 border-[#2a3942] focus:border-[#00a884] text-[#e9edef] text-[15px] py-2 outline-none transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[#8696a0] text-xs mb-1.5 block">Sobrenome</label>
                <input
                  type="text"
                  value={newContactSurname}
                  onChange={(e) => setNewContactSurname(e.target.value)}
                  placeholder="Sobrenome (opcional)"
                  className="w-full bg-transparent border-b-2 border-[#2a3942] focus:border-[#00a884] text-[#e9edef] text-[15px] py-2 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[#8696a0] text-xs mb-1.5 block">Telefone *</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 border-b-2 border-[#2a3942] py-2 px-1 min-w-[80px]">
                    <span className="text-[15px]">BR</span>
                    <span className="text-[#e9edef] text-[15px]">+55</span>
                  </div>
                  <input
                    type="tel"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="DDD + número"
                    maxLength={11}
                    className="flex-1 bg-transparent border-b-2 border-[#2a3942] focus:border-[#00a884] text-[#e9edef] text-[15px] py-2 outline-none transition-colors"
                  />
                </div>
              </div>
              {error && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}
              <button
                onClick={handleSaveNewContact}
                disabled={!newContactName.trim() || !newContactPhone.trim()}
                className="w-full bg-[#00a884] hover:bg-[#00967d] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium text-[15px] transition-colors mt-4"
              >
                Salvar
              </button>
            </div>
          </>
        ) : (
          /* ─── Nova Conversa Panel ─── */
          <>
            <div className="h-[60px] bg-[#202c33] px-5 flex items-center gap-4">
              <button
                onClick={() => { setShowNewConversation(false); setNewConversationSearch('') }}
                className="p-1 hover:bg-[#2a3942] rounded-full transition-colors"
              >
                <ArrowLeft className="w-[20px] h-[20px] text-[#aebac1]" />
              </button>
              <span className="text-[#e9edef] text-[17px] font-medium">Nova conversa</span>
            </div>
            <div className="px-3 py-1.5 bg-[#111b21]">
              <div className="flex items-center bg-[#202c33] rounded-lg px-3 py-[6px]">
                <Search className="w-[18px] h-[18px] text-[#8696a0] mr-4" />
                <input
                  type="text"
                  placeholder="Pesquisar nome ou número"
                  value={newConversationSearch}
                  onChange={(e) => setNewConversationSearch(e.target.value)}
                  className="flex-1 bg-transparent text-[#e9edef] text-[14px] placeholder-[#8696a0] outline-none"
                  autoFocus
                />
              </div>
            </div>
            <button
              onClick={() => setShowNewContactForm(true)}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#202c33] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center">
                <Contact className="w-6 h-6 text-white" />
              </div>
              <span className="text-[#e9edef] text-[17px]">Novo contato</span>
            </button>
            <div className="border-b border-[#222d34]" />
            <div className="px-5 py-2">
              <span className="text-[#00a884] text-[13px] font-medium uppercase tracking-wide">Contatos existentes</span>
            </div>
            <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
              {conversations
                .filter(c => !c.contact_phone.includes('@g.us'))
                .filter(c => {
                  if (!newConversationSearch.trim()) return true
                  const q = newConversationSearch.toLowerCase()
                  return (c.contact_name || '').toLowerCase().includes(q) ||
                    c.contact_phone.includes(q)
                })
                .map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      selectConversation(conv)
                      setShowNewConversation(false)
                      setNewConversationSearch('')
                    }}
                    className="w-full flex items-center px-3 py-3 hover:bg-[#202c33] transition-colors"
                  >
                    <div className="relative flex-shrink-0 mr-3">
                      {conv.profile_pic_url ? (
                        <img
                          src={conv.profile_pic_url}
                          alt={conv.contact_name || 'Contact'}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
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
                    </div>
                    <div className="flex-1 min-w-0 border-b border-[#222d34] py-1">
                      <span className="text-[#e9edef] text-base truncate block">
                        {conv.contact_name || formatPhone(conv.contact_phone)}
                      </span>
                      <span className="text-[#8696a0] text-sm truncate block">
                        {formatPhone(conv.contact_phone)}
                      </span>
                    </div>
                  </button>
                ))
              }
            </div>
          </>
        )
      ) : (
        /* ─── Normal Sidebar ─── */
        <>
          {/* Header */}
          <div className="h-[60px] bg-[#202c33] px-5 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[#e9edef] text-[22px] font-bold">WhatsApp</span>
              {authEmail && <span className="text-[#8696a0] text-[11px] ml-2">{authEmail}</span>}
            </div>
            <div className="flex items-center gap-1">
              <div className="relative group/tip">
                <button
                  onClick={() => setShowNewConversation(true)}
                  className="p-2.5 hover:bg-[#00a884]/20 rounded-full transition-all duration-200 hover:scale-110"
                >
                  <MessageCirclePlus className="w-[20px] h-[20px] text-[#00a884]" />
                </button>
                <div className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 bg-[#111b21] text-[#e9edef] text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg border border-[#2a3942]">
                  Nova conversa
                </div>
              </div>
              <div className="relative group/tip">
                <button
                  onClick={async () => {
                    setIsRefreshing(true)
                    if (conversations.length === 0) {
                      triggerManualSync()
                    }
                    await loadConversations()
                    setIsRefreshing(false)
                  }}
                  className="p-2.5 hover:bg-[#2a3942] rounded-full transition-all duration-200 hover:scale-110"
                >
                  <RefreshCw className={`w-[20px] h-[20px] text-[#aebac1] ${isRefreshing || isLoadingConversations || isSyncing ? 'animate-spin' : ''}`} />
                </button>
                <div className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 bg-[#111b21] text-[#e9edef] text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg border border-[#2a3942]">
                  {conversations.length === 0 ? 'Sincronizar conversas' : 'Atualizar conversas'}
                </div>
              </div>
              <div className="relative group/tip">
                <button
                  onClick={disconnectWhatsApp}
                  className="p-2.5 hover:bg-red-500/10 rounded-full transition-all duration-200 hover:scale-110"
                >
                  <LogOut className="w-[20px] h-[20px] text-[#aebac1] group-hover/tip:text-red-400 transition-colors" />
                </button>
                <div className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 bg-[#111b21] text-[#e9edef] text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg border border-[#2a3942]">
                  Desconectar WhatsApp
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-1.5 bg-[#111b21]">
            <div className="flex items-center bg-[#202c33] rounded-lg px-3 py-[6px]">
              <Search className="w-[18px] h-[18px] text-[#8696a0] mr-4" />
              <input
                type="text"
                placeholder="Pesquisar ou começar uma nova conversa"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-[#e9edef] text-[14px] placeholder-[#8696a0] outline-none"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#111b21]">
            {([
              { key: 'all' as const, label: 'Todas' },
              { key: 'unread' as const, label: 'Não lidas' },
              { key: 'groups' as const, label: 'Grupos' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setChatFilter(tab.key)}
                className={`px-3.5 py-[5px] rounded-full text-[13px] font-medium transition-colors ${
                  chatFilter === tab.key
                    ? 'bg-[#00a884] text-[#111b21]'
                    : 'bg-[#202c33] text-[#e9edef] hover:bg-[#2a3942]'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {/* Autopilot button */}
            <button
              onClick={() => setShowAutopilotPanel(true)}
              className={`px-3.5 py-[5px] rounded-full text-[13px] font-medium transition-all relative overflow-hidden ${
                autopilotEnabled
                  ? 'autopilot-foil-btn text-white'
                  : 'bg-[#202c33] text-[#e9edef] hover:bg-[#2a3942]'
              }`}
              title="Piloto Automático"
            >
              <span className="relative z-10 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Autopiloto
              </span>
            </button>
          </div>

          {/* Autopilot Panel */}
          {showAutopilotPanel && (
            <AutopilotPanel
              isOpen={showAutopilotPanel}
              onClose={() => { setShowAutopilotPanel(false); loadAutopilotData() }}
              conversations={conversations}
              authToken={authToken}
              onConfigChange={(enabled) => setAutopilotEnabled(enabled)}
            />
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
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
                    {(() => {
                      if (!autopilotEnabled) return null
                      const phoneSuffix = conv.contact_phone.replace(/@.*$/, '').replace(/[^0-9]/g, '').slice(-9)
                      const apStatus = autopilotPhones.get(phoneSuffix)
                      if (!apStatus) return null
                      if (apStatus.objective_reached) {
                        return (
                          <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] bg-purple-500 rounded-full flex items-center justify-center border-2 border-[#111b21]" title="Objetivo alcançado — intervenção necessária">
                            <Zap className="w-2.5 h-2.5 text-white" />
                          </div>
                        )
                      }
                      if (apStatus.needs_human) {
                        return (
                          <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#111b21]" title="Precisa atenção humana">
                            <Zap className="w-2.5 h-2.5 text-white" />
                          </div>
                        )
                      }
                      return (
                        <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] bg-[#00a884] rounded-full flex items-center justify-center border-2 border-[#111b21]" title="Autopiloto ativo">
                          <Zap className="w-2.5 h-2.5 text-white" />
                        </div>
                      )
                    })()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 border-b border-[#222d34] py-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {conv.contact_phone.includes('@g.us') && (
                          <Users className="w-4 h-4 text-[#8696a0] flex-shrink-0" />
                        )}
                        <span className="text-[#e9edef] text-base truncate">
                          {conv.contact_name || formatPhone(conv.contact_phone)}
                        </span>
                      </div>
                      <span className={`text-xs flex-shrink-0 ${conv.unread_count > 0 ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    {/* Autopilot status text */}
                    {(() => {
                      if (!autopilotEnabled) return null
                      const phoneSuffix = conv.contact_phone.replace(/@.*$/, '').replace(/[^0-9]/g, '').slice(-9)
                      const apStatus = autopilotPhones.get(phoneSuffix)
                      if (apStatus?.objective_reached) {
                        return (
                          <p className="text-purple-400 text-[11px] font-medium mb-0.5 truncate">
                            Necessária intervenção do vendedor
                          </p>
                        )
                      }
                      if (apStatus?.needs_human) {
                        return (
                          <p className="text-amber-400 text-[11px] font-medium mb-0.5 truncate">
                            Precisa da sua atenção
                          </p>
                        )
                      }
                      return null
                    })()}
                    <div className="flex items-center justify-between">
                      <p className="text-[#8696a0] text-sm truncate pr-2 leading-5">
                        {conv.last_message_sender && (
                          <span>{conv.last_message_sender}: </span>
                        )}
                        {(() => {
                          const p = conv.last_message_preview || 'Sem mensagens'
                          const mediaLabels: Record<string, string> = {
                            '[image]': '📷 Foto', '[video]': '🎥 Vídeo', '[audio]': '🎵 Áudio',
                            '[ptt]': '🎤 Áudio', '[document]': '📄 Documento', '[sticker]': '🏷️ Figurinha',
                            '[location]': '📍 Localização', '[contact]': '👤 Contato', '[contacts]': '👤 Contato',
                            '[Áudio]': '🎵 Áudio', '[Documento]': '📄 Documento', '[Sticker]': '🏷️ Figurinha',
                            '[Localização]': '📍 Localização', '[Contato]': '👤 Contato',
                            '[message]': '', '[text]': '',
                          }
                          return mediaLabels[p] ?? p
                        })()}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
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
              <button onClick={() => { setShowContactInfo(true); if (selectedConversation) fetchContactInfo(selectedConversation.contact_phone) }} className="text-left hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-2">
                  {selectedConversation.contact_phone.includes('@g.us') && (
                    <Users className="w-4 h-4 text-[#8696a0] flex-shrink-0" />
                  )}
                  <h3 className="text-[#e9edef] font-medium">{displayName}</h3>
                </div>
                <p className="text-[#8696a0] text-xs">
                  {selectedConversation.contact_phone.includes('@g.us') ? 'Grupo' : selectedConversation.contact_name ? formatPhone(selectedConversation.contact_phone) : ''}
                </p>
              </button>
            </div>
            <div className="flex items-center gap-1">
              {/* Search button */}
              <div className="relative group/tip">
                <button
                  onClick={openMessageSearch}
                  className="p-2.5 hover:bg-[#2a3942] rounded-full transition-all duration-200 hover:scale-110"
                >
                  <Search className="w-5 h-5 text-[#aebac1]" />
                </button>
                <div className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 bg-[#111b21] text-[#e9edef] text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg border border-[#2a3942]">
                  Pesquisar mensagens
                </div>
              </div>
            </div>
          </div>


          {/* Message Search Bar */}
          {isSearchingMessages && (
            <div className="flex-shrink-0 bg-[#111b21] border-b border-[#222d34] px-4 py-2 flex items-center gap-3">
              <button
                onClick={closeMessageSearch}
                className="p-1 hover:bg-[#2a3942] rounded-full transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-[#aebac1]" />
              </button>
              <div className="flex-1 flex items-center bg-[#202c33] rounded-lg px-4 py-1.5">
                <Search className="w-4 h-4 text-[#8696a0] mr-3 flex-shrink-0" />
                <input
                  ref={messageSearchInputRef}
                  type="text"
                  placeholder="Pesquisar mensagens"
                  value={messageSearchQuery}
                  onChange={(e) => handleMessageSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="flex-1 bg-transparent text-[#e9edef] text-sm placeholder-[#8696a0] outline-none"
                />
              </div>
              {messageSearchQuery && (
                <span className="text-[#8696a0] text-xs flex-shrink-0 min-w-[60px] text-center">
                  {searchMatchIds.length === 0 ? 'Nenhum' : `${activeSearchIndex + 1} de ${searchMatchIds.length}`}
                </span>
              )}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => navigateSearch('up')}
                  disabled={searchMatchIds.length === 0}
                  className="p-1 hover:bg-[#2a3942] rounded-full transition-colors disabled:opacity-30"
                >
                  <ChevronUp className="w-5 h-5 text-[#aebac1]" />
                </button>
                <button
                  onClick={() => navigateSearch('down')}
                  disabled={searchMatchIds.length === 0}
                  className="p-1 hover:bg-[#2a3942] rounded-full transition-colors disabled:opacity-30"
                >
                  <ChevronDown className="w-5 h-5 text-[#aebac1]" />
                </button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto whatsapp-scrollbar px-16 py-2 bg-[#0b141a] whatsapp-chat-bg">
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
                {/* Load older messages button */}
                {hasMoreMessages && (
                  <div className="flex justify-center py-3">
                    <button
                      onClick={loadOlderMessages}
                      disabled={isLoadingMore}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#202c33] hover:bg-[#2a3942] text-[#8696a0] text-xs transition-colors disabled:opacity-50"
                    >
                      {isLoadingMore ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5" />
                      )}
                      {isLoadingMore ? 'Carregando...' : 'Carregar mensagens anteriores'}
                    </button>
                  </div>
                )}
                {messages
                  .filter(msg => {
                    const hiddenTypes = ['reaction', 'e2e_notification', 'notification', 'notification_template', 'gp2', 'call_log', 'protocol', 'ciphertext']
                    return !hiddenTypes.includes(msg.type)
                  })
                  .map((msg, idx, filtered) => {
                  const showDate = idx === 0 ||
                    new Date(msg.timestamp).toDateString() !== new Date(filtered[idx - 1].timestamp).toDateString()

                  const isSearchMatch = searchMatchIds.includes(msg.id)
                  const isActiveMatch = isSearchMatch && searchMatchIds[activeSearchIndex] === msg.id

                  return (
                    <div key={msg.id} id={`msg-${msg.id}`}>
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
                        <div
                          onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                          onMouseEnter={() => setHoveredMsgId(msg.id)}
                          onMouseLeave={() => { if (contextMenu?.message.id !== msg.id) setHoveredMsgId(null) }}
                          className={`max-w-[65%] rounded-lg px-3 py-2 shadow transition-colors duration-200 relative group ${
                          msg.fromMe
                            ? 'bg-[#005c4b] rounded-tr-none'
                            : 'bg-[#202c33] rounded-tl-none'
                        } ${msg.id.startsWith('temp_') ? 'opacity-60' : ''} ${isActiveMatch ? 'ring-2 ring-[#00a884] ring-offset-1 ring-offset-[#0b141a]' : ''}`}>
                          {/* Dropdown arrow on hover */}
                          {!msg.id.startsWith('temp_') && msg.type !== 'revoked' && (hoveredMsgId === msg.id || contextMenu?.message.id === msg.id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const rect = e.currentTarget.getBoundingClientRect()
                                setContextMenu({
                                  x: msg.fromMe ? rect.left - 180 : rect.right + 4,
                                  y: rect.bottom + 4,
                                  message: msg
                                })
                              }}
                              className={`absolute top-1 ${msg.fromMe ? 'right-1' : 'right-1'} w-6 h-6 rounded-full flex items-center justify-center z-[2] ${
                                msg.fromMe ? 'bg-[#005c4b] hover:bg-[#04725e]' : 'bg-[#202c33] hover:bg-[#2a3942]'
                              } transition-colors`}
                            >
                              <ChevronDown className="w-4 h-4 text-[#8696a0]" />
                            </button>
                          )}
                          {/* Group sender name (hide raw LID/number IDs) */}
                          {selectedConversation?.contact_phone.includes('@g.us') && !msg.fromMe && msg.contactName && !/^\d+(@|$)/.test(msg.contactName) && (
                            <p className="text-xs font-medium text-[#00a884] mb-1">{msg.contactName}</p>
                          )}
                          {/* Quoted message (reply) */}
                          {msg.quotedMsg && (
                            <div
                              className={`mb-1 rounded-md px-3 py-2 cursor-pointer ${
                                msg.fromMe ? 'bg-[#025144]' : 'bg-[#1a262d]'
                              } border-l-[3px] ${
                                msg.quotedMsg.fromMe ? 'border-[#06cf9c]' : 'border-[#7c57e1]'
                              }`}
                              style={{ margin: '-2px -4px 4px -4px' }}
                            >
                              <p className={`text-[11px] font-medium mb-0.5 ${
                                msg.quotedMsg.fromMe ? 'text-[#06cf9c]' : 'text-[#7c57e1]'
                              }`}>
                                {msg.quotedMsg.fromMe ? 'Você' : (msg.quotedMsg.contactName || selectedConversation?.contact_name || 'Contato')}
                              </p>
                              <p className="text-[#8696a0] text-[12px] truncate max-w-[280px]">
                                {msg.quotedMsg.type === 'image' ? '📷 Foto' :
                                 msg.quotedMsg.type === 'video' ? '🎥 Vídeo' :
                                 msg.quotedMsg.type === 'audio' || msg.quotedMsg.type === 'ptt' ? '🎤 Áudio' :
                                 msg.quotedMsg.type === 'document' ? '📄 Documento' :
                                 msg.quotedMsg.type === 'sticker' ? '🏷️ Figurinha' :
                                 msg.quotedMsg.body || '[Mensagem]'}
                              </p>
                            </div>
                          )}
                          {/* Revoked (deleted) message */}
                          {msg.type === 'revoked' ? (
                            <p className="text-[#8696a0] text-[13px] italic flex items-center gap-1.5 py-0.5">
                              <Ban className="w-[14px] h-[14px]" />
                              {msg.fromMe ? 'Você apagou esta mensagem' : 'Esta mensagem foi apagada'}
                            </p>
                          ) : (<>
                          {/* Image */}
                          {msg.hasMedia && msg.mediaId && (msg.type === 'image' || msg.mimetype?.startsWith('image/')) && msg.type !== 'sticker' && (
                            <div className="mb-1 rounded-md overflow-hidden" style={{ margin: '-4px -6px 4px -6px' }}>
                              <img
                                src={getMediaSrc(msg.mediaId)}
                                alt="Imagem"
                                className="w-full max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setLightboxImage(getMediaSrc(msg.mediaId!))}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  const placeholder = target.parentElement
                                  if (placeholder) {
                                    placeholder.innerHTML = '<div class="flex items-center gap-2 px-3 py-4 bg-[#0b141a]/30"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8696a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-[#8696a0] text-xs">Foto</span></div>'
                                  }
                                }}
                              />
                            </div>
                          )}
                          {/* Sticker */}
                          {msg.type === 'sticker' && msg.mediaId && (
                            <div className="mb-1">
                              <img
                                src={getMediaSrc(msg.mediaId)}
                                alt="Sticker"
                                className="max-w-[150px] max-h-[150px]"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  target.insertAdjacentHTML('afterend', '<span class="text-[#8696a0] text-xs italic">Sticker</span>')
                                }}
                              />
                            </div>
                          )}
                          {/* Audio */}
                          {(msg.type === 'audio' || msg.type === 'ptt') && msg.mediaId && (() => {
                            const isPlaying = playingAudioId === msg.id
                            const progress = audioProgress[msg.id] || 0
                            const rawDuration = audioDurations[msg.id] || 0
                            const duration = isFinite(rawDuration) && !isNaN(rawDuration) ? rawDuration : 0
                            const currentTime = duration * progress
                            const playedBars = Math.floor(progress * 36)

                            return (
                            <div className="min-w-[260px]">
                              <div className="flex items-center gap-3">
                                {/* Play/Pause button */}
                                <button
                                  onClick={() => playAudio(msg.id, msg.mediaId!)}
                                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 ${
                                    isPlaying
                                      ? 'bg-[#00a884] shadow-[0_0_10px_rgba(0,168,132,0.3)]'
                                      : 'bg-white/10 hover:bg-white/15'
                                  }`}
                                >
                                  {isPlaying ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><rect x="7" y="5" width="3" height="14" rx="1"/><rect x="14" y="5" width="3" height="14" rx="1"/></svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="8 5 19 12 8 19 8 5"/></svg>
                                  )}
                                </button>
                                {/* Waveform with progress (clickable to seek) */}
                                <div className="flex-1 flex flex-col gap-1">
                                  <div
                                    className="flex items-center gap-[2px] h-[28px] cursor-pointer"
                                    onClick={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      const clickX = e.clientX - rect.left
                                      const seekRatio = Math.max(0, Math.min(1, clickX / rect.width))
                                      if (audioRef.current && playingAudioId === msg.id) {
                                        // Audio is playing/paused for this message — seek directly
                                        const dur = audioRef.current.duration
                                        if (isFinite(dur) && dur > 0) {
                                          audioRef.current.currentTime = seekRatio * dur
                                          setAudioProgress(prev => ({ ...prev, [msg.id]: seekRatio }))
                                        }
                                      } else {
                                        // Start playing from the clicked position
                                        playAudio(msg.id, msg.mediaId!)
                                        // Wait for audio to load then seek
                                        const checkAndSeek = () => {
                                          if (audioRef.current) {
                                            const onCanSeek = () => {
                                              if (audioRef.current && isFinite(audioRef.current.duration)) {
                                                audioRef.current.currentTime = seekRatio * audioRef.current.duration
                                                setAudioProgress(prev => ({ ...prev, [msg.id]: seekRatio }))
                                              }
                                            }
                                            if (isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
                                              onCanSeek()
                                            } else {
                                              audioRef.current.addEventListener('loadedmetadata', onCanSeek, { once: true })
                                            }
                                          }
                                        }
                                        setTimeout(checkAndSeek, 50)
                                      }
                                    }}
                                  >
                                    {Array.from({ length: 36 }, (_, i) => {
                                      const seed = (msg.id.charCodeAt(i % msg.id.length) * (i + 1)) % 100
                                      const h = Math.max(4, Math.min(26, seed * 0.26))
                                      const played = i < playedBars
                                      return (
                                        <div
                                          key={i}
                                          className="rounded-full flex-shrink-0 transition-all duration-150"
                                          style={{
                                            width: '2.5px',
                                            height: `${h}px`,
                                            backgroundColor: played
                                              ? (isPlaying ? '#00a884' : (msg.fromMe ? '#b3d4cc' : '#8696a0'))
                                              : (msg.fromMe ? 'rgba(255,255,255,0.15)' : '#374045')
                                          }}
                                        />
                                      )
                                    })}
                                  </div>
                                  <span className="text-[11px] text-[#8696a0]">
                                    {isPlaying || currentTime > 0 ? formatAudioTime(currentTime) : duration > 0 ? formatAudioTime(duration) : '0:00'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            )
                          })()}
                          {/* Video */}
                          {msg.type === 'video' && msg.mediaId && (
                            <div className="mb-1 rounded-md overflow-hidden" style={{ margin: '-4px -6px 4px -6px' }}>
                              <div className="flex items-center justify-center bg-[#0b141a]/50 py-8 px-4">
                                <div className="flex items-center gap-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8696a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                  <span className="text-[#8696a0] text-xs">Video</span>
                                </div>
                              </div>
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
                          {/* Media with no mediaId (failed to load) - Audio/PTT gets waveform style */}
                          {msg.hasMedia && !msg.mediaId && (msg.type === 'audio' || msg.type === 'ptt') && (
                            <div className="min-w-[280px]">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center flex-shrink-0">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#8696a0" stroke="none"><polygon points="8 5 19 12 8 19 8 5"/></svg>
                                </div>
                                <div className="flex-1 flex items-center gap-[2px] h-[28px]">
                                  {Array.from({ length: 36 }, (_, i) => {
                                    const seed = (msg.id.charCodeAt(i % msg.id.length) * (i + 1)) % 100
                                    const h = Math.max(4, Math.min(26, seed * 0.26))
                                    return (
                                      <div
                                        key={i}
                                        className="rounded-full flex-shrink-0"
                                        style={{
                                          width: '2.5px',
                                          height: `${h}px`,
                                          backgroundColor: '#374045'
                                        }}
                                      />
                                    )
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-0.5 px-1">
                                <span className="text-[11px] text-[#8696a0]">0:00</span>
                              </div>
                            </div>
                          )}
                          {/* Media with no mediaId (failed to load) - Other types */}
                          {msg.hasMedia && !msg.mediaId && msg.type !== 'text' && msg.type !== 'audio' && msg.type !== 'ptt' && (
                            <div className="flex items-center gap-2 mb-1 bg-[#0b141a]/30 rounded px-3 py-2">
                              <span className="text-lg">
                                {msg.type === 'image' ? '📷' :
                                 msg.type === 'sticker' ? '🎨' :
                                 msg.type === 'video' ? '🎥' :
                                 msg.type === 'document' ? '📄' : '📎'}
                              </span>
                              <span className="text-[#8696a0] text-xs">
                                {msg.type === 'image' ? 'Foto' :
                                 msg.type === 'sticker' ? 'Sticker' :
                                 msg.type === 'video' ? 'Video' :
                                 msg.type === 'document' ? 'Documento' :
                                 msg.type}
                              </span>
                            </div>
                          )}
                          {/* Contact Card */}
                          {(msg.type === 'contacts' || (msg.body && msg.body.includes('BEGIN:VCARD'))) && (() => {
                            const vcardMatch = msg.body?.match(/FN:(.+)/)?.[1] || ''
                            const phoneMatch = msg.body?.match(/TEL[^:]*:(.+)/)?.[1] || ''
                            const contactDisplayName = vcardMatch || (msg.body?.startsWith('📇') ? msg.body.replace('📇 ', '') : msg.body || 'Contato')
                            return (
                              <div className="min-w-[220px]" style={{ margin: '-4px -6px -4px -6px' }}>
                                <div className={`flex items-center gap-3 px-3 py-3 ${msg.fromMe ? 'bg-[#025144]' : 'bg-[#1a262d]'} rounded-t-lg`}>
                                  <div className="w-11 h-11 rounded-full bg-[#6b7b8a] flex items-center justify-center flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#ccd2d6" stroke="none">
                                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[#e9edef] text-[15px] font-medium truncate">{contactDisplayName}</p>
                                    {phoneMatch && <p className="text-[#8696a0] text-xs truncate">{phoneMatch}</p>}
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    // Extract digits from vCard phone or waid
                                    const waidMatch = msg.body?.match(/waid=(\d+)/)?.[1] || ''
                                    const telDigits = phoneMatch?.replace(/[^0-9]/g, '') || ''
                                    const digits = waidMatch || telDigits
                                    // Use last 8 digits for matching (avoids country code issues)
                                    const last8 = digits.slice(-8)
                                    // Also try matching by name
                                    const name = contactDisplayName.toLowerCase().trim()

                                    const target = conversations.find(c => {
                                      const cDigits = c.contact_phone.replace(/[^0-9]/g, '')
                                      const cLast8 = cDigits.slice(-8)
                                      if (last8 && cLast8 === last8) return true
                                      if (name && c.contact_name?.toLowerCase().trim() === name) return true
                                      return false
                                    })
                                    if (target) selectConversation(target)
                                  }}
                                  className={`w-full border-t ${msg.fromMe ? 'border-[#0b6b5a]' : 'border-[#2a3942]'} px-3 py-2 text-center rounded-b-lg hover:brightness-110 transition-all cursor-pointer`}
                                >
                                  <span className="text-[#00a884] text-[13px] font-medium">Mensagem</span>
                                </button>
                              </div>
                            )
                          })()}
                          {/* Special message types */}
                          {!msg.body && !msg.hasMedia && msg.type !== 'text' && msg.type !== 'contacts' && (
                            <p className="text-[#8696a0] text-xs italic">
                              {msg.type === 'location' ? '📍 Localizacao' :
                               msg.type === 'sticker' ? '🎨 Sticker' :
                               `[${msg.type}]`}
                            </p>
                          )}
                          {/* Text body */}
                          {msg.body && msg.type !== 'sticker' && msg.type !== 'document' && msg.type !== 'audio' && msg.type !== 'ptt' && msg.type !== 'contacts' && !msg.body.includes('BEGIN:VCARD') && (
                            <p className="text-[#e9edef] text-sm whitespace-pre-wrap break-words">
                              {isSearchMatch && messageSearchQuery ? (() => {
                                const q = messageSearchQuery.toLowerCase()
                                const parts: React.ReactNode[] = []
                                let remaining = msg.body
                                let key = 0
                                while (remaining.length > 0) {
                                  const idx = remaining.toLowerCase().indexOf(q)
                                  if (idx === -1) {
                                    parts.push(remaining)
                                    break
                                  }
                                  if (idx > 0) parts.push(remaining.slice(0, idx))
                                  parts.push(
                                    <mark key={key++} className="bg-[#ffd54f] text-[#111b21] rounded-sm px-0.5">
                                      {remaining.slice(idx, idx + q.length)}
                                    </mark>
                                  )
                                  remaining = remaining.slice(idx + q.length)
                                }
                                return parts
                              })() : msg.body}
                            </p>
                          )}
                          </>)}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {msg.fromMe && msg.isAutopilot && (
                              <span title="Enviado pelo Autopiloto"><Zap className="w-3 h-3 text-[#00a884]" /></span>
                            )}
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
          <div className="px-[10px] py-[5px] bg-[#202c33] flex-shrink-0">
            {/* Reply Preview Banner */}
            {replyingTo && !editingMessage && (
              <div className="mb-1 px-3 py-2 bg-[#1d282f] rounded-lg flex items-center gap-3 border-l-4 border-[#06cf9c]">
                <ArrowLeft className="w-4 h-4 text-[#06cf9c] flex-shrink-0 rotate-[225deg]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[#06cf9c] text-[12px] font-medium">
                    {replyingTo.fromMe ? 'Você' : (replyingTo.contactName || selectedConversation?.contact_name || 'Contato')}
                  </p>
                  <p className="text-[#8696a0] text-[13px] truncate">
                    {replyingTo.type === 'image' ? '📷 Foto' :
                     replyingTo.type === 'video' ? '🎥 Vídeo' :
                     replyingTo.type === 'audio' || replyingTo.type === 'ptt' ? '🎤 Áudio' :
                     replyingTo.type === 'document' ? '📄 Documento' :
                     replyingTo.type === 'sticker' ? '🏷️ Figurinha' :
                     replyingTo.body || '[Mensagem]'}
                  </p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-[#111b21] rounded-full transition-colors flex-shrink-0">
                  <X className="w-4 h-4 text-[#8696a0]" />
                </button>
              </div>
            )}
            {/* Edit Message Banner */}
            {editingMessage && (
              <div className="mb-1 px-3 py-2 bg-[#1d282f] rounded-lg flex items-center gap-3 border-l-4 border-[#00a884]">
                <Pencil className="w-4 h-4 text-[#00a884] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[#00a884] text-[12px] font-medium">Editando mensagem</p>
                  <p className="text-[#8696a0] text-[13px] truncate">{editingMessage.body}</p>
                </div>
                <button onClick={cancelEdit} className="p-1 hover:bg-[#111b21] rounded-full transition-colors flex-shrink-0">
                  <X className="w-4 h-4 text-[#8696a0]" />
                </button>
              </div>
            )}
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
            ) : (() => {
              // Check if selected contact is on active autopilot
              const selPhone = selectedConversation?.contact_phone || ''
              const selSuffix = selPhone.replace(/@.*$/, '').replace(/[^0-9]/g, '').slice(-9)
              const apInfo = autopilotEnabled ? autopilotPhones.get(selSuffix) : undefined
              const isOnAutopilot = apInfo?.enabled

              if (isOnAutopilot) {
                return (
                  <div className="flex items-center gap-3 h-[44px] px-4">
                    <Zap className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <p className="text-[#8696a0] text-[13px] flex-1">Piloto automático ativo — envio manual bloqueado</p>
                  </div>
                )
              }

              return (
              /* Normal Input Mode */
              <div className="flex items-end gap-[5px]">
                {/* Input container with emoji + attach + text */}
                <div className="flex-1 flex items-end bg-[#2a3942] rounded-[8px] min-h-[42px]">
                  {/* Emoji Button */}
                  <div className="relative flex-shrink-0" ref={emojiPickerRef}>
                    <button
                      onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false) }}
                      className="w-[42px] h-[42px] flex items-center justify-center transition-colors"
                    >
                      <Smile className="w-[24px] h-[24px] text-[#8696a0]" />
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
                  <div className="relative flex-shrink-0" ref={attachMenuRef}>
                    <button
                      onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false) }}
                      className="w-[36px] h-[42px] flex items-center justify-center transition-colors"
                    >
                      <Paperclip className="w-[24px] h-[24px] text-[#8696a0] rotate-45" />
                    </button>
                    {showAttachMenu && (
                      <div className="absolute bottom-12 left-0 bg-[#233138] rounded-2xl shadow-xl py-2 w-[200px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <button
                          onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = '*/*'; fileInputRef.current.click() } setShowAttachMenu(false) }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors"
                        >
                          <div className="w-[34px] h-[34px] bg-[#7f66ff] rounded-full flex items-center justify-center flex-shrink-0">
                            <FileText className="w-[18px] h-[18px] text-white" />
                          </div>
                          <span className="text-[#e9edef] text-[14.5px]">Documento</span>
                        </button>
                        <button
                          onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*,video/*'; fileInputRef.current.click() } setShowAttachMenu(false) }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors"
                        >
                          <div className="w-[34px] h-[34px] bg-[#007bfc] rounded-full flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-[18px] h-[18px] text-white" />
                          </div>
                          <span className="text-[#e9edef] text-[14.5px]">Fotos e vídeos</span>
                        </button>
                        <button
                          onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.capture = 'environment'; fileInputRef.current.click() } setShowAttachMenu(false) }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors"
                        >
                          <div className="w-[34px] h-[34px] bg-[#ff2e74] rounded-full flex items-center justify-center flex-shrink-0">
                            <Camera className="w-[18px] h-[18px] text-white" />
                          </div>
                          <span className="text-[#e9edef] text-[14.5px]">Câmera</span>
                        </button>
                        <button
                          onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'audio/*'; fileInputRef.current.click() } setShowAttachMenu(false) }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors"
                        >
                          <div className="w-[34px] h-[34px] bg-[#ff6723] rounded-full flex items-center justify-center flex-shrink-0">
                            <Headphones className="w-[18px] h-[18px] text-white" />
                          </div>
                          <span className="text-[#e9edef] text-[14.5px]">Áudio</span>
                        </button>
                        <button
                          onClick={() => { setShowAttachMenu(false); setShowContactPicker(true) }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors"
                        >
                          <div className="w-[34px] h-[34px] bg-[#009de2] rounded-full flex items-center justify-center flex-shrink-0">
                            <Contact className="w-[18px] h-[18px] text-white" />
                          </div>
                          <span className="text-[#e9edef] text-[14.5px]">Contato</span>
                        </button>
                        <button
                          onClick={() => setShowAttachMenu(false)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#182229] transition-colors"
                        >
                          <div className="w-[34px] h-[34px] bg-[#02a698] rounded-full flex items-center justify-center flex-shrink-0">
                            <Sticker className="w-[18px] h-[18px] text-white" />
                          </div>
                          <span className="text-[#e9edef] text-[14.5px]">Figurinha</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Text Input */}
                  <div className="flex-1 py-[9px] pr-3">
                    <textarea
                      data-message-input
                      value={editingMessage ? editInput : (selectedFile ? mediaCaption : messageInput)}
                      onChange={(e) => editingMessage ? setEditInput(e.target.value) : (selectedFile ? setMediaCaption(e.target.value) : setMessageInput(e.target.value))}
                      onKeyDown={handleKeyDown}
                      placeholder={editingMessage ? "Editar mensagem..." : (selectedFile ? "Adicionar legenda..." : "Digite uma mensagem")}
                      rows={1}
                      className="w-full bg-transparent text-[#e9edef] text-[15px] placeholder-[#8696a0] outline-none resize-none max-h-[120px] overflow-y-auto leading-[20px]"
                      style={{ minHeight: '20px' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = '20px'
                        target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                      }}
                    />
                  </div>
                </div>

                {/* Mic / Send Button (outside the input bar) */}
                {(editingMessage || messageInput.trim() || selectedFile) ? (
                  <div className="relative group/tip">
                    <button
                      onClick={editingMessage ? handleEditMessage : (selectedFile ? handleSendMedia : () => handleSendMessage())}
                      disabled={editingMessage ? !editInput.trim() : (isSending || (!messageInput.trim() && !selectedFile))}
                      className="w-[42px] h-[42px] flex items-center justify-center rounded-full bg-[#00a884] hover:bg-[#06cf9c] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-transparent flex-shrink-0 hover:scale-105 hover:shadow-[0_0_12px_rgba(0,168,132,0.4)]"
                    >
                      {isSending ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-[20px] h-[20px] text-white" />}
                    </button>
                    <div className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 bg-[#111b21] text-[#e9edef] text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg border border-[#2a3942]">
                      {editingMessage ? 'Salvar edição' : 'Enviar mensagem'}
                    </div>
                  </div>
                ) : (
                  <div className="relative group/tip">
                    <button
                      onClick={startVoiceRecording}
                      className="w-[42px] h-[42px] flex items-center justify-center rounded-full hover:bg-[#2a3942] transition-all duration-200 hover:scale-110 flex-shrink-0"
                    >
                      <Mic className="w-[24px] h-[24px] text-[#8696a0]" />
                    </button>
                    <div className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 bg-[#111b21] text-[#e9edef] text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg border border-[#2a3942]">
                      Gravar áudio
                    </div>
                  </div>
                )}

                {/* Copilot toggle button */}
                {!copilotOpen && (
                  <div className="relative group/tip">
                    <button
                      onClick={() => setCopilotOpen(true)}
                      className="copilot-foil-btn w-[42px] h-[42px] flex items-center justify-center rounded-full flex-shrink-0 relative overflow-hidden"
                    >
                      <Sparkles className="w-5 h-5 text-white relative z-10" />
                    </button>
                    <div className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 bg-[#111b21] text-[#e9edef] text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg border border-[#2a3942]">
                      Copiloto de Vendas
                    </div>
                  </div>
                )}
              </div>
              )
            })()}
          </div>

          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
        </div>

        {/* Contact Picker Modal */}
        {showContactPicker && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/50">
            <div className="bg-[#222e35] rounded-xl w-[380px] max-h-[500px] flex flex-col shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#374045]">
                <button
                  onClick={() => { setShowContactPicker(false); setContactSearchQuery('') }}
                  className="p-1 hover:bg-[#2a3942] rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#aebac1]" />
                </button>
                <h3 className="text-[#e9edef] font-medium text-base">Enviar contato</h3>
              </div>

              {/* Search */}
              <div className="px-3 py-2">
                <div className="flex items-center bg-[#2a3942] rounded-lg px-3 py-1.5">
                  <Search className="w-4 h-4 text-[#8696a0] mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Pesquisar contato"
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-[#e9edef] text-sm placeholder-[#8696a0] outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Contact List */}
              <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
                {conversations
                  .filter(c => !c.contact_phone.includes('@g.us'))
                  .filter(c => {
                    if (!contactSearchQuery.trim()) return true
                    const q = contactSearchQuery.toLowerCase()
                    const name = (c.contact_name || '').toLowerCase()
                    const phone = c.contact_phone.toLowerCase()
                    return name.includes(q) || phone.includes(q)
                  })
                  .filter(c => selectedConversation ? c.contact_phone !== selectedConversation.contact_phone : true)
                  .map(contact => (
                    <button
                      key={contact.contact_phone}
                      onClick={() => handleSendContact(contact)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#6b7b8a] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-medium">
                          {getInitials(contact.contact_name)}
                        </span>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-[#e9edef] text-[15px] truncate">
                          {contact.contact_name || formatPhone(contact.contact_phone)}
                        </p>
                        {contact.contact_name && (
                          <p className="text-[#8696a0] text-xs truncate">
                            {formatPhone(contact.contact_phone)}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* Analysis Panel (slides in from right) */}
        {analysis && (
          <div className={`absolute top-0 right-0 h-full w-[400px] bg-[#111b21] border-l border-[#222d34] flex flex-col transition-transform duration-300 ${showAnalysisPanel ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAnalysisPanel(false)}
                  className="p-1 hover:bg-[#2a3942] rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-[#aebac1]" />
                </button>
                <span className="text-[#e9edef] font-medium">Avaliacao</span>
              </div>
              <button
                onClick={() => setShowAnalysisPanel(false)}
                className="p-2 hover:bg-[#2a3942] rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#aebac1]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto whatsapp-scrollbar p-4">
              {renderAnalysisResults()}
            </div>
          </div>
        )}

        {/* Contact Info Panel (slides in from right) */}
        {selectedConversation && (
          <div className={`absolute top-0 right-0 h-full w-full sm:w-[420px] bg-[#111b21] border-l border-[#222d34] flex flex-col z-[75] transition-transform duration-300 ${showContactInfo ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Header */}
            <div className="h-[60px] bg-[#202c33] px-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowContactInfo(false)}
                  className="p-1 hover:bg-[#2a3942] rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#aebac1]" />
                </button>
                <span className="text-[#e9edef] font-medium text-base">Dados do contato</span>
              </div>
              <button className="p-2 hover:bg-[#2a3942] rounded-full transition-colors">
                <Pencil className="w-[18px] h-[18px] text-[#aebac1]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
              {/* Profile Section */}
              <div className="flex flex-col items-center py-7 bg-[#111b21]">
                {/* Profile Picture */}
                {contactDetailInfo?.profilePicUrl || selectedConversation.profile_pic_url ? (
                  <img
                    src={contactDetailInfo?.profilePicUrl || selectedConversation.profile_pic_url!}
                    alt=""
                    className="w-[200px] h-[200px] rounded-full object-cover mb-4"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                      const parent = (e.target as HTMLImageElement).parentElement
                      if (parent) {
                        const fallback = document.createElement('div')
                        fallback.className = 'w-[200px] h-[200px] rounded-full bg-[#6b7b8a] flex items-center justify-center mb-4'
                        fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="#ccd2d6" stroke="none"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
                        parent.insertBefore(fallback, e.target as HTMLImageElement)
                      }
                    }}
                  />
                ) : (
                  <div className="w-[200px] h-[200px] rounded-full bg-[#6b7b8a] flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="#ccd2d6" stroke="none">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                )}

                {/* Name */}
                <h2 className="text-[#e9edef] text-[22px] font-medium text-center px-4">
                  {selectedConversation.contact_name || formatPhone(selectedConversation.contact_phone)}
                </h2>

                {/* Business: person name under business name */}
                {contactDetailInfo?.isBusiness && contactDetailInfo?.name && contactDetailInfo.name !== selectedConversation.contact_name && (
                  <p className="text-[#e9edef] text-[15px] mt-0.5">{contactDetailInfo.name}</p>
                )}

                {/* Business category */}
                {contactDetailInfo?.isBusiness && contactDetailInfo?.businessProfile?.category && (
                  <p className="text-[#00a884] text-[14px] mt-0.5">{contactDetailInfo.businessProfile.category}</p>
                )}

                {/* Business hours summary */}
                {contactDetailInfo?.isBusiness && contactDetailInfo?.businessProfile?.businessHours && (
                  <p className="text-[#00a884] text-[13px] mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {contactDetailInfo.businessProfile.businessHours.config ? 'Open' : 'Horário disponível'}
                  </p>
                )}

                {/* Phone (for non-business) */}
                {!contactDetailInfo?.isBusiness && (
                  <p className="text-[#8696a0] text-[15px] mt-0.5">
                    {formatPhone(selectedConversation.contact_phone)}
                  </p>
                )}

                {/* Share button (business) */}
                {contactDetailInfo?.isBusiness && (
                  <div className="flex flex-col items-center mt-4">
                    <div className="w-10 h-10 rounded-full bg-[#00a884]/20 flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-[#00a884]" />
                    </div>
                    <span className="text-[#00a884] text-[12px] mt-1">Compartilhar</span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="h-[8px] bg-[#0b141a]" />

              {/* Business Account Notice */}
              {contactDetailInfo?.isBusiness && (
                <>
                  <div className="px-7 py-3 flex items-center gap-3">
                    <Building2 className="w-[18px] h-[18px] text-[#8696a0] flex-shrink-0" />
                    <span className="text-[#8696a0] text-[14px]">Esta é uma conta comercial.</span>
                  </div>
                  <div className="h-[8px] bg-[#0b141a]" />
                </>
              )}

              {/* About/Description Section */}
              {contactDetailInfo?.isBusiness && contactDetailInfo?.businessProfile?.description ? (
                <div className="px-7 py-4">
                  <p className="text-[#e9edef] text-[15px] leading-relaxed whitespace-pre-wrap">
                    {contactDetailInfo.businessProfile.description}
                  </p>
                </div>
              ) : (
                <div className="px-7 py-4">
                  <p className="text-[#8696a0] text-[13px] mb-2">Recado</p>
                  <p className="text-[#e9edef] text-[15px]">
                    {isLoadingContactInfo ? (
                      <span className="inline-block w-32 h-4 bg-[#202c33] rounded animate-pulse" />
                    ) : (
                      contactDetailInfo?.about || '—'
                    )}
                  </p>
                </div>
              )}

              {/* Divider */}
              <div className="h-[8px] bg-[#0b141a]" />

              {/* Business Info: Hours, Location, Email, Website */}
              {contactDetailInfo?.isBusiness && (
                <>
                  <div className="py-1">
                    {/* Business Hours */}
                    {contactDetailInfo.businessProfile?.businessHours && (
                      <div className="flex items-start gap-5 px-7 py-3.5">
                        <Clock className="w-[20px] h-[20px] text-[#8696a0] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[#00a884] text-[14px]">Aberto agora</p>
                          <p className="text-[#8696a0] text-[13px]">Aberto 24 horas</p>
                        </div>
                      </div>
                    )}

                    {/* Address */}
                    {contactDetailInfo.businessProfile?.address && (
                      <div className="flex items-start gap-5 px-7 py-3.5">
                        <MapPin className="w-[20px] h-[20px] text-[#8696a0] mt-0.5 flex-shrink-0" />
                        <p className="text-[#e9edef] text-[14px]">{contactDetailInfo.businessProfile.address}</p>
                      </div>
                    )}

                    {/* Email */}
                    {contactDetailInfo.businessProfile?.email && (
                      <div className="flex items-start gap-5 px-7 py-3.5">
                        <Mail className="w-[20px] h-[20px] text-[#8696a0] mt-0.5 flex-shrink-0" />
                        <p className="text-[#00a884] text-[14px]">{contactDetailInfo.businessProfile.email}</p>
                      </div>
                    )}

                    {/* Website */}
                    {contactDetailInfo.businessProfile?.website && (
                      <div className="flex items-start gap-5 px-7 py-3.5">
                        <Globe className="w-[20px] h-[20px] text-[#8696a0] mt-0.5 flex-shrink-0" />
                        <p className="text-[#00a884] text-[14px]">
                          {Array.isArray(contactDetailInfo.businessProfile.website)
                            ? contactDetailInfo.businessProfile.website.join(', ')
                            : contactDetailInfo.businessProfile.website
                          }
                        </p>
                      </div>
                    )}

                    {/* Phone */}
                    <div className="flex items-start gap-5 px-7 py-3.5">
                      <Smartphone className="w-[20px] h-[20px] text-[#8696a0] mt-0.5 flex-shrink-0" />
                      <p className="text-[#e9edef] text-[14px]">{formatPhone(selectedConversation.contact_phone)}</p>
                    </div>
                  </div>

                  <div className="h-[8px] bg-[#0b141a]" />
                </>
              )}

              {/* Media Section */}
              <div className="px-7 py-4">
                <button className="w-full flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <ImageIcon className="w-[22px] h-[22px] text-[#8696a0]" />
                    <span className="text-[#e9edef] text-[15px]">Mídia, links e docs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#8696a0] text-[14px]">
                      {messages.filter(m => m.hasMedia || m.type === 'image' || m.type === 'video' || m.type === 'document').length}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#8696a0]" />
                  </div>
                </button>

                {/* Media Thumbnails */}
                {(() => {
                  const mediaMessages = messages.filter(m => m.hasMedia && m.mediaId && (m.type === 'image' || m.mimetype?.startsWith('image/')))
                  if (mediaMessages.length === 0) return null
                  return (
                    <div className="flex gap-1 mt-3 overflow-hidden">
                      {mediaMessages.slice(-4).map((m, i) => (
                        <div key={i} className="w-[90px] h-[90px] rounded overflow-hidden bg-[#202c33] flex-shrink-0">
                          <img
                            src={getMediaSrc(m.mediaId!)}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>


              {/* Bottom padding */}
              <div className="h-4" />
            </div>
          </div>
        )}
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
            isOpen={copilotOpen}
            onClose={() => setCopilotOpen(false)}
            onSendToChat={(text) => handleSendMessage(text)}
            calendarConnected={calendarConnected}
          />
          {/* AutopilotActivityIndicator hidden */}
        </>
      ) : connectionStatus === 'checking' ? (
        <div className="flex-1 flex items-center justify-center bg-[#222e35]">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#00a884] mx-auto mb-4" />
            <p className="text-[#8696a0] text-sm">Verificando conexão...</p>
          </div>
        </div>
      ) : connectionStatus === 'initializing' || connectionStatus === 'qr_ready' || connectionStatus === 'connecting' ? (
        renderConnecting()
      ) : (
        renderDisconnected()
      )}

      {/* Forward message modal */}
      {forwardingMessage && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center" onClick={() => setForwardingMessage(null)}>
          <div
            className="bg-[#111b21] rounded-xl w-[420px] max-h-[500px] flex flex-col shadow-2xl border border-[#2a3942] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2a3942]">
              <button onClick={() => setForwardingMessage(null)} className="text-[#aebac1] hover:text-white">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-[#e9edef] text-[16px] font-medium">Reencaminhar mensagem</h3>
            </div>
            <div className="px-4 py-3 border-b border-[#2a3942]">
              <div className="flex items-center gap-2 bg-[#202c33] rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-[#8696a0]" />
                <input
                  type="text"
                  placeholder="Pesquisar conversa..."
                  value={forwardSearch}
                  onChange={(e) => setForwardSearch(e.target.value)}
                  className="bg-transparent text-[#e9edef] text-[14px] outline-none flex-1 placeholder-[#8696a0]"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
              {conversations
                .filter(c => {
                  if (!forwardSearch.trim()) return true
                  const s = forwardSearch.toLowerCase()
                  return (c.contact_name?.toLowerCase().includes(s)) || c.contact_phone.includes(s)
                })
                .map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => handleForwardMessage(conv)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#202c33] transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#2a3942] flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {conv.profile_pic_url ? (
                        <img src={conv.profile_pic_url} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <Users className="w-5 h-5 text-[#8696a0]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#e9edef] text-[15px] truncate">
                        {conv.contact_name || conv.contact_phone}
                      </p>
                      <p className="text-[#8696a0] text-[12px] truncate">
                        {conv.contact_phone.includes('@g.us') ? 'Grupo' : conv.contact_phone}
                      </p>
                    </div>
                  </button>
                ))
              }
            </div>
          </div>
        </div>
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

      {/* Message dropdown menu */}
      {contextMenu && (
        <div
          className="fixed z-[90] bg-[#233138] rounded-lg shadow-xl min-w-[200px] border border-[#2a3942] overflow-hidden"
          style={{
            left: Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 220 : 800),
            top: Math.min(contextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 220 : 600)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Actions */}
          <div className="py-1">
            {contextMenu.message.type !== 'revoked' && (
              <button
                onClick={() => {
                  setReplyingTo(contextMenu.message)
                  closeContextMenu()
                  setTimeout(() => {
                    const input = document.querySelector<HTMLTextAreaElement>('[data-message-input]')
                    input?.focus()
                  }, 100)
                }}
                className="w-full text-left px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#2a3942] transition-colors flex items-center gap-3"
              >
                <ArrowLeft className="w-4 h-4 text-[#8696a0] rotate-[225deg]" />
                Responder
              </button>
            )}
            {contextMenu.message.fromMe && contextMenu.message.type === 'text' && contextMenu.message.body && (
              <button
                onClick={startEditMessage}
                className="w-full text-left px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#2a3942] transition-colors flex items-center gap-3"
              >
                <Pencil className="w-4 h-4 text-[#8696a0]" />
                Editar
              </button>
            )}
            <button
              onClick={startForwardMessage}
              className="w-full text-left px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#2a3942] transition-colors flex items-center gap-3"
            >
              <Share2 className="w-4 h-4 text-[#8696a0]" />
              Reencaminhar
            </button>
            <button
              onClick={() => handleDeleteMessage(false)}
              disabled={isDeletingMessage}
              className="w-full text-left px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#2a3942] transition-colors flex items-center gap-3"
            >
              <Trash2 className="w-4 h-4 text-[#8696a0]" />
              Apagar para mim
            </button>
            {contextMenu.message.fromMe && (
              <button
                onClick={() => handleDeleteMessage(true)}
                disabled={isDeletingMessage}
                className="w-full text-left px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#2a3942] transition-colors flex items-center gap-3"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                Apagar para todos
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
