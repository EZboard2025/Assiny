import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // Usar service role key para ignorar RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar usuários da empresa
    const { data: users, error } = await supabaseAdmin
      .from('employees')
      .select('user_id, name, email, role')
      .eq('company_id', companyId)
      .order('name')

    if (error) {
      console.error('Erro ao buscar usuários:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ users: users || [] })
  } catch (error) {
    console.error('Erro na API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}