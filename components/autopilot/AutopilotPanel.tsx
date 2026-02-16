'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Zap, Loader2, Users, Settings, Clock, Sparkles } from 'lucide-react'
import AutopilotProfilesTab, { AutopilotProfile } from './AutopilotProfilesTab'
import AutopilotContactsTab from './AutopilotContactsTab'
import AutopilotSettingsTab from './AutopilotSettingsTab'
import AutopilotActivityTab from './AutopilotActivityTab'

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
  contact_phone: string
  contact_name: string | null
  profile_id: string | null
  enabled: boolean
  needs_human: boolean
  needs_human_reason: string | null
  auto_responses_today: number
  objective_reached: boolean
  objective_reached_reason: string | null
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

type TabKey = 'profiles' | 'contacts' | 'config' | 'activity'

const TABS: { key: TabKey; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'profiles', label: 'Perfis', icon: Sparkles },
  { key: 'contacts', label: 'Contatos', icon: Users },
  { key: 'config', label: 'Config', icon: Settings },
  { key: 'activity', label: 'Atividade', icon: Clock },
]

export default function AutopilotPanel({
  isOpen,
  onClose,
  conversations,
  authToken,
  onConfigChange
}: AutopilotPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('profiles')
  const [enabled, setEnabled] = useState(false)
  const [customInstructions, setCustomInstructions] = useState('')
  const [settings, setSettings] = useState<AutopilotSettings>(DEFAULT_SETTINGS)
  const [profiles, setProfiles] = useState<AutopilotProfile[]>([])
  const [monitoredContacts, setMonitoredContacts] = useState<Map<string, AutopilotContact>>(new Map())
  const [allContacts, setAllContacts] = useState<WAContact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasSettingsChanges, setHasSettingsChanges] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [authExpired, setAuthExpired] = useState(false)
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Show a brief error message that auto-dismisses
  const showError = (msg: string) => {
    setErrorMsg(msg)
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    errorTimeoutRef.current = setTimeout(() => setErrorMsg(null), 4000)
  }

  // Get current auth headers - uses getSession() which returns the auto-refreshed token
  // IMPORTANT: Do NOT call refreshSession() here - concurrent calls cause race conditions
  // that invalidate refresh tokens (they are single-use). The Supabase client auto-refreshes
  // the JWT ~60s before expiry via its internal timer.
  const getFreshHeaders = async (): Promise<Record<string, string>> => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      }
    } catch (e) {
      console.warn('[AutopilotPanel] Failed to get session')
    }
    // Fallback to prop token (kept fresh by FollowUpView's onAuthStateChange)
    return authToken
      ? { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' }
  }

  // Handle 401 responses - detect expired session
  const handle401 = () => {
    setAuthExpired(true)
  }

  // Load all data on open
  const loadData = useCallback(async () => {
    if (!authToken) return
    setIsLoading(true)

    try {
      const headers = await getFreshHeaders()

      const [configRes, contactsRes, profilesRes] = await Promise.all([
        fetch('/api/autopilot/config', { headers }),
        fetch('/api/autopilot/contacts', { headers }),
        fetch('/api/autopilot/profiles', { headers })
      ])

      // Check for 401 on any response
      if ([configRes, contactsRes, profilesRes].some(r => r.status === 401)) {
        handle401()
        setIsLoading(false)
        return
      }

      if (configRes.ok) {
        const configData = await configRes.json()
        if (configData.config) {
          setEnabled(configData.config.enabled || false)
          setCustomInstructions(configData.config.custom_instructions || '')
          setSettings({ ...DEFAULT_SETTINGS, ...(configData.config.settings || {}) })
        }
      }

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json()
        if (contactsData.contacts) {
          const map = new Map<string, AutopilotContact>()
          contactsData.contacts.forEach((c: any) => {
            map.set(c.contact_phone, {
              contact_phone: c.contact_phone,
              contact_name: c.contact_name,
              profile_id: c.profile_id || null,
              enabled: c.enabled,
              needs_human: c.needs_human,
              needs_human_reason: c.needs_human_reason,
              auto_responses_today: c.auto_responses_today,
              objective_reached: c.objective_reached,
              objective_reached_reason: c.objective_reached_reason
            })
          })
          setMonitoredContacts(map)
        }
      }

      if (profilesRes.ok) {
        const profilesData = await profilesRes.json()
        setProfiles(profilesData.profiles || [])
      }
    } catch (err) {
      console.error('[AutopilotPanel] Load error:', err)
    } finally {
      setIsLoading(false)
    }

    // Load WhatsApp contacts (non-blocking)
    try {
      const headers = await getFreshHeaders()
      const waRes = await fetch('/api/whatsapp/contacts', { headers })
      if (waRes.ok) {
        const waData = await waRes.json()
        setAllContacts(waData.contacts || [])
      }
    } catch {}
  }, [authToken])

  useEffect(() => {
    if (isOpen) loadData()
  }, [isOpen, loadData])

  // Merge contacts from conversations + WA contacts
  const mergedContacts = (() => {
    const seen = new Set<string>()
    const result: { phone: string; name: string; profilePic: string | null }[] = []

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

    allContacts.forEach(c => {
      const suffix = c.phone.replace(/\D/g, '').slice(-9)
      const alreadyExists = result.some(r => {
        const rSuffix = r.phone.replace(/\D/g, '').replace(/^55/, '').slice(-9)
        return rSuffix === suffix
      })
      if (!alreadyExists && !seen.has(c.id)) {
        seen.add(c.id)
        result.push({
          phone: c.id,
          name: c.name || c.pushname || c.phone,
          profilePic: null
        })
      }
    })

    return result
  })()

  // Toggle enabled
  const handleToggle = async () => {
    const newEnabled = !enabled
    setEnabled(newEnabled)

    try {
      const headers = await getFreshHeaders()
      const res = await fetch('/api/autopilot/config', {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled: newEnabled, customInstructions, settings })
      })
      if (res.status === 401) { handle401(); setEnabled(!newEnabled); return }
      if (!res.ok) {
        setEnabled(!newEnabled)
        showError('Erro ao salvar configuração')
        return
      }
      onConfigChange(newEnabled)
    } catch {
      setEnabled(!newEnabled)
      showError('Erro ao salvar configuração')
    }
  }

  // Save settings
  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const headers = await getFreshHeaders()
      const res = await fetch('/api/autopilot/config', {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled, customInstructions, settings })
      })
      if (res.status === 401) { handle401(); return }
      if (res.ok) {
        setHasSettingsChanges(false)
        onConfigChange(enabled)
      } else {
        showError('Erro ao salvar configurações')
      }
    } catch (err) {
      console.error('[AutopilotPanel] Save error:', err)
      showError('Erro ao salvar configurações')
    } finally {
      setIsSaving(false)
    }
  }

  // Contact operations - optimistic updates with revert on error
  const handleContactAdded = async (phone: string, name: string, profileId: string | null) => {
    // Optimistic: add immediately
    const newContact: AutopilotContact = {
      contact_phone: phone,
      contact_name: name,
      profile_id: profileId,
      enabled: true,
      needs_human: false,
      needs_human_reason: null,
      auto_responses_today: 0,
      objective_reached: false,
      objective_reached_reason: null
    }
    setMonitoredContacts(prev => {
      const next = new Map(prev)
      next.set(phone, newContact)
      return next
    })

    try {
      const headers = await getFreshHeaders()
      const res = await fetch('/api/autopilot/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'add', contactPhone: phone, contactName: name, profileId })
      })
      if (res.status === 401) { handle401() }
      if (!res.ok) {
        // Revert
        setMonitoredContacts(prev => {
          const next = new Map(prev)
          next.delete(phone)
          return next
        })
        if (res.status !== 401) showError('Erro ao adicionar contato')
      }
    } catch (err) {
      console.error('Add contact error:', err)
      setMonitoredContacts(prev => {
        const next = new Map(prev)
        next.delete(phone)
        return next
      })
      showError('Erro ao adicionar contato')
    }
  }

  const handleContactRemoved = async (phone: string) => {
    // Save for revert
    const prevContact = monitoredContacts.get(phone)

    // Optimistic: remove immediately
    setMonitoredContacts(prev => {
      const next = new Map(prev)
      next.delete(phone)
      return next
    })

    try {
      const headers = await getFreshHeaders()
      const res = await fetch('/api/autopilot/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'remove', contactPhone: phone })
      })
      if (res.status === 401) { handle401() }
      if (!res.ok) {
        // Revert
        if (prevContact) {
          setMonitoredContacts(prev => {
            const next = new Map(prev)
            next.set(phone, prevContact)
            return next
          })
        }
        if (res.status !== 401) showError('Erro ao remover contato')
      }
    } catch (err) {
      console.error('Remove contact error:', err)
      if (prevContact) {
        setMonitoredContacts(prev => {
          const next = new Map(prev)
          next.set(phone, prevContact)
          return next
        })
      }
      showError('Erro ao remover contato')
    }
  }

  const handleContactProfileChanged = async (phone: string, profileId: string | null) => {
    // Save for revert
    const prevContact = monitoredContacts.get(phone)
    const prevProfileId = prevContact?.profile_id || null

    // Optimistic: update immediately
    setMonitoredContacts(prev => {
      const next = new Map(prev)
      const existing = next.get(phone)
      if (existing) {
        next.set(phone, { ...existing, profile_id: profileId })
      }
      return next
    })

    try {
      const headers = await getFreshHeaders()
      const res = await fetch('/api/autopilot/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'assign_profile', contactPhones: [phone], profileId })
      })
      if (res.status === 401) { handle401() }
      if (!res.ok) {
        // Revert
        setMonitoredContacts(prev => {
          const next = new Map(prev)
          const existing = next.get(phone)
          if (existing) {
            next.set(phone, { ...existing, profile_id: prevProfileId })
          }
          return next
        })
        if (res.status !== 401) showError('Erro ao mover contato')
      }
    } catch (err) {
      console.error('Assign profile error:', err)
      setMonitoredContacts(prev => {
        const next = new Map(prev)
        const existing = next.get(phone)
        if (existing) {
          next.set(phone, { ...existing, profile_id: prevProfileId })
        }
        return next
      })
      showError('Erro ao mover contato')
    }
  }

  const handleBatchAdd = async (contacts: { phone: string; name: string }[], profileId: string | null) => {
    // Optimistic
    setMonitoredContacts(prev => {
      const next = new Map(prev)
      contacts.forEach(c => {
        if (!next.has(c.phone)) {
          next.set(c.phone, {
            contact_phone: c.phone,
            contact_name: c.name,
            profile_id: profileId,
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

    try {
      const headers = await getFreshHeaders()
      const res = await fetch('/api/autopilot/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'batch_add',
          contacts: contacts.map(c => ({ phone: c.phone, name: c.name })),
          profileId
        })
      })
      if (!res.ok) {
        // Revert: reload from server
        showError('Erro ao adicionar contatos')
        loadData()
      }
    } catch (err) {
      console.error('Batch add error:', err)
      showError('Erro ao adicionar contatos')
      loadData()
    }
  }

  const handleBatchRemove = async () => {
    const prevContacts = new Map(monitoredContacts)
    // Optimistic
    setMonitoredContacts(new Map())

    try {
      const headers = await getFreshHeaders()
      const phones = Array.from(prevContacts.keys())
      for (const phone of phones) {
        await fetch('/api/autopilot/contacts', {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'remove', contactPhone: phone })
        })
      }
    } catch {
      // Revert
      setMonitoredContacts(prevContacts)
      showError('Erro ao remover contatos')
    }
  }

  // Profile operations
  const handleProfileCreated = (profile: AutopilotProfile) => {
    setProfiles(prev => [...prev, profile])
  }

  const handleProfileUpdated = (profile: AutopilotProfile) => {
    setProfiles(prev => prev.map(p => p.id === profile.id ? profile : p))
  }

  const handleProfileDeleted = (profileId: string) => {
    setProfiles(prev => prev.filter(p => p.id !== profileId))
    // Clear profile_id from contacts that had this profile
    setMonitoredContacts(prev => {
      const next = new Map(prev)
      next.forEach((contact, phone) => {
        if (contact.profile_id === profileId) {
          next.set(phone, { ...contact, profile_id: null })
        }
      })
      return next
    })
  }

  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-[50] flex">
      <div className="w-full bg-[#111b21] flex flex-col animate-slide-in-left">
        {/* Header */}
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

        {/* Auth expired banner */}
        {authExpired && (
          <div className="px-4 py-3 bg-amber-900/30 border-b border-amber-800/30 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-amber-400 text-[12px] font-medium">Sessão expirada</p>
              <p className="text-amber-400/70 text-[11px]">Recarregue a página para reconectar</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-[11px] px-3 py-1.5 bg-amber-600 text-white rounded-full font-medium hover:bg-amber-500 transition-colors flex-shrink-0"
            >
              Recarregar
            </button>
          </div>
        )}

        {/* Error toast */}
        {!authExpired && errorMsg && (
          <div className="px-4 py-2 bg-red-900/30 border-b border-red-800/30 flex items-center gap-2">
            <span className="text-red-400 text-[12px]">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-red-400/60 hover:text-red-400 ml-auto">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex bg-[#202c33] border-t border-[#222d35] px-2">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium transition-all border-b-2 ${
                  isActive
                    ? 'text-[#00a884] border-[#00a884]'
                    : 'text-[#8696a0] border-transparent hover:text-[#e9edef]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#00a884]" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto whatsapp-scrollbar">
            {activeTab === 'profiles' && (
              <AutopilotProfilesTab
                profiles={profiles}
                contacts={monitoredContacts}
                authToken={authToken}
                onProfileCreated={handleProfileCreated}
                onProfileUpdated={handleProfileUpdated}
                onProfileDeleted={handleProfileDeleted}
              />
            )}

            {activeTab === 'contacts' && (
              <AutopilotContactsTab
                profiles={profiles}
                monitoredContacts={monitoredContacts}
                mergedContacts={mergedContacts}
                authToken={authToken}
                onContactAdded={handleContactAdded}
                onContactRemoved={handleContactRemoved}
                onContactProfileChanged={handleContactProfileChanged}
                onBatchAdd={handleBatchAdd}
                onBatchRemove={handleBatchRemove}
              />
            )}

            {activeTab === 'config' && (
              <AutopilotSettingsTab
                settings={settings}
                onSettingsChange={(newSettings) => {
                  setSettings(newSettings)
                  setHasSettingsChanges(true)
                }}
                hasChanges={hasSettingsChanges}
                isSaving={isSaving}
                onSave={saveSettings}
              />
            )}

            {activeTab === 'activity' && (
              <AutopilotActivityTab authToken={authToken} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
