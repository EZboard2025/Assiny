import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json({ error: 'User ID and role are required' }, { status: 400 })
    }

    // Validar role
    if (!['Admin', 'Vendedor'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Usar service role key para ignorar RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Atualizar role do usuário
    const { error } = await supabaseAdmin
      .from('employees')
      .update({ role })
      .eq('user_id', userId)

    if (error) {
      console.error('Erro ao atualizar role:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Role atualizado com sucesso' })
  } catch (error) {
    console.error('Erro na API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}