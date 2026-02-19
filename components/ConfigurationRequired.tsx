'use client'

import { Settings, AlertTriangle, CheckCircle, Building2, Users, MessageSquareWarning, ArrowRight, Loader2, LogOut } from 'lucide-react'

interface ConfigurationRequiredProps {
  isLoading: boolean
  missingItems: string[]
  details: {
    hasCompanyData: boolean
    hasPersonas: boolean
    hasObjections: boolean
  }
  onOpenConfig: () => void
  onLogout?: () => void
}

export default function ConfigurationRequired({
  isLoading,
  missingItems,
  details,
  onOpenConfig,
  onLogout
}: ConfigurationRequiredProps) {
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[80] bg-white/95 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Verificando configuração...</p>
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
    <div className="fixed inset-0 z-[80] bg-white/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-100 rounded-full opacity-50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-50 rounded-full opacity-50 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg w-full">
        {/* Card principal */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
          {/* Botão de logout */}
          {onLogout && (
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors border border-gray-200 hover:border-red-200"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          )}

          {/* Header com ícone */}
          <div className="p-8 pb-6 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center">
              <Settings className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Configure sua Empresa
            </h1>
            <p className="text-gray-500 text-sm">
              Complete a configuração para liberar todas as funcionalidades
            </p>
          </div>

          {/* Barra de progresso */}
          <div className="px-8 pb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Progresso</span>
              <span className="text-green-600 font-medium">{completedCount}/{configItems.length}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
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
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.completed
                      ? 'bg-green-100'
                      : 'bg-gray-100'
                  }`}>
                    {item.completed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Icon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${
                      item.completed ? 'text-green-700' : 'text-gray-900'
                    }`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.description}
                    </p>
                  </div>
                  {item.completed && (
                    <span className="text-xs text-green-600 font-medium px-2 py-1 bg-green-100 rounded-lg">
                      OK
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Aviso */}
          <div className="mx-8 mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-700 font-medium">
                  Configuração necessária
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  O treinamento de roleplay, chat IA e outras funcionalidades ficam disponíveis após completar a configuração.
                </p>
              </div>
            </div>
          </div>

          {/* Botão de ação */}
          <div className="p-8 pt-0">
            <button
              onClick={onOpenConfig}
              className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-3 shadow-lg shadow-green-500/20 hover:shadow-green-500/30"
            >
              <Settings className="w-5 h-5" />
              Abrir Hub de Configuração
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Texto de ajuda */}
        <p className="text-center text-gray-400 text-xs mt-6">
          Precisa de ajuda? Entre em contato com o suporte.
        </p>
      </div>
    </div>
  )
}
