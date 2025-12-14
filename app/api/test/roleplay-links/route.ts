import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('roleplay_links')
      .select('link_code, name, is_active, company_id')
      .eq('is_active', true)
      .limit(5)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      links: data || [],
      example_url: data?.[0] ? `http://localhost:3000/roleplay-publico?link=${data[0].link_code}` : null
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar links' }, { status: 500 })
  }
}