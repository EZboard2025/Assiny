import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { valid: false, error: 'ID da empresa é obrigatório' },
        { status: 400 }
      )
    }

    // Find company by ID
    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .select('id, name, subdomain')
      .eq('id', companyId)
      .single()

    if (error || !company) {
      return NextResponse.json(
        { valid: false, error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      valid: true,
      companyId: company.id,
      companyName: company.name
    })

  } catch (error) {
    console.error('Erro ao validar empresa:', error)
    return NextResponse.json(
      { valid: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
