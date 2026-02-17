import { createClient } from '@supabase/supabase-js'
import { evaluateMeetTranscript } from './evaluateMeetTranscript'
import { fetchTranscriptFromRecallApi, TranscriptSegment } from './recallApi'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function processCompletedBot(botId: string): Promise<void> {
  console.log(`[MeetBG] Processing completed bot: ${botId}`)

  // 1. Look up bot session in DB
  const { data: botSession, error: sessionError } = await supabaseAdmin
    .from('meet_bot_sessions')
    .select('*')
    .eq('bot_id', botId)
    .single()

  if (sessionError || !botSession) {
    console.error(`[MeetBG] Bot session not found for ${botId}:`, sessionError)
    return
  }

  const { user_id, company_id } = botSession

  // 2. Check if evaluation already exists (prevent duplicates - frontend may have already evaluated)
  const { data: existingEval } = await supabaseAdmin
    .from('meet_evaluations')
    .select('id')
    .eq('meeting_id', botId)
    .single()

  if (existingEval) {
    console.log(`[MeetBG] Evaluation already exists for bot ${botId}, skipping`)
    await supabaseAdmin
      .from('meet_bot_sessions')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('bot_id', botId)
    return
  }

  // 3. Update status to processing
  await supabaseAdmin
    .from('meet_bot_sessions')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('bot_id', botId)

  try {
    // 4. Wait for Recall.ai to finalize transcript processing
    await delay(5000)

    // 5. Fetch transcript from Recall.ai API
    let segments = await fetchTranscriptFromRecallApi(botId)

    // Retry once if empty (Recall may need more time)
    if (segments.length === 0) {
      console.log(`[MeetBG] No transcript yet, retrying in 10s...`)
      await delay(10000)
      segments = await fetchTranscriptFromRecallApi(botId)
    }

    if (segments.length === 0) {
      throw new Error('Transcrição vazia - Recall.ai não retornou dados')
    }

    console.log(`[MeetBG] Got ${segments.length} transcript segments`)

    // Save transcript to bot session
    await supabaseAdmin
      .from('meet_bot_sessions')
      .update({
        transcript: segments,
        status: 'evaluating',
        updated_at: new Date().toISOString()
      })
      .eq('bot_id', botId)

    // 6. Format transcript for evaluation
    const transcriptText = segments
      .map((s: TranscriptSegment) => `${s.speaker}: ${s.text}`)
      .join('\n')

    // 7. Run SPIN evaluation
    const result = await evaluateMeetTranscript({
      transcript: transcriptText,
      meetingId: botId,
      companyId: company_id
    })

    if (!result.success || !result.evaluation) {
      throw new Error(result.error || 'Avaliação falhou')
    }

    const evalData = result.evaluation

    // 8. Save to meet_evaluations
    let overallScore = evalData.overall_score
    if (overallScore && overallScore <= 10) {
      overallScore = overallScore * 10
    }

    const { data: savedEval, error: evalError } = await supabaseAdmin
      .from('meet_evaluations')
      .insert({
        user_id,
        company_id,
        meeting_id: botId,
        seller_name: evalData.seller_identification?.name || 'Não identificado',
        call_objective: null,
        funnel_stage: null,
        transcript: segments,
        evaluation: evalData,
        overall_score: Math.round(overallScore || 0),
        performance_level: evalData.performance_level || 'needs_improvement',
        spin_s_score: evalData.spin_evaluation?.S?.final_score || 0,
        spin_p_score: evalData.spin_evaluation?.P?.final_score || 0,
        spin_i_score: evalData.spin_evaluation?.I?.final_score || 0,
        spin_n_score: evalData.spin_evaluation?.N?.final_score || 0
      })
      .select('id')
      .single()

    if (evalError) {
      throw new Error(`Erro ao salvar avaliação: ${evalError.message}`)
    }

    console.log(`[MeetBG] Evaluation saved: ${savedEval.id}`)

    // 9. Update bot session as completed
    await supabaseAdmin
      .from('meet_bot_sessions')
      .update({
        status: 'completed',
        evaluation_id: savedEval.id,
        updated_at: new Date().toISOString()
      })
      .eq('bot_id', botId)

    // 10. Create notification
    const scoreDisplay = evalData.overall_score?.toFixed(1) || '?'
    await supabaseAdmin
      .from('user_notifications')
      .insert({
        user_id,
        type: 'meet_evaluation_ready',
        title: 'Análise de Meet pronta!',
        message: `Sua reunião foi avaliada. Score: ${scoreDisplay}/10`,
        data: {
          evaluationId: savedEval.id,
          overallScore: evalData.overall_score,
          performanceLevel: evalData.performance_level,
          sellerName: evalData.seller_identification?.name || 'Não identificado'
        }
      })

    console.log(`[MeetBG] Notification created for user ${user_id}`)

  } catch (error: any) {
    console.error(`[MeetBG] Error processing bot ${botId}:`, error)

    // Update bot session with error
    await supabaseAdmin
      .from('meet_bot_sessions')
      .update({
        status: 'error',
        error_message: error.message || 'Erro desconhecido',
        updated_at: new Date().toISOString()
      })
      .eq('bot_id', botId)

    // Create error notification
    await supabaseAdmin
      .from('user_notifications')
      .insert({
        user_id,
        type: 'meet_evaluation_error',
        title: 'Erro na análise de Meet',
        message: error.message || 'Ocorreu um erro ao processar sua reunião.',
        data: { botId, error: error.message }
      })
  }
}
