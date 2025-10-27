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
 * Obtém o company_id do usuário autenticado (server-side)
 */
async function getCompanyIdFromAuth(request: Request): Promise<string | null> {
  try {
    // Obtenha os cookies como string para usar com Supabase Auth
    const cookieStore = cookies()
    // Crie o cliente Supabase normalmente, sem a opção `cookies` (que não existe)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Em APIs route handlers Next.js, supabase-js já acessa cookies do ambiente do server corretamente via fetch
    // Se desejar passar o token de autenticação manualmente:
    // const access_token = cookieStore.get('sb-access-token')?.value;
    // Se necessário, você pode usar: supabase.auth.setSession({ access_token, refresh_token }) aqui


    // Obter usuário autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ Usuário não autenticado:', authError)
      return null
    }

    console.log('✅ Usuário autenticado:', user.id)

    // Buscar company_id do employee
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (error || !data?.company_id) {
      console.log('❌ company_id não encontrado para user:', user.id)
      return null
    }

    console.log('✅ company_id encontrado:', data.company_id)
    return data.company_id
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

    // Obter company_id do usuário autenticado
    const companyId = await getCompanyIdFromAuth(request)

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