'use client'

import { useState } from 'react'
import { Users, Lock, Loader2, UserCircle2, CheckCircle, ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import type { Persona, PersonaB2B, PersonaB2C, Tag } from '@/lib/config'

interface PersonaSelectorProps {
  personas: Persona[]
  selectedPersona: string
  onSelect: (id: string) => void
  businessType: 'B2B' | 'B2C' | 'Ambos'
  tags: Tag[]
  personaTags: Map<string, Tag[]>
  isConfigLocked: boolean
  hiddenMode: boolean
  dataLoading: boolean
}

function getPersonaTitle(persona: Persona): string {
  if (persona.business_type === 'B2B') {
    return (persona as any).cargo || (persona as PersonaB2B).job_title || 'Sem título'
  }
  return (persona as any).profissao || (persona as PersonaB2C).profession || 'Sem título'
}

function getPersonaSubtitle(persona: Persona): string {
  if (persona.business_type === 'B2B') {
    return (persona as any).tipo_empresa_faturamento || (persona as PersonaB2B).company_type || ''
  }
  return (persona as any).busca || (persona as PersonaB2C).what_seeks || ''
}

function getPersonaContextPreview(persona: Persona, maxLen = 60): string {
  const text = persona.context || ''
  if (text.length <= maxLen) return text
  const truncated = text.substring(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > maxLen * 0.7 ? truncated.substring(0, lastSpace) : truncated) + '...'
}

function getPersonaDetails(persona: Persona): Array<{ label: string; value: string }> {
  const details: Array<{ label: string; value: string }> = []

  if (persona.context) details.push({ label: 'Contexto', value: persona.context })

  if (persona.business_type === 'B2B') {
    const b2b = persona as PersonaB2B
    if ((persona as any).busca || b2b.company_goals) details.push({ label: 'Busca', value: (persona as any).busca || b2b.company_goals || '' })
    if ((persona as any).dores || b2b.business_challenges) details.push({ label: 'Dores', value: (persona as any).dores || b2b.business_challenges || '' })
  } else {
    const b2c = persona as PersonaB2C
    if (b2c.what_seeks) details.push({ label: 'Busca', value: b2c.what_seeks })
    if (b2c.main_pains) details.push({ label: 'Dores', value: b2c.main_pains })
  }

  if (persona.prior_knowledge) details.push({ label: 'Conhecimento Prévio', value: persona.prior_knowledge })

  return details
}

export default function PersonaSelector({
  personas,
  selectedPersona,
  onSelect,
  businessType,
  tags,
  personaTags,
  isConfigLocked,
  hiddenMode,
  dataLoading,
}: PersonaSelectorProps) {
  const [expandedPersonaId, setExpandedPersonaId] = useState<string | null>(null)
  const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Filter personas by business type
  const businessFilteredPersonas = businessType === 'Ambos' ? personas : personas.filter(p => p.business_type === businessType)

  // Apply search filter
  const filteredPersonas = businessFilteredPersonas.filter(p => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    const title = getPersonaTitle(p).toLowerCase()
    const subtitle = getPersonaSubtitle(p).toLowerCase()
    const context = (p.context || '').toLowerCase()
    return title.includes(q) || subtitle.includes(q) || context.includes(q)
  })

  // Group by tags
  const getGroupedPersonas = () => {
    const tagGroups = new Map<string, Persona[]>()
    const noTagPersonas: Persona[] = []

    filteredPersonas.forEach(persona => {
      const pTags = personaTags.get(persona.id!) || []
      if (pTags.length === 0) {
        noTagPersonas.push(persona)
      } else {
        const firstTag = pTags[0]
        if (!tagGroups.has(firstTag.id)) {
          tagGroups.set(firstTag.id, [])
        }
        tagGroups.get(firstTag.id)!.push(persona)
      }
    })

    const sortedGroups = Array.from(tagGroups.entries())
      .map(([tagId, groupPersonas]) => {
        const tag = tags.find(t => t.id === tagId)!
        return { tag, personas: groupPersonas }
      })
      .sort((a, b) => a.tag.name.localeCompare(b.tag.name))

    return { sortedGroups, noTagPersonas }
  }

  const handleSelect = (personaId: string) => {
    if (isConfigLocked) return
    if (selectedPersona !== personaId) {
      setExpandedPersonaId(null)
      setExpandedFields(new Set())
    }
    onSelect(personaId)
  }

  const renderPersonaCard = (persona: Persona) => {
    const isSelected = selectedPersona === persona.id
    const title = getPersonaTitle(persona)
    const subtitle = getPersonaSubtitle(persona)
    const pTags = personaTags.get(persona.id!) || []

    return (
      <div
        key={persona.id}
        onClick={() => handleSelect(persona.id!)}
        className={`p-3 rounded-xl border transition-all duration-200 ${
          isConfigLocked
            ? isSelected
              ? 'border-2 border-purple-500 bg-purple-50/50 cursor-not-allowed'
              : 'border border-purple-100 bg-purple-50/30 cursor-not-allowed opacity-50'
            : hiddenMode
              ? 'border border-gray-200 bg-gray-100 cursor-pointer'
              : isSelected
                ? 'border-2 border-green-500 bg-green-50/50 shadow-sm cursor-pointer'
                : 'border border-gray-200 bg-white hover:border-green-300 hover:shadow-sm cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {/* Avatar */}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            hiddenMode ? 'bg-gray-200' : isSelected
              ? isConfigLocked ? 'bg-purple-100' : 'bg-green-100'
              : 'bg-gray-100'
          }`}>
            <UserCircle2 className={`w-5 h-5 ${
              hiddenMode ? 'text-gray-400' : isSelected
                ? isConfigLocked ? 'text-purple-600' : 'text-green-600'
                : 'text-gray-400'
            }`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {hiddenMode ? '••••••••••' : title}
            </p>
            {subtitle && (
              <p className="text-[10px] text-gray-500 truncate">
                {hiddenMode ? '••••••••' : subtitle}
              </p>
            )}
          </div>

          {/* Right side: badges + check */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!hiddenMode && persona.evaluation_score !== undefined && persona.evaluation_score !== null && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                persona.evaluation_score >= 7 ? 'bg-green-50 text-green-700' : persona.evaluation_score >= 4 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
              }`}>
                {persona.evaluation_score.toFixed(1)}
              </span>
            )}
            {!hiddenMode && pTags.length > 0 && (
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pTags[0].color }} />
            )}
            {!hiddenMode && isSelected && (
              <CheckCircle className={`w-4 h-4 ${isConfigLocked ? 'text-purple-500' : 'text-green-500'}`} />
            )}
          </div>
        </div>
      </div>
    )
  }

  const { sortedGroups, noTagPersonas } = getGroupedPersonas()
  const selectedPersonaObj = filteredPersonas.find(p => p.id === selectedPersona)
  const selectedDetails = selectedPersonaObj ? getPersonaDetails(selectedPersonaObj) : []

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isConfigLocked ? 'bg-purple-50' : 'bg-green-50'}`}>
          {isConfigLocked ? <Lock className="w-4 h-4 text-purple-600" /> : <Users className="w-4 h-4 text-green-600" />}
        </div>
        <h3 className="text-sm font-semibold text-gray-900">Persona do Cliente</h3>
      </div>

      {/* Search bar */}
      {!dataLoading && businessFilteredPersonas.length > 0 && !isConfigLocked && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar persona..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-green-300 focus:ring-1 focus:ring-green-100 placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {dataLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
        </div>
      ) : businessFilteredPersonas.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-3">Nenhuma persona cadastrada.</p>
      ) : filteredPersonas.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-3">Nenhuma persona encontrada para &ldquo;{searchQuery}&rdquo;</p>
      ) : (
        <div className="space-y-4">
          {/* Persona cards grid */}
          <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3">
            {sortedGroups.map(({ tag, personas: groupPersonas }) => (
              <div key={tag.id}>
                {/* Tag header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{tag.name}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupPersonas.map(renderPersonaCard)}
                </div>
              </div>
            ))}

            {noTagPersonas.length > 0 && (
              <div>
                {sortedGroups.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sem Etiqueta</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {noTagPersonas.map(renderPersonaCard)}
                </div>
              </div>
            )}
          </div>

          {/* Compact summary strip + optional accordion */}
          {!hiddenMode && selectedPersona && selectedPersonaObj && (
            <div className="space-y-2 animate-[fadeIn_200ms_ease-out]">
              {/* Compact summary strip */}
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                isConfigLocked
                  ? 'bg-purple-50/40 border-purple-100'
                  : 'bg-green-50/40 border-green-100'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isConfigLocked ? 'bg-purple-100' : 'bg-green-100'
                }`}>
                  <UserCircle2 className={`w-3.5 h-3.5 ${isConfigLocked ? 'text-purple-600' : 'text-green-600'}`} />
                </div>

                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-900 flex-shrink-0">
                    {getPersonaTitle(selectedPersonaObj)}
                  </span>
                  {selectedPersonaObj.context && (
                    <>
                      <span className="text-gray-300 flex-shrink-0">•</span>
                      <span className="text-xs text-gray-500 truncate">
                        {getPersonaContextPreview(selectedPersonaObj)}
                      </span>
                    </>
                  )}
                </div>

                {selectedDetails.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const isOpen = expandedPersonaId === selectedPersona
                      setExpandedPersonaId(isOpen ? null : selectedPersona)
                      if (isOpen) setExpandedFields(new Set())
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors flex-shrink-0 ${
                      isConfigLocked
                        ? 'text-purple-600 hover:bg-purple-100'
                        : 'text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {expandedPersonaId === selectedPersona ? (
                      <><ChevronUp className="w-3 h-3" /> Ocultar</>
                    ) : (
                      <><ChevronDown className="w-3 h-3" /> Ver detalhes</>
                    )}
                  </button>
                )}
              </div>

              {/* Accordion detail panel */}
              {expandedPersonaId === selectedPersona && selectedDetails.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 animate-[fadeIn_200ms_ease-out]">
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${
                      isConfigLocked ? 'text-purple-600' : 'text-green-600'
                    }`}>Detalhes da Persona</p>
                    <button
                      onClick={() => { setExpandedPersonaId(null); setExpandedFields(new Set()) }}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedDetails.map((detail, idx) => {
                      const isFieldExpanded = expandedFields.has(idx)
                      const needsClamping = detail.value.length > 120
                      return (
                        <div key={idx}>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{detail.label}</p>
                          <p className={`text-xs text-gray-700 leading-relaxed ${
                            !isFieldExpanded && needsClamping ? 'line-clamp-2' : ''
                          }`}>
                            {detail.value}
                          </p>
                          {needsClamping && (
                            <button
                              onClick={() => setExpandedFields(prev => {
                                const next = new Set(prev)
                                isFieldExpanded ? next.delete(idx) : next.add(idx)
                                return next
                              })}
                              className={`text-[10px] mt-0.5 font-medium ${
                                isConfigLocked ? 'text-purple-600 hover:text-purple-700' : 'text-green-600 hover:text-green-700'
                              }`}
                            >
                              {isFieldExpanded ? 'Ver menos' : 'Ver mais'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
