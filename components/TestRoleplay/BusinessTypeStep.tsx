'use client'

import { Building, User, ArrowRight, ArrowLeft, Users } from 'lucide-react'

interface BusinessTypeStepProps {
  businessType: 'B2B' | 'B2C' | 'Ambos'
  onChange: (type: 'B2B' | 'B2C' | 'Ambos') => void
  onNext: () => void
  onBack: () => void
}

export default function BusinessTypeStep({
  businessType,
  onChange,
  onNext,
  onBack
}: BusinessTypeStepProps) {
  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-8 border border-green-500/20">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Tipo de Negócio
        </h2>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Qual é o modelo de vendas da sua empresa?
        </p>

        <div className="grid grid-cols-3 gap-3">
          {/* B2B */}
          <button
            onClick={() => onChange('B2B')}
            className={`p-5 rounded-xl border-2 transition-all ${
              businessType === 'B2B'
                ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/20'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}
          >
            <Building
              className={`w-8 h-8 mx-auto mb-2 ${
                businessType === 'B2B' ? 'text-green-400' : 'text-gray-500'
              }`}
            />
            <h3
              className={`text-base font-bold mb-1 ${
                businessType === 'B2B' ? 'text-green-400' : 'text-white'
              }`}
            >
              B2B
            </h3>
            <p className="text-xs text-gray-400">
              Empresas
            </p>
          </button>

          {/* B2C */}
          <button
            onClick={() => onChange('B2C')}
            className={`p-5 rounded-xl border-2 transition-all ${
              businessType === 'B2C'
                ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/20'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}
          >
            <User
              className={`w-8 h-8 mx-auto mb-2 ${
                businessType === 'B2C' ? 'text-green-400' : 'text-gray-500'
              }`}
            />
            <h3
              className={`text-base font-bold mb-1 ${
                businessType === 'B2C' ? 'text-green-400' : 'text-white'
              }`}
            >
              B2C
            </h3>
            <p className="text-xs text-gray-400">
              Consumidores
            </p>
          </button>

          {/* Ambos */}
          <button
            onClick={() => onChange('Ambos')}
            className={`p-5 rounded-xl border-2 transition-all ${
              businessType === 'Ambos'
                ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/20'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}
          >
            <Users
              className={`w-8 h-8 mx-auto mb-2 ${
                businessType === 'Ambos' ? 'text-green-400' : 'text-gray-500'
              }`}
            />
            <h3
              className={`text-base font-bold mb-1 ${
                businessType === 'Ambos' ? 'text-green-400' : 'text-white'
              }`}
            >
              Ambos
            </h3>
            <p className="text-xs text-gray-400">
              B2B e B2C
            </p>
          </button>
        </div>

        {/* Descrição do tipo selecionado */}
        <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-green-500/10">
          {businessType === 'B2B' ? (
            <div>
              <p className="text-sm text-gray-300">
                <span className="text-green-400 font-medium">B2B (Business to Business)</span>{' '}
                é o modelo onde você vende produtos ou serviços para outras empresas.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Exemplos: SaaS empresarial, consultoria, fornecedores industriais
              </p>
            </div>
          ) : businessType === 'B2C' ? (
            <div>
              <p className="text-sm text-gray-300">
                <span className="text-green-400 font-medium">B2C (Business to Consumer)</span>{' '}
                é o modelo onde você vende diretamente para consumidores finais.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Exemplos: E-commerce, varejo, serviços pessoais, cursos online
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-300">
                <span className="text-green-400 font-medium">Ambos (B2B e B2C)</span>{' '}
                é o modelo híbrido onde você vende tanto para empresas quanto para consumidores.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Exemplos: Marketplaces, distribuidoras, franquias, plataformas SaaS com planos pessoais
              </p>
            </div>
          )}
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
