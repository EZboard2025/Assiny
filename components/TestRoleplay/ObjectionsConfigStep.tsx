'use client'

import { ShieldAlert, Plus, Trash2, ArrowRight, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
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

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-8 border border-green-500/20">
        <div className="flex items-center gap-3 mb-2 justify-center">
          <ShieldAlert className="w-6 h-6 text-green-400" />
          <h2 className="text-2xl font-bold text-white">
            Objeções
          </h2>
        </div>
        <p className="text-gray-400 text-center mb-6 text-sm">
          Configure as objeções que o cliente pode fazer durante a venda
        </p>

        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
          {objections.map((objection, objIndex) => (
            <div
              key={objIndex}
              className="bg-gray-800/50 rounded-xl border border-green-500/10 overflow-hidden"
            >
              {/* Header da objeção */}
              <div
                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-800/70 transition-colors"
                onClick={() => setExpandedIndex(expandedIndex === objIndex ? null : objIndex)}
              >
                <div className="flex-1">
                  <input
                    type="text"
                    value={objection.name}
                    onChange={(e) => {
                      e.stopPropagation()
                      updateObjectionName(objIndex, e.target.value)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder={`Objeção ${objIndex + 1}: Ex: "Está muito caro"`}
                    className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {objections.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeObjection(objIndex)
                      }}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {expandedIndex === objIndex ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Rebuttals (expandido) */}
              {expandedIndex === objIndex && (
                <div className="px-4 pb-4 border-t border-green-500/10 pt-4">
                  <p className="text-xs text-gray-500 mb-3">
                    Formas de quebrar esta objeção (opcional):
                  </p>
                  <div className="space-y-2">
                    {objection.rebuttals.map((rebuttal, rebIndex) => (
                      <div key={rebIndex} className="flex gap-2">
                        <input
                          type="text"
                          value={rebuttal}
                          onChange={(e) => updateRebuttal(objIndex, rebIndex, e.target.value)}
                          placeholder={`Rebatida ${rebIndex + 1}`}
                          className="flex-1 px-3 py-2 bg-gray-700/50 border border-green-500/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/30"
                        />
                        <button
                          onClick={() => removeRebuttal(objIndex, rebIndex)}
                          className="p-2 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => addRebuttal(objIndex)}
                    className="mt-3 text-sm text-green-400 hover:text-green-300 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar rebatida
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botão adicionar objeção */}
        <button
          onClick={addObjection}
          className="w-full mt-4 py-3 border-2 border-dashed border-green-500/30 rounded-xl text-green-400 hover:border-green-500/50 hover:bg-green-500/5 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Adicionar Objeção
        </button>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onBack}
            className="flex-1 py-3 bg-gray-700/50 text-white rounded-xl font-medium hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <button
            onClick={onNext}
            disabled={!isValid}
            className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-bold text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Continuar
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
