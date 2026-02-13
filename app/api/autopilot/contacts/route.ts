import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// GET - List all autopilot contacts for the authenticated user
export async function GET(req: NextRequest) {
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

    const { data: contacts } = await supabaseAdmin
      .from('autopilot_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ contacts: contacts || [] })
  } catch (error: any) {
    console.error('[Autopilot Contacts] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Add or toggle a contact for autopilot monitoring
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

    const { data: employeeData } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const companyId = employeeData?.company_id
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    const body = await req.json()
    const { action, contactPhone, contactName } = body

    if (!contactPhone) {
      return NextResponse.json({ error: 'contactPhone é obrigatório' }, { status: 400 })
    }

    if (action === 'add') {
      // Upsert contact (UNIQUE on user_id + contact_phone)
      const { data: contact, error } = await supabaseAdmin
        .from('autopilot_contacts')
        .upsert({
          user_id: user.id,
          company_id: companyId,
          contact_phone: contactPhone,
          contact_name: contactName || null,
          enabled: true
        }, { onConflict: 'user_id,contact_phone' })
        .select()
        .single()

      if (error) {
        console.error('[Autopilot Contacts] upsert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, contact })
    }

    if (action === 'remove') {
      await supabaseAdmin
        .from('autopilot_contacts')
        .delete()
        .eq('user_id', user.id)
        .eq('contact_phone', contactPhone)

      return NextResponse.json({ success: true })
    }

    if (action === 'toggle') {
      // Get current state
      const { data: existing } = await supabaseAdmin
        .from('autopilot_contacts')
        .select('enabled')
        .eq('user_id', user.id)
        .eq('contact_phone', contactPhone)
        .single()

      if (existing) {
        const { data: contact } = await supabaseAdmin
          .from('autopilot_contacts')
          .update({ enabled: !existing.enabled })
          .eq('user_id', user.id)
          .eq('contact_phone', contactPhone)
          .select()
          .single()

        return NextResponse.json({ success: true, contact })
      } else {
        // Create as enabled
        const { data: contact } = await supabaseAdmin
          .from('autopilot_contacts')
          .insert({
            user_id: user.id,
            company_id: companyId,
            contact_phone: contactPhone,
            contact_name: contactName || null,
            enabled: true
          })
          .select()
          .single()

        return NextResponse.json({ success: true, contact })
      }
    }

    // Batch add multiple contacts
    if (action === 'batch_add') {
      const { contacts } = body
      if (!Array.isArray(contacts)) {
        return NextResponse.json({ error: 'contacts array é obrigatório' }, { status: 400 })
      }

      const records = contacts.map((c: { phone: string; name?: string }) => ({
        user_id: user.id,
        company_id: companyId,
        contact_phone: c.phone,
        contact_name: c.name || null,
        enabled: true
      }))

      const { error } = await supabaseAdmin
        .from('autopilot_contacts')
        .upsert(records, { onConflict: 'user_id,contact_phone' })

      if (error) {
        console.error('[Autopilot Contacts] batch upsert error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, count: records.length })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error: any) {
    console.error('[Autopilot Contacts] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove a contact from autopilot
export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const contactPhone = searchParams.get('contactPhone')

    if (!contactPhone) {
      return NextResponse.json({ error: 'contactPhone é obrigatório' }, { status: 400 })
    }

    await supabaseAdmin
      .from('autopilot_contacts')
      .delete()
      .eq('user_id', user.id)
      .eq('contact_phone', contactPhone)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Autopilot Contacts] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
