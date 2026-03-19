import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function getCompanyContext(companyId: string): Promise<{ name?: string, products?: string } | undefined> {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await supabase
      .from('company_data')
      .select('nome, produtos_servicos')
      .eq('company_id', companyId)
      .maybeSingle()
    if (data?.nome) return { name: data.nome, products: data.produtos_servicos || undefined }
  } catch {}
  return undefined
}

export interface MeetingClassification {
  meeting_type: 'sales' | 'non_sales'
  category: string
  confidence: number
  reason: string
}

export async function classifyMeeting(transcript: string, companyContext?: { name?: string, products?: string }): Promise<MeetingClassification> {
  // Transcripts too short to classify reliably → default non_sales
  if (transcript.length < 200) {
    console.log(`[ClassifyMeeting] Transcript too short (${transcript.length} chars), defaulting to non_sales`)
    return { meeting_type: 'non_sales', category: 'outro', confidence: 0, reason: 'Transcricao muito curta para classificar' }
  }

  try {
    // Use first ~3000 chars — enough to identify context
    const sample = transcript.substring(0, 3000)

    const companyInfo = companyContext?.name
      ? `\n\nCONTEXTO DA EMPRESA DO USUARIO: "${companyContext.name}"${companyContext.products ? `. Produtos/servicos que esta empresa vende: ${companyContext.products.substring(0, 300)}` : ''}.

REGRA CRITICA: A reuniao so e classificada como VENDAS se o vendedor esta vendendo os produtos/servicos DESTA empresa especifica ("${companyContext.name}"). Se a conversa envolve produtos/servicos de OUTRA empresa, ou se o assunto nao tem relacao com os produtos listados acima, classifique como NAO-VENDAS mesmo que haja linguagem comercial.`
      : ''

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `Voce classifica reunioes de negocios em portugues brasileiro.

Analise a transcricao e determine se e uma reuniao de VENDAS REAL ou NAO-VENDAS.

VENDAS (apenas se TODOS os criterios forem atendidos):
1. O vendedor esta VENDENDO ou apresentando produtos/servicos
2. Ha um CLIENTE REAL (prospect/lead) do outro lado
3. Se houver contexto da empresa, os produtos sendo vendidos DEVEM ser da empresa informada
Inclui: prospecao, discovery, demo, negociacao, fechamento, follow-up comercial, qualificacao de lead.

NAO-VENDAS (qualquer um destes):
- Alinhamento interno, kickoff, onboarding, suporte, reuniao de equipe
- Retrospectiva, 1:1, cotacao onde o usuario e COMPRADOR
- Reunioes sociais, networking
- Conversa sobre produtos/servicos que NAO sao da empresa do usuario
- Qualquer reuniao onde nao ha um cliente real sendo atendido${companyInfo}

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
