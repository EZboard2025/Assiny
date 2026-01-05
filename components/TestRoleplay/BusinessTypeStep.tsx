'use client'

import { Building, User, ArrowRight, ArrowLeft, Users, Layers, CheckCircle2 } from 'lucide-react'

interface BusinessTypeStepProps {
  businessType: 'B2B' | 'B2C' | 'Ambos'
  onChange: (type: 'B2B' | 'B2C' | 'Ambos') => void
  onNext: () => void
  onBack: () => void
}

const businessTypes = [
  {
    id: 'B2B' as const,
    title: 'B2B',
    subtitle: 'Business to Business',
    description: 'Venda para outras empresas',
    examples: 'SaaS empresarial, consultoria, fornecedores',
    icon: Building,
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'B2C' as const,
    title: 'B2C',
    subtitle: 'Business to Consumer',
    description: 'Venda para consumidores finais',
    examples: 'E-commerce, varejo, cursos online',
    icon: User,
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    id: 'Ambos' as const,
    title: 'Ambos',
    subtitle: 'Modelo Híbrido',
    description: 'Venda para empresas e consumidores',
    examples: 'Marketplaces, distribuidoras, franquias',
    icon: Users,
    gradient: 'from-green-500 to-emerald-500'
  }
]

export default function BusinessTypeStep({
  businessType,
  onChange,
  onNext,
  onBack
}: BusinessTypeStepProps) {
  return (
    <div className="w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-green-500/20 via-emerald-500/10 to-green-500/20 rounded-3xl blur-xl opacity-60" />

        <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30 shadow-2xl">
          {/* Header with icon */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                <Layers className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -inset-1 bg-green-500/20 rounded-2xl blur-md -z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center">
              Tipo de Negócio
            </h2>
            <p className="text-gray-400 text-center mt-2 text-sm">
              Qual é o modelo de vendas da sua empresa?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {businessTypes.map((type) => {
              const Icon = type.icon
              const isSelected = businessType === type.id

              return (
                <button
                  key={type.id}
                  onClick={() => onChange(type.id)}
                  className={`relative group p-6 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    isSelected
                      ? 'border-green-500 bg-green-500/10 scale-[1.02]'
                      : 'border-gray-700/50 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/60 hover:scale-[1.01]'
                  }`}
                >
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 animate-in zoom-in duration-300" />
                    </div>
                  )}

                  {/* Gradient glow on hover/select */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${type.gradient} opacity-0 transition-opacity duration-300 ${
                      isSelected ? 'opacity-10' : 'group-hover:opacity-5'
                    }`}
                  />

                  <div className="relative">
                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 ${
                        isSelected
                          ? `bg-gradient-to-br ${type.gradient} shadow-lg`
                          : 'bg-gray-700/50 group-hover:bg-gray-700'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 transition-colors duration-300 ${
                          isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                        }`}
                      />
                    </div>

                    {/* Title */}
                    <h3
                      className={`text-lg font-bold mb-1 transition-colors duration-300 ${
                        isSelected ? 'text-green-400' : 'text-white'
                      }`}
                    >
                      {type.title}
                    </h3>

                    {/* Subtitle */}
                    <p className="text-xs text-gray-500 mb-2">
                      {type.subtitle}
                    </p>

                    {/* Description */}
                    <p className="text-sm text-gray-400">
                      {type.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected type details */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${
                businessTypes.find(t => t.id === businessType)?.gradient
              }`}>
                {(() => {
                  const Icon = businessTypes.find(t => t.id === businessType)?.icon || Building
                  return <Icon className="w-4 h-4 text-white" />
                })()}
              </div>
              <div>
                <p className="text-sm text-gray-300">
                  <span className="text-green-400 font-medium">
                    {businessTypes.find(t => t.id === businessType)?.subtitle}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Exemplos: {businessTypes.find(t => t.id === businessType)?.examples}
                </p>
              </div>
            </div>
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
