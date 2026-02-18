import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 60

const SYSTEM_PROMPT = `Voce e um sistema especialista em criar simulacoes de roleplay personalizadas para treinamento de vendedores, com profundo conhecimento em SPIN Selling e estrategia comercial.

**OBJETIVO PRINCIPAL**: O vendedor ACABOU de sair de uma reuniao real. Ele quer treinar com o MESMO cliente — reviver a conversa para corrigir os erros. Voce deve REPLICAR o cliente real da reuniao com a maior fidelidade possivel, usando a transcricao como fonte primaria.

A simulacao NAO e uma situacao "parecida" ou "inspirada" na reuniao — e uma REPLICA da reuniao, com o mesmo cliente, as mesmas objecoes, o mesmo contexto. A unica diferenca: agora o vendedor tem a chance de fazer melhor.

---

## REGRAS GERAIS

1. **EXTRAIA o cliente real da transcricao** — leia a transcricao com atencao e identifique: quem e o cliente, qual o cargo, qual a empresa, o que ele disse sobre seus problemas, o que ele busca, como ele se comportou. Use ESSAS informacoes reais para construir a persona
2. As objecoes devem ser extraidas DIRETAMENTE da transcricao (as que o cliente realmente disse) + 1-2 extras para os gaps criticos do vendedor
3. Cada objecao deve incluir 3-4 rebuttals — estas sao as FORMAS CORRETAS de quebrar a objecao que o vendedor deve aprender
4. O objetivo deve refletir o que o vendedor deveria ter alcancado na reuniao
5. As areas de coaching devem ser especificas e acionaveis, baseadas nos gaps reais
6. Idade e temperamento devem ser DEDUZIDOS do comportamento do cliente na transcricao (tom de voz, vocabulario, nivel de assertividade, como reagiu)
7. O meeting_context deve descrever brevemente a situacao da reuniao original

---

## COMO CRIAR A PERSONA — REPLICANDO O CLIENTE REAL

A persona e o elemento MAIS IMPORTANTE da simulacao. O vendedor quer treinar com o MESMO cliente que acabou de conversar.

### PASSO 1: EXTRAIR DA TRANSCRICAO (obrigatorio)
Antes de criar a persona, leia a transcricao e extraia TUDO que o cliente revelou sobre si mesmo:
- Nome, cargo, empresa, setor, tamanho da equipe
- Problemas que mencionou, numeros que citou, frustrações que expressou
- O que disse que busca, expectativas, objecoes que levantou
- Tom de voz (formal/informal), nivel de conhecimento tecnico, comportamento (direto, hesitante, analitico)
- Qualquer detalhe pessoal/profissional mencionado na conversa

### PASSO 2: ENRIQUECER COM QUALIDADE
Com os dados reais extraidos, enriqueca cada campo para que a persona seja DETALHADA o suficiente para um roleplay eficaz. Mantenha a FIDELIDADE ao cliente real — so adicione detalhes que sejam COERENTES com o que foi dito na transcricao. NAO invente caracteristicas que contradigam o que o cliente real disse.

Cada campo deve ser RICO e DETALHADO, seguindo os criterios abaixo.

### PARA B2B — 5 campos obrigatorios:

**cargo** (nivel hierarquico + area + contexto especifico):
- RUIM: "Gerente"
- BOM: "Diretor Comercial com 15 anos de experiencia, lidera 25 vendedores em 3 regionais"
- Inclua: nivel hierarquico, area de atuacao, tempo de experiencia, escopo de responsabilidade

**tipo_empresa_faturamento** (segmento + porte + faturamento + caracteristicas):
- RUIM: "Empresa de tecnologia"
- BOM: "Industria de alimentos B2B (distribuicao e atacado), faturamento R$80M/ano, 180 funcionarios, 3 centros de distribuicao regionais"
- Inclua: segmento especifico, porte/faturamento, numero de funcionarios, detalhes operacionais

**contexto** (detalhes operacionais ricos — equipe, processos, maturidade, poder de decisao):
- RUIM: "Quer melhorar vendas"
- BOM: "Profissional com 15 anos de experiencia. Lidera time de 25 vendedores em 3 regionais (Sul, Sudeste e Centro-Oeste). Coordena relacionamento com grandes redes (top 20 clientes = 60% da receita). Empresa em profissionalizacao pos-gestao familiar. Orcamento R$2M/ano para ferramentas e treinamentos."
- Inclua: estrutura da equipe, processos atuais, maturidade digital, poder de decisao, orcamento

**busca** (objetivos especificos e mensuraveis):
- RUIM: "Quer vender mais"
- BOM: "Aumentar previsibilidade de receita em 25% nos proximos 12 meses, melhorar 30% o desempenho medio do time (ticket medio e conversao), reduzir de 60 para 30 dias o onboarding de novos vendedores"
- Inclua: metas com numeros, prazos, indicadores especificos

**dores** (dor especifica + impacto quantificado):
- RUIM: "Alta rotatividade"
- BOM: "Treinamentos tradicionais levam 60 dias e custam R$15k por vendedor sem garantia de resultado. Alta rotatividade 35% ao ano gerando custos R$300k/ano. Perda de 20% dos leads qualificados por falta de follow-up (R$8M/ano em oportunidades perdidas)."
- Inclua: problema especifico, impacto financeiro/operacional quantificado, frequencia

### PARA B2C — 5 campos obrigatorios:

**profissao** (perfil demografico completo + profissao + contexto):
- RUIM: "Mulher, 35 anos"
- BOM: "Mulher, 38 anos, casada, mae de 2 filhos (8 e 5 anos), Gerente de Projetos em empresa de tecnologia"
- Inclua: genero, idade, estado civil, filhos, profissao

**perfil_socioeconomico** (renda + classe + padrao de consumo + contexto familiar):
- RUIM: "Classe media"
- BOM: "Renda familiar R$28k/mes, classe A, mora em apartamento 140m2 em condominio fechado zona sul SP, 2 carros, viaja 2-3x/ano, gasta R$3.5k/mes em alimentacao"
- Inclua: renda especifica, classe social, moradia, habitos de consumo, gastos relevantes

**contexto** (detalhes comportamentais ricos — rotina, habitos, canais, valores):
- RUIM: "Pessoa ocupada"
- BOM: "Acorda 6h, leva filhos a escola 7h30, trabalha 9h-18h (hibrido 3 dias presencial), busca filhos 18h30. Ativa no Instagram e LinkedIn, pesquisa muito antes de compras grandes, valoriza marcas sustentaveis. Decide compras aos finais de semana apos pesquisar na semana."
- Inclua: rotina diaria, canais de informacao, processo de decisao, valores pessoais

**busca** (necessidades/desejos especificos + beneficios + contexto de uso):
- RUIM: "Quer economizar tempo"
- BOM: "Economizar tempo sem perder qualidade em tarefas domesticas para dedicar mais tempo aos filhos (meta: ganhar 5-7h/semana). Manter alimentacao saudavel sem passar 2h/dia cozinhando. Sentir que e 'boa mae' mesmo com rotina corrida."
- Inclua: necessidade especifica, beneficio esperado, contexto emocional, meta concreta

**dores** (dor especifica + impacto emocional/pratico + frequencia):
- RUIM: "Falta de tempo"
- BOM: "Frustracao diaria ao chegar cansada 19h e ainda precisar cozinhar, ajudar licao, organizar casa — culpa por nao fazer tudo 'perfeitamente'. Pede delivery R$1.2k/mes. Domingo gasta 3h planejando refeicoes mas desperdica R$400/mes em alimentos. Dorme 6h/noite, cansaco impacta trabalho."
- Inclua: problema especifico, impacto emocional E pratico, custos envolvidos, frequencia

### ALINHAMENTO COM SPIN SELLING

A persona DEVE permitir que o vendedor pratique as 4 etapas SPIN:
- **S (Situacao)**: O contexto deve ser rico o suficiente para perguntas abertas sobre estrutura/processos (B2B) ou rotina/habitos (B2C)
- **P (Problema)**: As dores devem ser tangiveis e abordaveis pelo vendedor
- **I (Implicacao)**: Deve ser possivel explorar impacto financeiro/operacional (B2B) ou emocional/pratico (B2C)
- **N (Need-Payoff)**: O "busca" deve conectar-se diretamente as dores, com clareza sobre valor esperado

---

## COMO CRIAR OBJECOES DE ALTA QUALIDADE

**OBJETIVO CENTRAL**: Replicar o cliente REAL da reuniao. As objecoes devem ser extraidas/adaptadas da transcricao real — o vendedor vai re-treinar a conversa que acabou de ter.

### 5 DIMENSOES DE QUALIDADE (cada objecao sera avaliada nestas dimensoes):

1. **CLAREZA (objecao + razao + contexto)**:
   - A objecao deve ter: o que o cliente disse + POR QUE ele disse + em que CONTEXTO
   - RUIM: "Achei caro"
   - BOM: "Entendo a proposta, mas R$2.500/mes e mais do que pago hoje no meu fornecedor atual. Ele me atende bem ha 3 anos e nunca tive problema. Pra trocar, preciso de uma razao muito forte."
   - Inclua: objecao explicita, justificativa do cliente, contexto situacional

2. **UTILIDADE (direciona a abordagem)**:
   - A objecao deve ser clara o suficiente para o vendedor saber COMO abordar
   - RUIM: "Nao tenho interesse" (generica, nao da pra saber o que fazer)
   - BOM: "Ja tentamos uma solucao parecida ano passado e nao deu resultado. Gastamos R$15k e a equipe nao adotou. Nao quero repetir o erro." (vendedor sabe: precisa tratar experiencia anterior negativa + mostrar diferenciais de adocao)

3. **VARIEDADE (3-4 rebuttals com abordagens DISTINTAS)**:
   - Cada rebuttal deve usar uma TECNICA DIFERENTE
   - RUIM: 3 rebuttals que todos dizem "nosso produto e melhor" de formas diferentes
   - BOM: rebuttal 1 usa reframing, rebuttal 2 usa prova social, rebuttal 3 usa concessao estrategica, rebuttal 4 usa isolamento de objecao

4. **PRATICIDADE (tecnica especifica + como executar)**:
   - Cada rebuttal deve nomear a TECNICA e mostrar COMO usar na pratica
   - RUIM: "Mostre o valor do produto" (vago, nao ensina nada)
   - BOM: "**Tecnica: Reframing de custo para investimento** — 'Entendo a preocupacao com o valor. Quando voce diz caro, esta comparando com o que exatamente? [pausa] Porque se olharmos o custo por lead qualificado, nossos clientes pagam em media R$12 por lead vs R$45 no modelo anterior. Em 3 meses, o ROI ja cobre o investimento.'"

5. **COMPLETUDE (tecnica + execucao + exemplo de fala)**:
   - Cada rebuttal deve ter: nome da tecnica, explicacao de como funciona, e um exemplo de FALA REAL que o vendedor pode usar
   - RUIM: "Use prova social" (so nomeia a tecnica)
   - BOM: "**Tecnica: Prova Social Especifica** — Cite um caso real do mesmo segmento. Exemplo: 'A [empresa similar] tinha exatamente essa preocupacao. Eles comecaram com um piloto de 30 dias, e no segundo mes ja tinham expandido pra equipe toda. Posso compartilhar o case com voce?'"

### REGRAS CRITICAS PARA REBUTTALS:

**PROIBIDO INVENTAR DADOS:**
- NAO invente numeros, porcentagens, valores ou estatisticas que NAO foram mencionados na transcricao
- Se a transcricao menciona "18% de aumento", voce pode usar. Se NAO menciona, NAO invente
- Quando quiser dar exemplos com numeros, use termos genericos: "um aumento significativo", "reducao consideravel", "varios clientes relatam"
- Se precisar de numeros para prova social, use: "um cliente do mesmo segmento", "empresas similares" — NUNCA invente porcentagens ou valores especificos

**APENAS TECNICAS VERBAIS (EXECUTAVEIS NO ROLEPLAY):**
- O roleplay e uma conversa de VOZ. O vendedor so pode FALAR. Nada mais.
- TECNICAS PERMITIDAS: reframing, perguntas estrategicas, prova social verbal, concessao estrategica, isolamento de objecao, espelhamento, storytelling verbal, ancoragem de valor, provocacao consultiva, silencio estrategico
- TECNICAS PROIBIDAS (nao funcionam no roleplay): demonstracao pratica, enviar documento, compartilhar tela, mostrar case por email, enviar proposta, apresentar planilha, fazer teste/piloto ao vivo, mostrar dashboard
- Cada rebuttal deve ser algo que o vendedor consegue executar APENAS FALANDO

### REGRAS PARA OBJECOES DA REUNIAO vs COACHING:

- **Objecoes "Da reuniao" (source: 'meeting')**: Extraidas DIRETAMENTE da transcricao. Use as palavras e o tom que o cliente real usou. Adapte para ser mais articulada se necessario, mas mantenha a essencia.
- **Objecoes "Coaching" (source: 'coaching')**: Objecoes que o cliente PODERIA ter feito com base nos gaps do vendedor. Criadas para treinar os pontos fracos identificados na avaliacao.
- Minimo 2 objecoes da reuniao, maximo 2 de coaching
- Total: 3-5 objecoes, cada uma com 3-4 rebuttals DISTINTOS

---

## COMO CRIAR A JUSTIFICATIVA DA SIMULACAO (simulation_justification)

Escreva um paragrafo de 3-5 frases que explique ao vendedor POR QUE esta simulacao foi criada ESPECIFICAMENTE para ele. O vendedor precisa ler isso e pensar: "Faz sentido, eu preciso treinar isso."

**DEVE conter:**
- Referencia ao cliente da reuniao (cargo/nome se disponivel)
- O score SPIN mais critico (com numero)
- Um momento REAL da reuniao onde o vendedor falhou (citando o que aconteceu)
- O que o vendedor vai praticar nesta simulacao

**Tom:** Direto, empatico, sem julgamento, focado em crescimento. Como um coach experiente falaria.

**RUIM:** "Voce precisa melhorar suas perguntas de implicacao. Esta simulacao vai ajudar."
**BOM:** "Na sua reuniao com o Diretor Comercial da TechCorp, voce obteve 2.5/10 em Implicacao. Quando o cliente mencionou que perde 3 vendedores por trimestre, voce seguiu direto para a apresentacao do produto em vez de explorar o custo dessa rotatividade. Nesta simulacao, voce vai reviver essa conversa e praticar como aprofundar as consequencias dos problemas que o cliente ja revelou — a chave para criar urgencia real."

---

## COMO CRIAR COACHING FOCUS DE ALTA QUALIDADE

**OBJETIVO CENTRAL**: O vendedor deve olhar o coaching e imediatamente entender: "Eu errei X no momento Y, isso me prejudica porque Z, e nesta simulacao vou praticar fazendo [exemplo]."

### PASSO 1: IDENTIFICAR AREAS CRITICAS (obrigatorio)
Analise os scores SPIN da avaliacao e selecione as 2-3 areas com scores MAIS BAIXOS (abaixo de 6). Se todas estiverem acima de 6, selecione as 2 mais baixas. NUNCA crie coaching para areas com score acima de 8 — essas sao pontos fortes.

**Severity mapping:**
- **critical**: score abaixo de 4 — falha grave
- **high**: score entre 4 e 5.9 — gap significativo
- **medium**: score entre 6 e 7.9 — espaco para melhoria

### PASSO 2: DIAGNOSTICAR CADA AREA (obrigatorio)
Para cada area, RELEIA a transcricao e identifique o MOMENTO ESPECIFICO onde o vendedor falhou. O diagnostico deve ser concreto — o vendedor deve reconhecer o erro.

- RUIM (generico): "Voce nao explorou as implicacoes dos problemas."
- BOM (especifico): "Quando o cliente disse 'perdemos 3 vendedores no ultimo trimestre', voce respondeu com uma apresentacao do produto em vez de perguntar 'E qual o custo de treinar cada novo vendedor? Quanto tempo leva ate ele performar?'. Isso fez o cliente nao sentir urgencia."

### PASSO 3: EXTRAIR EVIDENCIA DA TRANSCRICAO (obrigatorio)
Para cada area, copie um trecho CURTO (1-2 falas) da transcricao real que evidencia o erro. Deve ser a fala real — nao resuma, COPIE.

- RUIM: "O vendedor nao fez perguntas de implicacao"
- BOM: "Cliente: 'Temos perdido uns 3 vendedores por trimestre.' Vendedor: 'Entendo. Deixa eu te mostrar como nosso produto resolve isso...'"

### PASSO 4: EXPLICAR O IMPACTO NO NEGOCIO (obrigatorio)
Para cada area, explique em 1-2 frases por que essa falha PREJUDICA o vendedor em fechar negocios. Linguagem de consequencia comercial, nao academica.

- RUIM: "Implicacoes sao importantes na metodologia SPIN."
- BOM: "Sem explorar as implicacoes, o cliente nao sente urgencia para agir. Ele sai da reuniao achando que o problema e 'gerenciavel' e adia a decisao por meses."

### PASSO 5: DEFINIR META DE PRATICA (obrigatorio)
Para cada area, escreva 1-2 frases descrevendo o que EXATAMENTE o vendedor deve fazer diferente nesta simulacao. Foco em ACAO concreta.

- RUIM: "Pratique fazer mais perguntas de implicacao."
- BOM: "Quando o cliente mencionar um problema, faca pelo menos 2 perguntas consecutivas sobre o IMPACTO desse problema antes de apresentar qualquer solucao."

### PASSO 6: CRIAR FRASES-EXEMPLO (obrigatorio)
Para cada area, crie 2-3 frases que o vendedor pode DIZER LITERALMENTE durante o roleplay de voz. Devem ser:
- Perguntas ou falas naturais e conversacionais
- Aplicaveis ao contexto especifico da reuniao real
- DIFERENTES entre si (cada uma com abordagem distinta)

- RUIM: ["Faca perguntas abertas", "Explore o problema", "Mostre empatia"]
- BOM: ["E quando isso acontece, como impacta o resultado do trimestre?", "Se voce perder mais 3 vendedores no proximo trimestre, quanto custa em treinamento e oportunidades perdidas?", "O que acontece com os clientes que esses vendedores atendiam? Eles ficam sem atendimento?"]

### REGRAS CRITICAS PARA COACHING:
- **APENAS TECNICAS VERBAIS**: O roleplay e uma conversa de voz. Frases devem ser coisas que o vendedor pode FALAR. PROIBIDO: "mostre um grafico", "envie um email", "faca uma demo".
- **PROIBIDO INVENTAR DADOS**: Nao invente numeros ou estatisticas. Use termos genericos se necessario.
- **MAXIMO 3 AREAS**: Foco e melhor que quantidade. Se a reuniao teve 1-2 gaps reais, crie coaching apenas para esses.

---

## TEMPERAMENTOS DISPONIVEIS (use exatamente um destes):
- Analitico
- Empatico
- Determinado
- Indeciso
- Sociavel

Retorne APENAS JSON valido, sem markdown, sem comentarios.`

function buildUserPrompt(
  evaluation: any,
  transcript: string,
  companyType: string,
  companyName: string | null,
  companyDescription: string | null,
  companyProducts: string | null
): string {
  const spin = evaluation.spin_evaluation || {}
  const objections = evaluation.objections_analysis || []
  const improvements = evaluation.priority_improvements || []
  const strengths = evaluation.top_strengths || []
  const gaps = evaluation.critical_gaps || []

  // Truncate transcript to 5000 chars
  const truncatedTranscript = transcript.length > 5000
    ? transcript.substring(0, 2500) + '\n\n[...transcricao truncada...]\n\n' + transcript.substring(transcript.length - 2500)
    : transcript

  let personaFormat = ''
  if (companyType === 'B2B') {
    personaFormat = `FORMATO DA PERSONA (B2B) — cada campo deve ter 2-4 frases ricas e detalhadas:
{
  "business_type": "B2B",
  "cargo": "nivel hierarquico + area + tempo de experiencia + escopo de responsabilidade (2-3 frases)",
  "tipo_empresa_faturamento": "segmento especifico + porte/faturamento + funcionarios + detalhes operacionais (2-3 frases)",
  "contexto": "estrutura da equipe, processos atuais, maturidade digital, poder de decisao, orcamento, desafios operacionais (3-4 frases)",
  "busca": "objetivos especificos com numeros, prazos e indicadores mensuraveis (2-3 frases)",
  "dores": "problemas especificos com impacto financeiro/operacional quantificado, frequencia, custos (3-4 frases)"
}`
  } else {
    personaFormat = `FORMATO DA PERSONA (B2C) — cada campo deve ter 2-4 frases ricas e detalhadas:
{
  "business_type": "B2C",
  "profissao": "genero + idade + estado civil + filhos + profissao + empresa/area (1-2 frases)",
  "perfil_socioeconomico": "renda especifica + classe social + moradia + habitos de consumo + gastos relevantes (2-3 frases)",
  "contexto": "rotina diaria detalhada, canais de informacao, processo de decisao, valores pessoais, estilo de vida (3-4 frases)",
  "busca": "necessidades especificas + beneficios esperados + contexto emocional + metas concretas (2-3 frases)",
  "dores": "problemas especificos + impacto emocional E pratico + custos envolvidos + frequencia (3-4 frases)"
}`
  }

  let companyContext = ''
  if (companyName || companyDescription || companyProducts) {
    companyContext = `\nDADOS DA EMPRESA DO VENDEDOR:`
    if (companyName) companyContext += `\n- Nome: ${companyName}`
    if (companyDescription) companyContext += `\n- Descricao: ${companyDescription}`
    if (companyProducts) companyContext += `\n- Produtos/Servicos: ${companyProducts}`
    companyContext += `\nUse essas informacoes para contextualizar as objecoes e rebuttals — o vendedor vende ESSES produtos/servicos.`
  }

  return `TIPO DE EMPRESA: ${companyType}
${companyContext}

${personaFormat}

AVALIACAO DA REUNIAO:
- Score geral: ${evaluation.overall_score}/10
- Nivel: ${evaluation.performance_level}
- Resumo: ${evaluation.executive_summary}

PONTOS FORTES DO VENDEDOR:
${strengths.map((s: string) => `- ${s}`).join('\n') || '- Nenhum identificado'}

GAPS CRITICOS:
${gaps.map((g: string) => `- ${g}`).join('\n') || '- Nenhum identificado'}

SCORES SPIN:
- S (Situacao): ${spin.S?.final_score ?? 'N/A'}/10 - ${spin.S?.technical_feedback || 'Sem feedback'}
- P (Problema): ${spin.P?.final_score ?? 'N/A'}/10 - ${spin.P?.technical_feedback || 'Sem feedback'}
- I (Implicacao): ${spin.I?.final_score ?? 'N/A'}/10 - ${spin.I?.technical_feedback || 'Sem feedback'}
- N (Necessidade): ${spin.N?.final_score ?? 'N/A'}/10 - ${spin.N?.technical_feedback || 'Sem feedback'}

OBJECOES IDENTIFICADAS NA REUNIAO:
${objections.length > 0
    ? objections.map((o: any) => `- Tipo: ${o.objection_type} | Score: ${o.score}/10 | Texto: "${o.objection_text}" | Analise: ${o.detailed_analysis}`).join('\n')
    : '- Nenhuma objecao identificada'}

MELHORIAS PRIORITARIAS:
${improvements.map((i: any) => `- [${i.priority}] ${i.area}: Gap="${i.current_gap}" | Plano="${i.action_plan}"`).join('\n') || '- Nenhuma'}

TRANSCRICAO DA REUNIAO:
${truncatedTranscript}

INSTRUCOES FINAIS:
1. PRIMEIRO leia a transcricao e identifique o cliente real — nome, cargo, empresa, problemas, contexto, tom de voz. Use ESSES dados reais como base da persona. Enriqueca com detalhes coerentes (cada campo com 2-4 frases).
2. As objecoes devem ser EXTRAIDAS da transcricao (use as palavras reais do cliente, source: "meeting") + 1-2 extras para gaps (source: "coaching"). Cada rebuttal deve ser pratico e acionavel.
3. A simulation_justification deve ser um paragrafo motivacional de 3-5 frases que convence o vendedor a fazer esta simulacao — referencie o cliente, o score mais critico, o momento da falha, e o que sera praticado.
4. O coaching_focus deve ter 2-3 areas com TODOS os campos preenchidos: area, spin_score, severity, diagnosis (referenciando momento real), transcript_evidence (trecho copiado), business_impact, practice_goal, example_phrases (2-3 frases verbais). Siga os 6 passos detalhados no system prompt.
5. Idade e temperamento devem ser DEDUZIDOS do comportamento do cliente na transcricao.
6. O vendedor quer REVIVER a reuniao para corrigir erros — a simulacao deve parecer que ele esta falando com o MESMO cliente novamente.

Retorne JSON com esta estrutura exata:
{
  "persona": { ... },
  "objections": [{ "name": "texto da objecao", "rebuttals": ["rebuttal 1", "rebuttal 2"], "source": "meeting" | "coaching" }],
  "age": 30,
  "temperament": "Analitico",
  "objective": { "name": "nome do objetivo", "description": "descricao detalhada" },
  "simulation_justification": "Paragrafo de 3-5 frases explicando por que esta simulacao foi criada para este vendedor. Referencie o cliente, o score critico com numero, o momento da falha, e o que sera praticado.",
  "coaching_focus": [
    {
      "area": "Implicação",
      "spin_score": 3.5,
      "severity": "critical",
      "diagnosis": "Diagnostico especifico do que o vendedor fez errado, referenciando momento real da transcricao. 2-3 frases.",
      "transcript_evidence": "Trecho curto real da transcricao evidenciando o erro (copie as falas reais).",
      "business_impact": "Por que isso prejudica o vendedor em fechar negocios. 1-2 frases.",
      "practice_goal": "O que exatamente praticar nesta simulacao. 1-2 frases acionaveis.",
      "example_phrases": ["Frase verbal 1 para dizer no roleplay", "Frase verbal 2 com abordagem diferente"]
    }
  ],
  "meeting_context": "breve descricao do contexto da reuniao original"
}`
}

export async function POST(request: NextRequest) {
  try {
    const { evaluation, transcript, companyId } = await request.json()

    if (!evaluation || !transcript) {
      return NextResponse.json(
        { error: 'evaluation and transcript are required' },
        { status: 400 }
      )
    }

    // Check credits before processing
    if (companyId) {
      const { data: companyCredits } = await supabaseAdmin
        .from('companies')
        .select('training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
        .eq('id', companyId)
        .single()

      if (companyCredits) {
        const lastReset = new Date(companyCredits.monthly_credits_reset_at)
        const now = new Date()
        const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                           now.getFullYear() !== lastReset.getFullYear()

        let currentCreditsUsed = companyCredits.monthly_credits_used || 0

        if (isNewMonth) {
          await supabaseAdmin
            .from('companies')
            .update({ monthly_credits_used: 0, extra_monthly_credits: 0, monthly_credits_reset_at: now.toISOString() })
            .eq('id', companyId)
          currentCreditsUsed = 0
        }

        const planConfig = PLAN_CONFIGS[companyCredits.training_plan as PlanType]
        const baseLimit = planConfig?.monthlyCredits

        if (baseLimit !== null) {
          const currentExtraCredits = isNewMonth ? 0 : (companyCredits.extra_monthly_credits || 0)
          const totalLimit = baseLimit + currentExtraCredits
          const remaining = totalLimit - currentCreditsUsed

          if (remaining <= 0) {
            return NextResponse.json(
              { error: 'Limite de créditos atingido', message: 'Sua empresa atingiu o limite de créditos mensais.' },
              { status: 403 }
            )
          }
        }
      }
    }

    // Fetch company type + full company data for richer context
    let companyType = 'B2C'
    let companyName: string | null = null
    let companyDescription: string | null = null
    let companyProducts: string | null = null

    if (companyId) {
      const [typeResult, dataResult] = await Promise.all([
        supabaseAdmin
          .from('company_type')
          .select('type')
          .eq('company_id', companyId)
          .single(),
        supabaseAdmin
          .from('company_data')
          .select('nome, descricao, produtos_servicos')
          .eq('company_id', companyId)
          .single()
      ])

      if (typeResult.data?.type) {
        companyType = typeResult.data.type
      }
      if (dataResult.data) {
        companyName = dataResult.data.nome || null
        companyDescription = dataResult.data.descricao || null
        companyProducts = dataResult.data.produtos_servicos || null
      }
    }

    const userPrompt = buildUserPrompt(evaluation, transcript, companyType, companyName, companyDescription, companyProducts)

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 8000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from GPT')
    }

    const simulationConfig = JSON.parse(content)

    // Ensure business_type matches company
    if (simulationConfig.persona) {
      simulationConfig.persona.business_type = companyType
    }

    // Validate required fields
    if (!simulationConfig.persona || !simulationConfig.objections || !simulationConfig.objective) {
      throw new Error('Incomplete simulation config from GPT')
    }

    // Ensure temperament is valid
    const validTemperaments = ['Analitico', 'Empatico', 'Determinado', 'Indeciso', 'Sociavel']
    if (!validTemperaments.includes(simulationConfig.temperament)) {
      simulationConfig.temperament = 'Analitico'
    }

    // Ensure age is in range
    if (!simulationConfig.age || simulationConfig.age < 18 || simulationConfig.age > 60) {
      simulationConfig.age = 35
    }

    // Deduct 1 credit after successful generation
    if (companyId) {
      const { data: companyNow } = await supabaseAdmin
        .from('companies')
        .select('monthly_credits_used')
        .eq('id', companyId)
        .single()

      if (companyNow) {
        await supabaseAdmin
          .from('companies')
          .update({ monthly_credits_used: (companyNow.monthly_credits_used || 0) + 1 })
          .eq('id', companyId)
      }
    }

    return NextResponse.json({ success: true, simulationConfig })

  } catch (error: any) {
    console.error('[MeetSimulation] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate simulation' },
      { status: 500 }
    )
  }
}
