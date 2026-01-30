import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { trackChallengeCompletion } from '@/lib/challenges/trackChallengeEffectiveness'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { challengeId, roleplaySessionId } = body

    if (!challengeId || !roleplaySessionId) {
      return NextResponse.json(
        { error: 'challengeId e roleplaySessionId são obrigatórios' },
        { status: 400 }
      )
    }

    // Fetch the roleplay session evaluation
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplay_sessions')
      .select('evaluation')
      .eq('id', roleplaySessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Sessão de roleplay não encontrada' },
        { status: 404 }
      )
    }

    if (!session.evaluation) {
      return NextResponse.json(
        { error: 'A sessão ainda não foi avaliada' },
        { status: 400 }
      )
    }

    // Track challenge completion
    const result = await trackChallengeCompletion({
      challengeId,
      roleplaySessionId,
      evaluation: session.evaluation
    })

    if (!result.success) {
      return NextResponse.json(
        { error: 'Erro ao registrar conclusão do desafio' },
        { status: 500 }
      )
    }

    // Fetch updated challenge data
    const { data: challenge } = await supabaseAdmin
      .from('daily_challenges')
      .select('*')
      .eq('id', challengeId)
      .single()

    return NextResponse.json({
      success: true,
      challenge,
      improvement: result.improvement,
      mastered: result.mastered,
      message: result.mastered
        ? '🎉 Parabéns! Você dominou esta habilidade!'
        : result.improvement && result.improvement > 0
          ? `📈 Melhoria de ${result.improvement.toFixed(1)} pontos!`
          : 'Desafio concluído!'
    })

  } catch (error) {
    console.error('💥 [challenges/complete] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// PATCH - Update challenge status (skip, start)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { challengeId, status } = body

    if (!challengeId || !status) {
      return NextResponse.json(
        { error: 'challengeId e status são obrigatórios' },
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'skipped']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Status inválido' },
        { status: 400 }
      )
    }

    const updateData: any = { status }
    if (status === 'skipped') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data: challenge, error } = await supabaseAdmin
      .from('daily_challenges')
      .update(updateData)
      .eq('id', challengeId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      challenge
    })

  } catch (error) {
    console.error('💥 [challenges/complete PATCH] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}
