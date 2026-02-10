import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// GET: Fetch all round evaluations for the company
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
    }

    // Get company_id from employee
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id, role')
      .eq('user_id', user.id)
      .single()

    if (!employee?.company_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    // Parse query params
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '7')
    const sellerFilter = searchParams.get('seller') || null

    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Fetch evaluations
    let query = supabaseAdmin
      .from('conversation_round_evaluations')
      .select('*')
      .eq('company_id', employee.company_id)
      .gte('created_at', sinceDate)
      .order('created_at', { ascending: false })
      .limit(200)

    if (sellerFilter) {
      query = query.eq('user_id', sellerFilter)
    }

    const { data: evaluations, error } = await query

    if (error) {
      console.error('[ManagerEvaluations] Query error:', error)
      return NextResponse.json({ error: 'Erro ao buscar avaliações' }, { status: 500 })
    }

    // Fetch seller names
    const userIds = [...new Set((evaluations || []).map(e => e.user_id))]

    let sellers: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: employees } = await supabaseAdmin
        .from('employees')
        .select('user_id, name')
        .eq('company_id', employee.company_id)

      if (employees) {
        sellers = Object.fromEntries(employees.map(e => [e.user_id, e.name]))
      }
    }

    // Enrich evaluations with seller names
    const enriched = (evaluations || []).map(ev => ({
      ...ev,
      seller_name: sellers[ev.user_id] || 'Vendedor'
    }))

    // Fetch all sellers for filter dropdown
    const { data: allSellers } = await supabaseAdmin
      .from('employees')
      .select('user_id, name')
      .eq('company_id', employee.company_id)

    return NextResponse.json({
      evaluations: enriched,
      sellers: (allSellers || []).map(s => ({ id: s.user_id, name: s.name }))
    })

  } catch (error: any) {
    console.error('[ManagerEvaluations] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar avaliações', details: error.message },
      { status: 500 }
    )
  }
}
