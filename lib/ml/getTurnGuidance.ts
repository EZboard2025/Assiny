import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TurnGuidance {
  hasGuidance: boolean
  prompt: string
}

// ─── Main Function ──────────────────────────────────────────────────────────

/**
 * Per-turn ML guidance: analyzes the seller's latest message against real
 * meeting patterns and returns a hidden system "whisper" to guide the AI's
 * next response with realistic client behavior.
 */
export async function getTurnGuidance(
  companyId: string,
  sellerMessage: string,
  recentContext: string
): Promise<TurnGuidance> {
  const empty: TurnGuidance = { hasGuidance: false, prompt: '' }

  try {
    if (!sellerMessage || sellerMessage.length < 10) return empty

    const searchText = `Vendedor disse: ${sellerMessage}${recentContext ? `\nContexto recente: ${recentContext}` : ''}`

    // Generate embedding for this turn
    const embResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: searchText.slice(0, 8000),
    })
    const embedding = embResponse.data[0].embedding

    // Search real patterns in parallel
    const [objections, speechPatterns, emotionalPatterns] = await Promise.all([
      supabaseAdmin.rpc('match_real_objections', {
        query_embedding: embedding,
        company_id_filter: companyId,
        match_threshold: 0.45,
        match_count: 3,
      }).then(res => {
        if (res.error) console.error('[TurnGuidance] match_real_objections error:', res.error.message)
        return res.data || []
      }),

      supabaseAdmin.rpc('match_meeting_patterns', {
        query_embedding: embedding,
        company_id_filter: companyId,
        pattern_type_filter: 'speech_pattern',
        match_threshold: 0.45,
        match_count: 5,
      }).then(res => {
        if (res.error) console.error('[TurnGuidance] match_meeting_patterns (speech) error:', res.error.message)
        return res.data || []
      }),

      supabaseAdmin.rpc('match_meeting_patterns', {
        query_embedding: embedding,
        company_id_filter: companyId,
        pattern_type_filter: 'emotional_progression',
        match_threshold: 0.4,
        match_count: 2,
      }).then(res => {
        if (res.error) console.error('[TurnGuidance] match_meeting_patterns (emotional) error:', res.error.message)
        return res.data || []
      }),
    ])

    const sections: string[] = []

    // Relevant real objections for this moment
    if (objections.length > 0) {
      const objLines = objections.map((o: any) => {
        const phrases = Array.isArray(o.client_exact_phrases) && o.client_exact_phrases.length > 0
          ? o.client_exact_phrases.slice(0, 2).map((p: string) => `"${p}"`).join(', ')
          : null
        let line = `- ${o.objection_text} (tipo: ${o.objection_type}, apareceu ${o.frequency || 1}x em reuniões reais)`
        if (phrases) line += `\n  Clientes reais disseram: ${phrases}`
        return line
      }).join('\n')

      sections.push(`OBJEÇÕES QUE CLIENTES REAIS LEVANTARAM EM MOMENTOS SIMILARES:\n${objLines}`)
    }

    // Real speech patterns for this context
    if (speechPatterns.length > 0) {
      const phrases = speechPatterns
        .filter((p: any) => p.pattern_data?.phrase)
        .slice(0, 4)
        .map((p: any) => `- "${p.pattern_data.phrase}" (tom: ${p.pattern_data.emotional_tone || 'neutro'})`)
        .join('\n')

      if (phrases) {
        sections.push(`FRASES QUE CLIENTES REAIS USARAM EM CONTEXTOS PARECIDOS:\n${phrases}`)
      }
    }

    // Emotional context from real meetings
    if (emotionalPatterns.length > 0) {
      const stages = emotionalPatterns[0].pattern_data?.stages
      if (stages && stages.length > 0) {
        const stageText = stages
          .slice(0, 3)
          .map((s: any) => `${s.stage_name}: ${s.client_behavior}`)
          .join(' → ')
        sections.push(`PROGRESSÃO EMOCIONAL TÍPICA NESTE TIPO DE MOMENTO:\n${stageText}`)
      }
    }

    if (sections.length === 0) return empty

    const prompt = `[REFERÊNCIA ML INVISÍVEL — NÃO mencione que você tem esses dados, apenas USE como inspiração para reagir de forma mais realista]

${sections.join('\n\n')}

INSTRUÇÕES: Adapte sua próxima resposta usando esses dados como referência de como clientes REAIS se comportam. Não copie frases literalmente — adapte ao seu personagem, idade e temperamento. Se os dados não forem relevantes para este momento, ignore-os.`

    console.log(`[TurnGuidance] Generated guidance: ${objections.length} objections, ${speechPatterns.length} speech, ${emotionalPatterns.length} emotional`)

    return { hasGuidance: true, prompt }
  } catch (error: any) {
    console.error('[TurnGuidance] Error (non-fatal):', error.message)
    return empty
  }
}
