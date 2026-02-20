import { createClient } from '@supabase/supabase-js'
import { evaluateMeetTranscript } from './evaluateMeetTranscript'
import { generateSmartNotes } from './generateSmartNotes'
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

    // 7. Run SPIN evaluation AND smart notes in parallel
    const [evalResult, notesResult] = await Promise.allSettled([
      evaluateMeetTranscript({
        transcript: transcriptText,
        meetingId: botId,
        companyId: company_id
      }),
      generateSmartNotes({
        transcript: transcriptText,
        companyId: company_id
      })
    ])

    // Extract evaluation (required)
    const result = evalResult.status === 'fulfilled' ? evalResult.value : null
    if (!result?.success || !result.evaluation) {
      throw new Error(result?.error || 'Avaliação falhou')
    }
    const evalData = result.evaluation

    // Extract smart notes (optional — failure does NOT block evaluation)
    const smartNotes = notesResult.status === 'fulfilled' && notesResult.value.success
      ? notesResult.value.notes : null
    if (notesResult.status === 'rejected') {
      console.error(`[MeetBG] Smart notes generation failed (non-fatal):`, notesResult.reason)
    } else if (notesResult.status === 'fulfilled' && !notesResult.value.success) {
      console.warn(`[MeetBG] Smart notes generation returned error: ${notesResult.value.error}`)
    }

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
        spin_n_score: evalData.spin_evaluation?.N?.final_score || 0,
        smart_notes: smartNotes
      })
      .select('id')
      .single()

    if (evalError) {
      // Handle unique constraint violation (frontend may have saved first)
      if (evalError.code === '23505') {
        console.log(`[MeetBG] Evaluation already saved by frontend for bot ${botId}, skipping`)
        const { data: existing } = await supabaseAdmin
          .from('meet_evaluations')
          .select('id')
          .eq('meeting_id', botId)
          .single()

        if (existing) {
          await supabaseAdmin
            .from('meet_bot_sessions')
            .update({ status: 'completed', evaluation_id: existing.id, updated_at: new Date().toISOString() })
            .eq('bot_id', botId)
        }
        return
      }
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

    // 10b. Update calendar_scheduled_bots if this bot was auto-scheduled
    try {
      await supabaseAdmin
        .from('calendar_scheduled_bots')
        .update({
          bot_status: 'completed',
          evaluation_id: savedEval.id,
          updated_at: new Date().toISOString(),
        })
        .eq('bot_id', botId)
    } catch (calErr) {
      // Non-fatal — calendar bot may not exist (manual URL submissions)
      console.warn(`[MeetBG] Calendar bot update skipped for ${botId}`)
    }

    // 11. Generate correction simulation (fire-and-forget, don't fail evaluation)
    try {
      console.log(`[MeetBG] Generating correction simulation for bot ${botId}`)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ramppy.site'
      const simResponse = await fetch(`${appUrl}/api/meet/generate-simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluation: evalData,
          transcript: transcriptText,
          companyId: company_id
        })
      })

      if (simResponse.ok) {
        const simData = await simResponse.json()
        if (simData.success && simData.simulationConfig) {
          await supabaseAdmin
            .from('saved_simulations')
            .insert({
              user_id,
              company_id,
              simulation_config: simData.simulationConfig,
              simulation_justification: simData.simulationConfig.simulation_justification || null,
              meeting_context: simData.simulationConfig.meeting_context || null,
              meet_evaluation_id: savedEval.id,
              status: 'pending'
            })
          console.log(`[MeetBG] Simulation saved for evaluation ${savedEval.id}`)
        }
      } else {
        console.error(`[MeetBG] Simulation generation failed: ${simResponse.status}`)
      }
    } catch (simError: any) {
      console.error(`[MeetBG] Error generating simulation (non-fatal):`, simError.message)
    }

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
