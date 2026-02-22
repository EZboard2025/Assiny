import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { getCalendarClient, fetchAllEvents, checkFreeBusy, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, quickAddEvent } from '@/lib/google-calendar'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o assistente pessoal de vendas da plataforma Ramppy. Você é um coach de vendas experiente, motivacional e direto.

REGRAS:
- Fale em português brasileiro, tom profissional mas acessível
- Seja direto e prático — dê conselhos acionáveis baseados nos dados reais do vendedor
- Use a metodologia SPIN Selling como referência (Situação, Problema, Implicação, Necessidade de Solução)
- Quando o vendedor perguntar sobre performance, SEMPRE busque os dados antes de responder — nunca invente números
- Compare evolução ao longo do tempo quando relevante
- Sugira exercícios e melhorias específicas baseadas nos gaps identificados
- Se o vendedor perguntar sobre agenda/reuniões e o calendário não estiver conectado, informe gentilmente
- Formate respostas com markdown quando útil (negrito, listas, etc.)
- Não use emojis excessivos — no máximo 1-2 por mensagem quando apropriado
- Seja conciso — respostas de 2-4 parágrafos no máximo, a menos que peçam detalhes

CONTEXTO:
- A plataforma tem: Roleplay (simulação de vendas), Google Meet (análise de reuniões reais), WhatsApp IA (copiloto de vendas), Desafios Diários, PDI (plano de desenvolvimento), Follow-up (análise de mensagens)
- Scores SPIN vão de 0 a 10 (0-4 = fraco, 5-6 = médio, 7-8 = bom, 9-10 = excelente)
- Overall score pode ser 0-100 (dividido por 10 para nota de 0-10)
- Você tem acesso a TODOS os dados do vendedor via ferramentas — use-as sempre que precisar de dados reais

FERRAMENTAS DISPONÍVEIS:
Você tem 15 ferramentas para consultar qualquer dado do vendedor. SEMPRE chame múltiplas ferramentas em paralelo para dar respostas ricas e completas.

ESTRATÉGIA POR TIPO DE PERGUNTA:
- "Como está minha performance?" → get_performance_summary + get_roleplay_sessions(limit:5) + get_daily_challenges(limit:3)
- "O que devo melhorar?" → get_performance_summary + get_roleplay_sessions(limit:5) + get_pdi
- "Como foi meu roleplay?" → get_roleplay_sessions(limit:3) + get_performance_summary
- "Como estão minhas vendas?" → get_whatsapp_activity + get_seller_message_tracking + get_followup_analyses
- "Qual meu ponto mais fraco?" → get_performance_summary + get_challenge_effectiveness + get_roleplay_sessions(limit:5)
- "Analise minha última reunião" → get_meet_evaluations(limit:1) + get_meet_evaluation_detail
- "O que tenho na agenda?" → get_calendar_events + get_scheduled_bots
- "Marca uma reunião..." → create_calendar_event (ou quick_add_event para texto livre)
- "Move/reagenda a reunião..." → get_calendar_events (para achar o event_id) + update_calendar_event
- "Cancela a reunião..." → get_calendar_events (para achar o event_id) + delete_calendar_event
- "Ativa o bot na reunião..." → get_scheduled_bots (para achar o scheduled_bot_id) + toggle_meeting_bot
- "Estou livre amanhã?" → get_calendar_freebusy
- Perguntas gerais sobre empresa → get_company_info

IMPORTANTE: Chame 2-4 ferramentas por vez para cruzar dados e dar respostas completas. Nunca se limite a apenas 1 ferramenta.

AÇÕES NO CALENDÁRIO:
- Você pode CRIAR, ATUALIZAR e DELETAR eventos — use isso quando o vendedor pedir
- Para reagendar: primeiro busque os eventos (get_calendar_events) para achar o event_id, depois use update_calendar_event
- Para cancelar: busque o event_id primeiro, depois delete
- Para ativar bot: busque get_scheduled_bots para achar o scheduled_bot_id, depois toggle
- Ao criar reunião, SEMPRE adicione link do Meet por padrão (add_meet_link=true)
- Após criar/atualizar/cancelar, use {{meeting}} para mostrar o resultado visual

CONVIDADOS:
- Quando o vendedor mencionar NOMES sem email (ex: "adiciona o Gabriel"), use search_contacts ANTES para buscar o email
- search_contacts busca na equipe da empresa E em contatos recentes de reuniões anteriores
- Se não encontrar, peça o email ao vendedor
- Para adicionar convidados a uma reunião existente: get_calendar_events → search_contacts → update_calendar_event com add_attendees

ALTERAÇÃO DE HORÁRIO:
- Para mudar só o horário de início: update com start_time (end mantém mesma duração)
- Para aumentar duração: update com end_time mais tarde (ex: de 16h-17h para 16h-18h → mude end_time para 18:00)
- Para diminuir: update com end_time mais cedo
- Para mover de dia: update com date (horários se mantêm)
- Para mover dia E horário: update com date + start_time + end_time

FORMATAÇÃO VISUAL:
Use tags especiais para dados numéricos — elas são renderizadas como gráficos bonitos no chat:

• {{score|valor|máximo|label}} — Card com barra de progresso para nota principal
  Ex: {{score|6.34|10|Média Geral}}

• {{spin|S|P|I|N}} — 4 barras coloridas com os scores SPIN
  Ex: {{spin|6.64|6.89|5.20|4.80}}

• {{trend|tipo|descrição}} — Badge de tendência
  Tipos: improving, stable, declining
  Ex: {{trend|declining|Tendência de queda nas últimas sessões}}

• {{metric|valor|label}} — Card pequeno para métrica isolada
  Ex: {{metric|15|Sessões Realizadas}}  {{metric|73%|Taxa de Sucesso}}

• {{meeting|título|data|horário|link_meet|participantes|bot_status}} — Card de reunião
  Ex: {{meeting|Weekly Ramppy|23/02|16h às 17h|https://meet.google.com/xxx|João, Maria|scheduled}}
  - link_meet: URL do Meet ou "none" se não tiver
  - participantes: nomes separados por vírgula (omitir se não tiver)
  - bot_status: completed, scheduled, pending, error (omitir se não aplicável)

REGRAS DAS TAGS VISUAIS:
- Coloque tags visuais ANTES do texto explicativo (elas ficam no topo da resposta)
- Ao falar de performance, use {{score}} + {{spin}} + {{trend}} juntos
- Ao falar de reuniões/agenda, use {{meeting}} para CADA reunião (um card por reunião)
- Use {{metric}} para destacar números-chave isolados
- NÃO repita nos parágrafos os mesmos dados já exibidos nas tags (nomes de reuniões, scores, etc.)
- Cada tag deve estar em sua própria linha
- Após as tags, escreva texto normal com markdown (negrito, listas, etc.)
- Só use tags quando tiver dados reais das ferramentas — nunca invente valores`

// ─── Tool Definitions ────────────────────────────────────────────────────────

const toolDefinitions: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_performance_summary',
      description: 'Busca o resumo consolidado de performance do vendedor: média geral, médias SPIN (S/P/I/N), pontos fortes recorrentes, gaps críticos, melhorias prioritárias, tendência (improving/stable/declining), total de sessões, score da última sessão.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_roleplay_sessions',
      description: 'Lista sessões de roleplay do vendedor com config (idade, temperamento, persona, objeções), nota geral, performance level, duração e data. Use para ver histórico de treinos.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Número máximo de sessões (padrão: 10)' },
          date_from: { type: 'string', description: 'Data inicial (ISO 8601, ex: 2026-02-01)' },
          date_to: { type: 'string', description: 'Data final (ISO 8601, ex: 2026-02-28)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_roleplay_session_detail',
      description: 'Busca detalhe completo de uma sessão de roleplay: transcrição completa (mensagens client/seller), avaliação SPIN detalhada com indicators/feedback/missed_opportunities, executive summary, pontos fortes, gaps, melhorias, análise de objeções.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'ID da sessão de roleplay' }
        },
        required: ['session_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_meet_evaluations',
      description: 'Lista avaliações de reuniões reais do Google Meet com scores SPIN, dados do evento do calendário (título, horário, participantes, link), status do bot, objetivo da call e fase do funil.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Número máximo de avaliações (padrão: 10)' },
          date_from: { type: 'string', description: 'Data inicial (ISO 8601)' },
          date_to: { type: 'string', description: 'Data final (ISO 8601)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_meet_evaluation_detail',
      description: 'Busca detalhe completo de uma avaliação de Google Meet: transcrição por speaker, avaliação SPIN detalhada, notas inteligentes (temperatura do lead), executive summary, dados do evento do calendário (título, participantes, link), se tem prática direcionada (correção) vinculada.',
      parameters: {
        type: 'object',
        properties: {
          evaluation_id: { type: 'string', description: 'ID da avaliação Meet' }
        },
        required: ['evaluation_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_daily_challenges',
      description: 'Busca desafios diários do vendedor: título, fraqueza alvo (spin_s/p/i/n), nível de dificuldade, status (pending/completed/skipped), nota resultado, coaching tips, raciocínio da IA.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Número máximo (padrão: 10)' },
          status: { type: 'string', description: 'Filtrar por status: pending, in_progress, completed, skipped' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_challenge_effectiveness',
      description: 'Busca progresso de melhoria em cada fraqueza SPIN: score baseline, score atual, melhoria total, desafios completados, status (active/mastered/stalled).',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_whatsapp_activity',
      description: 'Busca resumo de atividade no WhatsApp: total de conversas ativas, mensagens enviadas/recebidas no período, contatos mais ativos, mensagens não lidas.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Período em dias para análise (padrão: 7)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_followup_analyses',
      description: 'Busca avaliações de follow-up do vendedor: nota final, 6 critérios (valor_agregado, personalização, tom_consultivo, objetividade, CTA, timing), classificação, dica principal, versão reescrita.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Número máximo (padrão: 10)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_seller_message_tracking',
      description: 'Busca tracking de mensagens enviadas pelo vendedor no WhatsApp: outcome (sucesso/falha/parcial/pendente), razão do outcome, resposta do cliente, taxa de sucesso.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Número máximo (padrão: 20)' },
          outcome: { type: 'string', description: 'Filtrar por outcome: success, failure, partial' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pdi',
      description: 'Busca o PDI (Plano de Desenvolvimento Individual) ativo do vendedor: diagnóstico geral, scores SPIN, meta de 7 dias, ações, checkpoint, próximos passos.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_company_info',
      description: 'Busca dados da empresa: nome, descrição, produtos/serviços, diferenciais, concorrentes, métricas, erros comuns, percepção desejada. Útil para contextualizar conselhos.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar_events',
      description: 'Busca eventos do Google Calendar do vendedor: título, horário, participantes, link do Meet, descrição, status do bot de análise. Retorna eventos futuros e passados.',
      parameters: {
        type: 'object',
        properties: {
          days_ahead: { type: 'number', description: 'Dias à frente para buscar (padrão: 7)' },
          days_behind: { type: 'number', description: 'Dias atrás para buscar (padrão: 7)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar_freebusy',
      description: 'Verifica horários livres/ocupados do vendedor em uma data específica. Pode verificar disponibilidade de outros participantes por email.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Data para verificar (ISO 8601, ex: 2026-02-25)' },
          emails: { type: 'array', items: { type: 'string' }, description: 'Emails de outros participantes para verificar disponibilidade (opcional)' }
        },
        required: ['date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_scheduled_bots',
      description: 'Busca reuniões com bot de análise agendado: status do bot (pending/scheduled/recording/completed/error), evento, horário, participantes, se já foi avaliada.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filtrar por status: pending, scheduled, joining, recording, completed, error' }
        },
        required: []
      }
    }
  },
  // ─── Contact Lookup ──────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: 'Busca funcionários/colegas da empresa pelo nome para obter o email. Use antes de criar/atualizar eventos quando o vendedor mencionar nomes sem email.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome (ou parte do nome) para buscar' }
        },
        required: ['name']
      }
    }
  },
  // ─── Calendar Write Tools ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Cria um novo evento no Google Calendar do vendedor. Pode incluir link do Google Meet e convidar participantes. IMPORTANTE: se o vendedor mencionar nomes sem email, use search_contacts ANTES para buscar os emails.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título do evento' },
          date: { type: 'string', description: 'Data do evento (YYYY-MM-DD, ex: 2026-02-25)' },
          start_time: { type: 'string', description: 'Hora início (HH:MM, ex: 14:00)' },
          end_time: { type: 'string', description: 'Hora fim (HH:MM, ex: 15:00). Se não informado, assume 1h após start_time' },
          description: { type: 'string', description: 'Descrição do evento (opcional)' },
          attendees: { type: 'array', items: { type: 'string' }, description: 'Emails dos participantes (opcional). Use search_contacts para converter nomes em emails.' },
          add_meet_link: { type: 'boolean', description: 'Criar link do Google Meet (padrão: true)' }
        },
        required: ['title', 'date', 'start_time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_calendar_event',
      description: 'Atualiza um evento existente: reagendar (mudar data/hora), alterar duração (mudar start ou end), mudar título, adicionar participantes, adicionar link Meet. Para achar o event_id, use get_calendar_events antes.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'ID do evento do Google Calendar (obrigatório, obtido via get_calendar_events)' },
          title: { type: 'string', description: 'Novo título (opcional)' },
          date: { type: 'string', description: 'Nova data (YYYY-MM-DD, opcional — se omitido mantém a data atual)' },
          start_time: { type: 'string', description: 'Nova hora início (HH:MM, opcional)' },
          end_time: { type: 'string', description: 'Nova hora fim (HH:MM, opcional). Ex: para aumentar de 1h para 1h30, mude apenas o end_time' },
          description: { type: 'string', description: 'Nova descrição (opcional)' },
          add_attendees: { type: 'array', items: { type: 'string' }, description: 'Emails de participantes a ADICIONAR (opcional). Use search_contacts para converter nomes.' },
          add_meet_link: { type: 'boolean', description: 'Adicionar link do Google Meet se não tiver (opcional)' }
        },
        required: ['event_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_calendar_event',
      description: 'Remove/cancela um evento do Google Calendar do vendedor.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'ID do evento do Google Calendar' }
        },
        required: ['event_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'toggle_meeting_bot',
      description: 'Ativa ou desativa o bot de análise para uma reunião específica do Google Meet. O bot grava e avalia a reunião automaticamente.',
      parameters: {
        type: 'object',
        properties: {
          scheduled_bot_id: { type: 'string', description: 'ID do scheduled bot (da tabela calendar_scheduled_bots)' },
          enabled: { type: 'boolean', description: 'true para ativar, false para desativar' }
        },
        required: ['scheduled_bot_id', 'enabled']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'quick_add_event',
      description: 'Cria evento por texto em linguagem natural. Google interpreta a data/hora automaticamente. Ex: "Reunião com João amanhã às 14h", "Almoço sexta 12h30".',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Descrição do evento em linguagem natural' }
        },
        required: ['text']
      }
    }
  }
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Parse evaluation from N8N format {output: "json_string"} or [{output: "json_string"}]
function parseEvaluation(evaluation: any): any {
  if (!evaluation) return null
  if (evaluation.output && typeof evaluation.output === 'string') {
    try { return JSON.parse(evaluation.output) } catch { return evaluation }
  }
  if (Array.isArray(evaluation) && evaluation[0]?.output && typeof evaluation[0].output === 'string') {
    try { return JSON.parse(evaluation[0].output) } catch { return evaluation }
  }
  return evaluation
}

// ─── Function Executor ───────────────────────────────────────────────────────

async function executeFunction(
  toolCall: OpenAI.ChatCompletionMessageToolCall,
  userId: string,
  companyId: string
): Promise<unknown> {
  const fn = toolCall as { function: { name: string; arguments: string }; id: string }
  const name = fn.function.name
  const params = JSON.parse(fn.function.arguments || '{}')

  console.log(`[Agent] Executing tool: ${name}, userId: ${userId}, companyId: ${companyId}`)

  try {
    switch (name) {
      case 'get_performance_summary': {
        // Try summary table first
        const { data, error } = await supabaseAdmin
          .from('user_performance_summaries')
          .select('*')
          .eq('user_id', userId)
          .single()
        if (error) console.log(`[Agent] get_performance_summary error:`, error.message, error.code)
        console.log(`[Agent] get_performance_summary result:`, data ? 'found' : 'null')
        if (data) return data

        // Fallback: compute from roleplay_sessions + meet_evaluations directly
        console.log(`[Agent] Falling back to compute from roleplay_sessions + meet_evaluations`)
        const { data: sessions } = await supabaseAdmin
          .from('roleplay_sessions')
          .select('evaluation, created_at')
          .eq('user_id', userId)
          .not('evaluation', 'is', null)
          .order('created_at', { ascending: false })

        const { data: meetEvals } = await supabaseAdmin
          .from('meet_evaluations')
          .select('overall_score, spin_s_score, spin_p_score, spin_i_score, spin_n_score, executive_summary, top_strengths, critical_gaps, priority_improvements, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (!sessions?.length && !meetEvals?.length) {
          return { message: 'Nenhum dado de performance encontrado. O vendedor ainda não completou avaliações.' }
        }

        // Parse all evaluations
        const allParsed: Array<{ ev: any; created_at: string; source: string }> = []
        for (const session of (sessions || [])) {
          const ev = parseEvaluation(session.evaluation)
          if (ev) allParsed.push({ ev, created_at: session.created_at, source: 'roleplay' })
        }
        for (const me of (meetEvals || [])) {
          allParsed.push({
            ev: {
              overall_score: me.overall_score,
              spin_evaluation: {
                S: { final_score: me.spin_s_score },
                P: { final_score: me.spin_p_score },
                I: { final_score: me.spin_i_score },
                N: { final_score: me.spin_n_score },
              },
              executive_summary: me.executive_summary,
              top_strengths: me.top_strengths,
              critical_gaps: me.critical_gaps,
              priority_improvements: me.priority_improvements,
            },
            created_at: me.created_at,
            source: 'meet',
          })
        }

        // Sort by date (newest first) for trend calculation
        allParsed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        // Compute averages
        const spinTotals = { S: 0, P: 0, I: 0, N: 0 }
        const spinCounts = { S: 0, P: 0, I: 0, N: 0 }
        let totalScore = 0, countScore = 0
        const scores: number[] = []

        // Collect strengths/gaps from last 5 sessions
        const allStrengths: string[] = []
        const allGaps: string[] = []
        const allImprovements: Array<{ area: string; action_plan: string; priority: string }> = []

        for (const { ev } of allParsed) {
          if (ev.overall_score !== undefined) {
            let score = parseFloat(ev.overall_score)
            if (score > 10) score = score / 10
            totalScore += score
            countScore++
            scores.push(score)
          }
          if (ev.spin_evaluation) {
            const spin = ev.spin_evaluation
            if (spin.S?.final_score !== undefined) { spinTotals.S += spin.S.final_score; spinCounts.S++ }
            if (spin.P?.final_score !== undefined) { spinTotals.P += spin.P.final_score; spinCounts.P++ }
            if (spin.I?.final_score !== undefined) { spinTotals.I += spin.I.final_score; spinCounts.I++ }
            if (spin.N?.final_score !== undefined) { spinTotals.N += spin.N.final_score; spinCounts.N++ }
          }
        }

        // Extract strengths/gaps from last 5 evaluations
        const last5 = allParsed.slice(0, 5)
        for (const { ev } of last5) {
          if (Array.isArray(ev.top_strengths)) allStrengths.push(...ev.top_strengths)
          if (Array.isArray(ev.critical_gaps)) allGaps.push(...ev.critical_gaps)
          if (Array.isArray(ev.priority_improvements)) {
            for (const imp of ev.priority_improvements) {
              if (typeof imp === 'string') allImprovements.push({ area: imp, action_plan: '', priority: '' })
              else if (imp?.area) allImprovements.push(imp)
            }
          }
        }

        // Deduplicate by counting frequency
        const countOccurrences = (arr: string[]) => {
          const map = new Map<string, number>()
          for (const item of arr) {
            const key = item.toLowerCase().trim()
            if (key) map.set(key, (map.get(key) || 0) + 1)
          }
          return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([text, count]) => `${text} (${count}x nas últimas sessões)`)
        }

        // Compute trend from last 3 scores
        let trend = 'stable'
        if (scores.length >= 3) {
          const recent = scores.slice(0, 3) // newest first
          const avgRecent = (recent[0] + recent[1]) / 2
          const avgOlder = recent[2]
          if (avgRecent > avgOlder + 0.5) trend = 'improving'
          else if (avgRecent < avgOlder - 0.5) trend = 'declining'
        }

        // Last session score
        const lastSessionScore = scores.length > 0 ? scores[0] : null

        return {
          overall_average: countScore > 0 ? Number((totalScore / countScore).toFixed(1)) : null,
          total_sessions: allParsed.length,
          total_roleplay_sessions: sessions?.length || 0,
          total_meet_evaluations: meetEvals?.length || 0,
          last_session_score: lastSessionScore,
          spin_s_average: spinCounts.S > 0 ? Number((spinTotals.S / spinCounts.S).toFixed(1)) : null,
          spin_p_average: spinCounts.P > 0 ? Number((spinTotals.P / spinCounts.P).toFixed(1)) : null,
          spin_i_average: spinCounts.I > 0 ? Number((spinTotals.I / spinCounts.I).toFixed(1)) : null,
          spin_n_average: spinCounts.N > 0 ? Number((spinTotals.N / spinCounts.N).toFixed(1)) : null,
          trend,
          top_strengths_recurring: countOccurrences(allStrengths),
          critical_gaps_recurring: countOccurrences(allGaps),
          priority_improvements: allImprovements.slice(0, 5),
          score_history: scores.slice(0, 10).map((s, i) => ({ session: i + 1, score: s })),
        }
      }

      case 'get_roleplay_sessions': {
        let query = supabaseAdmin
          .from('roleplay_sessions')
          .select('id, config, status, duration_seconds, created_at, evaluation')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(params.limit || 10)

        if (params.date_from) query = query.gte('created_at', params.date_from)
        if (params.date_to) query = query.lte('created_at', params.date_to)

        const { data } = await query
        // Return summary without full evaluation to save tokens
        const sessions = (data || []).map(s => {
          const ev = parseEvaluation(s.evaluation)
          let overallScore = ev?.overall_score
          if (overallScore !== undefined && overallScore > 10) overallScore = overallScore / 10
          return {
            id: s.id,
            created_at: s.created_at,
            status: s.status,
            duration_seconds: s.duration_seconds,
            persona: s.config?.selectedPersona?.cargo || s.config?.selectedPersona?.profession || 'N/A',
            temperament: s.config?.temperament,
            age: s.config?.age,
            objections_count: s.config?.objections?.length || 0,
            overall_score: overallScore,
            performance_level: ev?.performance_level,
            spin_s: ev?.spin_evaluation?.S?.final_score,
            spin_p: ev?.spin_evaluation?.P?.final_score,
            spin_i: ev?.spin_evaluation?.I?.final_score,
            spin_n: ev?.spin_evaluation?.N?.final_score,
            is_meet_correction: s.config?.is_meet_correction || false,
          }
        })
        return { total: sessions.length, sessions }
      }

      case 'get_roleplay_session_detail': {
        const { data } = await supabaseAdmin
          .from('roleplay_sessions')
          .select('*')
          .eq('id', params.session_id)
          .eq('user_id', userId)
          .single()
        if (!data) return { error: 'Sessão não encontrada' }
        return {
          id: data.id,
          created_at: data.created_at,
          status: data.status,
          duration_seconds: data.duration_seconds,
          config: data.config,
          messages: data.messages,
          evaluation: parseEvaluation(data.evaluation),
        }
      }

      case 'get_meet_evaluations': {
        let query = supabaseAdmin
          .from('meet_evaluations')
          .select('id, seller_name, call_objective, funnel_stage, overall_score, performance_level, spin_s_score, spin_p_score, spin_i_score, spin_n_score, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(params.limit || 10)

        if (params.date_from) query = query.gte('created_at', params.date_from)
        if (params.date_to) query = query.lte('created_at', params.date_to)

        const { data: evals } = await query
        if (!evals?.length) return { total: 0, evaluations: [] }

        // Enrich with calendar data
        const evalIds = evals.map(e => e.id)
        const { data: calendarBots } = await supabaseAdmin
          .from('calendar_scheduled_bots')
          .select('evaluation_id, event_title, event_start, event_end, meet_link, attendees, bot_status')
          .in('evaluation_id', evalIds)

        const evaluations = evals.map(e => {
          const bot = calendarBots?.find(b => b.evaluation_id === e.id)
          return {
            ...e,
            calendar_event_title: bot?.event_title || null,
            calendar_event_start: bot?.event_start || null,
            calendar_event_end: bot?.event_end || null,
            calendar_meet_link: bot?.meet_link || null,
            calendar_attendees: bot?.attendees || null,
            bot_status: bot?.bot_status || null,
          }
        })
        return { total: evaluations.length, evaluations }
      }

      case 'get_meet_evaluation_detail': {
        const { data } = await supabaseAdmin
          .from('meet_evaluations')
          .select('*')
          .eq('id', params.evaluation_id)
          .eq('user_id', userId)
          .single()
        if (!data) return { error: 'Avaliação não encontrada' }

        // Get calendar data
        const { data: bot } = await supabaseAdmin
          .from('calendar_scheduled_bots')
          .select('event_title, event_start, event_end, meet_link, attendees, bot_status')
          .eq('evaluation_id', params.evaluation_id)
          .single()

        // Check if there's a correction roleplay linked
        const { data: correction } = await supabaseAdmin
          .from('roleplay_sessions')
          .select('id, created_at, evaluation')
          .eq('user_id', userId)
          .eq('config->>is_meet_correction', 'true')
          .order('created_at', { ascending: false })
          .limit(5)

        const linkedCorrection = correction?.find(c =>
          c.evaluation?.meet_evaluation_id === params.evaluation_id
        )

        return {
          ...data,
          calendar_event_title: bot?.event_title || null,
          calendar_event_start: bot?.event_start || null,
          calendar_event_end: bot?.event_end || null,
          calendar_meet_link: bot?.meet_link || null,
          calendar_attendees: bot?.attendees || null,
          bot_status: bot?.bot_status || null,
          has_correction: !!linkedCorrection,
          correction_session_id: linkedCorrection?.id || null,
        }
      }

      case 'get_daily_challenges': {
        let query = supabaseAdmin
          .from('daily_challenges')
          .select('*')
          .eq('user_id', userId)
          .order('challenge_date', { ascending: false })
          .limit(params.limit || 10)

        if (params.status) query = query.eq('status', params.status)

        const { data } = await query
        return { total: data?.length || 0, challenges: data || [] }
      }

      case 'get_challenge_effectiveness': {
        const { data } = await supabaseAdmin
          .from('challenge_effectiveness')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })

        return { weaknesses: data || [] }
      }

      case 'get_whatsapp_activity': {
        const days = params.days || 7
        const sinceDate = new Date()
        sinceDate.setDate(sinceDate.getDate() - days)

        // Get conversations
        const { data: conversations } = await supabaseAdmin
          .from('whatsapp_conversations')
          .select('contact_name, contact_phone, last_message_at, last_message_preview, unread_count, message_count')
          .eq('user_id', userId)
          .order('last_message_at', { ascending: false })
          .limit(20)

        // Get message counts for the period
        const { count: sentCount } = await supabaseAdmin
          .from('whatsapp_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('direction', 'outgoing')
          .gte('message_timestamp', sinceDate.toISOString())

        const { count: receivedCount } = await supabaseAdmin
          .from('whatsapp_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('direction', 'incoming')
          .gte('message_timestamp', sinceDate.toISOString())

        const totalUnread = conversations?.reduce((acc, c) => acc + (c.unread_count || 0), 0) || 0

        return {
          period_days: days,
          total_conversations: conversations?.length || 0,
          messages_sent: sentCount || 0,
          messages_received: receivedCount || 0,
          total_unread: totalUnread,
          top_contacts: (conversations || []).slice(0, 5).map(c => ({
            name: c.contact_name || c.contact_phone,
            last_message_at: c.last_message_at,
            message_count: c.message_count,
            unread: c.unread_count,
          }))
        }
      }

      case 'get_followup_analyses': {
        const { data } = await supabaseAdmin
          .from('followup_analyses')
          .select('id, tipo_venda, canal, fase_funil, nota_final, classificacao, avaliacao, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(params.limit || 10)

        const analyses = (data || []).map(a => ({
          id: a.id,
          created_at: a.created_at,
          tipo_venda: a.tipo_venda,
          canal: a.canal,
          fase_funil: a.fase_funil,
          nota_final: a.nota_final,
          classificacao: a.classificacao,
          notas: a.avaliacao?.notas,
          dica_principal: a.avaliacao?.dica_principal,
        }))
        return { total: analyses.length, analyses }
      }

      case 'get_seller_message_tracking': {
        let query = supabaseAdmin
          .from('seller_message_tracking')
          .select('id, seller_message, contact_name, contact_phone, outcome, outcome_reason, client_response, message_timestamp, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(params.limit || 20)

        if (params.outcome) query = query.eq('outcome', params.outcome)

        const { data } = await query

        // Calculate stats
        const total = data?.length || 0
        const successes = data?.filter(m => m.outcome === 'success').length || 0
        const failures = data?.filter(m => m.outcome === 'failure').length || 0
        const pending = data?.filter(m => !m.outcome).length || 0

        return {
          total,
          success_rate: total > 0 ? Math.round((successes / total) * 100) : 0,
          stats: { successes, failures, pending },
          messages: data || []
        }
      }

      case 'get_pdi': {
        const { data } = await supabaseAdmin
          .from('pdis')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'ativo')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return data || { message: 'Nenhum PDI ativo encontrado. O vendedor ainda não gerou um plano de desenvolvimento.' }
      }

      case 'get_company_info': {
        const { data } = await supabaseAdmin
          .from('company_data')
          .select('nome, descricao, produtos_servicos, funcao_produtos, diferenciais, concorrentes, dados_metricas, erros_comuns, percepcao_desejada')
          .eq('company_id', companyId)
          .single()

        return data || { message: 'Dados da empresa não configurados.' }
      }

      case 'get_calendar_events': {
        const daysAhead = params.days_ahead || 7
        const calClient = await getCalendarClient(userId)
        if (!calClient) {
          return { connected: false, message: 'Google Calendar não conectado. O vendedor precisa conectar na página de Análise Meet.' }
        }

        const events = await fetchAllEvents(userId, daysAhead)
        if (!events) return { connected: true, events: [], past_events: [] }

        // Split into future and past
        const now = new Date()
        const futureEvents = events.filter(e => new Date(e.start) >= now)
        const pastDays = params.days_behind || 7
        const pastCutoff = new Date()
        pastCutoff.setDate(pastCutoff.getDate() - pastDays)

        // Fetch past events separately if needed
        let pastEvents: typeof events = []
        if (params.days_behind) {
          // fetchAllEvents only fetches from today forward, so query scheduled bots for past
          const { data: pastBots } = await supabaseAdmin
            .from('calendar_scheduled_bots')
            .select('event_title, event_start, event_end, meet_link, attendees, bot_status, evaluation_id, bot_enabled')
            .eq('user_id', userId)
            .gte('event_start', pastCutoff.toISOString())
            .lt('event_start', now.toISOString())
            .order('event_start', { ascending: false })

          pastEvents = (pastBots || []).map(b => ({
            id: '',
            title: b.event_title,
            start: b.event_start,
            end: b.event_end,
            meetLink: b.meet_link || '',
            attendees: b.attendees || [],
            organizer: null,
            description: null,
            bot_status: b.bot_status,
            evaluation_id: b.evaluation_id,
            bot_enabled: b.bot_enabled,
          }))
        }

        // Enrich future events with bot data
        const eventIds = futureEvents.map(e => e.id).filter(Boolean)
        let botData: Record<string, { bot_status: string; bot_enabled: boolean; evaluation_id: string | null }> = {}
        if (eventIds.length > 0) {
          const { data: bots } = await supabaseAdmin
            .from('calendar_scheduled_bots')
            .select('google_event_id, bot_status, bot_enabled, evaluation_id')
            .eq('user_id', userId)
            .in('google_event_id', eventIds)

          bots?.forEach(b => {
            botData[b.google_event_id] = {
              bot_status: b.bot_status,
              bot_enabled: b.bot_enabled,
              evaluation_id: b.evaluation_id,
            }
          })
        }

        const enrichedFuture = futureEvents.map(e => ({
          ...e,
          bot_status: botData[e.id]?.bot_status || null,
          bot_enabled: botData[e.id]?.bot_enabled || null,
          evaluation_id: botData[e.id]?.evaluation_id || null,
        }))

        return {
          connected: true,
          upcoming_events: enrichedFuture,
          past_events: pastEvents,
        }
      }

      case 'get_calendar_freebusy': {
        const calClient = await getCalendarClient(userId)
        if (!calClient) {
          return { connected: false, message: 'Google Calendar não conectado.' }
        }

        const date = params.date
        const timeMin = new Date(`${date}T00:00:00-03:00`).toISOString()
        const timeMax = new Date(`${date}T23:59:59-03:00`).toISOString()

        // Get the user's email from calendar connection
        const { data: connection } = await supabaseAdmin
          .from('google_calendar_connections')
          .select('google_email')
          .eq('user_id', userId)
          .single()

        const emails = [connection?.google_email || '', ...(params.emails || [])].filter(Boolean)

        const result = await checkFreeBusy(userId, timeMin, timeMax, emails)
        if (!result) return { connected: true, error: 'Erro ao verificar disponibilidade' }

        // Calculate free slots from busy periods
        const userBusy = result.find(r => r.email === connection?.google_email)
        const freeSlots = calculateFreeSlots(userBusy?.busy || [], date)

        return {
          connected: true,
          date,
          user_email: connection?.google_email,
          busy_slots: userBusy?.busy || [],
          free_slots: freeSlots,
          other_attendees: result.filter(r => r.email !== connection?.google_email),
        }
      }

      case 'get_scheduled_bots': {
        let query = supabaseAdmin
          .from('calendar_scheduled_bots')
          .select('id, event_title, event_start, event_end, meet_link, attendees, bot_enabled, bot_status, evaluation_id, error_message, created_at')
          .eq('user_id', userId)
          .order('event_start', { ascending: false })
          .limit(20)

        if (params.status) query = query.eq('bot_status', params.status)

        const { data } = await query
        return { total: data?.length || 0, bots: data || [] }
      }

      // ─── Contact Lookup ──────────────────────────────────────────────
      case 'search_contacts': {
        const searchName = params.name?.toLowerCase().trim()
        if (!searchName) return { error: 'Nome é obrigatório' }

        // Search employees in the same company
        const { data: employees } = await supabaseAdmin
          .from('employees')
          .select('name, email, role')
          .eq('company_id', companyId)
          .ilike('name', `%${searchName}%`)

        // Also search Google Calendar attendees from recent events for external contacts
        const { data: recentBots } = await supabaseAdmin
          .from('calendar_scheduled_bots')
          .select('attendees')
          .eq('user_id', userId)
          .not('attendees', 'is', null)
          .order('event_start', { ascending: false })
          .limit(20)

        const externalContacts = new Map<string, string>()
        for (const bot of (recentBots || [])) {
          const attendees = bot.attendees as Array<{ email?: string; displayName?: string }> | null
          if (!Array.isArray(attendees)) continue
          for (const a of attendees) {
            if (a.email && (a.displayName?.toLowerCase().includes(searchName) || a.email.toLowerCase().includes(searchName))) {
              externalContacts.set(a.email, a.displayName || a.email)
            }
          }
        }

        const results = [
          ...(employees || []).map(e => ({ name: e.name, email: e.email, source: 'equipe' })),
          ...Array.from(externalContacts.entries()).map(([email, name]) => ({ name, email, source: 'contato recente' })),
        ]

        return {
          total: results.length,
          contacts: results,
          hint: results.length === 0 ? 'Nenhum contato encontrado. Peça o email ao vendedor.' : null,
        }
      }

      // ─── Calendar Write Operations ──────────────────────────────────
      case 'create_calendar_event': {
        const calClient = await getCalendarClient(userId)
        if (!calClient) return { error: 'Google Calendar não conectado. O vendedor precisa conectar na página de Análise Meet.' }

        // Default end_time: 1h after start_time
        let endTime = params.end_time
        if (!endTime && params.start_time) {
          const [h, m] = params.start_time.split(':').map(Number)
          endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        }

        const startDateTime = `${params.date}T${params.start_time}:00-03:00`
        const endDateTime = `${params.date}T${endTime}:00-03:00`

        const event = await createCalendarEvent(userId, {
          title: params.title,
          startDateTime,
          endDateTime,
          description: params.description,
          attendees: params.attendees,
          addMeetLink: params.add_meet_link !== false,
        })

        if (!event) return { error: 'Erro ao criar evento no Google Calendar' }

        return {
          success: true,
          message: `Evento "${params.title}" criado com sucesso`,
          event: {
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            meetLink: event.meetLink,
            attendees: event.attendees,
          }
        }
      }

      case 'update_calendar_event': {
        const calClient = await getCalendarClient(userId)
        if (!calClient) return { error: 'Google Calendar não conectado.' }

        // First fetch the current event to support partial time updates
        const currentEvents = await fetchAllEvents(userId, 30)
        const currentEvent = currentEvents?.find(e => e.id === params.event_id)

        const updateData: Record<string, any> = {}
        if (params.title) updateData.title = params.title
        if (params.description) updateData.description = params.description
        if (params.add_meet_link) updateData.addMeetLink = true

        // Handle partial time updates: if only start_time or only end_time is given,
        // use the current event's values for the missing one
        const currentStart = currentEvent ? new Date(currentEvent.start) : null
        const currentEnd = currentEvent?.end ? new Date(currentEvent.end) : null

        const newDate = params.date || (currentStart ? `${currentStart.getFullYear()}-${String(currentStart.getMonth() + 1).padStart(2, '0')}-${String(currentStart.getDate()).padStart(2, '0')}` : null)

        if (params.start_time && newDate) {
          updateData.startDateTime = `${newDate}T${params.start_time}:00-03:00`
          // If no new end_time, keep same duration
          if (!params.end_time && currentStart && currentEnd) {
            const durationMs = currentEnd.getTime() - currentStart.getTime()
            const newStart = new Date(`${newDate}T${params.start_time}:00-03:00`)
            const newEnd = new Date(newStart.getTime() + durationMs)
            updateData.endDateTime = newEnd.toISOString()
          }
        }
        if (params.end_time && newDate) {
          updateData.endDateTime = `${newDate}T${params.end_time}:00-03:00`
          // If no new start_time but new date, keep original start time on new date
          if (!params.start_time && currentStart) {
            const origTime = `${String(currentStart.getHours()).padStart(2, '0')}:${String(currentStart.getMinutes()).padStart(2, '0')}`
            updateData.startDateTime = `${newDate}T${origTime}:00-03:00`
          }
        }
        // If only date changed (no time params), move to same times on new date
        if (params.date && !params.start_time && !params.end_time && currentStart && currentEnd) {
          const origStartTime = `${String(currentStart.getHours()).padStart(2, '0')}:${String(currentStart.getMinutes()).padStart(2, '0')}`
          const origEndTime = `${String(currentEnd.getHours()).padStart(2, '0')}:${String(currentEnd.getMinutes()).padStart(2, '0')}`
          updateData.startDateTime = `${params.date}T${origStartTime}:00-03:00`
          updateData.endDateTime = `${params.date}T${origEndTime}:00-03:00`
        }

        if (params.add_attendees?.length) {
          updateData.attendees = params.add_attendees.map((e: string) => ({ email: e }))
        }

        const updated = await updateCalendarEvent(userId, params.event_id, updateData)
        if (!updated) return { error: 'Erro ao atualizar evento' }

        return {
          success: true,
          message: 'Evento atualizado com sucesso',
          event: {
            id: updated.id,
            title: updated.title,
            start: updated.start,
            end: updated.end,
            meetLink: updated.meetLink,
            attendees: updated.attendees,
          }
        }
      }

      case 'delete_calendar_event': {
        const calClient = await getCalendarClient(userId)
        if (!calClient) return { error: 'Google Calendar não conectado.' }

        const deleted = await deleteCalendarEvent(userId, params.event_id)
        if (!deleted) return { error: 'Erro ao deletar evento' }

        return { success: true, message: 'Evento removido do Google Calendar com sucesso' }
      }

      case 'toggle_meeting_bot': {
        const { data: bot, error: botError } = await supabaseAdmin
          .from('calendar_scheduled_bots')
          .select('id, bot_status, bot_enabled, event_title')
          .eq('id', params.scheduled_bot_id)
          .eq('user_id', userId)
          .single()

        if (botError || !bot) return { error: 'Bot agendado não encontrado' }
        if (bot.bot_status === 'completed' || bot.bot_status === 'recording') {
          return { error: `Não é possível alterar — a reunião já está ${bot.bot_status === 'completed' ? 'avaliada' : 'sendo gravada'}` }
        }

        await supabaseAdmin
          .from('calendar_scheduled_bots')
          .update({ bot_enabled: params.enabled })
          .eq('id', params.scheduled_bot_id)

        return {
          success: true,
          message: `Bot de análise ${params.enabled ? 'ativado' : 'desativado'} para "${bot.event_title}"`,
        }
      }

      case 'quick_add_event': {
        const calClient = await getCalendarClient(userId)
        if (!calClient) return { error: 'Google Calendar não conectado.' }

        const event = await quickAddEvent(userId, params.text)
        if (!event) return { error: 'Erro ao criar evento. Tente com create_calendar_event para mais controle.' }

        return {
          success: true,
          message: `Evento criado: "${event.title}"`,
          event: {
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
          }
        }
      }

      default:
        return { error: `Função desconhecida: ${name}` }
    }
  } catch (error) {
    console.error(`[Agent] Error executing ${name}:`, error)
    return { error: `Erro ao executar ${name}` }
  }
}

// ─── Helper: Calculate free slots from busy periods ──────────────────────────

function calculateFreeSlots(busySlots: Array<{ start: string; end: string }>, date: string) {
  const workStart = 8 // 8:00
  const workEnd = 18 // 18:00
  const slots: Array<{ start: string; end: string }> = []

  // Sort busy slots
  const sorted = [...busySlots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  let currentHour = workStart
  for (const busy of sorted) {
    const busyStart = new Date(busy.start).getHours() + new Date(busy.start).getMinutes() / 60
    const busyEnd = new Date(busy.end).getHours() + new Date(busy.end).getMinutes() / 60

    if (busyStart > currentHour) {
      slots.push({
        start: `${date}T${String(Math.floor(currentHour)).padStart(2, '0')}:${String(Math.round((currentHour % 1) * 60)).padStart(2, '0')}:00`,
        end: `${date}T${String(Math.floor(busyStart)).padStart(2, '0')}:${String(Math.round((busyStart % 1) * 60)).padStart(2, '0')}:00`,
      })
    }
    currentHour = Math.max(currentHour, busyEnd)
  }

  if (currentHour < workEnd) {
    slots.push({
      start: `${date}T${String(Math.floor(currentHour)).padStart(2, '0')}:${String(Math.round((currentHour % 1) * 60)).padStart(2, '0')}:00`,
      end: `${date}T${String(workEnd).padStart(2, '0')}:00:00`,
    })
  }

  return slots
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      console.error('[Agent] Auth failed:', authError?.message)
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 })
    }

    console.log(`[Agent] Auth OK — user: ${user.id}, email: ${user.email}`)

    // Get company
    const { data: employeeData, error: empError } = await supabaseAdmin
      .from('employees')
      .select('company_id, name')
      .eq('user_id', user.id)
      .single()

    if (empError) console.error('[Agent] Employee lookup error:', empError.message)

    const companyId = employeeData?.company_id
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    // Parse body
    const { message, conversationHistory = [] } = await req.json()
    if (!message) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 })
    }

    // Build messages
    const sellerName = employeeData?.name || user.email || 'Vendedor'
    const systemMessage = `${SYSTEM_PROMPT}\n\nVocê está conversando com: ${sellerName}\nData/hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemMessage },
      ...conversationHistory.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    // Tool calling loop (max 5 rounds to prevent infinite loops)
    const toolsUsed: string[] = []
    const MAX_ROUNDS = 5

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages,
        tools: toolDefinitions,
        temperature: 0.7,
        max_tokens: 2000,
      })

      const choice = response.choices[0]

      // If the model wants to respond directly
      if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
        return NextResponse.json({
          response: choice.message.content || 'Desculpe, não consegui processar sua pergunta.',
          toolsUsed,
        })
      }

      // Execute tool calls in parallel
      const toolResults = await Promise.all(
        choice.message.tool_calls.map(async (tc) => {
          const tcFn = tc as { function: { name: string }; id: string }
          toolsUsed.push(tcFn.function.name)
          const result = await executeFunction(tc, user.id, companyId)
          const resultStr = JSON.stringify(result)
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content: resultStr,
          }
        })
      )

      // Add assistant message with tool calls + tool results
      messages.push(choice.message)
      messages.push(...toolResults)
    }

    // If we hit max rounds, force a response
    const finalResponse = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [...messages, { role: 'user', content: 'Por favor, responda com base nos dados já coletados.' }],
      temperature: 0.7,
      max_tokens: 2000,
    })

    return NextResponse.json({
      response: finalResponse.choices[0].message.content || 'Desculpe, ocorreu um erro.',
      toolsUsed,
    })

  } catch (error) {
    console.error('[Agent] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
