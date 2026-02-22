'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { MoreHorizontal, X, Loader2, Check, ExternalLink } from 'lucide-react'

interface Connection {
  key: string
  name: string
  icon: React.ReactNode
  connected: boolean
  description: string
}

export default function ConnectionsCard() {
  const [googleConnected, setGoogleConnected] = useState(false)
  const [whatsappConnected, setWhatsappConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    checkConnections()
  }, [])

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null
    return { Authorization: `Bearer ${session.access_token}` }
  }

  const checkConnections = async () => {
    try {
      const headers = await getAuthHeaders()
      if (!headers) { setLoading(false); return }

      const [calRes, waRes] = await Promise.all([
        fetch('/api/calendar/status', { headers }).then(r => r.json()).catch(() => ({ connected: false })),
        fetch('/api/whatsapp/status', { headers }).then(r => r.json()).catch(() => ({ status: 'disconnected' })),
      ])

      setGoogleConnected(calRes.connected === true)
      setWhatsappConnected(waRes.status === 'connected')
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  const handleConnectGoogle = async () => {
    try {
      setActionLoading('google')
      const headers = await getAuthHeaders()
      if (!headers) return

      const res = await fetch('/api/calendar/connect', { headers })
      const data = await res.json()

      if (data.authUrl) {
        window.open(data.authUrl, '_blank')
        // Poll for connection after OAuth
        const interval = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/calendar/status', { headers })
            const statusData = await statusRes.json()
            if (statusData.connected) {
              setGoogleConnected(true)
              clearInterval(interval)
              setActionLoading(null)
            }
          } catch {}
        }, 3000)
        // Stop polling after 2 minutes
        setTimeout(() => { clearInterval(interval); setActionLoading(null) }, 120000)
      }
    } catch {
      setActionLoading(null)
    }
  }

  const handleDisconnectGoogle = async () => {
    try {
      setActionLoading('google')
      const headers = await getAuthHeaders()
      if (!headers) return

      const res = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers,
      })
      if (res.ok) {
        setGoogleConnected(false)
      }
    } catch {
      // Silently fail
    } finally {
      setActionLoading(null)
    }
  }

  const activeCount = (googleConnected ? 1 : 0) + (whatsappConnected ? 1 : 0)

  const connections: Connection[] = [
    {
      key: 'google',
      name: 'Google Calendar',
      description: 'Analise de reunioes Meet',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      connected: googleConnected,
    },
    {
      key: 'whatsapp',
      name: 'WhatsApp',
      description: 'Follow-up e copiloto IA',
      icon: (
        <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      connected: whatsappConnected,
    },
  ]

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 bg-gray-200 rounded w-28" />
          <div className="w-6 h-6 bg-gray-100 rounded" />
        </div>
        <div className="h-3 bg-gray-100 rounded w-36 mb-4" />
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full" />
          <div className="w-10 h-10 bg-gray-100 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:border-green-200 hover:shadow-md transition-all cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-gray-900">Conexoes</h3>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {activeCount} {activeCount === 1 ? 'Conexao Ativa' : 'Conexoes Ativas'}
        </p>

        <div className="flex items-center gap-3">
          {connections.map(c => (
            <div
              key={c.key}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                c.connected ? 'bg-gray-50 ring-2 ring-green-200' : 'bg-gray-100'
              }`}
              title={c.name}
            >
              <div className={c.connected ? '' : 'opacity-40'}>
                {c.icon}
              </div>
            </div>
          ))}

          {/* Add more hint */}
          <div className="w-10 h-10 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
            <span className="text-lg leading-none">+</span>
          </div>
        </div>
      </div>

      {/* Connections Manager Modal (portal to body) */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Gerenciar Conexoes</h2>
                <p className="text-sm text-gray-500 mt-0.5">{activeCount} de {connections.length} ativas</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Connections List */}
            <div className="p-6 space-y-3">
              {connections.map(c => (
                <div
                  key={c.key}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    c.connected ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                      {c.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {c.connected && (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <Check className="w-3 h-3" />
                        Conectado
                      </span>
                    )}

                    {c.key === 'google' && (
                      actionLoading === 'google' ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : c.connected ? (
                        <button
                          onClick={handleDisconnectGoogle}
                          className="text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Desconectar
                        </button>
                      ) : (
                        <button
                          onClick={handleConnectGoogle}
                          className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Conectar
                        </button>
                      )
                    )}

                    {c.key === 'whatsapp' && (
                      c.connected ? (
                        <span className="text-xs text-gray-400 px-3 py-1.5">
                          Via Follow-Up
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1 px-3 py-1.5">
                          Conecte no Follow-Up
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      )
                    )}
                  </div>
                </div>
              ))}

              {/* Future connections placeholder */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400 text-lg">+</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Mais integrações em breve</p>
                    <p className="text-xs text-gray-400">CRM, email, e mais</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
