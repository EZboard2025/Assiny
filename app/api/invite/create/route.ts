import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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

export async function POST(req: Request) {
  try {
    const { companyId } = await req.json()

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID é obrigatório' },
        { status: 400 }
      )
    }

    // Extrair token de autenticação do header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autenticação não fornecido' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verificar autenticação usando o token
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
    console.log('[invite/create] Checking employee for user_id:', user.id, 'email:', user.email, 'company_id:', companyId)

    // Try to find employee by user_id first
    let { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('role')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single()

    // If not found by user_id, try by email as fallback
    if (!employee && user.email) {
      console.log('[invite/create] Not found by user_id, trying email:', user.email)
      const { data: empByEmail } = await supabaseAdmin
        .from('employees')
        .select('role')
        .eq('email', user.email.toLowerCase())
        .eq('company_id', companyId)
        .single()
      employee = empByEmail
    }

    console.log('[invite/create] Employee result:', employee, 'Error:', empError)

    if (!employee || (employee.role?.toLowerCase() !== 'admin')) {
      console.log('[invite/create] Access denied - employee:', employee, 'role:', employee?.role)
      return NextResponse.json(
        { error: 'Apenas administradores podem gerar links de convite' },
        { status: 403 }
      )
    }

    // Check if company already has an active invite link
    const { data: existingLink } = await supabaseAdmin
      .from('invite_links')
      .select('id, token')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    if (existingLink) {
      return NextResponse.json({
        success: true,
        token: existingLink.token,
        isExisting: true
      })
    }

    // Generate unique token
    const inviteToken = crypto.randomBytes(32).toString('hex')

    // Create new invite link
    const { data: newLink, error } = await supabaseAdmin
      .from('invite_links')
      .insert({
        company_id: companyId,
        token: inviteToken,
        created_by: user.id
      })
      .select('id, token')
      .single()

    if (error) {
      console.error('Erro ao criar link de convite:', error)
      return NextResponse.json(
        { error: 'Erro ao criar link de convite' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      token: newLink.token,
      isExisting: false
    })

  } catch (error) {
    console.error('Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
