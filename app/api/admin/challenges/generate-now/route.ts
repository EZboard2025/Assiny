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

interface GenerationResult {
  userId: string
  userName: string
  companyId: string
  companyName: string
  status: 'success' | 'skipped' | 'error'
  reason?: string
  challengeId?: string
}

// POST - Generate challenges now (admin only, deletes existing ones first)
export async function POST(req: NextRequest) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const results: GenerationResult[] = []
    let totalGenerated = 0
    let totalSkipped = 0
    let totalErrors = 0
    let totalCreditsUsed = 0
    let totalDeleted = 0

    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 GERAÇÃO MANUAL DE DESAFIOS - ${new Date().toLocaleString('pt-BR')}`)
    console.log(`${'='.repeat(60)}\n`)

    // 1. Delete all existing challenges for today
    const { data: deletedChallenges, error: deleteError } = await supabaseAdmin
      .from('daily_challenges')
      .delete()
      .eq('challenge_date', today)
      .select('id')

    if (deleteError) {
      console.error('Erro ao deletar desafios existentes:', deleteError)
    } else {
      totalDeleted = deletedChallenges?.length || 0
      console.log(`🗑️ ${totalDeleted} desafios existentes deletados`)
    }

    // 2. Get all companies with daily challenges enabled
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('companies')
      .select('id, name, subdomain, daily_challenges_enabled, training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
      .eq('daily_challenges_enabled', true)

    if (companiesError) {
      throw new Error(`Error fetching companies: ${companiesError.message}`)
    }

    if (!companies || companies.length === 0) {
      console.log('⚠️ Nenhuma empresa com desafios diários habilitados')
      return NextResponse.json({
        success: true,
        message: 'Nenhuma empresa com desafios diários habilitados',
        deleted: totalDeleted,
        results: [],
        summary: { generated: 0, skipped: 0, errors: 0, creditsUsed: 0 }
      })
    }

    console.log(`📊 ${companies.length} empresas com desafios habilitados\n`)

    // 3. Process each company
    for (const company of companies) {
      console.log(`\n🏢 Processando: ${company.name} (${company.subdomain})`)

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
          .eq('id', company.id)

        currentCreditsUsed = 0
        currentExtraCredits = 0
      }

      const planConfig = PLAN_CONFIGS[company.training_plan as PlanType]
      const baseLimit = planConfig?.monthlyCredits

      // 4. Get all employees for this company
      const { data: employees, error: employeesError } = await supabaseAdmin
        .from('employees')
        .select('user_id, name, email')
        .eq('company_id', company.id)

      if (employeesError || !employees) {
        console.log(`  ❌ Erro ao buscar funcionários: ${employeesError?.message}`)
        continue
      }

      console.log(`  👥 ${employees.length} vendedores encontrados`)

      // 5. Process each employee
      for (const employee of employees) {
        const userId = employee.user_id
        const userName = employee.name || employee.email

        // Check credits before generating
        if (baseLimit !== null) {
          const totalLimit = baseLimit + currentExtraCredits
          const remaining = totalLimit - currentCreditsUsed

          if (remaining < CHALLENGE_GENERATION_CREDIT_COST) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'skipped',
              reason: 'Empresa sem créditos suficientes'
            })
            totalSkipped++
            console.log(`    ⏭️ ${userName}: empresa sem créditos`)
            continue
          }
        }

        try {
          // Fetch user data and analyze weaknesses
          const userData = await fetchAllUserData(userId, company.id)

          if (!userData) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'skipped',
              reason: 'Erro ao buscar dados do usuário'
            })
            totalSkipped++
            continue
          }

          // Check if user has enough data
          const totalDataPoints = userData.roleplaySessions.length + userData.meetEvaluations.length

          if (totalDataPoints < 1) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'skipped',
              reason: 'Dados insuficientes para gerar desafio'
            })
            totalSkipped++
            console.log(`    ⏭️ ${userName}: dados insuficientes`)
            continue
          }

          // Check if weaknesses were detected
          if (userData.weaknesses.length === 0) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'skipped',
              reason: 'Nenhuma fraqueza detectada - boa performance'
            })
            totalSkipped++
            console.log(`    ✅ ${userName}: sem fraquezas detectadas`)
            continue
          }

          const topWeakness = getTopWeakness(userData.weaknesses)

          if (!topWeakness) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'skipped',
              reason: 'Nenhuma fraqueza prioritária identificada'
            })
            totalSkipped++
            continue
          }

          // Fetch personas and objections
          const [personasResult, objectionsResult, objectivesResult] = await Promise.all([
            supabaseAdmin.from('personas').select('*').eq('company_id', company.id),
            supabaseAdmin.from('objections').select('*').eq('company_id', company.id),
            supabaseAdmin.from('roleplay_objectives').select('*').eq('company_id', company.id)
          ])

          const personas = personasResult.data || []
          const objections = objectionsResult.data || []
          const objectives = objectivesResult.data || []

          if (personas.length === 0) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'skipped',
              reason: 'Empresa sem personas configuradas'
            })
            totalSkipped++
            console.log(`    ⏭️ ${userName}: empresa sem personas`)
            continue
          }

          // Calculate difficulty level
          const difficultyLevel = await calculateNextDifficulty(userId, topWeakness.target)

          // Generate challenge using OpenAI
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

IMPORTANTE: Retorne APENAS JSON válido, sem markdown ou texto adicional.`

          const userPrompt = `${weaknessPrompt}

FRAQUEZA PRINCIPAL A TRABALHAR: ${topWeakness.target.toUpperCase()}
- Score atual: ${topWeakness.currentScore.toFixed(1)}
- Severidade: ${topWeakness.severity}

Crie um desafio de roleplay personalizado.

Retorne um JSON com esta estrutura:
{
  "title": "Título curto (max 50 chars)",
  "description": "Descrição (max 200 chars)",
  "target_weakness": "${topWeakness.target}",
  "confidence_score": ${topWeakness.confidence.toFixed(2)},
  "roleplay_config": {
    "persona_id": "UUID da persona",
    "objection_ids": ["UUID1"],
    "age_range": "35-44",
    "temperament": "Analítico",
    "objective_id": null
  },
  "success_criteria": {
    "spin_letter_target": "I",
    "spin_min_score": 6.0,
    "primary_indicator": "indicador",
    "primary_min_score": 6.5,
    "objection_handling_min": 6.0
  },
  "coaching_tips": ["Dica 1", "Dica 2"],
  "analysis_summary": {
    "pattern_detected": "padrão",
    "roleplay_evidence": { "avg_score": 5.0, "sessions_count": 3 },
    "meet_evidence": { "avg_score": 5.0, "calls_count": 2 }
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
            const cleanJson = responseText
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim()
            challengeConfig = JSON.parse(cleanJson)
          } catch (parseError) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'error',
              reason: 'Erro ao processar resposta da IA'
            })
            totalErrors++
            console.log(`    ❌ ${userName}: erro ao processar resposta da IA`)
            continue
          }

          // Validate persona and objection IDs
          const validPersona = personas.find(p => p.id === challengeConfig.roleplay_config.persona_id)
          if (!validPersona && personas.length > 0) {
            challengeConfig.roleplay_config.persona_id = personas[0].id
          }

          const validObjectionIds = challengeConfig.roleplay_config.objection_ids.filter(
            (id: string) => objections.some(o => o.id === id)
          )
          if (validObjectionIds.length === 0 && objections.length > 0) {
            challengeConfig.roleplay_config.objection_ids = [objections[0].id]
          } else {
            challengeConfig.roleplay_config.objection_ids = validObjectionIds
          }

          // Build AI reasoning text
          const aiReasoning = `
Geração manual - ${new Date().toLocaleString('pt-BR')}

FRAQUEZA PRINCIPAL: ${topWeakness.target.toUpperCase()} (score: ${topWeakness.currentScore.toFixed(1)}, severidade: ${topWeakness.severity})

${topWeakness.pattern ? `PADRÃO DETECTADO: ${topWeakness.pattern}` : ''}

DIFICULDADE: ${difficultyLevel}/5
          `.trim()

          // Save challenge to database
          const { data: newChallenge, error: insertError } = await supabaseAdmin
            .from('daily_challenges')
            .insert({
              user_id: userId,
              company_id: company.id,
              challenge_date: today,
              status: 'pending',
              difficulty_level: difficultyLevel,
              challenge_config: challengeConfig,
              ai_reasoning: aiReasoning
            })
            .select()
            .single()

          if (insertError) {
            results.push({
              userId,
              userName,
              companyId: company.id,
              companyName: company.name,
              status: 'error',
              reason: `Erro ao salvar: ${insertError.message}`
            })
            totalErrors++
            console.log(`    ❌ ${userName}: erro ao salvar desafio`)
            continue
          }

          // Consume credit
          currentCreditsUsed += CHALLENGE_GENERATION_CREDIT_COST
          await supabaseAdmin
            .from('companies')
            .update({ monthly_credits_used: currentCreditsUsed })
            .eq('id', company.id)

          totalCreditsUsed += CHALLENGE_GENERATION_CREDIT_COST
          totalGenerated++

          results.push({
            userId,
            userName,
            companyId: company.id,
            companyName: company.name,
            status: 'success',
            challengeId: newChallenge.id
          })

          console.log(`    ✅ ${userName}: desafio gerado (${challengeConfig.title})`)

        } catch (error) {
          results.push({
            userId,
            userName,
            companyId: company.id,
            companyName: company.name,
            status: 'error',
            reason: error instanceof Error ? error.message : String(error)
          })
          totalErrors++
          console.log(`    ❌ ${userName}: erro - ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`📊 RESUMO DA GERAÇÃO MANUAL`)
    console.log(`${'='.repeat(60)}`)
    console.log(`🗑️ Deletados: ${totalDeleted}`)
    console.log(`✅ Gerados: ${totalGenerated}`)
    console.log(`⏭️ Pulados: ${totalSkipped}`)
    console.log(`❌ Erros: ${totalErrors}`)
    console.log(`💰 Créditos usados: ${totalCreditsUsed}`)
    console.log(`${'='.repeat(60)}\n`)

    // Store last manual generation info
    await supabaseAdmin
      .from('system_settings')
      .upsert({
        key: 'last_manual_challenge_generation',
        value: {
          timestamp: new Date().toISOString(),
          deleted: totalDeleted,
          generated: totalGenerated,
          skipped: totalSkipped,
          errors: totalErrors,
          creditsUsed: totalCreditsUsed
        }
      }, { onConflict: 'key' })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      deleted: totalDeleted,
      summary: {
        generated: totalGenerated,
        skipped: totalSkipped,
        errors: totalErrors,
        creditsUsed: totalCreditsUsed
      },
      results
    })

  } catch (error) {
    console.error('💥 [admin/challenges/generate-now] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
