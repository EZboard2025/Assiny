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

const N8N_WEBHOOK_URL = 'https://ezboard.app.n8n.cloud/webhook/b34f1d38-493b-4ae8-8998-b8450ab84d16'

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

    // Buscar company_id do usuário da sessão
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', session.user_id)
      .single()

    const companyId = employeeData?.company_id || null
    if (!companyId) {
      console.warn('⚠️ company_id não encontrado para o usuário:', session.user_id)
    } else {
      console.log('✅ company_id encontrado:', companyId)
    }

    // Montar transcrição formatada
    const messages = session.messages as Array<{ role: string; text: string; timestamp: string }>
    const transcription = messages
      .map(msg => {
        const role = msg.role === 'seller' ? 'Vendedor' : 'Cliente'
        return `${role}: ${msg.text}`
      })
      .join('\n')

    // Preparar contexto (mantido para compatibilidade)
    const config = session.config as any
    const context = {
      age: config.age,
      temperament: config.temperament,
      persona: config.segment || config.persona || '', // Suporta ambos os campos
      objections: config.objections || []
    }

    // Preparar perfil completo do cliente simulado (em texto formatado)
    let client_profile = `PERFIL DO CLIENTE SIMULADO

DADOS DEMOGRÁFICOS:
- Idade: ${config.age}
- Temperamento: ${config.temperament}
- Persona/Segmento: ${config.segment || config.persona || 'Não especificado'}

OBJEÇÕES TRABALHADAS:`

    if (config.objections && config.objections.length > 0) {
      config.objections.forEach((obj: any, index: number) => {
        // Se for string (formato antigo)
        if (typeof obj === 'string') {
          client_profile += `\n\n${index + 1}. ${obj}`
          client_profile += `\n   Formas de quebrar: Não cadastradas`
        } else {
          // Formato novo com rebuttals
          client_profile += `\n\n${index + 1}. ${obj.name}`
          if (obj.rebuttals && obj.rebuttals.length > 0) {
            client_profile += `\n   Formas de quebrar:`
            obj.rebuttals.forEach((rebuttal: string, i: number) => {
              client_profile += `\n   ${String.fromCharCode(97 + i)}) ${rebuttal}`
            })
          } else {
            client_profile += `\n   Formas de quebrar: Não cadastradas`
          }
        }
      })
    } else {
      client_profile += `\n\nNenhuma objeção específica foi configurada para este roleplay.`
    }

    console.log('📤 Enviando para N8N...')
    console.log('Contexto:', JSON.stringify(context, null, 2))
    console.log('Perfil do Cliente:\n', client_profile)
    console.log('Transcrição:', transcription.substring(0, 200) + '...')

    // Enviar para N8N
    const n8nPayload = {
      transcription,
      context,
      client_profile,
      companyId: companyId // ID da empresa para contexto do agente
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

    let rawResponse = await n8nResponse.json()
    console.log('✅ Resposta N8N recebida')

    // Parse do formato N8N: sempre verifica se tem campo 'output' string
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
