import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PUT(request: NextRequest) {
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

    // Receber dados do corpo da requisição
    const body = await request.json()
    const { companyId, employeeLimit } = body

    // Validações
    if (!companyId) {
      return NextResponse.json(
        { error: 'ID da empresa é obrigatório' },
        { status: 400 }
      )
    }

    console.log(`📝 Atualizando limite da empresa ${companyId} para: ${employeeLimit || 'ilimitado'}`)

    // Verificar se a empresa existe
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      console.error('Empresa não encontrada:', companyError)
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    // Atualizar o limite de funcionários
    const { error: updateError } = await supabaseAdmin
      .from('companies')
      .update({
        employee_limit: employeeLimit || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)

    if (updateError) {
      console.error('Erro ao atualizar limite:', updateError)
      return NextResponse.json(
        { error: 'Erro ao atualizar limite de funcionários' },
        { status: 500 }
      )
    }

    console.log(`✅ Limite atualizado com sucesso para empresa: ${company.name}`)

    // Retornar sucesso
    return NextResponse.json({
      success: true,
      message: `Limite de funcionários atualizado para ${employeeLimit || 'ilimitado'}`,
      company: {
        id: companyId,
        name: company.name,
        employee_limit: employeeLimit || null
      }
    })

  } catch (error: any) {
    console.error('Erro ao atualizar limite:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar limite' },
      { status: 500 }
    )
  }
}