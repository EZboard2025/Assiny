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

    // If the evaluation has challenge_performance (from N8N challenge-aware evaluation),
    // use the achieved_score directly as it's the most accurate score for the challenge
    if (evaluation?.challenge_performance?.achieved_score !== undefined) {
      resultScore = evaluation.challenge_performance.achieved_score
      console.log('📊 Using challenge_performance.achieved_score:', resultScore)
    } else if (targetWeakness.startsWith('spin_')) {
      // Fallback to extracting from regular SPIN evaluation
      const spinLetter = targetWeakness.replace('spin_', '').toUpperCase()
      resultScore = evaluation?.spin_evaluation?.[spinLetter]?.final_score ?? 0
      console.log('📊 Using spin_evaluation fallback:', spinLetter, resultScore)
    } else if (targetWeakness === 'objection_handling') {
      const objections = evaluation?.objections_analysis
      if (Array.isArray(objections) && objections.length > 0) {
        resultScore = objections.reduce((sum: number, o: any) => sum + (o.score || 0), 0) / objections.length
      }
      console.log('📊 Using objection_handling fallback:', resultScore)
    }

    // Determine success - use challenge_performance.goal_achieved if available
    let success: boolean
    if (evaluation?.challenge_performance?.goal_achieved !== undefined) {
      success = evaluation.challenge_performance.goal_achieved
      console.log('📊 Using challenge_performance.goal_achieved:', success)
    } else {
      const minScore = successCriteria?.spin_min_score || 6.0
      success = resultScore >= minScore
      console.log('📊 Using score comparison fallback:', resultScore, '>=', minScore, '=', success)
    }

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
 * Good sellers get harder challenges!
 */
export async function calculateNextDifficulty(
  userId: string,
  targetWeakness: string
): Promise<number> {
  try {
    // Get user's overall performance to determine base difficulty
    const { data: performanceSummary } = await supabaseAdmin
      .from('user_performance_summaries')
      .select('overall_average, spin_s_average, spin_p_average, spin_i_average, spin_n_average')
      .eq('user_id', userId)
      .single()

    // Calculate user's average SPIN score
    let userAvgScore = 5.0 // Default if no data
    if (performanceSummary) {
      const scores = [
        performanceSummary.spin_s_average,
        performanceSummary.spin_p_average,
        performanceSummary.spin_i_average,
        performanceSummary.spin_n_average
      ].filter(s => s !== null && s !== undefined)

      if (scores.length > 0) {
        userAvgScore = scores.reduce((a, b) => a + b, 0) / scores.length
      } else if (performanceSummary.overall_average) {
        userAvgScore = performanceSummary.overall_average
      }
    }

    // Determine BASE difficulty based on user's overall performance
    // Good sellers (avg >= 6.5) start at level 4
    // Average sellers (avg 5-6.5) start at level 3
    // Struggling sellers (avg < 5) start at level 2
    let baseDifficulty: number
    if (userAvgScore >= 7.0) {
      baseDifficulty = 5 // Excellent seller - hardest challenges
    } else if (userAvgScore >= 6.0) {
      baseDifficulty = 4 // Good seller - hard challenges
    } else if (userAvgScore >= 5.0) {
      baseDifficulty = 3 // Average - medium challenges
    } else if (userAvgScore >= 4.0) {
      baseDifficulty = 2 // Below average - easier challenges
    } else {
      baseDifficulty = 1 // Struggling - easiest challenges
    }

    console.log(`📊 User avg score: ${userAvgScore.toFixed(1)} → Base difficulty: ${baseDifficulty}`)

    // Get last 5 challenges to see if we need to adjust
    const { data: recentChallenges } = await supabaseAdmin
      .from('daily_challenges')
      .select('difficulty_level, success')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5)

    if (!recentChallenges || recentChallenges.length === 0) {
      // No challenge history - use base difficulty from performance
      return baseDifficulty
    }

    // Calculate success rate
    const successCount = recentChallenges.filter(c => c.success).length
    const successRate = successCount / recentChallenges.length
    const currentLevel = recentChallenges[0].difficulty_level || baseDifficulty

    // Adjust difficulty based on recent challenge results
    let adjustedLevel = currentLevel

    if (successRate >= 0.8) {
      // Very successful - increase difficulty
      adjustedLevel = Math.min(currentLevel + 1, 5)
    } else if (successRate <= 0.2) {
      // Really struggling - decrease difficulty
      adjustedLevel = Math.max(currentLevel - 1, 1)
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
      adjustedLevel = Math.min(currentLevel + 1, 5)
    } else if (consecutiveLosses >= 3) {
      adjustedLevel = Math.max(currentLevel - 1, 1)
    }

    // Never go below the base difficulty for good sellers
    // This prevents good sellers from getting easy challenges
    const finalLevel = Math.max(adjustedLevel, Math.min(baseDifficulty, 3))

    console.log(`📊 Challenge history: ${successCount}/${recentChallenges.length} success → Level: ${finalLevel}`)

    return finalLevel
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
