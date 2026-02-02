import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { evaluateChallengePerformance } from '@/lib/challenges/evaluateChallengePerformance'
import { evaluateRoleplay } from '@/lib/evaluation/evaluateRoleplay'

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, challengeId } = body

    if (!sessionId) {
      console.error('❌ sessionId não fornecido no body:', body)
      return NextResponse.json({ error: 'sessionId é obrigatório' }, { status: 400 })
    }

    console.log('🎯 challengeId recebido:', challengeId || 'nenhum')

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

    // Verificar se esta sessão pertence a um desafio
    // Prioriza o challengeId passado diretamente (mais confiável)
    // Fallback: busca reversa pelo roleplay_session_id (para compatibilidade)
    let challenge_context = null
    let challengeData = null
    let challengeError = null

    if (challengeId) {
      // Busca direta pelo ID do desafio (mais confiável)
      console.log('🎯 Buscando desafio pelo challengeId:', challengeId)
      const result = await supabase
        .from('daily_challenges')
        .select('id, challenge_config, difficulty_level')
        .eq('id', challengeId)
        .single()
      challengeData = result.data
      challengeError = result.error
    } else {
      // Fallback: busca reversa (mantido para compatibilidade)
      console.log('🔍 Buscando desafio pelo roleplay_session_id:', sessionId)
      const result = await supabase
        .from('daily_challenges')
        .select('id, challenge_config, difficulty_level')
        .eq('roleplay_session_id', sessionId)
        .single()
      challengeData = result.data
      challengeError = result.error
    }

    if (challengeData && !challengeError) {
      console.log('🎯 Desafio encontrado:', challengeData.id)

      const challengeConfig = challengeData.challenge_config as any

      // Normalizar target_letter para apenas a letra (S, P, I, N)
      // Pode vir como "spin_S", "spin_s", "S", ou "s"
      let rawTargetLetter = challengeConfig.success_criteria?.spin_letter_target || ''
      const normalizedTargetLetter = rawTargetLetter
        .replace(/spin_/i, '') // Remove prefixo "spin_"
        .toUpperCase() // Converte para maiúscula
        .charAt(0) || null // Pega apenas a primeira letra

      challenge_context = {
        is_challenge: true,
        target_letter: normalizedTargetLetter,
        target_score: challengeConfig.success_criteria?.spin_min_score || null,
        target_weakness: challengeConfig.target_weakness || null,
        difficulty_level: challengeData.difficulty_level || 1,
        coaching_tips: challengeConfig.coaching_tips || [],
        challenge_title: challengeConfig.title || 'Desafio Diário'
      }
      console.log('📊 Target letter normalizado:', rawTargetLetter, '->', normalizedTargetLetter)
      console.log('✅ Contexto do desafio montado:', JSON.stringify(challenge_context, null, 2))
    } else if (challengeError && challengeError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (sessão normal, não é desafio)
      console.warn('⚠️ Erro ao buscar desafio:', challengeError)
    }

    console.log('📤 Iniciando avaliação direta via OpenAI...')
    console.log('Contexto:', JSON.stringify(context, null, 2))
    console.log('Transcrição:', transcription.substring(0, 200) + '...')
    if (challenge_context) {
      console.log('🎯 Challenge Context:', JSON.stringify(challenge_context, null, 2))
    }

    // Avaliar roleplay diretamente via OpenAI (substituiu N8N)
    const objetivo = config.objective?.name
      ? `${config.objective.name}${config.objective.description ? `\nDescrição: ${config.objective.description}` : ''}`
      : 'Não especificado'

    const evaluation = await evaluateRoleplay({
      transcription,
      clientProfile: client_profile,
      objetivo,
      companyId
    })

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
