'use client'

import { Building2, ArrowRight, ArrowLeft, CheckCircle2, Briefcase, FileText, Package, Star } from 'lucide-react'
import { CompanyInfo } from './TestRoleplayPage'
import { useState } from 'react'

interface CompanyInfoStepProps {
  companyInfo: CompanyInfo
  onChange: (info: CompanyInfo) => void
  onNext: () => void
  onBack: () => void
}

export default function CompanyInfoStep({
  companyInfo,
  onChange,
  onNext,
  onBack
}: CompanyInfoStepProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const updateField = (field: keyof CompanyInfo, value: string) => {
    onChange({ ...companyInfo, [field]: value })
  }

  const isValid = companyInfo.nome.trim() !== ''

  const isFieldComplete = (field: keyof CompanyInfo) => {
    return companyInfo[field].trim().length > 2
  }

  const fields = [
    { key: 'nome' as const, label: 'Nome da empresa', icon: Briefcase, placeholder: 'Ex: Tech Solutions', required: true, type: 'input' },
    { key: 'descricao' as const, label: 'Descrição do negócio', icon: FileText, placeholder: 'Breve descrição do que sua empresa faz...', required: false, type: 'textarea' },
    { key: 'produtos_servicos' as const, label: 'Produtos ou Serviços', icon: Package, placeholder: 'Quais produtos ou serviços vocês oferecem?', required: false, type: 'textarea' },
    { key: 'diferenciais' as const, label: 'Diferenciais competitivos', icon: Star, placeholder: 'O que diferencia vocês da concorrência?', required: false, type: 'textarea' }
  ]

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
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -inset-1 bg-green-500/20 rounded-2xl blur-md -z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center">
              Sua Empresa
            </h2>
            <p className="text-gray-400 text-center mt-2 text-sm">
              Conte sobre a empresa que você representa nas vendas
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-2 mb-8">
            {fields.map((field) => (
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

          <div className="space-y-5">
            {fields.map((field) => {
              const Icon = field.icon
              const isFocused = focusedField === field.key

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
                      <Icon className={`absolute left-4 top-4 w-5 h-5 transition-colors duration-300 ${isFocused ? 'text-green-400' : 'text-gray-500'}`} />
                      {field.type === 'input' ? (
                        <input
                          type="text"
                          value={companyInfo[field.key]}
                          onChange={(e) => updateField(field.key, e.target.value)}
                          onFocus={() => setFocusedField(field.key)}
                          onBlur={() => setFocusedField(null)}
                          placeholder={field.placeholder}
                          className="w-full pl-12 pr-4 py-3.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300"
                        />
                      ) : (
                        <textarea
                          value={companyInfo[field.key]}
                          onChange={(e) => updateField(field.key, e.target.value)}
                          onFocus={() => setFocusedField(field.key)}
                          onBlur={() => setFocusedField(null)}
                          placeholder={field.placeholder}
                          rows={3}
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
