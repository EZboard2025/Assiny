import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { waMessageId, deleteForEveryone } = await request.json()

    if (!waMessageId) {
      return NextResponse.json({ error: 'waMessageId is required' }, { status: 400 })
    }

    // Authenticate user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = getConnectedClient(user.id)
    if (!client) {
      return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 404 })
    }

    // Get the message from whatsapp-web.js
    const msg = await Promise.race([
      client.getMessageById(waMessageId),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout ao buscar mensagem')), 10000))
    ])

    if (!msg) {
      return NextResponse.json({ error: 'Mensagem não encontrada no WhatsApp' }, { status: 404 })
    }

    // Delete the message
    // true = delete for everyone (revoke), false = delete for me only
    await Promise.race([
      msg.delete(deleteForEveryone === true),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout ao apagar mensagem')), 10000))
    ])

    if (deleteForEveryone) {
      // Mark as revoked in database (keeps placeholder)
      await supabaseAdmin
        .from('whatsapp_messages')
        .update({ message_type: 'revoked', content: '', media_id: null })
        .eq('wa_message_id', waMessageId)
        .eq('user_id', user.id)
    } else {
      // Delete for me: remove from database
      await supabaseAdmin
        .from('whatsapp_messages')
        .delete()
        .eq('wa_message_id', waMessageId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error deleting message:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao apagar mensagem' },
      { status: 500 }
    )
  }
}
