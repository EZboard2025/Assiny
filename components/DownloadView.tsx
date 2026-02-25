'use client'

import { useState, useEffect } from 'react'
import { Monitor, Download, CheckCircle, ArrowRight, Apple, AlertTriangle, Copy, Check, Terminal } from 'lucide-react'

type Platform = 'windows' | 'mac'

export default function DownloadView() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('windows')
  const [copied, setCopied] = useState(false)

  // Auto-detect OS
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('mac')) {
      setSelectedPlatform('mac')
    }
  }, [])

  const platforms: Record<Platform, { name: string; subtitle: string; file: string; size: string; icon: React.ReactNode; steps: { number: string; title: string; description: string }[] }> = {
    windows: {
      name: 'Windows',
      subtitle: 'Windows 10 ou superior',
      file: '/downloads/Ramppy Setup 1.0.0.exe',
      size: '~98 MB',
      icon: <Monitor className="w-6 h-6 text-blue-600" />,
      steps: [
        { number: '1', title: 'Baixar', description: 'Clique no botão para baixar o instalador .exe' },
        { number: '2', title: 'Instalar', description: 'Execute o arquivo e siga as instruções do instalador' },
        { number: '3', title: 'Entrar', description: 'Abra o Ramppy e faça login com sua conta' },
      ],
    },
    mac: {
      name: 'macOS',
      subtitle: 'macOS 10.12 ou superior (Apple Silicon)',
      file: '/downloads/Ramppy-1.0.0-arm64.dmg',
      size: '~92 MB',
      icon: <Apple className="w-6 h-6 text-gray-800" />,
      steps: [
        { number: '1', title: 'Baixar', description: 'Clique no botão para baixar o arquivo .dmg' },
        { number: '2', title: 'Instalar', description: 'Abra o .dmg e arraste o Ramppy para Aplicativos' },
        { number: '3', title: 'Permitir', description: 'Na primeira vez: Ajustes → Privacidade → "Abrir Mesmo Assim"' },
        { number: '4', title: 'Entrar', description: 'Abra o Ramppy e faça login com sua conta' },
      ],
    },
  }

  const current = platforms[selectedPlatform]

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

        {/* Platform Selector */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setSelectedPlatform('windows')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 transition-all ${
              selectedPlatform === 'windows'
                ? 'border-[#0D4A3A] bg-[#0D4A3A]/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <Monitor className={`w-5 h-5 ${selectedPlatform === 'windows' ? 'text-[#0D4A3A]' : 'text-gray-400'}`} />
            <div className="text-left">
              <p className={`font-semibold text-sm ${selectedPlatform === 'windows' ? 'text-[#0D4A3A]' : 'text-gray-600'}`}>
                Windows
              </p>
              <p className="text-xs text-gray-400">Windows 10+</p>
            </div>
          </button>

          <button
            onClick={() => setSelectedPlatform('mac')}
            className={`flex-1 flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 transition-all ${
              selectedPlatform === 'mac'
                ? 'border-[#0D4A3A] bg-[#0D4A3A]/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <Apple className={`w-5 h-5 ${selectedPlatform === 'mac' ? 'text-[#0D4A3A]' : 'text-gray-400'}`} />
            <div className="text-left">
              <p className={`font-semibold text-sm ${selectedPlatform === 'mac' ? 'text-[#0D4A3A]' : 'text-gray-600'}`}>
                macOS
              </p>
              <p className="text-xs text-gray-400">Apple Silicon</p>
            </div>
          </button>
        </div>

        {/* Download Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              selectedPlatform === 'windows' ? 'bg-blue-50' : 'bg-gray-100'
            }`}>
              {current.icon}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{current.name}</h2>
              <p className="text-sm text-gray-500">{current.subtitle}</p>
            </div>
          </div>

          <a
            href={current.file}
            download
            className="w-full flex items-center justify-center gap-2 bg-[#0D4A3A] hover:bg-[#0a3d30] text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            <Download className="w-5 h-5" />
            Baixar Ramppy Desktop para {current.name}
          </a>

          <p className="text-xs text-gray-400 text-center mt-3">
            {current.file.split('/').pop()} — {current.size}
          </p>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-8">
          <h3 className="font-semibold text-gray-900 mb-6">Como instalar</h3>
          <div className="space-y-6">
            {current.steps.map((step, i) => (
              <div key={step.number} className="flex items-start gap-4">
                <div className="w-8 h-8 bg-[#0D4A3A] rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                  {step.number}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{step.title}</h4>
                  <p className="text-sm text-gray-500">{step.description}</p>
                </div>
                {i < current.steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-gray-300 mt-2 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* macOS Gatekeeper help */}
        {selectedPlatform === 'mac' && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-8 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900">Apareceu &quot;não pode ser aberto&quot;?</h3>
                <p className="text-sm text-amber-700 mt-1">
                  O macOS bloqueia apps baixados da internet que não são da App Store. Siga <strong>um</strong> dos métodos abaixo:
                </p>
              </div>
            </div>

            {/* Method 1: System Settings */}
            <div className="bg-white rounded-xl border border-amber-200 p-4 mb-3">
              <p className="text-sm font-semibold text-amber-900 mb-1">Método 1 — Ajustes do Sistema</p>
              <ol className="text-sm text-amber-700 list-decimal list-inside space-y-1">
                <li>Tente abrir o Ramppy normalmente (vai aparecer o aviso)</li>
                <li>Clique em <strong>&quot;OK&quot;</strong> ou <strong>&quot;Cancelar&quot;</strong></li>
                <li>Vá em <strong>Ajustes do Sistema → Privacidade e Segurança</strong></li>
                <li>Role até <strong>Segurança</strong> — aparecerá &quot;Ramppy foi bloqueado&quot;</li>
                <li>Clique em <strong>&quot;Abrir Mesmo Assim&quot;</strong> e digite sua senha</li>
              </ol>
            </div>

            {/* Method 2: Terminal */}
            <div className="bg-white rounded-xl border border-amber-200 p-4">
              <p className="text-sm font-semibold text-amber-900 mb-2">Método 2 — Terminal (mais rápido)</p>
              <p className="text-xs text-amber-700 mb-2">Abra o Terminal e cole o comando abaixo (vai pedir sua senha do Mac):</p>
              <div className="relative">
                <div className="flex items-center gap-2 bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-sm overflow-x-auto">
                  <Terminal className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <code>sudo xattr -r -c /Applications/Ramppy.app && open /Applications/Ramppy.app</code>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('sudo xattr -r -c /Applications/Ramppy.app && open /Applications/Ramppy.app')
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                  title="Copiar comando"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-300" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-amber-600 mt-3">
              Só precisa fazer uma vez. Nas próximas vezes o app abre normalmente.
            </p>
          </div>
        )}

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
