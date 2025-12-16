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
    const body = await request.json()
    const { companyId, userId } = body

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID é obrigatório' }, { status: 400 })
    }

    console.log('🔍 Buscando roleplay link para company_id:', companyId)

    // Verificar se já existe um link para essa empresa
    const { data: existingLink, error: searchError } = await supabaseAdmin
      .from('roleplay_links')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = não encontrado
      console.error('Erro ao buscar link:', searchError)
      return NextResponse.json({ error: 'Erro ao buscar link' }, { status: 500 })
    }

    if (existingLink) {
      console.log('✅ Link existente encontrado:', existingLink.link_code)
      return NextResponse.json({
        success: true,
        data: existingLink
      })
    }

    // Se não existe, criar um novo
    console.log('📝 Criando novo link de roleplay...')

    // Gerar código único
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let code = ''
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return code
    }

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
        error: 'Não foi possível gerar um código único'
      }, { status: 500 })
    }

    // Configuração padrão inicial
    const defaultConfig = {
      age: '25-34',
      temperament: 'Analítico',
      persona_id: null,
      objection_ids: []
    }

    // Criar o novo link
    const { data: newLink, error: createError } = await supabaseAdmin
      .from('roleplay_links')
      .insert({
        company_id: companyId,
        link_code: linkCode,
        name: 'Roleplay Público',
        description: 'Link de roleplay público da empresa',
        config: defaultConfig,
        created_by: userId || null,
        is_active: true, // Inicia ATIVO por padrão
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

    console.log('✅ Novo link criado:', newLink.link_code)

    return NextResponse.json({
      success: true,
      data: newLink
    })

  } catch (error: any) {
    console.error('Erro na API get-or-create roleplay link:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno do servidor'
    }, { status: 500 })
  }
}