'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, Zap, Search, Check, Loader2, Clock, MessageSquare,
  AlertCircle, ChevronDown, ChevronUp, Settings, Users, FileText
} from 'lucide-react'

interface WhatsAppConversation {
  id: string
  contact_phone: string
  contact_name: string | null
  profile_pic_url: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
  message_count: number
  autopilot_needs_human?: boolean
}

interface AutopilotSettings {
  response_delay_min: number
  response_delay_max: number
  max_responses_per_contact_per_day: number
  working_hours_only: boolean
  working_hours_start: string
  working_hours_end: string
  tone: 'consultivo' | 'informal' | 'formal'
}

interface AutopilotContact {
  id: string
  contact_phone: string
  contact_name: string | null
  enabled: boolean
  needs_human: boolean
  needs_human_reason: string | null
  auto_responses_today: number
}

interface AutopilotLogEntry {
  id: string
  contact_phone: string
  contact_name: string | null
  incoming_message: string
  action: string
  ai_response: string | null
  ai_reasoning: string | null
  created_at: string
}

interface WAContact {
  id: string
  phone: string
  name: string
  pushname: string
  isMyContact: boolean
}

interface AutopilotPanelProps {
  isOpen: boolean
  onClose: () => void
  conversations: WhatsAppConversation[]
  authToken: string | null
  onConfigChange: (enabled: boolean) => void
}

const DEFAULT_SETTINGS: AutopilotSettings = {
  response_delay_min: 15,
  response_delay_max: 60,
  max_responses_per_contact_per_day: 5,
  working_hours_only: true,
  working_hours_start: '08:00',
  working_hours_end: '18:00',
  tone: 'consultivo'
}

export default function AutopilotPanel({
  isOpen,
  onClose,
  conversations,
  authToken,
  onConfigChange
}: AutopilotPanelProps) {
  const [enabled, setEnabled] = useState(false)
  const [customInstructions, setCustomInstructions] = useState('')
  const [settings, setSettings] = useState<AutopilotSettings>(DEFAULT_SETTINGS)
  const [monitoredContacts, setMonitoredContacts] = useState<Map<string, AutopilotContact>>(new Map())
  const [log, setLog] = useState<AutopilotLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [allContacts, setAllContacts] = useState<WAContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)

  const headers: Record<string, string> = authToken
    ? { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }

  // Load config + monitored contacts on open
  const loadData = useCallback(async () => {
    if (!authToken) return
    setIsLoading(true)

    try {
      const [configRes, contactsRes] = await Promise.all([
        fetch('/api/autopilot/config', { headers }),
        fetch('/api/autopilot/contacts', { headers })
      ])

      if (configRes.ok) {
        const configData = await configRes.json()
        if (configData.config) {
          setEnabled(configData.config.enabled || false)
          setCustomInstructions(configData.config.custom_instructions || '')
          setSettings({ ...DEFAULT_SETTINGS, ...(configData.config.settings || {}) })
        }
      } else {
        console.error('[AutopilotPanel] Config API error:', configRes.status)
      }

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json()
        if (contactsData.contacts) {
          const map = new Map<string, AutopilotContact>()
          contactsData.contacts.forEach((c: AutopilotContact) => {
            map.set(c.contact_phone, c)
          })
          setMonitoredContacts(map)
        }
      } else {
        console.error('[AutopilotPanel] Contacts API error:', contactsRes.status)
      }
    } catch (err) {
      console.error('[AutopilotPanel] Load error:', err)
    } finally {
      setIsLoading(false)
    }

    // Also fetch all WhatsApp contacts (non-blocking)
    setLoadingContacts(true)
    try {
      const waRes = await fetch('/api/whatsapp/contacts', { headers })
      if (waRes.ok) {
        const waData = await waRes.json()
        setAllContacts(waData.contacts || [])
      }
    } catch (err) {
      console.error('[AutopilotPanel] WA contacts error:', err)
    } finally {
      setLoadingContacts(false)
    }
  }, [authToken])

  useEffect(() => {
    if (isOpen) loadData()
  }, [isOpen, loadData])

  // Save config
  const saveConfig = async () => {
    if (!authToken) return
    setIsSaving(true)

    try {
      const res = await fetch('/api/autopilot/config', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          enabled,
          customInstructions,
          settings
        })
      })

      if (res.ok) {
        setHasChanges(false)
        onConfigChange(enabled)
      }
    } catch (err) {
      console.error('[AutopilotPanel] Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle contact
  const toggleContact = async (phone: string, name: string | null) => {
    if (!authToken) return

    const isMonitored = monitoredContacts.has(phone)
    const action = isMonitored ? 'remove' : 'add'

    try {
      const res = await fetch('/api/autopilot/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, contactPhone: phone, contactName: name })
      })

      if (res.ok) {
        setMonitoredContacts(prev => {
          const next = new Map(prev)
          if (action === 'remove') {
            next.delete(phone)
          } else {
            next.set(phone, {
              id: '',
              contact_phone: phone,
              contact_name: name,
              enabled: true,
              needs_human: false,
              needs_human_reason: null,
              auto_responses_today: 0
            })
          }
          return next
        })
      }
    } catch (err) {
      console.error('[AutopilotPanel] Toggle contact error:', err)
    }
  }

  // Select all contacts
  const selectAll = async () => {
    if (!authToken) return

    const contacts = mergedContacts.map(c => ({
      phone: c.phone,
      name: c.name
    }))

    try {
      const res = await fetch('/api/autopilot/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'batch_add', contacts })
      })

      if (res.ok) {
        setMonitoredContacts(prev => {
          const next = new Map(prev)
          contacts.forEach(c => {
            if (!next.has(c.phone)) {
              next.set(c.phone, {
                id: '',
                contact_phone: c.phone,
                contact_name: c.name,
                enabled: true,
                needs_human: false,
                needs_human_reason: null,
                auto_responses_today: 0
              })
            }
          })
          return next
        })
      }
    } catch (err) {
      console.error('[AutopilotPanel] Select all error:', err)
    }
  }

  // Deselect all
  const deselectAll = async () => {
    if (!authToken) return

    // Remove each one
    const phones = Array.from(monitoredContacts.keys())
    for (const phone of phones) {
      await fetch('/api/autopilot/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'remove', contactPhone: phone })
      })
    }
    setMonitoredContacts(new Map())
  }

  // Toggle enabled and auto-save
  const handleToggle = async () => {
    const newEnabled = !enabled
    setEnabled(newEnabled)

    if (authToken) {
      try {
        const res = await fetch('/api/autopilot/config', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            enabled: newEnabled,
            customInstructions,
            settings
          })
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          console.error('[AutopilotPanel] Toggle save failed:', res.status, errData)
          setEnabled(!newEnabled) // revert
          return
        }
        onConfigChange(newEnabled)
      } catch (err) {
        console.error('[AutopilotPanel] Toggle error:', err)
        setEnabled(!newEnabled)
      }
    }
  }

  // Merge all WhatsApp contacts + recent conversations into a unified list
  const mergedContacts = (() => {
    const seen = new Set<string>()
    const result: { phone: string; name: string; profilePic: string | null }[] = []

    // First: conversations (have profile pics and recent data)
    conversations
      .filter(c => !c.contact_phone.includes('@g.us'))
      .forEach(c => {
        if (!seen.has(c.contact_phone)) {
          seen.add(c.contact_phone)
          result.push({
            phone: c.contact_phone,
            name: c.contact_name || c.contact_phone,
            profilePic: c.profile_pic_url
          })
        }
      })

    // Then: all WhatsApp contacts not yet added
    allContacts.forEach(c => {
      // Match by phone suffix (last 9 digits) to avoid duplicates with different formats
      const suffix = c.phone.replace(/\D/g, '').slice(-9)
      const alreadyExists = result.some(r => {
        const rSuffix = r.phone.replace(/\D/g, '').replace(/^55/, '').slice(-9)
        return rSuffix === suffix
      })
      if (!alreadyExists && !seen.has(c.id)) {
        seen.add(c.id)
        result.push({
          phone: c.id, // Use serialized ID (@c.us format)
          name: c.name || c.pushname || c.phone,
          profilePic: null
        })
      }
    })

    return result
  })()

  // Filter merged contacts by search
  const filteredContacts = mergedContacts.filter(c => {
    if (!contactSearch) return true
    const search = contactSearch.toLowerCase()
    return (
      c.name.toLowerCase().includes(search) ||
      c.phone.includes(search)
    )
  })

  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-[50] flex">
      {/* Panel */}
      <div className="w-full bg-[#111b21] flex flex-col animate-slide-in-left">
        {/* Header */}
        <div className="h-[60px] bg-[#202c33] flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="text-[#aebac1] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${enabled ? 'bg-[#00a884]' : 'bg-[#364147]'}`}>
              <Zap className="w-4 h-4 text-white relative z-10" />
            </div>
            <div>
              <h2 className="text-[#e9edef] text-[15px] font-medium">Piloto Automático</h2>
              <p className="text-[#8696a0] text-[11px]">
                {enabled ? `${monitoredContacts.size} contatos monitorados` : 'Desativado'}
              </p>
            </div>
          </div>
          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              enabled ? 'bg-[#00a884]' : 'bg-[#364147]'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
              enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#00a884]" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
            {/* Instructions */}
            <div className="p-4 border-b border-[#222d35]">
              <label className="text-[#00a884] text-[12px] font-medium uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5" />
                Instruções para a IA
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => {
                  setCustomInstructions(e.target.value)
                  setHasChanges(true)
                }}
                placeholder="Ex: Sempre mencione nosso teste gratuito de 7 dias. Não fale sobre concorrentes. Se perguntarem sobre preço, diga que o time comercial entrará em contato..."
                maxLength={2000}
                className="w-full bg-[#2a3942] text-[#e9edef] text-[13px] rounded-lg p-3 resize-none h-28 placeholder-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884]/50 transition-all"
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[#8696a0] text-[11px]">
                  {customInstructions.length}/2000
                </span>
                {hasChanges && (
                  <button
                    onClick={saveConfig}
                    disabled={isSaving}
                    className="text-[11px] px-3 py-1 bg-[#00a884] text-white rounded-full font-medium hover:bg-[#00a884]/90 transition-colors flex items-center gap-1"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Salvar
                  </button>
                )}
              </div>
            </div>

            {/* Settings (collapsible) */}
            <div className="border-b border-[#222d35]">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full px-4 py-3 flex items-center justify-between text-[#e9edef] hover:bg-[#202c33] transition-colors"
              >
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <Settings className="w-4 h-4 text-[#00a884]" />
                  Configurações
                </span>
                {showSettings ? <ChevronUp className="w-4 h-4 text-[#8696a0]" /> : <ChevronDown className="w-4 h-4 text-[#8696a0]" />}
              </button>

              {showSettings && (
                <div className="px-4 pb-4 space-y-4">
                  {/* Response delay */}
                  <div>
                    <label className="text-[#8696a0] text-[11px] uppercase tracking-wide mb-1.5 block">
                      Delay de resposta: {settings.response_delay_min}s – {settings.response_delay_max}s
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="5"
                        max="120"
                        value={settings.response_delay_min}
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          setSettings(prev => ({
                            ...prev,
                            response_delay_min: val,
                            response_delay_max: Math.max(val + 10, prev.response_delay_max)
                          }))
                          setHasChanges(true)
                        }}
                        className="flex-1 accent-[#00a884]"
                      />
                      <input
                        type="range"
                        min="15"
                        max="180"
                        value={settings.response_delay_max}
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          setSettings(prev => ({
                            ...prev,
                            response_delay_max: val,
                            response_delay_min: Math.min(prev.response_delay_min, val - 10)
                          }))
                          setHasChanges(true)
                        }}
                        className="flex-1 accent-[#00a884]"
                      />
                    </div>
                  </div>

                  {/* Max responses per day */}
                  <div>
                    <label className="text-[#8696a0] text-[11px] uppercase tracking-wide mb-1.5 block">
                      Max respostas por contato/dia
                    </label>
                    <div className="flex gap-2">
                      {[3, 5, 10].map(n => (
                        <button
                          key={n}
                          onClick={() => {
                            setSettings(prev => ({ ...prev, max_responses_per_contact_per_day: n }))
                            setHasChanges(true)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                            settings.max_responses_per_contact_per_day === n
                              ? 'bg-[#00a884] text-white'
                              : 'bg-[#2a3942] text-[#e9edef] hover:bg-[#364147]'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Working hours */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[#8696a0] text-[11px] uppercase tracking-wide">
                        Horário comercial
                      </label>
                      <button
                        onClick={() => {
                          setSettings(prev => ({ ...prev, working_hours_only: !prev.working_hours_only }))
                          setHasChanges(true)
                        }}
                        className={`w-9 h-5 rounded-full transition-colors relative ${
                          settings.working_hours_only ? 'bg-[#00a884]' : 'bg-[#364147]'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                          settings.working_hours_only ? 'translate-x-[18px]' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                    {settings.working_hours_only && (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={settings.working_hours_start}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, working_hours_start: e.target.value }))
                            setHasChanges(true)
                          }}
                          className="bg-[#2a3942] text-[#e9edef] text-[12px] rounded-lg px-2.5 py-1.5 outline-none"
                        />
                        <span className="text-[#8696a0] text-[12px]">até</span>
                        <input
                          type="time"
                          value={settings.working_hours_end}
                          onChange={(e) => {
                            setSettings(prev => ({ ...prev, working_hours_end: e.target.value }))
                            setHasChanges(true)
                          }}
                          className="bg-[#2a3942] text-[#e9edef] text-[12px] rounded-lg px-2.5 py-1.5 outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="text-[#8696a0] text-[11px] uppercase tracking-wide mb-1.5 block">
                      Tom das respostas
                    </label>
                    <div className="flex gap-2">
                      {([
                        { key: 'consultivo' as const, label: 'Consultivo' },
                        { key: 'informal' as const, label: 'Informal' },
                        { key: 'formal' as const, label: 'Formal' }
                      ]).map(t => (
                        <button
                          key={t.key}
                          onClick={() => {
                            setSettings(prev => ({ ...prev, tone: t.key }))
                            setHasChanges(true)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                            settings.tone === t.key
                              ? 'bg-[#00a884] text-white'
                              : 'bg-[#2a3942] text-[#e9edef] hover:bg-[#364147]'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Contacts */}
            <div className="border-b border-[#222d35]">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-medium text-[#e9edef]">
                  <Users className="w-4 h-4 text-[#00a884]" />
                  Contatos Monitorados
                  <span className="text-[11px] text-[#8696a0] bg-[#2a3942] px-2 py-0.5 rounded-full">
                    {monitoredContacts.size}/{mergedContacts.length}
                  </span>
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={selectAll}
                    className="text-[10px] px-2 py-1 bg-[#2a3942] text-[#00a884] rounded-full hover:bg-[#364147] transition-colors"
                  >
                    Todos
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-[10px] px-2 py-1 bg-[#2a3942] text-[#8696a0] rounded-full hover:bg-[#364147] transition-colors"
                  >
                    Nenhum
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="px-4 pb-2">
                <div className="flex items-center bg-[#2a3942] rounded-lg px-3 py-2 gap-2">
                  <Search className="w-4 h-4 text-[#8696a0]" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Buscar contato..."
                    className="flex-1 bg-transparent text-[#e9edef] text-[13px] placeholder-[#8696a0] outline-none"
                  />
                </div>
              </div>

              {/* Contact list */}
              <div className="max-h-[280px] overflow-y-auto whatsapp-scrollbar">
                {loadingContacts && allContacts.length === 0 ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-[#8696a0] text-[13px]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando contatos...
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-6 text-[#8696a0] text-[13px]">
                    Nenhum contato encontrado
                  </div>
                ) : (
                  filteredContacts.map(c => {
                    const isMonitored = monitoredContacts.has(c.phone)
                    const contact = monitoredContacts.get(c.phone)
                    const initials = c.name.charAt(0).toUpperCase()

                    return (
                      <button
                        key={c.phone}
                        onClick={() => toggleContact(c.phone, c.name)}
                        className="w-full flex items-center px-4 py-2.5 hover:bg-[#202c33] transition-colors gap-3"
                      >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          {c.profilePic ? (
                            <img src={c.profilePic} className="w-10 h-10 rounded-full" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center text-[#e9edef] text-[14px] font-medium">
                              {initials}
                            </div>
                          )}
                          {contact?.needs_human && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#111b21]">
                              <AlertCircle className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[#e9edef] text-[14px] truncate">
                            {c.name}
                          </p>
                          {contact?.needs_human && (
                            <p className="text-amber-400 text-[11px] truncate">
                              Precisa atenção: {contact.needs_human_reason}
                            </p>
                          )}
                        </div>

                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          isMonitored ? 'bg-[#00a884]' : 'border-2 border-[#8696a0]'
                        }`}>
                          {isMonitored && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Activity Log (collapsible) */}
            <div>
              <button
                onClick={async () => {
                  if (!showLog && authToken) {
                    // Fetch log when expanding
                    try {
                      const res = await fetch('/api/autopilot/config', { headers })
                      // We'll use a simple approach - load log data
                    } catch {}
                  }
                  setShowLog(!showLog)
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-[#e9edef] hover:bg-[#202c33] transition-colors"
              >
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <Clock className="w-4 h-4 text-[#00a884]" />
                  Atividade Recente
                </span>
                {showLog ? <ChevronUp className="w-4 h-4 text-[#8696a0]" /> : <ChevronDown className="w-4 h-4 text-[#8696a0]" />}
              </button>

              {showLog && (
                <div className="px-4 pb-4">
                  {log.length === 0 ? (
                    <div className="text-center py-4 text-[#8696a0] text-[12px]">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-[#364147]" />
                      Nenhuma atividade ainda.
                      <br />O log aparecerá quando o autopiloto responder mensagens.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {log.slice(0, 10).map(entry => (
                        <div key={entry.id} className="bg-[#202c33] rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              entry.action === 'responded' ? 'bg-green-900/40 text-green-400' :
                              entry.action === 'flagged_human' ? 'bg-amber-900/40 text-amber-400' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                              {entry.action === 'responded' ? 'Respondido' :
                               entry.action === 'flagged_human' ? 'Marcado' :
                               entry.action === 'skipped_limit' ? 'Limite' :
                               entry.action === 'skipped_hours' ? 'Fora de horário' :
                               entry.action === 'skipped_credits' ? 'Sem créditos' : entry.action}
                            </span>
                            <span className="text-[#8696a0] text-[10px]">
                              {entry.contact_name || entry.contact_phone}
                            </span>
                          </div>
                          <p className="text-[#e9edef] text-[12px] truncate">
                            Lead: "{entry.incoming_message}"
                          </p>
                          {entry.ai_response && (
                            <p className="text-[#00a884] text-[11px] mt-1 truncate">
                              → {entry.ai_response}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
