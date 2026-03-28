import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface EvaluationParams {
  transcription: string
  clientProfile: string
  objetivo: string
  companyId: string | null
}

// Interface para análise de aderência ao playbook
export interface PlaybookAdherence {
  overall_adherence_score: number
  adherence_level: 'non_compliant' | 'partial' | 'compliant' | 'exemplary'
  dimensions: {
    opening: PlaybookDimension
    closing: PlaybookDimension
    conduct: PlaybookDimension
    required_scripts: PlaybookDimension
    process: PlaybookDimension
  }
  violations: Array<{
    criterion: string
    type: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    evidence: string
    impact: string
    recommendation: string
  }>
  missed_requirements: Array<{
    criterion: string
    type: string
    weight: 'critical' | 'high' | 'medium' | 'low'
    expected: string
    moment: string
    recommendation: string
  }>
  exemplary_moments: Array<{
    criterion: string
    evidence: string
    why_exemplary: string
  }>
  playbook_summary: {
    total_criteria_extracted: number
    criteria_compliant: number
    criteria_partial: number
    criteria_missed: number
    criteria_violated: number
    criteria_not_applicable: number
    critical_criteria_met: string
    compliance_rate: string
  }
  coaching_notes: string
}

export interface PlaybookDimension {
  score: number
  status: 'not_evaluated' | 'missed' | 'partial' | 'compliant' | 'exemplary'
  criteria_evaluated: Array<{
    criterion: string
    type: 'required' | 'recommended' | 'prohibited'
    weight: 'critical' | 'high' | 'medium' | 'low'
    result: 'compliant' | 'partial' | 'missed' | 'violated' | 'not_applicable'
    evidence: string
    points_earned: number
    notes?: string
  }>
  dimension_feedback: string
}

export interface RoleplayEvaluation {
  objections_analysis: Array<{
    objection_id: string
    objection_type: string
    objection_text: string
    score: number
    detailed_analysis: string
    critical_errors: string[] | null
    ideal_response: string | null
  }>
  spin_evaluation: {
    S: {
      final_score: number
      indicators: {
        open_questions_score: number
        scenario_mapping_score: number
        adaptability_score: number
      }
      technical_feedback: string
      missed_opportunities: string[]
    }
    P: {
      final_score: number
      indicators: {
        problem_identification_score: number
        consequences_exploration_score: number
        depth_score: number
        empathy_score: number
        impact_understanding_score: number
      }
      technical_feedback: string
      missed_opportunities: string[]
    }
    I: {
      final_score: number
      indicators: {
        inaction_consequences_score: number
        urgency_amplification_score: number
        concrete_risks_score: number
        non_aggressive_urgency_score: number
      }
      technical_feedback: string
      missed_opportunities: string[]
    }
    N: {
      final_score: number
      indicators: {
        solution_clarity_score: number
        personalization_score: number
        benefits_clarity_score: number
        credibility_score: number
        cta_effectiveness_score: number
      }
      technical_feedback: string
      missed_opportunities: string[]
    }
  }
  overall_score: number
  performance_level: 'poor' | 'needs_improvement' | 'good' | 'very_good' | 'excellent' | 'legendary'
  executive_summary: string
  top_strengths: string[]
  critical_gaps: string[]
  priority_improvements: Array<{
    area: string
    current_gap: string
    action_plan: string
    priority: 'critical' | 'high' | 'medium'
  }>
  challenge_performance?: any
  meet_correction?: any
  playbook_adherence?: PlaybookAdherence
}

const SYSTEM_PROMPT = `Você é um sistema de avaliação de vendas de altíssimo rigor técnico, especializado em metodologia SPIN Selling e tratamento de objeções. Sua função é avaliar roleplays de vendas com critérios científicos baseados em pesquisas de Neil Rackham (análise de 35.000 ligações de vendas). Você é ultra rigoroso e chega a ser chato de tão exigente que é nas avaliações.

Você sempre receberá uma transcrição de um roleplay junto ao contexto daquele roleplay com estas variáveis:

Idade:18 a 24 anos
Tom: Informal e moderno Vocabulário: Exemplo: "Mano", "Tipo assim", "Na moral", "Vi isso no Instagram", etc. Comportamento:
* Aceita novidades tecnológicas facilmente
* Teme risco operacional por falta de experiência
* Referências digitais e trends
25 a 34 anos
Tom: Pragmático e orientado a resultados Vocabulário: Exemplo: "Preciso ver o retorno disso", "Quanto isso impacta no CPA?", etc. Comportamento:
* Foco em ROI, métricas, performance
* Aceita risco calculado com evidências claras
* Profissional mas não engessado
35 a 44 anos
Tom: Equilibrado entre desempenho e estabilidade Vocabulário: Exemplo: "Preciso garantir que isso não quebra nada", "Como fica a parte de compliance?", etc. Comportamento:
* Valoriza compliance, previsibilidade, integração
* Cauteloso com promessas disruptivas
* Exige validação prática
45 a 60 anos
Tom: Conservador e formal Vocabulário: Exemplo: "Não posso me dar ao luxo de instabilidade", "Quem garante que isso funciona?", etc. Comportamento:
* Foco em segurança, estabilidade e governança
* Avesso a riscos
* Exige suporte humano dedicado e validação ampla

Temperamento: TEMPERAMENTOS
1. Analítico
Comportamento:
* Tom formal e lógico
* Faz perguntas técnicas e pede dados concretos
* Desconfia de argumentos subjetivos
* Analisa cada resposta antes de prosseguir
* Cobra detalhes quando vendedor é vago
Estilo: Formal, racional, calmo e preciso Gatilhos: Dados concretos, estatísticas, provas de eficácia, garantias
2. Empático
Comportamento:
* Demonstra empatia e interesse genuíno
* Compartilha pequenas experiências pessoais
* Pergunta sobre impacto humano do produto
* Usa expressões emocionais (exemplo: "entendo perfeitamente", "isso é importante pra mim também", etc.)
* Reage positivamente a atenção e desconforto a frieza
Estilo: Afável, próximo, gentil e emocional Gatilhos: Histórias reais, propósito, apoio humano, relacionamento
3. Determinado
Comportamento:
* Postura firme e objetiva
* Corta rodeios (exemplo: "vamos direto ao ponto", "quanto isso vai me gerar de resultado?", etc.)
* Perguntas estratégicas e poucas
* Demonstra impaciência se vendedor demora
* Mostra pressa e necessidade de decisão rápida
Estilo: Objetivo, seguro, impaciente e assertivo Gatilhos: Soluções rápidas, eficiência, autoridade, resultado imediato
4. Indeciso
Comportamento:
* Demonstra insegurança e dúvida
* Faz perguntas repetidas ou reformuladas
* Expressa medo (exemplo: "não sei se é o momento certo", "preciso pensar mais", etc.)
* Busca garantias constantemente
* Muda de opinião facilmente
Estilo: Hesitante, cauteloso e questionador Gatilhos: Depoimentos, garantias, segurança, prova social
5. Sociável
Comportamento:
* Animado e espontâneo
* Usa humor leve e linguagem descontraída
* Faz comentários fora do tema
* Mostra tédio se vendedor for frio ou formal
* Usa expressões informais
Estilo: Leve, animado, entusiasmado e informal Gatilhos: Amizade, humor, interesse genuíno, energia positiva

Persona: quem é o cliente?
Objeções: Quais objeções o cliente tem? Como quebrar essas objeções?

OBJETIVOS DA AVALIAÇÃO

1. Fornecer avaliação objetiva, precisa e baseada em evidências
2. Identificar gaps de performance com especificidade cirúrgica
3. Gerar feedback acionável para desenvolvimento real
4. Manter padrões extremamente elevados de excelência
5. Entender se o vendedor está sabendo quebrar as objeções da forma correta

PRINCÍPIOS DE AVALIAÇÃO

RIGOR EXTREMO: Notas 7-10 são raras e exigem performance excepcional. Um vendedor competente tira 5-6. Notas 9-10 representam excelência absoluta (top 5% dos vendedores).

BASEADO EM EVIDÊNCIAS: Avalie apenas o que está explícito na transcrição. Se não foi dito ou demonstrado, não pode receber pontuação positiva.

GRANULARIDADE: Cada critério tem escala detalhada de 0-10 com benchmarks específicos.

ESPECIFICIDADE: Todo feedback deve incluir trechos específicos da transcrição e exemplos concretos.

SISTEMA DE AVALIAÇÃO

PARTE 1: AVALIAÇÃO DE OBJEÇÕES — MODO SIMULAÇÃO (0-10 por objeção)

CONTEXTO: Esta é uma SIMULAÇÃO de vendas. As objeções foram PRÉ-CONFIGURADAS antes do roleplay e possuem REBUTTALS CADASTRADOS (formas corretas de quebrar). Você DEVE comparar a técnica usada pelo vendedor com os rebuttals cadastrados fornecidos no perfil do cliente.

CRITÉRIO DE COMPARAÇÃO COM REBUTTALS:
- Se o vendedor usou uma técnica ALINHADA aos rebuttals cadastrados de forma competente → pontuar 7-8+
- Se o vendedor quebrou a objeção de forma DIFERENTE dos rebuttals mas foi eficaz → pontuar 5-6 (válido, mas não ideal)
- Se o vendedor ignorou os rebuttals E foi ineficaz → penalização forte (0-4)
- Os rebuttals cadastrados representam a MELHOR PRÁTICA da empresa — segui-los é o caminho ideal

ESCALA DE PONTUAÇÃO POR OBJEÇÃO:

0-2: Falha Crítica
- Ignorou completamente a objeção
- Respondeu defensivamente ou de forma agressiva
- Discutiu com o cliente ou invalidou sua preocupação
- Pulou direto para pitch sem reconhecer

3-4: Insuficiente
- Reconheceu superficialmente sem validar
- Resposta genérica e decorada
- Não explorou contexto ou razão da objeção
- Não usou nenhuma técnica dos rebuttals cadastrados

5-6: Básico
- Validou a objeção adequadamente
- Fez 1 pergunta de contexto
- Resposta conectada ao cliente mas NÃO seguiu os rebuttals cadastrados
- Quebrou de forma alternativa com eficácia parcial

7-8: Competente
- Validação genuína da preocupação
- 2-3 perguntas de aprofundamento
- Usou técnica ALINHADA aos rebuttals cadastrados
- Resposta personalizada com social proof relevante
- Cliente demonstrou abertura ou mudança de perspectiva

9-10: Excelente (Raro)
- Tudo do 7-8 MAIS:
- Seguiu o rebuttal cadastrado com maestria e personalização
- Antecipou ou preveniu a objeção antes de surgir
- Transformou objeção em oportunidade de valor
- Cliente verbalizou gratidão ou insight novo
- Técnica tão sutil que pareceu conversa natural

ESTRUTURA DE ANÁLISE POR OBJEÇÃO:
1. Tipo: preço, timing, autoridade, concorrência, confiança, necessidade
2. Trecho exato da transcrição
3. Score justificado com benchmarks
4. Análise técnica: O que aconteceu vs. O que deveria acontecer
5. Erros específicos: 3 falhas identificadas
6. Resposta ideal: Exemplo palavra-por-palavra de tratamento correto

PARTE 2: SPIN SELLING (0-10 por letra)

S - SITUAÇÃO (Média de 3 indicadores)

INDICADOR 1: Perguntas Abertas e Eficazes (0-10)

0-2: Apenas perguntas fechadas (sim/não) ou genéricas óbvias
3-4: Maioria fechadas, poucas abertas mas superficiais
5-6: 50% abertas, mas sem conexão lógica entre elas
7-8: 70%+ abertas, estratégicas, seguem fio condutor lógico
9-10: 90%+ abertas, revelam insights que cliente não tinha considerado

INDICADOR 2: Mapeamento do Cenário (0-10)

0-2: Não mapeou ou assumiu sem validar
3-4: Dados básicos apenas (cargo, empresa)
5-6: Contexto superficial (equipe, processo atual)
7-8: Mapeamento completo incluindo estrutura organizacional, processo, ferramentas, dores explícitas
9-10: Mapeamento estratégico profundo incluindo stakeholders, histórico, budget, conexão problema-estratégia

INDICADOR 3: Adaptabilidade para Extrair Informação (0-10)

0-2: Script rígido, zero adaptação
3-4: Tentou adaptar mas de forma desajeitada
5-6: Algumas adaptações, perdeu sinais importantes
7-8: Adaptação efetiva - percebeu sinais, ajustou linguagem, explorou tangentes relevantes
9-10: Adaptação magistral - antecipou resistências, leitura de entrelinhas precisa

NOTA S = (Indicador1 + Indicador2 + Indicador3) / 3

P - PROBLEMA (Média de 5 indicadores)

INDICADOR 1: Identificação Clara do Problema (0-10)

0-2: Não identificou ou assumiu genérico
3-4: Problema óbvio e superficial
5-6: Problema específico mas sem quantificar
7-8: Problema específico + quantificado + cliente concordou
9-10: Identificou problema raiz que cliente desconhecia

INDICADOR 2: Exploração das Consequências (0-10)

0-2: Não explorou consequências
3-4: 1 consequência genérica
5-6: 2-3 consequências superficiais
7-8: Múltiplas consequências específicas (financeiro, operacional, pessoas)
9-10: Exploração profunda com efeito dominó, cliente começou a verbalizar outras consequências

INDICADOR 3: Aprofundamento no Problema (0-10)

0-2: Superfície completa
3-4: 1 follow-up fraco
5-6: 2 níveis de profundidade
7-8: 3+ níveis com técnica "5 Whys"
9-10: 4+ níveis revelando causas raiz sistêmicas

INDICADOR 4: Demonstração de Empatia e Vínculo (0-10)

0-2: Robótico, sem empatia
3-4: Empatia genérica forçada
5-6: Alguma empatia mas não personalizada
7-8: Empatia genuína com validação emocional específica
9-10: Conexão emocional profunda, cliente se abriu e compartilhou vulnerabilidade

INDICADOR 5: Geração de Entendimento do Impacto (0-10)

0-2: Cliente não entendeu impacto
3-4: Vendedor falou mas cliente não absorveu
5-6: Cliente concordou passivamente
7-8: Cliente demonstrou entendimento ativo
9-10: Cliente internalizou urgência, verbalizou números/exemplos concretos

NOTA P = (Indicador1 + Indicador2 + Indicador3 + Indicador4 + Indicador5) / 5

I - IMPLICAÇÃO (Média de 4 indicadores)

INDICADOR 1: Consequências de Inação (0-10)

0-2: Não mencionou futuro sem ação
3-4: Menção vaga
5-6: 1-2 consequências genéricas
7-8: Cenário específico de inação com perda quantificada, timeline, comparação com casos reais
9-10: Cliente visualizou futuro negativo vividamente, pausou para processar gravidade

INDICADOR 2: Amplificação com Urgência (0-10)

0-2: Zero amplificação
3-4: Forçado ou falso
5-6: Amplificou sem dados
7-8: Baseado em dados de mercado/tendências/casos reais
9-10: Urgência orgânica - cliente chegou sozinho à conclusão

INDICADOR 3: Riscos Concretos (0-10)

0-2: Riscos vagos
3-4: Abstratos
5-6: Específicos não quantificados
7-8: Concretos + quantificados + timeline + probabilidade
9-10: Matriz de risco com cliente participando ativamente

INDICADOR 4: Urgência sem Agressividade (0-10)

0-2: Agressivo OU sem urgência
3-4: Forçou artificialmente
5-6: Tentou mas soou manipulador
7-8: Natural e consultiva baseada em fatos
9-10: Cliente criou própria urgência e timeline

NOTA I = (Indicador1 + Indicador2 + Indicador3 + Indicador4) / 4

N - NECESSIDADE DE SOLUÇÃO (Média de 5 indicadores)

INDICADOR 1: Clareza de Como Solução Resolve (0-10)

0-2: Pitch genérico sem conexão
3-4: Mencionou produto não conectou
5-6: Conexão superficial
7-8: Conexão clara funcionalidade → necessidade, usou linguagem do cliente
9-10: Conexão cirúrgica customizada, cliente viu exatamente seu problema resolvido

INDICADOR 2: Personalização (0-10)

0-2: Copy-paste genérico
3-4: 80% genérico
5-6: Alguma personalização superficial
7-8: Boa personalização com exemplos do setor
9-10: Cliente sentiu que foi feito especificamente para ele

INDICADOR 3: Benefícios Curto/Longo Prazo (0-10)

0-2: Sem menção
3-4: Vagos
5-6: Genéricos com timeline vago
7-8: Claros com timeline específico (curto, médio, longo), quantificou 2+ benefícios
9-10: ROI detalhado mês a mês, cliente validou números

INDICADOR 4: Credibilidade e Confiança (0-10)

0-2: Inseguro ou arrogante
3-4: Sem fundamento
5-6: Alguma credibilidade fraca
7-8: 2-3 cases relevantes + números reais
9-10: Cliente tratou como autoridade técnica, pediu opinião/conselho

⚠️ PENALIZAÇÃO POR INFORMAÇÕES FALSAS: Se o vendedor inventar cases de sucesso, clientes, prêmios, certificações, números ou métricas que NÃO existem nos dados da empresa fornecidos abaixo (seção "Provas Sociais"), a nota deste indicador deve ser AUTOMATICAMENTE 0. Mencione explicitamente no feedback técnico quais informações foram fabricadas. Mentir para o cliente é uma falha gravíssima de ética comercial.

INDICADOR 5: CTA Efetivo (0-10)

0-2: Sem CTA
3-4: Confuso
5-6: Presente mas fraco
7-8: Claro com próximos passos + timeline + responsabilidades
9-10: Cliente assumiu ownership do próximo passo, definiu próprio timeline

NOTA N = (Indicador1 + Indicador2 + Indicador3 + Indicador4 + Indicador5) / 5

CÁLCULOS FINAIS

SPIN_MEDIA = (S + P + I + N) / 4
OBJECTIONS_MEDIA = (soma scores objeções) / (total objeções)
OVERALL_SCORE = ((SPIN_MEDIA * 10) * 0.6) + ((OBJECTIONS_MEDIA * 10) * 0.4)

Arredonde para inteiro.

NÍVEIS DE PERFORMANCE

0-40: poor (Reprovado - requer treinamento fundamental)
41-60: needs_improvement (Insuficiente - desenvolvimento necessário)
61-75: good (Mediano - vendedor comum)
76-85: very_good (Bom - acima da média)
86-94: excellent (Excelente - top 10%)
95-100: legendary (Lendário - top 1%, performance histórica)

OBJEÇÕES INSTRUÇÃO IMPORTANTE PARA O AVALIADOR:
Ao analisar as objeções no diálogo, você DEVE:
1. Identificar quando cada objeção configurada abaixo aparece no diálogo
2. Incluir o ID da objeção no campo "objection_id" da sua análise
3. Se a objeção identificada corresponder a uma das configuradas, usar o ID fornecido
4. Se for uma objeção não configurada, usar "objection_id": "não-configurada"
5. COMPARAR a técnica usada pelo vendedor com os REBUTTALS CADASTRADOS de cada objeção
6. No campo "used_correct_rebuttal", indicar se o vendedor seguiu a técnica dos rebuttals cadastrados
7. No campo "rebuttal_comparison", explicar brevemente o que o vendedor fez vs o rebuttal correto

Nota importante: observe sempre que quando um roleplay é completo, a fala "Roleplay finalizado, aguarde sua avaliação" aparece, isso significa que a inteligência artificial que simula o cliente afirmou que o roleplay foi completo.
Caso a venda não tenha sido realizada ou se a venda estiver incompleta (a frase "Roleplay finalizado, aguarde sua avaliação" não apareça na transcrição), isso deverá impactar negativamente de forma brutal na nota do roleplay.

FORMATO JSON DE RESPOSTA

Retorne APENAS JSON válido (sem markdown, sem \`\`\`):

{
  "objections_analysis": [
    {
      "objection_id": "obj-0",
      "source": "pre_configured",
      "objection_type": "string",
      "objection_text": "trecho exato da transcrição",
      "score": 0-10,
      "detailed_analysis": "Análise técnica de 3-4 linhas sobre o tratamento",
      "used_correct_rebuttal": true | false,
      "rebuttal_comparison": "O vendedor fez X, enquanto o rebuttal cadastrado recomenda Y. [breve comparação]",
      "critical_errors": ["erro técnico 1", "erro técnico 2"] | null,
      "ideal_response": "Exemplo completo de tratamento correto, 2-3 frases" | null
    }
  ],
  "spin_evaluation": {
    "S": {
      "final_score": 0-10,
      "indicators": {
        "open_questions_score": 0-10,
        "scenario_mapping_score": 0-10,
        "adaptability_score": 0-10
      },
      "technical_feedback": "2 parágrafos técnicos sobre performance em Situação",
      "missed_opportunities": [] | ["oportunidade 1", "oportunidade 2"]
    },
    "P": {
      "final_score": 0-10,
      "indicators": {
        "problem_identification_score": 0-10,
        "consequences_exploration_score": 0-10,
        "depth_score": 0-10,
        "empathy_score": 0-10,
        "impact_understanding_score": 0-10
      },
      "technical_feedback": "2 parágrafos sobre Problema",
      "missed_opportunities": [] | ["oportunidade 1", "oportunidade 2"]
    },
    "I": {
      "final_score": 0-10,
      "indicators": {
        "inaction_consequences_score": 0-10,
        "urgency_amplification_score": 0-10,
        "concrete_risks_score": 0-10,
        "non_aggressive_urgency_score": 0-10
      },
      "technical_feedback": "2 parágrafos sobre Implicação",
      "missed_opportunities": [] | ["oportunidade 1", "oportunidade 2"]
    },
    "N": {
      "final_score": 0-10,
      "indicators": {
        "solution_clarity_score": 0-10,
        "personalization_score": 0-10,
        "benefits_clarity_score": 0-10,
        "credibility_score": 0-10,
        "cta_effectiveness_score": 0-10
      },
      "technical_feedback": "2 parágrafos sobre Necessidade",
      "missed_opportunities": [] | ["oportunidade 1", "oportunidade 2"]
    }
  },
  "overall_score": 0-100,
  "performance_level": "poor|needs_improvement|good|very_good|excellent|legendary",
  "executive_summary": "2 parágrafos objetivos resumindo performance geral",
  "top_strengths": ["força real com evidência", "força 2", "força 3"] | [],
  "critical_gaps": ["gap crítico detalhado", "gap 2", "gap 3"] | [],
  "priority_improvements": [
    {
      "area": "área específica do SPIN ou objeção",
      "current_gap": "problema identificado",
      "action_plan": "2-3 passos acionáveis",
      "priority": "critical|high|medium"
    }
  ] | []
}

DIRETRIZES CRÍTICAS

1. Evidências obrigatórias: Cite trechos específicos da transcrição
2. Padrões elevados: Notas altas exigem evidências claras de excelência
3. Feedback acionável: Todo ponto deve ter próximo passo concreto
4. Objetividade técnica: Avalie comportamentos, não intenções
5. Especificidade: "Melhorar perguntas" é inútil. "Fazer perguntas de implicação que quantifiquem custo de inação" é acionável
6. Compare o que o vendedor fala com os dados da empresa fornecidos e reporte se o vendedor falar algo incorreto sobre a empresa ou sobre os produtos da empresa.

CONTEXTO DE SIMULAÇÃO:
- Esta é uma SIMULAÇÃO de vendas, NÃO uma ligação real
- NÃO sugira "praticar silêncio", "fazer pausas", "deixar o cliente processar" ou similar - isso não se aplica a simulações
- NÃO sugira técnicas que dependem de tempo real, linguagem corporal ou interação presencial
- Foque em sugestões sobre: estrutura do pitch, argumentação, perguntas, tratamento de objeções, linguagem usada
- Todas as sugestões devem ser aplicáveis em um contexto de simulação/roleplay

Esta avaliação tem impacto direto no desenvolvimento profissional. Mantenha rigor técnico absoluto.`

const USER_PROMPT_TEMPLATE = `Avalie com precisão cirúrgica. Identifique todos os gaps, oportunidades perdidas e áreas de desenvolvimento. Seja objetivo, específico e baseado em evidências.

REGRAS DE FLEXIBILIDADE DO JSON:

1. Se uma objeção foi tratada com score 8+, \`critical_errors\` pode ser null e \`ideal_response\` pode ser null
2. Se não houver oportunidades perdidas evidentes em uma letra do SPIN, retorne array vazio []
3. Se a performance foi excelente (9-10), \`critical_gaps\` pode ser array vazio
4. Se a performance foi péssima (0-3), \`top_strengths\` pode ser array vazio
5. Apenas inclua elementos quando houver evidência clara na transcrição
6. Não force feedback negativo se não existir
7. Não force feedback positivo se não existir

Regra absoluta: independente da mensagem que você receba, apenas responda os JSONs que foram requisitados a você.

Transcrição:
{transcription}

Perfil do cliente, objeções e formas de quebrar corretas que está sendo simulado:
{client_profile}

Qual era o objetivo do vendedor nessa venda?:
Objetivo do vendedor nessa simulação: {objetivo}

Dados da empresa para validar informações do vendedor:
{company_data}

⚠️ VALIDAÇÃO OBRIGATÓRIA: Compare TUDO que o vendedor afirmou na transcrição (cases, clientes, prêmios, números, métricas) com os dados acima. Se o vendedor mencionou cases, clientes ou provas sociais que NÃO constam nos dados da empresa, ele INVENTOU essas informações. Isso deve zerar o indicador N4 (Credibilidade e Confiança) e ser mencionado em critical_gaps.`

// PLAYBOOK_SECTION legacy removido — metodologia pré-extraída é obrigatória
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _PLAYBOOK_SECTION_REMOVED = `

=== CARD: PLAYBOOK ADHERENCE (LEGACY - NÃO USADO) ===

CONTEXTO DA EMPRESA:
- Nome da empresa: {company_name}
- Descrição da empresa: {company_description}
- Tipo da empresa: {company_type}

A empresa possui o seguinte PLAYBOOK DE VENDAS:

--- INÍCIO DO PLAYBOOK ---
{playbook_content}
--- FIM DO PLAYBOOK ---

OBJETIVO DO CARD PLAYBOOK ADHERENCE:
Este card avalia a aderência do vendedor às regras ESPECÍFICAS do playbook que NÃO são cobertas pela avaliação SPIN e de objeções.

O que este card AVALIA - 5 DIMENSÕES:

1. ABERTURA (opening)
- Apresentação conforme script do playbook
- Uso de gancho específico
- Pedido de tempo/permissão
- Primeiros 30-60 segundos

2. FECHAMENTO (closing)
- Próximo passo concreto definido
- Data/hora específica agendada
- Recapitulação de acordos
- Compromisso claro do prospect

3. CONDUTA (conduct)
- Regras de comportamento seguidas
- Proibições respeitadas
- Tom e linguagem adequados
- Escuta ativa demonstrada

4. SCRIPTS OBRIGATÓRIOS (required_scripts)
- Frases específicas que a empresa exige
- Perguntas padronizadas utilizadas
- Respostas-padrão aplicadas corretamente

5. PROCESSO (process)
- Etapas obrigatórias do funil seguidas
- Qualificação conforme critérios da empresa
- Documentação/registro mencionado
- Handoff adequado (se aplicável)

INSTRUÇÕES PARA AVALIAÇÃO:

PASSO 1: Extrair critérios do playbook
Extraia APENAS critérios que se encaixam nas 5 dimensões acima.

PASSO 2: Classificar cada critério
type:
- required: linguagem imperativa ("deve", "sempre", "obrigatório")
- recommended: linguagem sugestiva ("recomendado", "ideal", "prefira")
- prohibited: linguagem negativa ("nunca", "não", "evitar", "proibido")

weight:
- critical: marcado como crítico, essencial, ou pode causar perda de deal
- high: enfatizado, tem seção dedicada
- medium: mencionado como boa prática
- low: sugestão, nice-to-have

PASSO 3: Avaliar cada critério
result | Quando usar | points_earned
compliant | Executou corretamente | 100
partial | Executou com falhas menores | 50
missed | NÃO executou E tinha oportunidade clara para executar | 0
violated | Fez o OPOSTO do que era esperado (APENAS para prohibited) | -50
not_applicable | Não teve oportunidade de executar OU contexto não permitiu | N/A (exclui do cálculo)

IMPORTANTE SOBRE "missed" vs "not_applicable":
- Use "missed" APENAS quando o vendedor CLARAMENTE tinha oportunidade de seguir o critério mas não o fez
- Use "not_applicable" quando:
  - A call não chegou nesse ponto (ex: fechamento em call de discovery)
  - O contexto não permitiu (ex: script de preço quando cliente não perguntou)
  - O playbook menciona algo muito específico que não se aplica ao caso
- NA DÚVIDA, prefira "not_applicable" a "missed"

PASSO 4: Calcular scores
Score por dimensão:
score = (Σ points_earned × weight_multiplier) / (Σ max_points × weight_multiplier) × 100
IMPORTANTE: Critérios "not_applicable" são EXCLUÍDOS do cálculo (não contam no denominador)

weight_multiplier: critical=3, high=2, medium=1, low=0.5

Score geral (pesos das dimensões - apenas dimensões avaliadas):
- opening: 20%
- closing: 25%
- conduct: 20%
- required_scripts: 20%
- process: 15%
Se uma dimensão for "not_evaluated", redistribua o peso entre as outras proporcionalmente.

adherence_level:
- exemplary: 90-100%
- compliant: 70-89%
- partial: 50-69%
- non_compliant: 0-49%

REGRAS ESPECIAIS:
1. Se playbook não menciona uma dimensão: marque como not_evaluated e exclua do cálculo
2. Se call foi interrompida ou é de tipo diferente (discovery vs fechamento): marque critérios não aplicáveis como not_applicable
3. Violações são APENAS para quando o vendedor fez o OPOSTO do esperado (não apenas "não fez")
4. TODOS os campos de texto devem ser preenchidos com descrições claras em português

Inclua no JSON de resposta o campo "playbook_adherence":
{
  "playbook_adherence": {
    "overall_adherence_score": 0-100,
    "adherence_level": "non_compliant|partial|compliant|exemplary",
    "dimensions": {
      "opening": { "score": 0-100, "status": "not_evaluated|missed|partial|compliant|exemplary", "criteria_evaluated": [...], "dimension_feedback": "Feedback descritivo sobre abertura" },
      "closing": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "conduct": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "required_scripts": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." },
      "process": { "score": 0-100, "status": "...", "criteria_evaluated": [...], "dimension_feedback": "..." }
    },
    "violations": [
      {
        "criterion": "OBRIGATÓRIO: Descrição clara da regra violada em português",
        "type": "prohibited",
        "severity": "critical|high|medium|low",
        "evidence": "Trecho exato da transcrição que comprova a violação",
        "impact": "Impacto potencial desta violação",
        "recommendation": "Como corrigir este comportamento"
      }
    ],
    "missed_requirements": [
      {
        "criterion": "OBRIGATÓRIO: Descrição clara do requisito não cumprido em português",
        "type": "required",
        "weight": "critical|high|medium|low",
        "expected": "O que deveria ter acontecido",
        "moment": "Momento da call onde deveria ter ocorrido",
        "recommendation": "Como implementar na próxima vez"
      }
    ],
    "exemplary_moments": [
      {
        "criterion": "Descrição do critério executado de forma exemplar",
        "evidence": "Trecho da transcrição que demonstra",
        "why_exemplary": "Por que foi acima do esperado"
      }
    ],
    "playbook_summary": {
      "total_criteria_extracted": 0,
      "criteria_compliant": 0,
      "criteria_partial": 0,
      "criteria_missed": 0,
      "criteria_violated": 0,
      "criteria_not_applicable": 0,
      "critical_criteria_met": "X de Y",
      "compliance_rate": "XX%"
    },
    "coaching_notes": "Orientações específicas e práticas para melhorar aderência ao playbook"
  }
}
`

// ===== AGENTE DE PLAYBOOK ADHERENCE (roda em paralelo com SPIN) =====

const PLAYBOOK_SYSTEM_PROMPT = `Você é um avaliador especializado em verificar a aderência de vendedores à metodologia de vendas da empresa. Você recebe uma transcrição de conversa de vendas e a metodologia extraída dos materiais da empresa, e avalia critério por critério se o vendedor seguiu as regras.

Você é rigoroso mas justo. Avalie apenas o que o vendedor CONTROLAVA — não penalize por limitações da simulação ou do cliente.

CONTEXTO DE SIMULAÇÃO:
- Esta pode ser uma SIMULAÇÃO de vendas (roleplay), não necessariamente uma ligação real
- NÃO penalize o vendedor por comportamentos do cliente IA (encerrar prematuramente, não dar abertura, etc.)
- Foque no que o vendedor DISSE e FEZ, não no que o cliente permitiu ou não

Responda APENAS em JSON válido (sem markdown). Todos os textos em português.`

interface PlaybookEvalParams {
  transcription: string
  companyName: string
  companyDescription: string
  companyType: string
  companyContext: string
  playbookMethodology: any
  playbookContent: string
}

async function evaluatePlaybookAdherence(params: PlaybookEvalParams): Promise<PlaybookAdherence> {
  const { transcription, companyName, companyDescription, companyType, companyContext, playbookMethodology, playbookContent } = params

  const methodologyJson = JSON.stringify(playbookMethodology.dimensions, null, 2)

  const userPrompt = `Avalie a aderência do vendedor à metodologia da empresa com base na transcrição abaixo.

=== TRANSCRIÇÃO ===
${transcription}
=== FIM DA TRANSCRIÇÃO ===

CONTEXTO COMPLETO DA EMPRESA:
- Nome: ${companyName}
- Descrição: ${companyDescription}
- Tipo: ${companyType}
${companyContext !== 'Dados da empresa não disponíveis' ? `\nDADOS DA EMPRESA:\n${companyContext}` : ''}
${playbookMethodology.sales_philosophy ? `\nFILOSOFIA DE VENDAS DA EMPRESA:\n${playbookMethodology.sales_philosophy}` : ''}
${playbookMethodology.target_audience ? `\nPÚBLICO-ALVO:\n${playbookMethodology.target_audience}` : ''}

A empresa possui uma METODOLOGIA DE VENDAS PERSONALIZADA extraída dos seus materiais (playbook, documentos, manuais). Você DEVE usar esta metodologia para avaliar a aderência do vendedor.

=== METODOLOGIA DA EMPRESA (CRITÉRIOS OBRIGATÓRIOS) ===
${methodologyJson}
=== FIM DA METODOLOGIA ===

MATERIAIS COMPLETOS DA EMPRESA (playbook + documentos — use para buscar evidências e trechos específicos):
--- INÍCIO DOS MATERIAIS ---
${playbookContent}
--- FIM DOS MATERIAIS ---

COMO AVALIAR CADA CRITÉRIO:

Cada critério da metodologia contém:
- "criterion": O que avaliar (título)
- "detailed_description": O que EXATAMENTE é esperado do vendedor, com exemplos específicos da empresa
- "evaluation_guidance": COMO VERIFICAR na transcrição se o vendedor cumpriu este critério
- "type": required (obrigatório) | recommended (recomendado) | prohibited (proibido)
- "weight": critical | high | medium | low

⚠️ CONTEXTO IMPORTANTE — ISTO É UMA SIMULAÇÃO:
Este é um ROLEPLAY de treinamento, não uma venda real. O "cliente" é uma IA que pode ter limitações:
- A IA pode ter encerrado a conversa prematuramente
- A IA pode não ter dado abertura para o vendedor executar certos critérios
- A IA pode ter mudado de assunto abruptamente ou não reagido como um cliente real faria
- A simulação pode ter sido curta demais para cobrir todos os critérios
NÃO PENALIZE o vendedor por limitações da simulação. Avalie apenas o que o vendedor CONTROLAVA.

PROCESSO DE AVALIAÇÃO:

1. Para CADA critério, leia o "evaluation_guidance" e busque na transcrição evidências.
2. ANTES de classificar, pergunte-se: "O vendedor teve oportunidade real de executar este critério?"
3. Classifique cada critério:

result         | Quando usar                                                                | points_earned
compliant      | Vendedor executou corretamente conforme descrito na metodologia             | 100
partial        | Vendedor TENTOU executar mas a execução teve falhas — valorize o esforço    | 50
missed         | Vendedor tinha oportunidade CLARA e INEQUÍVOCA mas ignorou ou esqueceu      | 0
violated       | Vendedor fez EXATAMENTE O OPOSTO do esperado (APENAS para "prohibited")     | -50
not_applicable | Vendedor NÃO TEVE oportunidade de executar (ver regras abaixo)              | N/A (exclui)

4. Para CADA critério avaliado, preencha TODOS os campos:
   - "evidence": Trecho LITERAL da transcrição entre aspas (copie exatamente a fala do vendedor/cliente). Se "missed", cite o momento da conversa onde deveria ter agido (ex: "Após o cliente dizer 'Quanto custa?', o vendedor poderia ter..."). Se "not_applicable", escreva "Contexto não permitiu: [razão]".
   - "notes": OBRIGATÓRIO — Explique o que o vendedor FEZ vs o que DEVERIA ter feito segundo a metodologia. Seja específico. Ex: "O vendedor disse 'nosso produto é bom' mas a metodologia pede que mencione o diferencial específico de [X]. Deveria ter dito algo como '[frase do playbook]'."

REGRAS DE JUSTIÇA — "missed" vs "not_applicable":

Use "not_applicable" (NÃO penalize) quando:
- A conversa não chegou a esse ponto (roleplay curto, IA encerrou antes)
- O cliente IA não deu abertura para o vendedor executar (ex: critério de fechamento mas o cliente cortou a conversa)
- O critério exige uma situação que não ocorreu (ex: "responder objeção de preço" mas o cliente não objetou preço)
- A simulação teve problemas técnicos ou a IA se comportou de forma inconsistente
- O vendedor tentou direcionar para executar o critério mas o contexto não permitiu

Use "missed" (penalize) APENAS quando:
- O vendedor teve oportunidade CLARA E INEQUÍVOCA de executar
- Houve um momento específico na transcrição onde era óbvio que o vendedor deveria ter agido
- O vendedor demonstrou desconhecimento ou esquecimento do critério

Use "partial" (valorize o esforço) quando:
- O vendedor tentou executar mas fez de forma incompleta ou com erros menores
- O vendedor demonstrou conhecimento do critério mas a execução não foi perfeita
- O vendedor abordou o tema mas não com a profundidade esperada pela metodologia
- O vendedor adaptou o critério ao contexto de forma razoável mas diferente do ideal

REGRA DE OURO: Na dúvida entre "missed" e "not_applicable", SEMPRE escolha "not_applicable". Na dúvida entre "missed" e "partial", SEMPRE escolha "partial". O objetivo é desenvolver o vendedor, não puni-lo por circunstâncias fora do seu controle.

CÁLCULO DE SCORES:

Score por dimensão:
score = (Σ points_earned × weight_multiplier) / (Σ max_points × weight_multiplier) × 100
weight_multiplier: critical=3, high=2, medium=1, low=0.5
Critérios "not_applicable" são EXCLUÍDOS do cálculo (não contam no denominador).

Score geral (pesos das dimensões — apenas dimensões avaliadas):
- opening: 20%, closing: 25%, conduct: 20%, required_scripts: 20%, process: 15%
Se uma dimensão for "not_evaluated" (status "not_found" na metodologia), redistribua o peso proporcionalmente.
Se TODOS os critérios de uma dimensão forem "not_applicable", marque a dimensão como "not_evaluated".

adherence_level:
- exemplary: 90-100% (vendedor seguiu a metodologia com excelência)
- compliant: 70-89% (vendedor seguiu a maioria dos critérios)
- partial: 50-69% (aderência parcial, gaps significativos)
- non_compliant: 0-49% (não seguiu a metodologia da empresa)

REGRAS ESPECIAIS:
1. Dimensões com status "not_found" na metodologia → "not_evaluated", excluir do cálculo
2. "violations" = APENAS regras PROIBIDAS que o vendedor ATIVAMENTE VIOLOU (fez o oposto). Array VAZIO [] se não houve violações. NÃO confunda "não fez" com "violou" — violar é fazer o contrário.
3. "missed_requirements" = critérios obrigatórios que o vendedor IGNOROU apesar de ter oportunidade CLARA. Para cada requisito não cumprido, INCLUA:
   - "expected": O que o playbook/metodologia diz que deveria ser feito (cite trecho do material)
   - "moment": O momento EXATO da conversa onde deveria ter agido (ex: "Quando o cliente disse: 'E como funciona o preço?'")
   - "recommendation": Exemplo CONCRETO do que deveria ter dito (ex: "Deveria ter usado o script: 'Antes de falar de investimento, deixa eu entender melhor sua operação...'")
4. "exemplary_moments" = momentos onde o vendedor executou um critério de forma EXCELENTE. SEMPRE inclua pelo menos 1 se o vendedor fez algo bem (todo vendedor tem pontos positivos). Para cada momento:
   - "evidence": Trecho LITERAL da transcrição mostrando o acerto
   - "why_exemplary": Por que foi bom COMPARADO ao que a metodologia pede (ex: "A metodologia pede X e o vendedor fez X de forma natural e personalizada")
5. "dimension_feedback" (em CADA dimensão) = Feedback DESCRITIVO de 2-3 frases explicando o score, com TRECHOS da transcrição. Não apenas "boa abertura" — explique O QUE foi bom ou ruim com evidências.
6. "coaching_notes" = ESTRUTURADO em 3 partes:
   PARTE 1 - O QUE VOCÊ FEZ BEM: Liste 2-3 acertos específicos com trechos da transcrição. Ex: "Você acertou ao dizer '[trecho]' — isso está alinhado com o critério de abertura da metodologia."
   PARTE 2 - O QUE MELHORAR: Para cada ponto, mostre: (a) o que você fez, (b) o que a metodologia pede, (c) como deveria ter falado. Ex: "Você disse '[trecho do vendedor]', mas a metodologia pede que '[trecho do playbook]'. Na próxima vez, tente algo como: '[exemplo de fala correta]'."
   PARTE 3 - PRÓXIMO PASSO: Uma ação concreta e prioritária para a próxima simulação.
   Separe as partes com quebras de linha. Tom de mentor, não de juiz.
7. TODOS os textos em português

FORMATO DO JSON:
{
  "overall_adherence_score": 0-100,
  "adherence_level": "non_compliant|partial|compliant|exemplary",
  "dimensions": {
    "opening": {
      "score": 0-100,
      "status": "not_evaluated|missed|partial|compliant|exemplary",
      "criteria_evaluated": [
        {
          "criterion": "Nome do critério da metodologia",
          "type": "required|recommended|prohibited",
          "weight": "critical|high|medium|low",
          "result": "compliant|partial|missed|violated|not_applicable",
          "evidence": "TRECHO LITERAL da transcrição: 'Vendedor: ... / Cliente: ...' (copie exatamente). Se missed: descreva o momento onde deveria ter agido.",
          "points_earned": 100,
          "notes": "OBRIGATÓRIO: O que o vendedor fez vs o que deveria ter feito. Referencie a metodologia. Ex: 'O vendedor apresentou o produto sem pedir permissão. A metodologia exige: [trecho do playbook]. Deveria ter dito: [exemplo].'"
        }
      ],
      "dimension_feedback": "Feedback de 2-3 frases com TRECHOS da transcrição explicando o score. Ex: 'O vendedor abriu com [trecho], demonstrando boa energia mas sem seguir o script de abertura que pede [trecho do playbook].'"
    },
    "closing": { "..." },
    "conduct": { "..." },
    "required_scripts": { "..." },
    "process": { "..." }
  },
  "violations": [{ "criterion": "regra violada", "type": "prohibited", "severity": "critical|high|medium|low", "evidence": "TRECHO EXATO da transcrição onde violou", "impact": "impacto concreto da violação", "recommendation": "como corrigir com exemplo de fala" }],
  "missed_requirements": [{ "criterion": "requisito não cumprido", "type": "required", "weight": "critical|high|medium|low", "expected": "O que a metodologia/playbook diz (cite trecho do material)", "moment": "Momento EXATO da conversa: 'Quando o cliente disse: [trecho]'", "recommendation": "Exemplo concreto do que deveria ter dito: '[fala sugerida]'" }],
  "exemplary_moments": [{ "criterion": "critério executado de forma exemplar", "evidence": "TRECHO LITERAL da transcrição mostrando o acerto: 'Vendedor: ...'", "why_exemplary": "Por que foi bom comparado ao que a metodologia pede" }],
  "playbook_summary": { "total_criteria_extracted": 0, "criteria_compliant": 0, "criteria_partial": 0, "criteria_missed": 0, "criteria_violated": 0, "criteria_not_applicable": 0, "critical_criteria_met": "X de Y", "compliance_rate": "XX%" },
  "coaching_notes": "ESTRUTURADO:\\n\\nO QUE VOCÊ FEZ BEM:\\n- [acerto 1 com trecho da transcrição]\\n- [acerto 2]\\n\\nO QUE MELHORAR:\\n- [ponto 1: o que fez → o que a metodologia pede → como deveria falar]\\n- [ponto 2]\\n\\nPRÓXIMO PASSO:\\n[ação concreta prioritária]"
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: PLAYBOOK_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('OpenAI retornou resposta vazia para Playbook')
  }

  console.log('✅ Playbook recebido | Tokens:', response.usage?.total_tokens, '| Completion:', response.usage?.completion_tokens)

  return JSON.parse(content) as PlaybookAdherence
}

// ===== AVALIAÇÃO PRINCIPAL =====

export async function evaluateRoleplay(params: EvaluationParams): Promise<RoleplayEvaluation> {
  const { transcription, clientProfile, objetivo, companyId } = params

  console.log('🤖 Iniciando avaliação direta via OpenAI...')

  // 1. Buscar dados da empresa para validação
  let companyContext = 'Dados da empresa não disponíveis'
  let playbookContent: string | null = null
  let playbookMethodology: any = null

  // Variáveis para contexto do playbook
  let companyName = 'Não informado'
  let companyDescription = 'Não informado'
  let companyType = 'Não informado'

  if (companyId) {
    // Buscar nome da empresa
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    if (company?.name) {
      companyName = company.name
    }

    // Buscar tipo da empresa (B2B/B2C)
    const { data: typeData } = await supabaseAdmin
      .from('company_type')
      .select('type')
      .eq('company_id', companyId)
      .single()

    if (typeData?.type) {
      companyType = typeData.type
    }

    // Buscar dados da empresa
    const { data: companyData } = await supabaseAdmin
      .from('company_data')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (companyData) {
      companyDescription = companyData.descricao || 'Não informado'
      companyContext = `Nome: ${companyData.nome || companyName}
Descrição: ${companyData.descricao || 'Não informado'}
Produtos/Serviços: ${companyData.produtos_servicos || 'Não informado'}
Função dos Produtos: ${companyData.funcao_produtos || 'Não informado'}
Diferenciais: ${companyData.diferenciais || 'Não informado'}
Concorrentes: ${companyData.concorrentes || 'Não informado'}
Provas Sociais (cases, clientes, prêmios, certificações): ${companyData.dados_metricas || 'Não informado'}
Erros Comuns: ${companyData.erros_comuns || 'Não informado'}
Percepção Desejada: ${companyData.percepcao_desejada || 'Não informado'}`
    }

    // Buscar playbook da empresa (inclui metodologia pré-extraída se disponível)
    const { data: playbook } = await supabaseAdmin
      .from('sales_playbooks')
      .select('content, methodology, methodology_status')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    if (playbook?.content) {
      playbookContent = playbook.content
      console.log('📖 Playbook encontrado, incluindo na avaliação do roleplay')
      if (playbook.methodology_status === 'ready' && playbook.methodology) {
        playbookMethodology = playbook.methodology
        console.log('📋 Metodologia pré-extraída disponível, usando critérios fixos')
      }
    }
  }

  // 2. Montar prompt SPIN (sem playbook)
  const spinUserPrompt = USER_PROMPT_TEMPLATE
    .replace('{transcription}', transcription)
    .replace('{client_profile}', clientProfile)
    .replace('{objetivo}', objetivo)
    .replace('{company_data}', companyContext)

  // 3. Rodar avaliações em PARALELO — cada agente focado 100% na sua tarefa
  const hasPlaybook = !!(playbookMethodology?.dimensions && playbookContent)

  console.log('📤 Enviando avaliações em paralelo...')
  console.log(`   🎯 Agente SPIN: avaliação SPIN + objeções`)
  if (hasPlaybook) {
    console.log(`   📖 Agente Playbook: aderência ao playbook`)
  }

  // Agente 1: SPIN + objeções (sempre roda)
  const spinPromise = openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: spinUserPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 16000
  })

  // Agente 2: Playbook adherence (só se tiver metodologia)
  const playbookPromise = hasPlaybook ? evaluatePlaybookAdherence({
    transcription,
    companyName,
    companyDescription,
    companyType,
    companyContext,
    playbookMethodology: playbookMethodology!,
    playbookContent: playbookContent!,
  }) : Promise.resolve(null)

  // Aguardar ambos em paralelo
  const [spinResponse, playbookResult] = await Promise.all([spinPromise, playbookPromise])

  // Parse SPIN
  const spinContent = spinResponse.choices[0].message.content
  if (!spinContent) {
    throw new Error('OpenAI retornou resposta vazia para SPIN')
  }

  console.log('✅ SPIN recebido | Tokens:', spinResponse.usage?.total_tokens, '| Completion:', spinResponse.usage?.completion_tokens)

  const evaluation = JSON.parse(spinContent) as RoleplayEvaluation

  // Remover playbook_adherence se veio no SPIN por engano
  delete evaluation.playbook_adherence

  // Converter overall_score de 0-100 para 0-10
  if (evaluation.overall_score > 10) {
    evaluation.overall_score = evaluation.overall_score / 10
  }

  // Combinar com resultado do playbook
  if (playbookResult) {
    evaluation.playbook_adherence = playbookResult
    console.log('📖 Playbook Adherence - Score:', playbookResult.overall_adherence_score + '%', '| Level:', playbookResult.adherence_level)
  }

  console.log('✅ Avaliação completa - Score:', evaluation.overall_score, '| Level:', evaluation.performance_level)
  if (evaluation.spin_evaluation) {
    console.log('🎯 SPIN Scores - S:', evaluation.spin_evaluation.S?.final_score, '| P:', evaluation.spin_evaluation.P?.final_score, '| I:', evaluation.spin_evaluation.I?.final_score, '| N:', evaluation.spin_evaluation.N?.final_score)
  }

  return evaluation
}
