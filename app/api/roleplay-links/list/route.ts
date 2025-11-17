import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Criar cliente Supabase com service role
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
    // Verificar autenticação via cookies
    const cookieStore = cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          }
        }
      }
    )

    // Verificar se o usuário está autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se o usuário é admin
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single()

    if (!employee || employee.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 })
    }

    // Buscar links da empresa
    const { data: links, error: linksError } = await supabaseAdmin
      .from('roleplay_links')
      .select('*')
      .eq('company_id', employee.company_id)
      .order('created_at', { ascending: false })

    if (linksError) {
      console.error('Erro ao buscar links:', linksError)
      return NextResponse.json({
        error: 'Erro ao buscar links de roleplay'
      }, { status: 500 })
    }

    // Buscar estatísticas de cada link
    const linksWithStats = await Promise.all((links || []).map(async (link) => {
      // Contar roleplays deste link
      const { data: stats } = await supabaseAdmin
        .from('roleplays_unicos')
        .select('status, overall_score')
        .eq('link_id', link.id)

      const totalSessions = stats?.length || 0
      const completedSessions = stats?.filter(s => s.status === 'completed').length || 0
      const abandonedSessions = stats?.filter(s => s.status === 'abandoned').length || 0
      const scores = stats?.filter(s => s.overall_score !== null).map(s => s.overall_score) || []
      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null

      // Construir URL completa
      const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://ramppy.site'
        : 'http://localhost:3000'

      const fullUrl = `${baseUrl}/roleplay/${link.link_code}`

      return {
        ...link,
        full_url: fullUrl,
        stats: {
          total_sessions: totalSessions,
          completed_sessions: completedSessions,
          abandoned_sessions: abandonedSessions,
          avg_score: avgScore
        }
      }
    }))

    return NextResponse.json({
      success: true,
      data: linksWithStats
    })

  } catch (error: any) {
    console.error('Erro na API list roleplay links:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno do servidor'
    }, { status: 500 })
  }
}