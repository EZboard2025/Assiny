'use client'

import { Building2, ArrowRight, ArrowLeft } from 'lucide-react'
import { CompanyInfo } from './TestRoleplayPage'

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
  const updateField = (field: keyof CompanyInfo, value: string) => {
    onChange({ ...companyInfo, [field]: value })
  }

  const isValid = companyInfo.nome.trim() !== ''

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-gray-900/60 backdrop-blur-md rounded-2xl p-8 border border-green-500/20">
        <div className="flex items-center gap-3 mb-2 justify-center">
          <Building2 className="w-6 h-6 text-green-400" />
          <h2 className="text-2xl font-bold text-white">
            Sua Empresa
          </h2>
        </div>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Conte sobre a empresa que você representa nas vendas
        </p>

        <div className="space-y-5">
          {/* Nome da empresa */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nome da empresa *
            </label>
            <input
              type="text"
              value={companyInfo.nome}
              onChange={(e) => updateField('nome', e.target.value)}
              placeholder="Ex: Tech Solutions"
              className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descrição do negócio
            </label>
            <textarea
              value={companyInfo.descricao}
              onChange={(e) => updateField('descricao', e.target.value)}
              placeholder="Breve descrição do que sua empresa faz..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
            />
          </div>

          {/* Produtos/Serviços */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Produtos ou Serviços
            </label>
            <textarea
              value={companyInfo.produtos_servicos}
              onChange={(e) => updateField('produtos_servicos', e.target.value)}
              placeholder="Quais produtos ou serviços vocês oferecem?"
              rows={3}
              className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
            />
          </div>

          {/* Diferenciais */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Diferenciais competitivos
            </label>
            <textarea
              value={companyInfo.diferenciais}
              onChange={(e) => updateField('diferenciais', e.target.value)}
              placeholder="O que diferencia vocês da concorrência?"
              rows={3}
              className="w-full px-4 py-3 bg-gray-800/50 border border-green-500/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/40 transition-colors resize-none"
            />
          </div>
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
