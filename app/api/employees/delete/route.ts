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

export async function DELETE(request: Request) {
  try {
    const { id, email } = await request.json()

    if (!id || !email) {
      return NextResponse.json({ error: 'ID e email são obrigatórios' }, { status: 400 })
    }

    // Primeiro buscar o usuário de auth pelo email
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      console.error('Erro ao listar usuários:', listError)
      return NextResponse.json({ error: listError.message }, { status: 400 })
    }

    const authUser = authUsers.users.find(u => u.email === email)

    // Deletar registro da tabela employees primeiro
    const { error: employeeError } = await supabaseAdmin
      .from('employees')
      .delete()
      .eq('id', id)

    if (employeeError) {
      console.error('Erro ao deletar funcionário:', employeeError)
      return NextResponse.json({ error: employeeError.message }, { status: 400 })
    }

    // Se encontrou o usuário de auth, deletar também
    if (authUser) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id)

      if (authError) {
        console.error('Erro ao deletar usuário de autenticação:', authError)
        // Não retorna erro aqui, pois o funcionário já foi deletado
        // Apenas loga o erro
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
