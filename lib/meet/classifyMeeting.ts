import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface MeetingClassification {
  meeting_type: 'sales' | 'non_sales'
  category: string
  confidence: number
  reason: string
}

export async function classifyMeeting(transcript: string): Promise<MeetingClassification> {
  // Transcripts too short to classify reliably → default non_sales
  if (transcript.length < 200) {
    console.log(`[ClassifyMeeting] Transcript too short (${transcript.length} chars), defaulting to non_sales`)
    return { meeting_type: 'non_sales', category: 'outro', confidence: 0, reason: 'Transcricao muito curta para classificar' }
  }

  try {
    // Use first ~3000 chars — enough to identify context
    const sample = transcript.substring(0, 3000)

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `Voce classifica reunioes de negocios em portugues brasileiro.

Analise a transcricao e determine se e uma reuniao de VENDAS ou NAO-VENDAS.

VENDAS inclui: prospecao, discovery, demo de produto, negociacao, fechamento, follow-up comercial, qualificacao de lead.
NAO-VENDAS inclui: alinhamento interno, kickoff de projeto, onboarding de cliente ja fechado, suporte tecnico, reuniao de equipe, treinamento, retrospectiva, 1:1.

Responda APENAS com JSON valido:
{
  "meeting_type": "sales" | "non_sales",
  "category": "prospeccao" | "discovery" | "demo" | "negociacao" | "fechamento" | "follow_up" | "alinhamento" | "kickoff" | "onboarding" | "suporte" | "interno" | "outro",
  "confidence": 0.0 a 1.0,
  "reason": "justificativa em 1 frase"
}`
        },
        {
          role: 'user',
          content: sample
        }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    })

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}')

    const result: MeetingClassification = {
      meeting_type: parsed.meeting_type === 'non_sales' ? 'non_sales' : 'sales',
      category: parsed.category || 'outro',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reason: parsed.reason || '',
    }

    // Low confidence → default to non_sales (safer to skip SPIN than pollute data with 0.0 scores)
    if (result.confidence < 0.5) {
      console.log(`[ClassifyMeeting] Low confidence (${result.confidence}) for ${result.meeting_type}, defaulting to non_sales`)
      result.meeting_type = 'non_sales'
    }

    console.log(`[ClassifyMeeting] ${result.meeting_type} (${result.category}, confidence: ${result.confidence}) — ${result.reason}`)
    return result
  } catch (err: any) {
    console.error('[ClassifyMeeting] Error:', err.message)
    // On error, default to non_sales (safer to skip SPIN than pollute data)
    return {
      meeting_type: 'non_sales',
      category: 'outro',
      confidence: 0,
      reason: 'Erro na classificacao, assumindo nao-vendas por seguranca',
    }
  }
}
