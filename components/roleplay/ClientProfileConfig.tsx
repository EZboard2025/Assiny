'use client'

import { UserCircle2, Lock } from 'lucide-react'

interface ClientProfileConfigProps {
  age: number
  onAgeChange: (age: number) => void
  temperament: string
  onTemperamentChange: (temp: string) => void
  isConfigLocked: boolean
  hiddenMode: boolean
}

const TEMPERAMENTS = ['Analítico', 'Empático', 'Determinado', 'Indeciso', 'Sociável']

const AGE_BRACKETS: Record<string, { label: string; color: string; tone: string; behavior: string }> = {
  '18-24': { label: '18 a 24 anos', color: 'text-blue-600', tone: 'Informal e moderno', behavior: 'Aceita novidades' },
  '25-34': { label: '25 a 34 anos', color: 'text-green-600', tone: 'Pragmático e orientado a resultados', behavior: 'Foco em ROI • Aceita risco calculado' },
  '35-44': { label: '35 a 44 anos', color: 'text-yellow-600', tone: 'Equilibrado entre desempenho e estabilidade', behavior: 'Valoriza compliance • Cauteloso' },
  '45-60': { label: '45 a 60 anos', color: 'text-orange-600', tone: 'Conservador e formal', behavior: 'Foco em segurança • Avesso a riscos' },
}

const TEMPERAMENT_INFO: Record<string, { color: string; style: string; triggers: string }> = {
  'Analítico': { color: 'text-green-600', style: 'Formal, racional, calmo e preciso', triggers: 'Dados concretos, estatísticas' },
  'Empático': { color: 'text-pink-600', style: 'Afável, próximo, gentil e emocional', triggers: 'Histórias reais, propósito' },
  'Determinado': { color: 'text-red-600', style: 'Objetivo, seguro, impaciente e assertivo', triggers: 'Soluções rápidas, eficiência' },
  'Indeciso': { color: 'text-yellow-600', style: 'Hesitante, cauteloso e questionador', triggers: 'Depoimentos, garantias, segurança' },
  'Sociável': { color: 'text-cyan-600', style: 'Leve, animado, entusiasmado e informal', triggers: 'Amizade, humor, energia positiva' },
}

function getAgeBracket(age: number): string {
  if (age <= 24) return '18-24'
  if (age <= 34) return '25-34'
  if (age <= 44) return '35-44'
  return '45-60'
}

export default function ClientProfileConfig({
  age,
  onAgeChange,
  temperament,
  onTemperamentChange,
  isConfigLocked,
  hiddenMode,
}: ClientProfileConfigProps) {
  const bracket = getAgeBracket(age)
  const bracketInfo = AGE_BRACKETS[bracket]
  const tempInfo = TEMPERAMENT_INFO[temperament]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isConfigLocked ? 'bg-purple-50' : 'bg-green-50'}`}>
          {isConfigLocked ? <Lock className="w-4 h-4 text-purple-600" /> : <UserCircle2 className="w-4 h-4 text-green-600" />}
        </div>
        <h3 className="text-sm font-semibold text-gray-900">Perfil do Cliente</h3>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Age column */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Idade</span>
            <span className={`text-lg font-bold ${hiddenMode ? 'text-gray-400' : isConfigLocked ? 'text-purple-600' : 'text-green-600'}`}>
              {hiddenMode ? '??' : age} anos
            </span>
          </div>
          <input
            type="range"
            min="18"
            max="60"
            value={hiddenMode ? 39 : age}
            onChange={(e) => !isConfigLocked && onAgeChange(Number(e.target.value))}
            disabled={isConfigLocked}
            className={`w-full h-2 rounded-lg appearance-none ${
              hiddenMode
                ? 'bg-gray-300 accent-gray-400 pointer-events-none'
                : isConfigLocked
                  ? 'bg-purple-200 accent-purple-500 cursor-not-allowed'
                  : 'bg-gray-200 accent-green-500 cursor-pointer'
            }`}
          />
          <div className={`flex justify-between text-[10px] mt-1 ${hiddenMode ? 'text-gray-300' : 'text-gray-400'}`}>
            <span>18</span>
            <span>60</span>
          </div>

          {/* Age bracket info - compact */}
          <div className="mt-2.5 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
            {hiddenMode ? (
              <p className="text-[10px] text-gray-400">••••••••••••••</p>
            ) : (
              <div>
                <p className={`text-xs font-medium ${bracketInfo.color} mb-0.5`}>{bracketInfo.label}</p>
                <p className="text-[10px] text-gray-500">
                  <span className="text-gray-700">Tom:</span> {bracketInfo.tone}
                </p>
                <p className="text-[10px] text-gray-500">
                  <span className="text-gray-700">Comportamento:</span> {bracketInfo.behavior}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Temperament column */}
        <div>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2">Temperamento</span>
          <div className={`flex flex-wrap gap-2 ${hiddenMode ? 'blur-sm select-none pointer-events-none' : ''}`}>
            {TEMPERAMENTS.map((temp) => {
              const isSelected = temperament === temp
              return (
                <button
                  key={temp}
                  onClick={() => !isConfigLocked && onTemperamentChange(temp)}
                  disabled={isConfigLocked}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    hiddenMode
                      ? 'bg-gray-300 text-gray-500 border border-gray-300'
                      : isConfigLocked
                        ? isSelected
                          ? 'bg-purple-500 text-white border border-purple-500 cursor-not-allowed'
                          : 'bg-purple-100 text-purple-400 border border-purple-200 cursor-not-allowed'
                        : isSelected
                          ? 'bg-green-500 text-white border border-green-500'
                          : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {temp}
                </button>
              )
            })}
          </div>

          {/* Temperament info - compact, only for selected */}
          {tempInfo && (
            <div className="mt-2.5 p-2.5 bg-green-50/50 rounded-lg border border-green-100">
              {hiddenMode ? (
                <p className="text-[10px] text-gray-400">••••••••••••••</p>
              ) : (
                <div>
                  <p className={`text-xs font-medium ${tempInfo.color} mb-0.5`}>{temperament}</p>
                  <p className="text-[10px] text-gray-500">
                    <span className="text-gray-700">Estilo:</span> {tempInfo.style}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    <span className="text-gray-700">Gatilhos:</span> {tempInfo.triggers}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
