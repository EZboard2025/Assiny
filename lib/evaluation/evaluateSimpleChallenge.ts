import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface SimpleChallengeEvaluation {
  overall_score: number
  performance_level: 'poor' | 'needs_improvement' | 'good' | 'very_good' | 'excellent' | 'legendary'
  executive_summary: string
  criteria_scores: {
    need_identification: number
    value_creation: number
    objection_handling: number
    closing_skills: number
    communication: number
  }
  top_strengths: string[]
  areas_to_improve: string[]
  key_moments: Array<{
    moment: string
    analysis: string
    suggestion: string
  }>
  coaching_feedback: string
}

const SYSTEM_PROMPT = `Você é um avaliador especializado em técnicas de vendas, focado em avaliar simulações do tipo "Venda uma Caneta" ou desafios similares de vendas rápidas.

Sua função é avaliar a performance do vendedor com base em critérios práticos de vendas.

CRITÉRIOS DE AVALIAÇÃO (0-10 cada):

1. IDENTIFICAÇÃO DE NECESSIDADES (need_identification)
0-3: Não tentou descobrir necessidades do cliente
4-6: Fez perguntas básicas mas não aprofundou
7-8: Identificou necessidades específicas do cliente
9-10: Descobriu necessidades que o próprio cliente não sabia que tinha

2. CRIAÇÃO DE VALOR (value_creation)
0-3: Focou apenas em características do produto
4-6: Mencionou alguns benefícios genéricos
7-8: Conectou benefícios às necessidades do cliente
9-10: Criou valor único e personalizado

3. TRATAMENTO DE OBJEÇÕES (objection_handling)
0-3: Ignorou ou reagiu mal às objeções
4-6: Respondeu de forma genérica
7-8: Tratou objeções com técnica adequada
9-10: Transformou objeções em oportunidades

4. HABILIDADE DE FECHAMENTO (closing_skills)
0-3: Não tentou fechar ou foi agressivo demais
4-6: Tentou fechar sem preparação adequada
7-8: Usou técnica de fechamento apropriada
9-10: Fechamento natural e confiante

5. COMUNICAÇÃO (communication)
0-3: Comunicação confusa ou inadequada
4-6: Comunicação básica mas funcional
7-8: Clara, persuasiva e adaptada ao cliente
9-10: Excepcional, criou conexão genuína

CÁLCULO DO SCORE GERAL:
OVERALL_SCORE = (need_identification + value_creation + objection_handling + closing_skills + communication) / 5

Arredonde para uma casa decimal.

NÍVEIS DE PERFORMANCE:
0-4: poor
4.1-5.9: needs_improvement
6-7: good
7.1-8: very_good
8.1-9: excellent
9.1-10: legendary

FORMATO DE RESPOSTA (JSON):
{
  "overall_score": número de 0-10,
  "performance_level": "poor|needs_improvement|good|very_good|excellent|legendary",
  "executive_summary": "2-3 parágrafos resumindo a performance",
  "criteria_scores": {
    "need_identification": 0-10,
    "value_creation": 0-10,
    "objection_handling": 0-10,
    "closing_skills": 0-10,
    "communication": 0-10
  },
  "top_strengths": ["força 1", "força 2"],
  "areas_to_improve": ["área 1", "área 2"],
  "key_moments": [
    {
      "moment": "descrição do momento",
      "analysis": "o que aconteceu",
      "suggestion": "o que poderia ser melhor"
    }
  ],
  "coaching_feedback": "Feedback motivacional e construtivo de 2-3 frases"
}

Seja objetivo e forneça feedback acionável.`

const USER_PROMPT_TEMPLATE = `Avalie a seguinte transcrição de um desafio de vendas:

TRANSCRIÇÃO:
{transcription}

Analise a performance do vendedor e retorne a avaliação no formato JSON especificado.`

export async function evaluateSimpleChallenge(transcription: string): Promise<SimpleChallengeEvaluation> {
  console.log('🎯 Iniciando avaliação de desafio simples via OpenAI...')

  const userPrompt = USER_PROMPT_TEMPLATE.replace('{transcription}', transcription)

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5
  })

  const content = response.choices[0].message.content

  if (!content) {
    throw new Error('OpenAI retornou resposta vazia')
  }

  console.log('✅ Avaliação de desafio simples concluída')

  const evaluation = JSON.parse(content) as SimpleChallengeEvaluation

  return evaluation
}
