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

export async function PUT(request: Request) {
  try {
    const { employeeId, role } = await request.json()

    // Validar role
    const validRoles = ['Admin', 'Gestor', 'Vendedor']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Role inválido. Use: Admin, Gestor ou Vendedor' },
        { status: 400 }
      )
    }

    // Verificar autenticação
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Verificar se o usuário atual é Admin ou Gestor
    const { data: currentEmployee } = await supabaseAdmin
      .from('employees')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single()

    if (!currentEmployee || (currentEmployee.role !== 'Admin' && currentEmployee.role !== 'Gestor')) {
      return NextResponse.json(
        { error: 'Apenas Admin ou Gestor podem alterar roles' },
        { status: 403 }
      )
    }

    // Buscar o funcionário para garantir que é da mesma empresa
    const { data: targetEmployee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('id', employeeId)
      .single()

    if (!targetEmployee || targetEmployee.company_id !== currentEmployee.company_id) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado ou de outra empresa' },
        { status: 404 }
      )
    }

    // Atualizar o role
    const { data, error: updateError } = await supabaseAdmin
      .from('employees')
      .update({ role })
      .eq('id', employeeId)
      .select()
      .single()

    if (updateError) {
      console.error('Erro ao atualizar role:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar role' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, employee: data })
  } catch (error) {
    console.error('Erro ao processar requisição:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}