import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface CoachingFocusArea {
  area: string
  spin_score?: number
  severity?: string
  diagnosis?: string
  transcript_evidence?: string
  practice_goal?: string
  example_phrases?: string[]
  what_to_improve?: string
  tips?: string[]
}

interface MeetCorrectionArea {
  area: string
  corrected: boolean
  partially_corrected: boolean
  what_seller_did: string
  what_still_needs_work: string | null
  key_moment: string | null
}

interface MeetCorrectionResult {
  overall_corrected: boolean
  overall_feedback: string
  areas: MeetCorrectionArea[]
}

/**
 * Evaluates whether the seller corrected specific errors from a Meet evaluation
 * during a correction simulation roleplay.
 * Runs AFTER the regular evaluation to add meet-specific correction feedback.
 */
export async function evaluateMeetCorrection(
  transcription: string,
  evaluation: any,
  coachingFocus: CoachingFocusArea[]
): Promise<MeetCorrectionResult> {
  const spinEvaluation = evaluation?.spin_evaluation || {}

  // Build coaching context for the prompt
  const coachingContext = coachingFocus.map((cf, i) => {
    const diagnosis = cf.diagnosis || cf.what_to_improve || 'Não especificado'
    const goal = cf.practice_goal || ''
    const evidence = cf.transcript_evidence || ''
    const phrases = cf.example_phrases || cf.tips || []

    return `AREA ${i + 1}: ${cf.area}${cf.spin_score !== undefined ? ` (score na reunião: ${cf.spin_score.toFixed(1)}/10)` : ''}${cf.severity ? ` [Severidade: ${cf.severity}]` : ''}
Diagnóstico do erro original: ${diagnosis}${evidence ? `\nEvidência da reunião: ${evidence}` : ''}${goal ? `\nMeta de prática: ${goal}` : ''}${phrases.length > 0 ? `\nFrases sugeridas: ${phrases.join(' | ')}` : ''}`
  }).join('\n\n')

  const systemPrompt = `Você é um coach de vendas especialista em SPIN Selling. O vendedor acabou de fazer um roleplay de CORREÇÃO — ele está tentando corrigir erros específicos identificados em uma reunião real anterior.

Sua tarefa: analisar a transcrição do roleplay e observar se o vendedor CORRIGIU cada erro que foi apontado no coaching.

ERROS IDENTIFICADOS NA REUNIÃO ORIGINAL (que o vendedor deveria corrigir):
${coachingContext}

SCORES SPIN DO ROLEPLAY:
- Situação (S): ${spinEvaluation.S?.final_score?.toFixed(1) || 'N/A'}
- Problema (P): ${spinEvaluation.P?.final_score?.toFixed(1) || 'N/A'}
- Implicação (I): ${spinEvaluation.I?.final_score?.toFixed(1) || 'N/A'}
- Necessidade (N): ${spinEvaluation.N?.final_score?.toFixed(1) || 'N/A'}

INSTRUÇÕES:

Para CADA área de coaching acima, analise a transcrição e determine:
1. O vendedor CORRIGIU o erro? (corrected: true/false)
2. Corrigiu parcialmente? (partially_corrected: true/false — use quando tentou mas não conseguiu completamente)
3. O QUE o vendedor fez nesta área durante o roleplay? (what_seller_did: 2-3 frases descrevendo ações concretas, citando falas reais quando possível)
4. O que AINDA falta melhorar? (what_still_needs_work: 1-2 frases, ou null se corrigiu completamente)
5. Um momento-chave do roleplay que evidencia a correção ou falta dela (key_moment: trecho curto da transcrição, ou null)

Também forneça:
- overall_corrected: true se TODAS as áreas foram corrigidas
- overall_feedback: 2-3 frases de feedback geral. Tom de coach: direto, empático, focado em crescimento. Se corrigiu tudo, parabenize e sugira próximo nível. Se não, reconheça o esforço e indique o que praticar.

REGRAS:
- Seja ESPECÍFICO — cite falas reais da transcrição
- "Corrigido" significa que o vendedor demonstrou a habilidade de forma CONSISTENTE, não apenas uma vez
- "Parcial" significa que tentou mas não manteve ao longo da conversa, ou aplicou de forma superficial
- Não invente nada — baseie-se APENAS na transcrição

Responda APENAS com JSON válido.`

  const userPrompt = `TRANSCRIÇÃO DO ROLEPLAY DE CORREÇÃO:
${transcription}

Analise se o vendedor corrigiu os erros identificados na reunião original.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    const parsed = JSON.parse(content)

    const result: MeetCorrectionResult = {
      overall_corrected: parsed.overall_corrected ?? false,
      overall_feedback: parsed.overall_feedback || '',
      areas: (parsed.areas || []).map((a: any) => ({
        area: a.area || '',
        corrected: a.corrected ?? false,
        partially_corrected: a.partially_corrected ?? false,
        what_seller_did: a.what_seller_did || '',
        what_still_needs_work: a.what_still_needs_work || null,
        key_moment: a.key_moment || null
      }))
    }

    console.log('✅ Meet correction evaluated:', {
      overall_corrected: result.overall_corrected,
      areas: result.areas.map(a => `${a.area}: ${a.corrected ? 'corrected' : a.partially_corrected ? 'partial' : 'not corrected'}`)
    })

    return result

  } catch (error) {
    console.error('❌ Error evaluating meet correction:', error)

    // Fallback
    return {
      overall_corrected: false,
      overall_feedback: 'Não foi possível gerar a análise de correção neste momento. Verifique a avaliação SPIN para detalhes.',
      areas: coachingFocus.map(cf => ({
        area: cf.area,
        corrected: false,
        partially_corrected: false,
        what_seller_did: '',
        what_still_needs_work: null,
        key_moment: null
      }))
    }
  }
}
