'use client'

import { CheckCircle, User, Building2, Layers, UserCircle, MessageSquareWarning, Settings, Play } from 'lucide-react'

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
}

const stepIcons = [User, Building2, Layers, UserCircle, MessageSquareWarning, Settings, Play]

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Progress bar background */}
      <div className="relative">
        {/* Background track */}
        <div className="absolute top-6 left-0 right-0 h-1 bg-gray-800 rounded-full" />

        {/* Progress fill */}
        <div
          className="absolute top-6 left-0 h-1 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const Icon = stepIcons[index] || User
            const isCompleted = index < currentStep
            const isCurrent = index === currentStep
            const isPending = index > currentStep

            return (
              <div key={step} className="flex flex-col items-center group">
                {/* Step circle with glow */}
                <div className="relative">
                  {/* Glow effect for current step */}
                  {isCurrent && (
                    <div className="absolute inset-0 bg-green-500/30 rounded-full blur-md animate-pulse" />
                  )}

                  {/* Circle */}
                  <div
                    className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 transform ${
                      isCompleted
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 scale-100'
                        : isCurrent
                        ? 'bg-gray-900 border-2 border-green-500 text-green-400 shadow-lg shadow-green-500/20 scale-110'
                        : 'bg-gray-800/80 border border-gray-700 text-gray-500 scale-95 group-hover:scale-100 group-hover:border-gray-600'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6 animate-in zoom-in duration-300" />
                    ) : (
                      <Icon className={`w-5 h-5 transition-transform duration-300 ${isCurrent ? 'animate-bounce' : 'group-hover:scale-110'}`} />
                    )}
                  </div>

                  {/* Ripple effect on completion */}
                  {isCompleted && (
                    <div className="absolute inset-0 rounded-full border-2 border-green-500/50 animate-ping" style={{ animationDuration: '2s' }} />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`mt-3 text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                    isCompleted
                      ? 'text-green-400'
                      : isCurrent
                      ? 'text-white font-semibold'
                      : 'text-gray-500 group-hover:text-gray-400'
                  }`}
                >
                  {step}
                </span>

                {/* Step number badge */}
                {!isCompleted && (
                  <span
                    className={`absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all duration-300 ${
                      isCurrent
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {index + 1}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
