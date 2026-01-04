import { NextResponse } from 'next/server'

const N8N_TTS_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/0ffb3d05-ba95-40e1-b3f1-9bd963fd2b59'

export async function POST(request: Request) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: 'Texto é obrigatório' },
        { status: 400 }
      )
    }

    console.log('🔊 Gerando TTS para texto:', text.substring(0, 50) + '...')

    // Chamar webhook do N8N para TTS
    const response = await fetch(N8N_TTS_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error(`N8N TTS error: ${response.status}`)
    }

    // Retornar o áudio como blob
    const audioBuffer = await response.arrayBuffer()

    console.log('✅ TTS gerado, tamanho:', audioBuffer.byteLength)

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('❌ Erro no TTS:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar áudio' },
      { status: 500 }
    )
  }
}
