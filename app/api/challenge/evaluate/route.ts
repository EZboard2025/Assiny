import { NextRequest, NextResponse } from 'next/server'

// Webhook do N8N para avaliar o desempenho do desafio "Venda uma Caneta"
const N8N_EVALUATION_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/42f4b201-3d87-4a25-8693-276e3fcf9c35'

export async function POST(request: NextRequest) {
  try {
    const { transcription, sessionId, leadId } = await request.json()

    if (!transcription || !sessionId) {
      return NextResponse.json(
        { error: 'Transcrição e sessionId são obrigatórios' },
        { status: 400 }
      )
    }

    console.log(`📊 Avaliando desafio - Session: ${sessionId}`)
    console.log(`📋 Transcrição recebida (${transcription?.length || 0} chars):`, transcription?.substring(0, 1000))
    console.log(`📤 Enviando para N8N: ${N8N_EVALUATION_WEBHOOK}`)

    // Chamar webhook do N8N para avaliação
    const payload = {
      transcription,
      sessionId,
      leadId
    }
    console.log('📦 Payload completo:', JSON.stringify(payload))

    const n8nResponse = await fetch(N8N_EVALUATION_WEBHOOK, {
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
    console.log('📥 N8N Response Data:', JSON.stringify(n8nData).substring(0, 500))

    // Extrair avaliação do N8N (pode vir em diferentes formatos)
    let evaluation = null

    // Função auxiliar para parsear JSON com fallback
    const parseJsonSafe = (str: string) => {
      if (typeof str !== 'string') return str

      // Limpar string JSON (remover markdown code blocks se houver)
      let cleaned = str.trim()
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '')
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '')
      }

      try {
        return JSON.parse(cleaned)
      } catch (e) {
        console.error('❌ Erro ao parsear JSON:', e)
        console.log('📝 String original (primeiros 500 chars):', cleaned.substring(0, 500))
        return null
      }
    }

    if (Array.isArray(n8nData) && n8nData[0]?.output) {
      // Formato: [{output: "json_string"}]
      evaluation = parseJsonSafe(n8nData[0].output)
    } else if (n8nData?.output) {
      // Formato: {output: "json_string"}
      evaluation = parseJsonSafe(n8nData.output)
    } else if (n8nData?.evaluation) {
      evaluation = n8nData.evaluation
    } else if (typeof n8nData === 'object' && n8nData !== null) {
      // Resposta direta como objeto
      evaluation = n8nData
    }

    console.log(`✅ Avaliação processada:`, typeof evaluation, evaluation ? 'com dados' : 'null')

    return NextResponse.json({
      success: true,
      evaluation
    })

  } catch (error: any) {
    console.error('Erro na avaliação do desafio:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao avaliar desafio' },
      { status: 500 }
    )
  }
}
