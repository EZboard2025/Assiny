import { NextRequest, NextResponse } from 'next/server'

// Webhook do N8N para avaliar qualidade dos arquivos
const N8N_WEBHOOK_URL = 'https://ezboard.app.n8n.cloud/webhook/78d6c8fa-ad22-47b0-bbd0-eb35eda727d1'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('📊 API Route solicitando avaliação de qualidade...')

    // Enviar para o webhook do N8N
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'evaluate_quality',
        timestamp: new Date().toISOString(),
        ...body
      }),
    })

    console.log('📨 N8N respondeu com status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ N8N retornou erro:', errorText)
      return NextResponse.json(
        {
          error: 'Erro ao avaliar qualidade no N8N',
          details: errorText
        },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log('✅ N8N avaliou qualidade com sucesso:', result)

    return NextResponse.json(result)

  } catch (error) {
    console.error('💥 Erro ao avaliar qualidade:', error)
    return NextResponse.json(
      {
        error: 'Erro ao avaliar qualidade',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
