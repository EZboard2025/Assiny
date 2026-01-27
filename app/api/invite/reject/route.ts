import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { registrationId, companyId } = await req.json()

    if (!registrationId || !companyId) {
      return NextResponse.json(
        { error: 'Registration ID e Company ID são obrigatórios' },
        { status: 400 }
      )
    }

    // Extract auth token from header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autenticação não fornecido' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify authentication using the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verify user is admin of the company
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single()

    if (!employee || (employee.role?.toLowerCase() !== 'admin')) {
      return NextResponse.json(
        { error: 'Apenas administradores podem recusar cadastros' },
        { status: 403 }
      )
    }

    // Update registration status to rejected
    const { error } = await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        processed_by: user.id
      })
      .eq('id', registrationId)
      .eq('company_id', companyId)
      .eq('status', 'pending')

    if (error) {
      console.error('Erro ao recusar:', error)
      return NextResponse.json(
        { error: 'Erro ao recusar solicitação' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitação recusada'
    })

  } catch (error) {
    console.error('Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
