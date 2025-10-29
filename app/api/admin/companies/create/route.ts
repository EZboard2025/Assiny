import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Templates de dados iniciais por tipo de negócio
const INITIAL_DATA_TEMPLATES = {
  B2B: {
    personas: [
      {
        business_type: 'B2B',
        job_title: 'Diretor Comercial',
        company_type: 'Empresa de médio porte (50-200 funcionários)',
        context: 'Responsável por expandir vendas e melhorar processos comerciais',
        company_goals: 'Aumentar faturamento em 30% e reduzir ciclo de vendas',
        business_challenges: 'Equipe desmotivada, processos manuais, falta de previsibilidade',
        prior_knowledge: 'Já ouviu falar de soluções similares mas nunca testou'
      },
      {
        business_type: 'B2B',
        job_title: 'Gerente de TI',
        company_type: 'Startup em crescimento',
        context: 'Busca ferramentas para escalar operações com segurança',
        company_goals: 'Automatizar processos e garantir conformidade',
        business_challenges: 'Orçamento limitado, equipe pequena, muitas demandas',
        prior_knowledge: 'Conhece bem tecnologia mas precisa de ROI claro'
      }
    ],
    objections: [
      {
        name: 'É muito caro para nosso orçamento atual',
        rebuttals: [
          'Mostre o ROI em economia de tempo e recursos',
          'Ofereça um plano de entrada com upgrade futuro',
          'Compare com o custo de não resolver o problema'
        ]
      },
      {
        name: 'Já temos um fornecedor/solução',
        rebuttals: [
          'Foque nos diferenciais únicos da sua solução',
          'Sugira um teste paralelo sem compromisso',
          'Mostre cases de migração bem-sucedida'
        ]
      },
      {
        name: 'Preciso da aprovação da diretoria',
        rebuttals: [
          'Ofereça material para apresentação executiva',
          'Proponha uma reunião com a diretoria',
          'Forneça ROI e métricas que importam para C-level'
        ]
      },
      {
        name: 'Não é o momento certo',
        rebuttals: [
          'Explore o custo da inação',
          'Mostre benefícios imediatos mesmo com implementação gradual',
          'Ofereça condições especiais por tempo limitado'
        ]
      }
    ]
  },
  B2C: {
    personas: [
      {
        business_type: 'B2C',
        profession: 'Profissional Liberal',
        context: 'Trabalha por conta própria e busca praticidade',
        what_seeks: 'Soluções que economizem tempo e sejam fáceis de usar',
        main_pains: 'Falta de tempo, muitas tarefas manuais, dificuldade com tecnologia',
        prior_knowledge: 'Usa ferramentas básicas mas quer algo mais completo'
      },
      {
        business_type: 'B2C',
        profession: 'Estudante Universitário',
        context: 'Orçamento limitado mas abraça tecnologia',
        what_seeks: 'Produtos com bom custo-benefício e que agreguem valor',
        main_pains: 'Preço alto, produtos complicados, falta de suporte',
        prior_knowledge: 'Pesquisa muito antes de comprar, lê reviews'
      }
    ],
    objections: [
      {
        name: 'Não confio em comprar online',
        rebuttals: [
          'Mostre selos de segurança e certificações',
          'Compartilhe depoimentos de clientes reais',
          'Ofereça garantia de devolução'
        ]
      },
      {
        name: 'É muito caro',
        rebuttals: [
          'Divida em parcelas sem juros',
          'Compare com alternativas mais caras',
          'Mostre o valor agregado além do preço'
        ]
      },
      {
        name: 'Preciso pensar melhor',
        rebuttals: [
          'Crie senso de urgência com oferta limitada',
          'Ofereça um trial ou amostra',
          'Agende um follow-up para tirar dúvidas'
        ]
      },
      {
        name: 'Não vejo valor nisso',
        rebuttals: [
          'Conecte com as dores específicas do cliente',
          'Mostre resultados de pessoas similares',
          'Faça uma demonstração prática'
        ]
      }
    ]
  }
}

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
      businessType
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
        subdomain: subdomain
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

    // 5. Inserir personas template
    const templates = INITIAL_DATA_TEMPLATES[businessType as keyof typeof INITIAL_DATA_TEMPLATES]

    if (templates) {
      // Inserir personas
      const personasToInsert = templates.personas.map(p => ({
        ...p,
        company_id: company.id
      }))

      const { error: personasError } = await supabaseAdmin
        .from('personas')
        .insert(personasToInsert)

      if (personasError) {
        console.error('Erro ao criar personas:', personasError)
      } else {
        console.log(`✅ ${personasToInsert.length} personas criadas`)
      }

      // Inserir objeções
      const objectionsToInsert = templates.objections.map(o => ({
        ...o,
        company_id: company.id
      }))

      const { error: objectionsError } = await supabaseAdmin
        .from('objections')
        .insert(objectionsToInsert)

      if (objectionsError) {
        console.error('Erro ao criar objeções:', objectionsError)
      } else {
        console.log(`✅ ${objectionsToInsert.length} objeções criadas`)
      }
    }

    // 6. Criar company_data inicial
    const { error: companyDataError } = await supabaseAdmin
      .from('company_data')
      .insert({
        company_id: company.id,
        nome: companyName,
        descricao: `${companyName} é uma empresa focada em excelência e inovação.`,
        produtos_servicos: 'Produtos e serviços diversos para atender às necessidades do mercado.',
        funcao_produtos: 'Resolver problemas e agregar valor aos clientes.',
        diferenciais: 'Qualidade, inovação e atendimento personalizado.',
        concorrentes: 'Diversos players do mercado.',
        dados_metricas: 'Métricas de sucesso e crescimento constante.',
        erros_comuns: 'Evitamos erros comuns através de processos bem definidos.',
        percepcao_desejada: 'Ser reconhecida como referência em qualidade e inovação.'
      })

    if (companyDataError) {
      console.error('Erro ao criar company_data:', companyDataError)
    } else {
      console.log(`✅ Company data criada`)
    }

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
      message: `Empresa "${companyName}" criada com sucesso!`,
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