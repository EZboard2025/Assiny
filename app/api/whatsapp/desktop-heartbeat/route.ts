import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { claimPendingCommands, completeCommand } from '@/lib/whatsapp-command-queue'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Desktop app heartbeat — reports WhatsApp Web connection status
 * Called every 30s from the Electron desktop app when WhatsApp Web is authenticated.
 * Upserts a whatsapp_connections record so the management dashboard can detect it.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const status = body.status === 'disconnected' ? 'disconnected' : 'active'

    // Get company_id from employees table
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const companyId = employee?.company_id || null
    const phoneNumberId = `desktop_${user.id}`

    if (status === 'disconnected') {
      // Mark desktop connection as disconnected
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('user_id', user.id)
        .eq('phone_number_id', phoneNumberId)

      return NextResponse.json({ ok: true, status: 'disconnected' })
    }

    // Check if desktop connection already exists
    const { data: existing } = await supabaseAdmin
      .from('whatsapp_connections')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('phone_number_id', phoneNumberId)
      .single()

    if (existing) {
      // Update existing: mark active + refresh timestamp
      await supabaseAdmin
        .from('whatsapp_connections')
        .update({
          status: 'active',
          connected_at: new Date().toISOString(),
          last_webhook_at: new Date().toISOString(),
          company_id: companyId,
        })
        .eq('id', existing.id)
    } else {
      // Create new desktop connection record
      await supabaseAdmin
        .from('whatsapp_connections')
        .insert({
          user_id: user.id,
          company_id: companyId,
          phone_number_id: phoneNumberId,
          waba_id: 'desktop',
          display_phone_number: 'Desktop App',
          access_token: 'desktop',
          status: 'active',
          connected_at: new Date().toISOString(),
          last_webhook_at: new Date().toISOString(),
        })
    }

    // Process scrape results reported by desktop
    if (body.scrapeResults && Array.isArray(body.scrapeResults)) {
      for (const result of body.scrapeResults) {
        if (!result.requestId) continue
        await supabaseAdmin
          .from('scrape_requests')
          .update({
            status: result.status || 'failed',
            error_message: result.error || null,
            messages_found: result.messagesFound || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', result.requestId)
      }
    }

    // Process command results reported by desktop
    if (body.commandResults && Array.isArray(body.commandResults)) {
      for (const result of body.commandResults) {
        if (!result.commandId) continue
        await completeCommand(
          result.commandId,
          result.result || null,
          result.error || null
        )
      }
    }

    // Check for pending scrape requests for this seller
    const { data: pendingRequests } = await supabaseAdmin
      .from('scrape_requests')
      .select('id, contact_name, contact_phone')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(3)

    // Mark fetched requests as in_progress
    if (pendingRequests && pendingRequests.length > 0) {
      await supabaseAdmin
        .from('scrape_requests')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .in('id', pendingRequests.map(r => r.id))
    }

    // Claim pending desktop commands for this user
    const pendingCommands = await claimPendingCommands(user.id)

    return NextResponse.json({
      ok: true,
      status: 'active',
      scrapeCommands: (pendingRequests || []).map(r => ({
        requestId: r.id,
        contactName: r.contact_name,
        contactPhone: r.contact_phone,
      })),
      desktopCommands: pendingCommands.map(c => ({
        commandId: c.id,
        type: c.command_type,
        payload: c.payload,
      })),
    })
  } catch (error: any) {
    console.error('[Desktop Heartbeat] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
