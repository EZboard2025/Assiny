import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

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

/**
 * Obtém o company_id baseado no subdomínio (server-side)
 */
async function getCompanyIdFromSubdomain(request: Request): Promise<string | null> {
  try {
    // Pegar hostname do header
    const hostname = request.headers.get('host') || ''
    console.log('🔵 Hostname recebido:', hostname)

    let subdomain = ''

    // Detectar subdomínio
    if (hostname.includes('.ramppy.local')) {
      // Desenvolvimento: assiny.ramppy.local:3000 -> "assiny"
      subdomain = hostname.split('.')[0].split(':')[0]
    } else if (hostname.includes('.ramppy.site')) {
      // Produção: assiny.ramppy.site -> "assiny"
      subdomain = hostname.split('.')[0]
    } else {
      console.log('❌ Domínio principal ou não reconhecido')
      return null
    }

    console.log('🔵 Subdomínio detectado:', subdomain)

    // Buscar company_id pelo subdomínio
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('subdomain', subdomain)
      .single()

    if (error || !data?.id) {
      console.log('❌ Empresa não encontrada para subdomínio:', subdomain)
      return null
    }

    console.log('✅ company_id encontrado:', data.id, 'para subdomínio:', subdomain)
    return data.id
  } catch (error) {
    console.error('❌ Erro ao obter company_id:', error)
    return null
  }
}

export async function POST(request: Request) {
  console.log('🔵 POST /api/employees/create chamado!')

  try {
    const body = await request.json()
    console.log('📥 Recebido no backend:', body)

    const { name, email, password } = body

    if (!name || !email || !password) {
      console.log('❌ Campos obrigatórios faltando')
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 })
    }

    // Obter company_id do subdomínio
    const companyId = await getCompanyIdFromSubdomain(request)

    if (!companyId) {
      console.log('❌ company_id não encontrado na sessão')
      return NextResponse.json({
        error: 'Usuário não associado a nenhuma empresa'
      }, { status: 403 })
    }

    console.log('✅ Validação OK, company_id:', companyId)

    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'Vendedor'
      }
    })

    if (authError) {
      console.error('Erro ao criar usuário de autenticação:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Criar registro na tabela employees (vinculado ao company_id e user_id)
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .insert([{
        name,
        email,
        role: 'Vendedor',
        user_id: authData.user.id,
        company_id: companyId
      }])
      .select()
      .single()

    if (error) {
      console.error('Erro ao adicionar funcionário:', error)
      // Tentar reverter criação do usuário se falhou
      if (authData.user) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ employee })
  } catch (error: any) {
    console.error('Erro:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}