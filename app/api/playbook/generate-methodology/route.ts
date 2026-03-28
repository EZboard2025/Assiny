import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { randomUUID } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const maxDuration = 120

// Helper: extract text from PDF buffer
async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const result = await pdfParse(buffer)
  return result.text || ''
}

const EXTRACTION_PROMPT = `Você é um consultor sênior especializado em criar metodologias de avaliação de vendas personalizadas para empresas. Sua tarefa é analisar TODOS os materiais de vendas desta empresa e construir uma METODOLOGIA DE AVALIAÇÃO PROFUNDA E ESPECÍFICA — não genérica.

=== DADOS DA EMPRESA ===
{company_context}

=== MATERIAIS DE VENDAS DA EMPRESA ===
{all_materials}

=== INSTRUÇÕES DETALHADAS ===

LEIA TODO O MATERIAL antes de começar. Depois, construa a metodologia seguindo estas etapas:

ETAPA 1 — COMPREENDER A FILOSOFIA DE VENDAS
Antes de extrair critérios, entenda:
- Qual é a abordagem de vendas da empresa? (consultiva, transacional, challenger, solution selling, etc.)
- Qual é o ciclo de vendas típico? (dias, semanas, meses)
- Quem é o público-alvo? (personas, segmentos, tamanho de empresa)
- Quais são os valores fundamentais na condução de vendas?

ETAPA 2 — EXTRAIR CRITÉRIOS EM 3 NÍVEIS DE PROFUNDIDADE

Para CADA critério, extraia em 3 níveis:
1. ESTRATÉGICO: Qual é o princípio ou abordagem por trás?
2. TÁTICO: Quais técnicas específicas o vendedor deve usar?
3. OPERACIONAL: Quais scripts literais, frases exatas, ou ações concretas são esperadas?

ETAPA 3 — CRUZAR COM DADOS DA EMPRESA
Use os dados da empresa para gerar critérios sobre:
- Mencionar CORRETAMENTE os diferenciais específicos (quais são, como posicionar)
- Citar métricas, cases e provas sociais REAIS (não inventar)
- Abordar as dores que a empresa resolve (linguagem específica)
- Evitar os erros comuns listados pela empresa
- Posicionar corretamente contra concorrentes mencionados

ETAPA 4 — ORGANIZAR NAS 5 DIMENSÕES

1. ABERTURA (opening)
- Script de abertura completo (frase por frase se o material definir)
- Gancho personalizado conforme perfil do prospect
- Pedido de tempo/permissão
- Posicionamento inicial (como a empresa se apresenta)
- Primeiros 30-60 segundos

2. FECHAMENTO (closing)
- Técnicas de fechamento específicas do material
- Próximo passo concreto (qual exatamente? reunião? demo? proposta?)
- Como recapitular acordos
- Como criar compromisso do prospect
- Frases de transição para o fechamento

3. CONDUTA (conduct)
- Regras de comportamento ESPECÍFICAS (não "seja educado", mas "nunca interrompa o prospect quando ele está descrevendo uma dor")
- Proibições EXPLÍCITAS do material (frases proibidas, comportamentos vetados)
- Tom de comunicação (formal? informal? consultivo?)
- Regras de escuta ativa específicas
- Como lidar com situações de conflito ou objeção emocional

4. SCRIPTS OBRIGATÓRIOS (required_scripts)
- Frases LITERAIS que o material exige (copie exatamente como aparecem)
- Perguntas de qualificação padronizadas
- Respostas-padrão para objeções comuns
- Pitch de produto/serviço como definido no material
- Frases de transição entre etapas

5. PROCESSO (process)
- Etapas do funil de vendas passo a passo (se definido)
- Critérios de qualificação (BANT, MEDDIC, ou o que o material usar)
- O que documentar/registrar após cada interação
- Quando/como fazer handoff para outras áreas
- Métricas ou KPIs esperados

=== REGRAS DE CLASSIFICAÇÃO ===

"type":
- "required": O material usa linguagem imperativa ("deve", "sempre", "obrigatório", "é necessário", "tem que")
- "recommended": Linguagem sugestiva ("recomendado", "ideal", "prefira", "tente", "quando possível")
- "prohibited": Linguagem negativa ("nunca", "não", "evitar", "proibido", "jamais", "não é permitido")

"weight":
- "critical": Marcado como crítico/essencial, ou pode causar perda de deal/cliente. Regras de compliance, proibições graves.
- "high": Enfatizado no material, tem seção dedicada, ou é repetido múltiplas vezes.
- "medium": Mencionado como boa prática, aparece no contexto de recomendações.
- "low": Sugestão, nice-to-have, mencionado de passagem.

=== REGRAS FUNDAMENTAIS ===

1. NÃO INVENTE critérios genéricos. Se o material não menciona, a dimensão fica com status "not_found".
2. SEM LIMITE de critérios por dimensão — extraia TODOS que forem relevantes. Pode ter 3 ou 25.
3. SCRIPTS LITERAIS: Se o material contém frases exatas, copie-as no campo source_excerpt e referencie no criterion.
4. NOMES PRÓPRIOS: Se o material menciona produtos, serviços, métricas, cases ou concorrentes por nome, inclua nos critérios.
5. CONTEXTO ESPECÍFICO: "Mencionar que a empresa tem 500+ clientes ativos" é melhor que "Usar prova social".
6. PROIBIÇÕES ESPECÍFICAS: "Nunca dizer 'é barato'" é melhor que "Evitar linguagem negativa sobre preço".
7. source_excerpt deve ser um trecho LITERAL e extenso do material (até 300 caracteres), não um resumo.
8. APENAS CRITÉRIOS VERIFICÁVEIS NA CONVERSA: Esta metodologia será usada para avaliar TRANSCRIÇÕES de vendas (simulações ou reuniões reais). Só inclua critérios que podem ser verificados OUVINDO ou LENDO a conversa. EXCLUA critérios sobre:
   - Ações fora da conversa (ex: "pesquisar no CRM antes de ligar", "preencher relatório após a call", "enviar e-mail de follow-up")
   - Preparação prévia que não é visível na conversa (ex: "estudar o LinkedIn do prospect", "ler o site da empresa")
   - Métricas operacionais (ex: "fazer X ligações por dia", "manter taxa de conversão de Y%")
   - Processos internos de documentação (ex: "atualizar o pipeline", "registrar no sistema")
   Se o material menciona esses critérios, IGNORE-OS — eles não podem ser avaliados numa transcrição.
   PORÉM: Se o critério é sobre DEMONSTRAR que fez pesquisa prévia (ex: "mencionar algo específico do prospect que mostre que pesquisou"), aí SIM é verificável na conversa e deve ser incluído.

=== FORMATO JSON DE RESPOSTA ===

Retorne APENAS JSON válido (sem markdown, sem comentários):

{
  "sales_philosophy": "Descrição de 3-5 frases da filosofia de vendas da empresa, baseada nos materiais",
  "target_audience": "Descrição do público-alvo principal conforme os materiais",
  "dimensions": {
    "opening": {
      "status": "active",
      "criteria": [
        {
          "criterion": "Título curto e específico do critério",
          "detailed_description": "Descrição completa de 2-4 frases explicando EXATAMENTE o que é esperado, com exemplos específicos da empresa. Inclua o contexto de quando e como aplicar.",
          "type": "required",
          "weight": "critical",
          "evaluation_guidance": "Como verificar na prática: descreva o que o avaliador deve procurar na transcrição para confirmar que este critério foi cumprido ou não. Seja específico.",
          "source_excerpt": "Trecho LITERAL do material que fundamenta este critério (copie exatamente, até 300 chars)"
        }
      ],
      "dimension_summary": "Resumo de 2-3 frases do que o material espera nesta dimensão, incluindo o tom e a abordagem específica"
    },
    "closing": { "status": "active|not_found", "criteria": [...], "dimension_summary": "..." },
    "conduct": { "status": "active|not_found", "criteria": [...], "dimension_summary": "..." },
    "required_scripts": { "status": "active|not_found", "criteria": [...], "dimension_summary": "..." },
    "process": { "status": "active|not_found", "criteria": [...], "dimension_summary": "..." }
  }
}`

export async function POST(req: Request) {
  try {
    const { playbookId, companyId } = await req.json()

    if (!playbookId || !companyId) {
      return NextResponse.json(
        { error: 'playbookId e companyId são obrigatórios' },
        { status: 400 }
      )
    }

    console.log(`🔬 Gerando metodologia para playbook ${playbookId} da empresa ${companyId}`)

    // 1. Set status to generating
    await supabaseAdmin
      .from('sales_playbooks')
      .update({ methodology_status: 'generating', methodology: null })
      .eq('id', playbookId)

    // 2. Fetch playbook content
    const { data: playbook, error: pbError } = await supabaseAdmin
      .from('sales_playbooks')
      .select('content, version')
      .eq('id', playbookId)
      .single()

    if (pbError || !playbook?.content) {
      console.error('❌ Playbook não encontrado:', pbError)
      await supabaseAdmin
        .from('sales_playbooks')
        .update({ methodology_status: 'error' })
        .eq('id', playbookId)
      return NextResponse.json({ error: 'Playbook não encontrado' }, { status: 404 })
    }

    // 3. Fetch ALL company PDFs and extract their text
    let allMaterials = `[PLAYBOOK PRINCIPAL]\n${playbook.content}`

    const { data: companyPdfs } = await supabaseAdmin
      .from('company_pdfs')
      .select('file_name, file_path')
      .eq('company_id', companyId)

    if (companyPdfs && companyPdfs.length > 0) {
      console.log(`📚 Encontrados ${companyPdfs.length} PDFs adicionais da empresa`)

      for (const pdf of companyPdfs) {
        try {
          const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('company-pdf')
            .download(pdf.file_path)

          if (downloadError || !fileData) {
            console.error(`⚠️ Erro ao baixar ${pdf.file_name}:`, downloadError)
            continue
          }

          const arrayBuffer = await fileData.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const text = await extractPdfText(buffer)

          if (text && text.length > 50) {
            allMaterials += `\n\n[DOCUMENTO: ${pdf.file_name}]\n${text}`
            console.log(`📄 ${pdf.file_name}: ${text.length} caracteres extraídos`)
          }
        } catch (pdfError) {
          console.error(`⚠️ Erro ao processar ${pdf.file_name}:`, pdfError)
        }
      }
    }

    // 4. Fetch company data for context
    let companyContext = 'Dados da empresa não disponíveis.'
    const { data: companyData } = await supabaseAdmin
      .from('company_data')
      .select('nome, descricao, produtos_servicos, funcao_produtos, diferenciais, concorrentes, dados_metricas, erros_comuns, percepcao_desejada, dores_resolvidas')
      .eq('company_id', companyId)
      .limit(1)
      .single()

    if (companyData) {
      const fields = [
        companyData.nome && `Nome da Empresa: ${companyData.nome}`,
        companyData.descricao && `Descrição: ${companyData.descricao}`,
        companyData.produtos_servicos && `Produtos/Serviços: ${companyData.produtos_servicos}`,
        companyData.funcao_produtos && `Função dos Produtos: ${companyData.funcao_produtos}`,
        companyData.diferenciais && `Diferenciais Competitivos: ${companyData.diferenciais}`,
        companyData.concorrentes && `Concorrentes: ${companyData.concorrentes}`,
        companyData.dados_metricas && `Provas Sociais (cases, métricas, prêmios): ${companyData.dados_metricas}`,
        companyData.erros_comuns && `Erros Comuns a Evitar: ${companyData.erros_comuns}`,
        companyData.percepcao_desejada && `Percepção Desejada no Mercado: ${companyData.percepcao_desejada}`,
        companyData.dores_resolvidas && `Dores que a Empresa Resolve: ${companyData.dores_resolvidas}`,
      ].filter(Boolean)
      if (fields.length > 0) {
        companyContext = fields.join('\n')
      }
    }

    const { data: companyType } = await supabaseAdmin
      .from('company_type')
      .select('type')
      .eq('company_id', companyId)
      .single()

    if (companyType?.type) {
      companyContext += `\nTipo de Negócio: ${companyType.type}`
    }

    // 5. Build prompt and call OpenAI
    const prompt = EXTRACTION_PROMPT
      .replace('{company_context}', companyContext)
      .replace('{all_materials}', allMaterials.slice(0, 120000)) // 120k chars limit

    console.log(`🤖 Chamando OpenAI para extrair metodologia (${allMaterials.length} chars de material)...`)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.15,
      max_tokens: 16000,
    })

    const rawResponse = completion.choices[0]?.message?.content
    if (!rawResponse) {
      throw new Error('OpenAI returned empty response')
    }

    const extracted = JSON.parse(rawResponse)

    // 6. Add UUIDs to each criterion and build summary
    let totalCriteria = 0
    const byType = { required: 0, recommended: 0, prohibited: 0 }
    const byWeight = { critical: 0, high: 0, medium: 0, low: 0 }

    for (const dimKey of ['opening', 'closing', 'conduct', 'required_scripts', 'process']) {
      const dim = extracted.dimensions?.[dimKey]
      if (dim?.criteria && Array.isArray(dim.criteria)) {
        dim.criteria = dim.criteria.map((c: any) => ({
          ...c,
          id: randomUUID(),
        }))
        totalCriteria += dim.criteria.length
        for (const c of dim.criteria) {
          if (c.type in byType) byType[c.type as keyof typeof byType]++
          if (c.weight in byWeight) byWeight[c.weight as keyof typeof byWeight]++
        }
      }
    }

    const methodology = {
      generated_at: new Date().toISOString(),
      model_used: 'gpt-4.1',
      playbook_version: playbook.version,
      sales_philosophy: extracted.sales_philosophy || null,
      target_audience: extracted.target_audience || null,
      dimensions: extracted.dimensions,
      summary: {
        total_criteria: totalCriteria,
        by_type: byType,
        by_weight: byWeight,
        materials_analyzed: 1 + (companyPdfs?.length || 0), // playbook + PDFs
      },
    }

    // 7. Save to database
    const { error: saveError } = await supabaseAdmin
      .from('sales_playbooks')
      .update({
        methodology,
        methodology_status: 'ready',
      })
      .eq('id', playbookId)

    if (saveError) {
      console.error('❌ Erro ao salvar metodologia:', saveError)
      await supabaseAdmin
        .from('sales_playbooks')
        .update({ methodology_status: 'error' })
        .eq('id', playbookId)
      return NextResponse.json({ error: 'Erro ao salvar metodologia' }, { status: 500 })
    }

    const activeDimensions = Object.values(extracted.dimensions).filter((d: any) => d.status === 'active').length
    console.log(`✅ Metodologia gerada: ${totalCriteria} critérios em ${activeDimensions} dimensões (${1 + (companyPdfs?.length || 0)} materiais analisados)`)

    return NextResponse.json({
      success: true,
      methodology,
    })
  } catch (error) {
    console.error('💥 Erro ao gerar metodologia:', error)

    // Try to set error status
    try {
      const { playbookId } = await req.clone().json()
      if (playbookId) {
        await supabaseAdmin
          .from('sales_playbooks')
          .update({ methodology_status: 'error' })
          .eq('id', playbookId)
      }
    } catch {}

    return NextResponse.json(
      { error: 'Erro ao gerar metodologia', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
