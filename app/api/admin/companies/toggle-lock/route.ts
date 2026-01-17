import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Inicializar Supabase com service role key (bypass RLS)
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

export async function POST(request: NextRequest) {
  try {
    const { companyId } = await request.json()

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    // Buscar status atual da empresa
    const { data: company, error: fetchError } = await supabaseAdmin
      .from('companies')
      .select('locked')
      .eq('id', companyId)
      .single()

    if (fetchError || !company) {
      console.error('Error fetching company:', fetchError)
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Alternar o status de bloqueio
    const newLockedStatus = !company.locked

    const { error: updateError } = await supabaseAdmin
      .from('companies')
      .update({ locked: newLockedStatus })
      .eq('id', companyId)

    if (updateError) {
      console.error('Error toggling lock status:', updateError)
      return NextResponse.json(
        { error: 'Failed to toggle lock status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      locked: newLockedStatus,
      message: newLockedStatus
        ? 'Empresa bloqueada com sucesso'
        : 'Empresa desbloqueada com sucesso'
    })

  } catch (error) {
    console.error('Error in toggle-lock route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
