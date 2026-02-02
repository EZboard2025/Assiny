import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export const maxDuration = 60

// Função para extrair texto de PDF usando pdf-parse
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import com type assertion para evitar problemas com ESM
  const pdfParseModule = await import('pdf-parse')
  const pdfParse = (pdfParseModule as unknown as { default: (buffer: Buffer) => Promise<{ text: string }> }).default
  const data = await pdfParse(buffer)
  return data.text || ''
}

const SYSTEM_PROMPT = `Você é um extrator de dados de empresas especializado em analisar documentos corporativos (apresentações, playbooks, materiais de vendas, etc).

REGRA ABSOLUTA - NUNCA ALUCINAR:
- Você deve APENAS extrair informações que estão EXPLICITAMENTE presentes nos documentos
- Se uma informação NÃO está claramente escrita no conteúdo, retorne "" (string vazia)
- NUNCA invente, suponha, deduza ou "complete" informações que não existem
- É MELHOR deixar um campo vazio do que colocar informação inventada

CAMPOS A EXTRAIR (retorne JSON):

1. nome
   - Nome da empresa (sem slogans)
   - Extrair EXATAMENTE como aparece nos documentos
   - Se não encontrar o nome exato, deixe ""

2. descricao
   - O que a empresa FAZ de forma objetiva
   - Use APENAS informações do texto
   - Se só há frases de marketing vagas, deixe ""

3. produtos_servicos
   - Liste APENAS produtos/serviços com NOMES ESPECÍFICOS mencionados
   - Formato: "• Produto1 - descrição breve | • Produto2 - descrição breve"
   - Se não há produtos/serviços nomeados explicitamente, deixe ""

4. funcao_produtos
   - O que cada produto/serviço FAZ NA PRÁTICA para o cliente
   - Extrair funcionalidades ESPECÍFICAS mencionadas
   - Exemplo bom: "O sistema X automatiza emissão de NF, controla estoque em tempo real"
   - Se só há frases genéricas, deixe ""

5. diferenciais
   - Diferenciais que são ESPECÍFICOS e VERIFICÁVEIS
   - Exemplo bom: "Única empresa com certificação ISO 9001 no setor"
   - Exemplo ruim (NÃO USE): "qualidade", "inovação", "confiança"
   - Se só há diferenciais genéricos, deixe ""

6. concorrentes
   - APENAS se a empresa MENCIONAR concorrentes PELO NOME
   - Formato: "Nome1, Nome2, Nome3"
   - NÃO invente concorrentes baseado no setor
   - Se não há menção explícita, deixe ""

7. dados_metricas (Provas Sociais)
   - Métricas com números, depoimentos, cases de sucesso, prêmios, certificações
   - Exemplos: "500+ clientes ativos", "Case: Empresa X aumentou vendas em 40%"
   - Se não há provas sociais explícitas, deixe ""

8. erros_comuns
   - Erros que vendedores cometem ao vender o produto/serviço
   - Objeções mal tratadas, informações incorretas frequentes
   - Extrair apenas se houver material de treinamento/playbook com essa informação
   - Se não há essa informação, deixe ""

9. percepcao_desejada
   - Como a empresa se POSICIONA no mercado
   - Extrair apenas se houver declaração clara de posicionamento
   - Se só há frases de marketing vagas, deixe ""

10. dores_resolvidas
    - Problemas ESPECÍFICOS que a empresa diz resolver
    - Deve estar explícito no texto
    - Exemplo bom: "Elimina retrabalho manual em processos de RH"
    - Se não há dores específicas mencionadas, deixe ""

LEMBRE-SE:
- Documentos como playbooks/apresentações costumam ter informações ricas
- Preste atenção especial em: slides de produto, FAQ, objeções, cases de sucesso
- Campos vazios são PREFERÍVEIS a informações inventadas

FORMATO DE RESPOSTA (JSON válido, sem markdown):
{
  "nome": "",
  "descricao": "",
  "produtos_servicos": "",
  "funcao_produtos": "",
  "diferenciais": "",
  "concorrentes": "",
  "dados_metricas": "",
  "erros_comuns": "",
  "percepcao_desejada": "",
  "dores_resolvidas": ""
}`

export async function POST(req: Request) {
  try {
    const { pdfIds, companyId } = await req.json()

    if (!pdfIds || !Array.isArray(pdfIds) || pdfIds.length === 0) {
      return NextResponse.json(
        { error: 'IDs dos PDFs são obrigatórios' },
        { status: 400 }
      )
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'Empresa não identificada' },
        { status: 400 }
      )
    }

    // Buscar PDFs do banco
    const { data: pdfs, error: fetchError } = await supabaseAdmin
      .from('company_pdfs')
      .select('*')
      .in('id', pdfIds)
      .eq('company_id', companyId)

    if (fetchError || !pdfs || pdfs.length === 0) {
      return NextResponse.json(
        { error: 'PDFs não encontrados' },
        { status: 404 }
      )
    }

    console.log(`📄 Processando ${pdfs.length} PDF(s) do storage...`)

    // Baixar e extrair texto de cada PDF
    let allText = ''
    const processedFiles: string[] = []

    for (const pdf of pdfs) {
      try {
        console.log(`📖 Baixando: ${pdf.file_name}`)

        // Baixar arquivo do storage
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('company-pdf')
          .download(pdf.file_path)

        if (downloadError || !fileData) {
          console.error(`❌ Erro ao baixar ${pdf.file_name}:`, downloadError)
          continue
        }

        // Converter para Buffer
        const arrayBuffer = await fileData.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Extrair texto
        const text = (await extractPdfText(buffer)).trim()

        if (text.length > 0) {
          allText += `\n\n===== ARQUIVO: ${pdf.file_name} =====\n\n${text}`
          processedFiles.push(pdf.file_name)
          console.log(`✅ ${pdf.file_name}: ${text.length} caracteres extraídos`)
        } else {
          console.log(`⚠️ ${pdf.file_name}: PDF sem texto extraível`)
        }
      } catch (pdfError) {
        console.error(`❌ Erro ao processar ${pdf.file_name}:`, pdfError)
      }
    }

    if (allText.length < 100) {
      return NextResponse.json(
        { error: 'Não foi possível extrair texto suficiente dos PDFs.' },
        { status: 422 }
      )
    }

    // Limitar texto (150k chars ≈ 37.5k tokens)
    const maxChars = 150000
    if (allText.length > maxChars) {
      allText = allText.substring(0, maxChars) + '\n\n[... conteúdo truncado ...]'
    }

    console.log(`📊 Total extraído: ${allText.length} caracteres de ${processedFiles.length} arquivo(s)`)
    console.log('🤖 Enviando para GPT-4...')

    const userPrompt = `TAREFA: Analisar os documentos da empresa abaixo e extrair informações EXPLÍCITAS.

⚠️ ALERTA ANTI-ALUCINAÇÃO:
- Se a informação NÃO ESTÁ ESCRITA nos documentos, o campo deve ser ""
- Não invente concorrentes, métricas, ou funcionalidades
- É melhor deixar VAZIO do que inventar

===== CONTEÚDO DOS DOCUMENTOS =====
${allText}
===== FIM DO CONTEÚDO =====

Agora extraia APENAS o que está EXPLICITAMENTE escrito acima.
Campos sem informação explícita = ""
Retorne o JSON conforme instruído.`

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 3000,
          response_format: { type: 'json_object' }
        })
      })

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text()
        console.error('❌ Erro OpenAI:', errorText)
        throw new Error('Erro ao processar com IA')
      }

      const openaiData = await openaiResponse.json()
      const extractedData = JSON.parse(openaiData.choices[0].message.content)

      console.log('✅ Dados extraídos com sucesso!')

      return NextResponse.json({
        success: true,
        data: {
          nome: extractedData.nome || '',
          descricao: extractedData.descricao || '',
          produtos_servicos: extractedData.produtos_servicos || '',
          funcao_produtos: extractedData.funcao_produtos || '',
          diferenciais: extractedData.diferenciais || '',
          concorrentes: extractedData.concorrentes || '',
          dados_metricas: extractedData.dados_metricas || '',
          erros_comuns: extractedData.erros_comuns || '',
          percepcao_desejada: extractedData.percepcao_desejada || '',
          dores_resolvidas: extractedData.dores_resolvidas || ''
        },
        processed_files: processedFiles,
        total_chars: allText.length
      })

    } catch (aiError) {
      console.error('❌ Erro no processamento com IA:', aiError)
      return NextResponse.json(
        {
          error: 'Erro ao processar dados com IA',
          details: aiError instanceof Error ? aiError.message : 'Erro desconhecido'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('💥 Erro geral na extração:', error)
    return NextResponse.json(
      {
        error: 'Erro ao processar PDFs',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
