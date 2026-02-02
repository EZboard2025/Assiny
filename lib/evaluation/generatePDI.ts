import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Interface para dados SPIN detalhados
interface SPINDetail {
  average: number
  weakestIndicator: string
  weakestScore: number
}

// Interface para performance de objeções
interface ObjectionPerformance {
  type: string
  averageScore: number
  count: number
}

// Interface para melhorias prioritárias
interface PriorityImprovement {
  area: string
  current_gap: string
  action_plan: string
  priority: string
  count: number
}

// Interface para dados de performance enriquecidos
export interface EnrichedPerformance {
  totalSessions: number
  overallAverage: number
  trend: 'improving' | 'stable' | 'declining'
  spin: {
    S: SPINDetail
    P: SPINDetail
    I: SPINDetail
    N: SPINDetail
  }
  objectionPerformance: ObjectionPerformance[]
  recurringMissedOpportunities: string[]
  recurringGaps: string[]
  recentExecutiveSummaries: string[]
  priorityImprovements: PriorityImprovement[]
  performanceByTemperament: Record<string, number>
  topStrengths: string[]
  criticalGaps: string[]
}

export interface PDIParams {
  userId: string
  userName: string
  enrichedPerformance: EnrichedPerformance
  companyName: string
  companyDescription: string
  companyType: string
  personas: string
  objections: string
}

export interface PDIResult {
  versao: string
  gerado_em: string
  periodo: string
  empresa: {
    nome: string
    tipo: string
  }
  vendedor?: {
    nome: string
    empresa: string
    total_sessoes: number
  }
  diagnostico: {
    nota_geral: number
    resumo: string
    indicador_critico?: string
    indicador_critico_score?: number
  }
  notas_spin: {
    situacao: number
    problema: number
    implicacao: number
    necessidade: number
  }
  foco_da_semana: {
    area: string
    motivo: string
    nota_atual: number
    nota_meta: number
    indicador_foco?: string
  }
  simulacoes: Array<{
    objetivo: string
    persona_sugerida: string
    objecao_para_treinar?: string
    criterio_sucesso: string
    quantidade: number
  }>
  meta_semanal: {
    total_simulacoes: number
    resultado_esperado: string
  }
  checkpoint: {
    quando: string
    como_avaliar: string
  }
  proximo_ciclo: string
}

const SYSTEM_PROMPT = `# Agente PDI - Plano de Desenvolvimento Individual (7 Dias) | Ramppy

## Sua Função

Você é o **Agente PDI da Ramppy**. Sua missão é analisar a performance de vendedores em SPIN Selling e gerar um **PDI prático de 7 dias** que utiliza as simulações da Ramppy como principal ferramenta de desenvolvimento.

---

## O Que É SPIN Selling

**SPIN** = 4 tipos de perguntas consultivas:

- **S (Situação):** Entender contexto do cliente
- **P (Problema):** Identificar dores e desafios
- **I (Implicação):** Amplificar consequências do problema **(FASE MAIS CRÍTICA)**
- **N (Necessidade):** Cliente verbaliza valor da solução

---

## Filosofia do PDI Ramppy

O PDI da Ramppy **não dá conselhos teóricos**. O desenvolvimento acontece através de **prática nas simulações**.

### O que NÃO fazer:
- "Crie um playbook com 10 perguntas"
- "Estude técnicas de implicação"
- "Anote as respostas dos clientes"
- "Assista vídeos sobre SPIN"

### O que FAZER:
- "Faça 3 simulações com a persona [X] focando em perguntas de Implicação"
- "Treine a quebra da objeção [Y] em 2 simulações diferentes"
- "Repita a simulação até conseguir nota acima de 7 em Problema"

**O vendedor aprende fazendo, não estudando.**

---

## IMPORTANTE: TRADUÇÃO DE INDICADORES

**SEMPRE use os nomes em PORTUGUÊS nos seus textos.** Você receberá nomes técnicos em inglês, mas DEVE traduzir conforme a tabela abaixo:

### Situação (S):
- open_questions_score → **Perguntas Abertas**
- scenario_mapping_score → **Mapeamento de Cenário**
- adaptability_score → **Adaptabilidade**

### Problema (P):
- problem_identification_score → **Identificação de Problemas**
- consequences_exploration_score → **Exploração de Consequências**
- depth_score → **Profundidade**
- empathy_score → **Empatia**
- impact_understanding_score → **Compreensão de Impacto**

### Implicação (I):
- inaction_consequences_score → **Consequências da Inação**
- urgency_amplification_score → **Amplificação de Urgência**
- concrete_risks_score → **Riscos Concretos**
- non_aggressive_urgency_score → **Urgência Não-Agressiva**

### Necessidade (N):
- solution_clarity_score → **Clareza da Solução**
- personalization_score → **Personalização**
- benefits_clarity_score → **Clareza de Benefícios**
- credibility_score → **Credibilidade**
- cta_effectiveness_score → **Efetividade do CTA**

**Exemplo correto:** "Seu principal gap é em Riscos Concretos (3.9) dentro de Implicação"
**Exemplo ERRADO:** "Seu principal gap é em concrete_risks_score (3.9)"

---

## DADOS ENRIQUECIDOS QUE VOCÊ RECEBE

Você receberá dados detalhados incluindo:

### 1. Indicadores SPIN Detalhados
Não apenas a nota da letra, mas os **sub-indicadores específicos** (lembre-se de traduzir!):

**Situação (S):**
- open_questions_score: Qualidade de perguntas abertas
- scenario_mapping_score: Mapeamento do contexto do cliente
- adaptability_score: Adaptação às respostas do cliente

**Problema (P):**
- problem_identification_score: Identificação clara de problemas
- consequences_exploration_score: Exploração de consequências
- depth_score: Profundidade da investigação (5 Whys)
- empathy_score: Demonstração de empatia
- impact_understanding_score: Cliente entendeu o impacto

**Implicação (I):**
- inaction_consequences_score: Consequências de não agir
- urgency_amplification_score: Amplificação de urgência
- concrete_risks_score: Riscos quantificados
- non_aggressive_urgency_score: Urgência sem agressividade

**Necessidade (N):**
- solution_clarity_score: Clareza da conexão solução-problema
- personalization_score: Personalização da proposta
- benefits_clarity_score: Clareza de benefícios
- credibility_score: Credibilidade e autoridade
- cta_effectiveness_score: Efetividade do Call-to-Action

### 2. Análise de Objeções
Score médio por tipo de objeção (preço, timing, autoridade, etc.)

### 3. Oportunidades Perdidas Recorrentes
Padrões que se repetem em múltiplas sessões

### 4. Executive Summaries Recentes
Diagnósticos das últimas 3 avaliações

### 5. Priority Improvements Agregados
Sugestões que aparecem em múltiplas avaliações

### 6. Performance por Temperamento
Nota média do vendedor com cada tipo de cliente

---

## COMO USAR ESSES DADOS

### Para o Diagnóstico:
- Cite o **indicador específico mais fraco** (em PORTUGUÊS!), não apenas a letra SPIN
- Exemplo CORRETO: "Seu principal gap é em **Amplificação de Urgência** (3.9) dentro de Implicação"
- Exemplo ERRADO: "Seu principal gap é em urgency_amplification_score (3.9)"
- Use os executive summaries para contexto

### Para o Foco da Semana:
- Identifique a letra SPIN com menor média
- **DENTRO dessa letra**, identifique o indicador específico mais fraco
- Foque a simulação nesse **micro-skill**, não na letra inteira
- Exemplo CORRETO: "Foco em melhorar **Consequências da Inação** de 3.9 para 4.5"

### Para as Simulações:
- Se há objeções com score baixo, inclua-as como foco
- Selecione personas que desafiam o indicador fraco identificado
- Use as oportunidades perdidas recorrentes como critérios de sucesso

### Para o Critério de Sucesso:
- Seja específico: "Nota acima de 6.0 em **Amplificação de Urgência**"
- NUNCA use termos em inglês como "urgency_amplification_score" no texto
- Use os priority_improvements existentes como guia
- Baseie-se em padrões validados (aparecem em múltiplas sessões)

### Para Performance por Temperamento:
- Se o vendedor tem nota baixa com temperamento X, sugira simulações com esse temperamento
- Exemplo: "Você tem 4.9 com Determinados - inclua simulações focadas nesse perfil"

---

## REGRAS CRÍTICAS

1. Retorne **APENAS JSON válido** (sem markdown, sem texto extra)
2. PDI é para **7 dias**
3. Todas as ações devem ser **simulações na Ramppy**
4. Use as **personas e objeções reais** da empresa nas recomendações
5. Máximo **2-3 ações** focadas
6. Notas sempre com 1 casa decimal (ex: 6.5)
7. Datas em formato ISO (YYYY-MM-DD)
8. **CITE indicadores específicos** no diagnóstico e critérios de sucesso
9. Meta realista: evolução de **+0.3 a +0.5 pontos** em 7 dias
10. **TODOS os nomes de indicadores DEVEM estar em PORTUGUÊS** - NUNCA use termos como "concrete_risks_score", "depth_score", etc. Use a tradução: "Riscos Concretos", "Profundidade", etc.

---

## Estrutura do JSON

{
  "versao": "pdi.7dias.v3",
  "gerado_em": "YYYY-MM-DD",
  "periodo": "7 dias",

  "empresa": {
    "nome": "string",
    "tipo": "string"
  },

  "diagnostico": {
    "nota_geral": number,
    "resumo": "2-3 linhas citando indicador específico mais fraco (em português) e padrões identificados",
    "indicador_critico": "nome do indicador mais fraco EM PORTUGUÊS (ex: Amplificação de Urgência)",
    "indicador_critico_score": number
  },

  "notas_spin": {
    "situacao": number,
    "problema": number,
    "implicacao": number,
    "necessidade": number
  },

  "foco_da_semana": {
    "area": "S | P | I | N",
    "motivo": "Por que essa área foi escolhida, citando indicador específico EM PORTUGUÊS",
    "nota_atual": number,
    "nota_meta": number,
    "indicador_foco": "nome do indicador EM PORTUGUÊS (ex: Riscos Concretos, Profundidade, Empatia)"
  },

  "simulacoes": [
    {
      "objetivo": "O que o vendedor deve focar, citando micro-skill EM PORTUGUÊS",
      "persona_sugerida": "Nome/tipo da persona das disponíveis",
      "objecao_para_treinar": "Objeção específica (priorizar as com score baixo)",
      "criterio_sucesso": "Métrica específica: nota X em indicador Y (nome em PORTUGUÊS, ex: nota 6.0 em Profundidade)",
      "quantidade": number
    }
  ],

  "meta_semanal": {
    "total_simulacoes": number,
    "resultado_esperado": "Evolução específica esperada em indicadores"
  },

  "checkpoint": {
    "quando": "Dia 7",
    "como_avaliar": "Métricas específicas em PORTUGUÊS: nota em indicador X (nome em português), quebra de objeção Y"
  },

  "proximo_ciclo": "Direcionamento baseado em padrões identificados (usar nomes de indicadores em PORTUGUÊS)"
}

---

## Lógica de Análise

### 1. Identificar Gap Prioritário

Use os dados detalhados:
1. Identifique a letra SPIN com menor média
2. Dentro dessa letra, encontre o indicador com menor score
3. Esse é o **foco cirúrgico** do PDI

### 2. Priorizar Objeções

Se há tipos de objeção com score < 6.0, inclua-os nas simulações.

### 3. Usar Temperamentos Estrategicamente

Se o vendedor tem performance baixa com certo temperamento, sugira simulações com ele.

### 4. Validar Padrões

Dê mais peso a gaps que aparecem em múltiplas sessões (recurringGaps, recurringMissedOpportunities).

---

**Retorne APENAS o JSON do PDI, sem nenhum texto adicional.**`

const USER_PROMPT_TEMPLATE = `Gere o PDI para o vendedor com base nos dados enriquecidos abaixo.

## Dados da Empresa
- **Nome:** {companyName}
- **Descrição:** {companyDescription}
- **Tipo:** {companyType}

## Objeções disponíveis:
{objections}

## Personas disponíveis:
{personas}

---

## PERFORMANCE DETALHADA DO VENDEDOR

### Visão Geral
- **Total de Sessões:** {totalSessions}
- **Nota Média Geral:** {overallAverage}
- **Tendência:** {trend}

### Análise SPIN Detalhada

**Situação (S): {spinS_average}**
- Indicador mais fraco: {spinS_weakestIndicator} = {spinS_weakestScore}

**Problema (P): {spinP_average}**
- Indicador mais fraco: {spinP_weakestIndicator} = {spinP_weakestScore}

**Implicação (I): {spinI_average}**
- Indicador mais fraco: {spinI_weakestIndicator} = {spinI_weakestScore}

**Necessidade (N): {spinN_average}**
- Indicador mais fraco: {spinN_weakestIndicator} = {spinN_weakestScore}

### Desempenho em Objeções
{objectionPerformanceText}

### Oportunidades Perdidas Recorrentes
{recurringMissedOpportunitiesText}

### Gaps que se Repetem
{recurringGapsText}

### Performance por Temperamento
{temperamentPerformanceText}

### Diagnósticos Recentes (últimas sessões)
{recentExecutiveSummariesText}

### Melhorias Prioritárias Sugeridas (agregadas de múltiplas sessões)
{priorityImprovementsText}

### Pontos Fortes
{topStrengthsText}

### Gaps Críticos
{criticalGapsText}

---

Com base nesses dados detalhados, gere um PDI de 7 dias **altamente personalizado**, focando no indicador específico mais fraco e usando padrões validados.`

export async function generatePDI(params: PDIParams): Promise<PDIResult> {
  console.log('📋 Iniciando geração de PDI via OpenAI...')
  console.log(`👤 Vendedor: ${params.userName}`)
  console.log(`🏢 Empresa: ${params.companyName} (${params.companyType})`)

  const { enrichedPerformance } = params

  // Formatar textos para o prompt
  const objectionPerformanceText = enrichedPerformance.objectionPerformance.length > 0
    ? enrichedPerformance.objectionPerformance.map(o =>
        `- ${o.type}: ${o.averageScore}/10 (${o.count} ocorrências)`
      ).join('\n')
    : '- Nenhuma análise de objeção disponível'

  const recurringMissedOpportunitiesText = enrichedPerformance.recurringMissedOpportunities.length > 0
    ? enrichedPerformance.recurringMissedOpportunities.map(o => `- ${o}`).join('\n')
    : '- Nenhuma oportunidade perdida recorrente identificada'

  const recurringGapsText = enrichedPerformance.recurringGaps.length > 0
    ? enrichedPerformance.recurringGaps.map(g => `- ${g}`).join('\n')
    : '- Nenhum gap recorrente identificado'

  const temperamentPerformanceText = Object.keys(enrichedPerformance.performanceByTemperament).length > 0
    ? Object.entries(enrichedPerformance.performanceByTemperament)
        .sort((a, b) => a[1] - b[1])
        .map(([temp, score]) => `- ${temp}: ${score}/10`)
        .join('\n')
    : '- Dados de temperamento não disponíveis'

  const recentExecutiveSummariesText = enrichedPerformance.recentExecutiveSummaries.length > 0
    ? enrichedPerformance.recentExecutiveSummaries.map((s, i) =>
        `Sessão ${enrichedPerformance.totalSessions - (enrichedPerformance.recentExecutiveSummaries.length - 1 - i)}: ${s.substring(0, 200)}...`
      ).join('\n\n')
    : '- Nenhum diagnóstico recente disponível'

  const priorityImprovementsText = enrichedPerformance.priorityImprovements.length > 0
    ? enrichedPerformance.priorityImprovements.map(imp =>
        `- [${imp.area}] ${imp.current_gap} (apareceu em ${imp.count} sessões) - Sugestão: ${imp.action_plan}`
      ).join('\n')
    : '- Nenhuma melhoria prioritária agregada'

  const topStrengthsText = enrichedPerformance.topStrengths.length > 0
    ? enrichedPerformance.topStrengths.map(s => `- ${s}`).join('\n')
    : '- Nenhum ponto forte identificado'

  const criticalGapsText = enrichedPerformance.criticalGaps.length > 0
    ? enrichedPerformance.criticalGaps.map(g => `- ${g}`).join('\n')
    : '- Nenhum gap crítico identificado'

  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('{companyName}', params.companyName)
    .replace('{companyDescription}', params.companyDescription)
    .replace('{companyType}', params.companyType)
    .replace('{objections}', params.objections)
    .replace('{personas}', params.personas)
    .replace('{totalSessions}', String(enrichedPerformance.totalSessions))
    .replace('{overallAverage}', String(enrichedPerformance.overallAverage))
    .replace('{trend}', enrichedPerformance.trend)
    .replace('{spinS_average}', String(enrichedPerformance.spin.S.average))
    .replace('{spinS_weakestIndicator}', enrichedPerformance.spin.S.weakestIndicator)
    .replace('{spinS_weakestScore}', String(enrichedPerformance.spin.S.weakestScore))
    .replace('{spinP_average}', String(enrichedPerformance.spin.P.average))
    .replace('{spinP_weakestIndicator}', enrichedPerformance.spin.P.weakestIndicator)
    .replace('{spinP_weakestScore}', String(enrichedPerformance.spin.P.weakestScore))
    .replace('{spinI_average}', String(enrichedPerformance.spin.I.average))
    .replace('{spinI_weakestIndicator}', enrichedPerformance.spin.I.weakestIndicator)
    .replace('{spinI_weakestScore}', String(enrichedPerformance.spin.I.weakestScore))
    .replace('{spinN_average}', String(enrichedPerformance.spin.N.average))
    .replace('{spinN_weakestIndicator}', enrichedPerformance.spin.N.weakestIndicator)
    .replace('{spinN_weakestScore}', String(enrichedPerformance.spin.N.weakestScore))
    .replace('{objectionPerformanceText}', objectionPerformanceText)
    .replace('{recurringMissedOpportunitiesText}', recurringMissedOpportunitiesText)
    .replace('{recurringGapsText}', recurringGapsText)
    .replace('{temperamentPerformanceText}', temperamentPerformanceText)
    .replace('{recentExecutiveSummariesText}', recentExecutiveSummariesText)
    .replace('{priorityImprovementsText}', priorityImprovementsText)
    .replace('{topStrengthsText}', topStrengthsText)
    .replace('{criticalGapsText}', criticalGapsText)

  console.log('📤 Enviando para OpenAI GPT-4.1...')
  console.log('📊 Dados enriquecidos:', {
    totalSessions: enrichedPerformance.totalSessions,
    trend: enrichedPerformance.trend,
    spinDetailed: enrichedPerformance.spin,
    objectionTypes: enrichedPerformance.objectionPerformance.length,
    recurringPatterns: enrichedPerformance.recurringMissedOpportunities.length
  })

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 4000
  })

  const content = response.choices[0].message.content

  if (!content) {
    throw new Error('OpenAI retornou resposta vazia')
  }

  console.log('✅ PDI gerado com sucesso')

  const pdiResult = JSON.parse(content) as PDIResult

  // Garantir que a data de geração está correta
  if (!pdiResult.gerado_em) {
    pdiResult.gerado_em = new Date().toISOString().split('T')[0]
  }

  // Garantir versão
  if (!pdiResult.versao) {
    pdiResult.versao = 'pdi.7dias.v3'
  }

  console.log('📊 PDI pronto - Foco:', pdiResult.foco_da_semana?.area,
    '| Indicador:', pdiResult.foco_da_semana?.indicador_foco,
    '| Nota:', pdiResult.diagnostico?.nota_geral)

  return pdiResult
}
