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
        // 2. Classify with GPT-4.1-mini
        const classificationResponse = await openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            {
              role: 'system',
              content: `Você é um classificador expert de interações de vendas no WhatsApp. Analise a interação vendedor→cliente e classifique o resultado considerando:

1. O TOM da resposta do cliente (entusiasmo, indiferença, irritação)
2. A INTENÇÃO implícita (quer comprar, está avaliando, quer sair)
3. Se o vendedor AGREGOU VALOR ou apenas cobrou resposta
4. Se houve AVANÇO no funil de vendas

Responda APENAS com JSON válido, sem markdown:
{"outcome": "success|failure|partial", "reason": "explicação curta em português", "quality_score": 1-10}

Critérios detalhados:
- success (quality_score 7-10): cliente respondeu positivamente, aceitou proposta, demonstrou interesse genuíno, agendou reunião, pediu orçamento, confirmou compra, avançou no funil
- failure (quality_score 1-3): cliente rejeitou explicitamente, reclamou, demonstrou desinteresse claro, pediu para parar, bloqueou, ignorou proposta de valor
- partial (quality_score 4-6): cliente respondeu mas sem compromisso claro (pediu mais info, disse "vou pensar", resposta monossilábica neutra, mudou de assunto)

IMPORTANTE: Avalie também a qualidade da abordagem do vendedor:
- Ele trouxe valor novo ou só cobrou resposta?
- O tom foi consultivo ou desesperado?
- A mensagem era personalizada ou genérica?`
            },
            {
              role: 'user',
              content: `CONTEXTO DA CONVERSA:\n${msg.conversation_context.slice(0, 2000)}\n\nVENDEDOR ENVIOU:\n${msg.seller_message}\n\nCLIENTE RESPONDEU:\n${clientResponse}`
            }
          ],
          max_tokens: 200,
          temperature: 0.1
        })

        const rawContent = classificationResponse.choices[0]?.message?.content || ''
        let classification: { outcome: string; reason: string; quality_score?: number }

        try {
          const parsed = JSON.parse(rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
          classification = parsed
        } catch {
          classification = { outcome: 'partial', reason: 'Não foi possível classificar automaticamente', quality_score: 5 }
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
          const textForEmbedding = `CONTEXTO:\n${msg.conversation_context.slice(0, 2000)}\n\nMENSAGEM DO VENDEDOR:\n${msg.seller_message}\n\nRESPOSTA DO CLIENTE:\n${clientResponse.slice(0, 500)}\n\nRESULTADO: ${classification.reason}`

          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: textForEmbedding.slice(0, 8000)
          })
          const embedding = embeddingResponse.data[0].embedding

          const tableName = classification.outcome === 'success'
            ? 'followup_examples_success'
            : 'followup_examples_failure'
          // Dynamic score based on quality_score from GPT-4.1-mini analysis
          const qualityScore = classification.quality_score || (classification.outcome === 'success' ? 7 : 3)
          const nota = classification.outcome === 'success'
            ? Math.min(10, Math.max(6, qualityScore))  // success: 6-10
            : Math.min(4, Math.max(1, qualityScore))   // failure: 1-4

          await supabaseAdmin
            .from(tableName)
            .insert({
              company_id: msg.company_id || companyId,
              user_id: msg.user_id,
              tipo_venda: 'WhatsApp',
              canal: 'WhatsApp',
              content: `ABORDAGEM DO VENDEDOR:\n${msg.seller_message}\n\nCONTEXTO:\n${msg.conversation_context.slice(0, 1500)}\n\nRESPOSTA DO CLIENTE:\n${clientResponse.slice(0, 500)}\n\nRESULTADO: ${classification.reason}`,
              nota_original: nota,
              embedding,
              metadata: {
                source: 'auto_analysis',
                company_id: msg.company_id || companyId,
                tipo_venda: 'WhatsApp',
                canal: 'WhatsApp',
                outcome: classification.outcome,
                reason: classification.reason,
                quality_score: qualityScore,
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
