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

export async function PUT(request: Request) {
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
    const { linkId, name, description, config, is_active } = body

    if (!linkId) {
      return NextResponse.json({ error: 'ID do link é obrigatório' }, { status: 400 })
    }

    // Verificar se o link pertence à empresa do admin
    const { data: existingLink } = await supabaseAdmin
      .from('roleplay_links')
      .select('company_id')
      .eq('id', linkId)
      .single()

    if (!existingLink || existingLink.company_id !== employee.company_id) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    }

    // Montar objeto de atualização
    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (config !== undefined) updates.config = config
    if (is_active !== undefined) updates.is_active = is_active

    // Atualizar o link
    const { data: updatedLink, error: updateError } = await supabaseAdmin
      .from('roleplay_links')
      .update(updates)
      .eq('id', linkId)
      .select()
      .single()

    if (updateError) {
      console.error('Erro ao atualizar link:', updateError)
      return NextResponse.json({
        error: 'Erro ao atualizar link de roleplay'
      }, { status: 500 })
    }

    // Construir URL completa
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://ramppy.site'
      : 'http://localhost:3000'

    const fullUrl = `${baseUrl}/roleplay/${updatedLink.link_code}`

    return NextResponse.json({
      success: true,
      data: {
        ...updatedLink,
        full_url: fullUrl
      }
    })

  } catch (error: any) {
    console.error('Erro na API update roleplay link:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno do servidor'
    }, { status: 500 })
  }
}