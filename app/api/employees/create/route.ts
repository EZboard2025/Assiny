import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Criar cliente Supabase com service role key para admin
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
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 })
    }

    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'Vendedor'
      }
    })

    if (authError) {
      console.error('Erro ao criar usuário de autenticação:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Criar registro na tabela employees
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .insert([{ name, email, role: 'Vendedor' }])
      .select()
      .single()

    if (error) {
      console.error('Erro ao adicionar funcionário:', error)
      // Tentar reverter criação do usuário se falhou
      if (authData.user) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ employee })
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}