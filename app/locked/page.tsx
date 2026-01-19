'use client'

import { Lock, Mail } from 'lucide-react'

export default function LockedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-6">
      <div className="max-w-2xl w-full">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 border border-orange-500/30 shadow-2xl">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-orange-500/20 rounded-full mb-6">
              <Lock className="w-12 h-12 text-orange-400" />
            </div>

            <h1 className="text-4xl font-bold text-white mb-4">
              Acesso Bloqueado
            </h1>

            <p className="text-xl text-gray-300 mb-8">
              O acesso a esta empresa está temporariamente bloqueado.
            </p>

            <div className="bg-orange-900/20 border border-orange-500/30 rounded-2xl p-6 mb-8">
              <p className="text-gray-300 leading-relaxed">
                Isso geralmente acontece quando o período de teste gratuito terminou ou quando há pendências administrativas.
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-gray-400">
                Para reativar o acesso, entre em contato com o suporte:
              </p>

              <a
                href="mailto:suporte@ramppy.site"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-semibold rounded-2xl transition-all shadow-lg hover:shadow-orange-500/25"
              >
                <Mail className="w-5 h-5" />
                Entrar em Contato
              </a>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-700">
              <p className="text-sm text-gray-500">
                Se você acredita que isso é um erro, por favor entre em contato com nosso suporte.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
