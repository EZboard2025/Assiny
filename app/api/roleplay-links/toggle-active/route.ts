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
    const body = await request.json()
    const { linkId, isActive } = body

    if (!linkId) {
      return NextResponse.json(
        { error: 'Link ID é obrigatório' },
        { status: 400 }
      )
    }

    console.log('🔄 Atualizando status do link via API:', {
      linkId,
      newStatus: isActive
    })

    // Atualizar o status do link usando service role (bypass RLS)
    const { data, error } = await supabaseAdmin
      .from('roleplay_links')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', linkId)
      .select()
      .single()

    if (error) {
      console.error('❌ Erro ao atualizar status do link:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar status do link', details: error },
        { status: 500 }
      )
    }

    console.log('✅ Status do link atualizado com sucesso:', data)

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error: any) {
    console.error('❌ Erro na API toggle-active:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}