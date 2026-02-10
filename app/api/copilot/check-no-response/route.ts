import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Periodic job: check for seller messages with no client response after 24h
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

    // Find pending messages older than 24 hours for this user
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: expiredMessages } = await supabaseAdmin
      .from('seller_message_tracking')
      .select('*')
      .eq('user_id', user.id)
      .is('outcome', null)
      .lt('message_timestamp', twentyFourHoursAgo)
      .limit(20)

    if (!expiredMessages || expiredMessages.length === 0) {
      return NextResponse.json({ message: 'No expired messages', processed: 0 })
    }

    let processed = 0

    for (const msg of expiredMessages) {
      try {
        // Check if contact is personal (skip ML for non-clients)
        const { data: conv } = await supabaseAdmin
          .from('whatsapp_conversations')
          .select('contact_type')
          .eq('contact_phone', msg.contact_phone)
          .eq('user_id', msg.user_id)
          .limit(1)
          .single()

        if (conv?.contact_type === 'personal') {
          // Mark as analyzed but don't save as example
          await supabaseAdmin
            .from('seller_message_tracking')
            .update({
              outcome: 'skipped',
              outcome_reason: 'Contato pessoal - excluído do ML',
              analyzed_at: new Date().toISOString()
            })
            .eq('id', msg.id)
          continue
        }

        // Double-check: did the client actually respond? (check whatsapp_messages)
        const { data: inboundMessages } = await supabaseAdmin
          .from('whatsapp_messages')
          .select('id')
          .eq('contact_phone', msg.contact_phone)
          .eq('user_id', msg.user_id)
          .eq('direction', 'inbound')
          .gt('message_timestamp', msg.message_timestamp)
          .limit(1)

        if (inboundMessages && inboundMessages.length > 0) {
          // Client DID respond - this should have been caught by analyze-outcome
          // Skip it, the next inbound message trigger will handle it
          continue
        }

        // No response after 24h → mark as failure
        await supabaseAdmin
          .from('seller_message_tracking')
          .update({
            outcome: 'failure',
            outcome_reason: 'Sem resposta após 24h',
            analyzed_at: new Date().toISOString()
          })
          .eq('id', msg.id)

        // Generate embedding and save as failure example
        const textForEmbedding = `CONTEXTO:\n${msg.conversation_context.slice(0, 1500)}\n\nMENSAGEM DO VENDEDOR (sem resposta):\n${msg.seller_message}`

        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: textForEmbedding.slice(0, 8000)
        })
        const embedding = embeddingResponse.data[0].embedding

        await supabaseAdmin
          .from('followup_examples_failure')
          .insert({
            company_id: msg.company_id,
            user_id: msg.user_id,
            tipo_venda: 'WhatsApp',
            canal: 'WhatsApp',
            content: `ABORDAGEM DO VENDEDOR (SEM RESPOSTA DO CLIENTE):\n${msg.seller_message}\n\nCONTEXTO:\n${msg.conversation_context.slice(0, 1000)}\n\nRESULTADO: Cliente não respondeu após 24 horas`,
            nota_original: 2.0,
            embedding,
            metadata: {
              source: 'auto_no_response',
              company_id: msg.company_id,
              tipo_venda: 'WhatsApp',
              canal: 'WhatsApp',
              outcome: 'failure',
              reason: 'Sem resposta após 24h',
              tracking_id: msg.id
            }
          })

        await supabaseAdmin
          .from('seller_message_tracking')
          .update({ saved_as_example: true })
          .eq('id', msg.id)

        processed++
      } catch (err: any) {
        console.error(`[Copilot NoResponse] Error processing ${msg.id}:`, err.message)
      }
    }

    return NextResponse.json({ success: true, processed })

  } catch (error: any) {
    console.error('[Copilot NoResponse] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar mensagens sem resposta', details: error.message },
      { status: 500 }
    )
  }
}
