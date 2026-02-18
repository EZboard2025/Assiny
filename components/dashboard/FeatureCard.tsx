'use client'

import { LucideIcon, Lock, History } from 'lucide-react'

interface SecondaryAction {
  label: string
  onClick: () => void
  icon?: LucideIcon
}

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  subtitle: string
  description: string
  onClick: () => void
  disabled?: boolean
  adminBadge?: boolean
  betaBadge?: boolean
  locked?: boolean
  secondaryAction?: SecondaryAction
  notificationCount?: number
  onMouseEnter?: () => void
}

export default function FeatureCard({
  icon: Icon,
  title,
  subtitle,
  description,
  onClick,
  disabled = false,
  adminBadge = false,
  betaBadge = false,
  locked = false,
  secondaryAction,
  notificationCount = 0,
  onMouseEnter
}: FeatureCardProps) {
  const SecondaryIcon = secondaryAction?.icon || History

  const handleCardClick = () => {
    if (!disabled && !locked) {
      onClick()
    }
  }

  const hasNotification = notificationCount > 0

  return (
    <div className="text-left w-full" onMouseEnter={onMouseEnter}>
      <div
        onClick={handleCardClick}
        className={`relative bg-white rounded-xl p-5 border h-full transition-all duration-200 ${
          disabled || locked
            ? 'opacity-60 cursor-not-allowed border-gray-200'
            : hasNotification
              ? 'cursor-pointer border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.35)] hover:shadow-[0_0_20px_rgba(34,197,94,0.5)]'
              : 'cursor-pointer border-gray-200 hover:border-green-300 hover:shadow-md'
        }`}
      >
        {/* Notification badge */}
        {hasNotification && (
          <div className="absolute -top-2 -right-2 z-20">
            <span className="flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full shadow-md animate-pulse">
              {notificationCount}
            </span>
          </div>
        )}

        {/* Locked overlay */}
        {locked && (
          <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center z-10">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
        )}

        {/* Admin badge */}
        {adminBadge && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-medium rounded">
              Admin
            </span>
          </div>
        )}

        {/* Beta badge */}
        {betaBadge && !adminBadge && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 text-[10px] font-medium rounded border border-yellow-200">
              Beta
            </span>
          </div>
        )}

        {/* Header with icon */}
        <div className={`flex items-center gap-3 mb-3 ${adminBadge || betaBadge ? 'pr-12' : ''}`}>
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-green-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">{title}</h3>
            <span className="text-xs text-gray-500">{subtitle}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
          {description}
        </p>

        {/* Secondary Action */}
        {secondaryAction && !locked && !disabled && (
          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation()
                secondaryAction.onClick()
              }}
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
            >
              <SecondaryIcon className="w-3.5 h-3.5" />
              <span>{secondaryAction.label}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
