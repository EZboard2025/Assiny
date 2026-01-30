import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { fetchAllUserData, formatWeaknessesForPrompt, getTopWeakness } from '@/lib/challenges/analyzeUserWeaknesses'
import { calculateNextDifficulty } from '@/lib/challenges/trackChallengeEffectiveness'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'

const CHALLENGE_GENERATION_CREDIT_COST = 1

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, companyId } = body

    if (!userId || !companyId) {
      return NextResponse.json(
        { error: 'userId e companyId são obrigatórios' },
        { status: 400 }
      )
    }

    // Check if daily challenges are enabled for this company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('daily_challenges_enabled, training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    if (!company.daily_challenges_enabled) {
      return NextResponse.json(
        { error: 'Desafios diários estão desabilitados para esta empresa' },
        { status: 403 }
      )
    }

    // Check credits
    const lastReset = new Date(company.monthly_credits_reset_at)
    const now = new Date()
    const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                       now.getFullYear() !== lastReset.getFullYear()

    let currentCreditsUsed = company.monthly_credits_used || 0
    let currentExtraCredits = company.extra_monthly_credits || 0

    if (isNewMonth) {
      await supabaseAdmin
        .from('companies')
        .update({
          monthly_credits_used: 0,
          extra_monthly_credits: 0,
          monthly_credits_reset_at: now.toISOString()
        })
        .eq('id', companyId)

      currentCreditsUsed = 0
      currentExtraCredits = 0
    }

    const planConfig = PLAN_CONFIGS[company.training_plan as PlanType]
    const baseLimit = planConfig?.monthlyCredits

    if (baseLimit !== null) {
      const totalLimit = baseLimit + currentExtraCredits
      const remaining = totalLimit - currentCreditsUsed

      if (remaining < CHALLENGE_GENERATION_CREDIT_COST) {
        return NextResponse.json(
          {
            error: 'Créditos insuficientes',
            message: 'Esta empresa não tem créditos suficientes para gerar o desafio.'
          },
          { status: 403 }
        )
      }
    }

    // Check if user already has a challenge for today
    const today = new Date().toISOString().split('T')[0]
    const { data: existingChallenge } = await supabaseAdmin
      .from('daily_challenges')
      .select('id, status, challenge_config')
      .eq('user_id', userId)
      .eq('challenge_date', today)
      .single()

    if (existingChallenge) {
      return NextResponse.json({
        success: true,
        challenge: existingChallenge,
        message: 'Desafio de hoje já existe'
      })
    }

    // Fetch all user data and analyze weaknesses
    console.log('🔍 Analisando dados do vendedor...')
    const userData = await fetchAllUserData(userId, companyId)

    if (!userData) {
      return NextResponse.json(
        { error: 'Erro ao buscar dados do usuário' },
        { status: 500 }
      )
    }

    // Check if user has enough data
    const totalDataPoints = userData.roleplaySessions.length + userData.meetEvaluations.length

    if (totalDataPoints < 1) {
      return NextResponse.json(
        {
          error: 'Dados insuficientes',
          message: 'O vendedor precisa ter pelo menos 1 sessão de roleplay ou análise de call para gerar desafios personalizados.'
        },
        { status: 400 }
      )
    }

    // If no weaknesses detected, user might be performing well
    if (userData.weaknesses.length === 0) {
      return NextResponse.json({
        success: true,
        noChallenge: true,
        message: 'Nenhuma fraqueza significativa detectada! O vendedor está com boa performance.'
      })
    }

    // Get top weakness to target
    const topWeakness = getTopWeakness(userData.weaknesses)

    if (!topWeakness) {
      return NextResponse.json({
        success: true,
        noChallenge: true,
        message: 'Nenhuma fraqueza prioritária identificada.'
      })
    }

    // Fetch personas and objections for this company
    const [personasResult, objectionsResult, objectivesResult] = await Promise.all([
      supabaseAdmin
        .from('personas')
        .select('*')
        .eq('company_id', companyId),
      supabaseAdmin
        .from('objections')
        .select('*')
        .eq('company_id', companyId),
      supabaseAdmin
        .from('roleplay_objectives')
        .select('*')
        .eq('company_id', companyId)
    ])

    const personas = personasResult.data || []
    const objections = objectionsResult.data || []
    const objectives = objectivesResult.data || []

    if (personas.length === 0) {
      return NextResponse.json(
        {
          error: 'Configuração incompleta',
          message: 'A empresa precisa ter pelo menos uma persona configurada para gerar desafios.'
        },
        { status: 400 }
      )
    }

    // Calculate difficulty level
    const difficultyLevel = await calculateNextDifficulty(userId, topWeakness.target)

    // Generate challenge using OpenAI
    console.log('🤖 Gerando desafio personalizado com IA...')
    const weaknessPrompt = formatWeaknessesForPrompt(userData)

    const systemPrompt = `Você é um coach de vendas especialista em criar desafios de treinamento personalizados.

Sua tarefa é analisar as fraquezas de um vendedor e criar um desafio de roleplay que vai ajudá-lo a melhorar especificamente no ponto mais crítico.

PERSONAS DISPONÍVEIS:
${personas.map((p, i) => `${i + 1}. ID: ${p.id}
   - Cargo: ${p.job_title || p.cargo || 'N/A'}
   - Empresa/Perfil: ${p.company_type || p.tipo_empresa_faturamento || 'N/A'}
   - Contexto: ${p.context || p.contexto || 'N/A'}
   - O que busca: ${p.company_goals || p.what_seeks || p.busca || 'N/A'}
   - Dores: ${p.business_challenges || p.main_pains || p.dores || 'N/A'}
`).join('\n')}

OBJEÇÕES DISPONÍVEIS:
${objections.map((o, i) => `${i + 1}. ID: ${o.id}
   - Objeção: ${o.name}
   - Formas de quebrar: ${o.rebuttals?.join(', ') || 'N/A'}
`).join('\n')}

${objectives.length > 0 ? `OBJETIVOS DISPONÍVEIS:
${objectives.map((o, i) => `${i + 1}. ID: ${o.id} - ${o.name}: ${o.description || 'Sem descrição'}`).join('\n')}` : ''}

NÍVEL DE DIFICULDADE ATUAL: ${difficultyLevel}/5
- Nível 1-2: Cliente mais fácil, menos resistente, mais aberto
- Nível 3: Cliente moderado, resistência normal
- Nível 4-5: Cliente difícil, muito resistente, cético

REGRAS PARA SELEÇÃO:
1. Escolha a persona que NATURALMENTE vai disparar a fraqueza do vendedor
2. Escolha 1-2 objeções que o vendedor historicamente tem dificuldade
3. Defina idade e temperamento que INTENSIFIQUEM o treino da fraqueza
4. Se a fraqueza for em Implicação (I), escolha persona analítica/cética
5. Se a fraqueza for em Situação (S), escolha persona que exige muitas perguntas de contexto
6. Se a fraqueza for em CTA, escolha persona indecisa que precisa de direcionamento claro

IMPORTANTE: Retorne APENAS JSON válido, sem markdown ou texto adicional.`

    const userPrompt = `${weaknessPrompt}

FRAQUEZA PRINCIPAL A TRABALHAR: ${topWeakness.target.toUpperCase()}
- Score atual: ${topWeakness.currentScore.toFixed(1)}
- Severidade: ${topWeakness.severity}
- Padrão detectado: ${topWeakness.pattern || 'Não identificado'}

Crie um desafio de roleplay personalizado que vai FORÇAR o vendedor a praticar especificamente esta fraqueza.

Retorne um JSON com esta estrutura EXATA:
{
  "title": "Título curto e motivador do desafio (max 50 chars)",
  "description": "Descrição do cenário e objetivo (max 200 chars)",
  "target_weakness": "${topWeakness.target}",
  "confidence_score": ${topWeakness.confidence.toFixed(2)},
  "roleplay_config": {
    "persona_id": "UUID da persona selecionada",
    "objection_ids": ["UUID1", "UUID2"],
    "age_range": "faixa etária (ex: 35-44)",
    "temperament": "temperamento (Analítico, Empático, Determinado, Indeciso ou Sociável)",
    "objective_id": "UUID do objetivo ou null"
  },
  "success_criteria": {
    "spin_letter_target": "S, P, I ou N",
    "spin_min_score": 6.0,
    "primary_indicator": "nome do indicador chave",
    "primary_min_score": 6.5,
    "objection_handling_min": 6.0
  },
  "coaching_tips": [
    "Dica específica 1 baseada na fraqueza",
    "Dica específica 2 com técnica recomendada",
    "Dica específica 3 com exemplo de frase"
  ],
  "analysis_summary": {
    "pattern_detected": "descrição do padrão identificado",
    "roleplay_evidence": { "avg_score": X.X, "sessions_count": N },
    "meet_evidence": { "avg_score": X.X, "calls_count": N }
  }
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })

    let challengeConfig
    try {
      const responseText = completion.choices[0].message.content || ''
      // Remove markdown code blocks if present
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      challengeConfig = JSON.parse(cleanJson)
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError)
      console.error('Raw response:', completion.choices[0].message.content)
      return NextResponse.json(
        { error: 'Erro ao processar resposta da IA' },
        { status: 500 }
      )
    }

    // Validate that persona and objections exist
    const validPersona = personas.find(p => p.id === challengeConfig.roleplay_config.persona_id)
    if (!validPersona && personas.length > 0) {
      // AI might have hallucinated an ID, use first available persona
      challengeConfig.roleplay_config.persona_id = personas[0].id
      console.warn('⚠️ Persona ID corrigida para:', personas[0].id)
    }

    // Validate objection IDs
    const validObjectionIds = challengeConfig.roleplay_config.objection_ids.filter(
      (id: string) => objections.some(o => o.id === id)
    )
    if (validObjectionIds.length === 0 && objections.length > 0) {
      // Use first available objection
      challengeConfig.roleplay_config.objection_ids = [objections[0].id]
      console.warn('⚠️ Objection IDs corrigidos')
    } else {
      challengeConfig.roleplay_config.objection_ids = validObjectionIds
    }

    // Build AI reasoning text
    const aiReasoning = `
Análise baseada em ${userData.roleplaySessions.length} roleplays e ${userData.meetEvaluations.length} calls reais.

FRAQUEZA PRINCIPAL: ${topWeakness.target.toUpperCase()} (score: ${topWeakness.currentScore.toFixed(1)}, severidade: ${topWeakness.severity})

${topWeakness.pattern ? `PADRÃO DETECTADO: ${topWeakness.pattern}` : ''}

${topWeakness.evidenceSources.roleplay ? `Evidência Roleplay: média ${topWeakness.evidenceSources.roleplay.avgScore.toFixed(1)} em ${topWeakness.evidenceSources.roleplay.sessionsCount} sessões (tendência: ${topWeakness.evidenceSources.roleplay.trend})` : ''}
${topWeakness.evidenceSources.meet ? `Evidência Calls: média ${topWeakness.evidenceSources.meet.avgScore.toFixed(1)} em ${topWeakness.evidenceSources.meet.callsCount} calls` : ''}

DIFICULDADE: ${difficultyLevel}/5
    `.trim()

    // Save challenge to database
    const { data: newChallenge, error: insertError } = await supabaseAdmin
      .from('daily_challenges')
      .insert({
        user_id: userId,
        company_id: companyId,
        challenge_date: today,
        status: 'pending',
        difficulty_level: difficultyLevel,
        challenge_config: challengeConfig,
        ai_reasoning: aiReasoning
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error saving challenge:', insertError)
      return NextResponse.json(
        { error: 'Erro ao salvar desafio' },
        { status: 500 }
      )
    }

    // Consume credit
    await supabaseAdmin
      .from('companies')
      .update({ monthly_credits_used: currentCreditsUsed + CHALLENGE_GENERATION_CREDIT_COST })
      .eq('id', companyId)

    console.log(`✅ Desafio gerado! ID: ${newChallenge.id}, Crédito consumido: ${currentCreditsUsed} → ${currentCreditsUsed + CHALLENGE_GENERATION_CREDIT_COST}`)

    return NextResponse.json({
      success: true,
      challenge: newChallenge,
      creditsUsed: CHALLENGE_GENERATION_CREDIT_COST
    })

  } catch (error) {
    console.error('💥 [challenges/generate] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// GET - Fetch today's challenge for a user
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const companyId = searchParams.get('companyId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      )
    }

    // Check if challenges are enabled
    if (companyId) {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('daily_challenges_enabled')
        .eq('id', companyId)
        .single()

      if (!company?.daily_challenges_enabled) {
        return NextResponse.json({
          success: true,
          challenge: null,
          disabled: true
        })
      }
    }

    // Get today's challenge
    const today = new Date().toISOString().split('T')[0]
    const { data: challenge, error } = await supabaseAdmin
      .from('daily_challenges')
      .select('*')
      .eq('user_id', userId)
      .eq('challenge_date', today)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return NextResponse.json({
      success: true,
      challenge: challenge || null
    })

  } catch (error) {
    console.error('💥 [challenges/generate GET] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}
