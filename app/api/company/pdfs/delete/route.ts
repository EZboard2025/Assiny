import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

// Usar service role para bypass RLS no storage
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const pdfId = searchParams.get('id')

    if (!pdfId) {
      return NextResponse.json(
        { error: 'ID do PDF não informado' },
        { status: 400 }
      )
    }

    // Obter company_id do subdomain
    const companyId = await getCompanyId()
    if (!companyId) {
      return NextResponse.json(
        { error: 'Empresa não identificada' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Deletando PDF: ${pdfId}`)

    // Buscar o PDF para obter o file_path
    const { data: pdf, error: fetchError } = await supabaseAdmin
      .from('company_pdfs')
      .select('*')
      .eq('id', pdfId)
      .eq('company_id', companyId)
      .single()

    if (fetchError || !pdf) {
      console.error('❌ PDF não encontrado:', fetchError)
      return NextResponse.json(
        { error: 'PDF não encontrado' },
        { status: 404 }
      )
    }

    // Deletar do Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('company-pdfs')
      .remove([pdf.file_path])

    if (storageError) {
      console.error('⚠️ Erro ao deletar do storage (continuando):', storageError)
      // Continua mesmo se falhar no storage, para limpar o banco
    }

    // Deletar do banco
    const { error: dbError } = await supabaseAdmin
      .from('company_pdfs')
      .delete()
      .eq('id', pdfId)
      .eq('company_id', companyId)

    if (dbError) {
      console.error('❌ Erro ao deletar do banco:', dbError)
      return NextResponse.json(
        { error: 'Erro ao deletar PDF', details: dbError.message },
        { status: 500 }
      )
    }

    console.log('✅ PDF deletado com sucesso')

    return NextResponse.json({
      success: true,
      message: 'PDF deletado com sucesso'
    })

  } catch (error) {
    console.error('💥 Erro geral na deleção:', error)
    return NextResponse.json(
      {
        error: 'Erro ao deletar PDF',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
