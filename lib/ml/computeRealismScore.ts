import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

/**
 * Compute realism score for a roleplay session by comparing
 * the AI client's turns against real meeting patterns from the same company.
 * Score range: 0.00-99.99 (stored as DECIMAL(4,2))
 */
export async function computeAndSaveRealismScore(
  sessionId: string,
  companyId: string,
  clientMessages: string[]
): Promise<number | null> {
  try {
    if (clientMessages.length === 0) return null

    // Build a combined text from client messages (the AI's roleplay turns)
    const clientText = clientMessages
      .slice(0, 15) // Use up to 15 client turns
      .join('\n')
      .slice(0, 6000)

    // Generate embedding for the roleplay client behavior
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: clientText,
    })
    const roleplayEmbedding = response.data[0].embedding

    // Query real meeting patterns for this company
    const { data: patterns } = await supabaseAdmin.rpc('match_meeting_patterns', {
      query_embedding: roleplayEmbedding,
      company_id_filter: companyId,
      match_threshold: 0.3, // Low threshold to get matches even if not very similar
      match_count: 10,
    })

    if (!patterns || patterns.length === 0) {
      // No real data to compare against — skip scoring
      return null
    }

    // Calculate average similarity across matched patterns
    const similarities = patterns.map((p: any) => p.similarity as number)
    const avgSimilarity = similarities.reduce((a: number, b: number) => a + b, 0) / similarities.length

    // Scale to 0-99.99 with a sqrt curve that rewards higher similarity
    // sqrt makes mid-range similarities score better (0.4 → ~63, 0.6 → ~77, 0.8 → ~89)
    // Cap at 99.99 to fit DECIMAL(4,2)
    const scaled = Math.sqrt(avgSimilarity) * 100
    const realismScore = Math.min(99.99, Math.round(scaled * 100) / 100)

    // Save to session
    await supabaseAdmin
      .from('roleplay_sessions')
      .update({ realism_score: realismScore })
      .eq('id', sessionId)

    console.log(`[RealismScore] Session ${sessionId}: ${realismScore.toFixed(1)} (avg similarity: ${avgSimilarity.toFixed(3)}, ${patterns.length} patterns matched)`)

    return realismScore
  } catch (error: any) {
    console.error('[RealismScore] Error:', error.message)
    return null
  }
}
