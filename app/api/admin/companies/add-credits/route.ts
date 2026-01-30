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

    // Buscar créditos extras atuais da empresa
    const { data: company, error: fetchError } = await supabaseAdmin
      .from('companies')
      .select('extra_monthly_credits, name')
      .eq('id', companyId)
      .single()

    if (fetchError || !company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    // Adicionar aos créditos extras (acumula com o plano base)
    const currentExtra = company.extra_monthly_credits || 0
    const newExtra = currentExtra + credits

    // Atualizar créditos extras
    const { error: updateError } = await supabaseAdmin
      .from('companies')
      .update({
        extra_monthly_credits: newExtra,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)

    if (updateError) {
      console.error('Erro ao atualizar créditos extras:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar créditos extras' },
        { status: 500 }
      )
    }

    console.log(`✅ Créditos extras adicionados para ${company.name}: +${credits} (${currentExtra} -> ${newExtra})`)

    return NextResponse.json({
      success: true,
      message: `${credits} créditos extras adicionados com sucesso`,
      previousExtra: currentExtra,
      newExtra: newExtra,
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
