import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateRoleplay } from '@/lib/evaluation/evaluateRoleplay'

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
      persona: config?.persona?.cargo || config?.persona?.job_title || config?.persona?.profession || 'Não especificado',
      objections: config?.objections?.map((obj: any) => obj.name).join(', ') || 'Nenhuma'
    }

    console.log('📋 Contexto extraído:', context)

    // Preparar perfil completo do cliente simulado (formato texto igual ao roleplay de treinamento)
    let client_profile = `PERFIL DO CLIENTE SIMULADO

DADOS DEMOGRÁFICOS:
- Idade: ${config?.age || 'Não especificado'}
- Temperamento: ${config?.temperament || 'Não especificado'}
- Persona/Segmento: ${config?.persona?.cargo || config?.persona?.job_title || config?.persona?.profession || 'Não especificado'}

OBJETIVO DO ROLEPLAY:
${config?.objective?.name || 'Não especificado'}
${config?.objective?.description ? `Descrição: ${config.objective.description}` : ''}

OBJEÇÕES TRABALHADAS:`

    if (config?.objections && config.objections.length > 0) {
      config.objections.forEach((obj: any, index: number) => {
        client_profile += `\n\n${index + 1}. ${obj.name}`
        if (obj.rebuttals && obj.rebuttals.length > 0) {
          client_profile += `\n   Formas de quebrar:`
          obj.rebuttals.forEach((rebuttal: string, i: number) => {
            client_profile += `\n   ${String.fromCharCode(97 + i)}) ${rebuttal}`
          })
        } else {
          client_profile += `\n   Formas de quebrar: Não cadastradas`
        }
      })
    } else {
      client_profile += `\n\nNenhuma objeção específica foi configurada para este roleplay.`
    }

    console.log('👤 Perfil do Cliente:\n', client_profile)

    // Avaliar roleplay diretamente via OpenAI (substituiu N8N)
    const objetivo = config?.objective?.name
      ? `${config.objective.name}${config.objective.description ? `\nDescrição: ${config.objective.description}` : ''}`
      : 'Não especificado'

    console.log('📤 Iniciando avaliação direta via OpenAI...')

    const evaluation = await evaluateRoleplay({
      transcription,
      clientProfile: client_profile,
      objetivo,
      companyId: session.company_id
    })

    console.log('✅ Avaliação pronta - Score:', evaluation.overall_score, '| Level:', evaluation.performance_level)

    // Calcular duração da sessão
    const startedAt = new Date(session.created_at || session.started_at)
    const endedAt = new Date()
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

    // overall_score já vem na escala 0-10 da função evaluateRoleplay
    const overallScoreConverted = evaluation?.overall_score ?? null
    console.log(`📊 Score final: ${overallScoreConverted}/10`)

    // Atualizar sessão com avaliação e status completed
    const { error: updateError } = await supabaseAdmin
      .from('roleplays_unicos')
      .update({
        status: 'completed',
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        evaluation: evaluation,
        overall_score: overallScoreConverted,
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
