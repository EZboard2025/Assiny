import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
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

    // Delete all connections for this user (CASCADE deletes messages and conversations)
    const { error: deleteError } = await supabaseAdmin
      .from('whatsapp_connections')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      throw new Error(`Failed to delete connection: ${deleteError.message}`)
    }

    console.log(`WhatsApp disconnected for user ${user.id}`)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error disconnecting WhatsApp:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
