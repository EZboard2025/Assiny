import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { updateHeartbeat } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alive = updateHeartbeat(user.id)

    if (!alive) {
      return NextResponse.json({ status: 'no_client' }, { status: 404 })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error: any) {
    console.error('Error processing heartbeat:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process heartbeat' },
      { status: 500 }
    )
  }
}
