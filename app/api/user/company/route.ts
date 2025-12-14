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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID é obrigatório' }, { status: 400 })
    }

    console.log('🔍 Buscando company_id para user_id:', userId)

    // Buscar o company_id do usuário
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Erro ao buscar employee:', error)
      return NextResponse.json({ error: 'Erro ao buscar dados do funcionário' }, { status: 500 })
    }

    if (!employee?.company_id) {
      return NextResponse.json({ error: 'Company ID não encontrado' }, { status: 404 })
    }

    console.log('✅ Company ID encontrado:', employee.company_id)

    return NextResponse.json({
      success: true,
      companyId: employee.company_id
    })

  } catch (error: any) {
    console.error('Erro na API user/company:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno do servidor'
    }, { status: 500 })
  }
}