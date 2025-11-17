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
    // Extrair subdomínio do header
    const host = request.headers.get('host') || ''
    const subdomain = host.split('.')[0].split(':')[0]

    if (!subdomain || subdomain === 'localhost' || subdomain === 'www') {
      return NextResponse.json(
        { error: 'Subdomínio não encontrado' },
        { status: 400 }
      )
    }

    // Buscar empresa pelo subdomínio
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name, subdomain')
      .eq('subdomain', subdomain)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    // Buscar ou criar configuração de roleplay da empresa
    const { data: config, error: configError } = await supabaseAdmin
      .rpc('get_or_create_roleplay_config', {
        p_company_id: company.id
      })

    if (configError || !config) {
      console.error('Erro ao buscar config:', configError)
      return NextResponse.json(
        { error: 'Erro ao buscar configuração' },
        { status: 500 }
      )
    }

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
        is_active: config.is_active,
        config: config.config,
        usage_count: config.usage_count
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