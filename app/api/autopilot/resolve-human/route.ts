import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// POST - Clear the "needs human" flag on a contact
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
    }

    const { contactPhone } = await req.json()
    if (!contactPhone) {
      return NextResponse.json({ error: 'contactPhone é obrigatório' }, { status: 400 })
    }

    // Clear flag on autopilot_contacts
    await supabaseAdmin
      .from('autopilot_contacts')
      .update({
        needs_human: false,
        needs_human_reason: null,
        needs_human_at: null
      })
      .eq('user_id', user.id)
      .eq('contact_phone', contactPhone)

    // Also clear on whatsapp_conversations
    const { data: connection } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (connection) {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({ autopilot_needs_human: false })
        .eq('connection_id', connection.id)
        .eq('contact_phone', contactPhone)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Autopilot Resolve] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
