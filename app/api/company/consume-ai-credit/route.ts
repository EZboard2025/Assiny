import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const AI_GENERATION_CREDIT_COST = 0.5

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyId, generationType } = body

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId é obrigatório' },
        { status: 400 }
      )
    }

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
      console.error('❌ Erro ao registrar geração de IA:', insertError)
      return NextResponse.json(
        { error: 'Erro ao registrar geração', details: insertError.message },
        { status: 500 }
      )
    }

    console.log(`📝 Geração registrada: ${generationType} para empresa ${companyId}`)

    return NextResponse.json({
      success: true,
      creditsUsed: AI_GENERATION_CREDIT_COST
    })

  } catch (error) {
    console.error('💥 [consume-ai-credit] Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
