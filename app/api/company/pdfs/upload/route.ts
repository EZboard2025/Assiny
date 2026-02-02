import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

// Usar service role para bypass RLS no storage
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
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

    console.log(`📤 Uploading PDF: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`)

    // Converter File para Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Gerar nome único para o arquivo
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${companyId}/${timestamp}_${sanitizedName}`

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('company-pdfs')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError)
      return NextResponse.json(
        { error: 'Erro ao fazer upload do arquivo', details: uploadError.message },
        { status: 500 }
      )
    }

    console.log('✅ Upload concluído:', uploadData.path)

    // Salvar metadados no banco
    const { data: pdfRecord, error: dbError } = await supabaseAdmin
      .from('company_pdfs')
      .insert({
        company_id: companyId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        uploaded_by: userId || null
      })
      .select()
      .single()

    if (dbError) {
      console.error('❌ Erro ao salvar metadados:', dbError)
      // Tentar deletar o arquivo do storage se falhar no banco
      await supabaseAdmin.storage.from('company-pdfs').remove([filePath])
      return NextResponse.json(
        { error: 'Erro ao salvar informações do arquivo', details: dbError.message },
        { status: 500 }
      )
    }

    console.log('✅ Metadados salvos:', pdfRecord.id)

    return NextResponse.json({
      success: true,
      pdf: {
        id: pdfRecord.id,
        file_name: pdfRecord.file_name,
        file_path: pdfRecord.file_path,
        file_size: pdfRecord.file_size,
        uploaded_at: pdfRecord.uploaded_at
      }
    })

  } catch (error) {
    console.error('💥 Erro geral no upload:', error)
    return NextResponse.json(
      {
        error: 'Erro ao processar upload',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
