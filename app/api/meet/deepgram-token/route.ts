import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    // Validate auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const deepgramKey = process.env.DEEPGRAM_API_KEY
    if (!deepgramKey) {
      return NextResponse.json({ error: 'Deepgram not configured' }, { status: 500 })
    }

    return NextResponse.json({ key: deepgramKey })

  } catch (error: any) {
    console.error('❌ Erro ao buscar Deepgram token:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
