import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface ChallengeContext {
  is_challenge: boolean
  target_letter: string // S, P, I, or N
  target_score: number
  target_weakness: string
  difficulty_level: number
  coaching_tips: string[]
  challenge_title: string
}

interface ChallengePerformance {
  is_challenge: boolean
  target_letter: string
  target_score: number
  achieved_score: number
  goal_achieved: boolean
  score_gap: number
  coaching_tips_applied: string[]
  coaching_tips_missed: string[]
  target_letter_deep_analysis: string
  key_moments: Array<{
    moment: string
    what_happened: string
    what_should_have_done: string
    suggested_phrase: string
  }>
  challenge_feedback: string
}

/**
 * Evaluates challenge-specific performance using OpenAI
 * This runs AFTER the regular N8N evaluation to add challenge-specific feedback
 */
export async function evaluateChallengePerformance(
  transcription: string,
  evaluation: any,
  challengeContext: ChallengeContext
): Promise<ChallengePerformance> {
  const { target_letter, target_score, coaching_tips, challenge_title, difficulty_level } = challengeContext

  // Get the achieved score from the regular evaluation
  const spinEvaluation = evaluation?.spin_evaluation || {}
  const achievedScore = spinEvaluation[target_letter]?.final_score ?? 0
  const goalAchieved = achievedScore >= target_score

  const letterNames: Record<string, string> = {
    'S': 'Situação',
    'P': 'Problema',
    'I': 'Implicação',
    'N': 'Necessidade'
  }

  const systemPrompt = `Você é um coach de vendas especialista em metodologia SPIN Selling.

Sua tarefa é analisar o desempenho de um vendedor em um DESAFIO DIÁRIO focado especificamente na letra "${target_letter}" (${letterNames[target_letter]}) do SPIN.

CONTEXTO DO DESAFIO:
- Título: ${challenge_title}
- Foco: Letra ${target_letter} (${letterNames[target_letter]})
- Meta: Score mínimo de ${target_score}
- Score Alcançado: ${achievedScore.toFixed(1)}
- Meta ${goalAchieved ? 'ALCANÇADA ✓' : 'NÃO alcançada ✗'}
- Dificuldade: ${difficulty_level}/5

DICAS DE COACHING que foram dadas ao vendedor ANTES do roleplay:
${coaching_tips.length > 0 ? coaching_tips.map((tip, i) => `${i + 1}. ${tip}`).join('\n') : 'Nenhuma dica específica foi fornecida.'}

AVALIAÇÃO SPIN COMPLETA:
- Situação (S): ${spinEvaluation.S?.final_score?.toFixed(1) || 'N/A'}
- Problema (P): ${spinEvaluation.P?.final_score?.toFixed(1) || 'N/A'}
- Implicação (I): ${spinEvaluation.I?.final_score?.toFixed(1) || 'N/A'}
- Necessidade (N): ${spinEvaluation.N?.final_score?.toFixed(1) || 'N/A'}

FEEDBACK TÉCNICO DA LETRA ALVO (${target_letter}):
${spinEvaluation[target_letter]?.technical_feedback || 'Não disponível'}

OPORTUNIDADES PERDIDAS (${target_letter}):
${spinEvaluation[target_letter]?.missed_opportunities?.join('\n- ') || 'Nenhuma identificada'}

Analise a transcrição e forneça:

1. **coaching_tips_applied**: Quais das dicas de coaching acima o vendedor APLICOU durante o roleplay? Liste apenas as que foram claramente utilizadas.

2. **coaching_tips_missed**: Quais das dicas de coaching acima o vendedor NÃO APLICOU ou ignorou? Liste apenas as que poderiam ter sido usadas mas não foram.

3. **target_letter_deep_analysis**: Análise DETALHADA de 3-4 parágrafos focando ESPECIFICAMENTE na letra ${target_letter} (${letterNames[target_letter]}). Inclua:
   - O que o vendedor fez bem nessa área
   - Onde específicamente ele poderia melhorar
   - Exemplos concretos do diálogo
   - Como isso impactou a conversa

4. **key_moments**: 1-3 momentos-chave do diálogo onde o vendedor poderia ter aplicado melhor a técnica de ${letterNames[target_letter]}. Para cada momento:
   - moment: Descrição breve do momento
   - what_happened: O que o vendedor fez
   - what_should_have_done: O que deveria ter feito
   - suggested_phrase: Uma frase alternativa que poderia usar

5. **challenge_feedback**: Feedback motivacional de 2-3 frases sobre o desempenho no desafio. ${goalAchieved ? 'Parabenize pela meta alcançada e sugira próximos passos.' : 'Seja encorajador mas honesto sobre o que precisa melhorar.'}

Responda APENAS com JSON válido, sem markdown ou texto adicional.`

  const userPrompt = `TRANSCRIÇÃO DO ROLEPLAY:
${transcription}

Analise o desempenho do vendedor no desafio focado em ${letterNames[target_letter]} e retorne o JSON com a avaliação.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }

    const parsed = JSON.parse(content)

    // Build the final challenge_performance object
    const challengePerformance: ChallengePerformance = {
      is_challenge: true,
      target_letter,
      target_score,
      achieved_score: achievedScore,
      goal_achieved: goalAchieved,
      score_gap: achievedScore - target_score,
      coaching_tips_applied: parsed.coaching_tips_applied || [],
      coaching_tips_missed: parsed.coaching_tips_missed || [],
      target_letter_deep_analysis: parsed.target_letter_deep_analysis || '',
      key_moments: parsed.key_moments || [],
      challenge_feedback: parsed.challenge_feedback || ''
    }

    console.log('✅ Challenge performance evaluated:', {
      target_letter,
      achieved_score: achievedScore,
      goal_achieved: goalAchieved,
      tips_applied: challengePerformance.coaching_tips_applied.length,
      tips_missed: challengePerformance.coaching_tips_missed.length,
      key_moments: challengePerformance.key_moments.length
    })

    return challengePerformance

  } catch (error) {
    console.error('❌ Error evaluating challenge performance:', error)

    // Return a minimal fallback response
    return {
      is_challenge: true,
      target_letter,
      target_score,
      achieved_score: achievedScore,
      goal_achieved: goalAchieved,
      score_gap: achievedScore - target_score,
      coaching_tips_applied: [],
      coaching_tips_missed: coaching_tips,
      target_letter_deep_analysis: 'Não foi possível gerar uma análise detalhada neste momento.',
      key_moments: [],
      challenge_feedback: goalAchieved
        ? 'Parabéns! Você alcançou a meta do desafio. Continue praticando para consolidar essa habilidade.'
        : 'Você está no caminho certo! Continue praticando para alcançar a meta na próxima tentativa.'
    }
  }
}
