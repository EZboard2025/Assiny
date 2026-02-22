'use client'

import { useEffect, useRef } from 'react'
import { Video, AlertCircle, Share2, Bell, BellOff, CheckCheck } from 'lucide-react'
import type { UserNotification } from '@/hooks/useNotifications'

interface NotificationPanelProps {
  notifications: UserNotification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onNotificationClick: (notification: UserNotification) => void
  onClose: () => void
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  if (diffH < 24) return `há ${diffH}h`
  if (diffD === 1) return 'ontem'
  if (diffD < 7) return `há ${diffD} dias`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'meet_evaluation_ready':
      return { icon: Video, color: 'text-green-600', bg: 'bg-green-50' }
    case 'meet_evaluation_error':
      return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' }
    case 'shared_meeting':
      return { icon: Share2, color: 'text-blue-600', bg: 'bg-blue-50' }
    default:
      return { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100' }
  }
}

export default function NotificationPanel({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
  onClose,
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
        {notifications.length > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="max-h-[400px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <BellOff className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">Nenhuma notificação</p>
            <p className="text-xs text-gray-400 mt-1">Você está em dia!</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const { icon: Icon, color, bg } = getNotificationIcon(notif.type)
            return (
              <button
                key={notif.id}
                onClick={() => onNotificationClick(notif)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-b-0"
              >
                <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{notif.title}</p>
                  {notif.message && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
