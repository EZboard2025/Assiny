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

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar funcionários da empresa
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
        evaluations: [],
        message: 'Nenhum funcionário encontrado nesta empresa'
      })
    }

    const userIdToEmployee = new Map(
      employees.map(emp => [emp.user_id, { name: emp.name, email: emp.email }])
    )
    const userIds = employees.map(emp => emp.user_id).filter(Boolean)

    // Buscar meet evaluations da empresa
    const { data: evaluations, error: evalError } = await supabaseAdmin
      .from('meet_evaluations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (evalError) {
      console.error('Erro ao buscar meet evaluations:', evalError)
      throw evalError
    }

    // Enriquecer com dados do funcionário
    const enrichedEvaluations = (evaluations || []).map(evalItem => {
      const employee = userIdToEmployee.get(evalItem.user_id)
      return {
        ...evalItem,
        employee_name: employee?.name || evalItem.seller_name || 'Desconhecido',
        employee_email: employee?.email || ''
      }
    })

    return NextResponse.json({
      evaluations: enrichedEvaluations,
      total: enrichedEvaluations.length
    })

  } catch (error: any) {
    console.error('Erro ao buscar meet evaluations:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar meet evaluations' },
      { status: 500 }
    )
  }
}
