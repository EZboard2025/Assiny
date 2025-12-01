import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  try {
    // Usar service role key para ignorar RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar dados de performance de todos os usuários (sem user_name e user_email que não existem)
    const { data: performanceData, error: perfError } = await supabaseAdmin
      .from('user_performance_summaries')
      .select(`
        user_id,
        total_sessions,
        overall_average,
        spin_s_average,
        spin_p_average,
        spin_i_average,
        spin_n_average,
        top_strengths,
        critical_gaps,
        trend
      `)
      .order('overall_average', { ascending: false })

    if (perfError) {
      console.error('Erro ao buscar performance:', perfError)
      return NextResponse.json({ error: perfError.message }, { status: 500 })
    }

    // Buscar informações dos usuários para todos os registros
    if (performanceData && performanceData.length > 0) {
      const userIds = performanceData.map(p => p.user_id)

      const { data: usersData } = await supabaseAdmin
        .from('employees')
        .select('user_id, name, email')
        .in('user_id', userIds)

      // Combinar dados - adicionar user_name e user_email
      const enrichedData = performanceData.map(perf => {
        const user = usersData?.find(u => u.user_id === perf.user_id)
        return {
          ...perf,
          user_name: user?.name || 'Usuário Desconhecido',
          user_email: user?.email || 'N/A'
        }
      })

      return NextResponse.json({ data: enrichedData })
    }

    return NextResponse.json({ data: [] })
  } catch (error) {
    console.error('Erro na API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}