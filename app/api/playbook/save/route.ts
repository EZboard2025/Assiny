import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Usar service role para bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Carregar playbook da empresa
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { error: 'Empresa não identificada' },
        { status: 400 }
      )
    }

    // Buscar playbook ativo da empresa
    const { data: playbook, error } = await supabaseAdmin
      .from('sales_playbooks')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (não é erro, só não tem playbook)
      console.error('❌ Erro ao buscar playbook:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar playbook', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      playbook: playbook || null
    })

  } catch (error) {
    console.error('💥 Erro geral ao carregar playbook:', error)
    return NextResponse.json(
      {
        error: 'Erro ao carregar playbook',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

// POST - Salvar/atualizar playbook
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, content, companyId, userId } = body

    if (!companyId) {
      return NextResponse.json(
        { error: 'Empresa não identificada' },
        { status: 400 }
      )
    }

    if (!content) {
      return NextResponse.json(
        { error: 'Conteúdo do playbook não informado' },
        { status: 400 }
      )
    }

    console.log(`📝 Salvando playbook para empresa ${companyId}`)

    // Verificar se já existe um playbook ativo
    const { data: existing } = await supabaseAdmin
      .from('sales_playbooks')
      .select('id, version')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    let playbook

    if (existing) {
      // Atualizar playbook existente
      const { data, error } = await supabaseAdmin
        .from('sales_playbooks')
        .update({
          title: title || 'Playbook de Vendas',
          content,
          version: existing.version + 1,
          updated_at: new Date().toISOString(),
          updated_by: userId || null
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('❌ Erro ao atualizar playbook:', error)
        return NextResponse.json(
          { error: 'Erro ao atualizar playbook', details: error.message },
          { status: 500 }
        )
      }

      playbook = data
      console.log('✅ Playbook atualizado:', playbook.id)
    } else {
      // Criar novo playbook
      const { data, error } = await supabaseAdmin
        .from('sales_playbooks')
        .insert({
          company_id: companyId,
          title: title || 'Playbook de Vendas',
          content,
          version: 1,
          is_active: true,
          created_by: userId || null,
          updated_by: userId || null
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Erro ao criar playbook:', error)
        return NextResponse.json(
          { error: 'Erro ao criar playbook', details: error.message },
          { status: 500 }
        )
      }

      playbook = data
      console.log('✅ Playbook criado:', playbook.id)
    }

    return NextResponse.json({
      success: true,
      playbook
    })

  } catch (error) {
    console.error('💥 Erro geral ao salvar playbook:', error)
    return NextResponse.json(
      {
        error: 'Erro ao salvar playbook',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

// DELETE - Excluir playbook
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { error: 'Empresa não identificada' },
        { status: 400 }
      )
    }

    console.log(`🗑️ Excluindo playbook da empresa ${companyId}`)

    // Deletar playbook(s) da empresa
    const { error } = await supabaseAdmin
      .from('sales_playbooks')
      .delete()
      .eq('company_id', companyId)

    if (error) {
      console.error('❌ Erro ao excluir playbook:', error)
      return NextResponse.json(
        { error: 'Erro ao excluir playbook', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ Playbook excluído com sucesso')

    return NextResponse.json({
      success: true,
      message: 'Playbook excluído com sucesso'
    })

  } catch (error) {
    console.error('💥 Erro geral ao excluir playbook:', error)
    return NextResponse.json(
      {
        error: 'Erro ao excluir playbook',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
