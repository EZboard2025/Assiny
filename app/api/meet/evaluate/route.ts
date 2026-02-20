import { NextResponse } from 'next/server'
import { evaluateMeetTranscript } from '@/lib/meet/evaluateMeetTranscript'
import { generateSmartNotes } from '@/lib/meet/generateSmartNotes'

export const maxDuration = 120 // 2 minutos para processar transcrições longas

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { transcript, meetingId, sellerName, companyId } = body

    if (!transcript || transcript.length < 100) {
      return NextResponse.json(
        { error: 'Transcrição muito curta para avaliação' },
        { status: 400 }
      )
    }

    // Run evaluation and smart notes in parallel
    const [evalResult, notesResult] = await Promise.allSettled([
      evaluateMeetTranscript({ transcript, meetingId, companyId, sellerName }),
      companyId ? generateSmartNotes({ transcript, companyId }) : Promise.resolve({ success: false, error: 'No companyId' } as { success: boolean; notes?: any; error?: string })
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
      smartNotes
    })

  } catch (error: any) {
    console.error('❌ Erro na avaliação:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao avaliar reunião' },
      { status: 500 }
    )
  }
}
