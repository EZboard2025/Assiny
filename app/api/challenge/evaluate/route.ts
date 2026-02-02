import { NextRequest, NextResponse } from 'next/server'
import { evaluateSimpleChallenge } from '@/lib/evaluation/evaluateSimpleChallenge'

export async function POST(request: NextRequest) {
  try {
    const { transcription, sessionId, leadId } = await request.json()

    if (!transcription || !sessionId) {
      return NextResponse.json(
        { error: 'Transcrição e sessionId são obrigatórios' },
        { status: 400 }
      )
    }

    console.log(`📊 Avaliando desafio - Session: ${sessionId}`)
    console.log(`📋 Transcrição recebida (${transcription?.length || 0} chars):`, transcription?.substring(0, 1000))
    console.log(`🎯 LeadId: ${leadId || 'não fornecido'}`)

    // Avaliar desafio diretamente via OpenAI (substituiu N8N)
    console.log('📤 Iniciando avaliação direta via OpenAI...')

    const evaluation = await evaluateSimpleChallenge(transcription)

    console.log(`✅ Avaliação concluída - Score: ${evaluation.overall_score} | Level: ${evaluation.performance_level}`)

    return NextResponse.json({
      success: true,
      evaluation
    })

  } catch (error: any) {
    console.error('Erro na avaliação do desafio:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao avaliar desafio' },
      { status: 500 }
    )
  }
}
