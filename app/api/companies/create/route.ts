import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { name, subdomain } = await request.json()

    if (!name || !subdomain) {
      return NextResponse.json({
        success: false,
        error: 'Nome e subdomínio são obrigatórios'
      }, { status: 400 })
    }

    // Usar service role key para criar empresa
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: company, error } = await supabaseAdmin
      .from('companies')
      .insert([{ name, subdomain }])
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar empresa:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    console.log('Empresa criada:', company)

    return NextResponse.json({
      success: true,
      company
    })

  } catch (error: any) {
    console.error('Erro ao criar empresa:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
