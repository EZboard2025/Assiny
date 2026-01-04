import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Arquivo de áudio é obrigatório' },
        { status: 400 }
      )
    }

    console.log('🎤 Transcrevendo áudio:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    })

    // Converter File para formato compatível com OpenAI
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Criar um arquivo temporário para o Whisper
    const file = new File([buffer], 'audio.webm', { type: audioFile.type })

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'pt',
    })

    console.log('✅ Transcrição:', transcription.text.substring(0, 100) + '...')

    return NextResponse.json({
      text: transcription.text
    })
  } catch (error) {
    console.error('❌ Erro na transcrição:', error)
    return NextResponse.json(
      { error: 'Erro ao transcrever áudio' },
      { status: 500 }
    )
  }
}
