'use client'

import { useState, useEffect } from 'react'
import Logo from './Logo'
import { ArrowRight, GraduationCap, Target, TrendingUp, Award, ChevronRight } from 'lucide-react'

interface LandingPageProps {
  onOpenLogin: () => void
}

export default function LandingPage({ onOpenLogin }: LandingPageProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Logo />
              <span className="text-xl font-bold text-gray-900">Assiny Training</span>
            </div>
            <button
              onClick={onOpenLogin}
              className="px-6 py-2 text-white btn-gradient rounded-lg font-medium hover:scale-105 transition-transform"
            >
              Acessar Plataforma
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className={`space-y-6 ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900">
              Centro de <span className="text-gradient">Treinamento</span>
              <br />
              para Vendedores
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Desenvolva suas habilidades de vendas com nosso assistente de IA
              especializado em metodologias e estratégias da Assiny
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
              <button
                onClick={onOpenLogin}
                className="px-8 py-4 text-white btn-gradient rounded-xl font-semibold text-lg flex items-center gap-2 hover:scale-105 transition-transform"
              >
                Iniciar Treinamento
                <ArrowRight className="w-5 h-5" />
              </button>
              <button className="px-8 py-4 bg-white text-gray-800 rounded-xl font-semibold text-lg border-2 border-gray-200 hover:bg-gray-50 transition-colors">
                Ver Módulos
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Recursos do <span className="text-gradient">Treinamento</span>
            </h2>
            <p className="text-xl text-gray-600">
              Ferramentas essenciais para o sucesso em vendas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: GraduationCap,
                title: 'Módulos Interativos',
                description: 'Aprenda técnicas de vendas com exercícios práticos'
              },
              {
                icon: Target,
                title: 'Metas e Objetivos',
                description: 'Acompanhe seu progresso e conquiste certificações'
              },
              {
                icon: TrendingUp,
                title: 'Análise de Performance',
                description: 'Receba feedback personalizado do seu desempenho'
              },
              {
                icon: Award,
                title: 'Certificações',
                description: 'Obtenha certificados ao completar os módulos'
              }
            ].map((feature, index) => (
              <div
                key={index}
                className={`bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow ${
                  mounted ? 'animate-slide-up' : 'opacity-0'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary to-primary-dark">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Pronto para evoluir suas vendas?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Junte-se ao time de vendedores de alta performance da Assiny
          </p>
          <button
            onClick={onOpenLogin}
            className="px-8 py-4 bg-white text-primary rounded-xl font-semibold text-lg flex items-center gap-2 mx-auto hover:scale-105 transition-transform"
          >
            Começar Treinamento
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Logo className="w-8 h-8" />
            <span className="text-white font-medium">Assiny Training</span>
          </div>
          <p className="text-gray-400 text-sm">
            © 2024 Assiny. Plataforma Interna de Treinamento.
          </p>
        </div>
      </footer>
    </div>
  )
}