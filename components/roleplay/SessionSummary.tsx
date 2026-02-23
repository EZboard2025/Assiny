'use client'

import { Target, Users, ShieldAlert, UserCircle2, Phone, Lock, Shuffle, Eye, EyeOff, CheckCircle } from 'lucide-react'
import type { Persona, PersonaB2B, PersonaB2C, RoleplayObjective } from '@/lib/config'

interface SessionSummaryProps {
  // Config state
  selectedObjective: string
  objectives: RoleplayObjective[]
  selectedPersona: string
  personas: Persona[]
  selectedObjections: string[]
  age: number
  temperament: string
  businessType: 'B2B' | 'B2C' | 'Ambos'
  // Mode flags
  isConfigLocked: boolean
  hiddenMode: boolean
  dataLoading: boolean
  roleplayLimitReached: boolean
  // Actions
  onStart: () => void
  onRandomize: () => void
  onToggleHidden: () => void
  // Persona eval score for difficulty
  personaEvalScore?: number | null
}

function getPersonaTitle(persona: Persona): string {
  if (persona.business_type === 'B2B') {
    return (persona as any).cargo || (persona as PersonaB2B).job_title || 'Sem título'
  }
  return (persona as any).profissao || (persona as PersonaB2C).profession || 'Sem título'
}

export default function SessionSummary({
  selectedObjective,
  objectives,
  selectedPersona,
  personas,
  selectedObjections,
  age,
  temperament,
  businessType,
  isConfigLocked,
  hiddenMode,
  dataLoading,
  roleplayLimitReached,
  onStart,
  onRandomize,
  onToggleHidden,
  personaEvalScore,
}: SessionSummaryProps) {
  const objective = objectives.find(o => o.id === selectedObjective)
  const persona = personas.find(p => p.id === selectedPersona)
  const isReady = !!selectedPersona && selectedObjections.length > 0 && !!selectedObjective
  const canStart = isReady && !roleplayLimitReached && !dataLoading

  // Summary items
  const items = [
    {
      icon: Target,
      label: 'Objetivo',
      value: objective?.name || null,
      configured: !!selectedObjective,
      color: 'bg-green-50 text-green-600',
    },
    {
      icon: Users,
      label: 'Persona',
      value: persona ? getPersonaTitle(persona) : null,
      configured: !!selectedPersona,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: ShieldAlert,
      label: 'Objeções',
      value: selectedObjections.length > 0 ? `${selectedObjections.length} selecionada${selectedObjections.length !== 1 ? 's' : ''}` : null,
      configured: selectedObjections.length > 0,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      icon: UserCircle2,
      label: 'Perfil',
      value: `${age} anos • ${temperament}`,
      configured: true, // Always has defaults
      color: 'bg-purple-50 text-purple-600',
    },
  ]

  // Missing items text
  const getMissingText = () => {
    const missing: string[] = []
    if (!selectedObjective) missing.push('objetivo')
    if (!selectedPersona) missing.push('persona')
    if (selectedObjections.length === 0) missing.push('objeção')
    if (missing.length === 0) return null
    return `Selecione: ${missing.join(', ')}`
  }

  return (
    <div className="sticky top-8">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        {/* Title */}
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5">Resumo da Sessão</h3>

        {/* Summary items */}
        <div className="space-y-0">
          {items.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={item.label} className={`flex items-start gap-3.5 py-4 ${idx < items.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{item.label}</p>
                  <p className={`text-sm font-medium truncate ${
                    hiddenMode ? 'text-gray-400' : item.configured ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {hiddenMode ? '•••••••' : item.value || '—'}
                  </p>
                </div>
                {!hiddenMode && (
                  <div className="flex-shrink-0 mt-1.5">
                    {item.configured ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>


        {/* CTA Button */}
        <div className="mt-6">
          <button
            onClick={onStart}
            disabled={!canStart}
            className={`w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2.5 transition-all duration-300 ${
              canStart
                ? 'bg-green-600 hover:bg-green-500 text-white hover:shadow-lg hover:shadow-green-500/20 hover:scale-[1.02]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {roleplayLimitReached ? (
              <>
                <Lock className="w-5 h-5" />
                Limite Atingido
              </>
            ) : (
              <>
                <Phone className="w-5 h-5" />
                Iniciar Simulação
              </>
            )}
          </button>
          {!canStart && !roleplayLimitReached && !dataLoading && (
            <p className="text-[10px] text-center text-gray-400 mt-2">{getMissingText()}</p>
          )}
        </div>

        {/* Utility buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onRandomize}
            disabled={isConfigLocked || dataLoading}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              isConfigLocked
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
            }`}
          >
            {isConfigLocked ? <Lock className="w-3.5 h-3.5" /> : <Shuffle className="w-3.5 h-3.5" />}
            {isConfigLocked ? 'Travado' : 'Aleatório'}
          </button>
          <button
            onClick={onToggleHidden}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              hiddenMode
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {hiddenMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {hiddenMode ? 'Mostrar' : 'Ocultar'}
          </button>
        </div>
      </div>
    </div>
  )
}
