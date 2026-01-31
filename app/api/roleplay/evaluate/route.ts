import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateChallengePerformance } from '@/lib/challenges/evaluateChallengePerformance'

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

    // Usar IDs reais das objeções do banco de dados
    const objectionsWithIds = (config.objections || []).map((obj: any, index: number) => {
      if (typeof obj === 'string') {
        // Formato antigo (apenas string) - usar índice como fallback
        return {
          id: `legacy-${index}`,
          name: obj,
          rebuttals: []
        }
      } else {
        // Formato novo - usar o ID real do banco de dados
        return {
          id: obj.id || `unknown-${index}`, // ID real do banco
          name: obj.name,
          rebuttals: obj.rebuttals || []
        }
      }
    })

    const context = {
      age: config.age,
      temperament: config.temperament,
      persona: config.segment || config.persona || '', // Suporta ambos os campos
      objections: objectionsWithIds
    }

    // Preparar perfil completo do cliente simulado (em texto formatado)
    let client_profile = `PERFIL DO CLIENTE SIMULADO

INSTRUÇÃO IMPORTANTE PARA O AVALIADOR:
Ao analisar as objeções no diálogo, você DEVE:
1. Identificar quando cada objeção configurada abaixo aparece no diálogo
2. Incluir o ID da objeção no campo "objection_id" da sua análise
3. Se a objeção identificada corresponder a uma das configuradas, usar o ID fornecido
4. Se for uma objeção não configurada, usar "objection_id": "não-configurada"

DADOS DEMOGRÁFICOS:
- Idade: ${config.age}
- Temperamento: ${config.temperament}
- Persona/Segmento: ${config.segment || config.persona || 'Não especificado'}

OBJETIVO DO ROLEPLAY:
${config.objective?.name || 'Não especificado'}
${config.objective?.description ? `Descrição: ${config.objective.description}` : ''}

OBJEÇÕES TRABALHADAS:`

    if (objectionsWithIds && objectionsWithIds.length > 0) {
      objectionsWithIds.forEach((obj: any, index: number) => {
        client_profile += `\n\n${index + 1}. [ID: ${obj.id}] ${obj.name}`
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

    // Verificar se esta sessão pertence a um desafio (busca reversa)
    let challenge_context = null
    const { data: challengeData, error: challengeError } = await supabase
      .from('daily_challenges')
      .select('id, challenge_config, difficulty_level')
      .eq('roleplay_session_id', sessionId)
      .single()

    if (challengeData && !challengeError) {
      console.log('🎯 Sessão pertence a um desafio:', challengeData.id)

      const challengeConfig = challengeData.challenge_config as any
      challenge_context = {
        is_challenge: true,
        target_letter: challengeConfig.success_criteria?.spin_letter_target || null,
        target_score: challengeConfig.success_criteria?.spin_min_score || null,
        target_weakness: challengeConfig.target_weakness || null,
        difficulty_level: challengeData.difficulty_level || 1,
        coaching_tips: challengeConfig.coaching_tips || [],
        challenge_title: challengeConfig.title || 'Desafio Diário'
      }
      console.log('✅ Contexto do desafio montado:', JSON.stringify(challenge_context, null, 2))
    } else if (challengeError && challengeError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (sessão normal, não é desafio)
      console.warn('⚠️ Erro ao buscar desafio:', challengeError)
    }

    console.log('📤 Enviando para N8N...')
    console.log('Contexto:', JSON.stringify(context, null, 2))
    console.log('Perfil do Cliente:\n', client_profile)
    console.log('Transcrição:', transcription.substring(0, 200) + '...')
    if (challenge_context) {
      console.log('🎯 Challenge Context:', JSON.stringify(challenge_context, null, 2))
    }

    // Enviar para N8N
    const n8nPayload = {
      transcription,
      context,
      client_profile,
      companyId: companyId, // ID da empresa para contexto do agente
      objetivo: config.objective?.name
        ? `${config.objective.name}${config.objective.description ? `\nDescrição: ${config.objective.description}` : ''}`
        : 'Não especificado',
      challenge_context: challenge_context // null para roleplays normais, objeto para desafios
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

    // Se é um desafio, avaliar performance específica do desafio usando agente no código
    if (challenge_context) {
      console.log('🎯 Avaliando performance específica do desafio...')
      try {
        const challengePerformance = await evaluateChallengePerformance(
          transcription,
          evaluation,
          challenge_context
        )
        // Adicionar challenge_performance à avaliação
        evaluation.challenge_performance = challengePerformance
        console.log('✅ Challenge performance adicionado:', {
          goal_achieved: challengePerformance.goal_achieved,
          achieved_score: challengePerformance.achieved_score,
          target_score: challengePerformance.target_score
        })
      } catch (challengeError) {
        console.error('⚠️ Erro ao avaliar desafio (continuando sem challenge_performance):', challengeError)
        // Não falha a avaliação principal se o desafio falhar
      }
    }

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
