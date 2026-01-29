'use client'

import { Play } from 'lucide-react'

interface TopBannerProps {
  onStartRoleplay: () => void
}

export default function TopBanner({ onStartRoleplay }: TopBannerProps) {
  return (
    <button
      onClick={onStartRoleplay}
      className="w-full group relative overflow-hidden rounded-2xl bg-[#6B7280] p-6 text-left transition-all hover:shadow-xl hover:shadow-gray-500/20 hover:scale-[1.01]"
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-bottom opacity-60"
        style={{
          backgroundImage: 'url(/images/banner-people.svg)',
        }}
      />

      {/* Overlay gradient for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-gray-700/60 to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Treinar vendas agora
          </h2>
          <p className="text-gray-200 text-sm">
            Inicie uma nova simulacao e melhore suas habilidades
          </p>
        </div>

        {/* Play button indicator */}
        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors">
          <Play className="w-6 h-6 text-white ml-1" fill="white" />
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full" />
      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full" />
    </button>
  )
}
