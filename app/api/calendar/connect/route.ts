import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUrl } from '@/lib/google-calendar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Encode userId + companyId in state param for the callback
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      companyId: employee.company_id,
    })).toString('base64url')

    const authUrl = getAuthUrl(state)

    return NextResponse.json({ authUrl })
  } catch (error: any) {
    console.error('[Calendar Connect] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    )
  }
}
