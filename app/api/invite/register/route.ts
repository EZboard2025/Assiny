import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simple encryption for temporary password storage
const ENCRYPTION_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!.substring(0, 32)

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

export async function POST(req: Request) {
  try {
    const { companyId, name, email, password } = await req.json()

    // Validate inputs
    if (!companyId || !name || !email || !password) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Verify company exists
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      )
    }

    // Check if email already exists in auth.users
    const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingAuth?.users?.some(u => u.email === email.toLowerCase())

    if (emailExists) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado no sistema' },
        { status: 400 }
      )
    }

    // Check if there's already a pending registration with this email for this company
    const { data: existingPending } = await supabaseAdmin
      .from('pending_registrations')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .single()

    if (existingPending) {
      return NextResponse.json(
        { error: 'Já existe uma solicitação pendente com este email' },
        { status: 400 }
      )
    }

    // Encrypt password for temporary storage
    const encryptedPassword = encrypt(password)

    // Create pending registration
    const { data: registration, error: regError } = await supabaseAdmin
      .from('pending_registrations')
      .insert({
        company_id: companyId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password_hash: encryptedPassword,
        status: 'pending'
      })
      .select('id')
      .single()

    if (regError) {
      console.error('Erro ao criar solicitação:', regError)
      return NextResponse.json(
        { error: 'Erro ao criar solicitação de cadastro' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitação enviada! Aguarde a aprovação do gestor.',
      registrationId: registration.id
    })

  } catch (error) {
    console.error('Erro:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
