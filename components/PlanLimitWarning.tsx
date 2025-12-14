import React from 'react'
import { AlertCircle, Lock } from 'lucide-react'

interface PlanLimitWarningProps {
  message: string
  limit?: number
  current?: number
  remaining?: number
  type?: 'error' | 'warning' | 'info'
}

export function PlanLimitWarning({
  message,
  limit,
  current,
  remaining,
  type = 'warning'
}: PlanLimitWarningProps) {
  const bgColor = type === 'error' ? 'bg-red-900/20' : type === 'warning' ? 'bg-yellow-900/20' : 'bg-blue-900/20'
  const borderColor = type === 'error' ? 'border-red-500/30' : type === 'warning' ? 'border-yellow-500/30' : 'border-blue-500/30'
  const textColor = type === 'error' ? 'text-red-400' : type === 'warning' ? 'text-yellow-400' : 'text-blue-400'
  const iconColor = type === 'error' ? 'text-red-500' : type === 'warning' ? 'text-yellow-500' : 'text-blue-500'

  return (
    <div className={`${bgColor} ${borderColor} border rounded-xl p-4 mb-4`}>
      <div className="flex items-start gap-3">
        <AlertCircle className={`w-5 h-5 ${iconColor} mt-0.5 flex-shrink-0`} />
        <div className="flex-1">
          <p className={`${textColor} font-medium`}>{message}</p>
          {(limit !== undefined || current !== undefined) && (
            <div className="mt-2 flex items-center gap-4 text-sm">
              {current !== undefined && (
                <span className="text-gray-400">
                  Uso atual: <span className="text-white font-medium">{current}</span>
                </span>
              )}
              {limit !== undefined && (
                <span className="text-gray-400">
                  Limite: <span className="text-white font-medium">{limit === null ? '∞' : limit}</span>
                </span>
              )}
              {remaining !== undefined && remaining > 0 && (
                <span className="text-gray-400">
                  Restante: <span className="text-green-400 font-medium">{remaining}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface PlanLimitButtonProps {
  onClick?: () => void
  disabled: boolean
  limitReached?: boolean
  children: React.ReactNode
  className?: string
}

export function PlanLimitButton({
  onClick,
  disabled,
  limitReached,
  children,
  className = ''
}: PlanLimitButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || limitReached}
      className={`${className} ${
        limitReached
          ? 'opacity-50 cursor-not-allowed relative'
          : disabled
          ? 'opacity-50 cursor-not-allowed'
          : ''
      }`}
      title={limitReached ? 'Limite do plano atingido' : ''}
    >
      {children}
      {limitReached && (
        <Lock className="w-4 h-4 absolute -top-1 -right-1 text-yellow-400" />
      )}
    </button>
  )
}