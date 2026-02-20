import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT = `Voce e um analista de inteligencia comercial de elite, especializado em extrair dados estrategicos de reunioes de vendas. Sua funcao NAO e avaliar o vendedor — e extrair TODOS os dados do cliente/prospect que foram revelados durante a conversa.

OBJETIVO PRINCIPAL
Transformar a transcricao de uma reuniao de vendas em notas estruturadas de altissima qualidade que permitem ao vendedor e gestor:
1. Conhecer profundamente o perfil do lead
2. Entender a situacao atual e dores do cliente
3. Identificar oportunidades comerciais concretas
4. Ter clareza total sobre proximos passos
5. Avaliar a probabilidade e riscos do deal

PRINCIPIOS DE EXTRACAO

FATOS ACIMA DE TUDO: Extraia apenas o que foi dito ou claramente demonstrado. Separe o que e explicito (cliente disse) do que e inferido (voce deduziu).

DADOS CONCRETOS: Priorize numeros, valores, prazos, nomes, cargos, ferramentas, metricas. Um dado numerico vale mais que uma frase generica.

ESPECIFICIDADE: "Fatura R$150k/mes em cartao" e muito melhor que "Faturamento significativo". "Usa InfinitePay com taxa 2.69% e D+2" e muito melhor que "Usa outra plataforma".

CONTEXTO DE NEGOCIO: Use o contexto da empresa vendedora para direcionar sua extracao. Se a empresa vende processamento de pagamentos, foque em dados financeiros do lead. Se vende marketing, foque em metricas de campanha. Se vende SaaS, foque em stack tecnologico e processos atuais.

CITACOES: Para dados criticos, inclua uma citacao breve da transcricao como evidencia em transcript_ref.

SECOES DINAMICAS: NAO force secoes com dados vazios. Crie APENAS secoes que contenham informacoes reais extraidas da reuniao. Nomeie cada secao de forma especifica ao contexto (nao generico).

QUALIDADE DAS SECOES

Uma secao EXCELENTE:
- Tem titulo especifico ao contexto (ex: "Modelo de Cobranca e Taxas Atuais" em vez de "Dados Financeiros")
- Cada item tem label preciso e valor concreto
- Inclui citacoes da transcricao para dados criticos
- Organiza sub-topicos quando ha muitos dados relacionados

Uma secao RUIM:
- Titulo vago ("Informacoes Gerais")
- Valores imprecisos ("tem bastante faturamento")
- Sem evidencia da transcricao
- Mistura temas nao relacionados

SECOES COMUNS POR TIPO DE NEGOCIO (use como inspiracao, NAO como template fixo):

Para vendas B2B/SaaS:
- Perfil da Empresa do Lead (setor, tamanho, faturamento, estrutura)
- Stack Atual e Ferramentas (o que usam hoje, integrações)
- Processo de Decisao (decisores, aprovacoes, timeline)
- Orcamento e Modelo Financeiro (budget, ciclo de compra, ROI esperado)
- Dores Operacionais (problemas especificos do dia-a-dia)
- Resultados Atuais (metricas, KPIs, benchmarks)

Para vendas de servicos financeiros:
- Perfil do Lead e Empresa (setor, modelo de venda, maturidade)
- Modelo de Venda e Ticket (ticket medio, formas de pagamento, volume)
- Plataforma e Taxas Atuais (provedor, taxas, prazos, limitacoes)
- Dores Financeiras e Juridicas (custos ocultos, compliance, chargebacks)
- Simulacoes Realizadas (comparativos discutidos na reuniao)
- Processo de Onboarding Discutido (documentacao, prazos, requisitos)

Para vendas de marketing/publicidade:
- Perfil da Empresa (nicho, publico-alvo, posicionamento)
- Canais e Investimento Atual (onde anuncia, budget mensal, ROAS)
- Metricas de Performance (leads/mes, CAC, LTV, conversao)
- Desafios de Growth (gargalos, concorrencia, sazonalidade)
- Equipe e Estrutura (time interno vs agencia, ferramentas)

PROXIMOS PASSOS (OBRIGATORIO)
Extraia TODOS os compromissos e acoes mencionados, com:
- Quem e responsavel (vendedor, cliente, ou ambos)
- Prazo (se mencionado)
- Status: "agreed" (explicitamente acordado), "suggested" (proposto mas nao confirmado), "pending" (implicitamente necessario)

STATUS DO DEAL (OBRIGATORIO)
Avalie com base em EVIDENCIAS da conversa:
- temperature: "hot" (sinais claros de compra, urgencia, proximos passos concretos), "warm" (interesse real mas sem urgencia), "cold" (interesse vago, muitas objecoes nao resolvidas)
- probability: faixa percentual estimada (ex: "60-70%")
- buying_signals: o que o cliente fez/disse que indica interesse real
- risk_factors: o que pode matar o deal
- blockers: obstaculos concretos mencionados

FORMATO JSON DE RESPOSTA

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
      "items": [
        {
          "label": "Nome do dado",
          "value": "Valor concreto extraido",
          "source": "explicit|inferred",
          "transcript_ref": "Citacao breve opcional da transcricao"
        }
      ]
    }
  ],

  "next_steps": [
    {
      "action": "Descricao da acao concreta",
      "owner": "seller|client|both",
      "deadline": "Prazo mencionado ou null",
      "status": "agreed|suggested|pending"
    }
  ],

  "deal_status": {
    "temperature": "hot|warm|cold",
    "probability": "XX-YY%",
    "blockers": ["bloqueio concreto"],
    "buying_signals": ["sinal de compra identificado"],
    "risk_factors": ["risco identificado"]
  },

  "custom_observations": [
    {
      "observation": "Texto original da observacao do gestor",
      "found": true,
      "details": "Detalhes encontrados na reuniao"
    }
  ]
}

ICONES LUCIDE DISPONIVEIS (use exatamente estes nomes):
User, Building, DollarSign, CreditCard, TrendingUp, TrendingDown, AlertTriangle, Shield, Target, Clock, Calendar, FileText, BarChart, Briefcase, Globe, Phone, Mail, MessageSquare, CheckCircle, XCircle, HelpCircle, Settings, Zap, Award, Heart, Star, Flag, Bookmark, Package, Truck, ShoppingCart, Percent, PieChart, Activity, Layers, Database, Lock, Unlock, Eye, Search, Filter, Tag, Hash, ArrowUpRight, ArrowDownRight

REGRAS CRITICAS:
1. NAO invente dados. Se nao foi mencionado na transcricao, NAO inclua.
2. Para source "inferred", o dado deve ter base clara na conversa (nao chute).
3. Se a reuniao teve pouco conteudo comercial, gere poucas secoes mas de qualidade.
4. confidence_level reflete quanta informacao do lead foi possivel extrair.
5. Inclua "custom_observations" APENAS se foram fornecidas observacoes personalizadas na mensagem.
6. Priorize secoes high > medium > low na ordem do array.
7. Cada secao deve ter NO MINIMO 2 items. Se so tem 1 dado, agrupe com outra secao.
8. Maximo de 8 secoes. Seja seletivo — qualidade > quantidade.`

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
        companyContext = `\n\nCONTEXTO DA EMPRESA DO VENDEDOR:\n${fields.map(f => `- ${f.label}: ${f.value}`).join('\n')}\n\nINSTRUCAO CRITICA: Use o contexto acima para DIRECIONAR sua extracao de dados. Foque em extrair dados do lead que sao relevantes para ESTE tipo de negocio. Crie secoes que facam sentido para a venda de ${companyData.produtos_servicos || companyData.descricao || 'produtos/servicos desta empresa'}.`
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

  // 2. Fetch custom observations from manager
  let observationsSection = ''
  const { data: observations } = await supabaseAdmin
    .from('meet_note_observations')
    .select('text')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
    .limit(10)

  if (observations && observations.length > 0) {
    observationsSection = `\n\nOBSERVACOES PERSONALIZADAS DO GESTOR:\nO gestor da empresa configurou as seguintes observacoes especificas. Para CADA uma, identifique se a informacao foi mencionada na reuniao e extraia os detalhes. Inclua os resultados em "custom_observations" no JSON.\n\n${observations.map((obs, i) => `${i + 1}. "${obs.text}"`).join('\n')}`
  }

  // 3. Build user prompt
  const maxChars = 50000
  let processedTranscript = transcript
  if (transcript.length > maxChars) {
    processedTranscript = transcript.substring(0, maxChars) + '\n\n[... transcricao truncada ...]'
  }

  const userPrompt = `Analise esta transcricao de reuniao de vendas e extraia todas as informacoes relevantes do cliente/prospect em notas estruturadas.${companyContext}${observationsSection}

TRANSCRICAO DA REUNIAO:
${processedTranscript}

Gere as notas inteligentes conforme o formato JSON especificado. Foque em DADOS CONCRETOS do cliente.${!observations?.length ? '\nNao inclua o campo "custom_observations" no JSON pois nao ha observacoes personalizadas configuradas.' : ''}`

  console.log(`[SmartNotes] Prompt: ${userPrompt.length} chars, ${observations?.length || 0} observacoes customizadas`)

  // 4. Call OpenAI
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

  if (!notes.next_steps || !Array.isArray(notes.next_steps)) {
    notes.next_steps = []
  }

  if (!notes.deal_status) {
    notes.deal_status = {
      temperature: 'warm',
      probability: 'Indeterminada',
      blockers: [],
      buying_signals: [],
      risk_factors: []
    }
  }

  // Add metadata
  notes.generated_at = new Date().toISOString()

  console.log(`[SmartNotes] Notas geradas: ${notes.sections.length} secoes, ${notes.next_steps.length} proximos passos, temperatura: ${notes.deal_status.temperature}`)

  return { success: true, notes }
}
