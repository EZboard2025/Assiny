import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RealPatternEnrichment {
  realObjections: {
    type: string
    text: string
    exactPhrases: string[]
    frequency: number
    avgResolutionScore: number | null
  }[]
  speechPatterns: {
    phrase: string
    context: string
    emotionalTone: string
  }[]
  emotionalProgressions: {
    stages: { stageName: string; clientBehavior: string }[]
  }[]
  conversationFlows: {
    phases: { phase: string; durationPct: number; keyTopics: string[] }[]
    outcome: string
  }[]
  hasData: boolean
}

// ─── Generate Embedding ─────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}

// ─── Build Search Query ─────────────────────────────────────────────────────

function buildSearchQuery(params: {
  persona: string
  objections: string
  companyType: string
  temperament: string
}): string {
  const parts: string[] = []

  if (params.persona) {
    parts.push(`Cliente: ${params.persona.slice(0, 500)}`)
  }
  if (params.objections && params.objections !== 'Nenhuma objeção específica') {
    parts.push(`Objeções: ${params.objections.slice(0, 500)}`)
  }
  if (params.companyType) {
    parts.push(`Tipo: ${params.companyType}`)
  }
  if (params.temperament) {
    parts.push(`Temperamento: ${params.temperament}`)
  }

  return parts.join('. ') || 'Conversa de vendas genérica'
}

// ─── Main Enrichment Function ───────────────────────────────────────────────

export async function enrichRoleplayWithRealData(
  companyId: string,
  params: {
    persona: string
    objections: string
    companyType: string
    temperament: string
  }
): Promise<RealPatternEnrichment> {
  const empty: RealPatternEnrichment = {
    realObjections: [],
    speechPatterns: [],
    emotionalProgressions: [],
    conversationFlows: [],
    hasData: false,
  }

  try {
    const searchQuery = buildSearchQuery(params)
    const embedding = await generateEmbedding(searchQuery)

    // Run all searches in parallel (with error handling per query)
    const [objections, speechPatterns, emotionalPatterns, flowPatterns] = await Promise.all([
      // Real objections from the bank (deduplicated, with frequency)
      supabaseAdmin.rpc('match_real_objections', {
        query_embedding: embedding,
        company_id_filter: companyId,
        match_threshold: 0.5,
        match_count: 5,
      }).then(res => {
        if (res.error) console.error('[ML Enrich] match_real_objections error:', res.error.message)
        return res
      }),
      // Speech patterns from meetings
      supabaseAdmin.rpc('match_meeting_patterns', {
        query_embedding: embedding,
        company_id_filter: companyId,
        pattern_type_filter: 'speech_pattern',
        match_threshold: 0.5,
        match_count: 8,
      }).then(res => {
        if (res.error) console.error('[ML Enrich] match_meeting_patterns (speech) error:', res.error.message)
        return res
      }),
      // Emotional progressions
      supabaseAdmin.rpc('match_meeting_patterns', {
        query_embedding: embedding,
        company_id_filter: companyId,
        pattern_type_filter: 'emotional_progression',
        match_threshold: 0.45,
        match_count: 3,
      }).then(res => {
        if (res.error) console.error('[ML Enrich] match_meeting_patterns (emotional) error:', res.error.message)
        return res
      }),
      // Conversation flows
      supabaseAdmin.rpc('match_meeting_patterns', {
        query_embedding: embedding,
        company_id_filter: companyId,
        pattern_type_filter: 'conversation_flow',
        match_threshold: 0.45,
        match_count: 3,
      }).then(res => {
        if (res.error) console.error('[ML Enrich] match_meeting_patterns (flow) error:', res.error.message)
        return res
      }),
    ])

    const realObjections = (objections.data || []).map((o: any) => ({
      type: o.objection_type,
      text: o.objection_text,
      exactPhrases: Array.isArray(o.client_exact_phrases) ? o.client_exact_phrases : [],
      frequency: o.frequency || 1,
      avgResolutionScore: o.avg_resolution_score,
    }))

    const speechPats = (speechPatterns.data || []).map((p: any) => ({
      phrase: p.pattern_data?.phrase || '',
      context: p.pattern_data?.context || '',
      emotionalTone: p.pattern_data?.emotional_tone || '',
    })).filter((p: any) => p.phrase)

    const emotionalProgs = (emotionalPatterns.data || []).map((p: any) => ({
      stages: (p.pattern_data?.stages || []).map((s: any) => ({
        stageName: s.stage_name || '',
        clientBehavior: s.client_behavior || '',
      })),
    })).filter((p: any) => p.stages.length > 0)

    const flows = (flowPatterns.data || []).map((p: any) => ({
      phases: (p.pattern_data?.phases || []).map((ph: any) => ({
        phase: ph.phase || '',
        durationPct: ph.duration_pct || 0,
        keyTopics: ph.key_topics || [],
      })),
      outcome: p.pattern_data?.outcome || 'inconclusivo',
    })).filter((f: any) => f.phases.length > 0)

    const hasData = realObjections.length > 0 || speechPats.length > 0 ||
      emotionalProgs.length > 0 || flows.length > 0

    if (hasData) {
      console.log(`[ML Enrich] Company ${companyId}: ${realObjections.length} objections, ${speechPats.length} speech patterns, ${emotionalProgs.length} emotional progs, ${flows.length} flows`)
    }

    return {
      realObjections,
      speechPatterns: speechPats,
      emotionalProgressions: emotionalProgs,
      conversationFlows: flows,
      hasData,
    }
  } catch (error: any) {
    console.error('[ML Enrich] Error:', error.message)
    return empty
  }
}

// ─── Format Enrichment for System Prompt ────────────────────────────────────

export function formatEnrichmentForPrompt(enrichment: RealPatternEnrichment): string {
  if (!enrichment.hasData) return ''

  const sections: string[] = []

  // Real objections with exact phrases clients used
  if (enrichment.realObjections.length > 0) {
    const objLines = enrichment.realObjections.map(o => {
      let line = `- ${o.text} (tipo: ${o.type}, frequência: ${o.frequency}x)`
      if (o.exactPhrases.length > 0) {
        const phrases = o.exactPhrases.slice(0, 3).map(p => `"${p}"`).join(', ')
        line += `\n  Frases reais de clientes: ${phrases}`
      }
      return line
    }).join('\n')

    sections.push(`OBJEÇÕES REAIS DE REUNIÕES DESTA EMPRESA (use como referência para tornar suas objeções mais naturais):
${objLines}`)
  }

  // Speech patterns — real phrases clients use
  if (enrichment.speechPatterns.length > 0) {
    const phrases = enrichment.speechPatterns.slice(0, 6).map(p =>
      `- "${p.phrase}" (tom: ${p.emotionalTone}, contexto: ${p.context})`
    ).join('\n')

    sections.push(`PADRÕES DE FALA REAIS DE CLIENTES (incorpore expressões similares naturalmente):
${phrases}`)
  }

  // Emotional progression from real meetings
  if (enrichment.emotionalProgressions.length > 0) {
    const prog = enrichment.emotionalProgressions[0]
    const stages = prog.stages.map(s => `${s.stageName}: ${s.clientBehavior}`).join(' → ')

    sections.push(`PROGRESSÃO EMOCIONAL TÍPICA EM REUNIÕES REAIS (siga padrão similar):
${stages}`)
  }

  // Conversation flow patterns
  if (enrichment.conversationFlows.length > 0) {
    const flow = enrichment.conversationFlows[0]
    const phases = flow.phases.map(p => `${p.phase} (~${p.durationPct}%)`).join(' → ')

    sections.push(`FLUXO DE CONVERSA TÍPICO (referência de ritmo):
${phases} → Resultado mais comum: ${flow.outcome}`)
  }

  return `\n\n═══ DADOS DE REUNIÕES REAIS (ML) ═══
Os dados abaixo foram extraídos de reuniões de vendas REAIS desta empresa. Use-os para tornar sua atuação mais realista e natural, mas NÃO copie frases literalmente — adapte ao seu personagem.

${sections.join('\n\n')}

═══ FIM DOS DADOS REAIS ═══\n`
}
