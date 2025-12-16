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

// Webhook do N8N para TTS
const N8N_TTS_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/0ffb3d05-ba95-40e1-b3f1-9bd963fd2b59'

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

    console.log('🔊 TTS N8N (Público) - Gerando áudio para:', text)

    // Enviar para o webhook do N8N
    const response = await fetch(N8N_TTS_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro no webhook N8N:', response.status, errorText)
      throw new Error(`N8N webhook error: ${response.status} - ${errorText}`)
    }

    // Receber o áudio do N8N
    const audioBuffer = await response.arrayBuffer()
    console.log('✅ Áudio recebido do N8N (público):', audioBuffer.byteLength, 'bytes')

    // Determinar o tipo de conteúdo baseado na resposta
    const contentType = response.headers.get('content-type') || 'audio/mpeg'

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      }
    })
  } catch (error) {
    console.error('❌ Erro no TTS N8N (público):', error)
    return NextResponse.json(
      { error: 'Erro ao gerar áudio' },
      { status: 500 }
    )
  }
}