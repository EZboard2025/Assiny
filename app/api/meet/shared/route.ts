import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Get shares where current user is the recipient
    const { data: shares, error } = await supabaseAdmin
      .from('shared_meet_evaluations')
      .select('*')
      .eq('shared_with', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[Meet Shared] Error fetching shares:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!shares?.length) {
      return NextResponse.json({ shares: [] })
    }

    // Get evaluation data for each share
    const evaluationIds = [...new Set(shares.map(s => s.evaluation_id))]
    const { data: evaluations } = await supabaseAdmin
      .from('meet_evaluations')
      .select('id, seller_name, overall_score, performance_level, spin_s_score, spin_p_score, spin_i_score, spin_n_score, smart_notes, transcript, evaluation, created_at, call_objective, funnel_stage')
      .in('id', evaluationIds)

    // Get sender names
    const senderIds = [...new Set(shares.map(s => s.shared_by))]
    const { data: senders } = await supabaseAdmin
      .from('employees')
      .select('user_id, name')
      .in('user_id', senderIds)

    const evalMap = new Map(evaluations?.map(e => [e.id, e]) || [])
    const senderMap = new Map(senders?.map(s => [s.user_id, s.name]) || [])

    // Build response filtering by allowed sections
    const result = shares.map(share => {
      const eval_ = evalMap.get(share.evaluation_id)
      if (!eval_) return null

      const sections = share.shared_sections as string[]

      return {
        id: share.id,
        evaluation_id: share.evaluation_id,
        shared_by: share.shared_by,
        shared_by_name: senderMap.get(share.shared_by) || 'Desconhecido',
        shared_sections: sections,
        message: share.message,
        is_viewed: share.is_viewed,
        created_at: share.created_at,
        evaluation: {
          seller_name: eval_.seller_name,
          overall_score: eval_.overall_score,
          performance_level: eval_.performance_level,
          call_objective: eval_.call_objective,
          funnel_stage: eval_.funnel_stage,
          created_at: eval_.created_at,
          // Only include sections the sender allowed
          smart_notes: sections.includes('smart_notes') ? eval_.smart_notes : null,
          transcript: sections.includes('transcript') ? eval_.transcript : null,
          evaluation: sections.includes('evaluation') ? eval_.evaluation : null,
          spin_s_score: sections.includes('spin') ? eval_.spin_s_score : null,
          spin_p_score: sections.includes('spin') ? eval_.spin_p_score : null,
          spin_i_score: sections.includes('spin') ? eval_.spin_i_score : null,
          spin_n_score: sections.includes('spin') ? eval_.spin_n_score : null,
        },
      }
    }).filter(Boolean)

    return NextResponse.json({ shares: result })

  } catch (error: any) {
    console.error('[Meet Shared] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Mark share as viewed
export async function PATCH(req: NextRequest) {
  try {
    const { shareId, userId } = await req.json()

    if (!shareId || !userId) {
      return NextResponse.json({ error: 'shareId and userId are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('shared_meet_evaluations')
      .update({ is_viewed: true, viewed_at: new Date().toISOString() })
      .eq('id', shareId)
      .eq('shared_with', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
