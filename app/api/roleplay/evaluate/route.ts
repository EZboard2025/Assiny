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
    const { sessionId } = await request.json()

    if (!sessionId) {
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
    const context = {
      age: session.config.age,
      temperament: session.config.temperament,
      persona: session.config.segment, // Contém descrição da persona
      objections: session.config.objections || []
    }

    console.log('📤 Enviando para N8N...')
    console.log('Contexto:', context)
    console.log('Transcrição:', transcription.substring(0, 200) + '...')

    // Enviar para N8N
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcription,
        context
      })
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error('❌ Erro do N8N:', errorText)
      return NextResponse.json(
        { error: 'Erro ao processar avaliação no N8N' },
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
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
