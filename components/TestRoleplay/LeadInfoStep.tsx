'use client'

import { User, Mail, Phone, ArrowRight } from 'lucide-react'

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

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-8 border border-green-500/20">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Seus Dados
        </h2>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Preencha seus dados para começar o teste
        </p>

        <div className="space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nome completo *
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Seu nome"
                className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email *
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="seu@email.com"
                className={`w-full pl-12 pr-4 py-3 bg-gray-800/50 border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  email && !isEmailValid
                    ? 'border-red-500/50 focus:border-red-500/70'
                    : 'border-green-500/20 focus:border-green-500/40'
                }`}
              />
            </div>
            {email && !isEmailValid && (
              <p className="mt-1 text-xs text-red-400">Digite um email válido</p>
            )}
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Telefone *
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors"
              />
            </div>
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full mt-8 py-3.5 bg-gradient-to-r from-green-600 to-green-500 rounded-xl font-bold text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none flex items-center justify-center gap-2"
        >
          Continuar
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
