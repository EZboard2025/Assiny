import { NextRequest, NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_VOICE_ID = 'RW887Krqkhkn77rPnjT9'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: 'Texto é obrigatório' },
        { status: 400 }
      )
    }

    if (!ELEVENLABS_API_KEY) {
      console.error('ELEVENLABS_API_KEY não configurada')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    console.log(`🔊 Gerando TTS para: ${text.substring(0, 50)}...`)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.85,
            style: 0.0,
            use_speaker_boost: true
          },
          output_format: 'mp3_44100_128'
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro no ElevenLabs:', response.status, errorText)
      throw new Error(`ElevenLabs error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    console.log(`✅ TTS gerado: ${audioBuffer.byteLength} bytes`)

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString()
      }
    })

  } catch (error: any) {
    console.error('Erro no TTS do desafio:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar áudio' },
      { status: 500 }
    )
  }
}
