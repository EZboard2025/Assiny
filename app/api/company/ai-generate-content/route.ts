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

  personas: `Você é um especialista SÊNIOR em criação de personas para treinamento de vendas usando metodologia SPIN Selling.

Sua tarefa é analisar o site de uma empresa e criar personas de clientes EXTREMAMENTE DETALHADAS para roleplay de vendas.

IMPORTANTE: Se o usuário fornecer preferências específicas (ex: "setor imobiliário", "personas de tecnologia", etc.), você DEVE gerar personas que sigam EXATAMENTE essas preferências. As preferências do usuário têm PRIORIDADE MÁXIMA.

O tipo de negócio será informado (B2B, B2C ou Ambos). Crie personas apropriadas:
- B2B: Foque em cargos com hierarquia clara, empresas com detalhes operacionais, contextos corporativos ricos
- B2C: Foque em perfis socioeconômicos detalhados, rotinas diárias, situações pessoais específicas

REQUISITOS OBRIGATÓRIOS PARA CADA CAMPO:

1. cargo (B2B) / perfil (B2C):
   - B2B: Cargo específico + nível hierárquico + área de atuação + responsabilidades principais
   - B2C: Profissão + idade + estado civil + características demográficas relevantes
   - Exemplo B2B: "Gerente Comercial Sênior, responsável por uma equipe de 8 vendedores, reporta ao Diretor de Vendas"
   - Exemplo B2C: "Engenheiro civil, 35 anos, casado, pai de 2 filhos, renda familiar de R$18.000/mês"

2. tipo_empresa_faturamento (B2B) / perfil_socioeconomico (B2C):
   - B2B: Segmento + porte + faturamento anual específico + número de funcionários + região de atuação
   - B2C: Classe social + faixa de renda mensal/anual + patrimônio + estilo de vida + localização
   - Exemplo B2B: "Distribuidora de alimentos, médio porte, faturamento de R$25-40M/ano, 120 funcionários, atua no Sudeste"
   - Exemplo B2C: "Classe B, renda familiar R$15-20k/mês, apartamento próprio, mora em bairro nobre de capital"

3. contexto:
   - DEVE incluir: situação atual detalhada + estrutura/processos existentes + rotina diária + mecanismos de mensuração atuais + momento específico
   - Exemplo B2B: "A empresa cresceu 30% no último ano mas a equipe comercial não acompanhou. Usa planilhas para controle de vendas, não tem CRM. O gerente passa 60% do dia em reuniões e revisando relatórios manuais. Metas são definidas trimestralmente mas não há acompanhamento em tempo real. Acabaram de perder 2 vendedores experientes."
   - Exemplo B2C: "Trabalha home office 3x por semana, rotina intensa entre trabalho e cuidar dos filhos. Pesquisa produtos online à noite após as crianças dormirem. Já tentou outras soluções similares mas abandonou por falta de tempo. Está em um momento de reorganização financeira após comprar casa nova."

4. busca:
   - DEVE incluir: objetivo principal + metas mensuráveis + critérios de decisão + prazo desejado
   - Exemplo B2B: "Precisa aumentar a taxa de conversão de 15% para 25% nos próximos 6 meses. Busca solução que se integre ao ERP atual, tenha implementação em até 30 dias, e ofereça relatórios automáticos para apresentar ao board."
   - Exemplo B2C: "Quer resolver o problema em até 2 semanas, com orçamento máximo de R$3.000, precisa de garantia de satisfação, valoriza atendimento rápido via WhatsApp."

5. dores:
   - DEVE incluir: problemas específicos + IMPACTO FINANCEIRO QUANTIFICADO + consequências emocionais/profissionais + tentativas anteriores fracassadas
   - Exemplo B2B: "Perde cerca de R$150k/mês em oportunidades não acompanhadas. Equipe desmotivada pela falta de ferramentas adequadas - turnover de 40% ao ano. Já tentou 2 sistemas diferentes que foram abandonados pela equipe. CEO cobra resultados semanalmente e a pressão está aumentando."
   - Exemplo B2C: "Gasta R$800/mês em soluções paliativas que não resolvem o problema. Frustrado por já ter tentado 3 alternativas sem sucesso. O problema afeta a qualidade de vida familiar e causa discussões com o cônjuge. Sente-se perdendo tempo precioso que poderia dedicar aos filhos."

6. conhecimento_previo:
   - Como conheceu a empresa + o que já pesquisou + impressões iniciais + objeções potenciais
   - Exemplo: "Viu anúncio no LinkedIn, leu 2 artigos do blog, assistiu um webinar. Achou interessante mas tem dúvidas sobre o preço. Concorrente X ofereceu proposta 20% mais barata."

REGRAS DE QUALIDADE:
- Gere entre 4 e 6 personas com níveis diferentes de dificuldade (fácil, médio, difícil de converter)
- TODOS os campos devem ter pelo menos 3 frases detalhadas
- Use NÚMEROS ESPECÍFICOS sempre (valores, percentuais, quantidades, prazos)
- Inclua IMPACTOS FINANCEIROS nas dores (quanto custa o problema por mês/ano)
- Mencione PROCESSOS E ROTINAS atuais do cliente
- Adicione METAS MENSURÁVEIS no que busca
- As personas devem ser prontas para SPIN Selling (Situação, Problema, Implicação, Necessidade)

FORMATO DE RESPOSTA (JSON):
{
  "personas": [
    {
      "tipo": "B2B",
      "cargo": "Diretor Comercial, 15 anos de experiência em vendas B2B, lidera equipe de 12 vendedores e 3 SDRs, reporta diretamente ao CEO",
      "tipo_empresa_faturamento": "Indústria de embalagens plásticas, médio porte, faturamento de R$35M/ano, 180 funcionários, matriz em SP com filiais em MG e PR",
      "contexto": "A empresa dobrou de tamanho em 3 anos mas os processos de vendas não evoluíram. Ainda usa planilhas Excel para pipeline, sem visibilidade real das oportunidades. O diretor gasta 3 horas por dia consolidando relatórios manualmente. Equipe trabalha de forma descentralizada, cada vendedor tem seu próprio método. Metas são revistas apenas no final do trimestre, quando já é tarde para correções. Recentemente a diretoria cobrou maior previsibilidade nas receitas.",
      "busca": "Precisa de uma solução que unifique o processo comercial de toda a equipe em até 60 dias. Meta: reduzir tempo de fechamento de 45 para 30 dias e aumentar previsibilidade de forecast de 60% para 85%. Quer relatórios automáticos semanais para o board. Orçamento aprovado de até R$5k/mês.",
      "dores": "Estima perder R$200k/mês em deals que esfriam por falta de follow-up sistemático. Turnover de vendedores de 35% ao ano - os bons saem por frustração com processos arcaicos. Já tentou implementar 2 CRMs diferentes (Pipedrive e HubSpot) mas a equipe abandonou em menos de 3 meses. CEO ameaçou trocar a liderança comercial se os resultados não melhorarem no próximo trimestre.",
      "conhecimento_previo": "Indicação de um colega diretor que usa a solução. Já acessou o site, viu cases de empresas do mesmo porte. Preocupado se a equipe vai realmente usar, dado o histórico de fracassos com ferramentas anteriores."
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
          max_tokens: 4500,
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
