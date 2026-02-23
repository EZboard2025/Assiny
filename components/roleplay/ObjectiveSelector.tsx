'use client'

import { Target, Lock, Loader2 } from 'lucide-react'
import type { RoleplayObjective } from '@/lib/config'

interface ObjectiveSelectorProps {
  objectives: RoleplayObjective[]
  selectedObjective: string
  onSelect: (id: string) => void
  isConfigLocked: boolean
  hiddenMode: boolean
  dataLoading: boolean
}

export default function ObjectiveSelector({
  objectives,
  selectedObjective,
  onSelect,
  isConfigLocked,
  hiddenMode,
  dataLoading,
}: ObjectiveSelectorProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isConfigLocked ? 'bg-purple-50' : 'bg-green-50'}`}>
          {isConfigLocked ? <Lock className="w-4 h-4 text-purple-600" /> : <Target className="w-4 h-4 text-green-600" />}
        </div>
        <h3 className="text-sm font-semibold text-gray-900">Objetivo do Roleplay</h3>
      </div>

      {/* Content */}
      {dataLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
        </div>
      ) : objectives.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-3">Nenhum objetivo cadastrado.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {objectives.map((objective) => {
            const isSelected = selectedObjective === objective.id
            return (
              <button
                key={objective.id}
                onClick={() => !isConfigLocked && onSelect(objective.id)}
                disabled={isConfigLocked}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  hiddenMode
                    ? 'bg-gray-100 text-gray-400 border border-gray-200'
                    : isConfigLocked
                      ? isSelected
                        ? 'bg-purple-100 border-2 border-purple-500 text-purple-700'
                        : 'bg-purple-50/50 border border-purple-100 text-purple-400 cursor-not-allowed'
                      : isSelected
                        ? 'bg-green-50 border-2 border-green-500 text-green-700'
                        : 'bg-gray-50 border border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50/30'
                }`}
              >
                {hiddenMode ? '•••••••••' : objective.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
