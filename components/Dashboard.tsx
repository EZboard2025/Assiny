'use client'

import { useState } from 'react'
import Logo from './Logo'
import ChatInterface from './ChatInterface'
import ConfigHub from './ConfigHub'
import { Settings, LogOut, Menu, X } from 'lucide-react'

interface DashboardProps {
  onLogout: () => void
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [showConfigHub, setShowConfigHub] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Logo />
              <span className="text-xl font-bold text-gray-900">Assiny</span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={() => setShowConfigHub(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Hub de Configuração
              </button>
              <button
                onClick={onLogout}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden text-gray-700"
            >
              {showMobileMenu ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {showMobileMenu && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowConfigHub(true)
                    setShowMobileMenu(false)
                  }}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Hub de Configuração
                </button>
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <ChatInterface />
      </main>

      {/* Config Hub Modal */}
      {showConfigHub && (
        <ConfigHub onClose={() => setShowConfigHub(false)} />
      )}
    </div>
  )
}