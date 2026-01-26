'use client'

import { Settings, AlertTriangle, CheckCircle, Building2, Users, MessageSquareWarning, ArrowRight, Loader2 } from 'lucide-react'

interface ConfigurationRequiredProps {
  isLoading: boolean
  missingItems: string[]
  details: {
    hasCompanyData: boolean
    hasPersonas: boolean
    hasObjections: boolean
  }
  onOpenConfig: () => void
}

export default function ConfigurationRequired({
  isLoading,
  missingItems,
  details,
  onOpenConfig
}: ConfigurationRequiredProps) {
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verificando configuração...</p>
        </div>
      </div>
    )
  }

  const configItems = [
    {
      key: 'companyData',
      label: 'Dados da Empresa',
      description: 'Nome, descrição e informações do negócio',
      icon: Building2,
      completed: details.hasCompanyData
    },
    {
      key: 'personas',
      label: 'Personas',
      description: 'Pelo menos uma persona de cliente',
      icon: Users,
      completed: details.hasPersonas
    },
    {
      key: 'objections',
      label: 'Objeções',
      description: 'Pelo menos uma objeção com rebuttals',
      icon: MessageSquareWarning,
      completed: details.hasObjections
    }
  ]

  const completedCount = configItems.filter(item => item.completed).length
  const progress = (completedCount / configItems.length) * 100

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      {/* Starfield background */}
      <div className="fixed inset-0 z-0">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      <div className="relative z-10 max-w-lg w-full">
        {/* Card principal */}
        <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-3xl border border-green-500/30 shadow-2xl shadow-green-500/10 overflow-hidden">
          {/* Header com ícone */}
          <div className="relative p-8 pb-6 text-center">
            {/* Glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-green-500/20 blur-3xl" />

            <div className="relative">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-500/20 border border-green-500/40 flex items-center justify-center">
                <Settings className="w-10 h-10 text-green-400" />
              </div>

              <h1 className="text-2xl font-bold text-white mb-2">
                Configure sua Empresa
              </h1>
              <p className="text-gray-400 text-sm">
                Complete a configuração para liberar todas as funcionalidades
              </p>
            </div>
          </div>

          {/* Barra de progresso */}
          <div className="px-8 pb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-400">Progresso</span>
              <span className="text-green-400 font-medium">{completedCount}/{configItems.length}</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Lista de itens */}
          <div className="px-8 pb-6 space-y-3">
            {configItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.key}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    item.completed
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-gray-800/50 border-gray-700/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.completed
                      ? 'bg-green-500/20'
                      : 'bg-gray-700/50'
                  }`}>
                    {item.completed ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <Icon className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${
                      item.completed ? 'text-green-400' : 'text-white'
                    }`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.description}
                    </p>
                  </div>
                  {item.completed && (
                    <span className="text-xs text-green-400 font-medium px-2 py-1 bg-green-500/10 rounded-lg">
                      OK
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Aviso */}
          <div className="mx-8 mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-400 font-medium">
                  Configuração necessária
                </p>
                <p className="text-xs text-yellow-400/70 mt-1">
                  O treinamento de roleplay, chat IA e outras funcionalidades ficam disponíveis após completar a configuração.
                </p>
              </div>
            </div>
          </div>

          {/* Botão de ação */}
          <div className="p-8 pt-0">
            <button
              onClick={onOpenConfig}
              className="w-full py-4 bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 hover:from-green-500 hover:via-emerald-500 hover:to-green-500 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:scale-[1.02]"
            >
              <Settings className="w-5 h-5" />
              Abrir Hub de Configuração
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Texto de ajuda */}
        <p className="text-center text-gray-500 text-xs mt-6">
          Precisa de ajuda? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  )
}
