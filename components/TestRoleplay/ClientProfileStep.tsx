'use client'

import { UserCog, ArrowRight, ArrowLeft, Target } from 'lucide-react'

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
    description: 'Precisa de dados, números e provas. Faz muitas perguntas técnicas e comparações detalhadas.'
  },
  {
    name: 'Empático',
    description: 'Valoriza relacionamento e confiança. Quer saber se você entende suas necessidades.'
  },
  {
    name: 'Determinado',
    description: 'Objetivo e direto. Quer ir ao ponto e saber o que você pode fazer por ele.'
  },
  {
    name: 'Indeciso',
    description: 'Precisa de segurança e garantias. Tem medo de tomar a decisão errada.'
  },
  {
    name: 'Sociável',
    description: 'Gosta de conversar e criar conexão. Aprecia histórias e casos de sucesso.'
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
  const ageRange = getAgeRange(age)
  const ageInfo = AGE_INFO[ageRange]
  const selectedTemp = TEMPERAMENTS.find(t => t.name === temperament)

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-8 border border-green-500/20">
        <div className="flex items-center gap-3 mb-2 justify-center">
          <UserCog className="w-6 h-6 text-green-400" />
          <h2 className="text-2xl font-bold text-white">
            Perfil Comportamental
          </h2>
        </div>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Configure idade e temperamento do cliente simulado
        </p>

        {/* Slider de idade */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-300">
              Idade do Cliente
            </label>
            <span className="text-2xl font-bold text-green-400">{age}</span>
          </div>
          <input
            type="range"
            min="18"
            max="60"
            value={age}
            onChange={(e) => onAgeChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>18</span>
            <span>60</span>
          </div>

          {/* Info box da idade */}
          <div className="mt-4 p-4 bg-gradient-to-r from-green-900/30 to-lime-900/30 rounded-xl border border-green-500/20">
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
            {TEMPERAMENTS.map((temp) => (
              <button
                key={temp.name}
                onClick={() => onTemperamentChange(temp.name)}
                className={`p-3 rounded-xl text-sm font-medium transition-all ${
                  temperament === temp.name
                    ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                    : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {temp.name}
              </button>
            ))}
          </div>

          {/* Info box do temperamento */}
          {selectedTemp && (
            <div className="mt-4 p-4 bg-gradient-to-r from-green-900/30 to-lime-900/30 rounded-xl border border-green-500/20">
              <p className="text-sm text-green-400 font-medium mb-1">{selectedTemp.name}</p>
              <p className="text-xs text-gray-400">{selectedTemp.description}</p>
            </div>
          )}
        </div>

        {/* Objetivo da venda */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-green-400" />
            <label className="text-sm font-medium text-gray-300">
              Objetivo do vendedor nessa simulação
            </label>
          </div>
          <textarea
            value={objective}
            onChange={(e) => onObjectiveChange(e.target.value)}
            placeholder="Ex: Agendar uma reunião de demonstração, Fechar a venda, Qualificar o lead, Apresentar nova funcionalidade..."
            rows={3}
            className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
          />
          <p className="text-xs text-gray-500 mt-2">
            Descreva o que você quer alcançar nessa conversa de vendas
          </p>
        </div>

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
            className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-bold text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/50 transition-all flex items-center justify-center gap-2"
          >
            Continuar
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
