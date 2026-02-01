'use client'

import { LucideIcon, ChevronRight, Lock, History } from 'lucide-react'

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
  secondaryAction
}: FeatureCardProps) {
  const SecondaryIcon = secondaryAction?.icon || History

  return (
    <div className="text-left w-full">
      <div className={`relative bg-white rounded-xl p-5 border border-gray-200 h-full transition-all duration-200 ${
        disabled || locked
          ? 'opacity-60'
          : ''
      }`}>
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

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between gap-2">
          {/* Main CTA */}
          <button
            onClick={onClick}
            disabled={disabled || locked}
            className={`group flex items-center text-sm font-medium transition-colors ${
              disabled || locked
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-green-600 hover:text-green-700'
            }`}
          >
            <span>Acessar</span>
            <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${
              disabled || locked ? '' : 'group-hover:translate-x-1'
            }`} />
          </button>

          {/* Secondary Action */}
          {secondaryAction && !locked && !disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                secondaryAction.onClick()
              }}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors"
            >
              <SecondaryIcon className="w-3.5 h-3.5" />
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
