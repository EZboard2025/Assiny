import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Decrypt function (same as in register)
const ENCRYPTION_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!.substring(0, 32)

function decrypt(text: string): string {
  const parts = text.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

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
        { error: 'Apenas administradores podem aprovar cadastros' },
        { status: 403 }
      )
    }

    // Get pending registration
    const { data: registration, error: regError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('id', registrationId)
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .single()

    if (regError || !registration) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada ou já processada' },
        { status: 404 }
      )
    }

    // Decrypt the stored password
    let originalPassword: string
    try {
      originalPassword = decrypt(registration.password_hash)
    } catch (e) {
      console.error('Erro ao descriptografar senha:', e)
      return NextResponse.json(
        { error: 'Erro ao processar cadastro' },
        { status: 500 }
      )
    }

    // Create user in Supabase Auth with the original password
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: registration.email,
      password: originalPassword,
      email_confirm: true,
      user_metadata: {
        name: registration.name
      }
    })

    if (authCreateError) {
      console.error('Erro ao criar usuário auth:', authCreateError)
      return NextResponse.json(
        { error: 'Erro ao criar conta de usuário' },
        { status: 500 }
      )
    }

    // Create employee record
    const { error: empError } = await supabaseAdmin
      .from('employees')
      .insert({
        user_id: authData.user.id,
        company_id: companyId,
        name: registration.name,
        email: registration.email,
        role: 'vendedor'
      })

    if (empError) {
      console.error('Erro ao criar employee:', empError)
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Erro ao criar registro de funcionário' },
        { status: 500 }
      )
    }

    // Update registration status
    await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: user.id
      })
      .eq('id', registrationId)

    return NextResponse.json({
      success: true,
      message: 'Cadastro aprovado com sucesso!',
      userId: authData.user.id
    })

  } catch (error) {
    console.error('Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
