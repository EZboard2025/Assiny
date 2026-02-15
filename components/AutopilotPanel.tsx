'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  X, Zap, Search, Check, Loader2, Clock, MessageSquare,
  AlertCircle, ChevronDown, ChevronUp, Settings, Users, FileText,
  Sparkles, ArrowRight, RotateCcw
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
  objective_reached: boolean
  objective_reached_reason: string | null
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
  response_delay_max: 15,
  max_responses_per_contact_per_day: 999,
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
  const [showImproveFlow, setShowImproveFlow] = useState(false)
  const [improveStep, setImproveStep] = useState(0)
  const [improveAnswers, setImproveAnswers] = useState({
    objetivo: '', estrategia: '', contexto: '', restricoes: '', escalonamento: ''
  })
  const [isImproving, setIsImproving] = useState(false)
  const improveQuestions = [
    { key: 'objetivo', question: 'Qual o seu objetivo com esses leads?', placeholder: 'Ex: Agendar uma demo, qualificar perfil, reativar lead que sumiu...' },
    { key: 'estrategia', question: 'Como quer que a IA conduza a conversa?', placeholder: 'Ex: Usar prova social, fazer perguntas, manter leve sem pressionar...' },
    { key: 'contexto', question: 'Qual o perfil geral desses leads?', placeholder: 'Ex: Donos de empresa pequena, gerentes comerciais, profissionais de marketing...' },
    { key: 'restricoes', question: 'Tem algo que a IA não deve fazer?', placeholder: 'Ex: Não falar preço, não mencionar concorrente, não mandar muitas msgs...' },
    { key: 'escalonamento', question: 'Quando a IA deve parar e te chamar?', placeholder: 'Ex: Se pedir valores, se quiser fechar, se ficar agressivo...' },
  ]

  const headers: Record<string, string> = authToken
    ? { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }

  const handleGenerateInstructions = async () => {
    setIsImproving(true)
    try {
      const res = await fetch('/api/autopilot/improve-prompt', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          answers: improveAnswers,
          currentInstructions: customInstructions
        })
      })
      if (res.ok) {
        const { prompt } = await res.json()
        if (prompt) {
          setCustomInstructions(prompt)
          setHasChanges(true)
          setShowImproveFlow(false)
        }
      }
    } catch (err) {
      console.error('Improve prompt error:', err)
    } finally {
      setIsImproving(false)
    }
  }

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
              auto_responses_today: 0,
              objective_reached: false,
              objective_reached_reason: null
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
                auto_responses_today: 0,
                objective_reached: false,
                objective_reached_reason: null
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

  const currentQ = improveQuestions[improveStep]

  return (
    <div className="absolute inset-0 z-[50] flex">
      <div className="w-full bg-[#111b21] flex flex-col animate-slide-in-left">
        {/* Header - clean and simple */}
        <div className="h-[60px] bg-[#202c33] flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={onClose} className="text-[#aebac1] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${enabled ? 'bg-[#00a884]' : 'bg-[#364147]'}`}>
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-[#e9edef] text-[15px] font-medium">Piloto Automático</h2>
              <p className="text-[11px]">
                {enabled
                  ? <span className="text-[#00a884]">{monitoredContacts.size} contatos ativos</span>
                  : <span className="text-[#8696a0]">Desativado</span>
                }
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            className={`w-11 h-6 rounded-full transition-colors relative ${enabled ? 'bg-[#00a884]' : 'bg-[#364147]'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#00a884]" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto whatsapp-scrollbar">

            {/* === SECTION 1: Instructions === */}
            <div className="p-4 border-b border-[#222d35]">

              {/* Mode toggle */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#e9edef] text-[14px] font-medium">
                  {showImproveFlow ? 'Configure com a IA' : 'Instruções do Autopiloto'}
                </p>
                <button
                  onClick={() => {
                    setShowImproveFlow(!showImproveFlow)
                    setImproveStep(0)
                    setImproveAnswers({ objetivo: '', estrategia: '', contexto: '', restricoes: '', escalonamento: '' })
                  }}
                  className="text-[11px] px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition-all bg-[#2a3942] text-[#00a884] hover:bg-[#364147]"
                >
                  {showImproveFlow ? (
                    <><FileText className="w-3 h-3" /> Escrever manual</>
                  ) : (
                    <><Sparkles className="w-3 h-3" /> Configurar com IA</>
                  )}
                </button>
              </div>

              {showImproveFlow ? (
                <div className="flex flex-col">
                  {/* Progress bar */}
                  <div className="flex items-center gap-1.5 mb-3">
                    {improveQuestions.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i < improveStep ? 'bg-[#00a884]' :
                          i === improveStep ? 'bg-[#00a884]/50' :
                          'bg-[#2a3942]'
                        }`}
                      />
                    ))}
                    <span className="text-[#8696a0] text-[10px] ml-1">{Math.min(improveStep + 1, improveQuestions.length)}/5</span>
                  </div>

                  {/* Chat conversation */}
                  <div className="space-y-3 mb-3 max-h-[300px] overflow-y-auto whatsapp-scrollbar">
                    {improveQuestions.map((q, i) => {
                      if (i > improveStep) return null
                      const answer = improveAnswers[q.key as keyof typeof improveAnswers]
                      return (
                        <div key={q.key} className="space-y-2">
                          {/* AI bubble */}
                          <div className="flex gap-2 items-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4a1] flex items-center justify-center flex-shrink-0">
                              <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="bg-[#202c33] rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[82%]">
                              <p className="text-[#e9edef] text-[13px] leading-snug">{q.question}</p>
                              {i === improveStep && (
                                <p className="text-[#8696a0] text-[11px] mt-1">{q.placeholder}</p>
                              )}
                            </div>
                          </div>
                          {/* User answer */}
                          {answer && i < improveStep && (
                            <div className="flex justify-end pl-9">
                              <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[82%]">
                                <p className="text-[#e9edef] text-[13px] leading-snug">{answer}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Input */}
                  {improveStep < improveQuestions.length && !isImproving ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={improveAnswers[currentQ.key as keyof typeof improveAnswers]}
                        onChange={(e) => setImproveAnswers(prev => ({ ...prev, [currentQ.key]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && improveAnswers[currentQ.key as keyof typeof improveAnswers].length > 0) {
                            if (improveStep < improveQuestions.length - 1) {
                              setImproveStep(prev => prev + 1)
                            } else {
                              handleGenerateInstructions()
                            }
                          }
                        }}
                        autoFocus
                        placeholder="Sua resposta..."
                        className="flex-1 bg-[#2a3942] text-[#e9edef] text-[13px] rounded-full px-4 py-3 placeholder-[#8696a0]/50 outline-none focus:ring-1 focus:ring-[#00a884]/40 transition-all"
                      />
                      <button
                        onClick={() => {
                          if (improveAnswers[currentQ.key as keyof typeof improveAnswers].length > 0) {
                            if (improveStep < improveQuestions.length - 1) {
                              setImproveStep(prev => prev + 1)
                            } else {
                              handleGenerateInstructions()
                            }
                          }
                        }}
                        disabled={!improveAnswers[currentQ.key as keyof typeof improveAnswers]}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-[#00a884] text-white hover:bg-[#00a884]/90 disabled:opacity-20 disabled:bg-[#2a3942] flex-shrink-0"
                      >
                        {improveStep === improveQuestions.length - 1 ? (
                          <Sparkles className="w-4 h-4" />
                        ) : (
                          <ArrowRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ) : isImproving ? (
                    <div className="flex items-center gap-3 py-4 px-4 bg-[#202c33] rounded-2xl">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00a884] to-[#00d4a1] flex items-center justify-center flex-shrink-0">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      </div>
                      <span className="text-[#e9edef] text-[13px]">Montando suas instruções...</span>
                    </div>
                  ) : null}

                  {/* Restart */}
                  {improveStep > 0 && (
                    <button
                      onClick={() => {
                        setImproveStep(0)
                        setImproveAnswers({ objetivo: '', estrategia: '', contexto: '', restricoes: '', escalonamento: '' })
                      }}
                      className="text-[11px] text-[#8696a0] hover:text-[#e9edef] transition-colors flex items-center gap-1 self-center mt-2"
                    >
                      <RotateCcw className="w-3 h-3" /> Recomeçar
                    </button>
                  )}
                </div>

              ) : (
                /* Manual mode */
                <>
                  <p className="text-[#8696a0] text-[12px] mb-2">
                    Escreva o que a IA deve fazer quando conversar com seus leads.
                  </p>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => {
                      setCustomInstructions(e.target.value)
                      setHasChanges(true)
                    }}
                    placeholder={"Objetivo: Agendar uma reunião de demonstração\nEstratégia: Usar prova social e mencionar o teste grátis\nContexto: Leads B2B que demonstraram interesse inicial\nNão fazer: Não falar preço, não mencionar concorrentes\nEscalonar quando: Se pedir valores ou quiser fechar"}
                    maxLength={2000}
                    className="w-full bg-[#2a3942] text-[#e9edef] text-[13px] rounded-xl p-3.5 resize-y min-h-[130px] placeholder-[#8696a0]/50 outline-none focus:ring-1 focus:ring-[#00a884]/40 transition-all leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[#8696a0] text-[11px]">{customInstructions.length}/2000</span>
                    {hasChanges && (
                      <button
                        onClick={saveConfig}
                        disabled={isSaving}
                        className="text-[12px] px-4 py-1.5 bg-[#00a884] text-white rounded-full font-medium hover:bg-[#00a884]/90 transition-colors flex items-center gap-1.5"
                      >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Salvar
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* === SECTION 2: Settings (always open) === */}
            <div className="border-b border-[#222d35]">
              <div className="px-4 pt-3.5 pb-1 flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-[#8696a0]" />
                <span className="text-[14px] font-medium text-[#e9edef]">Configurações</span>
              </div>

              <div className="px-4 pb-4 space-y-4">
                  {/* Working hours */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[#e9edef] text-[13px]">Horário comercial</p>
                        <p className="text-[#8696a0] text-[11px]">Responde só no horário que você definir</p>
                      </div>
                      <button
                        onClick={() => {
                          setSettings(prev => ({ ...prev, working_hours_only: !prev.working_hours_only }))
                          setHasChanges(true)
                        }}
                        className={`w-10 h-[22px] rounded-full transition-colors relative ${settings.working_hours_only ? 'bg-[#00a884]' : 'bg-[#364147]'}`}
                      >
                        <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-transform shadow-sm ${settings.working_hours_only ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
                      </button>
                    </div>
                    {settings.working_hours_only && (
                      <div className="flex items-center gap-2 ml-0.5">
                        <input
                          type="time"
                          value={settings.working_hours_start}
                          onChange={(e) => { setSettings(prev => ({ ...prev, working_hours_start: e.target.value })); setHasChanges(true) }}
                          className="bg-[#2a3942] text-[#e9edef] text-[13px] rounded-lg px-3 py-2 outline-none"
                        />
                        <span className="text-[#8696a0] text-[13px]">até</span>
                        <input
                          type="time"
                          value={settings.working_hours_end}
                          onChange={(e) => { setSettings(prev => ({ ...prev, working_hours_end: e.target.value })); setHasChanges(true) }}
                          className="bg-[#2a3942] text-[#e9edef] text-[13px] rounded-lg px-3 py-2 outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Tone */}
                  <div>
                    <p className="text-[#e9edef] text-[13px] mb-2">Tom das respostas</p>
                    <div className="flex gap-2">
                      {([
                        { key: 'consultivo' as const, label: 'Consultivo', desc: 'Profissional e prestativo' },
                        { key: 'informal' as const, label: 'Informal', desc: 'Leve e descontraído' },
                        { key: 'formal' as const, label: 'Formal', desc: 'Sério e direto' }
                      ]).map(t => (
                        <button
                          key={t.key}
                          onClick={() => { setSettings(prev => ({ ...prev, tone: t.key })); setHasChanges(true) }}
                          className={`flex-1 px-3 py-2.5 rounded-xl text-center transition-all ${
                            settings.tone === t.key
                              ? 'bg-[#00a884] text-white ring-1 ring-[#00a884]'
                              : 'bg-[#2a3942] text-[#e9edef] hover:bg-[#364147]'
                          }`}
                        >
                          <p className="text-[12px] font-medium">{t.label}</p>
                          <p className={`text-[10px] mt-0.5 ${settings.tone === t.key ? 'text-white/70' : 'text-[#8696a0]'}`}>{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {hasChanges && (
                    <button
                      onClick={saveConfig}
                      disabled={isSaving}
                      className="w-full py-2.5 bg-[#00a884] text-white rounded-xl text-[13px] font-medium hover:bg-[#00a884]/90 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Salvar alterações
                    </button>
                  )}
                </div>
            </div>

            {/* === SECTION 3: Contacts === */}
            <div className="border-b border-[#222d35]">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-[#8696a0]" />
                  <span className="text-[14px] font-medium text-[#e9edef]">Contatos</span>
                  <span className="text-[11px] text-[#00a884] bg-[#00a884]/10 px-2 py-0.5 rounded-full font-medium">
                    {monitoredContacts.size} selecionados
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={selectAll} className="text-[11px] px-2.5 py-1 text-[#00a884] hover:bg-[#2a3942] rounded-full transition-colors">
                    Todos
                  </button>
                  <button onClick={deselectAll} className="text-[11px] px-2.5 py-1 text-[#8696a0] hover:bg-[#2a3942] rounded-full transition-colors">
                    Nenhum
                  </button>
                </div>
              </div>

              <div className="px-4 pb-2.5">
                <div className="flex items-center bg-[#2a3942] rounded-xl px-3.5 py-2.5 gap-2">
                  <Search className="w-4 h-4 text-[#8696a0]" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Buscar contato..."
                    className="flex-1 bg-transparent text-[#e9edef] text-[13px] placeholder-[#8696a0]/60 outline-none"
                  />
                </div>
              </div>

              <div className="max-h-[280px] overflow-y-auto whatsapp-scrollbar">
                {loadingContacts && allContacts.length === 0 ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-[#8696a0] text-[13px]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando...
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-[#8696a0] text-[13px]">Nenhum contato encontrado</div>
                ) : (
                  filteredContacts.map(c => {
                    const isMonitored = monitoredContacts.has(c.phone)
                    const contact = monitoredContacts.get(c.phone)
                    const initials = c.name.charAt(0).toUpperCase()

                    return (
                      <button
                        key={c.phone}
                        onClick={() => toggleContact(c.phone, c.name)}
                        className="w-full flex items-center px-4 py-2.5 hover:bg-[#202c33]/60 transition-colors gap-3"
                      >
                        <div className="relative flex-shrink-0">
                          {c.profilePic ? (
                            <img src={c.profilePic} className="w-10 h-10 rounded-full object-cover" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center text-[#aebac1] text-[14px] font-medium">
                              {initials}
                            </div>
                          )}
                          {contact?.objective_reached && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-[#111b21]">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          {contact?.needs_human && !contact?.objective_reached && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#111b21]">
                              <AlertCircle className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[#e9edef] text-[14px] truncate">{c.name}</p>
                          {contact?.objective_reached && (
                            <p className="text-emerald-400 text-[11px] truncate">🎯 Objetivo alcançado</p>
                          )}
                          {contact?.needs_human && !contact?.objective_reached && (
                            <p className="text-amber-400 text-[11px] truncate">Precisa da sua atenção</p>
                          )}
                        </div>
                        <div className={`w-[22px] h-[22px] rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                          isMonitored ? 'bg-[#00a884]' : 'border-2 border-[#8696a0]/40 hover:border-[#8696a0]'
                        }`}>
                          {isMonitored && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* === SECTION 4: Activity Log === */}
            <div>
              <button
                onClick={async () => {
                  if (!showLog && authToken) {
                    try { await fetch('/api/autopilot/config', { headers }) } catch {}
                  }
                  setShowLog(!showLog)
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-[#202c33]/50 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-[14px] font-medium text-[#e9edef]">
                  <Clock className="w-4 h-4 text-[#8696a0]" />
                  Atividade Recente
                </span>
                {showLog ? <ChevronUp className="w-4 h-4 text-[#8696a0]" /> : <ChevronDown className="w-4 h-4 text-[#8696a0]" />}
              </button>

              {showLog && (
                <div className="px-4 pb-4">
                  {log.length === 0 ? (
                    <div className="text-center py-6 text-[#8696a0]">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-[#364147]" />
                      <p className="text-[13px]">Nenhuma atividade ainda</p>
                      <p className="text-[11px] mt-0.5">Vai aparecer aqui quando o autopiloto responder</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {log.slice(0, 10).map(entry => (
                        <div key={entry.id} className="bg-[#202c33] rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              entry.action === 'responded' ? 'bg-green-900/40 text-green-400' :
                              entry.action === 'complemented' ? 'bg-blue-900/40 text-blue-400' :
                              entry.action === 'objective_reached' ? 'bg-emerald-900/40 text-emerald-300' :
                              entry.action === 'flagged_human' ? 'bg-amber-900/40 text-amber-400' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                              {entry.action === 'responded' ? 'Respondido' :
                               entry.action === 'complemented' ? 'Complementou' :
                               entry.action === 'objective_reached' ? '🎯 Objetivo alcançado' :
                               entry.action === 'flagged_human' ? 'Precisa atenção' :
                               entry.action === 'skipped_limit' ? 'Limite atingido' :
                               entry.action === 'skipped_hours' ? 'Fora de horário' :
                               entry.action === 'skipped_credits' ? 'Sem créditos' : entry.action}
                            </span>
                            <span className="text-[#8696a0] text-[10px]">{entry.contact_name || entry.contact_phone}</span>
                          </div>
                          <p className="text-[#e9edef] text-[12px] truncate">"{entry.incoming_message}"</p>
                          {entry.ai_response && (
                            <p className="text-[#00a884] text-[11px] mt-1 truncate">{entry.ai_response}</p>
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
