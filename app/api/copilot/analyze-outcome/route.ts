import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Called automatically when a client responds to a seller message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contactPhone, clientResponse, companyId, userId } = body

    if (!contactPhone || !clientResponse || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Find pending seller messages for this contact
    const { data: pendingMessages } = await supabaseAdmin
      .from('seller_message_tracking')
      .select('*')
      .eq('contact_phone', contactPhone)
      .eq('user_id', userId)
      .is('outcome', null)
      .order('message_timestamp', { ascending: false })
      .limit(3)

    if (!pendingMessages || pendingMessages.length === 0) {
      return NextResponse.json({ message: 'No pending messages to analyze' })
    }

    let analyzed = 0

    for (const msg of pendingMessages) {
      try {
        // 2. Classify with GPT-4o-mini
        const classificationResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Você é um classificador de interações de vendas. Analise a interação vendedor→cliente e classifique o resultado.

Responda APENAS com JSON válido, sem markdown:
{"outcome": "success|failure|partial", "reason": "explicação curta em português"}

Critérios:
- success: cliente respondeu positivamente, aceitou, demonstrou interesse, avançou, agendou, confirmou
- failure: cliente rejeitou, reclamou, demonstrou desinteresse, pediu para parar, bloqueou
- partial: cliente respondeu mas sem compromisso claro (pediu mais info, disse "vou pensar", resposta neutra)`
            },
            {
              role: 'user',
              content: `CONTEXTO DA CONVERSA:\n${msg.conversation_context.slice(0, 1500)}\n\nVENDEDOR ENVIOU:\n${msg.seller_message}\n\nCLIENTE RESPONDEU:\n${clientResponse}`
            }
          ],
          max_tokens: 150,
          temperature: 0.1
        })

        const rawContent = classificationResponse.choices[0]?.message?.content || ''
        let classification: { outcome: string; reason: string }

        try {
          classification = JSON.parse(rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
        } catch {
          classification = { outcome: 'partial', reason: 'Não foi possível classificar automaticamente' }
        }

        // 3. Update seller_message_tracking
        await supabaseAdmin
          .from('seller_message_tracking')
          .update({
            outcome: classification.outcome,
            outcome_reason: classification.reason,
            client_response: clientResponse.slice(0, 2000),
            analyzed_at: new Date().toISOString()
          })
          .eq('id', msg.id)

        // 4. Save as example (only success or failure, not partial)
        if (classification.outcome === 'success' || classification.outcome === 'failure') {
          const textForEmbedding = `CONTEXTO:\n${msg.conversation_context.slice(0, 1500)}\n\nMENSAGEM DO VENDEDOR:\n${msg.seller_message}\n\nRESPOSTA DO CLIENTE:\n${clientResponse.slice(0, 500)}`

          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: textForEmbedding.slice(0, 8000)
          })
          const embedding = embeddingResponse.data[0].embedding

          const tableName = classification.outcome === 'success'
            ? 'followup_examples_success'
            : 'followup_examples_failure'
          const nota = classification.outcome === 'success' ? 7.5 : 3.0

          await supabaseAdmin
            .from(tableName)
            .insert({
              company_id: msg.company_id || companyId,
              user_id: msg.user_id,
              tipo_venda: 'WhatsApp',
              canal: 'WhatsApp',
              content: `ABORDAGEM DO VENDEDOR:\n${msg.seller_message}\n\nCONTEXTO:\n${msg.conversation_context.slice(0, 1000)}\n\nRESULTADO: ${classification.reason}`,
              nota_original: nota,
              embedding,
              metadata: {
                source: 'auto_analysis',
                company_id: msg.company_id || companyId,
                tipo_venda: 'WhatsApp',
                canal: 'WhatsApp',
                outcome: classification.outcome,
                reason: classification.reason,
                tracking_id: msg.id
              }
            })

          await supabaseAdmin
            .from('seller_message_tracking')
            .update({ saved_as_example: true })
            .eq('id', msg.id)
        }

        analyzed++
      } catch (err: any) {
        console.error(`[Copilot Auto] Error analyzing message ${msg.id}:`, err.message)
      }
    }

    return NextResponse.json({ success: true, analyzed })

  } catch (error: any) {
    console.error('[Copilot Auto] Error:', error)
    return NextResponse.json(
      { error: 'Erro na análise automática', details: error.message },
      { status: 500 }
    )
  }
}
