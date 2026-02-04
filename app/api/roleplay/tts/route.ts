import { NextRequest, NextResponse } from 'next/server'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// Vozes mapeadas por faixa etária
const VOICE_BY_AGE_RANGE: Record<string, string> = {
  '18-24': 'RW887Krqkhkn77rPnjT9',
  '25-34': 'YGgtUkdLOCAVgzsgM2S7',
  '35-44': '3QAt3IeuUNgSZQCVUNIu',
  '45-60': 'rnJZLKxtlBZt77uIED10'
}

const DEFAULT_VOICE_ID = 'RW887Krqkhkn77rPnjT9' // 18-24 anos

export async function POST(request: NextRequest) {
  try {
    const { text, ageRange } = await request.json()

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

    // Selecionar voz baseada na faixa etária
    const voiceId = ageRange && VOICE_BY_AGE_RANGE[ageRange]
      ? VOICE_BY_AGE_RANGE[ageRange]
      : DEFAULT_VOICE_ID

    console.log(`🔊 Gerando TTS para: ${text.substring(0, 50)}... (Idade: ${ageRange || 'padrão'}, Voz: ${voiceId})`)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
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
    console.error('Erro no TTS do roleplay:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar áudio' },
      { status: 500 }
    )
  }
}