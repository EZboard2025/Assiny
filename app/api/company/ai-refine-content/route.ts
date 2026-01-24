import { NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const REFINE_PROMPTS = {
  objections: `Você é um especialista em vendas B2B/B2C e objeções de clientes.

Você recebeu uma lista de objeções previamente geradas e agora precisa REFINÁ-LAS com base no feedback do usuário.

REGRAS:
- Mantenha o formato original (name + rebuttals)
- Aplique TODAS as alterações solicitadas pelo usuário
- Se o usuário pedir para adicionar mais objeções, adicione
- Se pedir para remover ou modificar específicas, faça isso
- Se pedir para mudar o tom, estilo ou foco, aplique em todas
- Mantenha entre 5 e 10 objeções no total

FORMATO DE RESPOSTA (JSON):
{
  "objections": [
    {
      "name": "A objeção em si",
      "rebuttals": ["Forma de quebrar 1", "Forma de quebrar 2", "Forma de quebrar 3"]
    }
  ]
}

Retorne APENAS o JSON válido.`,

  personas: `Você é um especialista em criação de personas para treinamento de vendas.

Você recebeu uma lista de personas previamente geradas e agora precisa REFINÁ-LAS com base no feedback do usuário.

REGRAS:
- Mantenha o formato original (tipo, cargo, tipo_empresa_faturamento, contexto, busca, dores, conhecimento_previo)
- Aplique TODAS as alterações solicitadas pelo usuário
- Se o usuário pedir para adicionar mais personas, adicione
- Se pedir para remover ou modificar específicas, faça isso
- Se pedir para mudar o perfil, nicho ou características, aplique
- Mantenha entre 4 e 8 personas no total
- SEMPRE inclua todos os campos para cada persona

FORMATO DE RESPOSTA (JSON):
{
  "personas": [
    {
      "tipo": "B2B ou B2C",
      "cargo": "Cargo/Profissão",
      "tipo_empresa_faturamento": "Tipo de empresa ou situação",
      "contexto": "Contexto atual",
      "busca": "O que busca",
      "dores": "Principais dores",
      "conhecimento_previo": "O que já sabe sobre a empresa"
    }
  ]
}

Retorne APENAS o JSON válido.`,

  objectives: `Você é um especialista em treinamento de vendas.

Você recebeu uma lista de objetivos de roleplay previamente gerados e agora precisa REFINÁ-LOS com base no feedback do usuário.

REGRAS:
- Mantenha o formato original (name + description)
- Aplique TODAS as alterações solicitadas pelo usuário
- Se o usuário pedir para adicionar mais objetivos, adicione
- Se pedir para remover ou modificar específicos, faça isso
- Se pedir para mudar o foco ou nível de dificuldade, aplique
- Mantenha entre 5 e 10 objetivos no total

FORMATO DE RESPOSTA (JSON):
{
  "objectives": [
    {
      "name": "Nome do objetivo",
      "description": "Descrição detalhada do que praticar"
    }
  ]
}

Retorne APENAS o JSON válido.`
}

export async function POST(req: Request) {
  try {
    const { contentType, currentContent, feedback } = await req.json()

    // Validar parâmetros
    if (!contentType || !['objections', 'personas', 'objectives'].includes(contentType)) {
      return NextResponse.json(
        { error: 'Tipo de conteúdo inválido' },
        { status: 400 }
      )
    }

    if (!currentContent) {
      return NextResponse.json(
        { error: 'Conteúdo atual é obrigatório' },
        { status: 400 }
      )
    }

    if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 3) {
      return NextResponse.json(
        { error: 'Feedback é obrigatório (mínimo 3 caracteres)' },
        { status: 400 }
      )
    }

    console.log(`🔄 Refinando ${contentType} com feedback:`, feedback)

    const userPrompt = `CONTEÚDO ATUAL:
${JSON.stringify(currentContent, null, 2)}

FEEDBACK DO USUÁRIO (APLIQUE ESTAS ALTERAÇÕES):
"${feedback}"

Refine o conteúdo acima aplicando as alterações solicitadas pelo usuário.`

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: REFINE_PROMPTS[contentType as keyof typeof REFINE_PROMPTS] },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: 'json_object' }
        })
      })

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text()
        console.error('❌ Erro OpenAI:', errorText)
        throw new Error('Erro ao processar com IA')
      }

      const openaiData = await openaiResponse.json()
      const refinedContent = JSON.parse(openaiData.choices[0].message.content)

      console.log(`✅ ${contentType} refinado com sucesso!`)

      return NextResponse.json({
        success: true,
        contentType,
        data: refinedContent
      })

    } catch (aiError) {
      console.error('❌ Erro no refinamento com IA:', aiError)
      return NextResponse.json(
        { error: 'Erro ao refinar conteúdo com IA' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('💥 Erro geral:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
