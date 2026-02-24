'use client'

import { Target, ChevronDown, ChevronUp, Lightbulb, Lock, Loader2, Phone } from 'lucide-react'
import ObjectiveSelector from './ObjectiveSelector'
import PersonaSelector from './PersonaSelector'
import ObjectionSelector from './ObjectionSelector'
import ClientProfileConfig from './ClientProfileConfig'
import SessionSummary from './SessionSummary'
import type { Persona, Objection, Tag, RoleplayObjective } from '@/lib/config'

interface ChallengeConfig {
  title: string
  description: string
  target_weakness: string
  roleplay_config: {
    persona_id: string
    objection_ids: string[]
    age_range: string
    temperament: string
    objective_id?: string
  }
  success_criteria: {
    spin_letter_target: string
    spin_min_score: number
    primary_indicator: string
    primary_min_score: number
    objection_handling_min: number
  }
  coaching_tips: string[]
}

interface MeetSimulationConfig {
  persona: any
  objections: Array<{ name: string; rebuttals: string[]; source: string }>
  age: number
  temperament: string
  objective: { name: string; description: string }
  simulation_justification?: string
  coaching_focus: Array<{
    area: string
    spin_score?: number
    severity?: string
    diagnosis?: string
    what_to_improve?: string
    tips?: string[]
  }>
  meeting_context: string
}

interface RoleplayConfigScreenProps {
  // Data
  personas: Persona[]
  objections: Objection[]
  objectives: RoleplayObjective[]
  tags: Tag[]
  personaTags: Map<string, Tag[]>
  businessType: 'B2B' | 'B2C' | 'Ambos'
  // Config state
  age: number
  onAgeChange: (age: number) => void
  temperament: string
  onTemperamentChange: (temp: string) => void
  selectedPersona: string
  onPersonaSelect: (id: string) => void
  selectedObjections: string[]
  onObjectionToggle: (id: string) => void
  selectedObjective: string
  onObjectiveSelect: (id: string) => void
  hiddenMode: boolean
  onToggleHidden: () => void
  // Mode flags
  isConfigLocked: boolean
  isMeetSimulation: boolean
  dataLoading: boolean
  roleplayLimitReached: boolean
  mounted: boolean
  // Actions
  onStart: () => void
  onRandomize: () => void
  // Special modes
  challengeConfig?: ChallengeConfig
  meetSimulationConfig?: MeetSimulationConfig
  isChallengeExpanded: boolean
  onToggleChallengeExpanded: () => void
  // Helpers
  cleanSpinText: (text: string) => string
  extractSpinLetter: (text: string) => string
  formatSpinLetter: (text: string) => string
}

export default function RoleplayConfigScreen(props: RoleplayConfigScreenProps) {
  const {
    personas, objections, objectives, tags, personaTags, businessType,
    age, onAgeChange, temperament, onTemperamentChange,
    selectedPersona, onPersonaSelect, selectedObjections, onObjectionToggle,
    selectedObjective, onObjectiveSelect, hiddenMode, onToggleHidden,
    isConfigLocked, isMeetSimulation, dataLoading, roleplayLimitReached, mounted,
    onStart, onRandomize,
    challengeConfig, meetSimulationConfig, isChallengeExpanded, onToggleChallengeExpanded,
    cleanSpinText, extractSpinLetter, formatSpinLetter,
  } = props

  // Get persona eval score for difficulty indicator
  const selectedPersonaObj = personas.find(p => p.id === selectedPersona)
  const personaEvalScore = selectedPersonaObj?.evaluation_score

  return (
    <div className="relative z-10 py-8 pl-20 pr-6">
      <div className="max-w-6xl">

        {/* Challenge Banner */}
        {challengeConfig && (
          <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleChallengeExpanded() }}
              className="w-full p-4 flex items-start gap-3 hover:bg-gray-50/50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{cleanSpinText(challengeConfig.title)}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                    {extractSpinLetter(challengeConfig.success_criteria.spin_letter_target)} ≥ {challengeConfig.success_criteria.spin_min_score}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                    Desafio Diário
                  </span>
                </div>
              </div>
              <div className="text-gray-400">
                {isChallengeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            {isChallengeExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-gray-600 leading-relaxed">{cleanSpinText(challengeConfig.description)}</p>
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-semibold text-green-700">Meta</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    Alcançar <span className="font-bold text-green-700">{challengeConfig.success_criteria.spin_min_score}+</span> em {formatSpinLetter(challengeConfig.success_criteria.spin_letter_target)}
                  </p>
                </div>
                {challengeConfig.coaching_tips?.length > 0 && (
                  <details className="group" open>
                    <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                      <Lightbulb className="w-3.5 h-3.5 text-green-600" />
                      <span>Dicas de coaching</span>
                      <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform ml-auto" />
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {challengeConfig.coaching_tips.map((tip, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                          <span className="w-4 h-4 bg-green-100 text-green-700 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{cleanSpinText(tip)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Config locked banner */}
        {isConfigLocked && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              {isMeetSimulation ? <Target className="w-4 h-4 text-purple-600" /> : <Lock className="w-4 h-4 text-purple-600" />}
            </div>
            <div>
              <p className="text-sm font-medium text-purple-900">
                {isMeetSimulation ? 'Simulação de Reunião' : 'Configuração do Desafio'}
              </p>
              <p className="text-xs text-purple-600">
                {isMeetSimulation
                  ? 'Configuração gerada automaticamente com base na avaliação do Google Meet.'
                  : 'Persona, idade, temperamento e objeções foram definidos pelo desafio.'}
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {dataLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
              <p className="text-sm text-gray-400">Carregando configurações...</p>
            </div>
          </div>
        ) : (
          /* Main layout: content + sidebar */
          <div className="flex gap-6">
            {/* Main content (left) */}
            <div className="flex-1 min-w-0">
              <ClientProfileConfig
                age={age}
                onAgeChange={onAgeChange}
                temperament={temperament}
                onTemperamentChange={onTemperamentChange}
                isConfigLocked={isConfigLocked}
                hiddenMode={hiddenMode}
              />

              <PersonaSelector
                personas={personas}
                selectedPersona={selectedPersona}
                onSelect={onPersonaSelect}
                businessType={businessType}
                tags={tags}
                personaTags={personaTags}
                isConfigLocked={isConfigLocked}
                hiddenMode={hiddenMode}
                dataLoading={false}
              />

              <ObjectionSelector
                objections={objections}
                selectedObjections={selectedObjections}
                onToggle={onObjectionToggle}
                isConfigLocked={isConfigLocked}
                hiddenMode={hiddenMode}
                dataLoading={false}
              />

              <ObjectiveSelector
                objectives={objectives}
                selectedObjective={selectedObjective}
                onSelect={onObjectiveSelect}
                isConfigLocked={isConfigLocked}
                hiddenMode={hiddenMode}
                dataLoading={false}
              />

              {/* Mobile CTA - hidden on desktop */}
              <div className="lg:hidden mt-4">
                <button
                  onClick={onStart}
                  disabled={dataLoading || roleplayLimitReached || !selectedPersona || selectedObjections.length === 0 || !selectedObjective}
                  className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-semibold text-lg transition-all ${
                    dataLoading || roleplayLimitReached || !selectedPersona || selectedObjections.length === 0 || !selectedObjective
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-500 text-white hover:scale-[1.02]'
                  }`}
                >
                  {roleplayLimitReached ? (
                    <><Lock className="w-6 h-6" /> Limite Atingido</>
                  ) : (
                    <><Phone className="w-6 h-6" /> Iniciar Simulação</>
                  )}
                </button>
              </div>
            </div>

            {/* Sidebar (right) - hidden on mobile */}
            <div className="hidden lg:block w-[340px] flex-shrink-0 ml-[70px]">
              <SessionSummary
                selectedObjective={selectedObjective}
                objectives={objectives}
                selectedPersona={selectedPersona}
                personas={personas}
                selectedObjections={selectedObjections}
                age={age}
                temperament={temperament}
                businessType={businessType}
                isConfigLocked={isConfigLocked}
                hiddenMode={hiddenMode}
                dataLoading={false}
                roleplayLimitReached={roleplayLimitReached}
                onStart={onStart}
                onRandomize={onRandomize}
                onToggleHidden={onToggleHidden}
                personaEvalScore={personaEvalScore}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
