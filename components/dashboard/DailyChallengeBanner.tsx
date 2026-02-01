'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Target, Trophy, Clock, ChevronDown, ChevronRight, ChevronUp, Rocket, Lightbulb, User, MessageSquare, Brain, Sparkles, Quote } from 'lucide-react'

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
}

interface PersonaData {
  id: string
  job_title?: string
  cargo?: string
  company_type?: string
  tipo_empresa_faturamento?: string
}

interface ObjectionData {
  id: string
  name: string
}

// Helper function to format target weakness
const formatTargetWeakness = (weakness: string): string => {
  const weaknessMap: Record<string, string> = {
    'spin_s': 'Situação',
    'spin_p': 'Problema',
    'spin_i': 'Implicação',
    'spin_n': 'Necessidade',
    'advanced_skill': 'Avançado',
    'objection_handling': 'Objeções',
  }
  return weaknessMap[weakness.toLowerCase()] || weakness.replace(/_/g, ' ')
}

// Helper function to extract just the SPIN letter (S, P, I, or N)
const extractSpinLetter = (input: string): string => {
  if (!input) return ''
  // Handle "SPIN_S", "spin_s", "S", "s" formats
  const upper = input.toUpperCase()
  if (upper.startsWith('SPIN_')) {
    return upper.replace('SPIN_', '')
  }
  // Already a single letter
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

export default function DailyChallengeBanner({ userId, companyId, onStartChallenge }: Props) {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
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

      setChallenge(data.challenge)

      // Fetch persona and objections names if challenge exists
      if (data.challenge?.challenge_config?.roleplay_config) {
        const config = data.challenge.challenge_config.roleplay_config

        // Fetch persona
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

        // Fetch objections
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

  // If disabled, don't render anything
  if (disabled) return null

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-100 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    )
  }

  // No challenge for today - show informative message
  if (!challenge) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Desafio Diário</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {error || 'Nenhum desafio disponível hoje. Novos desafios são gerados diariamente à meia-noite.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Challenge completed
  if (challenge.status === 'completed') {
    return (
      <div className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-green-400 to-emerald-500"></div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  Desafio Concluído!
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Sucesso
                  </span>
                </h3>
                <p className="text-sm text-gray-600 mt-0.5">{cleanSpinText(challenge.challenge_config.title)}</p>
                {challenge.result_score !== undefined && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold bg-green-50 text-green-700">
                      Score: {challenge.result_score.toFixed(1)}
                    </span>
                    {challenge.improvement_from_baseline !== undefined && challenge.improvement_from_baseline > 0 && (
                      <span className="inline-flex items-center text-sm text-emerald-600 font-medium">
                        ↑ +{challenge.improvement_from_baseline.toFixed(1)} de melhoria
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Active challenge
  const config = challenge.challenge_config

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Gradient top bar */}
      <div className="h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"></div>

      {/* Header - Always visible, clickable to expand */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsExpanded(!isExpanded)
        }}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 flex-shrink-0">
            <Target className="w-6 h-6 text-white" />
          </div>

          {/* Content */}
          <div className="text-left">
            <h3 className="text-base font-bold text-gray-900">{cleanSpinText(config.title)}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Difficulty Stars */}
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-3.5 h-3.5 ${i < challenge.difficulty_level ? 'text-amber-400' : 'text-gray-200'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-gray-300">•</span>
              {/* Goal Badge - Eye-catching and motivating */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 rounded-xl blur-sm opacity-60 group-hover:opacity-80 transition-opacity animate-pulse"></div>
                <span className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-black bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30">
                  <span className="text-lg">🔥</span>
                  <span className="flex items-center gap-1.5">
                    <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-xs font-bold">{extractSpinLetter(config.success_criteria.spin_letter_target)}</span>
                    <span>≥</span>
                    <span className="text-xl font-black">{config.success_criteria.spin_min_score}</span>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-purple-600">
          <span className="text-xs">{isExpanded ? 'Ocultar' : 'Ver detalhes'}</span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* Challenge Objective - Clear Focus */}
          <div className="px-6 pb-4">
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                  <span className="text-white font-bold text-lg">{extractSpinLetter(config.success_criteria.spin_letter_target)}</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-900 mb-1">
                    🎯 Objetivo: Alcançar {config.success_criteria.spin_min_score}+ em {formatSpinLetter(config.success_criteria.spin_letter_target)}
                  </h4>
                  <p className="text-sm text-amber-800">{cleanSpinText(config.description)}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-700">
                    <span className="font-medium">Foco:</span>
                    <span className="px-2 py-0.5 bg-amber-200/50 rounded font-semibold">
                      Perguntas de {formatSpinLetter(config.success_criteria.spin_letter_target)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Roleplay Configuration */}
          <div className="px-6 pb-4">
            <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-600" />
                Configuração do Roleplay
              </h4>

              <div className="grid grid-cols-2 gap-3">
                {/* Persona */}
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-gray-500 block">Persona</span>
                    <span className="text-sm font-medium text-gray-900">{personaName || 'Carregando...'}</span>
                  </div>
                </div>

                {/* Temperament */}
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-gray-500 block">Temperamento</span>
                    <span className="text-sm font-medium text-gray-900">{config.roleplay_config.temperament}</span>
                  </div>
                </div>

                {/* Age */}
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-gray-500 block">Faixa Etária</span>
                    <span className="text-sm font-medium text-gray-900">{config.roleplay_config.age_range} anos</span>
                  </div>
                </div>

                {/* Goal */}
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-gray-500 block">Meta</span>
                    <span className="text-sm font-medium text-gray-900">
                      {config.success_criteria.spin_min_score}+ em {formatSpinLetter(config.success_criteria.spin_letter_target)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Objections */}
              {objectionNames.length > 0 && (
                <div className="mt-3 pt-3 border-t border-purple-100">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">Objeções que você vai enfrentar</span>
                      <div className="flex flex-wrap gap-1.5">
                        {objectionNames.map((name, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Reasoning */}
          {challenge.ai_reasoning && (
            <div className="px-6 pb-4">
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-100/50 to-transparent rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-100/50 to-transparent rounded-full translate-y-1/2 -translate-x-1/2"></div>

                {/* Header */}
                <div className="relative px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h4 className="text-sm font-semibold text-indigo-900">Por que esse desafio foi criado para você?</h4>
                  </div>
                </div>

                {/* Content */}
                <div className="relative px-4 pb-4">
                  <div className="flex gap-3">
                    <Quote className="w-5 h-5 text-indigo-300 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{challenge.ai_reasoning}</p>
                      {config.analysis_summary?.pattern_detected && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-700">
                            🔍 {config.analysis_summary.pattern_detected}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Coaching Tips - Always visible when expanded */}
          {config.coaching_tips && config.coaching_tips.length > 0 && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 mb-3">
                <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Lightbulb className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                Dicas de Coaching
              </div>
              <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-4">
                <ul className="space-y-3">
                  {config.coaching_tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-700 leading-relaxed pt-0.5">{cleanSpinText(tip)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}

      {/* Actions - Always visible */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            startChallenge()
          }}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02]"
        >
          <Rocket className="w-4 h-4" />
          Iniciar Desafio
        </button>
      </div>
    </div>
  )
}
