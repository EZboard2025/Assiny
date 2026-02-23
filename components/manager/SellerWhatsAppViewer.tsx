'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, MessageCircle, Image as ImageIcon, FileText, Mic, Eye, X, User } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

interface Conversation {
  contact_phone: string
  contact_name: string | null
  last_message_at: string
  last_message_preview: string | null
  unread_count: number
  message_count: number
  profile_pic_url: string | null
}

interface Message {
  id: string
  wa_message_id: string
  contact_phone: string
  content: string | null
  direction: 'inbound' | 'outbound'
  message_timestamp: string
  message_type: string
  media_id: string | null
  media_mime_type: string | null
  contact_name: string | null
  status: string
  transcription: string | null
  is_autopilot: boolean
  raw_payload: any
}

interface SellerWhatsAppViewerProps {
  sellerId: string
  sellerName: string
  onClose: () => void
}

// ── Helpers ──────────────────────────────────────────────────────

const HIDDEN_TYPES = new Set([
  'reaction', 'e2e_notification', 'notification', 'notification_template',
  'gp2', 'call_log', 'protocol', 'ciphertext', 'revoked', 'groups_v4_invite'
])

const formatPhone = (phone: string) => {
  if (!phone) return ''
  if (phone.includes('@g.us')) return 'Grupo'
  const clean = phone.replace(/\D/g, '')
  if (clean.length === 13 && clean.startsWith('55')) {
    return `+${clean.slice(0, 2)} ${clean.slice(2, 4)} ${clean.slice(4, 9)}-${clean.slice(9)}`
  }
  if (clean.length >= 10) {
    return `${clean.slice(0, 2)} ${clean.slice(2, 7)}-${clean.slice(7)}`
  }
  return phone
}

const formatTime = (ts: string) =>
  new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const formatDateLabel = (ts: string) => {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Hoje'
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatRelative = (ts: string) => {
  const now = Date.now()
  const diff = now - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ── Component ────────────────────────────────────────────────────

export default function SellerWhatsAppViewer({ sellerId, sellerName, onClose }: SellerWhatsAppViewerProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [search, setSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [sellerId])

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const loadConversations = async () => {
    try {
      setLoadingConvs(true)
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()
      const res = await fetch(`/api/admin/seller-whatsapp-conversations?sellerId=${sellerId}`, {
        headers: { 'x-company-id': companyId || '' }
      })
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch (err) {
      console.error('Erro ao carregar conversas:', err)
    } finally {
      setLoadingConvs(false)
    }
  }

  const loadMessages = async (conv: Conversation) => {
    setSelectedConv(conv)
    setLoadingMsgs(true)
    try {
      const { getCompanyId } = await import('@/lib/utils/getCompanyFromSubdomain')
      const companyId = await getCompanyId()
      const res = await fetch(
        `/api/admin/seller-whatsapp-messages?sellerId=${sellerId}&contactPhone=${encodeURIComponent(conv.contact_phone)}`,
        { headers: { 'x-company-id': companyId || '' } }
      )
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err)
    } finally {
      setLoadingMsgs(false)
    }
  }

  const filtered = conversations.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (c.contact_name?.toLowerCase().includes(q)) || c.contact_phone.includes(q)
  })

  const visibleMessages = messages.filter(m => !HIDDEN_TYPES.has(m.message_type))

  // Group messages by date
  const groupedMessages: { label: string; msgs: Message[] }[] = []
  let currentLabel = ''
  visibleMessages.forEach(msg => {
    const label = formatDateLabel(msg.message_timestamp)
    if (label !== currentLabel) {
      currentLabel = label
      groupedMessages.push({ label, msgs: [msg] })
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg)
    }
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <div className="w-64 border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-700 truncate flex-1">{sellerName}</span>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-2 py-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-300 focus:border-green-300"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-green-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 px-3">
              <MessageCircle className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
              <p className="text-[11px] text-gray-400">Nenhuma conversa</p>
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.contact_phone}
                onClick={() => loadMessages(conv)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors ${
                  selectedConv?.contact_phone === conv.contact_phone
                    ? 'bg-green-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {conv.profile_pic_url ? (
                    <img src={conv.profile_pic_url} className="w-8 h-8 rounded-full flex-shrink-0 object-cover" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-semibold text-gray-900 truncate">
                        {conv.contact_name || formatPhone(conv.contact_phone)}
                      </p>
                      <span className="text-[9px] text-gray-400 flex-shrink-0">
                        {conv.last_message_at ? formatRelative(conv.last_message_at) : ''}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">
                      {conv.last_message_preview || 'Sem mensagens'}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat Area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Eye className="w-10 h-10 mb-2 text-gray-300" />
            <p className="text-sm font-medium">Modo Leitura</p>
            <p className="text-[11px] text-gray-400">Selecione uma conversa para visualizar</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
              {selectedConv.profile_pic_url ? (
                <img src={selectedConv.profile_pic_url} className="w-8 h-8 rounded-full object-cover" alt="" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {selectedConv.contact_name || formatPhone(selectedConv.contact_phone)}
                </p>
                <p className="text-[10px] text-gray-400">{formatPhone(selectedConv.contact_phone)}</p>
              </div>
              <span className="text-[9px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {selectedConv.message_count} msgs
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50/50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e5e7eb\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[11px] text-gray-400">Nenhuma mensagem encontrada</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {groupedMessages.map((group, gi) => (
                    <div key={gi}>
                      {/* Date separator */}
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                          {group.label}
                        </span>
                      </div>
                      {group.msgs.map(msg => (
                        <MessageBubble key={msg.id} msg={msg} />
                      ))}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Read-only footer */}
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-center gap-2 bg-gray-50 flex-shrink-0">
              <Eye className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] text-gray-400 font-medium">Modo somente leitura</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Message Bubble ───────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isOutbound = msg.direction === 'outbound'
  const isImage = msg.message_type === 'image' || msg.media_mime_type?.startsWith('image/')
  const isAudio = msg.message_type === 'ptt' || msg.message_type === 'audio' || msg.media_mime_type?.startsWith('audio/')
  const isDocument = msg.message_type === 'document'

  return (
    <div className={`flex mb-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-sm ${
        isOutbound
          ? 'bg-green-100 border border-green-200'
          : 'bg-white border border-gray-200'
      }`}>
        {/* Image */}
        {isImage && msg.media_id && (
          <img
            src={`/api/whatsapp/media/${msg.media_id}`}
            className="max-w-full rounded-md mb-1"
            style={{ maxHeight: '200px' }}
            alt=""
          />
        )}

        {/* Audio */}
        {isAudio && (
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            {msg.media_id ? (
              <audio controls className="h-7 max-w-[200px]" style={{ minWidth: '160px' }}>
                <source src={`/api/whatsapp/media/${msg.media_id}`} />
              </audio>
            ) : (
              <span className="text-[10px] text-gray-500 italic">Audio</span>
            )}
          </div>
        )}

        {/* Document */}
        {isDocument && (
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] text-blue-600">Documento</span>
          </div>
        )}

        {/* Text content */}
        {msg.content && (
          <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
            {msg.content}
          </p>
        )}

        {/* Transcription */}
        {msg.transcription && (
          <p className="text-[10px] text-gray-500 italic mt-1 pt-1 border-t border-gray-200/50">
            {msg.transcription}
          </p>
        )}

        {/* Autopilot badge */}
        {msg.is_autopilot && (
          <span className="inline-block text-[8px] font-semibold text-purple-600 bg-purple-50 px-1 py-0.5 rounded mt-0.5">
            Autopilot
          </span>
        )}

        {/* Time */}
        <p className={`text-[9px] mt-0.5 text-right ${isOutbound ? 'text-green-600/60' : 'text-gray-400'}`}>
          {formatTime(msg.message_timestamp)}
        </p>
      </div>
    </div>
  )
}
