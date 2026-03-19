import { createClient } from '@supabase/supabase-js'
import { evaluateMeetTranscript } from './evaluateMeetTranscript'
import { generateSmartNotes } from './generateSmartNotes'
import { fetchTranscriptFromRecallApi, TranscriptSegment } from './recallApi'
import { classifyMeeting, getCompanyContext } from './classifyMeeting'

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
    // 4. Fetch transcript with progressive retries (Recall.ai needs time to process)
    const retryDelays = [10000, 20000, 30000, 40000] // 10s, 20s, 30s, 40s = up to 100s total
    let segments: TranscriptSegment[] = []

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      if (attempt > 0) {
        const waitMs = retryDelays[attempt - 1]
        console.log(`[MeetBG] No transcript yet, retry ${attempt}/${retryDelays.length} in ${waitMs / 1000}s...`)
        await delay(waitMs)
      }

      segments = await fetchTranscriptFromRecallApi(botId)
      if (segments.length > 0) break
    }

    if (segments.length === 0) {
      throw new Error('Transcrição vazia - Recall.ai não retornou dados após 4 tentativas (~100s)')
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

    // 6b. Classify meeting type before evaluating
    const companyContext = company_id ? await getCompanyContext(company_id) : undefined
    const classification = await classifyMeeting(transcriptText, companyContext)
    const isSales = classification.meeting_type === 'sales'

    let evalData: any = null
    let smartNotes: any = null
    let overallScore = 0

    if (isSales) {
      // === SALES: Full pipeline ===
      const [evalResult, notesResult] = await Promise.allSettled([
        evaluateMeetTranscript({
          transcript: transcriptText,
          meetingId: botId,
          companyId: company_id,
          hasSpeakerLabels: true
        }),
        generateSmartNotes({
          transcript: transcriptText,
          companyId: company_id
        })
      ])

      const result = evalResult.status === 'fulfilled' ? evalResult.value : null
      if (!result?.success || !result.evaluation) {
        throw new Error(result?.error || 'Avaliação falhou')
      }
      evalData = result.evaluation

      smartNotes = notesResult.status === 'fulfilled' && notesResult.value.success
        ? notesResult.value.notes : null
      if (notesResult.status === 'rejected') {
        console.error(`[MeetBG] Smart notes generation failed (non-fatal):`, notesResult.reason)
      }

      overallScore = evalData.overall_score
      if (overallScore && overallScore <= 10) overallScore = overallScore * 10
      overallScore = Math.round(overallScore || 0)
    } else {
      // === NON-SALES: Only Smart Notes ===
      console.log(`[MeetBG] Non-sales meeting (${classification.category}), skipping SPIN evaluation`)
      const notesResult = await generateSmartNotes({ transcript: transcriptText, companyId: company_id }).catch(() => null)
      smartNotes = notesResult?.success ? notesResult.notes : null
    }

    // 8. Save to meet_evaluations
    const { data: savedEval, error: evalError } = await supabaseAdmin
      .from('meet_evaluations')
      .insert({
        user_id,
        company_id,
        meeting_id: botId,
        seller_name: isSales ? (evalData?.seller_identification?.name || 'Não identificado') : 'N/A',
        call_objective: null,
        funnel_stage: null,
        transcript: segments,
        evaluation: evalData || { meeting_type: 'non_sales', category: classification.category },
        overall_score: overallScore,
        performance_level: isSales ? (evalData?.performance_level || 'needs_improvement') : null,
        spin_s_score: isSales ? (evalData?.spin_evaluation?.S?.final_score || 0) : null,
        spin_p_score: isSales ? (evalData?.spin_evaluation?.P?.final_score || 0) : null,
        spin_i_score: isSales ? (evalData?.spin_evaluation?.I?.final_score || 0) : null,
        spin_n_score: isSales ? (evalData?.spin_evaluation?.N?.final_score || 0) : null,
        smart_notes: smartNotes,
        meeting_category: classification.meeting_type,
        meeting_category_detail: classification.category,
      })
      .select('id')
      .single()

    if (evalError) {
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

    console.log(`[MeetBG] Evaluation saved: ${savedEval.id} (${classification.meeting_type}/${classification.category})`)

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
    if (isSales) {
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
    } else {
      await supabaseAdmin
        .from('user_notifications')
        .insert({
          user_id,
          type: 'meet_evaluation_ready',
          title: 'Resumo de reunião pronto!',
          message: `Sua reunião (${classification.category}) foi resumida.`,
          data: {
            evaluationId: savedEval.id,
            meetingCategory: classification.category,
            source: 'non_sales',
          }
        })
    }

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
      console.warn(`[MeetBG] Calendar bot update skipped for ${botId}`)
    }

    // 11-12. Simulation + ML patterns — ONLY for sales meetings
    if (isSales) {
      // 11. Generate correction simulation (fire-and-forget)
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

      // 12. Extract ML patterns (fire-and-forget)
      try {
        console.log(`[MeetBG] Extracting ML patterns for evaluation ${savedEval.id}`)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ramppy.site'
        fetch(`${appUrl}/api/meet/extract-patterns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetEvaluationId: savedEval.id,
            transcript: segments,
            evaluation: evalData,
            companyId: company_id,
          })
        }).then(res => {
          if (res.ok) console.log(`[MeetBG] ML pattern extraction started for ${savedEval.id}`)
          else console.error(`[MeetBG] ML pattern extraction failed: ${res.status}`)
        }).catch(err => {
          console.error(`[MeetBG] ML pattern extraction error (non-fatal):`, err.message)
        })
      } catch (mlError: any) {
        console.error(`[MeetBG] ML pattern extraction setup error (non-fatal):`, mlError.message)
      }
    } else {
      console.log(`[MeetBG] Skipping simulation + ML patterns for non-sales meeting`)
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
