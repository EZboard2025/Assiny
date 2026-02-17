'use client'

import { CheckCircle, AlertTriangle, ArrowRight, X } from 'lucide-react'
import { UserNotification } from '@/hooks/useNotifications'

interface NotificationBannerProps {
  notifications: UserNotification[]
  onViewEvaluation: (notification: UserNotification) => void
  onDismiss: (notificationId: string) => void
}

export default function NotificationBanner({ notifications, onViewEvaluation, onDismiss }: NotificationBannerProps) {
  if (notifications.length === 0) return null

  return (
    <div className="space-y-3 mb-6">
      {notifications.map((notif) => {
        const isError = notif.type === 'meet_evaluation_error'
        const score = notif.data?.overallScore
        const scoreDisplay = score != null ? score.toFixed(1) : null

        return (
          <div
            key={notif.id}
            className={`relative rounded-xl p-4 border transition-all duration-300 animate-slide-in-right ${
              isError
                ? 'bg-red-50 border-red-200'
                : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                isError ? 'bg-red-100' : 'bg-green-100'
              }`}>
                {isError
                  ? <AlertTriangle className="w-5 h-5 text-red-600" />
                  : <CheckCircle className="w-5 h-5 text-green-600" />
                }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-semibold ${isError ? 'text-red-800' : 'text-green-800'}`}>
                  {notif.title}
                </h4>
                <p className={`text-xs mt-0.5 ${isError ? 'text-red-600' : 'text-green-600'}`}>
                  {notif.message}
                </p>
              </div>

              {/* Score badge */}
              {scoreDisplay && !isError && (
                <div className="flex-shrink-0 bg-white rounded-lg px-3 py-1.5 border border-green-200 shadow-sm">
                  <span className="text-lg font-bold text-green-700">{scoreDisplay}</span>
                  <span className="text-xs text-green-500 ml-0.5">/10</span>
                </div>
              )}

              {/* Action button */}
              {!isError && (
                <button
                  onClick={() => onViewEvaluation(notif)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Ver Avaliação
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Dismiss button */}
              <button
                onClick={() => onDismiss(notif.id)}
                className={`flex-shrink-0 p-1 rounded-full hover:bg-black/5 transition-colors ${
                  isError ? 'text-red-400 hover:text-red-600' : 'text-green-400 hover:text-green-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
