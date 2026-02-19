import { NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome da Empresa',
  descricao: 'Descrição',
  produtos_servicos: 'Produtos/Serviços',
  funcao_produtos: 'Função dos Produtos',
  diferenciais: 'Diferenciais',
  concorrentes: 'Concorrentes',
  dados_metricas: 'Provas Sociais',
  erros_comuns: 'Erros Comuns',
  percepcao_desejada: 'Percepção Desejada',
  dores_resolvidas: 'Dores que Resolve'
}

const SYSTEM_PROMPT = `Você é um consultor de negócios amigável que ajuda a preencher dados de empresas para um sistema de treinamento de vendas com IA.

SEU OBJETIVO: Através de uma conversa natural, coletar informações sobre a empresa do usuário e propor valores para os campos do formulário.

CAMPOS DO FORMULÁRIO (e o que cada um significa):
1. nome — Nome oficial da empresa
2. descricao — O que a empresa faz, de forma objetiva e concisa
3. produtos_servicos — Lista dos principais produtos ou serviços oferecidos
4. funcao_produtos — O que cada produto/serviço faz NA PRÁTICA para o cliente
5. diferenciais — O que diferencia a empresa dos concorrentes (coisas específicas e verificáveis)
6. concorrentes — Nomes de concorrentes diretos (só se o usuário mencionar)
7. dados_metricas — Provas sociais: números, cases, prêmios, certificações, depoimentos
8. erros_comuns — Erros que vendedores cometem ao vender (informações incorretas, objeções mal tratadas)
9. percepcao_desejada — Como a empresa quer ser percebida pelo mercado
10. dores_resolvidas — Problemas específicos que a empresa resolve para seus clientes

REGRAS DE CONVERSA:
- Seja amigável, direto e profissional
- Faça perguntas abertas que incentivem o usuário a falar sobre a empresa
- NÃO pergunte campo por campo como um formulário — seja natural e conversacional
- Extraia informações de múltiplos campos a partir de uma única resposta quando possível
- Proponha valores concisos e bem escritos (o usuário pode personalizar depois)
- Se o usuário der uma resposta vaga, peça mais detalhes específicos
- Se o usuário não souber algo (ex: concorrentes), aceite e siga em frente
- Adapte o tom ao tipo de negócio (B2B é mais técnico, B2C mais acessível)

REGRAS DE PROPOSALS:
- Proponha apenas campos que você tem informação suficiente para preencher
- Não proponha campos que já foram aceitos pelo usuário (veja currentFields)
- Proponha 1 a 3 campos por vez (não sobrecarregue)
- Se já coletou informação suficiente para todos os campos vazios, faça as últimas propostas
- Quando todos os campos estiverem preenchidos, parabenize e sugira salvar

FORMATO DE RESPOSTA (JSON válido):
{
  "message": "Texto da sua mensagem conversacional aqui",
  "proposals": [
    { "field": "nome_do_campo", "label": "Label do Campo", "value": "Valor proposto" }
  ]
}

Se não tiver propostas naquela rodada, retorne proposals como array vazio [].
A mensagem NUNCA deve mencionar o formato JSON ou os nomes técnicos dos campos.
Use os labels amigáveis ao se referir aos campos na conversa.`

export async function POST(req: Request) {
  try {
    const { messages, currentFields, businessType } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Mensagens são obrigatórias' },
        { status: 400 }
      )
    }

    // Montar contexto dos campos já preenchidos
    const filledFields = Object.entries(currentFields || {})
      .filter(([, value]) => value && (value as string).trim() !== '')
      .map(([key, value]) => `- ${FIELD_LABELS[key] || key}: "${value}"`)

    const emptyFields = Object.entries(currentFields || {})
      .filter(([, value]) => !value || (value as string).trim() === '')
      .map(([key]) => `- ${FIELD_LABELS[key] || key}`)

    const contextMessage = `
CONTEXTO ATUAL:
- Tipo de negócio: ${businessType || 'Não definido'}
- Campos já preenchidos (${filledFields.length}/10):
${filledFields.length > 0 ? filledFields.join('\n') : '  Nenhum'}
- Campos ainda vazios (${emptyFields.length}):
${emptyFields.length > 0 ? emptyFields.join('\n') : '  Todos preenchidos!'}

NÃO proponha campos que já estão preenchidos. Foque nos vazios.`

    // Construir array de mensagens para OpenAI
    const openaiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT + '\n\n' + contextMessage },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ]

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: openaiMessages,
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      })
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('Erro OpenAI ai-chat:', errorText)
      return NextResponse.json(
        { error: 'Erro ao processar com IA' },
        { status: 500 }
      )
    }

    const data = await openaiResponse.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    // Validar e sanitizar proposals
    const proposals = (parsed.proposals || [])
      .filter((p: { field: string; value: string }) =>
        p.field && p.value && FIELD_LABELS[p.field]
      )
      .map((p: { field: string; value: string }) => ({
        field: p.field,
        label: FIELD_LABELS[p.field],
        value: p.value.trim()
      }))

    return NextResponse.json({
      message: parsed.message || '',
      proposals
    })

  } catch (error) {
    console.error('Erro ai-chat:', error)
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 }
    )
  }
}
