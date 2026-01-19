import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY não configurada')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    // Cliente com service role para operações administrativas
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Pegar company_id da query string
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar funcionários da empresa para pegar os user_ids
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('user_id, name, email')
      .eq('company_id', companyId)

    if (employeesError) {
      console.error('Erro ao buscar funcionários:', employeesError)
      throw employeesError
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({
        roleplays: [],
        message: 'Nenhum funcionário encontrado nesta empresa'
      })
    }

    // Mapear user_ids para nomes
    const userIdToEmployee = new Map(
      employees.map(emp => [emp.user_id, { name: emp.name, email: emp.email }])
    )
    const userIds = employees.map(emp => emp.user_id).filter(Boolean)

    // Buscar roleplay sessions dos funcionários
    const { data: roleplays, error: roleplaysError } = await supabaseAdmin
      .from('roleplay_sessions')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })

    if (roleplaysError) {
      console.error('Erro ao buscar roleplays:', roleplaysError)
      throw roleplaysError
    }

    // Enriquecer com dados do funcionário
    const enrichedRoleplays = (roleplays || []).map(roleplay => {
      const employee = userIdToEmployee.get(roleplay.user_id)
      return {
        ...roleplay,
        employee_name: employee?.name || 'Desconhecido',
        employee_email: employee?.email || ''
      }
    })

    return NextResponse.json({
      roleplays: enrichedRoleplays,
      total: enrichedRoleplays.length
    })

  } catch (error: any) {
    console.error('Erro ao buscar roleplays:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar roleplays' },
      { status: 500 }
    )
  }
}
