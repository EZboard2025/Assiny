import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { feedbackId, wasHelpful } = body

    if (!feedbackId || wasHelpful === undefined) {
      return NextResponse.json(
        { error: 'feedbackId e wasHelpful são obrigatórios' },
        { status: 400 }
      )
    }

    // 1. Update was_helpful
    const { error: updateError } = await supabaseAdmin
      .from('copilot_feedback')
      .update({ was_helpful: wasHelpful })
      .eq('id', feedbackId)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao atualizar feedback' }, { status: 500 })
    }

    // 2. Fetch full record
    const { data: feedback } = await supabaseAdmin
      .from('copilot_feedback')
      .select('*')
      .eq('id', feedbackId)
      .single()

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback não encontrado' }, { status: 404 })
    }

    // 3. Generate embedding
    const textForEmbedding = `CONTEXTO:\n${feedback.conversation_context.slice(0, 2000)}\n\nSUGESTÃO:\n${feedback.ai_suggestion}`

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: textForEmbedding.slice(0, 8000)
    })
    const embedding = embeddingResponse.data[0].embedding

    // 4. Save to success or failure examples
    const tableName = wasHelpful ? 'followup_examples_success' : 'followup_examples_failure'
    const nota = wasHelpful ? 8.0 : 3.0

    await supabaseAdmin
      .from(tableName)
      .insert({
        company_id: feedback.company_id,
        user_id: feedback.user_id,
        tipo_venda: 'WhatsApp',
        canal: 'WhatsApp',
        content: `ABORDAGEM DO VENDEDOR (via Copiloto):\n${feedback.ai_suggestion}\n\nCONTEXTO DA CONVERSA:\n${feedback.conversation_context.slice(0, 1500)}`,
        nota_original: nota,
        embedding,
        metadata: {
          source: 'copilot_feedback',
          company_id: feedback.company_id,
          tipo_venda: 'WhatsApp',
          canal: 'WhatsApp',
          was_helpful: wasHelpful,
          copilot_feedback_id: feedbackId
        }
      })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[Copilot Feedback] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar feedback', details: error.message },
      { status: 500 }
    )
  }
}
