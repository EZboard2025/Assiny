import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const N8N_WEBHOOK_URL = 'https://ezboard.app.n8n.cloud/webhook/f058c533-a72d-45c4-a516-0d4f5fa3225e'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      console.error('❌ sessionId não fornecido no body:', body)
      return NextResponse.json({ error: 'sessionId é obrigatório' }, { status: 400 })
    }

    console.log('📊 Iniciando avaliação da sessão:', sessionId)

    // Buscar sessão completa do Supabase
    const { data: session, error: sessionError } = await supabase
      .from('roleplay_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('❌ Erro ao buscar sessão:', sessionError)
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    // Montar transcrição formatada
    const messages = session.messages as Array<{ role: string; text: string; timestamp: string }>
    const transcription = messages
      .map(msg => {
        const role = msg.role === 'seller' ? 'Vendedor' : 'Cliente'
        return `${role}: ${msg.text}`
      })
      .join('\n')

    // Preparar contexto
    const config = session.config as any
    const context = {
      age: config.age,
      temperament: config.temperament,
      persona: config.segment || config.persona || '', // Suporta ambos os campos
      objections: config.objections || []
    }

    console.log('📤 Enviando para N8N...')
    console.log('Contexto:', context)
    console.log('Transcrição:', transcription.substring(0, 200) + '...')

    // Enviar para N8N
    const n8nPayload = {
      transcription,
      context
    }

    console.log('📡 Enviando payload para N8N:', JSON.stringify(n8nPayload, null, 2))

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nPayload)
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error('❌ Erro do N8N - Status:', n8nResponse.status)
      console.error('❌ Erro do N8N - Response:', errorText)
      return NextResponse.json(
        { error: `Erro ao processar avaliação no N8N: ${errorText}` },
        { status: 500 }
      )
    }

    const evaluation = await n8nResponse.json()
    console.log('✅ Avaliação recebida do N8N')

    // Salvar avaliação no Supabase
    const { error: updateError } = await supabase
      .from('roleplay_sessions')
      .update({ evaluation })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Erro ao salvar avaliação:', updateError)
      return NextResponse.json(
        { error: 'Erro ao salvar avaliação' },
        { status: 500 }
      )
    }

    console.log('💾 Avaliação salva com sucesso!')

    return NextResponse.json({
      success: true,
      evaluation
    })

  } catch (error: any) {
    console.error('❌ Erro geral:', error)
    console.error('❌ Stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
