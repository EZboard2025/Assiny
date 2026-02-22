'use client'

import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface KPICardProps {
  icon: LucideIcon
  iconBg: string
  iconColor: string
  label: string
  value: string
  subtitle?: string
  delta?: { value: string; positive: boolean }
  onClick: () => void
  loading?: boolean
}

export default function KPICard({ icon: Icon, iconBg, iconColor, label, value, subtitle, delta, onClick, loading }: KPICardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          <div className="h-3 bg-gray-200 rounded w-20" />
        </div>
        <div className="h-7 bg-gray-200 rounded w-16 mb-1" />
        <div className="h-3 bg-gray-100 rounded w-24" />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm cursor-pointer transition-all text-left w-full"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {delta && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold mb-0.5 ${delta.positive ? 'text-green-600' : 'text-red-500'}`}>
            {delta.positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {delta.value}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      )}
    </button>
  )
}
