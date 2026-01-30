import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch challenge history for a user
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '30')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      )
    }

    // Fetch challenges ordered by date (newest first)
    const { data: challenges, error } = await supabaseAdmin
      .from('daily_challenges')
      .select(`
        id,
        challenge_date,
        status,
        difficulty_level,
        challenge_config,
        ai_reasoning,
        roleplay_session_id,
        result_score,
        success,
        improvement_from_baseline,
        created_at,
        completed_at
      `)
      .eq('user_id', userId)
      .order('challenge_date', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    // For completed challenges, fetch the roleplay session evaluation
    const challengesWithEvaluations = await Promise.all(
      (challenges || []).map(async (challenge) => {
        if (challenge.roleplay_session_id && challenge.status === 'completed') {
          const { data: session } = await supabaseAdmin
            .from('roleplay_sessions')
            .select('evaluation, created_at')
            .eq('id', challenge.roleplay_session_id)
            .single()

          return {
            ...challenge,
            evaluation: session?.evaluation || null,
            session_date: session?.created_at || null
          }
        }
        return {
          ...challenge,
          evaluation: null,
          session_date: null
        }
      })
    )

    // Calculate stats
    const stats = {
      total: challenges?.length || 0,
      completed: challenges?.filter(c => c.status === 'completed').length || 0,
      skipped: challenges?.filter(c => c.status === 'skipped').length || 0,
      pending: challenges?.filter(c => c.status === 'pending' || c.status === 'in_progress').length || 0,
      successRate: 0,
      avgImprovement: 0
    }

    const completedWithSuccess = challenges?.filter(c => c.status === 'completed' && c.success !== null) || []
    if (completedWithSuccess.length > 0) {
      stats.successRate = (completedWithSuccess.filter(c => c.success).length / completedWithSuccess.length) * 100
    }

    const withImprovement = challenges?.filter(c => c.improvement_from_baseline !== null) || []
    if (withImprovement.length > 0) {
      stats.avgImprovement = withImprovement.reduce((acc, c) => acc + (c.improvement_from_baseline || 0), 0) / withImprovement.length
    }

    return NextResponse.json({
      success: true,
      challenges: challengesWithEvaluations,
      stats
    })

  } catch (error) {
    console.error('💥 [challenges/history] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}
