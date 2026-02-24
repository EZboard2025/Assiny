'use client'

import { useState } from 'react'
import { ShieldAlert, Lock, Loader2, ChevronDown, ChevronUp, Search, X, Info } from 'lucide-react'
import type { Objection } from '@/lib/config'
import { getObjectionTitle } from '@/lib/utils/objectionTitle'

interface ObjectionSelectorProps {
  objections: Objection[]
  selectedObjections: string[]
  onToggle: (id: string) => void
  isConfigLocked: boolean
  hiddenMode: boolean
  dataLoading: boolean
}

export default function ObjectionSelector({
  objections,
  selectedObjections,
  onToggle,
  isConfigLocked,
  hiddenMode,
  dataLoading,
}: ObjectionSelectorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredObjections = objections.filter(o => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return o.name.toLowerCase().includes(q) || getObjectionTitle(o.name).toLowerCase().includes(q)
  })

  // Sort: selected first, then unselected
  const sortedObjections = [...filteredObjections].sort((a, b) => {
    const aSelected = selectedObjections.includes(a.id) ? 0 : 1
    const bSelected = selectedObjections.includes(b.id) ? 0 : 1
    return aSelected - bSelected
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isConfigLocked ? 'bg-purple-50' : 'bg-green-50'}`}>
            {isConfigLocked ? <Lock className="w-4 h-4 text-purple-600" /> : <ShieldAlert className="w-4 h-4 text-green-600" />}
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Objeções</h3>
        </div>
        {!dataLoading && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${
            hiddenMode
              ? 'bg-gray-100 text-gray-400'
              : selectedObjections.length > 0
                ? isConfigLocked ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-500'
          }`}>
            {hiddenMode ? '?' : selectedObjections.length} selecionada{selectedObjections.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Search bar */}
      {!dataLoading && objections.length > 0 && !isConfigLocked && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar objeção..."
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
      ) : objections.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-3">Nenhuma objeção cadastrada.</p>
      ) : filteredObjections.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-3">Nenhuma objeção encontrada para &ldquo;{searchQuery}&rdquo;</p>
      ) : (
        <div className="space-y-3">
          {/* Compact list - 2 columns, scrollable */}
          <div className="max-h-[320px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {sortedObjections.map((objection) => {
                const isSelected = selectedObjections.includes(objection.id)
                const title = getObjectionTitle(objection.name)
                const hasRebuttals = objection.rebuttals && objection.rebuttals.length > 0

                return (
                  <div key={objection.id} className="group relative">
                    <button
                      onClick={() => {
                        if (isConfigLocked) return
                        onToggle(objection.id)
                        if (isSelected && expandedId === objection.id) {
                          setExpandedId(null)
                        }
                      }}
                      disabled={isConfigLocked && !isSelected}
                      className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all duration-150 ${
                        hiddenMode
                          ? 'bg-gray-50 text-gray-400'
                          : isConfigLocked
                            ? isSelected
                              ? 'bg-purple-50 border border-purple-200'
                              : 'bg-gray-50 opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'bg-green-50 border border-green-200'
                              : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-3.5 h-3.5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        hiddenMode
                          ? 'bg-gray-300 border-gray-300'
                          : isConfigLocked
                            ? isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                            : isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      }`}>
                        {!hiddenMode && isSelected && (
                          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Title */}
                      <span className={`text-xs leading-snug flex-1 line-clamp-2 ${
                        hiddenMode
                          ? 'text-gray-400'
                          : isSelected
                            ? isConfigLocked ? 'text-purple-800 font-medium' : 'text-green-800 font-medium'
                            : 'text-gray-700'
                      }`}>
                        {hiddenMode ? '••••••••' : title}
                      </span>

                      {/* Score dot */}
                      {!hiddenMode && objection.evaluation_score !== null && objection.evaluation_score !== undefined && (
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          objection.evaluation_score >= 7 ? 'bg-green-500' : objection.evaluation_score >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                      )}

                      {/* Info icon - shows on hover for items with long text */}
                      {!hiddenMode && !isConfigLocked && (
                        <Info
                          className="w-3 h-3 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedId(expandedId === objection.id ? null : objection.id)
                          }}
                        />
                      )}
                    </button>

                    {/* Hover tooltip - full objection text */}
                    {!hiddenMode && expandedId !== objection.id && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-72 p-3 bg-white border border-gray-200 rounded-xl shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                        <p className="text-xs text-gray-700 leading-relaxed">{objection.name}</p>
                        {hasRebuttals && (
                          <p className="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100">
                            {objection.rebuttals!.length} forma{objection.rebuttals!.length !== 1 ? 's' : ''} de quebrar
                          </p>
                        )}
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Expanded detail panel */}
          {!hiddenMode && expandedId && (() => {
            const obj = objections.find(o => o.id === expandedId)
            if (!obj) return null
            return (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 animate-[fadeIn_200ms_ease-out]">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Objeção completa</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{obj.name}</p>
                  </div>
                  <button onClick={() => setExpandedId(null)} className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
                {obj.rebuttals && obj.rebuttals.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1.5">Formas de quebrar</p>
                    <ul className="space-y-1">
                      {obj.rebuttals.map((rebuttal, idx) => (
                        <li key={idx} className="text-[10px] text-gray-600 flex items-start gap-2">
                          <span className="w-4 h-4 bg-green-100 text-green-700 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{rebuttal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
