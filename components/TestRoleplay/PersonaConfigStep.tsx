'use client'

import { useState } from 'react'
import { UserCircle2, ArrowRight, ArrowLeft, Building, User, CheckCircle2, Briefcase, Building2, FileText, Target, AlertCircle, Brain } from 'lucide-react'
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
  const [focusedField, setFocusedField] = useState<string | null>(null)
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

  const b2bFields = [
    { key: 'job_title' as const, label: 'Cargo', icon: Briefcase, placeholder: 'Ex: Gerente de Compras, CEO, Diretor de TI', required: true, type: 'input' },
    { key: 'company_type' as const, label: 'Tipo de Empresa e Faturamento', icon: Building2, placeholder: 'Ex: Startup de tecnologia com faturamento de R$500k/mês', required: false, type: 'input' },
    { key: 'context' as const, label: 'Contexto (descrição livre)', icon: FileText, placeholder: 'Ex: Responsável por decisões de compra, equipe de 10 pessoas', required: false, type: 'textarea' },
    { key: 'company_goals' as const, label: 'O que busca para a empresa?', icon: Target, placeholder: 'Ex: Aumentar eficiência, reduzir custos, melhorar processos', required: false, type: 'textarea' },
    { key: 'business_challenges' as const, label: 'Principais desafios/dores', icon: AlertCircle, placeholder: 'Ex: Processos manuais demorados, falta de integração', required: false, type: 'textarea' },
    { key: 'prior_knowledge' as const, label: 'O que já sabe sobre sua empresa?', icon: Brain, placeholder: 'Ex: Já conhece por indicação, viu anúncio online', required: false, type: 'textarea' }
  ]

  const b2cFields = [
    { key: 'profession' as const, label: 'Profissão', icon: Briefcase, placeholder: 'Ex: Professor, Médico, Estudante', required: true, type: 'input' },
    { key: 'context' as const, label: 'Contexto (descrição livre)', icon: FileText, placeholder: 'Ex: Mãe de 2 filhos, mora em apartamento, trabalha home office', required: false, type: 'textarea' },
    { key: 'what_seeks' as const, label: 'O que busca/valoriza?', icon: Target, placeholder: 'Ex: Praticidade, economia de tempo, produtos de qualidade', required: false, type: 'textarea' },
    { key: 'main_pains' as const, label: 'Principais dores/problemas', icon: AlertCircle, placeholder: 'Ex: Falta de tempo, dificuldade em encontrar produtos confiáveis', required: false, type: 'textarea' },
    { key: 'prior_knowledge' as const, label: 'O que já sabe sobre sua empresa?', icon: Brain, placeholder: 'Ex: Já conhece por indicação, viu anúncio online', required: false, type: 'textarea' }
  ]

  const currentFields = effectiveType === 'B2B' ? b2bFields : b2cFields
  const currentPersona = effectiveType === 'B2B' ? personaB2B : personaB2C

  const isFieldComplete = (field: string) => {
    const value = (currentPersona as unknown as Record<string, string>)[field]
    return value && value.trim().length > 2
  }

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
                <UserCircle2 className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -inset-1 bg-green-500/20 rounded-2xl blur-md -z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center">
              Perfil do Cliente
            </h2>
            <p className="text-gray-400 text-center mt-2 text-sm">
              Descreva o perfil do cliente que você irá atender no roleplay
            </p>
          </div>

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
                      ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/20 scale-[1.02]'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:scale-[1.01]'
                  }`}
                >
                  <Building className={`w-6 h-6 transition-colors duration-300 ${localPersonaType === 'B2B' ? 'text-green-400' : 'text-gray-500'}`} />
                  <div className="text-left">
                    <p className={`font-bold transition-colors duration-300 ${localPersonaType === 'B2B' ? 'text-green-400' : 'text-white'}`}>B2B</p>
                    <p className="text-xs text-gray-400">Empresas</p>
                  </div>
                  {localPersonaType === 'B2B' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto animate-in zoom-in duration-300" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handlePersonaTypeChange('B2C')}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                    localPersonaType === 'B2C'
                      ? 'bg-green-500/10 border-green-500 shadow-lg shadow-green-500/20 scale-[1.02]'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:scale-[1.01]'
                  }`}
                >
                  <User className={`w-6 h-6 transition-colors duration-300 ${localPersonaType === 'B2C' ? 'text-green-400' : 'text-gray-500'}`} />
                  <div className="text-left">
                    <p className={`font-bold transition-colors duration-300 ${localPersonaType === 'B2C' ? 'text-green-400' : 'text-white'}`}>B2C</p>
                    <p className="text-xs text-gray-400">Consumidores</p>
                  </div>
                  {localPersonaType === 'B2C' && (
                    <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto animate-in zoom-in duration-300" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Progress indicator */}
          <div className="flex gap-1 mb-6">
            {currentFields.map((field) => (
              <div
                key={field.key}
                className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                  isFieldComplete(field.key)
                    ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                    : 'bg-gray-700/50'
                }`}
              />
            ))}
          </div>

          {/* Formulário dinâmico */}
          <div className="space-y-4">
            {currentFields.map((field) => {
              const Icon = field.icon
              const isFocused = focusedField === field.key
              const value = (currentPersona as unknown as Record<string, string>)[field.key] || ''

              return (
                <div
                  key={field.key}
                  className={`transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                    {field.label} {field.required && '*'}
                    {isFieldComplete(field.key) && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />
                    )}
                  </label>
                  <div className="relative group">
                    <div className={`absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-0'}`} />
                    <div className="relative">
                      <Icon className={`absolute left-4 ${field.type === 'textarea' ? 'top-4' : 'top-1/2 -translate-y-1/2'} w-5 h-5 transition-colors duration-300 ${isFocused ? 'text-green-400' : 'text-gray-500'}`} />
                      {field.type === 'input' ? (
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => effectiveType === 'B2B' ? updateB2B(field.key as keyof PersonaB2B, e.target.value) : updateB2C(field.key as keyof PersonaB2C, e.target.value)}
                          onFocus={() => setFocusedField(field.key)}
                          onBlur={() => setFocusedField(null)}
                          placeholder={field.placeholder}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300"
                        />
                      ) : (
                        <textarea
                          value={value}
                          onChange={(e) => effectiveType === 'B2B' ? updateB2B(field.key as keyof PersonaB2B, e.target.value) : updateB2C(field.key as keyof PersonaB2C, e.target.value)}
                          onFocus={() => setFocusedField(field.key)}
                          onBlur={() => setFocusedField(null)}
                          placeholder={field.placeholder}
                          rows={2}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300 resize-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
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
              disabled={!isValid}
              className="relative flex-1 py-3.5 rounded-xl font-bold text-white overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-500 transition-transform duration-300 group-hover:scale-105 group-disabled:scale-100" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-disabled:hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </div>
              <span className="relative flex items-center justify-center gap-2">
                Continuar
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1 group-disabled:translate-x-0" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
