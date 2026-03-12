import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    // Pegar dados do corpo da requisição
    const body = await request.json()
    const { name, description, config, companyId, userId } = body

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID é obrigatório' }, { status: 400 })
    }

    // Verificar permissão via employee (mesmo padrão do get-or-create)
    let createdBy = userId || null
    if (userId) {
      const { data: employee } = await supabaseAdmin
        .from('employees')
        .select('role, company_id')
        .eq('user_id', userId)
        .single()

      if (employee && employee.company_id !== companyId) {
        return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
      }
    }

    // Validações
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    // Default config if not provided or incomplete
    const finalConfig = {
      age: config?.age || '25-34',
      temperament: config?.temperament || 'Analítico',
      persona_id: config?.persona_id || null,
      objection_ids: config?.objection_ids || []
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
        company_id: companyId,
        link_code: linkCode,
        name,
        description: description || null,
        config: finalConfig,
        created_by: createdBy,
        is_active: true,
        usage_count: 0
      })
      .select()
      .single()

    if (createError) {
      console.error('Erro ao criar link:', createError)
      console.error('Insert data:', { company_id: companyId, link_code: linkCode, name, created_by: createdBy })
      return NextResponse.json({
        error: `Erro ao criar link: ${createError.message || createError.code || 'desconhecido'}`
      }, { status: 500 })
    }

    // Construir URL completa
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://ramppy.site'
      : 'http://localhost:3000'

    const fullUrl = `${baseUrl}/roleplay-publico?link=${linkCode}`

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