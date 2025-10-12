import { NextRequest, NextResponse } from 'next/server'

// Webhook do N8N para processar arquivos e criar embeddings
const N8N_WEBHOOK_URL = 'https://ezboard.app.n8n.cloud/webhook/c91010a1-9003-4a8b-b9bd-30e689c7c4ac'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string
    const fileType = formData.get('fileType') as string

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 })
    }

    console.log('📤 API Route recebeu arquivo:', fileName, 'Tipo:', fileType, 'Tamanho:', file.size)

    // Criar FormData para enviar ao N8N
    const n8nFormData = new FormData()
    n8nFormData.append('file', file)
    n8nFormData.append('fileName', fileName)
    n8nFormData.append('fileType', fileType || file.type)

    console.log('🚀 Enviando arquivo para N8N webhook...')

    // Enviar para o webhook do N8N
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      body: n8nFormData,
    })

    console.log('📨 N8N respondeu com status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ N8N retornou erro:', errorText)
      return NextResponse.json(
        {
          error: 'Erro ao processar arquivo no N8N',
          details: errorText
        },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log('✅ N8N processou arquivo com sucesso:', result)

    return NextResponse.json({
      success: true,
      message: 'Arquivo enviado para processamento e criação de embedding',
      result
    })

  } catch (error) {
    console.error('💥 Erro ao processar arquivo:', error)
    return NextResponse.json(
      {
        error: 'Erro ao processar arquivo',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
