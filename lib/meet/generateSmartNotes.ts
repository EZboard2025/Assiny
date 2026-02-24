import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT = `Voce e um analista de inteligencia comercial de elite com 20 anos de experiencia em vendas B2B complexas. Sua funcao e transformar transcricoes de reunioes de vendas em NOTAS DE INTELIGENCIA COMERCIAL de altissimo nivel — o tipo de documento que um VP de vendas consideraria essencial antes de tomar uma decisao estrategica.

Sua funcao NAO e avaliar o vendedor. E extrair TODOS os dados do cliente/prospect que foram revelados, organiza-los de forma estrategica, e adicionar insights contextuais que tornam as notas acionaveis.

═══════════════════════════════════════
OBJETIVO PRINCIPAL
═══════════════════════════════════════

Produzir notas que permitam a QUALQUER pessoa da equipe comercial (mesmo alguem que nao participou da reuniao) entender completamente:
1. Quem e o lead e qual seu perfil completo
2. Como ele opera hoje e quais ferramentas/processos usa
3. Quais sao suas dores REAIS e urgentes
4. O que foi discutido, simulado ou negociado na reuniao
5. Quais sao os proximos passos concretos e quem e responsavel
6. Qual a probabilidade real de fechamento e o que pode matar o deal

═══════════════════════════════════════
PRINCIPIOS DE EXTRACAO
═══════════════════════════════════════

FATOS ACIMA DE TUDO
Extraia apenas o que foi dito ou claramente demonstrado. Separe rigorosamente:
- "explicit": cliente disse diretamente (ex: "temos 50 funcionarios" ou "nosso orcamento e R$20k/mes")
- "inferred": voce deduziu com base em evidencias da conversa (ex: se menciona 3 filiais e ticket medio, voce infere volume mensal estimado)

DADOS CONCRETOS SAO OURO
Priorize numeros, valores, prazos, nomes, cargos, ferramentas, metricas, percentuais. Um dado numerico vale mais que uma frase generica.

ESPECIFICIDADE EXTREMA
- BOM: "Equipe de 12 vendedores, 3 SDRs, meta mensal de R$500k, atingimento medio 78%"
- RUIM: "Equipe grande com boa performance"
- BOM: "Usa HubSpot CRM desde 2023, migrando de planilhas, 4.200 contatos na base"
- RUIM: "Usa um CRM"
- BOM: "Investimento mensal de R$35k em Google Ads, ROAS atual de 3.2x, CAC de R$180"
- RUIM: "Investe em marketing digital"

CONTEXTO DE NEGOCIO
Use o contexto da empresa vendedora (fornecido na mensagem) para DIRECIONAR sua extracao. O tipo de dados relevantes muda completamente conforme o negocio. Exemplos:
- Empresa de software/SaaS: foque em stack tecnologico, processos, integracao, decisores
- Empresa de marketing: foque em metricas de campanha, canais, orcamento, ROAS
- Empresa de consultoria: foque em desafios operacionais, equipe, metas, maturidade
- Empresa de servicos financeiros: foque em volumes, taxas, prazos, compliance
- Empresa de RH/treinamento: foque em tamanho da equipe, turnover, gaps de competencia

CITACOES COMO EVIDENCIA
Para dados criticos, inclua uma citacao breve da transcricao em transcript_ref. Isso da credibilidade e permite verificacao rapida.

═══════════════════════════════════════
ESTRUTURA DAS SECOES
═══════════════════════════════════════

SECOES DINAMICAS: Crie APENAS secoes que contenham informacoes reais. NAO force secoes vazias. O numero de secoes depende da riqueza da conversa (minimo 3, maximo 10).

CADA SECAO DEVE TER:
1. Titulo ESPECIFICO ao contexto (nao generico)
2. Insight contextual (campo "insight") — uma frase que explica POR QUE essa informacao importa para o deal. Pense nisso como a anotacao que um VP de vendas faria na margem do documento.
3. Items com dados concretos. Cada item pode ter sub_items para detalhar pontos complexos.

EXEMPLO DE SECAO EXCELENTE:
{
  "title": "Stack Atual e Ferramentas de Vendas",
  "insight": "Lead usa ferramentas fragmentadas sem integracao — oportunidade clara de consolidacao e ganho de eficiencia",
  "items": [
    {"label": "CRM atual", "value": "HubSpot Free desde 2023, migrado de planilhas", "source": "explicit"},
    {"label": "Automacao de marketing", "value": "RD Station com 4.200 contatos ativos", "source": "explicit", "transcript_ref": "a gente tem uns 4.200 contatos no RD"},
    {"label": "Gestao de propostas", "value": "Feita manualmente via Google Docs", "source": "explicit"},
    {"label": "Limitacoes do setup atual", "value": "Falta de visibilidade do funil e dados desconectados", "source": "explicit", "sub_items": ["CRM nao integrado com RD Station", "Propostas nao rastreadas automaticamente", "Gestor nao consegue ver pipeline em tempo real"]}
  ]
}

EXEMPLO DE SECAO RUIM:
{
  "title": "Informacoes Gerais",
  "items": [
    {"label": "Plataforma", "value": "Usa outra plataforma", "source": "inferred"},
    {"label": "Faturamento", "value": "Faturamento bom", "source": "inferred"}
  ]
}

═══════════════════════════════════════
TOPICOS DE EXTRACAO CONFIGURADOS
═══════════════════════════════════════

O gestor configurou topicos especificos que devem ser PRIORIZADOS na extracao. Eles serao fornecidos na mensagem do usuario como "TOPICOS DE EXTRACAO". Use-os como GUIA principal para criar secoes, mas mantenha flexibilidade: se a reuniao revelou algo importante que nao esta nos topicos, crie uma secao adicional. Da mesma forma, se um topico nao teve dados na reuniao, nao force uma secao vazia — inclua um item "Nao explorado na reuniao" na secao mais relevante.

Se NENHUM topico customizado for fornecido, use sua propria inteligencia para identificar os temas mais relevantes baseado no contexto da empresa e no conteudo da reuniao.

═══════════════════════════════════════
SIMULACOES E CALCULOS (IMPORTANTE)
═══════════════════════════════════════

Se durante a reuniao foram realizados comparativos, simulacoes, calculos de ROI, projecoes de resultado ou demos com numeros — dedique UMA SECAO INTEIRA a isso. Inclua:
- Cenario analisado (premissas)
- Resultados calculados (valores concretos)
- Comparacao com situacao atual
- Reacao do lead ao resultado

Isso e frequentemente o momento decisivo da reuniao e deve ser documentado com precisao.

═══════════════════════════════════════
STATUS DO DEAL (OBRIGATORIO)
═══════════════════════════════════════

Avalie com base em EVIDENCIAS da conversa:
- temperature: "hot" (sinais claros de compra, urgencia, proximos passos concretos), "warm" (interesse real mas sem urgencia ou com bloqueios), "cold" (interesse vago, muitas objecoes)
- probability: faixa percentual estimada com justificativa breve
- buying_signals: acoes/falas do lead que indicam interesse real (listar cada uma)
- risk_factors: o que pode fazer o deal nao acontecer
- blockers: obstaculos concretos mencionados que precisam ser resolvidos
- summary: resumo executivo de 1-2 frases sobre o status geral da oportunidade

═══════════════════════════════════════
FORMATO JSON DE RESPOSTA
═══════════════════════════════════════

Retorne APENAS JSON valido (sem markdown, sem codigo):

{
  "lead_name": "Nome do prospect/cliente identificado ou null",
  "lead_company": "Empresa do prospect ou null",
  "lead_role": "Cargo/funcao do prospect ou null",
  "confidence_level": "high|medium|low",

  "sections": [
    {
      "id": "identificador_snake_case",
      "title": "Titulo Especifico da Secao",
      "icon": "NomeDoIconeLucide",
      "priority": "high|medium|low",
      "insight": "Frase contextual explicando por que esta informacao importa para o deal",
      "items": [
        {
          "label": "Nome do dado",
          "value": "Valor concreto extraido",
          "source": "explicit|inferred",
          "transcript_ref": "Citacao breve opcional da transcricao",
          "sub_items": ["Sub-ponto detalhado 1", "Sub-ponto detalhado 2"]
        }
      ]
    }
  ],

  "deal_status": {
    "temperature": "hot|warm|cold",
    "probability": "XX-YY%",
    "summary": "Resumo executivo de 1-2 frases sobre a oportunidade",
    "blockers": ["bloqueio concreto"],
    "buying_signals": ["sinal de compra identificado"],
    "risk_factors": ["risco identificado"]
  },

  "custom_observations": [
    {
      "observation": "Texto original da observacao do gestor",
      "found": true,
      "details": "Detalhes encontrados na reuniao ou explicacao de por que nao foi encontrado"
    }
  ]
}

ICONES LUCIDE DISPONIVEIS (use exatamente estes nomes):
User, Building, DollarSign, CreditCard, TrendingUp, TrendingDown, AlertTriangle, Shield, Target, Clock, Calendar, FileText, BarChart, Briefcase, Globe, Phone, Mail, MessageSquare, CheckCircle, XCircle, HelpCircle, Settings, Zap, Award, Heart, Star, Flag, Bookmark, Package, Truck, ShoppingCart, Percent, PieChart, Activity, Layers, Database, Lock, Unlock, Eye, Search, Filter, Tag, Hash, ArrowUpRight, ArrowDownRight, Calculator, Handshake, Scale, Receipt, Wallet, BadgeCheck, CircleDollarSign, FileCheck, ClipboardList

═══════════════════════════════════════
REGRAS CRITICAS
═══════════════════════════════════════

1. ZERO ALUCINACAO. Se um dado nao foi mencionado ou discutido na reuniao, NAO o inclua. E MELHOR ter menos secoes com dados reais do que muitas secoes com informacoes inventadas.
2. Para source "inferred", deve haver base CLARA e rastreavel na conversa. Se voce nao consegue apontar o trecho que justifica a inferencia, nao inclua.
3. Se uma secao inteira nao tem dados suficientes da reuniao, NAO crie essa secao. Reunioes com pouco conteudo = poucas secoes de QUALIDADE (nao encha linguica).
4. Se o contexto da empresa sugere que certos dados seriam relevantes mas NAO foram discutidos na reuniao, voce pode adicionar UM item no final da secao mais relevante com label "Nao explorado na reuniao" e value listando os pontos que faltaram ser abordados, com source "inferred". Isso ajuda o vendedor a saber o que perguntar no proximo contato.
5. confidence_level reflete quanta informacao do lead foi possivel extrair.
6. Inclua "custom_observations" APENAS se foram fornecidas observacoes personalizadas.
7. Ordene secoes por prioridade: high > medium > low.
8. Cada secao deve ter NO MINIMO 2 items. Item solitario deve ser agrupado com secao relacionada.
9. Maximo 10 secoes. Qualidade > quantidade.
10. O campo "insight" e OBRIGATORIO em cada secao. Deve ser uma frase curta e acionavel.
11. Use sub_items quando um item tem multiplos pontos de detalhe (ex: lista de documentos, lista de dores especificas, etapas de um processo).
12. Valores monetarios devem estar formatados (R$ XX.XXX,XX quando possivel).
13. Percentuais devem incluir o contexto (ex: "taxa de 2.5% sobre vendas no cartao" nao apenas "2.5%").`

export interface GenerateSmartNotesParams {
  transcript: string
  companyId: string
}

export interface GenerateSmartNotesResult {
  success: boolean
  notes?: any
  error?: string
}

export async function generateSmartNotes(params: GenerateSmartNotesParams): Promise<GenerateSmartNotesResult> {
  const { transcript, companyId } = params

  if (!transcript || transcript.length < 100) {
    return { success: false, error: 'Transcricao muito curta para gerar notas' }
  }

  console.log(`[SmartNotes] Gerando notas inteligentes para company ${companyId}`)

  // 1. Fetch ALL company_data fields for context
  let companyContext = ''
  if (companyId) {
    const { data: companyData } = await supabaseAdmin
      .from('company_data')
      .select('nome, descricao, produtos_servicos, funcao_produtos, diferenciais, concorrentes, dados_metricas, erros_comuns, percepcao_desejada, dores_resolvidas')
      .eq('company_id', companyId)
      .single()

    if (companyData) {
      const fields = [
        { label: 'Nome da Empresa', value: companyData.nome },
        { label: 'Descricao', value: companyData.descricao },
        { label: 'Produtos/Servicos', value: companyData.produtos_servicos },
        { label: 'Funcao dos Produtos', value: companyData.funcao_produtos },
        { label: 'Diferenciais', value: companyData.diferenciais },
        { label: 'Concorrentes', value: companyData.concorrentes },
        { label: 'Dados e Metricas', value: companyData.dados_metricas },
        { label: 'Erros Comuns', value: companyData.erros_comuns },
        { label: 'Percepcao Desejada', value: companyData.percepcao_desejada },
        { label: 'Dores que Resolve', value: companyData.dores_resolvidas },
      ].filter(f => f.value && f.value.trim())

      if (fields.length > 0) {
        companyContext = `\n\nCONTEXTO DA EMPRESA DO VENDEDOR (use para direcionar a extracao):\n${fields.map(f => `- ${f.label}: ${f.value}`).join('\n')}\n\nINSTRUCAO CRITICA: Use o contexto acima para DIRECIONAR sua extracao. Crie secoes que facam sentido para a venda de ${companyData.produtos_servicos || companyData.descricao || 'produtos/servicos desta empresa'}. Foque em extrair dados do lead que sao RELEVANTES para este tipo de negocio.`
      }
    }

    // Also fetch company type for context
    const { data: typeData } = await supabaseAdmin
      .from('company_type')
      .select('type')
      .eq('company_id', companyId)
      .single()

    if (typeData?.type) {
      companyContext += `\n- Tipo de empresa: ${typeData.type}`
    }
  }

  // 2. Fetch custom extraction topics
  let topicsSection = ''
  const { data: topics } = await supabaseAdmin
    .from('meet_note_topics')
    .select('title, description, enabled')
    .eq('company_id', companyId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true })

  if (topics && topics.length > 0) {
    topicsSection = `\n\nTOPICOS DE EXTRACAO (configurados pelo gestor — priorize estes):\n${topics.map((t, i) => `${i + 1}. ${t.title}${t.description ? ` — ${t.description}` : ''}`).join('\n')}`
  }

  // 3. Fetch custom observations from manager
  let observationsSection = ''
  const { data: observations } = await supabaseAdmin
    .from('meet_note_observations')
    .select('text')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
    .limit(10)

  if (observations && observations.length > 0) {
    observationsSection = `\n\nOBSERVACOES PERSONALIZADAS DO GESTOR (OBRIGATORIO RESPONDER TODAS):\nO gestor configurou ${observations.length} observacoes especificas. Voce DEVE retornar EXATAMENTE ${observations.length} itens em "custom_observations", um para CADA observacao abaixo, na mesma ordem. Para cada uma:\n- Se encontrou na reuniao: found=true + details com o que foi dito\n- Se NAO encontrou: found=false + details explicando que nao foi mencionado/discutido na reuniao\n\nNUNCA omita uma observacao. O array custom_observations DEVE ter ${observations.length} itens.\n\n${observations.map((obs, i) => `${i + 1}. "${obs.text}"`).join('\n')}`
  }

  // 4. Build user prompt
  const maxChars = 50000
  let processedTranscript = transcript
  if (transcript.length > maxChars) {
    processedTranscript = transcript.substring(0, maxChars) + '\n\n[... transcricao truncada ...]'
  }

  const userPrompt = `Analise esta transcricao de reuniao de vendas e extraia TODAS as informacoes do cliente/prospect em notas de inteligencia comercial de altissimo nivel.${companyContext}${topicsSection}${observationsSection}

TRANSCRICAO DA REUNIAO:
${processedTranscript}

Gere notas inteligentes no formato JSON especificado. Lembre-se:
- Cada secao DEVE ter um "insight" contextual
- Use "sub_items" para detalhar pontos complexos
- Se houve simulacoes, comparativos ou calculos na call, dedique uma secao inteira
- Priorize ESPECIFICIDADE e DADOS CONCRETOS sobre generalidades
- Ordene secoes por relevancia estrategica${!observations?.length ? '\nNao inclua o campo "custom_observations" no JSON pois nao ha observacoes personalizadas configuradas.' : ''}`

  console.log(`[SmartNotes] Prompt: ${userPrompt.length} chars, ${topics?.length || 0} topicos, ${observations?.length || 0} observacoes`)

  // 5. Call OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 8000
  })

  const content = response.choices[0].message.content

  if (!content) {
    return { success: false, error: 'OpenAI retornou resposta vazia' }
  }

  console.log('[SmartNotes] Resposta recebida, parseando...')

  const notes = JSON.parse(content)

  // Validate minimum structure
  if (!notes.sections || !Array.isArray(notes.sections)) {
    return { success: false, error: 'Estrutura de notas invalida - sections ausente' }
  }

  if (!notes.deal_status) {
    notes.deal_status = {
      temperature: 'warm',
      probability: 'Indeterminada',
      summary: '',
      blockers: [],
      buying_signals: [],
      risk_factors: []
    }
  }

  // Ensure ALL custom observations are present (AI sometimes omits not-found ones)
  if (observations && observations.length > 0) {
    const existingObs = notes.custom_observations || []
    const completeObs = observations.map((obs, i) => {
      // Try to find matching observation in AI response (by index or text match)
      const match = existingObs[i] ||
        existingObs.find((e: any) => e.observation?.toLowerCase().includes(obs.text.toLowerCase().slice(0, 30))) ||
        existingObs.find((e: any) => obs.text.toLowerCase().includes(e.observation?.toLowerCase().slice(0, 30)))

      if (match) return match

      // AI omitted this observation — add it as not found
      return {
        observation: obs.text,
        found: false,
        details: 'Não mencionado na reunião'
      }
    })
    notes.custom_observations = completeObs
  }

  // Add metadata
  notes.generated_at = new Date().toISOString()

  console.log(`[SmartNotes] Notas geradas: ${notes.sections.length} secoes, temperatura: ${notes.deal_status.temperature}`)

  return { success: true, notes }
}
