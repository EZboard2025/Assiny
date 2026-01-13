import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Prompt de contexto para o desafio "Venda uma Pedra"
// Isso ajuda o Whisper a entender melhor o contexto e transcrever com mais precisão
const CHALLENGE_CONTEXT_PROMPT = `Contexto: Conversa de vendas em português brasileiro.
Um vendedor está tentando vender uma pedra antiga para um homem de campo.
Termos comuns: pedra, quintal, avô, fazenda, campo, roça, decoração, jardim, propriedade, valor sentimental, antiguidade, relíquia, preço, comprar, vender, negócio, interesse.
O cliente pode mencionar: trabalho de campo, análise, coleta, materiais naturais, pesquisa.`

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

    // Transcrever usando OpenAI Whisper com contexto do desafio
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
      prompt: CHALLENGE_CONTEXT_PROMPT,
    })

    console.log('✅ Transcrição completa:', transcription.text)

    if (!transcription.text || transcription.text.trim() === '') {
      console.log('⚠️ Transcrição vazia retornada pela API')
      return NextResponse.json({ text: '', warning: 'Transcrição vazia' })
    }

    return NextResponse.json({
      text: transcription.text,
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
