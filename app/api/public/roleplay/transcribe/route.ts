import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { processWhisperTranscription } from '@/lib/utils/whisperValidation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const sessionId = formData.get('sessionId') as string

    if (!audioFile || !sessionId) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      )
    }

    // Verificar se a sessão existe e está ativa
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplays_unicos')
      .select('id')
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada ou já finalizada' },
        { status: 404 }
      )
    }

    // Transcrever áudio usando Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt'
    })

    // Validar e processar a transcrição
    const processed = processWhisperTranscription(transcription.text)

    if (processed.hasRepetition) {
      console.warn('⚠️ Repetições detectadas no roleplay público:', {
        original: transcription.text,
        cleaned: processed.text,
        confidence: processed.confidence
      })
    }

    // Retornar tanto o texto processado quanto metadados
    return NextResponse.json({
      text: processed.text,
      originalText: transcription.text,
      isValid: processed.isValid,
      confidence: processed.confidence,
      hasRepetition: processed.hasRepetition
    })
  } catch (error) {
    console.error('Erro na transcrição:', error)
    return NextResponse.json(
      { error: 'Erro ao transcrever áudio' },
      { status: 500 }
    )
  }
}