import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    // Validate auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { transcript, evaluation, smartNotes, meetingId, companyId, sellerName } = body

    if (!transcript || !evaluation || !meetingId || !companyId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate overall_score as integer 0-100
    let overallScore = evaluation.overall_score
    if (overallScore && overallScore <= 10) {
      overallScore = overallScore * 10
    }

    const insertData = {
      user_id: user.id,
      company_id: companyId,
      meeting_id: meetingId,
      seller_name: sellerName || evaluation.seller_identification?.name || 'Não identificado',
      transcript,
      evaluation,
      overall_score: Math.round(overallScore || 0),
      performance_level: evaluation.performance_level || 'needs_improvement',
      spin_s_score: evaluation.spin_evaluation?.S?.final_score || 0,
      spin_p_score: evaluation.spin_evaluation?.P?.final_score || 0,
      spin_i_score: evaluation.spin_evaluation?.I?.final_score || 0,
      spin_n_score: evaluation.spin_evaluation?.N?.final_score || 0,
      ...(smartNotes ? { smart_notes: smartNotes } : {})
    }

    // Check if already exists
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existing } = await supabaseAdmin
      .from('meet_evaluations')
      .select('id')
      .eq('meeting_id', meetingId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, evaluationId: existing.id, alreadyExists: true })
    }

    const { data, error } = await supabaseAdmin
      .from('meet_evaluations')
      .insert(insertData)
      .select('id')
      .single()

    if (error) {
      console.error('❌ Erro ao salvar avaliação:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create notification for the user (same type as Recall.ai flow)
    const scoreDisplay = evaluation.overall_score !== undefined
      ? (evaluation.overall_score <= 10 ? evaluation.overall_score.toFixed(1) : (evaluation.overall_score / 10).toFixed(1))
      : '0'

    await supabaseAdmin.from('user_notifications').insert({
      user_id: user.id,
      type: 'meet_evaluation_ready',
      title: 'Analise de reuniao pronta!',
      message: `Sua reuniao foi avaliada. Score: ${scoreDisplay}/10`,
      data: {
        evaluationId: data.id,
        overallScore: insertData.overall_score,
        performanceLevel: insertData.performance_level,
        sellerName: insertData.seller_name,
        source: 'desktop_recording'
      }
    }).then(({ error: notifError }) => {
      if (notifError) console.error('❌ Erro ao criar notificação:', notifError)
    })

    // Extract ML patterns (fire-and-forget, non-blocking)
    if (data?.id && companyId) {
      try {
        const host = request.headers.get('host') || 'localhost:3000'
        const protocol = host.includes('localhost') ? 'http' : 'https'
        const appUrl = `${protocol}://${host}`
        fetch(`${appUrl}/api/meet/extract-patterns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetEvaluationId: data.id,
            transcript,
            evaluation,
            companyId,
          })
        }).then(res => {
          if (res.ok) console.log(`[DesktopRecording] ML pattern extraction started for ${data.id}`)
          else console.error(`[DesktopRecording] ML pattern extraction failed: ${res.status}`)
        }).catch(err => {
          console.error(`[DesktopRecording] ML pattern extraction error:`, err.message)
        })
      } catch (mlErr: any) {
        console.error('[DesktopRecording] ML setup error (non-fatal):', mlErr.message)
      }
    }

    return NextResponse.json({ success: true, evaluationId: data.id })

  } catch (error: any) {
    console.error('❌ Erro ao salvar gravação desktop:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
