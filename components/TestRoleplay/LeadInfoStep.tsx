'use client'

import { User, Mail, Phone, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { useState } from 'react'

interface LeadInfoStepProps {
  name: string
  email: string
  phone: string
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onNext: () => void
}

export default function LeadInfoStep({
  name,
  email,
  phone,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onNext
}: LeadInfoStepProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const isValid = name.trim() && email.trim() && phone.trim()

  // Validação básica de email
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // Formatação de telefone brasileiro
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    onPhoneChange(formatted)
  }

  const canProceed = isValid && isEmailValid

  const isFieldComplete = (field: string) => {
    switch (field) {
      case 'name': return name.trim().length > 2
      case 'email': return email.trim() && isEmailValid
      case 'phone': return phone.replace(/\D/g, '').length >= 10
      default: return false
    }
  }

  return (
    <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-green-500/20 via-emerald-500/10 to-green-500/20 rounded-3xl blur-xl opacity-60" />

        <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-2xl p-8 border border-green-500/30 shadow-2xl">
          {/* Header with icon */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -inset-1 bg-green-500/20 rounded-2xl blur-md -z-10" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center">
              Seus Dados
            </h2>
            <p className="text-gray-400 text-center mt-2 text-sm">
              Preencha seus dados para começar o teste
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex gap-2 mb-8">
            {['name', 'email', 'phone'].map((field) => (
              <div
                key={field}
                className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                  isFieldComplete(field)
                    ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                    : 'bg-gray-700/50'
                }`}
              />
            ))}
          </div>

          <div className="space-y-5">
            {/* Nome */}
            <div className={`transition-all duration-300 ${focusedField === 'name' ? 'scale-[1.02]' : ''}`}>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                Nome completo
                {isFieldComplete('name') && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />
                )}
              </label>
              <div className="relative group">
                <div className={`absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur transition-opacity duration-300 ${focusedField === 'name' ? 'opacity-100' : 'opacity-0'}`} />
                <div className="relative">
                  <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'name' ? 'text-green-400' : 'text-gray-500'}`} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Seu nome"
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300"
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className={`transition-all duration-300 ${focusedField === 'email' ? 'scale-[1.02]' : ''}`}>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                Email
                {isFieldComplete('email') && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />
                )}
              </label>
              <div className="relative group">
                <div className={`absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur transition-opacity duration-300 ${focusedField === 'email' ? 'opacity-100' : 'opacity-0'}`} />
                <div className="relative">
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'email' ? 'text-green-400' : 'text-gray-500'}`} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="seu@email.com"
                    className={`w-full pl-12 pr-4 py-3.5 bg-gray-800/60 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:bg-gray-800/80 transition-all duration-300 ${
                      email && !isEmailValid
                        ? 'border-red-500/50 focus:border-red-500/70'
                        : 'border-gray-700/50 focus:border-green-500/50'
                    }`}
                  />
                </div>
              </div>
              {email && !isEmailValid && (
                <p className="mt-2 text-xs text-red-400 flex items-center gap-1 animate-in slide-in-from-top-2">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  Digite um email válido
                </p>
              )}
            </div>

            {/* Telefone */}
            <div className={`transition-all duration-300 ${focusedField === 'phone' ? 'scale-[1.02]' : ''}`}>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                Telefone
                {isFieldComplete('phone') && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 animate-in zoom-in duration-300" />
                )}
              </label>
              <div className="relative group">
                <div className={`absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur transition-opacity duration-300 ${focusedField === 'phone' ? 'opacity-100' : 'opacity-0'}`} />
                <div className="relative">
                  <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${focusedField === 'phone' ? 'text-green-400' : 'text-gray-500'}`} />
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:bg-gray-800/80 transition-all duration-300"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onNext}
            disabled={!canProceed}
            className="relative w-full mt-8 py-4 rounded-xl font-bold text-white overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Button background */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-500 transition-transform duration-300 group-hover:scale-105 group-disabled:scale-100" />

            {/* Shine effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </div>

            {/* Button content */}
            <span className="relative flex items-center justify-center gap-2">
              Continuar
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1 group-disabled:translate-x-0" />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
