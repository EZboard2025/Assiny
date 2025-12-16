import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Criar cliente Supabase com service role para byppass RLS
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

export async function GET(request: Request) {
  try {
    // Obter company_id do header
    const headers = new Headers(request.headers)
    const companyId = headers.get('x-company-id')

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar todos os vendedores da empresa
    const { data: employees, error: employeesError } = await supabaseAdmin
      .from('employees')
      .select('user_id, name, email')
      .eq('company_id', companyId)
      .order('name', { ascending: true })

    if (employeesError) {
      throw employeesError
    }

    if (!employees || employees.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Para cada vendedor, buscar dados de follow-up
    const sellersWithFollowup = await Promise.all(
      employees.map(async (employee) => {
        // Buscar análises de follow-up do vendedor
        const { data: analyses, error: analysesError } = await supabaseAdmin
          .from('followup_analyses')
          .select('*')
          .eq('user_id', employee.user_id)
          .order('created_at', { ascending: false })

        if (analysesError) {
          console.error('Erro ao buscar análises:', analysesError)
          return null
        }

        // Se não tiver análises, retornar dados básicos
        if (!analyses || analyses.length === 0) {
          return {
            user_id: employee.user_id,
            user_name: employee.name,
            user_email: employee.email,
            followup_data: {
              user_id: employee.user_id,
              user_name: employee.name,
              total_analyses: 0,
              average_score: 0,
              last_analysis_date: null,
              classification_distribution: {
                excelente: 0,
                bom: 0,
                medio: 0,
                ruim: 0,
                pessimo: 0
              },
              recent_analyses: []
            }
          }
        }

        // Calcular métricas
        const totalAnalyses = analyses.length
        const averageScore = analyses.reduce((sum, a) => sum + Number(a.nota_final), 0) / totalAnalyses
        const lastAnalysisDate = analyses[0].created_at

        // Calcular distribuição de classificações
        const classificationDistribution = {
          excelente: 0,
          bom: 0,
          medio: 0,
          ruim: 0,
          pessimo: 0
        }

        analyses.forEach((analysis) => {
          const classification = analysis.classificacao.toLowerCase()
          if (classification in classificationDistribution) {
            classificationDistribution[classification as keyof typeof classificationDistribution]++
          }
        })

        // Pegar as 5 análises mais recentes com transcrições
        const recentAnalyses = analyses.slice(0, 5).map(a => ({
          id: a.id,
          created_at: a.created_at,
          nota_final: Number(a.nota_final),
          classificacao: a.classificacao,
          tipo_venda: a.tipo_venda,
          fase_funil: a.fase_funil,
          transcricao_filtrada: a.transcricao_filtrada,
          contexto: a.contexto,
          avaliacao: a.avaliacao
        }))

        return {
          user_id: employee.user_id,
          user_name: employee.name,
          user_email: employee.email,
          followup_data: {
            user_id: employee.user_id,
            user_name: employee.name,
            total_analyses: totalAnalyses,
            average_score: averageScore,
            last_analysis_date: lastAnalysisDate,
            classification_distribution: classificationDistribution,
            recent_analyses: recentAnalyses
          }
        }
      })
    )

    // Filtrar nulls e ordenar por média de score
    const validSellers = sellersWithFollowup
      .filter(s => s !== null)
      .sort((a, b) => {
        const scoreA = a?.followup_data?.average_score || 0
        const scoreB = b?.followup_data?.average_score || 0
        return scoreB - scoreA
      })

    return NextResponse.json({ data: validSellers })
  } catch (error: any) {
    console.error('Erro ao buscar dados de follow-up:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar dados de follow-up' },
      { status: 500 }
    )
  }
}