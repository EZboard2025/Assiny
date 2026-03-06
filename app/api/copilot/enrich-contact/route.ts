import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PLAN_CONFIGS, PlanType } from '@/lib/types/plans'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// ─── Enrich Contact - Pre-meeting Briefing ──────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    const { name, company, phone } = await request.json()
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Nome do contato é obrigatório' }, { status: 400 })
    }

    // Get company ID
    const { data: employeeData } = await supabaseAdmin
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const companyId = employeeData?.company_id
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    // Check credits
    const { data: companyCredits } = await supabaseAdmin
      .from('companies')
      .select('training_plan, monthly_credits_used, monthly_credits_reset_at, extra_monthly_credits')
      .eq('id', companyId)
      .single()

    if (companyCredits) {
      const lastReset = new Date(companyCredits.monthly_credits_reset_at)
      const now = new Date()
      const isNewMonth = now.getMonth() !== lastReset.getMonth() ||
                         now.getFullYear() !== lastReset.getFullYear()

      let currentCreditsUsed = companyCredits.monthly_credits_used || 0
      let currentExtraCredits = companyCredits.extra_monthly_credits || 0

      if (isNewMonth) {
        await supabaseAdmin
          .from('companies')
          .update({ monthly_credits_used: 0, extra_monthly_credits: 0, monthly_credits_reset_at: now.toISOString() })
          .eq('id', companyId)
        currentCreditsUsed = 0
        currentExtraCredits = 0
      }

      const planConfig = PLAN_CONFIGS[companyCredits.training_plan as PlanType]
      const baseLimit = planConfig?.monthlyCredits

      if (baseLimit !== null) {
        const totalLimit = baseLimit + currentExtraCredits
        const remaining = totalLimit - currentCreditsUsed

        if (remaining <= 0) {
          return NextResponse.json(
            { error: 'Limite de créditos atingido', message: 'Sua empresa atingiu o limite de créditos mensais.' },
            { status: 403 }
          )
        }
      }
    }

    // ─── 1. Search WhatsApp conversations for contact match ───────────────
    let waConversations: any[] = []

    if (phone) {
      // Phone is the strongest anchor
      const phoneSuffix = phone.replace(/\D/g, '').slice(-9)
      const { data } = await supabaseAdmin
        .from('whatsapp_conversations')
        .select('*')
        .eq('user_id', user.id)
        .ilike('contact_phone', `%${phoneSuffix}%`)
        .limit(5)
      waConversations = data || []
    }

    if (!waConversations.length) {
      // Search by name
      const { data } = await supabaseAdmin
        .from('whatsapp_conversations')
        .select('*')
        .eq('user_id', user.id)
        .ilike('contact_name', `%${name}%`)
        .limit(5)
      waConversations = data || []
    }

    // ─── 2. Get recent messages for matched contacts ──────────────────────
    let recentMessages: any[] = []
    if (waConversations.length > 0) {
      const contactPhone = waConversations[0].contact_phone
      const { data: msgs } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('content, direction, message_timestamp, contact_name')
        .eq('user_id', user.id)
        .eq('contact_phone', contactPhone)
        .not('content', 'is', null)
        .order('message_timestamp', { ascending: false })
        .limit(20)
      recentMessages = (msgs || []).reverse()
    }

    // ─── 3. Web search for LinkedIn/public profile (background) ────────────
    let webProfile = ''
    let rawLinkedinUrls: string[] = []
    try {
      const searchQuery = `${name} ${company || ''} LinkedIn`
      // Brave Search returns server-rendered HTML with real results (no bot blocking)
      const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(searchQuery)}&source=web`

      let snippets = ''
      try {
          const searchRes = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
              'Accept': 'text/html',
            },
            signal: AbortSignal.timeout(8000),
          })
          if (searchRes.ok) {
            const html = await searchRes.text()
            // Extract LinkedIn profile URLs from raw HTML before stripping tags
            const profileMatches = html.match(/(?:https?:\/\/)?(?:[a-z]{2}\.)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/g)
            if (profileMatches) {
              const unique = [...new Set(profileMatches.map(u => u.startsWith('http') ? u : `https://${u}`))]
              rawLinkedinUrls.push(...unique)
            }
            snippets = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&[a-z]+;/gi, ' ')
              .replace(/\s+/g, ' ')
              .slice(0, 4000)
          }
      } catch (_) { /* search failed, continue without web data */ }

      if (snippets.length > 200) {
        const extractResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `Extraia informações profissionais da pessoa "${name}"${company ? ` da empresa "${company}"` : ''} a partir dos resultados de busca. Retorne APENAS o que encontrar de concreto (não invente):
- Cargo/título atual
- Empresa atual
- Localização
- Setor/indústria
- Experiência relevante (breve)
- URL do perfil LinkedIn (se encontrar)
Se não encontrar alguma info, omita. Se não encontrar NADA, diga "Nenhuma informação encontrada". Formato: texto corrido, máximo 100 palavras.`
            },
            { role: 'user', content: snippets }
          ],
          temperature: 0.2,
          max_tokens: 300,
        })
        webProfile = extractResponse.choices[0].message.content || ''
      }
    } catch (err) {
      console.log('[Enrich] Web search failed (non-blocking):', (err as Error).message)
    }

    // ─── 4. RAG - Find relevant examples and company knowledge ────────────
    const embeddingText = `preparar reunião com ${name} ${company || ''} abordagem vendas`
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText.slice(0, 8000)
    })
    const embedding = embeddingResponse.data[0].embedding

    const [successResult, companyKnowledgeResult] = await Promise.allSettled([
      supabaseAdmin.rpc('match_followup_success', {
        query_embedding: embedding,
        company_id_filter: companyId,
        match_threshold: 0.4,
        match_count: 3
      }),
      supabaseAdmin.rpc('match_company_knowledge', {
        query_embedding: embedding,
        match_threshold: 0.5,
        match_count: 3
      })
    ])

    const successExamples = successResult.status === 'fulfilled' ? successResult.value.data || [] : []
    const companyKnowledge = companyKnowledgeResult.status === 'fulfilled' ? companyKnowledgeResult.value.data || [] : []

    // ─── 5. Determine confidence level ────────────────────────────────────
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low'
    let matchSource: 'whatsapp_phone' | 'whatsapp_name' | 'web_search' | 'manual' = 'manual'

    if (phone && waConversations.length > 0) {
      confidenceLevel = 'high'
      matchSource = 'whatsapp_phone'
    } else if (waConversations.length > 0) {
      confidenceLevel = 'medium'
      matchSource = 'whatsapp_name'
    } else if (webProfile) {
      confidenceLevel = 'medium'
      matchSource = 'web_search'
    }

    // ─── 6. Extract real LinkedIn profile URL: GPT output → raw HTML → search fallback ────────
    const linkedinProfileRegex = /https?:\/\/(?:[a-z]{2}\.)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/
    const linkedinProfileMatch = webProfile.match(linkedinProfileRegex)
    const linkedinQuery = encodeURIComponent(`${name} ${company || ''}`.trim())
    const linkedinUrl = linkedinProfileMatch
      ? linkedinProfileMatch[0]
      : rawLinkedinUrls.length > 0
        ? rawLinkedinUrls[0]
        : `https://www.linkedin.com/search/results/all/?keywords=${linkedinQuery}`

    // ─── 7. Generate briefing via GPT-4o (enriched with web data) ─────────
    const conversationSummary = recentMessages.length > 0
      ? recentMessages.map(m => `[${m.direction === 'outbound' ? 'Vendedor' : 'Lead'}]: ${m.content}`).join('\n')
      : 'Nenhuma conversa anterior encontrada.'

    const examplesContext = successExamples.length > 0
      ? successExamples.map((e: any) => e.content?.slice(0, 300)).join('\n---\n')
      : 'Nenhum exemplo disponível.'

    const knowledgeContext = companyKnowledge.length > 0
      ? companyKnowledge.map((k: any) => k.content?.slice(0, 300)).join('\n')
      : ''

    const briefingResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Gere um briefing pré-reunião conciso em português BR com estas seções:
- **Perfil do Prospect**: Nome, cargo, empresa, setor, localização (use dados reais da busca web/LinkedIn)
- **Histórico de Interação**: Resumo das conversas anteriores no WhatsApp. Se não houver, diga explicitamente
- **Inteligência Competitiva**: O que sabemos sobre a empresa/setor do prospect
- **Pontos de Atenção**: Objeções prováveis baseadas no perfil e histórico
- **Estratégia de Abordagem**: 2-3 táticas específicas baseadas nos exemplos de sucesso
- **Perguntas SPIN Recomendadas**: 1 situacional + 1 de problema personalizadas para este prospect

REGRAS: Use APENAS informações reais. NUNCA invente dados. Máximo 300 palavras.`
        },
        {
          role: 'user',
          content: `CONTATO: ${name}${company ? ` | Empresa: ${company}` : ''}${phone ? ` | Tel: ${phone}` : ''}

DADOS DO LINKEDIN / WEB (pesquisa automática):
${webProfile || 'Nenhuma informação pública encontrada.'}

CONVERSAS WHATSAPP:
${conversationSummary}

ABORDAGENS BEM-SUCEDIDAS (RAG):
${examplesContext}

CONHECIMENTO DA NOSSA EMPRESA:
${knowledgeContext || 'Não disponível.'}`
        }
      ],
      temperature: 0.6,
      max_tokens: 800,
    })

    const briefing = briefingResponse.choices[0].message.content || ''

    // ─── 8. Consume credit ────────────────────────────────────────────────
    if (companyCredits) {
      await supabaseAdmin
        .from('companies')
        .update({ monthly_credits_used: (companyCredits.monthly_credits_used || 0) + 1 })
        .eq('id', companyId)
    }

    return NextResponse.json({
      success: true,
      confidence_level: confidenceLevel,
      match_source: matchSource,
      contact: waConversations[0] || { name, company, phone },
      recent_messages_count: recentMessages.length,
      recent_messages_preview: recentMessages.slice(-5).map(m => ({
        direction: m.direction,
        content: m.content?.slice(0, 100),
        timestamp: m.message_timestamp
      })),
      web_profile: webProfile || null,
      briefing,
      linkedin_url: linkedinUrl,
      success_examples_count: successExamples.length,
    })

  } catch (error) {
    console.error('[Enrich Contact] Error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
