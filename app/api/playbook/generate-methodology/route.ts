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

const EXTRACTION_PROMPT = `Você é um analista que lê materiais de vendas de empresas e extrai FIELMENTE todas as regras, scripts e processos contidos neles. Sua função NÃO é criar critérios — é COPIAR o que o material diz.

=== DADOS DA EMPRESA ===
{company_context}

=== MATERIAIS DE VENDAS DA EMPRESA ===
{all_materials}

=== COMO TRABALHAR ===

PASSO 1 — LEITURA COMPLETA
Leia TODO o material do início ao fim. Não pule nada.

PASSO 2 — EXTRAIR TUDO (sem organizar ainda)
Percorra o material parágrafo por parágrafo e extraia TODAS as regras que encontrar:
- Cada frase imperativa ("O vendedor deve...", "Sempre faça...", "É obrigatório...")
- Cada proibição ("Nunca...", "Não pode...", "Evite...", "É proibido...")
- Cada script literal ou frase modelo (copie EXATAMENTE como está)
- Cada etapa de processo descrita
- Cada pergunta que o vendedor deve fazer
- Cada recomendação ou boa prática

PASSO 3 — ORGANIZAR NAS 5 DIMENSÕES
Distribua as regras extraídas nas dimensões abaixo. Se uma regra não encaixa em nenhuma, coloque em "conduct" (conduta geral).

Dimensões:
- opening: Tudo sobre o INÍCIO da conversa (primeiros minutos, apresentação, saudação, gancho, permissão)
- closing: Tudo sobre o FIM/AVANÇO da conversa (próximos passos, agendamento, compromisso, recapitulação)
- conduct: Regras de COMPORTAMENTO durante toda a conversa (tom, proibições, escuta, atitude, linguagem)
- required_scripts: FRASES LITERAIS, perguntas padronizadas, pitchs definidos, respostas-modelo
- process: ETAPAS do funil, qualificação, sequência de ações, critérios de avanço

PASSO 4 — VERIFICAR COMPLETUDE
Releia o material inteiro novamente e confira: alguma regra, script ou processo ficou de fora? Se sim, adicione.

=== COMO ESCREVER CADA CRITÉRIO ===

REGRA PRINCIPAL: COPIE, NÃO RESUMA.

Exemplos de critério RUIM (genérico, resumido — NÃO FAÇA ISSO):
❌ "Usar tom adequado na abertura"
❌ "Apresentar os benefícios do produto"
❌ "Fazer perguntas de qualificação"
❌ "Demonstrar empatia com o prospect"
❌ "Seguir o processo de vendas"

Exemplos de critério BOM (específico, fiel ao material — FAÇA ASSIM):
✅ "Iniciar a ligação com: 'Oi [nome], aqui é o [seu nome] da [empresa], tudo bem? Vi que você [referência personalizada]'"
✅ "Mencionar os 3 benefícios-chave conforme o playbook: redução de 40% no tempo de onboarding, aumento de 25% na taxa de conversão, e dashboard em tempo real"
✅ "Perguntar as 5 perguntas BANT+: Budget, Authority, Need, Timeline, Pain — nessa ordem"
✅ "Nunca dizer 'nosso produto é o mais barato' — posicionar como investimento, não custo"
✅ "Após a discovery, fazer recap usando a frase: 'Então resumindo o que entendi, [nome]...'"

Para CADA critério extraído:

"criterion": Título curto mas ESPECÍFICO — inclua nomes, números ou frases-chave do material. Não generalize.

"detailed_description": Copie e expanda o que o material diz. Use formato: "Conforme o material: '[trecho literal]'. Na prática, o vendedor deve [explicação de como aplicar]." Inclua frases exatas quando existirem.

"evaluation_guidance": Descreva o que um avaliador deve PROCURAR NA TRANSCRIÇÃO para verificar se o vendedor cumpriu. Seja específico: "Procure no início da conversa se o vendedor disse '[frase X]' ou variação próxima. Se disse algo similar mas não exatamente, é 'partial'. Se pulou direto para o pitch sem saudação, é 'missed'."

"source_excerpt": Trecho LITERAL do material, copiado exatamente como está (até 500 caracteres). NÃO resuma — copie.

=== CLASSIFICAÇÃO ===

"type":
- "required": Material usa linguagem imperativa ("deve", "sempre", "obrigatório", "tem que")
- "recommended": Linguagem sugestiva ("recomendado", "ideal", "prefira", "quando possível")
- "prohibited": Linguagem proibitiva ("nunca", "não", "evitar", "proibido", "jamais")

"weight":
- "critical": Marcado como essencial, repetido múltiplas vezes, ou pode causar perda de deal
- "high": Tem seção dedicada no material ou é enfatizado
- "medium": Mencionado como boa prática
- "low": Sugestão ou menção de passagem

=== FILTRO CRÍTICO: SÓ INCLUA O QUE UMA IA PODE AVALIAR LENDO TEXTO ===

ATENÇÃO: Esta metodologia será usada por uma IA que avalia TRANSCRIÇÕES DE TEXTO de conversas de vendas. A IA só tem acesso ao TEXTO da conversa — ela NÃO pode ver, ouvir ou perceber nada além das palavras escritas/faladas.

EXCLUA OBRIGATORIAMENTE critérios sobre:
- Ações fora da conversa (pesquisar CRM, enviar email, preencher relatório, agendar follow-up no sistema)
- Preparação não visível na conversa (estudar LinkedIn, ler site, pesquisar empresa)
- Métricas operacionais (X ligações por dia, taxa de conversão, tempo de resposta)
- LINGUAGEM CORPORAL ou sinais não-verbais (tom de voz, postura, expressão facial, contato visual, gestos)
- SINAIS DE COMPRA NÃO-VERBAIS (linguagem corporal do prospect, expressões, hesitações não-verbais)
- Qualquer coisa que exija OUVIR áudio (entonação, ritmo da fala, pausas dramáticas, volume da voz)
- Qualquer coisa que exija VER vídeo (compartilhamento de tela, apresentação visual, reação facial)
- Sentimentos ou intenções internas do vendedor ou prospect que não são expressos em palavras

TESTE PARA CADA CRITÉRIO: "Uma IA lendo APENAS o texto transcrito consegue verificar se isso foi feito?" Se a resposta for NÃO, EXCLUA o critério.

PORÉM INCLUA: Se o critério é sobre algo que APARECE NO TEXTO da conversa (ex: "mencionar dado específico do prospect", "fazer pergunta X", "usar frase Y"), inclua.

=== REGRAS FINAIS ===

1. NÃO INVENTE. Se o material não menciona, não crie. Dimensão vazia = status "not_found".
2. SEM LIMITE de critérios. Extraia TODOS. Pode ter 3 ou 30.
3. COPIE frases literais do material — não parafraseie.
4. NOMES PRÓPRIOS: Se o material cita produtos, métricas, cases ou concorrentes por nome, mantenha.
5. Ao terminar, RELEIA o material e verifique se TUDO foi capturado.

=== FORMATO JSON ===

Retorne APENAS JSON válido (sem markdown):

{
  "sales_philosophy": "3-5 frases descrevendo a filosofia de vendas da empresa CONFORME OS MATERIAIS (não invente)",
  "target_audience": "Público-alvo conforme descrito nos materiais",
  "dimensions": {
    "opening": {
      "status": "active",
      "criteria": [
        {
          "criterion": "Título específico com frases-chave do material",
          "detailed_description": "Conforme o material: '[trecho literal]'. O vendedor deve [como aplicar na prática].",
          "type": "required",
          "weight": "critical",
          "evaluation_guidance": "Procure na transcrição: [o que o avaliador deve buscar especificamente]. Se encontrar [X] = compliant. Se encontrar [Y parcial] = partial. Se não encontrar = missed.",
          "source_excerpt": "Trecho LITERAL do material copiado exatamente (até 500 chars)"
        }
      ],
      "dimension_summary": "O que o material espera nesta dimensão — cite trechos"
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
