import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente Supabase com service role (bypass RLS)
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

export async function GET(request: Request) {
  try {
    // Extrair linkCode da URL
    const { searchParams } = new URL(request.url)
    const linkCode = searchParams.get('link')

    if (!linkCode) {
      return NextResponse.json(
        { error: 'Código do link não fornecido' },
        { status: 400 }
      )
    }

    // Buscar link de roleplay pelo código
    const { data: roleplayLink, error: linkError } = await supabaseAdmin
      .from('roleplay_links')
      .select('*, companies!inner(id, name, subdomain)')
      .eq('link_code', linkCode)
      .single()

    if (linkError || !roleplayLink) {
      return NextResponse.json(
        { error: 'Link de roleplay não encontrado' },
        { status: 404 }
      )
    }

    const company = roleplayLink.companies

    // Buscar personas e objeções da empresa
    const [personasResult, objectionsResult] = await Promise.all([
      supabaseAdmin
        .from('personas')
        .select('*')
        .eq('company_id', company.id),
      supabaseAdmin
        .from('objections')
        .select('*')
        .eq('company_id', company.id)
    ])

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        subdomain: company.subdomain
      },
      roleplayLink: {
        id: roleplayLink.id,
        link_code: roleplayLink.link_code,
        name: roleplayLink.name,
        is_active: roleplayLink.is_active,
        config: roleplayLink.config,
        usage_count: roleplayLink.usage_count
      },
      personas: personasResult.data || [],
      objections: objectionsResult.data || []
    })
  } catch (error) {
    console.error('Erro ao buscar configuração:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}