'use client'

import { XCircle } from 'lucide-react'

export default function CadastroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.08]">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px'
        }}></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="relative bg-gradient-to-br from-gray-900/60 to-gray-800/40 backdrop-blur-xl rounded-3xl p-8 border border-red-500/30 shadow-2xl text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-4">Link Inválido</h1>
            <p className="text-gray-400 mb-6">
              Para se cadastrar, acesse o link de convite fornecido pelo gestor da sua empresa.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white transition-colors"
            >
              Voltar ao início
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
