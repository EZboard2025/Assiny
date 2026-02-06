import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { disconnectClient } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Get token from header or body (body is used by sendBeacon on page unload)
    const authHeader = request.headers.get('authorization')
    let token = authHeader?.replace('Bearer ', '')

    // If no header, try to get from body (sendBeacon sends JSON body)
    if (!token) {
      try {
        const body = await request.json()
        token = body.token
      } catch {
        // Body might be empty or not JSON
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await disconnectClient(user.id)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error disconnecting WhatsApp:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
