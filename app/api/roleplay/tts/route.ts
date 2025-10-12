import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text } = body

    console.log('🔊 TTS Proxy - Enviando texto:', text)

    // Enviar para N8N webhook
    const response = await fetch('https://ezboard.app.n8n.cloud/webhook/0ffb3d05-ba95-40e1-b3f1-9bd963fd2b59', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error(`N8N webhook erro: ${response.status}`)
    }

    // Retornar o áudio
    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    })

  } catch (error: any) {
    console.error('❌ Erro no TTS proxy:', error)
    return NextResponse.json(
      {
        error: 'Erro ao gerar áudio',
        details: error?.message || 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}