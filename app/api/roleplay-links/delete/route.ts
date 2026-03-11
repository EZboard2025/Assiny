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

export async function DELETE(request: Request) {
  try {
    // Pegar o ID do link dos parâmetros da URL
    const url = new URL(request.url)
    const linkId = url.searchParams.get('id')

    if (!linkId) {
      return NextResponse.json({ error: 'ID do link é obrigatório' }, { status: 400 })
    }

    // Verificar se o link existe
    const { data: existingLink } = await supabaseAdmin
      .from('roleplay_links')
      .select('id, usage_count')
      .eq('id', linkId)
      .single()

    if (!existingLink) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    }

    // Avisar se o link já foi usado
    if (existingLink.usage_count > 0) {
      console.log(`⚠️ Deletando link que foi usado ${existingLink.usage_count} vezes`)
    }

    // Deletar o link
    const { error: deleteError } = await supabaseAdmin
      .from('roleplay_links')
      .delete()
      .eq('id', linkId)

    if (deleteError) {
      console.error('Erro ao deletar link:', deleteError)
      return NextResponse.json({
        error: 'Erro ao deletar link de roleplay'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Link deletado com sucesso'
    })

  } catch (error: any) {
    console.error('Erro na API delete roleplay link:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno do servidor'
    }, { status: 500 })
  }
}