import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { triggerAutopilotScan } from '@/lib/whatsapp-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// GET - Fetch autopilot config for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const authResult = await supabaseAdmin.auth.getUser(token)
    const user = authResult?.data?.user
    if (!user) {
      console.error('[Autopilot Config] Auth failed:', authResult?.error?.message)
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
    }

    console.log('[Autopilot Config] GET for user:', user.id)

    const { data: configs, error: queryError } = await supabaseAdmin
      .from('autopilot_config')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)

    if (queryError) {
      console.error('[Autopilot Config] Query error:', queryError)
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    console.log('[Autopilot Config] Found config:', configs?.length ? 'yes' : 'no')
    return NextResponse.json({ config: configs?.[0] || null })
  } catch (error: any) {
    console.error('[Autopilot Config] GET CATCH error:', error?.message, error?.stack?.slice(0, 200))
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}

// POST - Create or update autopilot config
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
    const { enabled, customInstructions, settings } = body

    // Upsert config (UNIQUE on user_id)
    const { data: config, error } = await supabaseAdmin
      .from('autopilot_config')
      .upsert({
        user_id: user.id,
        company_id: companyId,
        enabled: enabled ?? false,
        custom_instructions: customInstructions ?? '',
        settings: settings ?? {
          response_delay_min: 5,
          response_delay_max: 15,
          max_responses_per_contact_per_day: 5,
          working_hours_only: true,
          working_hours_start: '08:00',
          working_hours_end: '18:00',
          tone: 'consultivo'
        },
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('[Autopilot Config] upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // When autopilot is enabled, scan monitored contacts for pending messages
    // Uses the in-memory client scan (with dedup guards) instead of direct HTTP calls
    if (enabled) {
      triggerAutopilotScan(user.id)
    }

    return NextResponse.json({ success: true, config })
  } catch (error: any) {
    console.error('[Autopilot Config] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
