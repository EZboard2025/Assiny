import { createClient } from '@supabase/supabase-js'
import { evaluateMeetTranscript } from './evaluateMeetTranscript'
import { generateSmartNotes } from './generateSmartNotes'
import OpenAI from 'openai'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function cleanTranscript(rawText: string): Promise<string> {
  try {
    console.log(`[DesktopBG] Cleaning ${rawText.length} chars with gpt-4.1-nano...`)
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        {
          role: 'system',
          content: `Você é um revisor de transcrições de reuniões em português brasileiro.
Sua tarefa é limpar a transcrição bruta mantendo 100% do conteúdo original.

Regras:
- Corrija acentuação (reuniao → reunião, voce → você, etc.)
- Adicione pontuação natural (vírgulas, pontos, interrogações) onde faz sentido
- Corrija capitalização (início de frases, nomes próprios)
- Remova repetições de gaguejos (ex: "eu eu eu acho" → "eu acho")
- Remova filler words excessivos (hm, eh, ahn) mas mantenha se fazem parte do contexto
- NÃO resuma, NÃO omita conteúdo, NÃO reorganize
- NÃO adicione identificação de falantes
- Retorne APENAS o texto limpo, sem explicações`
        },
        { role: 'user', content: rawText }
      ],
      temperature: 0.1,
    })

    const cleaned = response.choices[0]?.message?.content?.trim()
    if (cleaned && cleaned.length > rawText.length * 0.3) {
      console.log(`[DesktopBG] Cleaned: ${rawText.length} → ${cleaned.length} chars`)
      return cleaned
    }
    return rawText
  } catch (err: any) {
    console.error('[DesktopBG] Clean error:', err.message)
    return rawText
  }
}

export async function processDesktopRecording(sessionId: string): Promise<void> {
  console.log(`[DesktopBG] Processing desktop recording: ${sessionId}`)

  // 1. Read live session
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('meet_live_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    console.error(`[DesktopBG] Session not found: ${sessionId}`, sessionError)
    return
  }

  const { user_id, company_id, seller_name, transcript: segments } = session
  const meetingId = `desktop_${sessionId}`

  // 2. Check for duplicate
  const { data: existing } = await supabaseAdmin
    .from('meet_evaluations')
    .select('id')
    .eq('meeting_id', meetingId)
    .single()

  if (existing) {
    console.log(`[DesktopBG] Evaluation already exists for ${meetingId}, skipping`)
    await supabaseAdmin
      .from('meet_live_sessions')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
    return
  }

  // 3. Update status
  await supabaseAdmin
    .from('meet_live_sessions')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  try {
    // 4. Build transcript text
    const transcriptText = Array.isArray(segments)
      ? segments.map((s: any) => s.text).join('\n')
      : String(segments || '')

    if (transcriptText.length < 50) {
      throw new Error(`Transcrição muito curta (${transcriptText.length} chars)`)
    }

    console.log(`[DesktopBG] Transcript: ${transcriptText.length} chars`)

    // 5. Clean transcript
    const cleanedTranscript = await cleanTranscript(transcriptText)

    // 6. Evaluate + Smart Notes in parallel
    const [evalResult, notesResult] = await Promise.allSettled([
      evaluateMeetTranscript({
        transcript: cleanedTranscript,
        meetingId,
        companyId: company_id || '',
        sellerName: seller_name || undefined,
      }),
      generateSmartNotes({
        transcript: cleanedTranscript,
        companyId: company_id || '',
      })
    ])

    const result = evalResult.status === 'fulfilled' ? evalResult.value : null
    if (!result?.success || !result.evaluation) {
      throw new Error(result?.error || 'Avaliação falhou')
    }
    const evalData = result.evaluation

    const smartNotes = notesResult.status === 'fulfilled' && notesResult.value.success
      ? notesResult.value.notes : null

    // 7. Normalize score
    let overallScore = evalData.overall_score
    if (overallScore && overallScore <= 10) overallScore = overallScore * 10
    overallScore = Math.round(overallScore || 0)

    // 8. Save to meet_evaluations
    const { data: saved, error: saveError } = await supabaseAdmin
      .from('meet_evaluations')
      .insert({
        user_id,
        company_id,
        meeting_id: meetingId,
        seller_name: seller_name || evalData.seller_identification?.name || 'Não identificado',
        transcript: cleanedTranscript,
        evaluation: evalData,
        smart_notes: smartNotes,
        overall_score: overallScore,
        performance_level: evalData.performance_level || 'needs_improvement',
        spin_s_score: evalData.spin_evaluation?.S?.final_score || 0,
        spin_p_score: evalData.spin_evaluation?.P?.final_score || 0,
        spin_i_score: evalData.spin_evaluation?.I?.final_score || 0,
        spin_n_score: evalData.spin_evaluation?.N?.final_score || 0,
        source: 'desktop',
      })
      .select('id')
      .single()

    if (saveError) {
      if (saveError.code === '23505') {
        console.log(`[DesktopBG] Evaluation already saved for ${meetingId}`)
        return
      }
      throw new Error(`Erro ao salvar: ${saveError.message}`)
    }

    console.log(`[DesktopBG] Evaluation saved: ${saved.id} (score: ${overallScore})`)

    // 9. Update live session
    await supabaseAdmin
      .from('meet_live_sessions')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    // 10. Create notification
    const scoreDisplay = evalData.overall_score !== undefined
      ? (evalData.overall_score <= 10 ? evalData.overall_score.toFixed(1) : (evalData.overall_score / 10).toFixed(1))
      : '0'

    await supabaseAdmin.from('user_notifications').insert({
      user_id,
      type: 'meet_evaluation_ready',
      title: 'Análise de reunião pronta!',
      message: `Sua reunião foi avaliada. Score: ${scoreDisplay}/10`,
      data: {
        evaluationId: saved.id,
        overallScore,
        performanceLevel: evalData.performance_level,
        sellerName: seller_name,
        source: 'desktop_recording',
      }
    })

    console.log(`[DesktopBG] Notification created for user ${user_id}`)

    // 11. Generate simulation (fire-and-forget)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ramppy.site'
      fetch(`${appUrl}/api/meet/generate-simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluation: evalData, transcript: cleanedTranscript, companyId: company_id })
      }).then(async res => {
        if (res.ok) {
          const simData = await res.json()
          if (simData.success && simData.simulationConfig) {
            await supabaseAdmin.from('saved_simulations').insert({
              user_id,
              company_id,
              simulation_config: simData.simulationConfig,
              simulation_justification: simData.simulationConfig.simulation_justification || null,
              meeting_context: simData.simulationConfig.meeting_context || null,
              meet_evaluation_id: saved.id,
              status: 'pending',
            })
            console.log(`[DesktopBG] Simulation saved for ${saved.id}`)
          }
        }
      }).catch(() => {})
    } catch {}

    // 12. Extract ML patterns (fire-and-forget)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ramppy.site'
      fetch(`${appUrl}/api/meet/extract-patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetEvaluationId: saved.id, transcript: cleanedTranscript, evaluation: evalData, companyId: company_id })
      }).then(res => {
        if (res.ok) console.log(`[DesktopBG] ML patterns started for ${saved.id}`)
      }).catch(() => {})
    } catch {}

  } catch (error: any) {
    console.error(`[DesktopBG] Error processing ${sessionId}:`, error)

    await supabaseAdmin
      .from('meet_live_sessions')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    await supabaseAdmin.from('user_notifications').insert({
      user_id,
      type: 'meet_evaluation_error',
      title: 'Erro na análise de reunião',
      message: error.message || 'Ocorreu um erro ao processar sua gravação.',
      data: { sessionId, error: error.message }
    })
  }
}
