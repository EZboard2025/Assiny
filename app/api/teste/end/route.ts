import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const N8N_EVALUATION_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/b34f1d38-493b-4ae8-8998-b8450ab84d16'

// Cliente Supabase com service role
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

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId é obrigatório' },
        { status: 400 }
      )
    }

    console.log('📊 Finalizando sessão de teste:', sessionId)

    // Buscar sessão completa
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('test_roleplays')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('❌ Sessão não encontrada:', sessionError)
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // Montar transcrição formatada
    const messages = session.messages as Array<{ role: string; text: string; timestamp: string }>
    const transcription = messages
      .map(msg => {
        const role = msg.role === 'seller' ? 'Vendedor' : 'Cliente'
        return `${role}: ${msg.text}`
      })
      .join('\n')

    // Preparar contexto para avaliação
    const objectionsWithIds = (session.objections_data || []).map((obj: { name: string; rebuttals?: string[] }, index: number) => ({
      id: `test-${index}`,
      name: obj.name,
      rebuttals: obj.rebuttals || []
    }))

    const context = {
      age: session.client_age,
      temperament: session.client_temperament,
      persona: session.persona_data,
      objections: objectionsWithIds
    }

    // Preparar perfil completo do cliente simulado
    let client_profile = `PERFIL DO CLIENTE SIMULADO (TESTE DE LEAD)

DADOS DEMOGRÁFICOS:
- Idade: ${session.client_age}
- Temperamento: ${session.client_temperament}
- Tipo de Negócio: ${session.business_type}

PERFIL DO CLIENTE:`

    if (session.business_type === 'B2B') {
      client_profile += `
- Cargo: ${session.persona_data?.job_title || 'Não especificado'}
- Tipo de Empresa: ${session.persona_data?.company_type || 'Não especificado'}
- Contexto: ${session.persona_data?.context || 'Não especificado'}
- O que busca: ${session.persona_data?.company_goals || 'Não especificado'}
- Desafios: ${session.persona_data?.business_challenges || 'Não especificado'}`
    } else {
      client_profile += `
- Profissão: ${session.persona_data?.profession || 'Não especificado'}
- Contexto: ${session.persona_data?.context || 'Não especificado'}
- O que busca: ${session.persona_data?.what_seeks || 'Não especificado'}
- Principais dores: ${session.persona_data?.main_pains || 'Não especificado'}`
    }

    client_profile += `

OBJEÇÕES TRABALHADAS:`

    if (objectionsWithIds && objectionsWithIds.length > 0) {
      objectionsWithIds.forEach((obj: { id: string; name: string; rebuttals: string[] }, index: number) => {
        client_profile += `\n\n${index + 1}. [ID: ${obj.id}] ${obj.name}`
        if (obj.rebuttals && obj.rebuttals.length > 0) {
          client_profile += `\n   Formas de quebrar:`
          obj.rebuttals.forEach((rebuttal: string, i: number) => {
            client_profile += `\n   ${String.fromCharCode(97 + i)}) ${rebuttal}`
          })
        }
      })
    } else {
      client_profile += `\n\nNenhuma objeção específica foi configurada.`
    }

    console.log('📤 Enviando para avaliação N8N...')
    console.log('📝 Transcrição:', transcription.substring(0, 200) + '...')

    // Enviar para N8N avaliar
    const n8nPayload = {
      transcription,
      context,
      client_profile,
      objetivo: 'Teste de produto - simulação de venda'
    }

    const n8nResponse = await fetch(N8N_EVALUATION_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nPayload)
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error('❌ Erro N8N:', errorText)
      return NextResponse.json(
        { error: `Erro ao processar avaliação: ${errorText}` },
        { status: 500 }
      )
    }

    let rawResponse = await n8nResponse.json()
    console.log('✅ Resposta N8N recebida')

    // Parse do formato N8N
    let evaluation = rawResponse

    // Caso 1: {output: "json_string"}
    if (evaluation?.output && typeof evaluation.output === 'string') {
      console.log('📦 Parseando campo output...')
      evaluation = JSON.parse(evaluation.output)
    }
    // Caso 2: [{output: "json_string"}]
    else if (Array.isArray(evaluation) && evaluation[0]?.output && typeof evaluation[0].output === 'string') {
      console.log('📦 Parseando campo output do array...')
      evaluation = JSON.parse(evaluation[0].output)
    }

    console.log('✅ Avaliação pronta - Score:', evaluation.overall_score, '| Level:', evaluation.performance_level)

    // Calcular duração
    const startedAt = new Date(session.started_at)
    const endedAt = new Date()
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

    // Converter score para escala 0-10 se necessário
    let overallScore = evaluation.overall_score
    if (overallScore > 10) {
      overallScore = overallScore / 10
    }

    // Atualizar sessão com avaliação
    const { error: updateError } = await supabaseAdmin
      .from('test_roleplays')
      .update({
        evaluation,
        overall_score: overallScore,
        performance_level: evaluation.performance_level,
        status: 'completed',
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Erro ao salvar avaliação:', updateError)
      return NextResponse.json(
        { error: 'Erro ao salvar avaliação' },
        { status: 500 }
      )
    }

    console.log('💾 Avaliação salva! Duração:', durationSeconds, 'segundos')

    return NextResponse.json({
      success: true,
      evaluation,
      overallScore,
      performanceLevel: evaluation.performance_level,
      durationSeconds
    })
  } catch (error) {
    console.error('❌ Erro ao finalizar sessão:', error)
    return NextResponse.json(
      { error: 'Erro ao finalizar sessão' },
      { status: 500 }
    )
  }
}
