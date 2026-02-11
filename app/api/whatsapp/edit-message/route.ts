import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectedClient } from '@/lib/whatsapp-client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { waMessageId, newContent } = await request.json()

    if (!waMessageId || !newContent?.trim()) {
      return NextResponse.json({ error: 'waMessageId and newContent are required' }, { status: 400 })
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

    if (!msg.fromMe) {
      return NextResponse.json({ error: 'Só é possível editar mensagens enviadas por você' }, { status: 403 })
    }

    // Edit the message on WhatsApp
    const edited = await Promise.race([
      msg.edit(newContent.trim()),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout ao editar mensagem')), 10000))
    ])

    if (!edited) {
      return NextResponse.json({ error: 'Não foi possível editar esta mensagem' }, { status: 400 })
    }

    // Update content in database
    await supabaseAdmin
      .from('whatsapp_messages')
      .update({ content: newContent.trim() })
      .eq('wa_message_id', waMessageId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error editing message:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao editar mensagem' },
      { status: 500 }
    )
  }
}
