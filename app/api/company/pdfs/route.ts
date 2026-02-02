import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

// Usar service role para bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Obter company_id do subdomain
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json(
        { error: 'Empresa não identificada' },
        { status: 400 }
      )
    }

    // Buscar PDFs da empresa
    const { data: pdfs, error } = await supabaseAdmin
      .from('company_pdfs')
      .select('*')
      .eq('company_id', companyId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('❌ Erro ao buscar PDFs:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar PDFs', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      pdfs: pdfs || []
    })

  } catch (error) {
    console.error('💥 Erro geral ao listar PDFs:', error)
    return NextResponse.json(
      {
        error: 'Erro ao listar PDFs',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
