import { NextResponse } from 'next/server'
import { evaluateMeetTranscript } from '@/lib/meet/evaluateMeetTranscript'
import { generateSmartNotes } from '@/lib/meet/generateSmartNotes'
import OpenAI from 'openai'

export const maxDuration = 300 // 5 minutos para processar transcrições longas

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function cleanTranscript(rawText: string): Promise<string> {
  try {
    console.log(`[CleanTranscript] Cleaning ${rawText.length} chars with gpt-4.1-nano...`)
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
        {
          role: 'user',
          content: rawText
        }
      ],
      temperature: 0.1,
    })

    const cleaned = response.choices[0]?.message?.content?.trim()
    if (cleaned && cleaned.length > rawText.length * 0.3) {
      console.log(`[CleanTranscript] Done: ${rawText.length} → ${cleaned.length} chars`)
      return cleaned
    }
    console.warn('[CleanTranscript] Output too short or empty, using raw transcript')
    return rawText
  } catch (err: any) {
    console.error('[CleanTranscript] Error:', err.message)
    return rawText // Fallback to raw transcript
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { transcript, meetingId, sellerName, companyId } = body

    if (!transcript || transcript.length < 50) {
      return NextResponse.json(
        { error: `Transcrição muito curta para avaliação (${transcript?.length || 0} chars, mínimo 50)` },
        { status: 400 }
      )
    }

    // Step 1: Clean transcript with nano (fast + cheap)
    const cleanedTranscript = await cleanTranscript(transcript)

    // Step 2: Run evaluation and smart notes in parallel (using cleaned transcript)
    const [evalResult, notesResult] = await Promise.allSettled([
      evaluateMeetTranscript({ transcript: cleanedTranscript, meetingId, companyId, sellerName, hasSpeakerLabels: false }),
      companyId ? generateSmartNotes({ transcript: cleanedTranscript, companyId }) : Promise.resolve({ success: false, error: 'No companyId' } as { success: boolean; notes?: any; error?: string })
    ])

    // Evaluation is required
    const result = evalResult.status === 'fulfilled' ? evalResult.value : null
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || 'Erro ao avaliar reunião' },
        { status: 500 }
      )
    }

    // Smart notes are optional
    const smartNotes = notesResult.status === 'fulfilled' && notesResult.value.success
      ? notesResult.value.notes : null

    return NextResponse.json({
      success: true,
      evaluation: result.evaluation,
      smartNotes,
      cleanedTranscript,
    })

  } catch (error: any) {
    console.error('❌ Erro na avaliação:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao avaliar reunião' },
      { status: 500 }
    )
  }
}
