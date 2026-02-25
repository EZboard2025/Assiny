'use client'

import { Monitor, Download, CheckCircle, ArrowRight } from 'lucide-react'

export default function DownloadView() {
  const installerUrl = '/downloads/Ramppy Setup 1.0.0.exe'

  const steps = [
    { number: '1', title: 'Baixar', description: 'Clique no botão abaixo para baixar o instalador' },
    { number: '2', title: 'Instalar', description: 'Execute o arquivo .exe e siga as instruções' },
    { number: '3', title: 'Entrar', description: 'Abra o Ramppy e faça login com sua conta' },
  ]

  return (
    <div className="py-8 pl-20 pr-6 relative z-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#0D4A3A] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ramppy Desktop</h1>
          <p className="text-gray-500">
            Assistente IA flutuante com visão de tela — sempre ao seu lado enquanto trabalha.
          </p>
        </div>

        {/* Download Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Windows</h2>
              <p className="text-sm text-gray-500">Windows 10 ou superior</p>
            </div>
          </div>

          <a
            href={installerUrl}
            download
            className="w-full flex items-center justify-center gap-2 bg-[#0D4A3A] hover:bg-[#0a3d30] text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            <Download className="w-5 h-5" />
            Baixar Ramppy Desktop
          </a>

          <p className="text-xs text-gray-400 text-center mt-3">
            Ramppy Setup 1.0.0.exe — ~98 MB
          </p>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-8">
          <h3 className="font-semibold text-gray-900 mb-6">Como instalar</h3>
          <div className="space-y-6">
            {steps.map((step, i) => (
              <div key={step.number} className="flex items-start gap-4">
                <div className="w-8 h-8 bg-[#0D4A3A] rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                  {step.number}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{step.title}</h4>
                  <p className="text-sm text-gray-500">{step.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-gray-300 mt-2 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h3 className="font-semibold text-gray-900 mb-4">O que o app desktop faz</h3>
          <div className="space-y-3">
            {[
              'Assistente IA flutuante que vê sua tela em tempo real',
              'Atalho rápido para perguntas sem sair do que está fazendo',
              'Minimiza para a bandeja do sistema — sempre acessível',
              'Contexto visual automático em cada mensagem',
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-600">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
