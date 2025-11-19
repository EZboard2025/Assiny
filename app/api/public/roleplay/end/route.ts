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

const N8N_EVALUATION_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/b34f1d38-493b-4ae8-8998-b8450ab84d16'

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'ID da sessão é obrigatório' },
        { status: 400 }
      )
    }

    console.log('📊 Finalizando e avaliando sessão:', sessionId)

    // Buscar sessão completa
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('roleplays_unicos')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('❌ Erro ao buscar sessão:', sessionError)
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Montar transcrição formatada
    const messages = session.messages as Array<{ role: string; text: string; timestamp?: string }>
    const transcription = messages
      .map(msg => {
        const role = msg.role === 'seller' ? 'Vendedor' : 'Cliente'
        return `${role}: ${msg.text}`
      })
      .join('\n\n')

    console.log('📝 Transcrição montada:', transcription.substring(0, 200) + '...')

    // Extrair contexto da configuração
    const config = session.config as any
    const context = {
      age: config?.age || 'Não especificado',
      temperament: config?.temperament || 'Não especificado',
      persona: config?.persona?.cargo || config?.persona?.profession || 'Não especificado',
      objections: config?.objections?.map((obj: any) => obj.name).join(', ') || 'Nenhuma'
    }

    console.log('📋 Contexto extraído:', context)

    // Enviar para N8N para avaliação
    console.log('🚀 Enviando para N8N webhook...')
    const n8nResponse = await fetch(N8N_EVALUATION_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcription,
        context,
        companyId: session.company_id
      })
    })

    if (!n8nResponse.ok) {
      console.error('❌ Erro ao chamar N8N:', n8nResponse.status)
      throw new Error('Erro ao avaliar sessão')
    }

    const rawEvaluation = await n8nResponse.json()
    console.log('📥 Resposta bruta do N8N:', rawEvaluation)

    // Parse da avaliação (N8N retorna [{output: "json_string"}])
    let evaluation = rawEvaluation

    if (evaluation?.output && typeof evaluation.output === 'string') {
      evaluation = JSON.parse(evaluation.output)
    } else if (Array.isArray(evaluation) && evaluation[0]?.output && typeof evaluation[0].output === 'string') {
      evaluation = JSON.parse(evaluation[0].output)
    }

    console.log('✅ Avaliação parseada:', evaluation)

    // Calcular duração da sessão
    const startedAt = new Date(session.created_at || session.started_at)
    const endedAt = new Date()
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

    // Atualizar sessão com avaliação e status completed
    const { error: updateError } = await supabaseAdmin
      .from('roleplays_unicos')
      .update({
        status: 'completed',
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        evaluation: evaluation,
        overall_score: evaluation?.overall_score || null,
        performance_level: evaluation?.performance_level || null
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Erro ao atualizar sessão:', updateError)
      return NextResponse.json(
        { error: 'Erro ao salvar avaliação' },
        { status: 500 }
      )
    }

    console.log('✅ Sessão finalizada e avaliada com sucesso')

    return NextResponse.json({
      success: true,
      evaluation: evaluation
    })
  } catch (error) {
    console.error('❌ Erro ao finalizar/avaliar sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
