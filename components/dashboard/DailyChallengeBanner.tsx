'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Target, Trophy, Clock, ChevronDown, ChevronUp, Play, Lightbulb, User, MessageSquare, Brain, Bot, CheckCircle } from 'lucide-react'

interface ChallengeConfig {
  title: string
  description: string
  target_weakness: string
  confidence_score: number
  roleplay_config: {
    persona_id: string
    objection_ids: string[]
    age_range: string
    temperament: string
    objective_id?: string
  }
  success_criteria: {
    spin_letter_target: string
    spin_min_score: number
    primary_indicator: string
    primary_min_score: number
    objection_handling_min: number
  }
  coaching_tips: string[]
  analysis_summary: {
    pattern_detected: string
    roleplay_evidence?: { avg_score: number; sessions_count: number }
    meet_evidence?: { avg_score: number; calls_count: number }
  }
}

interface DailyChallenge {
  id: string
  user_id: string
  company_id: string
  challenge_date: string
  status: 'pending' | 'in_progress' | 'completed'
  difficulty_level: number
  challenge_config: ChallengeConfig
  ai_reasoning: string
  result_score?: number
  success?: boolean
  improvement_from_baseline?: number
}

interface Props {
  userId: string
  companyId: string
  onStartChallenge: (challenge: DailyChallenge) => void
  onViewHistory?: () => void
}

interface PersonaData {
  id: string
  job_title?: string
  cargo?: string
  company_type?: string
  tipo_empresa_faturamento?: string
}

// Helper function to extract just the SPIN letter (S, P, I, or N)
const extractSpinLetter = (input: string): string => {
  if (!input) return ''
  const upper = input.toUpperCase()
  if (upper.startsWith('SPIN_')) {
    return upper.replace('SPIN_', '')
  }
  if (['S', 'P', 'I', 'N'].includes(upper)) {
    return upper
  }
  return input
}

// Helper function to format SPIN letter to full name
const formatSpinLetter = (letter: string): string => {
  const extracted = extractSpinLetter(letter)
  const letterMap: Record<string, string> = {
    'S': 'Situação',
    'P': 'Problema',
    'I': 'Implicação',
    'N': 'Necessidade',
  }
  return letterMap[extracted] || letter
}

// Helper function to clean up text containing SPIN_X patterns
const cleanSpinText = (text: string): string => {
  if (!text) return ''
  return text
    .replace(/SPIN_S/gi, 'Situação (S)')
    .replace(/SPIN_P/gi, 'Problema (P)')
    .replace(/SPIN_I/gi, 'Implicação (I)')
    .replace(/SPIN_N/gi, 'Necessidade (N)')
    .replace(/spin selling/gi, 'SPIN Selling')
}

export default function DailyChallengeBanner({ userId, companyId, onStartChallenge, onViewHistory }: Props) {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [completedChallenge, setCompletedChallenge] = useState<DailyChallenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [personaName, setPersonaName] = useState<string>('')
  const [objectionNames, setObjectionNames] = useState<string[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    fetchTodaysChallenge()
  }, [userId, companyId])

  const fetchTodaysChallenge = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/challenges/generate?userId=${userId}&companyId=${companyId}`)
      const data = await response.json()

      if (data.disabled) {
        setDisabled(true)
        return
      }

      if (data.error) {
        setError(data.error)
        return
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: completedData } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('challenge_date', today)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      if (completedData) {
        setCompletedChallenge(completedData as DailyChallenge)
      }

      if (!completedData) {
        setChallenge(data.challenge)
      }

      if (data.challenge?.challenge_config?.roleplay_config) {
        const config = data.challenge.challenge_config.roleplay_config

        if (config.persona_id) {
          const { data: persona } = await supabase
            .from('personas')
            .select('job_title, cargo, company_type, tipo_empresa_faturamento')
            .eq('id', config.persona_id)
            .single()

          if (persona) {
            const title = persona.job_title || persona.cargo || 'Persona'
            const company = persona.company_type || persona.tipo_empresa_faturamento || ''
            setPersonaName(company ? `${title} - ${company}` : title)
          }
        }

        if (config.objection_ids && config.objection_ids.length > 0) {
          const { data: objections } = await supabase
            .from('objections')
            .select('name')
            .in('id', config.objection_ids)

          if (objections) {
            setObjectionNames(objections.map(o => o.name))
          }
        }
      }
    } catch (err) {
      console.error('Error fetching challenge:', err)
    } finally {
      setLoading(false)
    }
  }

  const startChallenge = async () => {
    if (!challenge) return

    try {
      await fetch('/api/challenges/complete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.id, status: 'in_progress' })
      })

      onStartChallenge(challenge)
    } catch (err) {
      console.error('Error starting challenge:', err)
    }
  }

  // Barras de dificuldade
  const getDifficultyBars = (level: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-2.5 rounded-sm ${
            i <= level ? 'bg-green-500' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  )

  if (disabled) return null

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  // Completed challenge
  if (!challenge && completedChallenge) {
    return (
      <div className="bg-white rounded-xl border border-green-200 overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Trophy className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                Desafio Concluído
                {completedChallenge.success && (
                  <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded border border-green-100">
                    Sucesso
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 truncate">{cleanSpinText(completedChallenge.challenge_config.title)}</p>
            </div>
          </div>
          {completedChallenge.result_score != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Score:</span>
              <span className="font-bold text-green-600">{completedChallenge.result_score.toFixed(1)}</span>
            </div>
          )}
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="w-full mt-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors border border-green-100"
            >
              Ver histórico
            </button>
          )}
        </div>
      </div>
    )
  }

  // No challenge
  if (!challenge) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
            <Target className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Desafio Diário</h3>
            <p className="text-xs text-gray-500">{error || 'Nenhum desafio disponível hoje'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Completed status
  if (challenge.status === 'completed') {
    return (
      <div className="bg-white rounded-xl border border-green-200 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900">Concluído!</h3>
            <p className="text-xs text-gray-500 truncate">{cleanSpinText(challenge.challenge_config.title)}</p>
          </div>
        </div>
        {challenge.result_score != null && (
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-gray-500">Score:</span>
            <span className="font-bold text-green-600">{challenge.result_score.toFixed(1)}</span>
          </div>
        )}
        {onViewHistory && (
          <button
            onClick={onViewHistory}
            className="w-full py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors border border-green-100"
          >
            Ver histórico
          </button>
        )}
      </div>
    )
  }

  // Active challenge
  const config = challenge.challenge_config

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header - Clickable to expand */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 hover:bg-gray-50/50 transition-colors text-left"
      >
        <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Target className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">{cleanSpinText(config.title)}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {getDifficultyBars(challenge.difficulty_level)}
            <span className="text-gray-300">|</span>
            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100">
              {extractSpinLetter(config.success_criteria.spin_letter_target)} ≥ {config.success_criteria.spin_min_score}
            </span>
          </div>
        </div>
        <div className="text-gray-400">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Description */}
          <p className="text-xs text-gray-600 leading-relaxed">{cleanSpinText(config.description)}</p>

          {/* Goal */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-green-700">Meta</span>
            </div>
            <p className="text-sm text-gray-700">
              Alcançar <span className="font-bold text-green-700">{config.success_criteria.spin_min_score}+</span> em {formatSpinLetter(config.success_criteria.spin_letter_target)}
            </p>
          </div>

          {/* Config */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Configuração</div>
            <div className="space-y-2 text-xs">
              {personaName && (
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-600">{personaName}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-600">{config.roleplay_config.temperament}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-600">{config.roleplay_config.age_range} anos</span>
              </div>
            </div>
          </div>

          {/* Objections */}
          {objectionNames.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Objeções</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {objectionNames.map((name, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Reasoning */}
          {challenge.ai_reasoning && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                <Bot className="w-3.5 h-3.5" />
                <span>Por que este desafio?</span>
                <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform ml-auto" />
              </summary>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">{challenge.ai_reasoning}</p>
            </details>
          )}

          {/* Coaching Tips */}
          {config.coaching_tips && config.coaching_tips.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                <Lightbulb className="w-3.5 h-3.5 text-green-600" />
                <span>Dicas de coaching</span>
                <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform ml-auto" />
              </summary>
              <ul className="mt-2 space-y-1.5">
                {config.coaching_tips.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="w-4 h-4 bg-green-100 text-green-700 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{cleanSpinText(tip)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Action button */}
      <div className="p-4 pt-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            startChallenge()
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Play className="w-4 h-4" />
          Iniciar Desafio
        </button>
      </div>
    </div>
  )
}
