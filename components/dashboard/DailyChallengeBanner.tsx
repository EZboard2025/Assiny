'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
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

export default function DailyChallengeBanner({ userId, companyId, onStartChallenge, onViewHistory }: Props) {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTips, setShowTips] = useState(false)
  const [disabled, setDisabled] = useState(false)

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

      setChallenge(data.challenge)
    } catch (err) {
      console.error('Error fetching challenge:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateChallenge = async () => {
    try {
      setGenerating(true)
      setError(null)

      const response = await fetch('/api/challenges/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, companyId })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || data.error || 'Erro ao gerar desafio')
        return
      }

      if (data.noChallenge) {
        setError(data.message)
        return
      }

      setChallenge(data.challenge)
    } catch (err) {
      console.error('Error generating challenge:', err)
      setError('Erro ao gerar desafio')
    } finally {
      setGenerating(false)
    }
  }

  const skipChallenge = async () => {
    if (!challenge) return

    try {
      await fetch('/api/challenges/complete', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.id, status: 'skipped' })
      })

      setChallenge({ ...challenge, status: 'skipped' })
    } catch (err) {
      console.error('Error skipping challenge:', err)
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
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-purple-500/20 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-purple-500/20 rounded w-2/3"></div>
      </div>
    )
  }

  // No challenge yet - show generate button
  if (!challenge) {
    return (
      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              Desafio Diário
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              {error || 'Gere um desafio personalizado baseado em suas fraquezas'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                className="px-4 py-2 text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
              >
                Ver Histórico
              </button>
            )}
            <button
              onClick={generateChallenge}
              disabled={generating}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Gerando...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Gerar Desafio
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Challenge completed
  if (challenge.status === 'completed') {
    return (
      <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-2xl">✅</span>
              Desafio Concluído!
            </h3>
            <p className="text-gray-300 text-sm mt-1">{challenge.challenge_config.title}</p>
            {challenge.result_score !== undefined && (
              <div className="flex items-center gap-4 mt-2">
                <span className="text-green-400 font-medium">
                  Score: {challenge.result_score.toFixed(1)}
                </span>
                {challenge.improvement_from_baseline !== undefined && challenge.improvement_from_baseline > 0 && (
                  <span className="text-emerald-400 text-sm">
                    +{challenge.improvement_from_baseline.toFixed(1)} de melhoria
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                className="px-4 py-2 text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
              >
                Ver Histórico
              </button>
            )}
            <div className="text-green-400 text-4xl">🏆</div>
          </div>
        </div>
      </div>
    )
  }

  // Challenge skipped
  if (challenge.status === 'skipped') {
    return (
      <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/30 rounded-xl p-6 opacity-75">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-400 flex items-center gap-2">
              <span className="text-2xl">⏭️</span>
              Desafio Pulado
            </h3>
            <p className="text-gray-500 text-sm mt-1">{challenge.challenge_config.title}</p>
          </div>
          <div className="flex items-center gap-4">
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 text-sm font-medium transition-colors"
              >
                Ver Histórico
              </button>
            )}
            <p className="text-gray-500 text-sm">Volte amanhã para um novo desafio!</p>
          </div>
        </div>
      </div>
    )
  }

  // Active challenge
  const config = challenge.challenge_config
  const difficultyStars = '⭐'.repeat(challenge.difficulty_level)
  const emptyStars = '☆'.repeat(5 - challenge.difficulty_level)

  return (
    <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/40 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🎯</span>
              <div>
                <h3 className="text-xl font-bold text-white">{config.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-yellow-400 text-sm" title={`Dificuldade: ${challenge.difficulty_level}/5`}>
                    {difficultyStars}{emptyStars}
                  </span>
                  <span className="text-gray-500 text-sm">|</span>
                  <span className="text-purple-400 text-sm font-medium">
                    {config.target_weakness.replace('spin_', 'SPIN ').replace('followup_', 'Follow-up: ').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-gray-300 text-sm">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Success Criteria */}
      <div className="px-6 py-3 bg-black/20">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Meta:</span>
            <span className="text-purple-300 font-medium">
              {config.success_criteria.spin_letter_target} ≥ {config.success_criteria.spin_min_score}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Temperamento:</span>
            <span className="text-pink-300 font-medium">{config.roleplay_config.temperament}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Idade:</span>
            <span className="text-blue-300 font-medium">{config.roleplay_config.age_range}</span>
          </div>
        </div>
      </div>

      {/* Coaching Tips - Expandable */}
      {config.coaching_tips && config.coaching_tips.length > 0 && (
        <div className="px-6 py-3 border-t border-purple-500/20">
          <button
            onClick={() => setShowTips(!showTips)}
            className="flex items-center gap-2 text-sm text-purple-300 hover:text-purple-200 transition-colors w-full"
          >
            <span>💡</span>
            <span className="font-medium">Dicas de Coaching</span>
            <span className={`transition-transform ${showTips ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showTips && (
            <ul className="mt-3 space-y-2">
              {config.coaching_tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-6 pt-4 bg-black/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={skipChallenge}
            className="px-4 py-2 text-gray-400 hover:text-gray-300 text-sm transition-colors"
          >
            Pular desafio
          </button>
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="px-4 py-2 text-purple-400 hover:text-purple-300 text-sm transition-colors"
            >
              Ver Histórico
            </button>
          )}
        </div>
        <button
          onClick={startChallenge}
          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg shadow-purple-500/25"
        >
          <span>🚀</span>
          Iniciar Desafio
        </button>
      </div>
    </div>
  )
}
