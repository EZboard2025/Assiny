'use client'

import { useState } from 'react'
import { UserCircle2, ArrowRight, ArrowLeft, Building, User } from 'lucide-react'
import { PersonaB2B, PersonaB2C } from './TestRoleplayPage'

interface PersonaConfigStepProps {
  businessType: 'B2B' | 'B2C' | 'Ambos'
  personaB2B: PersonaB2B
  personaB2C: PersonaB2C
  onChangeB2B: (persona: PersonaB2B) => void
  onChangeB2C: (persona: PersonaB2C) => void
  onNext: () => void
  onBack: () => void
  selectedPersonaType?: 'B2B' | 'B2C'
  onPersonaTypeChange?: (type: 'B2B' | 'B2C') => void
}

export default function PersonaConfigStep({
  businessType,
  personaB2B,
  personaB2C,
  onChangeB2B,
  onChangeB2C,
  onNext,
  onBack,
  selectedPersonaType,
  onPersonaTypeChange
}: PersonaConfigStepProps) {
  // Para "Ambos", o usuário escolhe qual tipo usar neste roleplay
  const [localPersonaType, setLocalPersonaType] = useState<'B2B' | 'B2C'>(selectedPersonaType || 'B2B')

  // Tipo efetivo: se businessType é B2B ou B2C, usa ele; se é Ambos, usa a seleção local
  const effectiveType = businessType === 'Ambos' ? localPersonaType : businessType

  const handlePersonaTypeChange = (type: 'B2B' | 'B2C') => {
    setLocalPersonaType(type)
    onPersonaTypeChange?.(type)
  }

  const updateB2B = (field: keyof PersonaB2B, value: string) => {
    onChangeB2B({ ...personaB2B, [field]: value })
  }

  const updateB2C = (field: keyof PersonaB2C, value: string) => {
    onChangeB2C({ ...personaB2C, [field]: value })
  }

  // Validação: pelo menos o primeiro campo preenchido do tipo selecionado
  const isValid = effectiveType === 'B2B'
    ? personaB2B.job_title.trim() !== ''
    : personaB2C.profession.trim() !== ''

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-8 border border-green-500/20">
        <div className="flex items-center gap-3 mb-2 justify-center">
          <UserCircle2 className="w-6 h-6 text-green-400" />
          <h2 className="text-2xl font-bold text-white">
            Perfil do Cliente
          </h2>
        </div>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Descreva o perfil do cliente que você irá atender no roleplay
        </p>

        {/* Seletor de tipo para "Ambos" */}
        {businessType === 'Ambos' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Qual tipo de cliente você quer simular?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handlePersonaTypeChange('B2B')}
                className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  localPersonaType === 'B2B'
                    ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/20'
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                }`}
              >
                <Building className={`w-6 h-6 ${localPersonaType === 'B2B' ? 'text-green-400' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className={`font-bold ${localPersonaType === 'B2B' ? 'text-green-400' : 'text-white'}`}>B2B</p>
                  <p className="text-xs text-gray-400">Empresas</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handlePersonaTypeChange('B2C')}
                className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  localPersonaType === 'B2C'
                    ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/20'
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                }`}
              >
                <User className={`w-6 h-6 ${localPersonaType === 'B2C' ? 'text-green-400' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className={`font-bold ${localPersonaType === 'B2C' ? 'text-green-400' : 'text-white'}`}>B2C</p>
                  <p className="text-xs text-gray-400">Consumidores</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Formulário B2B */}
        {effectiveType === 'B2B' && (
          <div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cargo *
                </label>
                <input
                  type="text"
                  value={personaB2B.job_title}
                  onChange={(e) => updateB2B('job_title', e.target.value)}
                  placeholder="Ex: Gerente de Compras, CEO, Diretor de TI"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Empresa e Faturamento
                </label>
                <input
                  type="text"
                  value={personaB2B.company_type}
                  onChange={(e) => updateB2B('company_type', e.target.value)}
                  placeholder="Ex: Startup de tecnologia com faturamento de R$500k/mês"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contexto (descrição livre)
                </label>
                <textarea
                  value={personaB2B.context}
                  onChange={(e) => updateB2B('context', e.target.value)}
                  placeholder="Ex: Responsável por decisões de compra, equipe de 10 pessoas, busca inovação"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  O que busca para a empresa?
                </label>
                <textarea
                  value={personaB2B.company_goals}
                  onChange={(e) => updateB2B('company_goals', e.target.value)}
                  placeholder="Ex: Aumentar eficiência, reduzir custos, melhorar processos, escalar o negócio"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Principais desafios/dores do negócio
                </label>
                <textarea
                  value={personaB2B.business_challenges}
                  onChange={(e) => updateB2B('business_challenges', e.target.value)}
                  placeholder="Ex: Processos manuais demorados, falta de integração, dificuldade em medir resultados"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  O que a persona já sabe sobre a sua empresa e seus serviços?
                </label>
                <textarea
                  value={personaB2B.prior_knowledge}
                  onChange={(e) => updateB2B('prior_knowledge', e.target.value)}
                  placeholder="Ex: Já conhece a empresa por indicação, viu anúncio online, não sabe nada ainda"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Formulário B2C */}
        {effectiveType === 'B2C' && (
          <div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Profissão *
                </label>
                <input
                  type="text"
                  value={personaB2C.profession}
                  onChange={(e) => updateB2C('profession', e.target.value)}
                  placeholder="Ex: Professor, Médico, Estudante"
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contexto (descrição livre)
                </label>
                <textarea
                  value={personaB2C.context}
                  onChange={(e) => updateB2C('context', e.target.value)}
                  placeholder="Ex: Mãe de 2 filhos, mora em apartamento, trabalha home office"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  O que busca/valoriza?
                </label>
                <textarea
                  value={personaB2C.what_seeks}
                  onChange={(e) => updateB2C('what_seeks', e.target.value)}
                  placeholder="Ex: Praticidade, economia de tempo, produtos de qualidade, bom atendimento"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Principais dores/problemas
                </label>
                <textarea
                  value={personaB2C.main_pains}
                  onChange={(e) => updateB2C('main_pains', e.target.value)}
                  placeholder="Ex: Falta de tempo, dificuldade em encontrar produtos confiáveis, preços altos"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  O que a persona já sabe sobre a sua empresa e seus serviços?
                </label>
                <textarea
                  value={personaB2C.prior_knowledge}
                  onChange={(e) => updateB2C('prior_knowledge', e.target.value)}
                  placeholder="Ex: Já conhece a empresa por indicação, viu anúncio online, não sabe nada ainda"
                  rows={2}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
                />
              </div>
            </div>
          </div>
        )}

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
