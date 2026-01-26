import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const SYSTEM_PROMPTS = {
  objections: `Você é um especialista SÊNIOR em vendas B2B/B2C, treinamento comercial e técnicas de quebra de objeções.

Sua tarefa é analisar o site de uma empresa e gerar objeções DETALHADAS e REALISTAS que clientes potenciais teriam, junto com MÚLTIPLAS formas profissionais de quebrá-las.

IMPORTANTE: Se o usuário fornecer preferências específicas (ex: "objeções sobre tempo", "foco em preço", etc.), você DEVE gerar conteúdo que siga EXATAMENTE essas preferências. As preferências do usuário têm PRIORIDADE MÁXIMA.

Para cada objeção, forneça:
- name: A objeção completa e contextualizada (não genérica). Inclua o MOTIVO por trás da objeção.
  RUIM: "Está caro"
  BOM: "Achei o valor alto considerando que ainda não tenho certeza do retorno que isso vai me trazer"

- rebuttals: Array com 4-5 formas VARIADAS de quebrar a objeção, cobrindo diferentes ângulos:
  1. Abordagem EMOCIONAL (empatia, conexão, validação do sentimento)
  2. Abordagem LÓGICA/ROI (números, dados, comparações financeiras)
  3. Abordagem SOCIAL (casos de sucesso, depoimentos, prova social)
  4. Abordagem TÉCNICA (como funciona, diferenciais específicos)
  5. Pergunta ESTRATÉGICA (fazer o cliente refletir)

REGRAS DE QUALIDADE:
- Gere entre 5 e 8 objeções relevantes para o negócio específico
- As objeções devem ser ESPECÍFICAS para o segmento da empresa (não genéricas)
- Cada rebuttal deve ter entre 2-4 frases completas
- Inclua EXEMPLOS concretos e NÚMEROS quando possível
- Use técnicas de vendas: SPIN Selling, Feel-Felt-Found, Reversão de Risco
- Os rebuttals devem ser persuasivos, empáticos e NÃO agressivos
- Considere objeções de: preço/valor, timing, necessidade real, confiança, concorrência, decisor
- Adapte a linguagem ao tipo de cliente (formal para B2B, mais casual para B2C)

FORMATO DE RESPOSTA (JSON):
{
  "objections": [
    {
      "name": "O valor está acima do que eu tinha planejado investir, não sei se consigo aprovar isso internamente",
      "rebuttals": [
        "Entendo perfeitamente sua preocupação com o orçamento - muitos dos nossos clientes sentiram o mesmo no início. Posso perguntar: se você NÃO resolver esse problema agora, quanto isso está custando para a empresa por mês em [problema específico]? Geralmente quando fazemos essa conta, o investimento se paga em poucos meses.",
        "O interessante é que nossos clientes que mais hesitaram no início são os que mais agradecem depois. Por exemplo, a [empresa similar] economizou R$XX.XXX em 6 meses após implementar nossa solução. Posso te mostrar esse case?",
        "Compreendo a questão da aprovação interna. E se eu preparar uma apresentação com ROI projetado específico para sua operação? Isso costuma ajudar muito na conversa com a diretoria. Além disso, temos condições especiais de parcelamento que podem facilitar.",
        "Deixa eu te fazer uma pergunta: se o valor fosse metade, você fecharia agora? [Se sim] Então a questão não é SE vale a pena, mas COMO viabilizar. Vamos juntos encontrar uma forma que funcione para você."
      ]
    }
  ]
}

Retorne APENAS o JSON válido.`,

  personas: `Você é um especialista em criação de personas para treinamento de vendas.

Sua tarefa é analisar o site de uma empresa e criar personas de clientes ideais para roleplay de vendas.

IMPORTANTE: Se o usuário fornecer preferências específicas (ex: "setor imobiliário", "personas de tecnologia", etc.), você DEVE gerar personas que sigam EXATAMENTE essas preferências. As preferências do usuário têm PRIORIDADE MÁXIMA.

O tipo de negócio será informado (B2B, B2C ou Ambos). Crie personas apropriadas:
- B2B: Foque em cargos, empresas, contextos corporativos
- B2C: Foque em perfis de consumidores, situações pessoais

Para cada persona, forneça TODOS os campos:
- cargo: Cargo/Profissão da pessoa
- tipo_empresa_faturamento: Tipo/tamanho da empresa ou situação financeira pessoal
- contexto: Contexto atual do cliente (desafios, momento)
- busca: O que a persona busca/precisa
- dores: Dores e frustrações principais
- conhecimento_previo: O que a persona já sabe sobre a empresa/produto (ex: "viu anúncio no LinkedIn", "foi indicado por colega", "não conhece a empresa ainda")

REGRAS:
- Gere entre 4 e 6 personas variadas
- Inclua personas fáceis e difíceis de convencer
- Seja específico e realista
- Adapte ao segmento da empresa
- PREENCHA TODOS OS CAMPOS para cada persona

FORMATO DE RESPOSTA (JSON):
{
  "personas": [
    {
      "tipo": "B2B",
      "cargo": "Diretor de Marketing",
      "tipo_empresa_faturamento": "Empresa de médio porte, faturamento R$5-20M/ano",
      "contexto": "Está sob pressão para aumentar leads qualificados com orçamento limitado",
      "busca": "Soluções que provem ROI rápido e sejam fáceis de implementar",
      "dores": "Equipe enxuta, muitas ferramentas desconectadas, dificuldade em provar resultados",
      "conhecimento_previo": "Viu um case de sucesso no LinkedIn e pesquisou sobre a empresa"
    }
  ]
}

Retorne APENAS o JSON válido.`,

  objectives: `Você é um especialista em treinamento de vendas e desenvolvimento de equipes comerciais.

Sua tarefa é analisar o site de uma empresa e criar objetivos de roleplay de vendas específicos para treinar a equipe.

IMPORTANTE: Se o usuário fornecer preferências específicas (ex: "foco em cold calling", "objetivos de negociação", etc.), você DEVE gerar objetivos que sigam EXATAMENTE essas preferências. As preferências do usuário têm PRIORIDADE MÁXIMA.

Para cada objetivo, forneça:
- name: Nome curto do objetivo
- description: Descrição detalhada do que o vendedor deve praticar/demonstrar

REGRAS:
- Gere entre 5 e 8 objetivos de treinamento
- Inclua objetivos de diferentes fases da venda (prospecção, qualificação, apresentação, negociação, fechamento)
- Seja específico para o tipo de produto/serviço da empresa
- Foque em habilidades práticas e mensuráveis

FORMATO DE RESPOSTA (JSON):
{
  "objectives": [
    {
      "name": "Qualificação SPIN",
      "description": "Praticar a técnica SPIN Selling para descobrir dores do cliente através de perguntas de Situação, Problema, Implicação e Necessidade de solução"
    },
    {
      "name": "Contorno de objeção de preço",
      "description": "Desenvolver habilidade de reposicionar a conversa de preço para valor, demonstrando ROI e custo de não agir"
    }
  ]
}

Retorne APENAS o JSON válido.`
}

// Normaliza URL adicionando https:// se não tiver protocolo
function normalizeUrl(url: string): string {
  let normalized = url.trim()
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = 'https://' + normalized
  }
  return normalized
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
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
    const { url, contentType, businessType, customization } = await req.json()

    // Validar parâmetros
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL é obrigatória' },
        { status: 400 }
      )
    }

    if (!contentType || !['objections', 'personas', 'objectives'].includes(contentType)) {
      return NextResponse.json(
        { error: 'Tipo de conteúdo inválido. Use: objections, personas ou objectives' },
        { status: 400 }
      )
    }

    const normalizedUrl = normalizeUrl(url)

    if (!isValidUrl(normalizedUrl)) {
      return NextResponse.json(
        { error: 'URL inválida. Use uma URL pública.' },
        { status: 400 }
      )
    }

    console.log(`🌐 Gerando ${contentType} a partir de:`, normalizedUrl)

    // Scraping com Puppeteer
    let pageContent: {
      title: string
      description: string
      mainContent: string
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

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      })

      await new Promise(resolve => setTimeout(resolve, 2000))

      pageContent = await page.evaluate(() => {
        const elementsToRemove = document.querySelectorAll(
          'script, style, nav, footer, header, iframe, noscript, svg'
        )
        elementsToRemove.forEach(el => el.remove())

        return {
          title: document.title || '',
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          mainContent: document.body.innerText.replace(/\s+/g, ' ').trim().substring(0, 12000)
        }
      })

      await browser.close()

      console.log('✅ Scraping concluído!')

    } catch (scrapingError) {
      console.error('❌ Erro no scraping:', scrapingError)
      return NextResponse.json(
        { error: 'Não foi possível acessar o site.' },
        { status: 422 }
      )
    }

    // Processar com OpenAI
    console.log(`🤖 Gerando ${contentType} com GPT-4...`)

    let userPrompt = `Analise o site da empresa abaixo e gere ${contentType === 'objections' ? 'objeções de clientes com rebuttals' : contentType === 'personas' ? 'personas de clientes' : 'objetivos de roleplay'}:

EMPRESA: ${pageContent.title}
DESCRIÇÃO: ${pageContent.description}

CONTEÚDO DO SITE:
${pageContent.mainContent}
`

    if (contentType === 'personas' && businessType) {
      userPrompt += `\n\nTIPO DE NEGÓCIO: ${businessType}\nGere personas apropriadas para esse modelo de negócio.`
    }

    // Adicionar personalização do usuário se fornecida
    if (customization && typeof customization === 'string' && customization.trim()) {
      console.log(`📝 Customização recebida: "${customization.trim()}"`)
      userPrompt += `\n\n⚠️ INSTRUÇÃO IMPORTANTE - PREFERÊNCIAS ESPECÍFICAS DO USUÁRIO:
"${customization.trim()}"

VOCÊ DEVE OBRIGATORIAMENTE seguir essas preferências ao gerar o conteúdo. Esta é a prioridade máxima.`
    }

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
            { role: 'system', content: SYSTEM_PROMPTS[contentType as keyof typeof SYSTEM_PROMPTS] },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
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
      const generatedContent = JSON.parse(openaiData.choices[0].message.content)

      console.log(`✅ ${contentType} gerados com sucesso!`)

      return NextResponse.json({
        success: true,
        contentType,
        data: generatedContent,
        source_url: normalizedUrl
      })

    } catch (aiError) {
      console.error('❌ Erro no processamento com IA:', aiError)
      return NextResponse.json(
        { error: 'Erro ao gerar conteúdo com IA' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('💥 Erro geral:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição' },
      { status: 500 }
    )
  }
}
