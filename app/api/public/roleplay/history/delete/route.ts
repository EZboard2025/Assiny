import { NextRequest, NextResponse } from 'next/server'
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

export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs não fornecidos' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('roleplays_unicos')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Erro ao deletar simulações:', error)
      return NextResponse.json(
        { error: 'Erro ao deletar simulações' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (error) {
    console.error('Erro no endpoint de delete:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
