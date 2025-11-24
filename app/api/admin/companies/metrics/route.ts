import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Buscar todas as empresas
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('companies')
      .select('id, name, subdomain')
      .order('name')

    if (companiesError) throw companiesError

    // Para cada empresa, buscar métricas
    const metricsPromises = companies.map(async (company) => {
      // Buscar roleplays de treinamento com usuários
      const { data: trainingData, count: trainingRoleplays } = await supabaseAdmin
        .from('roleplay_sessions')
        .select('user_id, created_at', { count: 'exact' })
        .eq('company_id', company.id)

      // Buscar roleplays públicos
      const { count: publicRoleplays } = await supabaseAdmin
        .from('public_roleplay_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)

      // Buscar informações dos usuários que fizeram roleplay
      const userIds = Array.from(new Set(trainingData?.map(r => r.user_id).filter(Boolean) || []))

      let usersWithRoleplays: { id: string; name: string; email: string; roleplayCount: number }[] = []

      if (userIds.length > 0) {
        const { data: employees } = await supabaseAdmin
          .from('employees')
          .select('user_id, name, email')
          .in('user_id', userIds)

        // Contar roleplays por usuário
        const userRoleplayCounts = (trainingData || []).reduce((acc: Record<string, number>, r) => {
          if (r.user_id) {
            acc[r.user_id] = (acc[r.user_id] || 0) + 1
          }
          return acc
        }, {})

        usersWithRoleplays = (employees || []).map(emp => ({
          id: emp.user_id,
          name: emp.name,
          email: emp.email,
          roleplayCount: userRoleplayCounts[emp.user_id] || 0
        })).sort((a, b) => b.roleplayCount - a.roleplayCount)
      }

      // Verificar se tem personas cadastradas
      const { count: personasCount } = await supabaseAdmin
        .from('personas')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)

      // Verificar se tem objeções cadastradas
      const { count: objectionsCount } = await supabaseAdmin
        .from('objections')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)

      // Verificar se tem dados da empresa cadastrados
      const { data: companyData } = await supabaseAdmin
        .from('company_data')
        .select('id, nome, descricao, produtos_servicos')
        .eq('company_id', company.id)
        .single()

      // Verificar tipo de negócio configurado
      const { data: companyType } = await supabaseAdmin
        .from('company_type')
        .select('business_type')
        .eq('company_id', company.id)
        .single()

      // Calcular status das configurações
      const configStatus = {
        hasPersonas: (personasCount || 0) > 0,
        hasObjections: (objectionsCount || 0) > 0,
        hasCompanyData: !!(companyData?.nome && companyData?.descricao && companyData?.produtos_servicos),
        hasBusinessType: !!companyType?.business_type,
        personasCount: personasCount || 0,
        objectionsCount: objectionsCount || 0
      }

      // Status geral: configurado se tiver pelo menos personas, objeções e dados da empresa
      const isFullyConfigured = configStatus.hasPersonas &&
                                configStatus.hasObjections &&
                                configStatus.hasCompanyData

      return {
        companyId: company.id,
        companyName: company.name,
        subdomain: company.subdomain,
        roleplays: {
          training: trainingRoleplays || 0,
          public: publicRoleplays || 0,
          total: (trainingRoleplays || 0) + (publicRoleplays || 0)
        },
        configStatus,
        isFullyConfigured,
        usersWithRoleplays
      }
    })

    const metrics = await Promise.all(metricsPromises)

    // Calcular totais gerais
    const totals = {
      trainingRoleplays: metrics.reduce((sum, m) => sum + m.roleplays.training, 0),
      publicRoleplays: metrics.reduce((sum, m) => sum + m.roleplays.public, 0),
      totalRoleplays: metrics.reduce((sum, m) => sum + m.roleplays.total, 0),
      fullyConfiguredCompanies: metrics.filter(m => m.isFullyConfigured).length,
      totalCompanies: metrics.length
    }

    return NextResponse.json({ metrics, totals })

  } catch (error: any) {
    console.error('Erro ao buscar métricas:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar métricas' },
      { status: 500 }
    )
  }
}
