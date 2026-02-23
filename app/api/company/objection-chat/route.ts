import { NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const APPROACH_LABELS: Record<string, string> = {
  emocional: 'Emocional',
  logica: 'Lógica/ROI',
  social: 'Social',
  tecnica: 'Técnica',
  estrategica: 'Estratégica',
}

const ALL_APPROACHES = ['emocional', 'logica', 'social', 'tecnica', 'estrategica']

const SYSTEM_PROMPT = `Voce e o "Consultor de Objecoes" da Ramppy — um agente especialista em vendas, contorno de objecoes e SPIN Selling.

Seu papel e ajudar gestores a criar objecoes de clientes de ALTA QUALIDADE com formas de quebra (rebuttals) variadas e praticas, atraves de uma conversa natural e guiada.

O objetivo e que cada objecao criada aqui atinja nota >= 7.0 (APROVADA) no avaliador automatico de qualidade.

CRITERIOS DE QUALIDADE DO AVALIADOR (sua meta e atingir APROVADA em tudo):

PARA A OBJECAO (peso 50%):

1. CLAREZA (0-10):
   - 0-3: Vaga demais ("cliente nao quer", "acha caro")
   - 4-6: Descreve a objecao mas falta o motivo por tras
   - 7-8: Clara, com o motivo/receio do cliente
   - 9-10: Perfeita - objecao + motivo + contexto essencial (sem excessos)
   IMPORTANTE: Objecoes muito longas (mais de 4 linhas) perdem pontos em Clareza.
   Objecoes muito curtas (menos de 10 palavras) perdem em Utilidade.

2. UTILIDADE (0-10):
   - 0-3: Impossivel criar estrategia a partir dela
   - 4-6: Da pra imaginar algumas respostas
   - 7-8: Permite criar respostas especificas
   - 9-10: Tao clara que ja direciona as melhores abordagens

PARA AS FORMAS DE QUEBRAR (peso 50%):

3. QUANTIDADE E VARIEDADE (0-10):
   - 0-3: Menos de 2 formas ou todas iguais
   - 7-8: 3-4 formas com abordagens distintas
   - 9-10: 4+ formas cobrindo diferentes angulos

4. PRATICIDADE (0-10):
   - 0-3: Respostas genericas ("mostrar valor", "explicar melhor")
   - 7-8: Especificas e aplicaveis
   - 9-10: Prontas para usar, com tecnica clara

5. COMPLETUDE (0-10):
   - 0-3: Frases soltas de uma linha
   - 7-8: Bem elaboradas e acionaveis
   - 9-10: Completas com tecnica + como executar

ANGULOS OBRIGATORIOS PARA REBUTTALS (cada rebuttal deve cobrir UM destes):
1. EMOCIONAL: Empatia, validacao do sentimento, mostrar que entende a preocupacao
2. LOGICA/ROI: Numeros, dados, retorno sobre investimento, comparacoes objetivas
3. SOCIAL: Cases de sucesso, depoimentos, exemplos de outros clientes
4. TECNICA: Como o produto/servico funciona, diferenciais tecnicos, funcionalidades
5. ESTRATEGICA: Pergunta que faz o cliente refletir, inversao de perspectiva

REGRAS DE CONVERSA:

- Seja amigavel, direto, encorajador e profissional
- Mensagens CURTAS — maximo 2-3 frases. Nao enrole. Va direto ao ponto.
- Faca perguntas abertas para entender o cenario da objecao
- NAO pergunte como formulario — seja natural e conversacional
- Use os DADOS DA EMPRESA para contextualizar rebuttals com informacoes reais do produto/servico
- Quando pedir informacoes, formate como topicos usando "• " (bullet point)
- SEMPRE proponha textos de alta qualidade — ricos, especificos, prontos para uso

REGRAS DE PROPOSALS:

- FASE 1 (objecao ainda nao aceita): Proponha EXATAMENTE 1 objecao por resposta
  - A objecao deve ter o motivo/receio do cliente + contexto (2-4 linhas ideal)
  - NAO proponha rebuttal enquanto a objecao nao foi aceita
  - Se o CONTEXTO ATUAL mostra que a objecao ja foi ACEITA, PULE esta fase — va direto para FASE 1.5
- FASE 1.5 (objecao aceita, ANTES de propor rebuttals): Pergunte de forma CURTA e DIRETA quantas formas de quebra o usuario quer (ex: "Quantas formas de quebra quer criar? Recomendo entre 3 e 5.")
  - Maximo 1-2 frases. NAO explique os angulos nem de contexto longo.
  - NAO proponha nenhum rebuttal ate o usuario responder quantos quer
- FASE 2 (quantidade definida, construindo rebuttals):
  - PRIMEIRO: Pergunte ao usuario como ele costuma quebrar/contornar essa objecao. Ex: "Como voce costuma responder quando o cliente diz isso?" ou "O que voce fala para contornar essa objecao?"
  - ESPERE a resposta do usuario. NAO proponha rebuttal ainda. Envie proposal: null.
  - DEPOIS que o usuario responder, REFINE a resposta dele em um rebuttal de alta qualidade, mantendo a essencia do que ele disse mas melhorando a estrutura, tecnica e impacto.
  - Cada rebuttal deve cobrir um ANGULO diferente dos ja aceitos
  - Indique qual angulo esta cobrindo (approach) — escolha o angulo que mais se encaixa na resposta do usuario
  - Se o usuario nao souber responder ou pedir ajuda, AI pode sugerir um rebuttal do zero
  - Quando atingir a quantidade solicitada pelo usuario, parabenize e diga que a objecao pode ser salva

FORMATO DE RESPOSTA (JSON valido):

{
  "message": "Texto da sua mensagem conversacional aqui",
  "proposal": {
    "type": "objection" | "rebuttal",
    "value": "Texto proposto",
    "approach": "emocional" | "logica" | "social" | "tecnica" | "estrategica" | null
  }
}

Se nao tiver proposta naquela rodada, retorne "proposal": null.
O campo "approach" so e usado quando type = "rebuttal". Para type = "objection", envie approach = null.
A mensagem NUNCA deve mencionar o formato JSON, os nomes tecnicos, ou o sistema de avaliacao/notas.`

export async function POST(req: Request) {
  try {
    const { messages, currentObjection, currentRebuttals, companyContext } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Mensagens são obrigatórias' }, { status: 400 })
    }

    // Build context of current state
    const rebuttals = currentRebuttals || []
    const usedApproaches = rebuttals.map((_: string, i: number) => {
      // Try to detect approach from history — this is approximate
      return null
    })

    // Format company context
    let companyContextStr = 'Nenhum dado da empresa disponivel.'
    if (companyContext) {
      const entries = Object.entries(companyContext)
        .filter(([, v]) => v && (v as string).trim())
        .map(([k, v]) => `${k}: ${v}`)
      if (entries.length > 0) companyContextStr = entries.join('\n')
    }

    const contextMessage = `
CONTEXTO ATUAL:
- Objeção: ${currentObjection ? `ACEITA — "${currentObjection}"` : 'Ainda não definida'}
- Rebuttals aceitos: ${rebuttals.length}
${rebuttals.length > 0 ? rebuttals.map((r: string, i: number) => `  ${i + 1}. "${r.substring(0, 100)}..."`).join('\n') : '  Nenhum ainda'}

DADOS DA EMPRESA (use como contexto para criar rebuttals relevantes ao produto/serviço real):
${companyContextStr}

${currentObjection
  ? rebuttals.length === 0
    ? 'IMPORTANTE: Objeção ACEITA. NÃO proponha outra. Vá para FASE 1.5: pergunte quantas formas de quebra (curto e direto).'
    : 'Objeção ACEITA. Continue propondo rebuttals com ângulos diferentes dos já aceitos.'
  : 'Ainda não há objeção definida. Converse com o usuário para entender o cenário e propor uma objeção de qualidade.'}`

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
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('Erro OpenAI objection-chat:', errorText)
      return NextResponse.json({ error: 'Erro ao processar com IA' }, { status: 500 })
    }

    const data = await openaiResponse.json()
    const parsed = JSON.parse(data.choices[0].message.content)

    // Validate proposal
    let proposal = null
    if (parsed.proposal && parsed.proposal.type && parsed.proposal.value) {
      proposal = {
        type: parsed.proposal.type as 'objection' | 'rebuttal',
        value: parsed.proposal.value.trim(),
        approach: parsed.proposal.approach || null
      }

      // Validate approach for rebuttals
      if (proposal.type === 'rebuttal' && proposal.approach) {
        if (!ALL_APPROACHES.includes(proposal.approach)) {
          proposal.approach = null
        }
      }
    }

    return NextResponse.json({
      message: parsed.message || '',
      proposal
    })

  } catch (error) {
    console.error('Erro objection-chat:', error)
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 }
    )
  }
}
