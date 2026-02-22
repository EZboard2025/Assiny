import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendGmail } from '@/lib/google-calendar'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function buildShareEmailHtml(senderName: string, meetingName: string, sectionNames: string, userMessage: string | null, appUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:24px 32px">
        <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700">Assiny</h1>
      </div>
      <div style="padding:32px">
        <h2 style="color:#111827;font-size:18px;margin:0 0 8px">${senderName} compartilhou uma reunião</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Reunião: <strong style="color:#374151">${meetingName}</strong></p>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px">
          <p style="color:#15803d;font-size:13px;font-weight:600;margin:0 0 8px">Seções compartilhadas:</p>
          <p style="color:#166534;font-size:14px;margin:0">${sectionNames}</p>
        </div>

        ${userMessage ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:20px">
          <p style="color:#1e40af;font-size:13px;font-weight:600;margin:0 0 4px">Mensagem:</p>
          <p style="color:#1e3a5f;font-size:14px;margin:0;font-style:italic">"${userMessage}"</p>
        </div>
        ` : ''}

        <a href="${appUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600">
          Ver na Plataforma
        </a>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #f3f4f6">
        <p style="color:#9ca3af;font-size:11px;margin:0">Enviado automaticamente pela plataforma Assiny</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
    }

    const { evaluationId, sharedWithUserIds, sections, message, sendEmail } = await req.json()

    if (!evaluationId || !sharedWithUserIds?.length || !sections?.length) {
      return NextResponse.json({ error: 'evaluationId, sharedWithUserIds e sections são obrigatórios' }, { status: 400 })
    }

    // Get sender info
    const { data: sender } = await supabaseAdmin
      .from('employees')
      .select('company_id, name')
      .eq('user_id', user.id)
      .single()

    if (!sender?.company_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    // Verify evaluation belongs to user
    const { data: evaluation } = await supabaseAdmin
      .from('meet_evaluations')
      .select('id, seller_name, overall_score')
      .eq('id', evaluationId)
      .eq('user_id', user.id)
      .single()

    if (!evaluation) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }

    // Verify recipients are from same company
    const { data: recipients } = await supabaseAdmin
      .from('employees')
      .select('user_id, name')
      .eq('company_id', sender.company_id)
      .in('user_id', sharedWithUserIds)

    if (!recipients?.length) {
      return NextResponse.json({ error: 'Nenhum destinatário válido encontrado' }, { status: 400 })
    }

    // Format section names for notification message
    const sectionLabels: Record<string, string> = {
      smart_notes: 'Notas Inteligentes',
      spin: 'Análise SPIN',
      evaluation: 'Avaliação Detalhada',
      transcript: 'Transcrição',
    }
    const sectionNames = sections.map((s: string) => sectionLabels[s] || s).join(', ')

    // Detect app URL from request
    const host = req.headers.get('host') || 'ramppy.site'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const appUrl = `${protocol}://${host}`

    // Create shares and notifications for each recipient
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        // Upsert share (update sections if already shared)
        const { data: share, error: shareError } = await supabaseAdmin
          .from('shared_meet_evaluations')
          .upsert({
            evaluation_id: evaluationId,
            shared_by: user.id,
            shared_with: recipient.user_id,
            shared_sections: sections,
            message: message || null,
            company_id: sender.company_id,
            is_viewed: false,
            viewed_at: null,
          }, {
            onConflict: 'evaluation_id,shared_by,shared_with',
          })
          .select('id')
          .single()

        if (shareError) throw shareError

        // Create notification
        await supabaseAdmin
          .from('user_notifications')
          .insert({
            user_id: recipient.user_id,
            type: 'shared_meeting',
            title: `${sender.name} compartilhou uma reunião`,
            message: message || `Compartilhou: ${sectionNames}`,
            data: {
              shareId: share.id,
              evaluationId,
              sharedBy: user.id,
              senderName: sender.name,
              sections,
            },
          })

        return { userId: recipient.user_id, success: true }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    // Send emails (non-blocking, after shares are created)
    let emailsSent = 0
    if (sendEmail) {
      try {
        for (const recipient of recipients) {
          const { data: recipientData } = await supabaseAdmin.auth.admin.getUserById(recipient.user_id)
          const recipientEmail = recipientData?.user?.email
          if (!recipientEmail) continue

          try {
            await sendGmail(user.id, {
              to: recipientEmail,
              subject: `${sender.name} compartilhou uma reunião com você`,
              htmlBody: buildShareEmailHtml(
                sender.name,
                evaluation.seller_name,
                sectionNames,
                message || null,
                appUrl
              ),
            })
            emailsSent++
          } catch (emailErr) {
            console.warn(`[Meet Share] Failed to email ${recipientEmail}:`, emailErr)
          }
        }
      } catch (emailErr) {
        console.warn('[Meet Share] Email sending failed (non-blocking):', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      shared: successful,
      failed,
      emailsSent,
    })

  } catch (error: any) {
    console.error('[Meet Share] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
