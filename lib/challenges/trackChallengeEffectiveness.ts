import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface ChallengeResult {
  challengeId: string
  roleplaySessionId: string
  evaluation: any
}

/**
 * Updates challenge status and tracks effectiveness after completing a challenge roleplay
 */
export async function trackChallengeCompletion(result: ChallengeResult): Promise<{
  success: boolean
  improvement: number | null
  mastered: boolean
}> {
  try {
    // Fetch the challenge
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from('daily_challenges')
      .select('*')
      .eq('id', result.challengeId)
      .single()

    if (challengeError || !challenge) {
      console.error('Challenge not found:', challengeError)
      return { success: false, improvement: null, mastered: false }
    }

    // Extract the target score based on challenge config
    const config = challenge.challenge_config
    const targetWeakness = config.target_weakness
    const successCriteria = config.success_criteria

    // Get the relevant score from evaluation
    let resultScore = 0
    const evaluation = result.evaluation

    if (targetWeakness.startsWith('spin_')) {
      const spinLetter = targetWeakness.replace('spin_', '').toUpperCase()
      resultScore = evaluation?.spin_evaluation?.[spinLetter]?.final_score ?? 0
    } else if (targetWeakness === 'objection_handling') {
      const objections = evaluation?.objections_analysis
      if (Array.isArray(objections) && objections.length > 0) {
        resultScore = objections.reduce((sum: number, o: any) => sum + (o.score || 0), 0) / objections.length
      }
    }

    // Determine success
    const minScore = successCriteria?.spin_min_score || 6.0
    const success = resultScore >= minScore

    // Update challenge
    const { error: updateError } = await supabaseAdmin
      .from('daily_challenges')
      .update({
        status: 'completed',
        roleplay_session_id: result.roleplaySessionId,
        result_score: resultScore,
        success,
        completed_at: new Date().toISOString()
      })
      .eq('id', result.challengeId)

    if (updateError) {
      console.error('Error updating challenge:', updateError)
      return { success: false, improvement: null, mastered: false }
    }

    // Update or create effectiveness record
    const { data: effectiveness, error: effectivenessError } = await supabaseAdmin
      .from('challenge_effectiveness')
      .select('*')
      .eq('user_id', challenge.user_id)
      .eq('target_weakness', targetWeakness)
      .single()

    let improvement: number | null = null
    let mastered = false

    if (effectiveness) {
      // Update existing record
      improvement = resultScore - effectiveness.baseline_score
      mastered = resultScore >= 7.5

      const newStatus = mastered ? 'mastered' :
        (effectiveness.challenges_completed >= 5 && improvement <= 0.5) ? 'stalled' : 'active'

      await supabaseAdmin
        .from('challenge_effectiveness')
        .update({
          challenges_completed: effectiveness.challenges_completed + 1,
          current_score: resultScore,
          total_improvement: effectiveness.total_improvement + Math.max(0, improvement),
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', effectiveness.id)

      // Also update the improvement on the challenge record
      await supabaseAdmin
        .from('daily_challenges')
        .update({ improvement_from_baseline: improvement })
        .eq('id', result.challengeId)

    } else if (!effectivenessError || effectivenessError.code === 'PGRST116') {
      // Create new effectiveness record (this is the baseline)
      await supabaseAdmin
        .from('challenge_effectiveness')
        .insert({
          user_id: challenge.user_id,
          company_id: challenge.company_id,
          target_weakness: targetWeakness,
          baseline_score: resultScore,
          challenges_completed: 1,
          current_score: resultScore,
          total_improvement: 0,
          status: 'active'
        })
    }

    return { success: true, improvement, mastered }
  } catch (error) {
    console.error('Error tracking challenge effectiveness:', error)
    return { success: false, improvement: null, mastered: false }
  }
}

/**
 * Calculates the next difficulty level based on recent performance
 */
export async function calculateNextDifficulty(
  userId: string,
  targetWeakness: string
): Promise<number> {
  try {
    // Get last 5 challenges for this weakness
    const { data: recentChallenges } = await supabaseAdmin
      .from('daily_challenges')
      .select('difficulty_level, success')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5)

    if (!recentChallenges || recentChallenges.length === 0) {
      // First challenge - start at level 1 for critical, 3 for moderate
      const { data: effectiveness } = await supabaseAdmin
        .from('challenge_effectiveness')
        .select('baseline_score')
        .eq('user_id', userId)
        .eq('target_weakness', targetWeakness)
        .single()

      if (effectiveness && effectiveness.baseline_score < 4.5) {
        return 1 // Critical weakness - start easy
      }
      return 3 // Moderate weakness - start medium
    }

    // Calculate success rate
    const successCount = recentChallenges.filter(c => c.success).length
    const successRate = successCount / recentChallenges.length
    const currentLevel = recentChallenges[0].difficulty_level || 3

    // Adjust difficulty
    if (successRate >= 0.8) {
      // Very successful - increase difficulty
      return Math.min(currentLevel + 1, 5)
    } else if (successRate <= 0.3) {
      // Struggling - decrease difficulty
      return Math.max(currentLevel - 1, 1)
    }

    // Check for consecutive wins/losses
    let consecutiveWins = 0
    let consecutiveLosses = 0
    for (const c of recentChallenges) {
      if (c.success) {
        consecutiveWins++
        consecutiveLosses = 0
      } else {
        consecutiveLosses++
        consecutiveWins = 0
      }
      if (consecutiveWins >= 3 || consecutiveLosses >= 3) break
    }

    if (consecutiveWins >= 3) {
      return Math.min(currentLevel + 1, 5)
    } else if (consecutiveLosses >= 3) {
      return Math.max(currentLevel - 1, 1)
    }

    return currentLevel // Keep same difficulty
  } catch (error) {
    console.error('Error calculating difficulty:', error)
    return 3 // Default to medium
  }
}

/**
 * Gets user's challenge history and effectiveness summary
 */
export async function getUserChallengeStats(userId: string): Promise<{
  totalChallenges: number
  completed: number
  successRate: number
  currentStreak: number
  weaknessProgress: Array<{
    weakness: string
    baseline: number
    current: number
    improvement: number
    status: string
  }>
}> {
  try {
    // Get all challenges
    const { data: challenges } = await supabaseAdmin
      .from('daily_challenges')
      .select('status, success, completed_at')
      .eq('user_id', userId)
      .order('challenge_date', { ascending: false })

    // Get effectiveness records
    const { data: effectiveness } = await supabaseAdmin
      .from('challenge_effectiveness')
      .select('target_weakness, baseline_score, current_score, total_improvement, status')
      .eq('user_id', userId)

    const totalChallenges = challenges?.length || 0
    const completed = challenges?.filter(c => c.status === 'completed').length || 0
    const successful = challenges?.filter(c => c.success).length || 0
    const successRate = completed > 0 ? successful / completed : 0

    // Calculate current streak
    let currentStreak = 0
    for (const c of (challenges || [])) {
      if (c.success) currentStreak++
      else break
    }

    // Format weakness progress
    const weaknessProgress = (effectiveness || []).map(e => ({
      weakness: e.target_weakness,
      baseline: e.baseline_score,
      current: e.current_score,
      improvement: e.total_improvement,
      status: e.status
    }))

    return {
      totalChallenges,
      completed,
      successRate,
      currentStreak,
      weaknessProgress
    }
  } catch (error) {
    console.error('Error getting challenge stats:', error)
    return {
      totalChallenges: 0,
      completed: 0,
      successRate: 0,
      currentStreak: 0,
      weaknessProgress: []
    }
  }
}
