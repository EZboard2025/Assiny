'use client'

import { useState } from 'react'
import { UserCog, ArrowRight, ArrowLeft, Target, Settings, CheckCircle2, Brain, Smile, Zap, HelpCircle, Users } from 'lucide-react'

interface ClientProfileStepProps {
  age: number
  temperament: string
  objective: string
  onAgeChange: (age: number) => void
  onTemperamentChange: (temperament: string) => void
  onObjectiveChange: (objective: string) => void
  onNext: () => void
  onBack: () => void
}

const TEMPERAMENTS = [
  {
    name: 'Analítico',
    icon: Brain,
    description: 'Precisa de dados, números e provas. Faz muitas perguntas técnicas e comparações detalhadas.',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    name: 'Empático',
    icon: Smile,
    description: 'Valoriza relacionamento e confiança. Quer saber se você entende suas necessidades.',
    color: 'from-pink-500 to-rose-500'
  },
  {
    name: 'Determinado',
    icon: Zap,
    description: 'Objetivo e direto. Quer ir ao ponto e saber o que você pode fazer por ele.',
    color: 'from-orange-500 to-amber-500'
  },
  {
    name: 'Indeciso',
    icon: HelpCircle,
    description: 'Precisa de segurança e garantias. Tem medo de tomar a decisão errada.',
    color: 'from-purple-500 to-violet-500'
  },
  {
    name: 'Sociável',
    icon: Users,
    description: 'Gosta de conversar e criar conexão. Aprecia histórias e casos de sucesso.',
    color: 'from-green-500 to-emerald-500'
  }
]

const AGE_INFO: Record<string, { range: string; description: string }> = {
  '18-24': {
    range: '18-24 anos',
    description: 'Tom informal, vocabulário moderno. Busca praticidade e inovação. Sensível a preço e tendências.'
  },
  '25-34': {
    range: '25-34 anos',
    description: 'Pragmático e focado em ROI. Valoriza eficiência e resultados mensuráveis.'
  },
  '35-44': {
    range: '35-44 anos',
    description: 'Equilibrado entre inovação e segurança. Preocupado com compliance e reputação.'
  },
  '45-60': {
    range: '45-60 anos',
    description: 'Conservador e cauteloso. Valoriza tradição, referências e segurança nas decisões.'
  }
}

function getAgeRange(age: number): string {
  if (age <= 24) return '18-24'
  if (age <= 34) return '25-34'
  if (age <= 44) return '35-44'
  return '45-60'
}

export default function ClientProfileStep({
  age,
  temperament,
  objective,
  onAgeChange,
  onTemperamentChange,
  onObjectiveChange,
  onNext,
  onBack
}: ClientProfileStepProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const ageRange = getAgeRange(age)
  const ageInfo = AGE_INFO[ageRange]
  const selectedTemp = TEMPERAMENTS.find(t => t.name === temperament)

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
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -inset-1 bg-green-500/20 rounded-2xl blur-md -z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center">
              Perfil Comportamental
            </h2>
            <p className="text-gray-400 text-center mt-2 text-sm">
              Configure idade e temperamento do cliente simulado
            </p>
          </div>

          {/* Slider de idade */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-300">
                Idade do Cliente
              </label>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">{age}</span>
                <span className="text-sm text-gray-500">anos</span>
              </div>
            </div>

            {/* Custom slider container */}
            <div className="relative py-2">
              <input
                type="range"
                min="18"
                max="60"
                value={age}
                onChange={(e) => onAgeChange(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-full appearance-none cursor-pointer accent-green-500
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-6
                  [&::-webkit-slider-thumb]:h-6
                  [&::-webkit-slider-thumb]:bg-gradient-to-br
                  [&::-webkit-slider-thumb]:from-green-400
                  [&::-webkit-slider-thumb]:to-emerald-500
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-webkit-slider-thumb]:shadow-green-500/30
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:transition-transform
                  [&::-webkit-slider-thumb]:hover:scale-110
                "
              />
              {/* Progress fill */}
              <div
                className="absolute top-1/2 left-0 -translate-y-1/2 h-3 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full pointer-events-none"
                style={{ width: `${((age - 18) / (60 - 18)) * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>18</span>
              <span>60</span>
            </div>

            {/* Info box da idade */}
            <div className="mt-4 p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl border border-green-500/20 animate-in fade-in duration-300">
              <p className="text-sm text-green-400 font-medium mb-1">{ageInfo.range}</p>
              <p className="text-xs text-gray-400">{ageInfo.description}</p>
            </div>
          </div>

          {/* Temperamentos */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">
              Temperamento
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TEMPERAMENTS.map((temp) => {
                const Icon = temp.icon
                const isSelected = temperament === temp.name
                return (
                  <button
                    key={temp.name}
                    onClick={() => onTemperamentChange(temp.name)}
                    className={`relative p-4 rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden group ${
                      isSelected
                        ? 'bg-green-500/10 border-2 border-green-500 text-green-400 scale-[1.02]'
                        : 'bg-gray-800/50 border-2 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:scale-[1.01]'
                    }`}
                  >
                    {/* Gradient background on select */}
                    {isSelected && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${temp.color} opacity-10`} />
                    )}

                    <div className="relative flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        isSelected
                          ? `bg-gradient-to-br ${temp.color} shadow-lg`
                          : 'bg-gray-700/50 group-hover:bg-gray-700'
                      }`}>
                        <Icon className={`w-5 h-5 transition-colors duration-300 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <span>{temp.name}</span>
                    </div>

                    {/* Check indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Info box do temperamento */}
            {selectedTemp && (
              <div className="mt-4 p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl border border-green-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-1">
                  <selectedTemp.icon className="w-4 h-4 text-green-400" />
                  <p className="text-sm text-green-400 font-medium">{selectedTemp.name}</p>
                </div>
                <p className="text-xs text-gray-400">{selectedTemp.description}</p>
              </div>
            )}
          </div>

          {/* Objetivo da venda */}
          <div className={`mt-8 transition-all duration-300 ${focusedField === 'objective' ? 'scale-[1.01]' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <Target className={`w-5 h-5 transition-colors duration-300 ${focusedField === 'objective' ? 'text-green-400' : 'text-gray-400'}`} />
              <label className="text-sm font-medium text-gray-300">
                Objetivo do vendedor nessa simulação
              </label>
              {objective.trim().length > 5 && (
                <CheckCircle2 className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />
              )}
            </div>
            <div className="relative">
              <div className={`absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur transition-opacity duration-300 ${focusedField === 'objective' ? 'opacity-100' : 'opacity-0'}`} />
              <textarea
                value={objective}
                onChange={(e) => onObjectiveChange(e.target.value)}
                onFocus={() => setFocusedField('objective')}
                onBlur={() => setFocusedField(null)}
                placeholder="Ex: Agendar uma reunião de demonstração, Fechar a venda, Qualificar o lead..."
                rows={3}
                className="relative w-full px-4 py-3.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300 resize-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Descreva o que você quer alcançar nessa conversa de vendas
            </p>
          </div>

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
              className="relative flex-1 py-3.5 rounded-xl font-bold text-white overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-500 transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>
              <span className="relative flex items-center justify-center gap-2">
                Continuar
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
