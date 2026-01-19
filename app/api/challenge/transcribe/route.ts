import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { processWhisperTranscription } from '@/lib/utils/whisperValidation'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Requisição de transcrição do Challenge recebida')
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      console.error('❌ Arquivo de áudio não encontrado no FormData')
      return NextResponse.json({ error: 'Arquivo de áudio não encontrado' }, { status: 400 })
    }

    console.log('🎤 Transcrevendo áudio do Challenge:')
    console.log('  - Nome:', audioFile.name)
    console.log('  - Tamanho:', audioFile.size, 'bytes')
    console.log('  - Tipo:', audioFile.type)

    if (audioFile.size === 0) {
      console.error('❌ Arquivo de áudio vazio')
      return NextResponse.json({ error: 'Arquivo de áudio vazio' }, { status: 400 })
    }

    // Transcrever usando OpenAI Whisper (sem prompt para evitar interferências)
    // O roleplay de treino funciona bem sem prompt customizado
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
    })

    console.log('✅ Transcrição completa:', transcription.text)

    // Verificar se a transcrição está vazia
    if (!transcription.text || transcription.text.trim() === '') {
      console.log('⚠️ Transcrição vazia retornada pela API')
      return NextResponse.json({ text: '', warning: 'Transcrição vazia' })
    }

    // Validar e processar a transcrição (mesmo processo do roleplay de treino)
    const processed = processWhisperTranscription(transcription.text)

    if (processed.hasRepetition) {
      console.warn('⚠️ Repetições detectadas no backend:', {
        original: transcription.text,
        cleaned: processed.text,
        confidence: processed.confidence
      })
    }

    // Retornar texto processado
    return NextResponse.json({
      text: processed.text,
      originalText: transcription.text,
      isValid: processed.isValid,
      confidence: processed.confidence,
      hasRepetition: processed.hasRepetition
    })

  } catch (error: any) {
    console.error('❌ Erro ao transcrever:', error)
    return NextResponse.json(
      {
        error: 'Erro ao transcrever áudio',
        details: error?.message || 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}
