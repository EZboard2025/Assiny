import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 60

const SYSTEM_PROMPT = `Voce e um sistema especialista em criar simulacoes de roleplay personalizadas para treinamento de vendedores, com profundo conhecimento em SPIN Selling e estrategia comercial.

Baseado na avaliacao de uma reuniao real e na transcricao, voce deve criar uma simulacao de roleplay que ajude o vendedor a corrigir os erros identificados. A simulacao deve recriar uma situacao SIMILAR a reuniao real, mas com ajustes que forcem o vendedor a praticar especificamente os pontos fracos identificados.

---

## REGRAS GERAIS

1. A persona deve ser baseada no cliente real da reuniao, adaptada para o tipo de empresa informado
2. As objecoes devem incluir as que apareceram na reuniao (especialmente as mal tratadas) + objecoes extras relacionadas aos gaps criticos
3. Cada objecao deve incluir 2-3 rebuttals — estas sao as FORMAS CORRETAS de quebrar a objecao que o vendedor deve aprender
4. O objetivo deve refletir o que o vendedor deveria ter alcancado na reuniao
5. As areas de coaching devem ser especificas e acionaveis, baseadas nos gaps reais
6. Idade e temperamento devem refletir o perfil do cliente real da reuniao
7. O meeting_context deve descrever brevemente a situacao da reuniao original

---

## COMO CRIAR PERSONAS DE ALTA QUALIDADE

A persona e o elemento MAIS IMPORTANTE da simulacao. Uma persona rasa produz um roleplay generico e inutil. Cada campo deve ser RICO e DETALHADO, seguindo os criterios abaixo.

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

Cada objecao deve ser:
- **Realista**: Baseada no que realmente acontece em reunioes de vendas do segmento
- **Especifica**: Nao generica — deve refletir a situacao da persona
- **Desafiadora**: Deve forcar o vendedor a pensar, nao ser trivial

Cada rebuttal (forma de quebrar) deve ser:
- **Pratico e acionavel**: O vendedor deve poder usar na vida real
- **Baseado em tecnica**: Usar principios como reframing, prova social, concessao estrategica, isolamento de objecao
- **Adaptado ao contexto**: Conectado aos dados da empresa do vendedor e a situacao da persona

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
1. Crie uma persona RICA E DETALHADA (cada campo com 2-4 frases). A persona deve parecer uma pessoa REAL, nao um template generico.
2. As objecoes devem incluir as da reuniao (source: "meeting") + extras para os gaps (source: "coaching"). Cada rebuttal deve ser pratico e acionavel.
3. O coaching_focus deve enderecar os scores SPIN mais baixos com dicas especificas.
4. Adapte a persona para que o vendedor possa praticar TODAS as etapas SPIN (Situacao, Problema, Implicacao, Need-Payoff).

Retorne JSON com esta estrutura exata:
{
  "persona": { ... },
  "objections": [{ "name": "texto da objecao", "rebuttals": ["rebuttal 1", "rebuttal 2"], "source": "meeting" | "coaching" }],
  "age": 30,
  "temperament": "Analitico",
  "objective": { "name": "nome do objetivo", "description": "descricao detalhada" },
  "coaching_focus": [{ "area": "area", "what_to_improve": "oque melhorar", "tips": ["dica 1", "dica 2"] }],
  "meeting_context": "breve descricao do contexto da reuniao original"
}`
}

export async function POST(request: Request) {
  try {
    const { evaluation, transcript, companyId } = await request.json()

    if (!evaluation || !transcript) {
      return NextResponse.json(
        { error: 'evaluation and transcript are required' },
        { status: 400 }
      )
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
      max_tokens: 6000
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

    return NextResponse.json({ success: true, simulationConfig })

  } catch (error: any) {
    console.error('[MeetSimulation] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate simulation' },
      { status: 500 }
    )
  }
}
