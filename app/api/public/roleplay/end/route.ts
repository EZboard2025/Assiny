import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'ID da sessão é obrigatório' },
        { status: 400 }
      )
    }

    // Atualizar status da sessão para finalizada
    const { data: session, error: updateError } = await supabaseAdmin
      .from('roleplays_unicos')
      .update({
        status: 'finalizada',
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) {
      console.error('Erro ao finalizar sessão:', updateError)
      return NextResponse.json(
        { error: 'Erro ao finalizar sessão' },
        { status: 500 }
      )
    }

    // Incrementar contador de uso
    if (session?.company_id) {
      await supabaseAdmin
        .from('roleplay_links')
        .update({
          usage_count: supabaseAdmin.raw('usage_count + 1'),
          updated_at: new Date().toISOString()
        })
        .eq('company_id', session.company_id)
    }

    return NextResponse.json({
      success: true,
      session
    })
  } catch (error) {
    console.error('Erro ao finalizar sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}