'use client'

interface DifficultyIndicatorProps {
  temperament: string
  age: number
  objectionCount: number
  personaEvalScore?: number | null
}

function calculateDifficulty(config: DifficultyIndicatorProps) {
  let score = 0

  // Temperament weight (0-30)
  const tempWeights: Record<string, number> = {
    'Sociável': 5,
    'Empático': 10,
    'Analítico': 20,
    'Indeciso': 25,
    'Determinado': 30,
  }
  score += tempWeights[config.temperament] || 15

  // Objection count weight (0-30)
  score += Math.min(config.objectionCount * 10, 30)

  // Age bracket weight (0-20)
  if (config.age >= 45) score += 20
  else if (config.age >= 35) score += 15
  else if (config.age >= 25) score += 10
  else score += 5

  // Persona quality weight (0-20)
  if (config.personaEvalScore && config.personaEvalScore >= 8) score += 20
  else if (config.personaEvalScore && config.personaEvalScore >= 6) score += 10

  if (score >= 75) return { level: 'Expert' as const, score, color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' }
  if (score >= 50) return { level: 'Difícil' as const, score, color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50' }
  if (score >= 25) return { level: 'Médio' as const, score, color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50' }
  return { level: 'Fácil' as const, score, color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50' }
}

export default function DifficultyIndicator({ temperament, age, objectionCount, personaEvalScore }: DifficultyIndicatorProps) {
  const { level, score, color, textColor, bgColor } = calculateDifficulty({ temperament, age, objectionCount, personaEvalScore })
  const pct = Math.min(100, score)

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dificuldade</span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${bgColor} ${textColor}`}>
          {level}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
