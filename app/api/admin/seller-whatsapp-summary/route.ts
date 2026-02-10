import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const { sellerName, evaluations, playbook } = await request.json()

    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json({ error: 'No evaluations provided' }, { status: 400 })
    }

    // Build concise context from evaluations
    const avgScore = evaluations.reduce((sum: number, e: any) => sum + e.nota_final, 0) / evaluations.length
    const evalsContext = evaluations.map((e: any) => {
      const notas = e.avaliacao?.notas || {}
      const scores = Object.entries(notas).map(([k, v]: [string, any]) => `${k}: ${v.nota}`).join(', ')
      return `- ${e.contact_name || e.contact_phone} | Nota: ${e.nota_final} | ${scores}`
    }).join('\n')

    const playbookContext = playbook
      ? `\n\nPLAYBOOK DA EMPRESA:\n${JSON.stringify(playbook, null, 1)}`
      : ''

    const prompt = `Analise as avaliações de conversas WhatsApp do vendedor "${sellerName}".

DADOS:
- Total de conversas avaliadas: ${evaluations.length}
- Média geral: ${avgScore.toFixed(1)}/10
- Critérios avaliados: CTA, Timing, Objetividade, Personalização, Tom Consultivo, Valor Agregado

AVALIAÇÕES:
${evalsContext}
${playbookContext}

Responda APENAS em JSON válido:
{
  "summary": "3-4 frases CURTAS e diretas sobre a performance do vendedor nas conversas WhatsApp. Mencione padrões, pontos fortes e fracos. ${playbook ? 'Considere a aderência ao playbook.' : ''} Máx 60 palavras.",
  "strongest_criteria": "O critério com melhor desempenho (1 palavra)",
  "weakest_criteria": "O critério com pior desempenho (1 palavra)",
  "tip": "1 dica prática e curta para melhorar. Máx 15 palavras."
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: 'Você é um coach de vendas analisando conversas de WhatsApp. Seja conciso e direto.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI failed to generate summary' }, { status: 500 })
    }

    let parsed
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Erro na API seller-whatsapp-summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
