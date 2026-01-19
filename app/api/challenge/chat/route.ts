import { NextRequest, NextResponse } from 'next/server'

// Webhook do N8N para o chat do desafio "Venda uma Caneta"
const N8N_CHALLENGE_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/3480cc7b-467e-4c08-b33e-59049b36253c/chat'

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, leadId } = await request.json()

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'Mensagem e sessionId são obrigatórios' },
        { status: 400 }
      )
    }

    console.log(`💬 Mensagem recebida: ${message}`)
    console.log(`📤 Enviando para N8N: ${N8N_CHALLENGE_WEBHOOK}`)

    // Chamar webhook do N8N (ele salva na langchain_memory automaticamente)
    const payload = {
      action: 'sendMessage',
      chatInput: message,
      sessionId: sessionId,
      leadId: leadId
    }
    console.log('📦 Payload:', JSON.stringify(payload))

    const n8nResponse = await fetch(N8N_CHALLENGE_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    console.log(`📥 N8N Response Status: ${n8nResponse.status}`)

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error('❌ Erro no N8N:', n8nResponse.status, errorText)
      throw new Error(`N8N error: ${n8nResponse.status} - ${errorText}`)
    }

    const n8nData = await n8nResponse.json()
    console.log('📥 N8N Response Data:', JSON.stringify(n8nData))

    // Extrair resposta do N8N (pode vir em diferentes formatos)
    let aiResponse = ''

    if (Array.isArray(n8nData) && n8nData[0]?.output) {
      aiResponse = n8nData[0].output
    } else if (n8nData?.output) {
      aiResponse = n8nData.output
    } else if (n8nData?.text) {
      aiResponse = n8nData.text
    } else if (n8nData?.message) {
      aiResponse = n8nData.message
    } else if (n8nData?.response) {
      aiResponse = n8nData.response
    } else if (typeof n8nData === 'string') {
      aiResponse = n8nData
    } else {
      console.error('⚠️ Formato de resposta desconhecido:', n8nData)
      aiResponse = 'Desculpe, não consegui processar sua mensagem.'
    }

    console.log(`🤖 Resposta da IA: ${aiResponse.substring(0, 50)}...`)

    return NextResponse.json({
      success: true,
      response: aiResponse
    })

  } catch (error: any) {
    console.error('Erro no chat do desafio:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar mensagem' },
      { status: 500 }
    )
  }
}
