import { NextResponse } from 'next/server'
import { evaluateMeetTranscript } from '@/lib/meet/evaluateMeetTranscript'

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

    const result = await evaluateMeetTranscript({
      transcript,
      meetingId,
      companyId,
      sellerName
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erro ao avaliar reunião' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      evaluation: result.evaluation
    })

  } catch (error: any) {
    console.error('❌ Erro na avaliação:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao avaliar reunião' },
      { status: 500 }
    )
  }
}
