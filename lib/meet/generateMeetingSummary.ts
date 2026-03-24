import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface MeetingSummary {
  title: string
  summary: string
  topics: string[]
  decisions: string[]
  action_items: { responsible: string; task: string; deadline?: string }[]
  key_quotes: string[]
  participants: string[]
  duration_estimate: string
  sentiment: 'positive' | 'neutral' | 'tense' | 'mixed'
}

export async function generateMeetingSummary(transcript: string): Promise<MeetingSummary | null> {
  if (!transcript || transcript.length < 50) return null

  try {
    console.log(`[MeetingSummary] Gerando resumo para ${transcript.length} chars...`)

    // Cap transcript for the prompt
    const maxChars = 60000
    const input = transcript.length > maxChars
      ? transcript.substring(0, maxChars) + '\n\n[... transcrição truncada ...]'
      : transcript

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `Você gera resumos estruturados de reuniões em português brasileiro.

Analise a transcrição e extraia:

1. **title**: Título curto da reunião (máx 60 chars)
2. **summary**: Resumo executivo em 2-3 parágrafos. O que foi discutido, contexto e conclusão.
3. **topics**: Lista dos tópicos principais abordados
4. **decisions**: Decisões tomadas durante a reunião (pode ser vazio se nenhuma decisão clara)
5. **action_items**: Próximos passos com responsável e tarefa. Se não ficou claro quem é responsável, use "A definir". Deadline só se mencionado.
6. **key_quotes**: 2-3 frases marcantes ou importantes ditas na reunião (citação direta)
7. **participants**: Nomes dos participantes identificados (ou "Participante 1", "Participante 2" se não identificáveis)
8. **duration_estimate**: Estimativa de duração baseada no volume de conteúdo (ex: "~15 min", "~45 min")
9. **sentiment**: Tom geral da reunião: "positive" (produtiva, acordos), "neutral" (informativa), "tense" (conflitos, desacordos), "mixed"

Retorne APENAS JSON válido.`
        },
        { role: 'user', content: input }
      ],
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content)
    console.log(`[MeetingSummary] OK: "${parsed.title}" — ${parsed.topics?.length || 0} tópicos, ${parsed.action_items?.length || 0} action items`)

    return {
      title: parsed.title || 'Reunião sem título',
      summary: parsed.summary || '',
      topics: parsed.topics || [],
      decisions: parsed.decisions || [],
      action_items: parsed.action_items || [],
      key_quotes: parsed.key_quotes || [],
      participants: parsed.participants || [],
      duration_estimate: parsed.duration_estimate || '',
      sentiment: ['positive', 'neutral', 'tense', 'mixed'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
    }
  } catch (err: any) {
    console.error('[MeetingSummary] Erro:', err.message)
    return null
  }
}
