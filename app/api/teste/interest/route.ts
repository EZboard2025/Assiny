import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cliente Supabase com service role
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
        { error: 'sessionId é obrigatório' },
        { status: 400 }
      )
    }

    console.log('💚 Marcando interesse para sessão:', sessionId)

    // Atualizar a sessão com o interesse
    const { error: updateError } = await supabaseAdmin
      .from('test_roleplays')
      .update({
        interested: true,
        interested_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (updateError) {
      console.error('❌ Erro ao marcar interesse:', updateError)
      return NextResponse.json(
        { error: 'Erro ao registrar interesse' },
        { status: 500 }
      )
    }

    console.log('✅ Interesse registrado com sucesso!')

    return NextResponse.json({
      success: true,
      message: 'Interesse registrado com sucesso'
    })
  } catch (error) {
    console.error('❌ Erro ao processar interesse:', error)
    return NextResponse.json(
      { error: 'Erro ao processar interesse' },
      { status: 500 }
    )
  }
}
