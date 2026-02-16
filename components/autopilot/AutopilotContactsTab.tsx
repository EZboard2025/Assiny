'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Search, Plus, Check, X, AlertCircle, Users, ArrowRight, Minus, UserPlus, GripVertical
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

  // --- Drag & Drop handlers ---
  const handleDragStart = useCallback((e: React.DragEvent, data: DragData) => {
    dragDataRef.current = data
    setDraggingPhone(data.phone)
    e.dataTransfer.effectAllowed = 'move'
    // Required for Firefox
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
    // Only clear if we're actually leaving the column (not entering a child)
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
      // Move between profiles
      onContactProfileChanged(data.phone, targetProfileId)
    } else {
      // Add from "Disponíveis" to a profile
      onContactAdded(data.phone, data.name, targetProfileId)
    }
  }, [onContactProfileChanged, onContactAdded])

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

  // All columns: profiles + "sem perfil"
  const columns: Array<{ id: string | null; name: string; color: string }> = [
    ...profiles.map(p => ({ id: p.id, name: p.name, color: p.color })),
  ]
  // Only show "Sem perfil" column if there are unassigned contacts
  const unassignedContacts = contactsByProfile.get(null) || []
  if (unassignedContacts.length > 0) {
    columns.push({ id: null, name: 'Sem perfil', color: '#8696a0' })
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
    <div className="flex flex-col h-full">
      {/* Kanban columns - horizontal scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max">
          {/* Profile columns */}
          {columns.map(col => {
            const contacts = contactsByProfile.get(col.id) || []
            const isUnassigned = col.id === null
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
                  className="px-3 py-2.5 flex items-center gap-2 flex-shrink-0"
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
                          {/* Remove button */}
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

          {/* "Disponíveis" column - unmonitored contacts */}
          <div className="w-[220px] flex-shrink-0 flex flex-col bg-[#0b141a]/50">
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center gap-2 flex-shrink-0 border-b-2 border-[#364147]">
              <UserPlus className="w-3.5 h-3.5 text-[#364147]" />
              <span className="text-[12px] font-medium text-[#8696a0]">
                Disponíveis
              </span>
              <span className="text-[10px] text-[#8696a0]">
                {unmonitored.length}
              </span>
            </div>

            {/* Search */}
            <div className="px-2 pt-2 pb-1 flex-shrink-0">
              <div className="flex items-center bg-[#2a3942] rounded-lg px-2 py-1.5 gap-1.5">
                <Search className="w-3 h-3 text-[#8696a0]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
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
            <div className="flex-1 overflow-y-auto whatsapp-scrollbar p-2 space-y-1">
              {filteredUnmonitored.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-[#8696a0] text-[11px]">
                    {searchQuery ? 'Nenhum resultado' : 'Nenhum contato disponível'}
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
                      className={`bg-[#202c33]/60 rounded-lg p-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                        isDragging ? 'opacity-40 scale-95' : 'hover:bg-[#202c33]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-3 h-3 text-[#8696a0]/30 flex-shrink-0" />
                        {renderAvatar(c.name, c.profilePic, 'w-7 h-7')}
                        <p className="text-[#e9edef] text-[11px] truncate flex-1">{c.name}</p>
                      </div>
                      {/* Profile destination buttons still available as fallback */}
                      {profiles.length > 1 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 ml-5">
                          {profiles.map(p => (
                            <button
                              key={p.id}
                              onClick={() => onContactAdded(c.phone, c.name, p.id)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors hover:brightness-125"
                              style={{
                                backgroundColor: `${p.color}20`,
                                color: p.color
                              }}
                            >
                              <Plus className="w-2.5 h-2.5" />
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {profiles.length === 1 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 ml-5">
                          <button
                            onClick={() => onContactAdded(c.phone, c.name, profiles[0].id)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-colors hover:brightness-125"
                            style={{
                              backgroundColor: `${profiles[0].color}20`,
                              color: profiles[0].color
                            }}
                          >
                            <Plus className="w-2.5 h-2.5" />
                            Adicionar
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar with batch actions */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-[#222d35] flex items-center justify-between bg-[#111b21]">
        <span className="text-[#8696a0] text-[11px]">
          {monitoredContacts.size} ativo{monitoredContacts.size !== 1 ? 's' : ''} / {mergedContacts.length} total
        </span>
        <div className="flex gap-1.5">
          {monitoredContacts.size > 0 && (
            <button
              onClick={onBatchRemove}
              className="text-[10px] px-2.5 py-1 text-red-400/70 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors"
            >
              Remover todos
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
