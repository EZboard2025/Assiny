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

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { linkId, config } = body

    console.log('🔵 API update-config recebida')
    console.log('  - linkId:', linkId)
    console.log('  - config:', config)

    if (!linkId || !config) {
      return NextResponse.json(
        { error: 'linkId e config são obrigatórios' },
        { status: 400 }
      )
    }

    // Atualizar configuração usando service role (bypass RLS)
    const { data, error } = await supabaseAdmin
      .from('roleplay_links')
      .update({
        config,
        updated_at: new Date().toISOString()
      })
      .eq('id', linkId)
      .select()

    console.log('🔵 Resultado do UPDATE:')
    console.log('  - data:', data)
    console.log('  - error:', error)

    if (error) {
      console.error('❌ Erro ao atualizar:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Link não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data[0]
    })

  } catch (error: any) {
    console.error('❌ Erro na API update-config:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
