import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Criar cliente Supabase com service role
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

export async function POST(request: Request) {
  try {
    // Verificar autenticação via cookies
    const cookieStore = cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          }
        }
      }
    )

    // Verificar se o usuário está autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se o usuário é admin
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single()

    if (!employee || employee.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 })
    }

    // Pegar dados do corpo da requisição
    const body = await request.json()
    const { name, description, config } = body

    // Validações
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    if (!config || !config.age || !config.temperament || !config.persona_id || !config.objection_ids) {
      return NextResponse.json({
        error: 'Configuração incompleta. Todos os campos são obrigatórios.'
      }, { status: 400 })
    }

    // Gerar código único (8 caracteres alfanuméricos)
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = ''
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return code
    }

    // Tentar até 10 vezes para garantir código único
    let linkCode = ''
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      linkCode = generateCode()

      // Verificar se já existe
      const { data: existing } = await supabaseAdmin
        .from('roleplay_links')
        .select('id')
        .eq('link_code', linkCode)
        .single()

      if (!existing) break
      attempts++
    }

    if (attempts === maxAttempts) {
      return NextResponse.json({
        error: 'Não foi possível gerar um código único. Tente novamente.'
      }, { status: 500 })
    }

    // Criar o link
    const { data: newLink, error: createError } = await supabaseAdmin
      .from('roleplay_links')
      .insert({
        company_id: employee.company_id,
        link_code: linkCode,
        name,
        description: description || null,
        config,
        created_by: user.id,
        is_active: true,
        usage_count: 0
      })
      .select()
      .single()

    if (createError) {
      console.error('Erro ao criar link:', createError)
      return NextResponse.json({
        error: 'Erro ao criar link de roleplay'
      }, { status: 500 })
    }

    // Construir URL completa
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://ramppy.site'
      : 'http://localhost:3000'

    const fullUrl = `${baseUrl}/roleplay/${linkCode}`

    return NextResponse.json({
      success: true,
      data: {
        ...newLink,
        full_url: fullUrl
      }
    })

  } catch (error: any) {
    console.error('Erro na API create roleplay link:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno do servidor'
    }, { status: 500 })
  }
}