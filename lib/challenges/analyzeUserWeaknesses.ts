import { createClient } from '@supabase/supabase-js'

// Types for the weakness analysis
export interface WeaknessAnalysis {
  target: string // spin_s, spin_p, spin_i, spin_n, objection_handling
  severity: 'critical' | 'moderate' | 'minor'
  confidence: number // 0-1, how confident we are about this weakness
  currentScore: number
  evidenceSources: {
    roleplay?: { avgScore: number; sessionsCount: number; trend: 'improving' | 'stable' | 'declining' }
    meet?: { avgScore: number; callsCount: number; wonVsLost?: { won: number; lost: number } }
  }
  pattern?: string // Description of detected pattern
  lastOccurrence: Date
}

export interface UserDataSummary {
  userId: string
  companyId: string
  // Roleplay data
  roleplaySessions: any[]
  roleplayAverages: {
    overall: number
    spin_s: number
    spin_p: number
    spin_i: number
    spin_n: number
    objection_handling: number
  }
  // Meet data
  meetEvaluations: any[]
  meetAverages: {
    overall: number
    spin_s: number
    spin_p: number
    spin_i: number
    spin_n: number
    soft_skills: number
  }
  // Performance summary (consolidated)
  performanceSummary: any
  // Detected weaknesses
  weaknesses: WeaknessAnalysis[]
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Fetches all available data for a user from roleplay and meet sources
 */
export async function fetchAllUserData(userId: string, companyId: string): Promise<UserDataSummary | null> {
  try {
    // Fetch data sources in parallel
    const [
      roleplayResult,
      meetResult,
      performanceResult
    ] = await Promise.all([
      // Roleplay sessions (last 30 days)
      supabaseAdmin
        .from('roleplay_sessions')
        .select('id, evaluation, created_at, config')
        .eq('user_id', userId)
        .not('evaluation', 'is', null)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20),

      // Meet evaluations (last 30 days)
      supabaseAdmin
        .from('meet_evaluations')
        .select('id, evaluation, result, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20),

      // User performance summary
      supabaseAdmin
        .from('user_performance_summaries')
        .select('*')
        .eq('user_id', userId)
        .single()
    ])

    const roleplaySessions = roleplayResult.data || []
    const meetEvaluations = meetResult.data || []
    const performanceSummary = performanceResult.data

    // Calculate averages for each source
    const roleplayAverages = calculateRoleplayAverages(roleplaySessions)
    const meetAverages = calculateMeetAverages(meetEvaluations)

    // Analyze weaknesses from roleplay and meet data
    const weaknesses = analyzeWeaknesses(
      roleplaySessions,
      meetEvaluations,
      roleplayAverages,
      meetAverages
    )

    return {
      userId,
      companyId,
      roleplaySessions,
      roleplayAverages,
      meetEvaluations,
      meetAverages,
      performanceSummary,
      weaknesses
    }
  } catch (error) {
    console.error('Error fetching user data:', error)
    return null
  }
}

/**
 * Calculates averages from roleplay sessions
 */
function calculateRoleplayAverages(sessions: any[]) {
  if (sessions.length === 0) {
    return { overall: 0, spin_s: 0, spin_p: 0, spin_i: 0, spin_n: 0, objection_handling: 0 }
  }

  let totalOverall = 0
  let totalS = 0, totalP = 0, totalI = 0, totalN = 0
  let totalObjections = 0
  let countS = 0, countP = 0, countI = 0, countN = 0
  let countObjections = 0
  let countOverall = 0

  for (const session of sessions) {
    const evaluation = session.evaluation

    if (evaluation?.overall_score !== undefined) {
      totalOverall += evaluation.overall_score
      countOverall++
    }

    const spin = evaluation?.spin_evaluation
    if (spin) {
      if (spin.S?.final_score !== undefined) { totalS += spin.S.final_score; countS++ }
      if (spin.P?.final_score !== undefined) { totalP += spin.P.final_score; countP++ }
      if (spin.I?.final_score !== undefined) { totalI += spin.I.final_score; countI++ }
      if (spin.N?.final_score !== undefined) { totalN += spin.N.final_score; countN++ }
    }

    // Calculate average objection handling score
    if (evaluation?.objections_analysis && Array.isArray(evaluation.objections_analysis)) {
      for (const obj of evaluation.objections_analysis) {
        if (obj.score !== undefined) {
          totalObjections += obj.score
          countObjections++
        }
      }
    }
  }

  return {
    overall: countOverall > 0 ? totalOverall / countOverall : 0,
    spin_s: countS > 0 ? totalS / countS : 0,
    spin_p: countP > 0 ? totalP / countP : 0,
    spin_i: countI > 0 ? totalI / countI : 0,
    spin_n: countN > 0 ? totalN / countN : 0,
    objection_handling: countObjections > 0 ? totalObjections / countObjections : 0
  }
}

/**
 * Calculates averages from meet evaluations
 */
function calculateMeetAverages(evaluations: any[]) {
  if (evaluations.length === 0) {
    return { overall: 0, spin_s: 0, spin_p: 0, spin_i: 0, spin_n: 0, soft_skills: 0 }
  }

  let totalOverall = 0
  let totalS = 0, totalP = 0, totalI = 0, totalN = 0
  let totalSoftSkills = 0
  let countS = 0, countP = 0, countI = 0, countN = 0
  let countSoftSkills = 0
  let countOverall = 0

  for (const eval_ of evaluations) {
    const evaluation = eval_.evaluation

    if (evaluation?.overall_score !== undefined) {
      totalOverall += evaluation.overall_score
      countOverall++
    }

    const spin = evaluation?.spin_evaluation
    if (spin) {
      if (spin.S?.final_score !== undefined) { totalS += spin.S.final_score; countS++ }
      if (spin.P?.final_score !== undefined) { totalP += spin.P.final_score; countP++ }
      if (spin.I?.final_score !== undefined) { totalI += spin.I.final_score; countI++ }
      if (spin.N?.final_score !== undefined) { totalN += spin.N.final_score; countN++ }
    }

    // Soft skills from meet evaluation (rapport, controle, etc)
    const softSkills = evaluation?.soft_skills
    if (softSkills) {
      const skillScores = Object.values(softSkills).filter((v): v is number => typeof v === 'number')
      if (skillScores.length > 0) {
        totalSoftSkills += skillScores.reduce((a, b) => a + b, 0) / skillScores.length
        countSoftSkills++
      }
    }
  }

  return {
    overall: countOverall > 0 ? totalOverall / countOverall : 0,
    spin_s: countS > 0 ? totalS / countS : 0,
    spin_p: countP > 0 ? totalP / countP : 0,
    spin_i: countI > 0 ? totalI / countI : 0,
    spin_n: countN > 0 ? totalN / countN : 0,
    soft_skills: countSoftSkills > 0 ? totalSoftSkills / countSoftSkills : 0
  }
}

/**
 * Analyzes weaknesses by correlating data from roleplay and meet sources
 */
function analyzeWeaknesses(
  roleplaySessions: any[],
  meetEvaluations: any[],
  roleplayAvg: any,
  meetAvg: any
): WeaknessAnalysis[] {
  const weaknesses: WeaknessAnalysis[] = []
  const WEAKNESS_THRESHOLD = 6.0 // Scores below this are considered weaknesses
  const CRITICAL_THRESHOLD = 4.5 // Scores below this are critical

  // Helper to determine severity
  const getSeverity = (score: number): 'critical' | 'moderate' | 'minor' => {
    if (score < CRITICAL_THRESHOLD) return 'critical'
    if (score < 5.5) return 'moderate'
    return 'minor'
  }

  // Helper to calculate trend
  const calculateTrend = (sessions: any[], getScore: (s: any) => number | undefined): 'improving' | 'stable' | 'declining' => {
    if (sessions.length < 3) return 'stable'

    const recentScores = sessions.slice(0, 3).map(getScore).filter((s): s is number => s !== undefined)
    const olderScores = sessions.slice(-3).map(getScore).filter((s): s is number => s !== undefined)

    if (recentScores.length === 0 || olderScores.length === 0) return 'stable'

    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length
    const diff = recentAvg - olderAvg

    if (diff > 0.5) return 'improving'
    if (diff < -0.5) return 'declining'
    return 'stable'
  }

  // 1. SPIN S - Situation
  const spinSScore = calculateCombinedScore([roleplayAvg.spin_s, meetAvg.spin_s])
  if (spinSScore < WEAKNESS_THRESHOLD && (roleplaySessions.length > 0 || meetEvaluations.length > 0)) {
    weaknesses.push({
      target: 'spin_s',
      severity: getSeverity(spinSScore),
      confidence: calculateConfidence(roleplaySessions.length, meetEvaluations.length),
      currentScore: spinSScore,
      evidenceSources: {
        roleplay: roleplaySessions.length > 0 ? {
          avgScore: roleplayAvg.spin_s,
          sessionsCount: roleplaySessions.length,
          trend: calculateTrend(roleplaySessions, s => s.evaluation?.spin_evaluation?.S?.final_score)
        } : undefined,
        meet: meetEvaluations.length > 0 ? {
          avgScore: meetAvg.spin_s,
          callsCount: meetEvaluations.length
        } : undefined
      },
      pattern: detectPattern('spin_s', roleplaySessions, meetEvaluations),
      lastOccurrence: new Date(roleplaySessions[0]?.created_at || meetEvaluations[0]?.created_at || Date.now())
    })
  }

  // 2. SPIN P - Problem
  const spinPScore = calculateCombinedScore([roleplayAvg.spin_p, meetAvg.spin_p])
  if (spinPScore < WEAKNESS_THRESHOLD && (roleplaySessions.length > 0 || meetEvaluations.length > 0)) {
    weaknesses.push({
      target: 'spin_p',
      severity: getSeverity(spinPScore),
      confidence: calculateConfidence(roleplaySessions.length, meetEvaluations.length),
      currentScore: spinPScore,
      evidenceSources: {
        roleplay: roleplaySessions.length > 0 ? {
          avgScore: roleplayAvg.spin_p,
          sessionsCount: roleplaySessions.length,
          trend: calculateTrend(roleplaySessions, s => s.evaluation?.spin_evaluation?.P?.final_score)
        } : undefined,
        meet: meetEvaluations.length > 0 ? {
          avgScore: meetAvg.spin_p,
          callsCount: meetEvaluations.length
        } : undefined
      },
      pattern: detectPattern('spin_p', roleplaySessions, meetEvaluations),
      lastOccurrence: new Date(roleplaySessions[0]?.created_at || meetEvaluations[0]?.created_at || Date.now())
    })
  }

  // 3. SPIN I - Implication (often the weakest)
  const spinIScore = calculateCombinedScore([roleplayAvg.spin_i, meetAvg.spin_i])
  if (spinIScore < WEAKNESS_THRESHOLD && (roleplaySessions.length > 0 || meetEvaluations.length > 0)) {
    weaknesses.push({
      target: 'spin_i',
      severity: getSeverity(spinIScore),
      confidence: calculateConfidence(roleplaySessions.length, meetEvaluations.length),
      currentScore: spinIScore,
      evidenceSources: {
        roleplay: roleplaySessions.length > 0 ? {
          avgScore: roleplayAvg.spin_i,
          sessionsCount: roleplaySessions.length,
          trend: calculateTrend(roleplaySessions, s => s.evaluation?.spin_evaluation?.I?.final_score)
        } : undefined,
        meet: meetEvaluations.length > 0 ? {
          avgScore: meetAvg.spin_i,
          callsCount: meetEvaluations.length
        } : undefined
      },
      pattern: detectPattern('spin_i', roleplaySessions, meetEvaluations),
      lastOccurrence: new Date(roleplaySessions[0]?.created_at || meetEvaluations[0]?.created_at || Date.now())
    })
  }

  // 4. SPIN N - Need-Payoff
  const spinNScore = calculateCombinedScore([roleplayAvg.spin_n, meetAvg.spin_n])
  if (spinNScore < WEAKNESS_THRESHOLD && (roleplaySessions.length > 0 || meetEvaluations.length > 0)) {
    weaknesses.push({
      target: 'spin_n',
      severity: getSeverity(spinNScore),
      confidence: calculateConfidence(roleplaySessions.length, meetEvaluations.length),
      currentScore: spinNScore,
      evidenceSources: {
        roleplay: roleplaySessions.length > 0 ? {
          avgScore: roleplayAvg.spin_n,
          sessionsCount: roleplaySessions.length,
          trend: calculateTrend(roleplaySessions, s => s.evaluation?.spin_evaluation?.N?.final_score)
        } : undefined,
        meet: meetEvaluations.length > 0 ? {
          avgScore: meetAvg.spin_n,
          callsCount: meetEvaluations.length
        } : undefined
      },
      pattern: detectPattern('spin_n', roleplaySessions, meetEvaluations),
      lastOccurrence: new Date(roleplaySessions[0]?.created_at || meetEvaluations[0]?.created_at || Date.now())
    })
  }

  // 5. Objection Handling
  if (roleplayAvg.objection_handling < WEAKNESS_THRESHOLD && roleplaySessions.length > 0) {
    weaknesses.push({
      target: 'objection_handling',
      severity: getSeverity(roleplayAvg.objection_handling),
      confidence: calculateConfidence(roleplaySessions.length, 0),
      currentScore: roleplayAvg.objection_handling,
      evidenceSources: {
        roleplay: {
          avgScore: roleplayAvg.objection_handling,
          sessionsCount: roleplaySessions.length,
          trend: calculateTrend(roleplaySessions, s => {
            const objections = s.evaluation?.objections_analysis
            if (!Array.isArray(objections) || objections.length === 0) return undefined
            return objections.reduce((sum: number, o: any) => sum + (o.score || 0), 0) / objections.length
          })
        }
      },
      pattern: 'Dificuldade em lidar com objeções durante as conversas',
      lastOccurrence: new Date(roleplaySessions[0]?.created_at || Date.now())
    })
  }

  // CROSS-SOURCE PATTERN DETECTION
  // Pattern: Low Implication across sources = Consistent urgency gap
  if (roleplayAvg.spin_i < 5.5 && meetAvg.spin_i < 5.5 && meetEvaluations.length > 0) {
    const existingI = weaknesses.find(w => w.target === 'spin_i')
    if (existingI) {
      existingI.confidence = Math.min(existingI.confidence + 0.2, 1)
      existingI.severity = 'critical'
      existingI.pattern = 'CROSS-SOURCE: Implicação baixa tanto em treino quanto em calls reais - gap crítico em criação de urgência'
    }
  }

  // Sort by severity (critical first) then by confidence (highest first)
  weaknesses.sort((a, b) => {
    const severityOrder = { critical: 0, moderate: 1, minor: 2 }
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity]
    }
    return b.confidence - a.confidence
  })

  return weaknesses
}

/**
 * Calculates combined score from multiple sources (weighted by sample size)
 */
function calculateCombinedScore(scores: number[]): number {
  const validScores = scores.filter(s => s > 0)
  if (validScores.length === 0) return 0
  return validScores.reduce((a, b) => a + b, 0) / validScores.length
}

/**
 * Calculates confidence based on data availability
 */
function calculateConfidence(roleplayCount: number, meetCount: number): number {
  let confidence = 0

  // Roleplay contributes up to 0.5
  if (roleplayCount >= 5) confidence += 0.5
  else if (roleplayCount >= 3) confidence += 0.35
  else if (roleplayCount >= 1) confidence += 0.2

  // Meet (real sales) contributes up to 0.5 (more weight because it's real)
  if (meetCount >= 5) confidence += 0.5
  else if (meetCount >= 3) confidence += 0.35
  else if (meetCount >= 1) confidence += 0.25

  return Math.min(confidence, 1)
}

/**
 * Detects patterns in SPIN weakness
 */
function detectPattern(spinLetter: string, roleplaySessions: any[], meetEvaluations: any[]): string {
  const patterns: string[] = []

  // Analyze roleplay patterns
  if (roleplaySessions.length >= 2) {
    const letterKey = spinLetter.replace('spin_', '').toUpperCase()

    // Look at indicators within SPIN
    for (const session of roleplaySessions.slice(0, 5)) {
      const indicators = session.evaluation?.spin_evaluation?.[letterKey]?.indicators
      if (indicators) {
        // Find consistently low indicators
        for (const [key, value] of Object.entries(indicators)) {
          if (typeof value === 'number' && value < 5) {
            patterns.push(`Low ${key.replace(/_/g, ' ')}`)
          }
        }
      }
    }
  }

  // Analyze missed opportunities from roleplay
  for (const session of roleplaySessions.slice(0, 3)) {
    const letterKey = spinLetter.replace('spin_', '').toUpperCase()
    const missedOpportunities = session.evaluation?.spin_evaluation?.[letterKey]?.missed_opportunities
    if (Array.isArray(missedOpportunities) && missedOpportunities.length > 0) {
      patterns.push(...missedOpportunities.slice(0, 2))
    }
  }

  // Remove duplicates and format
  const uniquePatterns = [...new Set(patterns)]
  if (uniquePatterns.length > 0) {
    return uniquePatterns.slice(0, 3).join('; ')
  }

  return `Score ${spinLetter.replace('spin_', '').toUpperCase()} consistentemente baixo`
}

/**
 * Ranks weaknesses for challenge generation
 * Returns the top weakness that should be targeted
 */
export function getTopWeakness(weaknesses: WeaknessAnalysis[]): WeaknessAnalysis | null {
  if (weaknesses.length === 0) return null

  // Already sorted by severity and confidence in analyzeWeaknesses
  return weaknesses[0]
}

/**
 * Gets the top N weaknesses for more complex challenge generation
 */
export function getTopWeaknesses(weaknesses: WeaknessAnalysis[], count: number = 3): WeaknessAnalysis[] {
  return weaknesses.slice(0, count)
}

/**
 * Formats weakness data for AI prompt
 */
export function formatWeaknessesForPrompt(userData: UserDataSummary): string {
  let prompt = `## ANÁLISE DE FRAQUEZAS DO VENDEDOR\n\n`

  // Overall stats
  prompt += `### Dados Disponíveis:\n`
  prompt += `- Roleplays analisados: ${userData.roleplaySessions.length}\n`
  prompt += `- Calls reais analisadas: ${userData.meetEvaluations.length}\n\n`

  // SPIN Averages
  prompt += `### Médias SPIN:\n`
  prompt += `| Fonte | S | P | I | N |\n`
  prompt += `|-------|---|---|---|---|\n`
  if (userData.roleplaySessions.length > 0) {
    prompt += `| Roleplay | ${userData.roleplayAverages.spin_s.toFixed(1)} | ${userData.roleplayAverages.spin_p.toFixed(1)} | ${userData.roleplayAverages.spin_i.toFixed(1)} | ${userData.roleplayAverages.spin_n.toFixed(1)} |\n`
  }
  if (userData.meetEvaluations.length > 0) {
    prompt += `| Calls Reais | ${userData.meetAverages.spin_s.toFixed(1)} | ${userData.meetAverages.spin_p.toFixed(1)} | ${userData.meetAverages.spin_i.toFixed(1)} | ${userData.meetAverages.spin_n.toFixed(1)} |\n`
  }

  // Detected weaknesses
  prompt += `\n### Fraquezas Detectadas (ordenadas por severidade):\n\n`

  for (const weakness of userData.weaknesses) {
    prompt += `**${weakness.target.toUpperCase()}** - Severidade: ${weakness.severity.toUpperCase()}\n`
    prompt += `- Score atual: ${weakness.currentScore.toFixed(1)}\n`
    prompt += `- Confiança: ${(weakness.confidence * 100).toFixed(0)}%\n`
    if (weakness.pattern) {
      prompt += `- Padrão detectado: ${weakness.pattern}\n`
    }
    if (weakness.evidenceSources.roleplay) {
      prompt += `- Roleplay: média ${weakness.evidenceSources.roleplay.avgScore.toFixed(1)} (${weakness.evidenceSources.roleplay.sessionsCount} sessões, tendência: ${weakness.evidenceSources.roleplay.trend})\n`
    }
    if (weakness.evidenceSources.meet) {
      prompt += `- Calls reais: média ${weakness.evidenceSources.meet.avgScore.toFixed(1)} (${weakness.evidenceSources.meet.callsCount} calls)\n`
    }
    prompt += `\n`
  }

  return prompt
}
