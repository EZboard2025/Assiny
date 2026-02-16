import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - List all autopilot profiles for the authenticated user
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

    const { data: profiles, error } = await supabaseAdmin
      .from('autopilot_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (error) {
      // Table may not exist yet (PGRST205 = not in schema cache, 42P01 = doesn't exist)
      if (error.code === 'PGRST205' || error.code === '42P01') {
        console.warn('[Autopilot Profiles] Table not found - migration needed. Returning empty.')
        return NextResponse.json({ profiles: [] })
      }
      console.error('[Autopilot Profiles] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profiles: profiles || [] })
  } catch (error: any) {
    console.error('[Autopilot Profiles] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create, update, or delete a profile
export async function POST(req: NextRequest) {
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

    const { data: employeeData } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const companyId = employeeData?.company_id
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    const body = await req.json()
    const { action, profile } = body

    if (action === 'create') {
      if (!profile?.name) {
        return NextResponse.json({ error: 'Nome do perfil é obrigatório' }, { status: 400 })
      }

      // Get next sort_order
      const { data: existing } = await supabaseAdmin
        .from('autopilot_profiles')
        .select('sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: false })
        .limit(1)

      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

      const { data: created, error } = await supabaseAdmin
        .from('autopilot_profiles')
        .insert({
          user_id: user.id,
          company_id: companyId,
          name: profile.name,
          color: profile.color || '#00a884',
          custom_instructions: profile.custom_instructions || '',
          ai_setup_answers: profile.ai_setup_answers || null,
          sort_order: nextOrder
        })
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          return NextResponse.json({
            error: 'Tabela autopilot_profiles não existe. Execute a migration SQL: sql/criar-tabela-autopilot-profiles.sql'
          }, { status: 503 })
        }
        console.error('[Autopilot Profiles] Create error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, profile: created })
    }

    if (action === 'update') {
      if (!profile?.id) {
        return NextResponse.json({ error: 'ID do perfil é obrigatório' }, { status: 400 })
      }

      const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
      if (profile.name !== undefined) updateData.name = profile.name
      if (profile.color !== undefined) updateData.color = profile.color
      if (profile.custom_instructions !== undefined) updateData.custom_instructions = profile.custom_instructions
      if (profile.ai_setup_answers !== undefined) updateData.ai_setup_answers = profile.ai_setup_answers

      const { data: updated, error } = await supabaseAdmin
        .from('autopilot_profiles')
        .update(updateData)
        .eq('id', profile.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('[Autopilot Profiles] Update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, profile: updated })
    }

    if (action === 'delete') {
      if (!profile?.id) {
        return NextResponse.json({ error: 'ID do perfil é obrigatório' }, { status: 400 })
      }

      const { error } = await supabaseAdmin
        .from('autopilot_profiles')
        .delete()
        .eq('id', profile.id)
        .eq('user_id', user.id)

      if (error) {
        console.error('[Autopilot Profiles] Delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Contacts with this profile_id will have it set to NULL (ON DELETE SET NULL)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error: any) {
    console.error('[Autopilot Profiles] POST error:', error)
    // Table may not exist yet
    if (error?.code === 'PGRST205' || error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return NextResponse.json({
        error: 'Tabela autopilot_profiles não existe. Execute a migration SQL no Supabase Dashboard.'
      }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
