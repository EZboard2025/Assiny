import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { processWhisperTranscription } from '@/lib/utils/whisperValidation'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Requisição de transcrição recebida')
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const companyId = formData.get('companyId') as string

    if (!audioFile) {
      console.error('❌ Arquivo de áudio não encontrado no FormData')
      return NextResponse.json({ error: 'Arquivo de áudio não encontrado' }, { status: 400 })
    }

    console.log('🎤 Transcrevendo áudio:')
    console.log('  - Nome:', audioFile.name)
    console.log('  - Tamanho:', audioFile.size, 'bytes')
    console.log('  - Tipo:', audioFile.type)

    // Verificar se o arquivo tem conteúdo
    if (audioFile.size === 0) {
      console.error('❌ Arquivo de áudio vazio')
      return NextResponse.json({ error: 'Arquivo de áudio vazio' }, { status: 400 })
    }

    // Buscar dados da empresa para melhorar a transcrição
    let whisperPrompt = ''

    if (companyId) {
      console.log('🏢 Buscando dados da empresa para contexto...')

      const { data: companyData } = await supabase
        .from('company_data')
        .select('nome, descricao, produtos_servicos, concorrentes')
        .eq('company_id', companyId)
        .single()

      if (companyData) {
        // Montar prompt com termos importantes da empresa
        const termos = [
          companyData.nome,
          // Extrair nomes de produtos (primeiras palavras de cada linha)
          ...(companyData.produtos_servicos?.split('\n')
            .map((linha: string) => linha.split(':')[0].trim())
            .filter((termo: string) => termo.length > 2) || []),
          // Adicionar concorrentes
          ...(companyData.concorrentes?.split(',')
            .map((c: string) => c.trim())
            .filter((c: string) => c.length > 2) || [])
        ].filter(Boolean).join(', ')

        whisperPrompt = termos
        console.log('📝 Prompt do Whisper:', whisperPrompt)
      }
    }

    // Transcrever usando OpenAI Whisper com contexto da empresa
    const transcriptionOptions: any = {
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
    }

    // Adicionar prompt apenas se tivermos contexto
    if (whisperPrompt) {
      transcriptionOptions.prompt = whisperPrompt
    }

    const transcription = await openai.audio.transcriptions.create(transcriptionOptions)

    console.log('✅ Transcrição completa:', transcription.text)

    // Verificar se a transcrição está vazia
    if (!transcription.text || transcription.text.trim() === '') {
      console.log('⚠️ Transcrição vazia retornada pela API')
      return NextResponse.json({ text: '', warning: 'Transcrição vazia' })
    }

    // Validar e processar a transcrição
    const processed = processWhisperTranscription(transcription.text)

    if (processed.hasRepetition) {
      console.warn('⚠️ Repetições detectadas no backend:', {
        original: transcription.text,
        cleaned: processed.text,
        confidence: processed.confidence
      })
    }

    // Retornar tanto o texto original quanto o processado para debug
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
