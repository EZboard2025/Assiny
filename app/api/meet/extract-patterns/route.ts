import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Extraction Prompt ──────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `Você é um analisador de reuniões de vendas. Analise a transcrição e avaliação abaixo e extraia padrões estruturados.

Retorne APENAS JSON válido com esta estrutura exata:

{
  "objections": [
    {
      "objection_type": "preco|timing|autoridade|concorrencia|confianca|necessidade|outro",
      "objection_text": "Resumo da objeção em 1 frase",
      "client_exact_words": "Frase exata ou muito próxima que o cliente usou",
      "context_before": "O que o vendedor disse antes que provocou a objeção",
      "seller_response": "Como o vendedor respondeu",
      "was_resolved": true/false,
      "resolution_quality": 0-10
    }
  ],
  "speech_patterns": [
    {
      "phrase": "Frase ou expressão real usada pelo cliente",
      "context": "Em que momento da conversa foi usado",
      "emotional_tone": "neutro|interessado|cetico|frustrado|entusiasmado|resistente",
      "formality_level": "formal|informal|misto"
    }
  ],
  "emotional_progression": {
    "stages": [
      {
        "stage_name": "Nome do estágio (ex: abertura_cautelosa, interesse_inicial, objecao_preco, resolucao)",
        "client_behavior": "Descrição do comportamento do cliente neste estágio",
        "seller_trigger": "O que o vendedor fez para mudar de estágio",
        "client_phrases": ["Frases representativas do cliente neste estágio"]
      }
    ]
  },
  "conversation_flow": {
    "phases": [
      {
        "phase": "abertura|qualificacao|apresentacao|objecao|negociacao|fechamento",
        "duration_pct": 0-100,
        "key_topics": ["tópicos abordados"],
        "transition": "Como a conversa transicionou para a próxima fase"
      }
    ],
    "outcome": "ganho|perdido|follow_up|inconclusivo"
  }
}

REGRAS:
- Extraia APENAS padrões que realmente existem na transcrição
- client_exact_words deve ser o mais próximo possível do que foi dito
- Se não houver objeções, retorne array vazio
- speech_patterns: extraia 3-8 frases marcantes do cliente
- emotional_progression: identifique 2-5 estágios emocionais
- conversation_flow: identifique as fases reais da conversa
- Seja preciso e factual, não invente`

// ─── Generate Embedding ──────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}

// ─── Batch Generate Embeddings ───────────────────────────────────────────────

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map(t => t.slice(0, 8000)),
  })
  return response.data.map(d => d.embedding)
}

// ─── Deduplicate Objection ───────────────────────────────────────────────────

async function deduplicateObjection(
  companyId: string,
  objectionText: string,
  embedding: number[],
  objectionData: any
): Promise<'inserted' | 'merged'> {
  // Check for existing similar objection
  const { data: matches } = await supabaseAdmin.rpc('match_real_objections', {
    query_embedding: embedding,
    company_id_filter: companyId,
    match_threshold: 0.9,
    match_count: 1,
  })

  if (matches && matches.length > 0) {
    // Merge: increment frequency, append phrases, merge context, recalc score
    const existing = matches[0]
    const newFreq = (existing.frequency || 1) + 1

    // Merge client phrases (unique, max 20)
    const existingPhrases = Array.isArray(existing.client_exact_phrases) ? existing.client_exact_phrases : []
    const newPhrases = [...existingPhrases, objectionData.client_exact_words].filter(Boolean)
    const uniquePhrases = [...new Set(newPhrases)].slice(0, 20)

    // Merge context examples (max 10)
    const { data: fullRecord } = await supabaseAdmin
      .from('real_objection_bank')
      .select('context_examples, avg_resolution_score')
      .eq('id', existing.id)
      .single()

    const existingContexts = Array.isArray(fullRecord?.context_examples) ? fullRecord.context_examples : []
    const newContext = {
      before: objectionData.context_before,
      response: objectionData.seller_response,
    }
    const mergedContexts = [...existingContexts, newContext].slice(-10)

    // Recalculate avg_resolution_score as running average
    const existingAvg = fullRecord?.avg_resolution_score || 0
    const newScore = objectionData.resolution_quality || 0
    const newAvg = newScore > 0
      ? ((existingAvg * (newFreq - 1)) + newScore) / newFreq
      : existingAvg

    await supabaseAdmin
      .from('real_objection_bank')
      .update({
        frequency: newFreq,
        client_exact_phrases: uniquePhrases,
        context_examples: mergedContexts,
        avg_resolution_score: newAvg > 0 ? Math.round(newAvg * 10) / 10 : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    return 'merged'
  }

  // Insert new objection
  await supabaseAdmin.from('real_objection_bank').insert({
    company_id: companyId,
    objection_type: objectionData.objection_type,
    objection_text: objectionText,
    client_exact_phrases: [objectionData.client_exact_words].filter(Boolean),
    context_examples: [{
      before: objectionData.context_before,
      response: objectionData.seller_response,
    }],
    frequency: 1,
    avg_resolution_score: objectionData.resolution_quality || null,
    embedding,
  })

  return 'inserted'
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { meetEvaluationId, transcript, evaluation, companyId } = await request.json()

    if (!meetEvaluationId || !transcript || !companyId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log(`[ExtractPatterns] Starting for evaluation ${meetEvaluationId}`)

    // Format transcript for extraction
    let transcriptText = ''
    if (typeof transcript === 'string') {
      transcriptText = transcript
    } else if (Array.isArray(transcript)) {
      transcriptText = transcript.map((s: any) => `[${s.speaker || 'Unknown'}]: ${s.text}`).join('\n')
    }

    if (transcriptText.length < 100) {
      console.log('[ExtractPatterns] Transcript too short, skipping')
      return NextResponse.json({ success: true, skipped: true, reason: 'transcript_too_short' })
    }

    // Build context from evaluation
    const evalContext = evaluation ? `
AVALIAÇÃO DA REUNIÃO:
- Nota geral: ${evaluation.overall_score || 'N/A'}
- Nível: ${evaluation.performance_level || 'N/A'}
- Resumo: ${evaluation.executive_summary || 'N/A'}
${evaluation.objections_analysis ? `- Objeções identificadas: ${JSON.stringify(evaluation.objections_analysis)}` : ''}
` : ''

    // Step 1: Extract patterns with GPT-4.1-nano
    console.log('[ExtractPatterns] Calling GPT-4.1-nano for extraction...')
    const extractionResponse = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: `TRANSCRIÇÃO:\n${transcriptText.slice(0, 12000)}\n\n${evalContext}` },
      ],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })

    const rawContent = extractionResponse.choices[0]?.message?.content || '{}'
    let extracted: any
    try {
      extracted = JSON.parse(rawContent)
    } catch {
      console.error('[ExtractPatterns] Failed to parse extraction JSON')
      return NextResponse.json({ success: false, error: 'parse_failed' }, { status: 500 })
    }

    console.log(`[ExtractPatterns] Extracted: ${extracted.objections?.length || 0} objections, ${extracted.speech_patterns?.length || 0} speech patterns`)

    // Step 2: Generate embeddings for all patterns in batch
    const embeddingTexts: string[] = []
    const embeddingMap: { type: string; index: number; embIdx: number }[] = []

    // Objections
    const objections = extracted.objections || []
    for (let i = 0; i < objections.length; i++) {
      const obj = objections[i]
      const text = `Objeção ${obj.objection_type}: ${obj.objection_text}. Cliente disse: ${obj.client_exact_words}`
      embeddingMap.push({ type: 'objection', index: i, embIdx: embeddingTexts.length })
      embeddingTexts.push(text)
    }

    // Speech patterns
    const speechPatterns = extracted.speech_patterns || []
    for (let i = 0; i < speechPatterns.length; i++) {
      const sp = speechPatterns[i]
      const text = `Padrão de fala: "${sp.phrase}" - Tom: ${sp.emotional_tone}, Contexto: ${sp.context}`
      embeddingMap.push({ type: 'speech', index: i, embIdx: embeddingTexts.length })
      embeddingTexts.push(text)
    }

    // Emotional progression (single embedding)
    if (extracted.emotional_progression?.stages?.length > 0) {
      const text = extracted.emotional_progression.stages
        .map((s: any) => `${s.stage_name}: ${s.client_behavior}`)
        .join('. ')
      embeddingMap.push({ type: 'emotional', index: 0, embIdx: embeddingTexts.length })
      embeddingTexts.push(text)
    }

    // Conversation flow (single embedding)
    if (extracted.conversation_flow?.phases?.length > 0) {
      const text = extracted.conversation_flow.phases
        .map((p: any) => `${p.phase} (${p.duration_pct}%): ${p.key_topics?.join(', ')}`)
        .join('. ')
      embeddingMap.push({ type: 'flow', index: 0, embIdx: embeddingTexts.length })
      embeddingTexts.push(text)
    }

    console.log(`[ExtractPatterns] Generating ${embeddingTexts.length} embeddings...`)
    const embeddings = await generateEmbeddings(embeddingTexts)

    // Step 3: Store patterns
    let insertedPatterns = 0
    let mergedObjections = 0
    let insertedObjections = 0

    // Store objections (with deduplication)
    for (const entry of embeddingMap.filter(e => e.type === 'objection')) {
      const obj = objections[entry.index]
      const embedding = embeddings[entry.embIdx]

      const result = await deduplicateObjection(companyId, obj.objection_text, embedding, obj)
      if (result === 'merged') mergedObjections++
      else insertedObjections++

      // Also store in meeting_patterns for this specific meeting
      await supabaseAdmin.from('meeting_patterns').insert({
        company_id: companyId,
        meet_evaluation_id: meetEvaluationId,
        pattern_type: 'objection',
        pattern_data: obj,
        content: embeddingTexts[entry.embIdx],
        embedding,
      })
      insertedPatterns++
    }

    // Store speech patterns
    for (const entry of embeddingMap.filter(e => e.type === 'speech')) {
      const sp = speechPatterns[entry.index]
      await supabaseAdmin.from('meeting_patterns').insert({
        company_id: companyId,
        meet_evaluation_id: meetEvaluationId,
        pattern_type: 'speech_pattern',
        pattern_data: sp,
        content: embeddingTexts[entry.embIdx],
        embedding: embeddings[entry.embIdx],
      })
      insertedPatterns++
    }

    // Store emotional progression
    const emotionalEntry = embeddingMap.find(e => e.type === 'emotional')
    if (emotionalEntry && extracted.emotional_progression) {
      await supabaseAdmin.from('meeting_patterns').insert({
        company_id: companyId,
        meet_evaluation_id: meetEvaluationId,
        pattern_type: 'emotional_progression',
        pattern_data: extracted.emotional_progression,
        content: embeddingTexts[emotionalEntry.embIdx],
        embedding: embeddings[emotionalEntry.embIdx],
      })
      insertedPatterns++
    }

    // Store conversation flow template
    const flowEntry = embeddingMap.find(e => e.type === 'flow')
    if (flowEntry && extracted.conversation_flow) {
      await supabaseAdmin.from('conversation_flow_templates').insert({
        company_id: companyId,
        meet_evaluation_id: meetEvaluationId,
        flow_data: extracted.conversation_flow,
        outcome: extracted.conversation_flow.outcome || null,
        overall_score: evaluation?.overall_score || null,
        embedding: embeddings[flowEntry.embIdx],
      })

      await supabaseAdmin.from('meeting_patterns').insert({
        company_id: companyId,
        meet_evaluation_id: meetEvaluationId,
        pattern_type: 'conversation_flow',
        pattern_data: extracted.conversation_flow,
        content: embeddingTexts[flowEntry.embIdx],
        embedding: embeddings[flowEntry.embIdx],
      })
      insertedPatterns++
    }

    const duration = Date.now() - startTime
    console.log(`[ExtractPatterns] Done in ${duration}ms: ${insertedPatterns} patterns, ${insertedObjections} new objections, ${mergedObjections} merged`)

    return NextResponse.json({
      success: true,
      stats: {
        patterns_inserted: insertedPatterns,
        objections_new: insertedObjections,
        objections_merged: mergedObjections,
        speech_patterns: speechPatterns.length,
        duration_ms: duration,
      },
    })
  } catch (error: any) {
    console.error('[ExtractPatterns] Error:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
