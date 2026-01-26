import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const SYSTEM_PROMPT = `Você é um extrator de dados de empresas com ZERO TOLERÂNCIA para alucinação ou invenção de informações.

⚠️ REGRA ABSOLUTA - NUNCA ALUCINAR:
- Você deve APENAS extrair informações que estão EXPLICITAMENTE presentes no texto fornecido
- Se uma informação NÃO está claramente escrita no conteúdo, retorne "" (string vazia)
- NUNCA invente, suponha, deduza ou "complete" informações que não existem
- É MELHOR deixar um campo vazio do que colocar informação inventada ou genérica
- Texto genérico como "soluções inovadoras" ou "atendimento de qualidade" NÃO conta como informação real

CAMPOS A EXTRAIR (retorne JSON):

1. nome
   - Apenas o nome da empresa (sem slogans)
   - Extrair EXATAMENTE como aparece no site
   - Se não encontrar o nome exato, deixe ""

2. descricao
   - O que a empresa FAZ de forma objetiva
   - Use APENAS informações do texto, não resuma com suas próprias palavras genéricas
   - Se o site só tem frases de marketing vagas, deixe ""

3. produtos_servicos
   - Liste APENAS produtos/serviços com NOMES ESPECÍFICOS mencionados no site
   - Formato: "• Produto1 - descrição breve | • Produto2 - descrição breve"
   - Se não há produtos/serviços nomeados explicitamente, deixe ""
   - NÃO use termos genéricos como "consultoria", "soluções" sem especificação

4. funcao_produtos
   - O que cada produto/serviço FAZ NA PRÁTICA para o cliente
   - Extrair funcionalidades ESPECÍFICAS mencionadas no site
   - Exemplo bom: "O sistema X automatiza emissão de NF, controla estoque em tempo real, gera relatórios de vendas"
   - Exemplo ruim (NÃO USE): "ajuda empresas a crescer", "melhora a produtividade"
   - Se o site só tem frases genéricas, deixe ""

5. diferenciais
   - Diferenciais que são ESPECÍFICOS e VERIFICÁVEIS
   - Exemplo bom: "Única empresa com certificação ISO 9001 no setor", "Suporte 24h com SLA de 2h"
   - Exemplo ruim (NÃO USE): "qualidade", "inovação", "confiança", "excelência"
   - Se só há diferenciais genéricos no site, deixe ""

6. concorrentes
   - APENAS se a empresa MENCIONAR concorrentes PELO NOME no site
   - Formato: "Nome1, Nome2, Nome3"
   - NÃO invente concorrentes baseado no setor
   - Se não há menção explícita a concorrentes, OBRIGATORIAMENTE deixe ""
   - Este campo geralmente fica vazio - isso é esperado e correto

7. dados_metricas (Provas Sociais)
   - Elementos de prova social EXPLICITAMENTE presentes no site
   - Inclui: métricas com números, depoimentos de clientes, cases de sucesso, prêmios, certificações, logos de clientes conhecidos, selos de qualidade
   - Exemplos: "500+ clientes ativos", "NPS 85", "Certificação ISO 9001", "Case: Empresa X aumentou vendas em 40%", "Ganhador do Prêmio Y 2024", "Clientes: Magazine Luiza, Ambev, Natura"
   - DEVE haver informação REAL no site - não invente prêmios ou clientes
   - Se não há provas sociais explícitas, deixe ""

8. erros_comuns
   - SEMPRE deixe como "" - este campo é preenchido manualmente

9. percepcao_desejada
   - Como a empresa se POSICIONA no mercado
   - Extrair apenas se houver declaração clara de posicionamento
   - Exemplo: "Líder em tecnologia para pequenas empresas", "Referência em sustentabilidade"
   - Se só há frases de marketing vagas, deixe ""

10. dores_resolvidas
    - Problemas ESPECÍFICOS que a empresa diz resolver
    - Deve estar explícito no texto que isso é um problema que eles resolvem
    - Exemplo bom: "Elimina retrabalho manual em processos de RH", "Reduz tempo de atendimento de 2h para 15min"
    - Exemplo ruim (NÃO USE): "ajuda com desafios do dia a dia", "resolve problemas de gestão"
    - Se não há dores específicas mencionadas, deixe ""

🚨 LEMBRE-SE:
- Campos vazios são PREFERÍVEIS a informações inventadas ou genéricas
- Confidence baixa (< 0.5) = provavelmente deve ser ""
- Se você está "deduzindo" ou "supondo", a resposta correta é ""
- O usuário pode completar manualmente - não "ajude" inventando dados

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
  "dores_resolvidas": "",
  "_confidence": {
    "nome": 0,
    "descricao": 0,
    "produtos_servicos": 0,
    "funcao_produtos": 0,
    "diferenciais": 0,
    "concorrentes": 0,
    "dados_metricas": 0,
    "erros_comuns": 0,
    "percepcao_desejada": 0,
    "dores_resolvidas": 0
  }
}`

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

    const userPrompt = `TAREFA: Extrair APENAS informações EXPLÍCITAS do conteúdo abaixo.

⚠️ ALERTA ANTI-ALUCINAÇÃO:
- Se a informação NÃO ESTÁ ESCRITA no texto, o campo deve ser ""
- Não invente concorrentes, métricas, ou funcionalidades
- Não use frases genéricas como "soluções inovadoras" ou "atendimento de qualidade"
- É melhor deixar VAZIO do que inventar

===== CONTEÚDO DO SITE =====

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
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 2500,
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
