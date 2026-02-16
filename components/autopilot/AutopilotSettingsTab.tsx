'use client'

import { Check, Loader2, Clock, MessageSquare, Timer, Shield, Info } from 'lucide-react'

interface AutopilotSettings {
  response_delay_min: number
  response_delay_max: number
  max_responses_per_contact_per_day: number
  working_hours_only: boolean
  working_hours_start: string
  working_hours_end: string
  tone: 'consultivo' | 'informal' | 'formal'
}

interface AutopilotSettingsTabProps {
  settings: AutopilotSettings
  onSettingsChange: (settings: AutopilotSettings) => void
  hasChanges: boolean
  isSaving: boolean
  onSave: () => void
}

const TONES = [
  { key: 'consultivo' as const, label: 'Consultivo', desc: 'Profissional e prestativo' },
  { key: 'informal' as const, label: 'Informal', desc: 'Leve e descontraído' },
  { key: 'formal' as const, label: 'Formal', desc: 'Sério e direto' }
]

export default function AutopilotSettingsTab({
  settings,
  onSettingsChange,
  hasChanges,
  isSaving,
  onSave
}: AutopilotSettingsTabProps) {
  const updateSetting = (key: string, value: any) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="p-4 space-y-4">

      {/* Working hours */}
      <div className="bg-[#202c33] rounded-xl p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#00a884]/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-[#00a884]" />
          </div>
          <div className="flex-1">
            <p className="text-[#e9edef] text-[13px] font-medium">Horário comercial</p>
            <p className="text-[#8696a0] text-[11px]">
              {settings.working_hours_only
                ? `Responde entre ${settings.working_hours_start} e ${settings.working_hours_end}`
                : 'Responde a qualquer hora do dia'
              }
            </p>
          </div>
          <button
            onClick={() => updateSetting('working_hours_only', !settings.working_hours_only)}
            className={`w-10 h-[22px] rounded-full transition-colors relative flex-shrink-0 ${settings.working_hours_only ? 'bg-[#00a884]' : 'bg-[#364147]'}`}
          >
            <div className={`w-[18px] h-[18px] bg-white rounded-full absolute top-[2px] transition-transform shadow-sm ${settings.working_hours_only ? 'translate-x-[20px]' : 'translate-x-[2px]'}`} />
          </button>
        </div>
        {settings.working_hours_only && (
          <div className="flex items-center gap-2 bg-[#111b21] rounded-lg px-3 py-2.5">
            <input
              type="time"
              value={settings.working_hours_start}
              onChange={(e) => updateSetting('working_hours_start', e.target.value)}
              className="bg-[#2a3942] text-[#e9edef] text-[13px] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#00a884]/40"
            />
            <span className="text-[#8696a0] text-[13px]">até</span>
            <input
              type="time"
              value={settings.working_hours_end}
              onChange={(e) => updateSetting('working_hours_end', e.target.value)}
              className="bg-[#2a3942] text-[#e9edef] text-[13px] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#00a884]/40"
            />
          </div>
        )}
      </div>

      {/* Tone */}
      <div className="bg-[#202c33] rounded-xl p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#53bdeb]/15 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-[#53bdeb]" />
          </div>
          <div>
            <p className="text-[#e9edef] text-[13px] font-medium">Tom das respostas</p>
            <p className="text-[#8696a0] text-[11px]">Como a IA se comunica com os leads</p>
          </div>
        </div>
        <div className="flex gap-2">
          {TONES.map(t => (
            <button
              key={t.key}
              onClick={() => updateSetting('tone', t.key)}
              className={`flex-1 px-3 py-3 rounded-xl text-center transition-all ${
                settings.tone === t.key
                  ? 'bg-[#00a884] text-white ring-1 ring-[#00a884]'
                  : 'bg-[#111b21] text-[#e9edef] hover:bg-[#2a3942]'
              }`}
            >
              <p className="text-[12px] font-medium">{t.label}</p>
              <p className={`text-[10px] mt-0.5 ${settings.tone === t.key ? 'text-white/70' : 'text-[#8696a0]'}`}>{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Response delay */}
      <div className="bg-[#202c33] rounded-xl p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#d9a5f5]/15 flex items-center justify-center">
            <Timer className="w-4 h-4 text-[#d9a5f5]" />
          </div>
          <div>
            <p className="text-[#e9edef] text-[13px] font-medium">Tempo de resposta</p>
            <p className="text-[#8696a0] text-[11px]">Delay antes de enviar para parecer natural</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#111b21] rounded-lg px-3 py-2.5">
          <span className="text-[#8696a0] text-[12px] flex-shrink-0">Mínimo</span>
          <input
            type="number"
            min={5}
            max={120}
            value={settings.response_delay_min}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 15
              updateSetting('response_delay_min', val)
              if (val > settings.response_delay_max) updateSetting('response_delay_max', val)
            }}
            className="w-16 bg-[#2a3942] text-[#e9edef] text-[13px] rounded-lg px-2 py-1.5 outline-none text-center focus:ring-1 focus:ring-[#00a884]/40"
          />
          <span className="text-[#8696a0] text-[12px]">s</span>
          <span className="text-[#364147] text-[12px]">|</span>
          <span className="text-[#8696a0] text-[12px] flex-shrink-0">Máximo</span>
          <input
            type="number"
            min={5}
            max={120}
            value={settings.response_delay_max}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 60
              updateSetting('response_delay_max', val)
              if (val < settings.response_delay_min) updateSetting('response_delay_min', val)
            }}
            className="w-16 bg-[#2a3942] text-[#e9edef] text-[13px] rounded-lg px-2 py-1.5 outline-none text-center focus:ring-1 focus:ring-[#00a884]/40"
          />
          <span className="text-[#8696a0] text-[12px]">s</span>
        </div>
        <p className="text-[#8696a0] text-[10px] mt-2 flex items-center gap-1">
          <Info className="w-3 h-3" />
          A IA espera entre {settings.response_delay_min}s e {settings.response_delay_max}s antes de responder
        </p>
      </div>

      {/* Daily limit */}
      <div className="bg-[#202c33] rounded-xl p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#f5c542]/15 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#f5c542]" />
          </div>
          <div className="flex-1">
            <p className="text-[#e9edef] text-[13px] font-medium">Limite diário por contato</p>
            <p className="text-[#8696a0] text-[11px]">Máximo de respostas automáticas por dia</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#111b21] rounded-lg px-3 py-2.5">
          <input
            type="range"
            min={1}
            max={50}
            value={Math.min(settings.max_responses_per_contact_per_day, 50)}
            onChange={(e) => updateSetting('max_responses_per_contact_per_day', parseInt(e.target.value))}
            className="flex-1 accent-[#00a884] h-1"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={999}
              value={settings.max_responses_per_contact_per_day}
              onChange={(e) => updateSetting('max_responses_per_contact_per_day', parseInt(e.target.value) || 5)}
              className="w-16 bg-[#2a3942] text-[#e9edef] text-[13px] rounded-lg px-2 py-1.5 outline-none text-center focus:ring-1 focus:ring-[#00a884]/40"
            />
            <span className="text-[#8696a0] text-[12px]">/dia</span>
          </div>
        </div>
        {settings.max_responses_per_contact_per_day >= 999 && (
          <p className="text-amber-400/80 text-[10px] mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Sem limite — a IA responde quantas vezes for necessário
          </p>
        )}
      </div>

      {/* Save */}
      {hasChanges && (
        <button
          onClick={onSave}
          disabled={isSaving}
          className="w-full py-3 bg-[#00a884] text-white rounded-xl text-[13px] font-medium hover:bg-[#00a884]/90 transition-colors flex items-center justify-center gap-1.5"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Salvar alterações
        </button>
      )}
    </div>
  )
}
