'use client'

import { ShieldAlert, Plus, Trash2, ArrowRight, ArrowLeft, ChevronDown, ChevronUp, MessageSquareWarning, CheckCircle2 } from 'lucide-react'
import { Objection } from './TestRoleplayPage'
import { useState } from 'react'

interface ObjectionsConfigStepProps {
  objections: Objection[]
  onChange: (objections: Objection[]) => void
  onNext: () => void
  onBack: () => void
}

export default function ObjectionsConfigStep({
  objections,
  onChange,
  onNext,
  onBack
}: ObjectionsConfigStepProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const addObjection = () => {
    onChange([...objections, { name: '', rebuttals: [] }])
    setExpandedIndex(objections.length) // Expandir a nova objeção
  }

  const removeObjection = (index: number) => {
    if (objections.length > 1) {
      const newObjections = objections.filter((_, i) => i !== index)
      onChange(newObjections)
      if (expandedIndex === index) {
        setExpandedIndex(null)
      } else if (expandedIndex !== null && expandedIndex > index) {
        setExpandedIndex(expandedIndex - 1)
      }
    }
  }

  const updateObjectionName = (index: number, name: string) => {
    const newObjections = [...objections]
    newObjections[index] = { ...newObjections[index], name }
    onChange(newObjections)
  }

  const addRebuttal = (objectionIndex: number) => {
    const newObjections = [...objections]
    newObjections[objectionIndex].rebuttals = [
      ...newObjections[objectionIndex].rebuttals,
      ''
    ]
    onChange(newObjections)
  }

  const updateRebuttal = (objectionIndex: number, rebuttalIndex: number, value: string) => {
    const newObjections = [...objections]
    newObjections[objectionIndex].rebuttals[rebuttalIndex] = value
    onChange(newObjections)
  }

  const removeRebuttal = (objectionIndex: number, rebuttalIndex: number) => {
    const newObjections = [...objections]
    newObjections[objectionIndex].rebuttals = newObjections[objectionIndex].rebuttals.filter(
      (_, i) => i !== rebuttalIndex
    )
    onChange(newObjections)
  }

  // Pelo menos uma objeção com nome preenchido
  const isValid = objections.some(obj => obj.name.trim() !== '')
  const completedCount = objections.filter(obj => obj.name.trim() !== '').length

  return (
    <div className="w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-green-500/20 via-emerald-500/10 to-green-500/20 rounded-3xl blur-xl opacity-60" />

        <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30 shadow-2xl">
          {/* Header with icon */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                <MessageSquareWarning className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -inset-1 bg-green-500/20 rounded-2xl blur-md -z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center">
              Objeções
            </h2>
            <p className="text-gray-400 text-center mt-2 text-sm">
              Configure as objeções que o cliente pode fazer durante a venda
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-6 px-2">
            <span className="text-sm text-gray-400">
              {completedCount} objeção{completedCount !== 1 ? 'ões' : ''} configurada{completedCount !== 1 ? 's' : ''}
            </span>
            {isValid && (
              <span className="flex items-center gap-1 text-sm text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                Pronto
              </span>
            )}
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {objections.map((objection, objIndex) => {
              const isExpanded = expandedIndex === objIndex
              const isFocused = focusedField === `objection-${objIndex}`
              const hasName = objection.name.trim() !== ''

              return (
                <div
                  key={objIndex}
                  className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ${
                    isExpanded
                      ? 'bg-gray-800/60 border-green-500/30 shadow-lg shadow-green-500/10'
                      : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600'
                  } ${isFocused ? 'scale-[1.01]' : ''}`}
                >
                  {/* Header da objeção */}
                  <div
                    className="p-4 flex items-center gap-3 cursor-pointer transition-colors"
                    onClick={() => setExpandedIndex(isExpanded ? null : objIndex)}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      hasName ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gray-700/50'
                    }`}>
                      {hasName ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-sm text-gray-400">{objIndex + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 relative">
                      <div className={`absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent rounded-lg transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-0'}`} />
                      <input
                        type="text"
                        value={objection.name}
                        onChange={(e) => {
                          e.stopPropagation()
                          updateObjectionName(objIndex, e.target.value)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={() => setFocusedField(`objection-${objIndex}`)}
                        onBlur={() => setFocusedField(null)}
                        placeholder={`Objeção ${objIndex + 1}: Ex: "Está muito caro"`}
                        className="relative w-full bg-transparent text-white placeholder-gray-500 focus:outline-none py-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {objections.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeObjection(objIndex)
                          }}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* Rebuttals (expandido) */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-green-500/10 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-xs text-gray-500 mb-3">
                        Formas de quebrar esta objeção (opcional):
                      </p>
                      <div className="space-y-2">
                        {objection.rebuttals.map((rebuttal, rebIndex) => {
                          const rebFocused = focusedField === `rebuttal-${objIndex}-${rebIndex}`
                          return (
                            <div key={rebIndex} className={`flex gap-2 transition-all duration-300 ${rebFocused ? 'scale-[1.01]' : ''}`}>
                              <div className="relative flex-1">
                                <div className={`absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg blur transition-opacity duration-300 ${rebFocused ? 'opacity-100' : 'opacity-0'}`} />
                                <input
                                  type="text"
                                  value={rebuttal}
                                  onChange={(e) => updateRebuttal(objIndex, rebIndex, e.target.value)}
                                  onFocus={() => setFocusedField(`rebuttal-${objIndex}-${rebIndex}`)}
                                  onBlur={() => setFocusedField(null)}
                                  placeholder={`Rebatida ${rebIndex + 1}`}
                                  className="relative w-full px-3 py-2.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:bg-gray-700/80 transition-all duration-300"
                                />
                              </div>
                              <button
                                onClick={() => removeRebuttal(objIndex, rebIndex)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <button
                        onClick={() => addRebuttal(objIndex)}
                        className="mt-3 text-sm text-green-400 hover:text-green-300 transition-colors flex items-center gap-1 px-2 py-1 hover:bg-green-500/10 rounded-lg"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar rebatida
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Botão adicionar objeção */}
          <button
            onClick={addObjection}
            className="w-full mt-4 py-3.5 border-2 border-dashed border-green-500/30 rounded-xl text-green-400 hover:border-green-500/50 hover:bg-green-500/10 transition-all flex items-center justify-center gap-2 group"
          >
            <Plus className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" />
            Adicionar Objeção
          </button>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onBack}
              className="flex-1 py-3.5 bg-gray-800/60 border border-gray-700/50 text-white rounded-xl font-medium hover:bg-gray-800 hover:border-gray-600 transition-all flex items-center justify-center gap-2 group"
            >
              <ArrowLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" />
              Voltar
            </button>
            <button
              onClick={onNext}
              disabled={!isValid}
              className="relative flex-1 py-3.5 rounded-xl font-bold text-white overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-500 transition-transform duration-300 group-hover:scale-105 group-disabled:scale-100" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-disabled:hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>
              <span className="relative flex items-center justify-center gap-2">
                Continuar
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1 group-disabled:translate-x-0" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
