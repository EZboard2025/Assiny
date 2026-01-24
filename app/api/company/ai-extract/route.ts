import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const SYSTEM_PROMPT = `Você é um especialista em análise de empresas para treinamento de vendas B2B/B2C.

Sua tarefa é extrair informações estruturadas de uma página web de empresa para preencher um formulário de treinamento de IA de roleplay de vendas.

CAMPOS A EXTRAIR (retorne JSON):
1. nome - Nome da empresa (apenas o nome, sem slogans ou descrições)
2. descricao - Descrição objetiva do que a empresa faz (1-2 frases curtas)
3. produtos_servicos - Lista dos principais produtos ou serviços oferecidos
4. funcao_produtos - O que cada produto/serviço faz na prática para o cliente
5. diferenciais - Diferenciais competitivos reais da empresa
6. concorrentes - Concorrentes diretos (se mencionados ou implícitos no texto)
7. dados_metricas - Números, métricas, dados verificáveis (ex: "5000+ clientes", "NPS 85")
8. erros_comuns - Deixe sempre como "" (string vazia) - este é um dado interno que não pode ser extraído
9. percepcao_desejada - Como a empresa deseja ser percebida pelo mercado (tom, posicionamento)
10. dores_resolvidas - Problemas/dores que a empresa resolve para seus clientes

REGRAS IMPORTANTES:
- Se não encontrar informação para um campo, retorne "" (string vazia)
- NÃO invente dados ou suposições
- Seja factual e objetivo
- Mantenha textos concisos mas informativos
- Para cada campo, inclua também um nível de confiança de 0 a 1

FORMATO DE RESPOSTA (JSON):
{
  "nome": "string",
  "descricao": "string",
  "produtos_servicos": "string",
  "funcao_produtos": "string",
  "diferenciais": "string",
  "concorrentes": "string",
  "dados_metricas": "string",
  "erros_comuns": "",
  "percepcao_desejada": "string",
  "dores_resolvidas": "string",
  "_confidence": {
    "nome": 0.95,
    "descricao": 0.85,
    "produtos_servicos": 0.80,
    "funcao_produtos": 0.70,
    "diferenciais": 0.65,
    "concorrentes": 0.50,
    "dados_metricas": 0.60,
    "erros_comuns": 0,
    "percepcao_desejada": 0.55,
    "dores_resolvidas": 0.70
  }
}

Retorne APENAS o JSON válido, sem markdown ou texto adicional.`

// Normaliza URL adicionando https:// se não tiver protocolo
function normalizeUrl(url: string): string {
  let normalized = url.trim()
  // Se não começa com http:// ou https://, adiciona https://
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = 'https://' + normalized
  }
  return normalized
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Aceita apenas http e https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    // Bloqueia localhost e IPs privados
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json()

    // 1. Validar URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL é obrigatória' },
        { status: 400 }
      )
    }

    // Normaliza URL (adiciona https:// se necessário)
    const normalizedUrl = normalizeUrl(url)

    if (!isValidUrl(normalizedUrl)) {
      return NextResponse.json(
        { error: 'URL inválida. Use uma URL pública começando com http:// ou https://' },
        { status: 400 }
      )
    }

    console.log('🌐 Iniciando extração de dados de:', normalizedUrl)

    // 2. Scraping com Puppeteer
    let pageContent: {
      title: string
      description: string
      mainContent: string
      h1s: string[]
      h2s: string[]
    }

    try {
      console.log('🔄 Iniciando Puppeteer...')

      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      })

      const page = await browser.newPage()

      // User-Agent realista
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      // Timeout de 30 segundos
      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      })

      // Aguardar um pouco para conteúdo dinâmico
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Extrair conteúdo relevante
      pageContent = await page.evaluate(() => {
        // Remover elementos não relevantes
        const elementsToRemove = document.querySelectorAll(
          'script, style, nav, footer, header, iframe, noscript, svg, [role="navigation"], [role="banner"], [role="contentinfo"]'
        )
        elementsToRemove.forEach(el => el.remove())

        // Extrair título
        const title = document.title || ''

        // Extrair meta description
        const metaDesc = document.querySelector('meta[name="description"]')
        const description = metaDesc?.getAttribute('content') || ''

        // Extrair headings importantes
        const h1Elements = Array.from(document.querySelectorAll('h1'))
        const h1s = h1Elements.map(h => h.innerText.trim()).filter(t => t.length > 0).slice(0, 5)

        const h2Elements = Array.from(document.querySelectorAll('h2'))
        const h2s = h2Elements.map(h => h.innerText.trim()).filter(t => t.length > 0).slice(0, 10)

        // Extrair conteúdo principal (limitar a 15000 caracteres)
        const mainContent = document.body.innerText
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 15000)

        return {
          title,
          description,
          mainContent,
          h1s,
          h2s
        }
      })

      await browser.close()

      console.log('✅ Scraping concluído!')
      console.log('📄 Título:', pageContent.title)
      console.log('📝 Descrição:', pageContent.description?.substring(0, 100))
      console.log('📊 Conteúdo:', pageContent.mainContent.length, 'caracteres')

    } catch (scrapingError) {
      console.error('❌ Erro no scraping:', scrapingError)
      return NextResponse.json(
        {
          error: 'Não foi possível acessar o site. Verifique se a URL está correta e tente novamente.',
          details: scrapingError instanceof Error ? scrapingError.message : 'Erro desconhecido'
        },
        { status: 422 }
      )
    }

    // 3. Verificar se há conteúdo suficiente
    if (pageContent.mainContent.length < 200) {
      console.log('⚠️ Pouco conteúdo encontrado')
      return NextResponse.json({
        success: true,
        data: {
          nome: pageContent.title || '',
          descricao: pageContent.description || '',
          produtos_servicos: '',
          funcao_produtos: '',
          diferenciais: '',
          concorrentes: '',
          dados_metricas: '',
          erros_comuns: '',
          percepcao_desejada: '',
          dores_resolvidas: ''
        },
        confidence: {
          nome: pageContent.title ? 0.5 : 0,
          descricao: pageContent.description ? 0.5 : 0,
          produtos_servicos: 0,
          funcao_produtos: 0,
          diferenciais: 0,
          concorrentes: 0,
          dados_metricas: 0,
          erros_comuns: 0,
          percepcao_desejada: 0,
          dores_resolvidas: 0
        },
        warning: 'Site com pouco conteúdo. Preencha manualmente os campos vazios.',
        source_url: normalizedUrl
      })
    }

    // 4. Processar com OpenAI
    console.log('🤖 Enviando para GPT-4...')

    const userPrompt = `Analise o conteúdo abaixo de um site de empresa e extraia as informações solicitadas:

TÍTULO DA PÁGINA:
${pageContent.title}

META DESCRIÇÃO:
${pageContent.description}

HEADINGS PRINCIPAIS (H1):
${pageContent.h1s.join('\n')}

HEADINGS SECUNDÁRIOS (H2):
${pageContent.h2s.join('\n')}

CONTEÚDO PRINCIPAL:
${pageContent.mainContent}

---

Extraia as informações e retorne o JSON conforme instruído.`

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2000,
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

      // Separar confidence do resto dos dados
      const confidence = extractedData._confidence || {}
      delete extractedData._confidence

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
          erros_comuns: '', // Sempre vazio
          percepcao_desejada: extractedData.percepcao_desejada || '',
          dores_resolvidas: extractedData.dores_resolvidas || ''
        },
        confidence,
        source_url: normalizedUrl
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
        error: 'Erro ao extrair dados do site',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
