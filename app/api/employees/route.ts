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

function generatePassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export async function POST(request: Request) {
  try {
    const { name, email, role } = await request.json()

    // Gerar senha aleatória
    const password = generatePassword()

    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    })

    if (authError) {
      console.error('Erro ao criar usuário de autenticação:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Criar registro na tabela employees
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .insert([{ name, email, role }])
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

    return NextResponse.json({ employee, password })
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
