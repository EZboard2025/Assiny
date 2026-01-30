import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'

const AI_GENERATION_CREDIT_COST = 0.5 // Custo em créditos por geração com IA

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
  try {
    const { companyId, generationType } = await req.json()

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar dados de créditos da empresa
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      console.error('❌ Erro ao buscar empresa:', companyError)
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se precisa resetar o contador mensal
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
      console.log('🔄 Reset mensal aplicado para empresa:', companyId)
    }

    // Calcular limite total (plano + extras)
    const planConfig = PLAN_CONFIGS[company.training_plan as PlanType]
    const baseLimit = planConfig?.monthlyCredits

    // Verificar se tem créditos disponíveis (null = ilimitado)
    if (baseLimit !== null) {
      const totalLimit = baseLimit + currentExtraCredits
      const remaining = totalLimit - currentCreditsUsed

      if (remaining < AI_GENERATION_CREDIT_COST) {
        console.log(`❌ Empresa ${companyId} sem créditos suficientes para IA: ${remaining} restantes`)
        return NextResponse.json(
          {
            error: 'Créditos insuficientes',
            message: `Geração com IA requer ${AI_GENERATION_CREDIT_COST} créditos. Você tem apenas ${remaining} créditos disponíveis.`
          },
          { status: 403 }
        )
      }

      console.log(`✅ Créditos disponíveis para IA: ${remaining} restantes (custo: ${AI_GENERATION_CREDIT_COST})`)
    } else {
      console.log('♾️ Empresa com créditos ilimitados (Enterprise)')
    }

    // Consumir crédito
    const newCreditsUsed = currentCreditsUsed + AI_GENERATION_CREDIT_COST
    const { error: updateError } = await supabaseAdmin
      .from('companies')
      .update({ monthly_credits_used: newCreditsUsed })
      .eq('id', companyId)

    if (updateError) {
      console.error('⚠️ Erro ao consumir créditos:', updateError)
      return NextResponse.json(
        { error: 'Erro ao consumir créditos' },
        { status: 500 }
      )
    }

    console.log(`💳 ${AI_GENERATION_CREDIT_COST} créditos consumidos para ${generationType || 'geração IA'}: ${currentCreditsUsed} → ${newCreditsUsed}`)

    // Registrar na tabela de gerações
    const { error: insertError } = await supabaseAdmin
      .from('ai_generations')
      .insert({
        company_id: companyId,
        generation_type: generationType || 'unknown',
        credits_used: AI_GENERATION_CREDIT_COST,
        created_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('⚠️ Erro ao registrar geração de IA:', insertError)
    } else {
      console.log(`📝 Geração registrada: ${generationType} para empresa ${companyId}`)
    }

    return NextResponse.json({
      success: true,
      creditsUsed: AI_GENERATION_CREDIT_COST,
      newTotal: newCreditsUsed
    })

  } catch (error) {
    console.error('💥 Erro ao consumir crédito de IA:', error)
    return NextResponse.json(
      { error: 'Erro interno ao processar créditos' },
      { status: 500 }
    )
  }
}
