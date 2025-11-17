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

    // Pegar filtros dos parâmetros da URL
    const url = new URL(request.url)
    const linkId = url.searchParams.get('linkId')
    const status = url.searchParams.get('status')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Montar query
    let query = supabaseAdmin
      .from('roleplays_unicos')
      .select(`
        *,
        roleplay_links!inner (
          name,
          link_code
        )
      `)
      .eq('company_id', employee.company_id)

    // Aplicar filtros
    if (linkId) {
      query = query.eq('link_id', linkId)
    }

    if (status && ['in_progress', 'completed', 'abandoned'].includes(status)) {
      query = query.eq('status', status)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Ordenar por data de criação (mais recente primeiro)
    query = query.order('created_at', { ascending: false })

    const { data: roleplays, error: roleplaysError } = await query

    if (roleplaysError) {
      console.error('Erro ao buscar roleplays únicos:', roleplaysError)
      return NextResponse.json({
        error: 'Erro ao buscar histórico de roleplays'
      }, { status: 500 })
    }

    // Formatar dados para incluir informações úteis
    const formattedRoleplays = (roleplays || []).map(rp => {
      // Contar mensagens por role
      const messages = rp.messages || []
      const clientMessages = messages.filter((m: any) => m.role === 'client').length
      const sellerMessages = messages.filter((m: any) => m.role === 'seller').length

      return {
        id: rp.id,
        participant_name: rp.participant_name,
        participant_email: rp.participant_email,
        participant_phone: rp.participant_phone,
        link_name: rp.roleplay_links?.name,
        link_code: rp.roleplay_links?.link_code,
        status: rp.status,
        overall_score: rp.overall_score,
        performance_level: rp.performance_level,
        duration_seconds: rp.duration_seconds,
        message_count: {
          total: messages.length,
          client: clientMessages,
          seller: sellerMessages
        },
        created_at: rp.created_at,
        ended_at: rp.ended_at
      }
    })

    // Calcular estatísticas gerais
    const stats = {
      total: formattedRoleplays.length,
      completed: formattedRoleplays.filter(r => r.status === 'completed').length,
      in_progress: formattedRoleplays.filter(r => r.status === 'in_progress').length,
      abandoned: formattedRoleplays.filter(r => r.status === 'abandoned').length,
      avg_score: formattedRoleplays
        .filter(r => r.overall_score !== null)
        .reduce((sum, r) => sum + (r.overall_score || 0), 0) /
        (formattedRoleplays.filter(r => r.overall_score !== null).length || 1)
    }

    return NextResponse.json({
      success: true,
      data: formattedRoleplays,
      stats
    })

  } catch (error: any) {
    console.error('Erro na API list roleplays únicos:', error)
    return NextResponse.json({
      error: error.message || 'Erro interno do servidor'
    }, { status: 500 })
  }
}