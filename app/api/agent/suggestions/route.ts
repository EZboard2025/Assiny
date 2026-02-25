import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function POST(req: NextRequest) {
  try {
    const { screenshot } = await req.json()

    if (!screenshot || typeof screenshot !== 'string' || !screenshot.startsWith('data:image')) {
      return NextResponse.json({ suggestions: [] })
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Você é a Nicole, assistente pessoal de vendas da plataforma Ramppy (treinamento com SPIN Selling). Olhe para esta tela e gere exatamente 3 perguntas curtas e úteis (máximo 5-6 palavras cada) que o usuário provavelmente gostaria de te perguntar sobre o que está vendo na tela. As perguntas devem ser contextuais e específicas ao conteúdo visível. Responda APENAS com JSON no formato: {"suggestions": ["Pergunta 1?", "Pergunta 2?", "Pergunta 3?"]}'
          },
          { type: 'image_url', image_url: { url: screenshot, detail: 'low' } }
        ]
      }],
    })

    const content = response.choices[0]?.message?.content || ''

    // Parse JSON from response (may be wrapped in markdown code block)
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(jsonStr)

    const suggestions = Array.isArray(parsed)
      ? parsed.slice(0, 3)
      : (parsed.suggestions || parsed.questions || []).slice(0, 3)

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('Suggestions error:', err)
    return NextResponse.json({ suggestions: [] })
  }
}
