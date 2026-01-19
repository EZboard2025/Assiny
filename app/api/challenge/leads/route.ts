import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY não configurada')
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Buscar todos os leads do desafio ordenados por data
    const { data: leads, error } = await supabaseAdmin
      .from('challenge_leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar leads:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      leads: leads || []
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar leads'
    console.error('Erro ao buscar leads:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
