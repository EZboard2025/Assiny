'use client'

import { CheckCircle } from 'lucide-react'

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          {/* Step circle */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                index < currentStep
                  ? 'bg-green-500 text-white'
                  : index === currentStep
                  ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                  : 'bg-gray-800/50 border border-gray-700 text-gray-500'
              }`}
            >
              {index < currentStep ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                index + 1
              )}
            </div>
            <span
              className={`mt-1 text-xs whitespace-nowrap ${
                index <= currentStep ? 'text-green-400' : 'text-gray-600'
              }`}
            >
              {step}
            </span>
          </div>

          {/* Connector line */}
          {index < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 transition-all ${
                index < currentStep ? 'bg-green-500' : 'bg-gray-700'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
