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

    const { name, email, password, role, company_id } = body

    if (!name || !email || !password) {
      console.log('❌ Campos obrigatórios faltando')
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios' }, { status: 400 })
    }

    // Sistema unificado - usar company_id fornecido ou detectar do subdomínio
    let companyId = company_id

    if (!companyId) {
      // Fallback para detecção por subdomínio (compatibilidade)
      companyId = await getCompanyIdFromSubdomain(request)
    }

    if (!companyId) {
      console.log('❌ company_id não encontrado')
      return NextResponse.json({
        error: 'Empresa não identificada'
      }, { status: 403 })
    }

    console.log('✅ Validação OK, company_id:', companyId)

    // Verificar limite de funcionários da empresa
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('employee_limit')
      .eq('id', companyId)
      .single()

    if (companyError) {
      console.error('❌ Erro ao buscar dados da empresa:', companyError)
      return NextResponse.json({ error: 'Erro ao verificar dados da empresa' }, { status: 500 })
    }

    // Se employee_limit for null, não há limite
    if (company.employee_limit !== null) {
      // Contar funcionários atuais da empresa
      const { count, error: countError } = await supabaseAdmin
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)

      if (countError) {
        console.error('❌ Erro ao contar funcionários:', countError)
        return NextResponse.json({ error: 'Erro ao verificar limite de funcionários' }, { status: 500 })
      }

      console.log(`📊 Funcionários: ${count}/${company.employee_limit}`)

      if (count !== null && count >= company.employee_limit) {
        console.log('❌ Limite de funcionários atingido')
        return NextResponse.json({
          error: `Limite de funcionários atingido. Esta empresa pode ter no máximo ${company.employee_limit} funcionários.`,
          currentCount: count,
          limit: company.employee_limit
        }, { status: 403 })
      }
    }

    // Usar o role fornecido ou default para 'vendedor'
    const userRole = role || 'vendedor'

    // Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: userRole
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
        role: userRole,
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