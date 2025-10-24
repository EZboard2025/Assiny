import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 1. Verificar se usuário está autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({
        error: 'Usuário não autenticado',
        userError
      })
    }

    // 2. Buscar employee do usuário
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 3. Buscar todas as companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')

    // 4. Testar se consegue buscar personas
    const { data: personas, error: personasError } = await supabase
      .from('personas')
      .select('*')

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      employee,
      employeeError,
      companies,
      companiesError,
      personas,
      personasError
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
