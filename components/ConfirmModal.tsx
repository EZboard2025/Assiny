'use client'

import { AlertTriangle, X } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string | React.ReactNode
  confirmText?: string
  cancelText?: string
  confirmButtonClass?: string
  requireTyping?: string // Se definido, requer que o usuário digite este texto
  typedValue?: string
  onTypedValueChange?: (value: string) => void
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  confirmButtonClass = 'bg-red-600 hover:bg-red-700',
  requireTyping,
  typedValue = '',
  onTypedValueChange,
}: ConfirmModalProps) {
  if (!isOpen) return null

  const isTypingRequired = requireTyping && requireTyping.length > 0
  const canConfirm = !isTypingRequired || typedValue === requireTyping

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 max-w-lg w-full border border-red-500/30 shadow-2xl animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon and Title */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
            <div className="text-gray-300">
              {message}
            </div>
          </div>
        </div>

        {/* Typing requirement */}
        {isTypingRequired && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Para confirmar, digite: <span className="text-red-400 font-bold">{requireTyping}</span>
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => onTypedValueChange?.(e.target.value)}
              placeholder={`Digite "${requireTyping}" para confirmar`}
              className="w-full px-4 py-3 bg-gray-800/50 border border-red-500/20 rounded-xl text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none"
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`flex-1 px-6 py-3 text-white rounded-xl font-medium transition-all ${
              canConfirm
                ? confirmButtonClass
                : 'bg-gray-600 cursor-not-allowed opacity-50'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}