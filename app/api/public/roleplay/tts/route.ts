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

const N8N_TTS_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/0ffb3d05-ba95-40e1-b3f1-9bd963fd2b59'

export async function POST(request: Request) {
  try {
    const { text, sessionId } = await request.json()

    if (!text || !sessionId) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      )
    }

    // Verificar se a sessão existe e está ativa
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplays_unicos')
      .select('id')
      .eq('id', sessionId)
      .eq('status', 'em_andamento')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada ou já finalizada' },
        { status: 404 }
      )
    }

    // Enviar para N8N para TTS
    const response = await fetch(N8N_TTS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      throw new Error('Erro ao gerar áudio')
    }

    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      }
    })
  } catch (error) {
    console.error('Erro no TTS:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar áudio' },
      { status: 500 }
    )
  }
}