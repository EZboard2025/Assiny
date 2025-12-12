import { NextRequest, NextResponse } from 'next/server'

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || 'sk_car_yNLqWuvzBhJXjjACwjMWmQ'
const CARTESIA_API_URL = 'https://api.cartesia.ai/tts/bytes'

// Voice ID: Custom Voice (Voz personalizada)
const VOICE_ID = '3df0c138-2adf-4084-afe6-6d8f365e0d56'

/**
 * Adiciona header WAV a dados PCM raw
 * @param pcmData - ArrayBuffer com dados PCM
 * @param sampleRate - Taxa de amostragem (44100)
 * @param bitsPerSample - Bits por amostra (16)
 * @param numChannels - Número de canais (1 = mono, 2 = stereo)
 */
function addWavHeader(pcmData: ArrayBuffer, sampleRate: number, bitsPerSample: number, numChannels: number): ArrayBuffer {
  const pcmBytes = new Uint8Array(pcmData)
  const dataSize = pcmBytes.length
  const headerSize = 44
  const wavBuffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(wavBuffer)

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true) // File size - 8
  writeString(view, 8, 'WAVE')

  // fmt sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true) // NumChannels
  view.setUint32(24, sampleRate, true) // SampleRate
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true) // ByteRate
  view.setUint16(32, numChannels * bitsPerSample / 8, true) // BlockAlign
  view.setUint16(34, bitsPerSample, true) // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true) // Subchunk2Size

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text } = body

    console.log('🔊 TTS Cartesia - Gerando áudio para:', text)

    const requestBody = {
      model_id: 'sonic-turbo', // 40ms latency
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
    }

    console.log('📤 Request body:', JSON.stringify(requestBody))

    const response = await fetch(CARTESIA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CARTESIA_API_KEY}`,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Cartesia API erro: ${response.status} - ${errorText}`)
    }

    const pcmData = await response.arrayBuffer()

    console.log('✅ PCM gerado:', pcmData.byteLength, 'bytes')

    // Adicionar header WAV ao PCM
    const wavBuffer = addWavHeader(pcmData, 44100, 16, 1)

    console.log('✅ WAV final:', wavBuffer.byteLength, 'bytes')

    return new NextResponse(wavBuffer, {
      headers: {
        'Content-Type': 'audio/wav',
      },
    })

  } catch (error: any) {
    console.error('❌ Erro no TTS Cartesia:', error)
    return NextResponse.json(
      {
        error: 'Erro ao gerar áudio',
        details: error?.message || 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}