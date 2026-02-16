'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Search, Plus, Check, X, AlertCircle, Users, GripVertical, UserPlus, Zap, ChevronDown, ChevronUp
} from 'lucide-react'
import { AutopilotProfile } from './AutopilotProfilesTab'

interface AutopilotContact {
  contact_phone: string
  contact_name: string | null
  profile_id: string | null
  enabled: boolean
  needs_human: boolean
  needs_human_reason: string | null
  objective_reached: boolean
  objective_reached_reason: string | null
}

interface MergedContact {
  phone: string
  name: string
  profilePic: string | null
}

interface AutopilotContactsTabProps {
  profiles: AutopilotProfile[]
  monitoredContacts: Map<string, AutopilotContact>
  mergedContacts: MergedContact[]
  authToken: string | null
  onContactAdded: (phone: string, name: string, profileId: string | null) => void
  onContactRemoved: (phone: string) => void
  onContactProfileChanged: (phone: string, profileId: string | null) => void
  onBatchAdd: (contacts: { phone: string; name: string }[], profileId: string | null) => void
  onBatchRemove: () => void
}

interface DragData {
  phone: string
  name: string
  sourceProfileId: string | null
  isMonitored: boolean
}

export default function AutopilotContactsTab({
  profiles,
  monitoredContacts,
  mergedContacts,
  authToken,
  onContactAdded,
  onContactRemoved,
  onContactProfileChanged,
  onBatchAdd,
  onBatchRemove
}: AutopilotContactsTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [draggingPhone, setDraggingPhone] = useState<string | null>(null)
  const [availableExpanded, setAvailableExpanded] = useState(true)
  const dragDataRef = useRef<DragData | null>(null)

  // Build contacts by profile
  const contactsByProfile = new Map<string | null, Array<AutopilotContact & { displayName: string; profilePic: string | null }>>()

  // Initialize with empty arrays for each profile
  profiles.forEach(p => contactsByProfile.set(p.id, []))
  contactsByProfile.set(null, []) // "Sem perfil" bucket

  monitoredContacts.forEach((contact, phone) => {
    const profileId = contact.profile_id || null
    if (!contactsByProfile.has(profileId)) {
      contactsByProfile.set(profileId, [])
    }
    const mergedInfo = mergedContacts.find(m => m.phone === phone)
    contactsByProfile.get(profileId)!.push({
      ...contact,
      displayName: contact.contact_name || mergedInfo?.name || phone,
      profilePic: mergedInfo?.profilePic || null
    })
  })

  // Unmonitored contacts
  const unmonitored = mergedContacts.filter(c => !monitoredContacts.has(c.phone))
  const filteredUnmonitored = unmonitored.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.phone.includes(q)
  })

  // Columns for active section (profiles + "sem perfil" if needed)
  const activeColumns: Array<{ id: string | null; name: string; color: string }> = [
    ...profiles.map(p => ({ id: p.id, name: p.name, color: p.color })),
  ]
  const unassignedContacts = contactsByProfile.get(null) || []
  if (unassignedContacts.length > 0) {
    activeColumns.push({ id: null, name: 'Sem perfil', color: '#8696a0' })
  }

  // Status counts
  const needsAttention = Array.from(monitoredContacts.values()).filter(c => c.needs_human).length
  const objectiveReached = Array.from(monitoredContacts.values()).filter(c => c.objective_reached).length

  // --- Drag & Drop handlers ---
  const handleDragStart = useCallback((e: React.DragEvent, data: DragData) => {
    dragDataRef.current = data
    setDraggingPhone(data.phone)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', data.phone)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragDataRef.current = null
    setDraggingPhone(null)
    setDragOverColumn(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent, columnId: string) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null
    const currentTarget = e.currentTarget as HTMLElement
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragOverColumn(prev => prev === columnId ? null : prev)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetProfileId: string | null) => {
    e.preventDefault()
    setDragOverColumn(null)
    setDraggingPhone(null)

    const data = dragDataRef.current
    if (!data) return
    dragDataRef.current = null

    // Don't drop on same column
    if (data.isMonitored && data.sourceProfileId === targetProfileId) return

    if (data.isMonitored) {
      onContactProfileChanged(data.phone, targetProfileId)
    } else {
      onContactAdded(data.phone, data.name, targetProfileId)
    }
  }, [onContactProfileChanged, onContactAdded])

  // Drop on "available" section = remove from monitored
  const handleDropOnAvailable = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverColumn(null)
    setDraggingPhone(null)

    const data = dragDataRef.current
    if (!data) return
    dragDataRef.current = null

    if (data.isMonitored) {
      onContactRemoved(data.phone)
    }
  }, [onContactRemoved])

  const renderAvatar = (name: string, profilePic: string | null, size: string = 'w-8 h-8') => {
    if (profilePic) {
      return <img src={profilePic} className={`${size} rounded-full object-cover flex-shrink-0`} alt="" />
    }
    const initials = name.charAt(0).toUpperCase()
    return (
      <div className={`${size} rounded-full bg-[#2a3942] flex items-center justify-center text-[#aebac1] text-[12px] font-medium flex-shrink-0`}>
        {initials}
      </div>
    )
  }

  const renderStatusBadge = (contact: AutopilotContact) => {
    if (contact.objective_reached) {
      return (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-[1.5px] border-[#202c33]">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )
    }
    if (contact.needs_human) {
      return (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border-[1.5px] border-[#202c33]">
          <AlertCircle className="w-2.5 h-2.5 text-white" />
        </div>
      )
    }
    return null
  }

  // No profiles yet
  if (profiles.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="text-center py-8 px-6">
          <Users className="w-10 h-10 mx-auto mb-3 text-[#364147]" />
          <p className="text-[#e9edef] text-[14px] font-medium">Crie um perfil primeiro</p>
          <p className="text-[#8696a0] text-[12px] mt-1">
            Va na aba Perfis e crie pelo menos um perfil de lead para organizar seus contatos
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ===== SECTION 1: ACTIVE AUTOPILOT CONTACTS ===== */}
      <div className="flex-shrink-0">
        {/* Section header */}
        <div className="px-3 py-2.5 bg-[#00a884]/8 border-b border-[#00a884]/20">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#00a884]/20 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-[#00a884]" />
            </div>
            <div className="flex-1">
              <p className="text-[#00a884] text-[12px] font-semibold">
                Piloto Automatico Ativo
              </p>
              <p className="text-[#8696a0] text-[10px]">
                {monitoredContacts.size} contato{monitoredContacts.size !== 1 ? 's' : ''} monitorado{monitoredContacts.size !== 1 ? 's' : ''}
                {needsAttention > 0 && (
                  <span className="text-amber-400 ml-2">{needsAttention} precisa{needsAttention !== 1 ? 'm' : ''} atencao</span>
                )}
                {objectiveReached > 0 && (
                  <span className="text-emerald-400 ml-2">{objectiveReached} objetivo{objectiveReached !== 1 ? 's' : ''} alcancado{objectiveReached !== 1 ? 's' : ''}</span>
                )}
              </p>
            </div>
            {monitoredContacts.size > 0 && (
              <button
                onClick={onBatchRemove}
                className="text-[10px] px-2 py-1 text-red-400/60 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors"
                title="Remover todos os contatos monitorados"
              >
                Remover todos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active kanban columns */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        {monitoredContacts.size === 0 && activeColumns.length > 0 ? (
          /* Empty state for active section */
          <div className="flex items-center justify-center h-full px-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#00a884]/10 flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-6 h-6 text-[#00a884]/40" />
              </div>
              <p className="text-[#8696a0] text-[12px]">
                Arraste contatos da lista abaixo para ativar o piloto automatico
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-w-max">
            {activeColumns.map(col => {
              const contacts = contactsByProfile.get(col.id) || []
              const columnKey = col.id || '__null'
              const isDragOver = dragOverColumn === columnKey

              return (
                <div
                  key={columnKey}
                  className={`w-[220px] flex-shrink-0 flex flex-col border-r border-[#1a2630] last:border-r-0 transition-colors duration-150 ${
                    isDragOver ? 'bg-[#00a884]/5' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, columnKey)}
                  onDragLeave={(e) => handleDragLeave(e, columnKey)}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  {/* Column header */}
                  <div
                    className="px-3 py-2 flex items-center gap-2 flex-shrink-0"
                    style={{ borderBottom: `2px solid ${isDragOver ? '#00a884' : col.color}` }}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${isDragOver ? 'scale-125' : ''}`}
                      style={{ backgroundColor: isDragOver ? '#00a884' : col.color }}
                    />
                    <span
                      className="text-[12px] font-medium truncate transition-colors"
                      style={{ color: isDragOver ? '#00a884' : col.color }}
                    >
                      {col.name}
                    </span>
                    <span className="text-[10px] text-[#8696a0] flex-shrink-0">
                      {contacts.length}
                    </span>
                  </div>

                  {/* Contact cards */}
                  <div className="flex-1 overflow-y-auto whatsapp-scrollbar p-2 space-y-1.5">
                    {contacts.length === 0 && (
                      <div className={`text-center py-6 border-2 border-dashed rounded-lg transition-colors ${
                        isDragOver
                          ? 'border-[#00a884]/50 bg-[#00a884]/5'
                          : 'border-[#2a3942]/50'
                      }`}>
                        <p className={`text-[11px] ${isDragOver ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                          {isDragOver ? 'Solte aqui' : 'Arraste contatos para ca'}
                        </p>
                      </div>
                    )}

                    {contacts.map(contact => {
                      const isDragging = draggingPhone === contact.contact_phone

                      return (
                        <div
                          key={contact.contact_phone}
                          draggable
                          onDragStart={(e) => handleDragStart(e, {
                            phone: contact.contact_phone,
                            name: contact.displayName,
                            sourceProfileId: col.id,
                            isMonitored: true
                          })}
                          onDragEnd={handleDragEnd}
                          className={`bg-[#202c33] rounded-lg p-2.5 transition-all cursor-grab active:cursor-grabbing select-none ${
                            isDragging ? 'opacity-40 scale-95' : 'hover:bg-[#263845]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-3 h-3 text-[#8696a0]/40 flex-shrink-0" />
                            <div className="relative flex-shrink-0">
                              {renderAvatar(contact.displayName, contact.profilePic)}
                              {renderStatusBadge(contact)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[#e9edef] text-[12px] truncate leading-tight">{contact.displayName}</p>
                              {contact.objective_reached && (
                                <p className="text-emerald-400 text-[9px]">Objetivo alcancado</p>
                              )}
                              {contact.needs_human && !contact.objective_reached && (
                                <p className="text-amber-400 text-[9px]">Precisa atencao</p>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onContactRemoved(contact.contact_phone)
                              }}
                              className="p-1 rounded text-[#8696a0] hover:text-red-400 transition-colors flex-shrink-0"
                              title="Remover"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== DIVIDER ===== */}
      <div className="flex-shrink-0 h-[2px] bg-gradient-to-r from-[#00a884]/30 via-[#364147] to-[#364147]/30" />

      {/* ===== SECTION 2: AVAILABLE CONTACTS (not monitored) ===== */}
      <div
        className={`flex-shrink-0 flex flex-col transition-all ${
          dragOverColumn === '__available' ? 'bg-[#2a3942]/30' : 'bg-[#0b141a]/50'
        }`}
        style={{ maxHeight: availableExpanded ? '45%' : '42px' }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverColumn('__available') }}
        onDragLeave={(e) => {
          const relatedTarget = e.relatedTarget as HTMLElement | null
          const currentTarget = e.currentTarget as HTMLElement
          if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
            setDragOverColumn(prev => prev === '__available' ? null : prev)
          }
        }}
        onDrop={handleDropOnAvailable}
      >
        {/* Section header - collapsible */}
        <div
          className="px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-[#111b21]/50 transition-colors border-b border-[#222d35]"
          onClick={() => setAvailableExpanded(!availableExpanded)}
        >
          <div className="w-6 h-6 rounded-full bg-[#364147]/50 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-[#8696a0]" />
          </div>
          <div className="flex-1">
            <p className="text-[#8696a0] text-[12px] font-semibold">
              Contatos Disponiveis
            </p>
            <p className="text-[#8696a0]/60 text-[10px]">
              {unmonitored.length} contato{unmonitored.length !== 1 ? 's' : ''} sem piloto automatico
            </p>
          </div>
          {dragOverColumn === '__available' && draggingPhone && (
            <span className="text-red-400 text-[10px] animate-pulse">Solte para desativar</span>
          )}
          {availableExpanded ? (
            <ChevronDown className="w-4 h-4 text-[#8696a0]" />
          ) : (
            <ChevronUp className="w-4 h-4 text-[#8696a0]" />
          )}
        </div>

        {/* Expanded content */}
        {availableExpanded && (
          <>
            {/* Search */}
            <div className="px-3 pt-2 pb-1 flex-shrink-0">
              <div className="flex items-center bg-[#2a3942] rounded-lg px-2.5 py-1.5 gap-1.5">
                <Search className="w-3 h-3 text-[#8696a0]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar contato..."
                  className="flex-1 bg-transparent text-[#e9edef] text-[11px] placeholder-[#8696a0]/60 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-[#8696a0]">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Available contacts list */}
            <div className="flex-1 overflow-y-auto whatsapp-scrollbar px-3 py-1.5 space-y-1">
              {filteredUnmonitored.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-[#8696a0] text-[11px]">
                    {searchQuery ? 'Nenhum resultado' : 'Todos os contatos ja estao monitorados'}
                  </p>
                </div>
              ) : (
                filteredUnmonitored.map(c => {
                  const isDragging = draggingPhone === c.phone

                  return (
                    <div
                      key={c.phone}
                      draggable
                      onDragStart={(e) => handleDragStart(e, {
                        phone: c.phone,
                        name: c.name,
                        sourceProfileId: null,
                        isMonitored: false
                      })}
                      onDragEnd={handleDragEnd}
                      className={`bg-[#202c33]/40 rounded-lg px-2.5 py-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                        isDragging ? 'opacity-40 scale-95' : 'hover:bg-[#202c33]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-3 h-3 text-[#8696a0]/30 flex-shrink-0" />
                        {renderAvatar(c.name, c.profilePic, 'w-7 h-7')}
                        <p className="text-[#e9edef]/70 text-[11px] truncate flex-1">{c.name}</p>

                        {/* Quick-add buttons */}
                        {profiles.length === 1 ? (
                          <button
                            onClick={() => onContactAdded(c.phone, c.name, profiles[0].id)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors hover:brightness-125 flex-shrink-0"
                            style={{
                              backgroundColor: `${profiles[0].color}15`,
                              color: profiles[0].color
                            }}
                          >
                            <Plus className="w-2.5 h-2.5" />
                            Ativar
                          </button>
                        ) : (
                          <div className="flex gap-1 flex-shrink-0">
                            {profiles.map(p => (
                              <button
                                key={p.id}
                                onClick={() => onContactAdded(c.phone, c.name, p.id)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-colors hover:brightness-125"
                                style={{
                                  backgroundColor: `${p.color}15`,
                                  color: p.color
                                }}
                                title={p.name}
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span className="max-w-[60px] truncate">{p.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-[#222d35] bg-[#111b21]">
        <span className="text-[#8696a0] text-[10px]">
          {monitoredContacts.size} ativo{monitoredContacts.size !== 1 ? 's' : ''} / {mergedContacts.length} total
        </span>
      </div>
    </div>
  )
}
