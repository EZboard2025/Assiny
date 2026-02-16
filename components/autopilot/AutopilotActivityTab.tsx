'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Loader2 } from 'lucide-react'

interface AutopilotLogEntry {
  id: string
  contact_phone: string
  contact_name: string | null
  incoming_message: string
  action: string
  ai_response: string | null
  ai_reasoning: string | null
  created_at: string
}

interface AutopilotActivityTabProps {
  authToken: string | null
}

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  responded: { label: 'Respondido', className: 'bg-green-900/40 text-green-400' },
  complemented: { label: 'Complementou', className: 'bg-blue-900/40 text-blue-400' },
  objective_reached: { label: 'Objetivo alcançado', className: 'bg-emerald-900/40 text-emerald-300' },
  flagged_human: { label: 'Precisa atenção', className: 'bg-amber-900/40 text-amber-400' },
  skipped_limit: { label: 'Limite atingido', className: 'bg-gray-700 text-gray-400' },
  skipped_hours: { label: 'Fora de horário', className: 'bg-gray-700 text-gray-400' },
  skipped_credits: { label: 'Sem créditos', className: 'bg-gray-700 text-gray-400' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function AutopilotActivityTab({ authToken }: AutopilotActivityTabProps) {
  const [log, setLog] = useState<AutopilotLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadLog = async () => {
      if (!authToken) return
      setIsLoading(true)
      try {
        // Get current token from Supabase client (auto-refreshed internally)
        let headers: Record<string, string> = {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
        } catch {}

        const res = await fetch('/api/autopilot/log?limit=30', { headers })
        if (res.ok) {
          const data = await res.json()
          setLog(data.entries || [])
        }
      } catch (err) {
        console.error('[AutopilotActivityTab] Load error:', err)
      }
      setIsLoading(false)
    }
    loadLog()
  }, [authToken])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[#00a884]" />
      </div>
    )
  }

  if (log.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <MessageSquare className="w-10 h-10 mx-auto mb-3 text-[#364147]" />
        <p className="text-[#e9edef] text-[14px] font-medium">Nenhuma atividade ainda</p>
        <p className="text-[#8696a0] text-[12px] mt-1">Vai aparecer aqui quando o autopiloto responder</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {log.slice(0, 20).map(entry => {
        const actionInfo = ACTION_LABELS[entry.action] || { label: entry.action, className: 'bg-gray-700 text-gray-400' }
        return (
          <div key={entry.id} className="bg-[#202c33] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${actionInfo.className}`}>
                {actionInfo.label}
              </span>
              <span className="text-[#8696a0] text-[10px]">{entry.contact_name || entry.contact_phone}</span>
              <span className="text-[#8696a0] text-[10px] ml-auto">{timeAgo(entry.created_at)}</span>
            </div>
            <p className="text-[#e9edef] text-[12px] truncate">&quot;{entry.incoming_message}&quot;</p>
            {entry.ai_response && (
              <p className="text-[#00a884] text-[11px] mt-1 truncate">{entry.ai_response}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
