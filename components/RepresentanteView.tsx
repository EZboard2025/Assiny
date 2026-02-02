'use client'

import { useState, useEffect } from 'react'
import { Briefcase, Building2, DollarSign, TrendingUp, LogOut, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface RepresentanteViewProps {
  userName: string | null
  onLogout: () => void
}

export default function RepresentanteView({ userName, onLogout }: RepresentanteViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/images/logotipo-nome.png"
              alt="Ramppy"
              className="h-8 object-contain"
            />
            <div className="h-6 w-px bg-gray-300" />
            <span className="text-sm font-medium text-gray-600">Portal do Representante</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Olá, <span className="font-semibold text-gray-900">{userName || 'Representante'}</span>
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-2xl mb-6">
            <Briefcase className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Bem-vindo ao Portal do Representante
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Acompanhe suas empresas parceiras, comissões e saques.
            Em breve, todas as funcionalidades estarão disponíveis aqui.
          </p>
        </div>

        {/* Coming Soon Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Empresas Vinculadas */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Empresas Vinculadas</h3>
            <p className="text-sm text-gray-600 mb-4">
              Visualize todas as empresas que você indicou ou está monitorando.
            </p>
            <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
              <span className="px-2 py-1 bg-blue-50 rounded-full">Em breve</span>
            </div>
          </div>

          {/* Comissões */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Comissões</h3>
            <p className="text-sm text-gray-600 mb-4">
              Acompanhe suas comissões acumuladas e histórico de ganhos.
            </p>
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <span className="px-2 py-1 bg-green-50 rounded-full">Em breve</span>
            </div>
          </div>

          {/* Saques */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Saques</h3>
            <p className="text-sm text-gray-600 mb-4">
              Solicite saques e acompanhe o status dos seus pagamentos.
            </p>
            <div className="flex items-center gap-2 text-sm text-purple-600 font-medium">
              <span className="px-2 py-1 bg-purple-50 rounded-full">Em breve</span>
            </div>
          </div>
        </div>

        {/* Stats Preview (placeholder) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-3">
            <Users className="w-6 h-6 text-gray-400" />
            Resumo
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-gray-300">--</p>
              <p className="text-sm text-gray-500 mt-1">Empresas ativas</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-gray-300">--</p>
              <p className="text-sm text-gray-500 mt-1">Vendedores treinando</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-gray-300">R$ --</p>
              <p className="text-sm text-gray-500 mt-1">Comissão disponível</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-gray-300">R$ --</p>
              <p className="text-sm text-gray-500 mt-1">Total sacado</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-900 mb-1">Portal em construção</h3>
              <p className="text-sm text-green-700">
                Estamos desenvolvendo o portal completo para representantes. Em breve você poderá
                acompanhar todas as empresas que indicou, visualizar suas comissões em tempo real
                e solicitar saques diretamente por aqui.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <p className="text-center text-sm text-gray-500">
            Ramppy - Plataforma de Treinamento de Vendas
          </p>
        </div>
      </footer>
    </div>
  )
}
