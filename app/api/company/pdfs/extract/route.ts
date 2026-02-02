import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export const maxDuration = 120 // 2 minutos para processar PDFs grandes

const EXTRACTION_INSTRUCTIONS = `Você é um extrator de dados de empresas especializado em analisar documentos corporativos (apresentações, playbooks, materiais de vendas, etc).

REGRA ABSOLUTA - NUNCA ALUCINAR:
- Você deve APENAS extrair informações que estão EXPLICITAMENTE presentes nos documentos
- Se uma informação NÃO está claramente escrita no conteúdo, retorne "" (string vazia)
- NUNCA invente, suponha, deduza ou "complete" informações que não existem
- É MELHOR deixar um campo vazio do que colocar informação inventada

CAMPOS A EXTRAIR:

1. nome - Nome da empresa (sem slogans). Se não encontrar, deixe ""

2. descricao - O que a empresa FAZ de forma objetiva. Se só há frases vagas, deixe ""

3. produtos_servicos - Liste APENAS produtos/serviços com NOMES ESPECÍFICOS mencionados. Formato: "• Produto1 - descrição | • Produto2 - descrição". Se não há produtos nomeados, deixe ""

4. funcao_produtos - O que cada produto/serviço FAZ NA PRÁTICA. Extrair funcionalidades ESPECÍFICAS. Se só há frases genéricas, deixe ""

5. diferenciais - Diferenciais ESPECÍFICOS e VERIFICÁVEIS. Exemplo: "Certificação ISO 9001". Se só há diferenciais genéricos como "qualidade", deixe ""

6. concorrentes - APENAS se mencionar concorrentes PELO NOME. Se não menciona, deixe ""

7. dados_metricas - Métricas com números, depoimentos, cases, prêmios, certificações. Exemplo: "500+ clientes". Se não há, deixe ""

8. erros_comuns - Erros de vendedores ao vender o produto. Extrair apenas se houver material de treinamento com essa info. Se não há, deixe ""

9. percepcao_desejada - Como a empresa se POSICIONA no mercado. Se só há marketing vago, deixe ""

10. dores_resolvidas - Problemas ESPECÍFICOS que a empresa diz resolver. Deve estar explícito. Se não há, deixe ""

RESPONDA APENAS COM JSON VÁLIDO (sem markdown, sem código):
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
  const uploadedFileIds: string[] = [] // Para limpar depois

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

    console.log(`📄 Processando ${pdfs.length} PDF(s) com OpenAI Assistants...`)

    // Baixar e fazer upload para OpenAI
    const processedFiles: string[] = []

    for (const pdf of pdfs) {
      try {
        console.log(`📖 Baixando: ${pdf.file_name}`)

        // Baixar arquivo do Supabase Storage
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('company-pdf')
          .download(pdf.file_path)

        if (downloadError || !fileData) {
          console.error(`❌ Erro ao baixar ${pdf.file_name}:`, downloadError)
          continue
        }

        // Converter Blob para File para upload na OpenAI
        const file = new File([fileData], pdf.file_name, { type: 'application/pdf' })

        console.log(`📤 Enviando ${pdf.file_name} para OpenAI...`)

        // Upload para OpenAI Files API
        const uploadedFile = await openai.files.create({
          file: file,
          purpose: 'assistants'
        })

        uploadedFileIds.push(uploadedFile.id)
        processedFiles.push(pdf.file_name)
        console.log(`✅ ${pdf.file_name} enviado: ${uploadedFile.id}`)

      } catch (pdfError) {
        console.error(`❌ Erro ao processar ${pdf.file_name}:`, pdfError)
      }
    }

    if (uploadedFileIds.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível processar nenhum PDF' },
        { status: 422 }
      )
    }

    console.log(`🤖 Criando Assistant para análise...`)

    // Criar um Assistant temporário com os arquivos
    const assistant = await openai.beta.assistants.create({
      name: 'PDF Company Data Extractor',
      instructions: EXTRACTION_INSTRUCTIONS,
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
      tool_resources: {
        file_search: {
          vector_stores: [{
            file_ids: uploadedFileIds
          }]
        }
      }
    })

    console.log(`✅ Assistant criado: ${assistant.id}`)

    // Criar thread e enviar mensagem
    const thread = await openai.beta.threads.create()

    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: `Analise os ${uploadedFileIds.length} documento(s) PDF anexados e extraia as informações da empresa conforme as instruções.

Lembre-se:
- APENAS informações EXPLÍCITAS nos documentos
- Campos sem informação clara = ""
- Retorne APENAS o JSON, sem explicações`
    })

    console.log(`🔄 Executando análise...`)

    // Executar o assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    })

    // Aguardar conclusão (polling)
    let runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id })
    let attempts = 0
    const maxAttempts = 60 // 60 * 2s = 2 minutos máximo

    while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      runStatus = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id })
      attempts++

      if (attempts % 5 === 0) {
        console.log(`⏳ Status: ${runStatus.status} (${attempts * 2}s)`)
      }
    }

    if (runStatus.status === 'failed') {
      console.error('❌ Análise falhou:', runStatus.last_error)
      throw new Error('Falha na análise dos PDFs')
    }

    if (runStatus.status !== 'completed') {
      throw new Error('Timeout na análise dos PDFs')
    }

    // Obter resposta
    const messages = await openai.beta.threads.messages.list(thread.id)
    const assistantMessage = messages.data.find(m => m.role === 'assistant')

    if (!assistantMessage || !assistantMessage.content[0]) {
      throw new Error('Sem resposta do assistente')
    }

    const responseContent = assistantMessage.content[0]
    if (responseContent.type !== 'text') {
      throw new Error('Resposta não é texto')
    }

    let responseText = responseContent.text.value
    console.log(`📝 Resposta recebida: ${responseText.substring(0, 200)}...`)

    // Limpar JSON (remover markdown se houver)
    responseText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // Parse do JSON
    const extractedData = JSON.parse(responseText)

    console.log('✅ Dados extraídos com sucesso!')

    // Cleanup: deletar assistant e arquivos
    console.log('🧹 Limpando recursos...')

    try {
      await openai.beta.assistants.delete(assistant.id)
    } catch (e) {
      console.error('Erro ao deletar assistant:', e)
    }

    for (const fileId of uploadedFileIds) {
      try {
        await openai.files.delete(fileId)
      } catch (e) {
        console.error(`Erro ao deletar arquivo ${fileId}:`, e)
      }
    }

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
      processed_files: processedFiles
    })

  } catch (error) {
    console.error('💥 Erro na extração:', error)

    // Cleanup em caso de erro
    for (const fileId of uploadedFileIds) {
      try {
        await openai.files.delete(fileId)
      } catch (e) {
        // Ignora erro no cleanup
      }
    }

    return NextResponse.json(
      {
        error: 'Erro ao processar PDFs',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
