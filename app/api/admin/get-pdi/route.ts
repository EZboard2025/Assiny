import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Criar cliente Supabase com service role (bypassa RLS)
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
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      )
    }

    // Extrair token de autenticação do header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autenticação não fornecido' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verificar autenticação usando o token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Verificar se o usuário atual é Admin ou Gestor
    const { data: currentEmployee } = await supabaseAdmin
      .from('employees')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single()

    const currentRole = currentEmployee?.role?.toLowerCase()
    if (!currentEmployee || (currentRole !== 'admin' && currentRole !== 'gestor')) {
      return NextResponse.json(
        { error: 'Apenas Admin ou Gestor podem visualizar PDIs de outros usuários' },
        { status: 403 }
      )
    }

    // Buscar o PDI do usuário alvo (usando service role para bypassar RLS)
    const { data, error } = await supabaseAdmin
      .from('pdis')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ativo')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Erro ao buscar PDI:', error)
      return NextResponse.json(
        { error: 'PDI não encontrado', details: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, pdi: data })
  } catch (error) {
    console.error('Erro ao processar requisição:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
