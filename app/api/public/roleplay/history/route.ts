import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const linkCode = searchParams.get('link')
    const linkId = searchParams.get('linkId')

    // Aceitar tanto linkCode quanto linkId
    if (!linkCode && !linkId) {
      return NextResponse.json(
        { error: 'Link code ou linkId não fornecido' },
        { status: 400 }
      )
    }

    let finalLinkId = linkId

    // Se recebeu linkCode, buscar o linkId
    if (linkCode && !linkId) {
      console.log('🔍 Buscando histórico para link code:', linkCode)

      const { data: roleplayLink, error: linkError } = await supabaseAdmin
        .from('roleplay_links')
        .select('id, company_id')
        .eq('link_code', linkCode)
        .single()

      if (linkError || !roleplayLink) {
        console.error('❌ Erro ao buscar roleplay_link:', linkError)
        return NextResponse.json(
          { error: 'Link de roleplay não encontrado' },
          { status: 404 }
        )
      }

      finalLinkId = roleplayLink.id
      console.log('✅ Roleplay link encontrado:', finalLinkId)
    } else {
      console.log('🔍 Buscando histórico para link ID:', linkId)
    }

    // Buscar todos os roleplays deste link
    const { data: roleplays, error: roleplaysError } = await supabaseAdmin
      .from('roleplays_unicos')
      .select('*')
      .eq('link_id', finalLinkId)
      .order('created_at', { ascending: false })

    if (roleplaysError) {
      console.error('❌ Erro ao buscar roleplays:', roleplaysError)
      return NextResponse.json(
        { error: 'Erro ao buscar histórico' },
        { status: 500 }
      )
    }

    console.log(`✅ ${roleplays?.length || 0} roleplays encontrados`)

    return NextResponse.json({
      roleplays: roleplays || [],
      total: roleplays?.length || 0
    })

  } catch (error) {
    console.error('❌ Erro no endpoint de histórico:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
