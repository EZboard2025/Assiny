import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || 'sk_car_yNLqWuvzBhJXjjACwjMWmQ'
const CARTESIA_API_URL = 'https://api.cartesia.ai/tts/bytes'

// Voice ID: Custom Voice (Voz personalizada)
const VOICE_ID = '3df0c138-2adf-4084-afe6-6d8f365e0d56'

/**
 * Adiciona header WAV a dados PCM raw
 */
function addWavHeader(pcmData: ArrayBuffer, sampleRate: number, bitsPerSample: number, numChannels: number): ArrayBuffer {
  const pcmBytes = new Uint8Array(pcmData)
  const dataSize = pcmBytes.length
  const headerSize = 44
  const wavBuffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(wavBuffer)

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')

  // fmt sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true)
  view.setUint16(32, numChannels * bitsPerSample / 8, true)
  view.setUint16(34, bitsPerSample, true)

  // data sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Copy PCM data
  const wavBytes = new Uint8Array(wavBuffer)
  wavBytes.set(pcmBytes, headerSize)

  return wavBuffer
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

export async function POST(request: Request) {
  try {
    const { text, sessionId } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: 'Texto é obrigatório' },
        { status: 400 }
      )
    }

    // Se tiver sessionId, verificar se a sessão existe e está ativa
    if (sessionId) {
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
    }

    console.log('🔊 TTS Cartesia (Público) - Gerando áudio para:', text)

    // Gerar áudio com Cartesia
    const response = await fetch(CARTESIA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CARTESIA_API_KEY}`,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-turbo',
        transcript: text,
        voice: {
          mode: 'id',
          id: VOICE_ID,
        },
        output_format: {
          container: 'raw',
          encoding: 'pcm_s16le',
          sample_rate: 44100,
        },
        language: 'pt',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Cartesia API erro: ${response.status} - ${errorText}`)
    }

    const pcmData = await response.arrayBuffer()
    const wavBuffer = addWavHeader(pcmData, 44100, 16, 1)

    console.log('✅ Áudio gerado (público):', wavBuffer.byteLength, 'bytes')

    return new NextResponse(wavBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
      }
    })
  } catch (error) {
    console.error('❌ Erro no TTS (público):', error)
    return NextResponse.json(
      { error: 'Erro ao gerar áudio' },
      { status: 500 }
    )
  }
}