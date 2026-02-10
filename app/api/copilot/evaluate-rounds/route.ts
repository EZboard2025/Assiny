import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

const N8N_FOLLOWUP_WEBHOOK = 'https://ezboard.app.n8n.cloud/webhook/c025a4ee-aa92-4a89-82fe-54eb6710a139'

// Periodic job: evaluate conversation rounds after 1h of silence
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

    // Get company_id
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!employee?.company_id) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    const companyId = employee.company_id

    // Get company tipo_venda
    const { data: companyType } = await supabaseAdmin
      .from('company_type')
      .select('business_type')
      .eq('company_id', companyId)
      .single()

    const tipoVenda = companyType?.business_type || 'B2B'

    // Find conversations with 1h+ silence that need evaluation
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: conversations } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_type', 'client')
      .lt('last_message_at', oneHourAgo)
      .limit(5)

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ message: 'No conversations to evaluate', evaluated: 0 })
    }

    // Filter: only conversations where last_message_at > last_evaluated_at (or never evaluated)
    const qualifiedConversations = conversations.filter(conv => {
      if (!conv.last_evaluated_at) return true
      return new Date(conv.last_message_at) > new Date(conv.last_evaluated_at)
    })

    if (qualifiedConversations.length === 0) {
      return NextResponse.json({ message: 'All conversations already evaluated', evaluated: 0 })
    }

    let evaluated = 0

    for (const conv of qualifiedConversations) {
      try {
        // Fetch messages for this round
        const sinceTimestamp = conv.last_evaluated_at || '1970-01-01T00:00:00.000Z'

        const { data: roundMessages } = await supabaseAdmin
          .from('whatsapp_messages')
          .select('*')
          .eq('contact_phone', conv.contact_phone)
          .eq('user_id', user.id)
          .gt('message_timestamp', sinceTimestamp)
          .lte('message_timestamp', conv.last_message_at)
          .order('message_timestamp', { ascending: true })

        if (!roundMessages || roundMessages.length === 0) {
          continue
        }

        // Format messages as text
        const formattedMessages = roundMessages.map(msg => {
          const sender = msg.direction === 'outbound' ? 'Vendedor' : (conv.contact_name || 'Cliente')
          const timestamp = new Date(msg.message_timestamp)
          const dateStr = timestamp.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          const timeStr = timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

          let content = msg.content || ''

          // Include audio transcriptions
          if (msg.transcription) {
            content = `[Áudio transcrito]: ${msg.transcription}`
          } else if (!content && msg.message_type === 'audio') {
            content = '[Áudio sem transcrição]'
          } else if (!content && msg.message_type === 'image') {
            content = '[Imagem]'
          } else if (!content && msg.message_type === 'video') {
            content = '[Vídeo]'
          } else if (!content && msg.message_type === 'document') {
            content = '[Documento]'
          }

          return `[${dateStr} ${timeStr}] ${sender}: ${content}`
        }).join('\n')

        // Count round number
        const { count: existingRounds } = await supabaseAdmin
          .from('conversation_round_evaluations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('contact_phone', conv.contact_phone)

        const roundNumber = (existingRounds || 0) + 1

        // Send to N8N for evaluation
        const n8nResponse = await fetch(N8N_FOLLOWUP_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatInput: 'faça a analise',
            transcricao: formattedMessages,
            tipo_venda: tipoVenda,
            canal: 'WhatsApp',
            fase_funil: 'Follow-up',
            company_id: companyId
          })
        })

        if (!n8nResponse.ok) {
          console.error(`[EvaluateRounds] N8N error for ${conv.contact_phone}: ${n8nResponse.status}`)
          continue
        }

        const responseText = await n8nResponse.text()

        // Check for HTML response
        if (responseText.trim().startsWith('<')) {
          console.error('[EvaluateRounds] N8N returned HTML instead of JSON')
          continue
        }

        let n8nData
        try {
          n8nData = JSON.parse(responseText)
        } catch {
          console.error('[EvaluateRounds] Failed to parse N8N response')
          continue
        }

        // Parse N8N response (5 possible formats)
        let n8nResult = null

        if (n8nData && typeof n8nData === 'object') {
          if (n8nData.analysis) {
            n8nResult = n8nData.analysis
          } else if (Array.isArray(n8nData) && n8nData[0]?.output) {
            let outputString = n8nData[0].output
            if (typeof outputString === 'string') {
              outputString = outputString.replace(/^```json\n/, '').replace(/\n```$/, '')
              try { n8nResult = JSON.parse(outputString) } catch { n8nResult = null }
            } else {
              n8nResult = outputString
            }
          } else if (n8nData.output) {
            if (typeof n8nData.output === 'string') {
              let outputString = n8nData.output.replace(/^```json\n/, '').replace(/\n```$/, '')
              try { n8nResult = JSON.parse(outputString) } catch { n8nResult = null }
            } else {
              n8nResult = n8nData.output
            }
          } else if (n8nData.notas) {
            n8nResult = n8nData
          } else if (typeof n8nData === 'string') {
            try { n8nResult = JSON.parse(n8nData) } catch { n8nResult = null }
          }
        }

        if (!n8nResult || !n8nResult.notas) {
          console.error(`[EvaluateRounds] Invalid N8N result for ${conv.contact_phone}`)
          continue
        }

        // Ensure timing is present
        if (!n8nResult.notas.timing) {
          n8nResult.notas.timing = { nota: 0, peso: 10, comentario: 'Timing não avaliado' }
        }

        const notaFinal = parseFloat(n8nResult.nota_final?.toString()) || 0
        const classificacao = n8nResult.classificacao || 'indefinido'

        // Save evaluation
        const { error: insertError } = await supabaseAdmin
          .from('conversation_round_evaluations')
          .insert({
            user_id: user.id,
            company_id: companyId,
            contact_phone: conv.contact_phone,
            contact_name: conv.contact_name,
            round_number: roundNumber,
            round_messages: formattedMessages,
            round_start: roundMessages[0].message_timestamp,
            round_end: roundMessages[roundMessages.length - 1].message_timestamp,
            message_count: roundMessages.length,
            avaliacao: n8nResult,
            nota_final: notaFinal,
            classificacao
          })

        if (insertError) {
          console.error(`[EvaluateRounds] Error saving evaluation:`, insertError.message)
          continue
        }

        // Update last_evaluated_at
        await supabaseAdmin
          .from('whatsapp_conversations')
          .update({ last_evaluated_at: new Date().toISOString() })
          .eq('contact_phone', conv.contact_phone)
          .eq('user_id', user.id)

        console.log(`[EvaluateRounds] Evaluated ${conv.contact_name || conv.contact_phone} round ${roundNumber}: ${notaFinal} (${classificacao})`)
        evaluated++
      } catch (err: any) {
        console.error(`[EvaluateRounds] Error processing ${conv.contact_phone}:`, err.message)
      }
    }

    return NextResponse.json({ success: true, evaluated })

  } catch (error: any) {
    console.error('[EvaluateRounds] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao avaliar rounds', details: error.message },
      { status: 500 }
    )
  }
}
