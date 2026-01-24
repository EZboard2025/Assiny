import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { companyId, credits } = await request.json()

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID é obrigatório' },
        { status: 400 }
      )
    }

    if (!credits || credits <= 0) {
      return NextResponse.json(
        { error: 'Quantidade de créditos inválida' },
        { status: 400 }
      )
    }

    // Buscar créditos atuais da empresa
    const { data: company, error: fetchError } = await supabaseAdmin
      .from('companies')
      .select('monthly_credits_used, name')
      .eq('id', companyId)
      .single()

    if (fetchError || !company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    // Calcular novo valor (reduzir o contador de créditos usados)
    const currentUsed = company.monthly_credits_used || 0
    const newUsed = Math.max(0, currentUsed - credits) // Não pode ser negativo

    // Atualizar créditos usados
    const { error: updateError } = await supabaseAdmin
      .from('companies')
      .update({
        monthly_credits_used: newUsed,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)

    if (updateError) {
      console.error('Erro ao atualizar créditos:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar créditos' },
        { status: 500 }
      )
    }

    console.log(`✅ Créditos adicionados para ${company.name}: -${credits} (${currentUsed} -> ${newUsed})`)

    return NextResponse.json({
      success: true,
      message: `${credits} créditos adicionados com sucesso`,
      previousUsed: currentUsed,
      newUsed: newUsed,
      creditsAdded: credits
    })

  } catch (error: any) {
    console.error('Erro ao adicionar créditos:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
