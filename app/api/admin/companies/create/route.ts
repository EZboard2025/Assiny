import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
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
    const {
      companyName,
      subdomain,
      adminName,
      adminEmail,
      adminPassword,
      businessType,
      employeeLimit
    } = body

    // Validações
    if (!companyName || !subdomain || !adminName || !adminEmail || !adminPassword || !businessType) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se subdomínio já existe
    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('subdomain', subdomain)
      .single()

    if (existingCompany) {
      return NextResponse.json(
        { error: 'Subdomínio já está em uso' },
        { status: 400 }
      )
    }

    console.log(`📦 Criando empresa: ${companyName} (${subdomain})`)

    // 1. Criar empresa
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        subdomain: subdomain,
        employee_limit: employeeLimit || null
      })
      .select()
      .single()

    if (companyError) {
      console.error('Erro ao criar empresa:', companyError)
      throw companyError
    }

    console.log(`✅ Empresa criada: ${company.id}`)

    // 2. Criar usuário admin no Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        name: adminName
      }
    })

    if (authError) {
      // Reverter criação da empresa
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      console.error('Erro ao criar usuário:', authError)
      throw authError
    }

    console.log(`✅ Usuário criado: ${authUser.user.id}`)

    // 3. Criar registro na tabela employees
    const { error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert({
        name: adminName,
        email: adminEmail,
        role: 'admin',
        user_id: authUser.user.id,
        company_id: company.id
      })

    if (employeeError) {
      // Reverter criações anteriores
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      console.error('Erro ao criar employee:', employeeError)
      throw employeeError
    }

    console.log(`✅ Employee criado`)

    // 4. Criar company_type
    const { error: typeError } = await supabaseAdmin
      .from('company_type')
      .insert({
        company_id: company.id,
        name: businessType
      })

    if (typeError) {
      console.error('Erro ao criar company_type:', typeError)
      // Não reverter, continuar sem company_type
    } else {
      console.log(`✅ Company type criado: ${businessType}`)
    }

    // IMPORTANTE: NÃO criar personas, objeções ou company_data automaticamente
    // Cada empresa deve configurar seus próprios dados manualmente no ConfigHub
    console.log(`ℹ️ Empresa criada sem dados pré-configurados.`)
    console.log(`ℹ️ O administrador deve configurar personas, objeções e dados da empresa no ConfigHub.`)

    // Retornar sucesso
    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
        subdomain: company.subdomain
      },
      admin: {
        id: authUser.user.id,
        email: adminEmail,
        name: adminName
      },
      message: `Empresa "${companyName}" criada com sucesso! Configure os dados no ConfigHub.`,
      urls: {
        local: `http://${subdomain}.ramppy.local:3000`,
        production: `https://${subdomain}.ramppy.site`
      }
    })

  } catch (error: any) {
    console.error('Erro ao criar empresa:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar empresa' },
      { status: 500 }
    )
  }
}