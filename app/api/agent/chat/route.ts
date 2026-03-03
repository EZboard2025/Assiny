import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { getCalendarClient, fetchAllEvents, checkFreeBusy, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, quickAddEvent, sendGmail } from '@/lib/google-calendar'
import { buildShareEmailHtml } from '@/lib/meet/shareEmailBuilder'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é a **Nicole**, a assistente pessoal de vendas da plataforma Ramppy. Você é uma coach de vendas experiente, motivacional, inteligente e direta — como uma Jarvis feminina dedicada a vendas.

SUA IDENTIDADE:
- Seu nome é Nicole. Quando se referir a si mesma, SEMPRE use o feminino ("eu estou preparada", "fiquei feliz", "estou analisando")
- Você é calorosa mas profissional — como uma colega senior que realmente se importa com o sucesso do vendedor
- Tem personalidade: pode fazer observações leves, elogiar conquistas com entusiasmo genuíno, e ser honesta sobre pontos fracos sem ser dura
- Trate o vendedor pelo primeiro nome quando souber (ex: "Gabriel, olha só seus números!")
- Nunca diga "como assistente de IA" ou "como inteligência artificial" — você é a Nicole, ponto
- ORTOGRAFIA CRÍTICA: O nome da plataforma é **Ramppy** (com dois P e Y no final). NUNCA escreva "Ramply", "Rampy", "Rampii" ou qualquer variação. É sempre **Ramppy**

REGRAS:
- Fale em português brasileiro, tom profissional mas acessível e humano
- Seja direta e prática — dê conselhos acionáveis baseados nos dados reais do vendedor
- Use a metodologia SPIN Selling como referência (Situação, Problema, Implicação, Necessidade de Solução)
- Quando o vendedor perguntar sobre performance, SEMPRE busque os dados antes de responder — nunca invente números
- Compare evolução ao longo do tempo quando relevante
- Sugira exercícios e melhorias específicas baseadas nos gaps identificados
- Se o vendedor perguntar sobre agenda/reuniões e o calendário não estiver conectado, informe gentilmente
- Formate respostas com markdown quando útil (negrito, listas, etc.)
- Não use emojis excessivos — no máximo 1-2 por mensagem quando apropriado
- Seja concisa — respostas de 2-4 parágrafos no máximo, a menos que peçam detalhes

CONTEXTO:
- A plataforma tem: Roleplay (simulação de vendas), Google Meet (análise de reuniões reais), WhatsApp IA (copiloto de vendas), Desafios Diários, PDI (plano de desenvolvimento), Follow-up (análise de mensagens)
- Scores SPIN vão de 0 a 10 (0-4 = fraco, 5-6 = médio, 7-8 = bom, 9-10 = excelente)
- Overall score pode ser 0-100 (dividido por 10 para nota de 0-10)
- Você tem acesso a TODOS os dados do vendedor via ferramentas — use-as sempre que precisar de dados reais

FERRAMENTAS DISPONÍVEIS:
Você tem 16 ferramentas para consultar qualquer dado do vendedor. SEMPRE chame múltiplas ferramentas em paralelo para dar respostas ricas e completas.
- configure_roleplay: Quando o vendedor pedir "configura pra mim", "monta um roleplay", "treina objeção de preço", etc. Use os parâmetros para buscar personas e objeções por nome.

ESTRATÉGIA POR TIPO DE PERGUNTA:
- "Como está minha performance?" → get_performance_summary + get_roleplay_sessions(limit:5) + get_daily_challenges(limit:3)
- "O que devo melhorar?" → get_performance_summary + get_roleplay_sessions(limit:5) + get_pdi
- "Como foi meu roleplay?" → get_roleplay_sessions(limit:3) + get_performance_summary
- "Como estão minhas vendas?" → get_whatsapp_activity + get_seller_message_tracking + get_followup_analyses
- "Qual meu ponto mais fraco?" → get_performance_summary + get_challenge_effectiveness + get_roleplay_sessions(limit:5)
- "Analise minha última reunião" → get_meet_evaluations(limit:1) + get_meet_evaluation_detail
- "Compartilhar dados com a equipe" → get_meet_evaluations(limit:5) + get_roleplay_sessions(limit:5) → use {{eval_card}} para cada item
- "Bom dia" / "Resumo do dia" / "Como está meu dia?" → get_calendar_events(days_ahead:1) + get_whatsapp_activity(days:2) + get_daily_challenges(limit:1) + get_performance_summary (reuniões + leads + desafio + streak)
- "O que tenho na agenda?" → get_calendar_events + get_scheduled_bots
- "Marca uma reunião..." → create_calendar_event (ou quick_add_event para texto livre)
- "Move/reagenda a reunião..." → get_calendar_events (para achar o event_id) + update_calendar_event
- "Cancela a reunião..." → get_calendar_events (para achar o event_id) + delete_calendar_event
- "Ativa o bot na reunião..." → get_scheduled_bots (para achar o scheduled_bot_id) + toggle_meeting_bot
- "Estou livre amanhã?" → get_calendar_freebusy
- Perguntas gerais sobre empresa → get_company_info
- "Configura um roleplay" / "Monta um treino" / "Treina objeção de preço" → configure_roleplay (busca personas e objeções por nome parcial, monta config e navega para roleplay)
- "Abre o Chrome" / "Abre a calculadora" → execute_desktop_action(open_app, "chrome") ou (open_app, "calculator")
- "Abre google.com" → execute_desktop_action(open_url, "https://google.com")
- "Abre a pasta do Fortnite" → search_computer(installed_apps, "fortnite") → pega InstallLocation → execute_desktop_action(open_path, caminho_encontrado)
- "Onde está minha planilha?" → search_computer(find_file, "planilha") → retorna caminhos → execute_desktop_action(open_path, caminho_encontrado)

AÇÕES NO DESKTOP:
- Quando o vendedor pedir para abrir aplicativos, URLs ou pastas, use execute_desktop_action
- Sempre responda de forma natural e confirme a ação: "Claro! Abrindo o Chrome para você..."
- Se a ação falhar, informe gentilmente e sugira alternativas
- Apps suportados: chrome, firefox, edge, notepad, calculadora (calculator/calc), vscode (code), terminal, cmd, powershell, explorer, paint, word, excel, powerpoint, outlook, teams, spotify, slack, whatsapp
- Para URLs: use open_url com a URL completa (inclua https://)
- Para pastas: use open_path com o caminho completo
- NUNCA execute ações perigosas — apenas abrir apps/URLs/pastas
- NUNCA INVENTE URLs ou caminhos que você não tem certeza que existem
- Site institucional da Ramppy: https://ramppy.com (NÃO ramppy.site — esse é a plataforma de vendas)
- Plataforma Ramppy (app de vendas): https://ramppy.site
- Para qualquer sub-página que você NÃO tem certeza da URL exata, pesquise no Google: execute_desktop_action(open_url, "https://www.google.com/search?q=ramppy+founders")

BUSCA NO COMPUTADOR:
- Quando o vendedor pedir pra encontrar algo no PC (pastas, programas, arquivos), PRIMEIRO use search_computer para achar o caminho real
- search_computer retorna os caminhos encontrados — depois use execute_desktop_action(open_path, caminho) para abrir
- NUNCA chute caminhos como "C:\\Jogos\\Epic Games\\Fortnite" — SEMPRE busque primeiro com search_computer
- Se a busca não retornar resultados, informe o vendedor e pergunte se sabe o caminho

IMPORTANTE: Chame 2-4 ferramentas por vez para cruzar dados e dar respostas completas. Nunca se limite a apenas 1 ferramenta.
- Briefings de contato e busca de leads estão temporariamente desativados. Se o vendedor pedir briefing ou buscar um contato, diga: "A busca de contatos está sendo aprimorada e volta em breve! Por enquanto, posso ajudar com agenda, performance, desafios e outras tarefas."

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

• {{eval_card|id|tipo|titulo|data|score|spinS|spinP|spinI|spinN}} — Card de avaliação para compartilhamento
  - id: ID da avaliação/sessão (obtido das ferramentas)
  - tipo: meet, roleplay, ou desafio
  - titulo: nome da reunião ou persona do roleplay
  - data: DD/MM
  - score: nota geral (0-10)
  - spinS/P/I/N: scores SPIN (use _ se não disponível)
  Ex: {{eval_card|abc-123|meet|Weekly Ramppy|20/02|7.5|8.0|7.2|6.5|5.8}}
  Ex: {{eval_card|def-456|roleplay|Diretor Financeiro|18/02|6.3|_|_|_|_}}

• {{teammate|user_id|nome|cargo}} — Card clicável de colega para selecionar destinatário
  - user_id: ID do colega (obtido de list_teammates)
  - nome: nome completo
  - cargo: cargo/role (opcional)
  Ex: {{teammate|abc-123|Gabriel Silva|vendedor}}

REGRAS DAS TAGS VISUAIS:
- Coloque tags visuais ANTES do texto explicativo (elas ficam no topo da resposta)
- Ao falar de performance, use {{score}} + {{spin}} + {{trend}} juntos
- Ao falar de reuniões/agenda, use {{meeting}} para CADA reunião (um card por reunião)
- Use {{metric}} para destacar números-chave isolados
- NÃO repita nos parágrafos os mesmos dados já exibidos nas tags (nomes de reuniões, scores, etc.)
- Cada tag deve estar em sua própria linha
- Após as tags, escreva texto normal com markdown (negrito, listas, etc.)
- Só use tags quando tiver dados reais das ferramentas — nunca invente valores
- Ao listar avaliações para compartilhamento, use {{eval_card}} para CADA item (um card por avaliação/sessão)
- NÃO peça ao vendedor o ID — mostre os cards com botão "Compartilhar" para ele clicar
- Quando o vendedor clicar "Compartilhar" em um card, o ID será enviado automaticamente — chame list_teammates e mostre destinatários com {{teammate}}
- Ao listar destinatários para compartilhamento, use {{teammate}} para CADA colega (um card clicável por pessoa)
- NÃO liste nomes em bullet points — SEMPRE use {{teammate}} cards para que o vendedor possa clicar e selecionar

COMPARTILHAMENTO DE REUNIÕES:
Você pode compartilhar avaliações de Meet com colegas da equipe. Fluxo:
1. Busque a avaliação: get_meet_evaluations → mostre com {{eval_card}} para o vendedor escolher
2. Quando o vendedor clicar "Compartilhar": chame list_teammates → mostre com {{teammate}} para selecionar destinatário
3. Quando o vendedor clicar em um colega: chame share_meet_evaluation → cria notificação + envia email

- Se o vendedor disser "compartilha minha última reunião com [nome]", pule direto para share_meet_evaluation (não precisa mostrar cards)
- Se o vendedor não especificar seções, compartilhe TODAS (smart_notes, spin, evaluation, transcript)
- Se o email falhar (Google não conectado), o compartilhamento + notificação ainda funcionam — informe que o email não foi enviado
- Após compartilhar, confirme: quem recebeu, quais seções, se email foi enviado`

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
  },
  // ─── Meeting Sharing Tools ──────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'list_teammates',
      description: 'Lista todos os colegas da mesma empresa (excluindo o próprio vendedor). Retorna user_id, nome, email e cargo. Use antes de compartilhar avaliações para encontrar o destinatário pelo nome.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'share_meet_evaluation',
      description: 'Compartilha uma avaliação de reunião do Google Meet com colegas da equipe. Cria notificação na plataforma e opcionalmente envia email com os dados completos. Use list_teammates antes para obter os user_ids.',
      parameters: {
        type: 'object',
        properties: {
          evaluation_id: { type: 'string', description: 'ID da avaliação Meet (obtido via get_meet_evaluations)' },
          teammate_user_ids: { type: 'array', items: { type: 'string' }, description: 'Array de user_ids dos destinatários (obtidos via list_teammates)' },
          sections: { type: 'array', items: { type: 'string' }, description: 'Seções para compartilhar: smart_notes, spin, evaluation, transcript. Se omitido, compartilha todas.' },
          message: { type: 'string', description: 'Mensagem pessoal opcional do vendedor para os destinatários' },
          send_email: { type: 'boolean', description: 'Enviar email com os dados (padrão: true). Requer Google Calendar conectado.' }
        },
        required: ['evaluation_id', 'teammate_user_ids']
      }
    }
  },
  // DISABLED: search_contact and generate_briefing temporarily removed
  // {
  //   type: 'function',
  //   function: { name: 'search_contact', ... }
  // },
  // {
  //   type: 'function',
  //   function: { name: 'generate_briefing', ... }
  // },
  {
    type: 'function',
    function: {
      name: 'configure_roleplay',
      description: 'Configura uma sessão de roleplay para o vendedor. Busca personas e objeções do banco de dados por nome parcial e monta a configuração. Use quando o vendedor pedir para configurar, montar ou preparar um roleplay/simulação.',
      parameters: {
        type: 'object',
        properties: {
          persona_name: { type: 'string', description: 'Nome parcial ou completo da persona (cargo/profissão). Ex: "gerente", "diretor comercial"' },
          objection_names: { type: 'array', items: { type: 'string' }, description: 'Nomes parciais de objeções. Ex: ["preço", "concorrente"]' },
          objective_name: { type: 'string', description: 'Nome parcial do objetivo. Ex: "agendar", "fechar"' },
          age: { type: 'number', description: 'Idade do cliente simulado (18-60). Padrão: 35' },
          temperament: { type: 'string', enum: ['Analítico', 'Empático', 'Determinado', 'Indeciso', 'Sociável'], description: 'Temperamento do cliente simulado' },
          auto_start: { type: 'boolean', description: 'Se true, inicia o roleplay automaticamente. Padrão: false.' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'execute_desktop_action',
      description: 'Executa uma ação no computador do vendedor (abrir aplicativo, URL, pasta, ou navegar na plataforma Ramppy). Só funciona no app desktop Ramppy.',
      parameters: {
        type: 'object',
        properties: {
          action_type: {
            type: 'string',
            enum: ['open_app', 'open_url', 'open_path', 'navigate_platform'],
            description: 'Tipo: open_app (abrir aplicativo), open_url (abrir URL no navegador), open_path (abrir arquivo ou pasta), navigate_platform (navegar dentro do app Ramppy para uma página específica)'
          },
          target: {
            type: 'string',
            description: 'Para open_app: nome do app. Para open_url: URL completa. Para open_path: caminho do arquivo/pasta. Para navigate_platform: caminho da página (ex: "?view=roleplay", "?view=perfil", "?openConfigHub=true").'
          }
        },
        required: ['action_type', 'target']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_computer',
      description: 'Busca no computador do vendedor: programas instalados, pastas ou arquivos. Use ANTES de execute_desktop_action quando não souber o caminho exato. A busca retorna caminhos reais encontrados no PC. Só funciona no app desktop.',
      parameters: {
        type: 'object',
        properties: {
          search_type: {
            type: 'string',
            enum: ['installed_apps', 'find_folder', 'find_file'],
            description: 'installed_apps: busca no registro do Windows por programas instalados. find_folder: busca pastas por nome. find_file: busca arquivos por nome.'
          },
          name: {
            type: 'string',
            description: 'Nome do programa, pasta ou arquivo para buscar (ex: "fortnite", "planilha vendas", "proposta.pdf")'
          }
        },
        required: ['search_type', 'name']
      }
    }
  }
]

// ─── Team Management Tool Definitions (only for admin/gestor) ─────────────────

const teamToolDefinitions: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_team_overview',
      description: 'Busca visão geral da equipe: média geral, total de vendedores, ranking por nota, totais de sessões/reuniões/follow-ups, vendedores que precisam de atenção (nota baixa ou tendência declinante).',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_seller_performance',
      description: 'Busca dados detalhados de um vendedor específico: médias (geral, roleplay, meet, follow-up, whatsapp), SPIN scores, pontos fortes, gaps críticos, tendência, histórico de sessões recentes, PDI ativo.',
      parameters: {
        type: 'object',
        properties: {
          seller_name: { type: 'string', description: 'Nome (ou parte do nome) do vendedor para buscar' },
          seller_user_id: { type: 'string', description: 'ID do vendedor (opcional, mais preciso que nome)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_team_ranking',
      description: 'Busca rankings da equipe: por nota geral (overall), por dimensão SPIN (spin_s, spin_p, spin_i, spin_n), ou por tipo (roleplay, meet, followup, whatsapp).',
      parameters: {
        type: 'object',
        properties: {
          dimension: { type: 'string', description: 'Dimensão: overall, spin_s, spin_p, spin_i, spin_n, roleplay, meet, followup, whatsapp. Default: overall' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compare_sellers',
      description: 'Compara 2 ou mais vendedores lado a lado: notas gerais, médias SPIN, tendências, pontos fortes, gaps, totais de sessões.',
      parameters: {
        type: 'object',
        properties: {
          seller_names: { type: 'array', items: { type: 'string' }, description: 'Nomes dos vendedores para comparar (busca parcial por ilike)' }
        },
        required: ['seller_names']
      }
    }
  }
]

// ─── Manager System Prompt Extension ──────────────────────────────────────────

const MANAGER_PROMPT_EXTENSION = `

VOCÊ ESTÁ CONVERSANDO COM UM GESTOR/ADMIN.
Além de ser coach pessoal, você também é a assistente de gestão da equipe.
Você pode consultar dados de QUALQUER vendedor da empresa, rankings, comparações e sugerir coaching.

FERRAMENTAS DE GESTÃO ADICIONAIS:
- get_team_overview — Visão geral da equipe (ranking, médias, totais, quem precisa de atenção)
- get_seller_performance — Dados detalhados de um vendedor específico
- get_team_ranking — Rankings por nota geral ou dimensão SPIN
- compare_sellers — Comparação lado a lado de vendedores

ESTRATÉGIA POR TIPO DE PERGUNTA DO GESTOR:
- "Quem precisa de atenção?" → get_team_overview (priorize por tendência declinante, nota <5, gaps críticos)
- "Compare os vendedores" / "Compare X e Y" → compare_sellers
- "Como está o [nome]?" → get_seller_performance
- "Média da equipe" → get_team_overview
- "Quem mais evoluiu?" → get_team_ranking(overall)
- "Ranking de SPIN" → get_team_ranking(spin_s/p/i/n)

FORMATAÇÃO VISUAL PARA GESTÃO:
Use as mesmas tags pessoais ({{score}}, {{spin}}, {{trend}}, {{metric}}) MAIS estas tags exclusivas de gestão:

• {{ranking|Nome1|7.5,Nome2|6.3,Nome3|5.1}} — Ranking visual com barras ordenadas
  Ex: {{ranking|João|7.8,Maria|6.3,Pedro|5.1}}

• {{comparison|Nome1|7.5,Nome2|6.3}} — Barras de comparação lado a lado
  Ex: {{comparison|João Roleplay|7.5,João Meet|6.8,João WA|5.2}}

REGRAS DE TAGS DE GESTÃO:
- Use {{ranking}} quando listar posições da equipe inteira
- Use {{comparison}} quando comparar 2-3 vendedores em uma métrica
- Cada tag deve estar em sua própria linha
- Só use com dados reais das ferramentas — NUNCA invente valores
- Ao falar de um vendedor específico, use {{score}} + {{spin}} + {{trend}} para os dados pessoais dele
- Ao comparar vendedores, use {{comparison}} ou {{ranking}} para dados lado a lado`

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

      // ─── Meeting Sharing Operations ──────────────────────────────────
      case 'list_teammates': {
        const { data: employees } = await supabaseAdmin
          .from('employees')
          .select('user_id, name, email, role')
          .eq('company_id', companyId)
          .neq('user_id', userId)

        return {
          total: employees?.length || 0,
          teammates: (employees || []).map(e => ({
            user_id: e.user_id,
            name: e.name,
            email: e.email,
            role: e.role,
          })),
        }
      }

      case 'share_meet_evaluation': {
        if (!params.evaluation_id || !params.teammate_user_ids?.length) {
          return { error: 'evaluation_id e teammate_user_ids são obrigatórios' }
        }

        const sections = params.sections || ['smart_notes', 'spin', 'evaluation', 'transcript']
        const sendEmail = params.send_email !== false

        // Get sender info
        const { data: sender } = await supabaseAdmin
          .from('employees')
          .select('company_id, name')
          .eq('user_id', userId)
          .single()

        if (!sender?.company_id) return { error: 'Empresa não encontrada' }

        // Fetch evaluation with full data for email
        const { data: evaluation } = await supabaseAdmin
          .from('meet_evaluations')
          .select('id, seller_name, overall_score, performance_level, spin_s_score, spin_p_score, spin_i_score, spin_n_score, smart_notes, transcript, evaluation')
          .eq('id', params.evaluation_id)
          .eq('user_id', userId)
          .single()

        if (!evaluation) return { error: 'Avaliação não encontrada ou não pertence ao vendedor' }

        // Verify recipients are from same company
        const { data: recipients } = await supabaseAdmin
          .from('employees')
          .select('user_id, name')
          .eq('company_id', sender.company_id)
          .in('user_id', params.teammate_user_ids)

        if (!recipients?.length) return { error: 'Nenhum destinatário válido encontrado na equipe' }

        // Section labels for notification
        const sectionLabels: Record<string, string> = {
          smart_notes: 'Notas Inteligentes',
          spin: 'Análise SPIN',
          evaluation: 'Avaliação Detalhada',
          transcript: 'Transcrição',
        }
        const sectionNames = sections.map((s: string) => sectionLabels[s] || s).join(', ')

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ramppy.site'

        // Create shares and notifications
        const results = await Promise.allSettled(
          recipients.map(async (recipient) => {
            const { data: share, error: shareError } = await supabaseAdmin
              .from('shared_meet_evaluations')
              .upsert({
                evaluation_id: params.evaluation_id,
                shared_by: userId,
                shared_with: recipient.user_id,
                shared_sections: sections,
                message: params.message || null,
                company_id: sender.company_id,
                is_viewed: false,
                viewed_at: null,
              }, {
                onConflict: 'evaluation_id,shared_by,shared_with',
              })
              .select('id')
              .single()

            if (shareError) throw shareError

            await supabaseAdmin
              .from('user_notifications')
              .insert({
                user_id: recipient.user_id,
                type: 'shared_meeting',
                title: `${sender.name} compartilhou uma reunião`,
                message: params.message || `Compartilhou: ${sectionNames}`,
                data: {
                  shareId: share.id,
                  evaluationId: params.evaluation_id,
                  sharedBy: userId,
                  senderName: sender.name,
                  sections,
                },
              })

            return { userId: recipient.user_id, name: recipient.name, success: true }
          })
        )

        const successful = results.filter(r => r.status === 'fulfilled').length
        const failed = results.filter(r => r.status === 'rejected').length
        const sharedWith = results
          .filter((r): r is PromiseFulfilledResult<{ userId: string; name: string; success: boolean }> => r.status === 'fulfilled')
          .map(r => r.value.name)

        // Send emails (non-blocking)
        let emailsSent = 0
        if (sendEmail) {
          for (const recipient of recipients) {
            try {
              const { data: recipientData } = await supabaseAdmin.auth.admin.getUserById(recipient.user_id)
              const recipientEmail = recipientData?.user?.email
              if (!recipientEmail) continue

              await sendGmail(userId, {
                to: recipientEmail,
                subject: `${sender.name} compartilhou uma reunião com você`,
                htmlBody: buildShareEmailHtml(
                  sender.name,
                  evaluation.seller_name,
                  sectionNames,
                  params.message || null,
                  appUrl,
                  sections,
                  evaluation
                ),
              })
              emailsSent++
            } catch (emailErr) {
              console.warn(`[Agent Share] Failed to email recipient ${recipient.user_id}:`, emailErr)
            }
          }
        }

        return {
          success: true,
          shared_with: sharedWith,
          shared_count: successful,
          failed_count: failed,
          emails_sent: emailsSent,
          sections_shared: sectionNames,
          evaluation_name: evaluation.seller_name,
          message: `Avaliação "${evaluation.seller_name}" compartilhada com ${sharedWith.join(', ')}. ${emailsSent > 0 ? `${emailsSent} email(s) enviado(s).` : 'Nenhum email enviado (Google não conectado ou erro).'}`,
        }
      }

      // ─── Team Management Tools (admin/gestor only) ────────────────────
      case 'get_team_overview': {
        const { data: employees } = await supabaseAdmin
          .from('employees')
          .select('user_id, name, email, role')
          .eq('company_id', companyId)

        const sellers = (employees || []).filter(e => (e.role || '').toLowerCase() !== 'admin')
        const sellerIds = sellers.map(e => e.user_id)

        if (sellerIds.length === 0) return { total_sellers: 0, message: 'Nenhum vendedor cadastrado na empresa.' }

        const { data: summaries } = await supabaseAdmin
          .from('user_performance_summaries')
          .select('user_id, overall_average, total_sessions, spin_s_average, spin_p_average, spin_i_average, spin_n_average, trend')
          .in('user_id', sellerIds)

        // Count totals
        const [roleplayCount, meetCount, followupCount] = await Promise.all([
          supabaseAdmin.from('roleplay_sessions').select('*', { count: 'exact', head: true }).in('user_id', sellerIds).eq('status', 'completed'),
          supabaseAdmin.from('meet_evaluations').select('*', { count: 'exact', head: true }).in('user_id', sellerIds),
          supabaseAdmin.from('followup_analyses').select('*', { count: 'exact', head: true }).in('user_id', sellerIds),
        ])

        const withData = (summaries || []).filter(s => s.overall_average !== null && s.overall_average !== undefined)
        const teamAvg = withData.length > 0
          ? withData.reduce((sum, s) => sum + (s.overall_average || 0), 0) / withData.length : 0

        const ranking = sellers.map(e => {
          const s = withData.find(s => s.user_id === e.user_id)
          return {
            name: e.name,
            score: s?.overall_average || 0,
            trend: s?.trend || 'stable',
            sessions: s?.total_sessions || 0,
            spin_s: s?.spin_s_average ? parseFloat(String(s.spin_s_average)) : null,
            spin_p: s?.spin_p_average ? parseFloat(String(s.spin_p_average)) : null,
            spin_i: s?.spin_i_average ? parseFloat(String(s.spin_i_average)) : null,
            spin_n: s?.spin_n_average ? parseFloat(String(s.spin_n_average)) : null,
          }
        }).sort((a, b) => b.score - a.score)

        return {
          total_sellers: sellers.length,
          team_average: Number(teamAvg.toFixed(1)),
          total_roleplays: roleplayCount.count || 0,
          total_meets: meetCount.count || 0,
          total_followups: followupCount.count || 0,
          ranking,
          sellers_needing_attention: ranking.filter(r => r.score > 0 && (r.score < 5 || r.trend === 'declining')),
        }
      }

      case 'get_seller_performance': {
        // Find the seller by name or user_id
        let targetUserId = params.seller_user_id
        let targetName = params.seller_name

        if (!targetUserId && targetName) {
          const { data: matches } = await supabaseAdmin
            .from('employees')
            .select('user_id, name, email, role')
            .eq('company_id', companyId)
            .ilike('name', `%${targetName}%`)

          if (!matches?.length) return { error: `Vendedor "${targetName}" não encontrado na empresa.` }
          targetUserId = matches[0].user_id
          targetName = matches[0].name
        }

        if (!targetUserId) return { error: 'Informe o nome ou ID do vendedor.' }

        // Fetch all data in parallel
        const [summaryRes, roleplaysRes, meetsRes, followupsRes, challengesRes, pdiRes, waEvalsRes] = await Promise.all([
          supabaseAdmin.from('user_performance_summaries').select('*').eq('user_id', targetUserId).single(),
          supabaseAdmin.from('roleplay_sessions').select('id, config, status, duration_seconds, created_at, evaluation')
            .eq('user_id', targetUserId).eq('status', 'completed').not('evaluation', 'is', null)
            .order('created_at', { ascending: false }).limit(10),
          supabaseAdmin.from('meet_evaluations').select('id, seller_name, overall_score, performance_level, spin_s_score, spin_p_score, spin_i_score, spin_n_score, created_at')
            .eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(10),
          supabaseAdmin.from('followup_analyses').select('id, nota_final, classificacao, tipo_venda, fase_funil, created_at')
            .eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(10),
          supabaseAdmin.from('daily_challenges').select('id, challenge_date, status, score, created_at')
            .eq('user_id', targetUserId).order('challenge_date', { ascending: false }).limit(10),
          supabaseAdmin.from('pdis').select('meta_objetivo, resumo, nota_situacao, nota_problema, nota_implicacao, nota_necessidade, created_at, status')
            .eq('user_id', targetUserId).eq('status', 'ativo').order('created_at', { ascending: false }).limit(1).single(),
          supabaseAdmin.from('conversation_round_evaluations').select('nota_final, contact_name, created_at')
            .eq('user_id', targetUserId).order('created_at', { ascending: false }).limit(10),
        ])

        const summary = summaryRes.data
        const roleplays = (roleplaysRes.data || []).map(s => {
          const ev = parseEvaluation(s.evaluation)
          let score = ev?.overall_score
          if (score !== undefined && score > 10) score = score / 10
          return {
            id: s.id,
            date: new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            score,
            performance_level: ev?.performance_level,
            persona: s.config?.selectedPersona?.cargo || 'N/A',
            spin_s: ev?.spin_evaluation?.S?.final_score,
            spin_p: ev?.spin_evaluation?.P?.final_score,
            spin_i: ev?.spin_evaluation?.I?.final_score,
            spin_n: ev?.spin_evaluation?.N?.final_score,
            executive_summary: ev?.executive_summary?.substring(0, 120),
          }
        })
        const meets = (meetsRes.data || []).map(m => ({
          id: m.id,
          date: new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          score: m.overall_score && m.overall_score > 10 ? m.overall_score / 10 : m.overall_score,
          performance_level: m.performance_level,
          spin_s: m.spin_s_score, spin_p: m.spin_p_score, spin_i: m.spin_i_score, spin_n: m.spin_n_score,
        }))
        const followups = (followupsRes.data || []).map(f => ({
          date: new Date(f.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          score: f.nota_final, classificacao: f.classificacao,
        }))
        const challenges = challengesRes.data || []
        const completedChallenges = challenges.filter(c => c.status === 'completed' || (c.score && c.score > 0))
        const waEvals = (waEvalsRes.data || []).map(e => ({
          date: new Date(e.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          score: e.nota_final, contact: e.contact_name,
        }))

        // Compute averages if no summary
        const rpAvg = roleplays.length > 0
          ? roleplays.reduce((sum, r) => sum + (r.score || 0), 0) / roleplays.filter(r => r.score).length : null
        const meetAvg = meets.length > 0
          ? meets.reduce((sum, m) => sum + (m.score || 0), 0) / meets.filter(m => m.score).length : null
        const fuAvg = followups.length > 0
          ? followups.reduce((sum, f) => sum + (f.score || 0), 0) / followups.filter(f => f.score).length : null

        return {
          seller_name: targetName,
          user_id: targetUserId,
          overall_average: summary?.overall_average || (rpAvg ? Number(rpAvg.toFixed(1)) : null),
          trend: summary?.trend || 'stable',
          total_sessions: summary?.total_sessions || roleplays.length,
          spin_averages: {
            S: summary?.spin_s_average ? parseFloat(String(summary.spin_s_average)) : null,
            P: summary?.spin_p_average ? parseFloat(String(summary.spin_p_average)) : null,
            I: summary?.spin_i_average ? parseFloat(String(summary.spin_i_average)) : null,
            N: summary?.spin_n_average ? parseFloat(String(summary.spin_n_average)) : null,
          },
          top_strengths: summary?.top_strengths_recurring || [],
          critical_gaps: summary?.critical_gaps_recurring || [],
          averages: {
            roleplay: rpAvg ? Number(rpAvg.toFixed(1)) : null,
            meet: meetAvg ? Number(meetAvg.toFixed(1)) : null,
            followup: fuAvg ? Number(fuAvg.toFixed(1)) : null,
            challenges_completed: `${completedChallenges.length}/${challenges.length}`,
          },
          recent_roleplays: roleplays.slice(0, 5),
          recent_meets: meets.slice(0, 5),
          recent_followups: followups.slice(0, 5),
          recent_wa_evals: waEvals.slice(0, 5),
          active_pdi: pdiRes.data || null,
        }
      }

      case 'get_team_ranking': {
        const dimension = params.dimension || 'overall'

        const { data: employees } = await supabaseAdmin
          .from('employees')
          .select('user_id, name, role')
          .eq('company_id', companyId)

        const sellers = (employees || []).filter(e => (e.role || '').toLowerCase() !== 'admin')
        const sellerIds = sellers.map(e => e.user_id)

        if (sellerIds.length === 0) return { ranking: [], message: 'Nenhum vendedor.' }

        const { data: summaries } = await supabaseAdmin
          .from('user_performance_summaries')
          .select('user_id, overall_average, spin_s_average, spin_p_average, spin_i_average, spin_n_average, total_sessions, trend')
          .in('user_id', sellerIds)

        const dimensionMap: Record<string, string> = {
          overall: 'overall_average',
          spin_s: 'spin_s_average',
          spin_p: 'spin_p_average',
          spin_i: 'spin_i_average',
          spin_n: 'spin_n_average',
        }

        const field = dimensionMap[dimension]

        if (field) {
          const ranking = sellers.map(e => {
            const s = (summaries || []).find(s => s.user_id === e.user_id)
            const val = s ? parseFloat(String((s as any)[field])) : 0
            return { name: e.name, score: isNaN(val) ? 0 : val, trend: s?.trend || 'stable', sessions: s?.total_sessions || 0 }
          }).filter(r => r.score > 0).sort((a, b) => b.score - a.score)

          return { dimension, ranking }
        }

        // For type-specific rankings (roleplay, meet, followup, whatsapp) compute from raw data
        if (dimension === 'roleplay') {
          const { data: sessions } = await supabaseAdmin
            .from('roleplay_sessions').select('user_id, evaluation')
            .in('user_id', sellerIds).eq('status', 'completed').not('evaluation', 'is', null)
          const avgMap = new Map<string, { total: number; count: number }>()
          for (const s of (sessions || [])) {
            const ev = parseEvaluation(s.evaluation)
            let score = ev?.overall_score
            if (score !== undefined && score > 10) score = score / 10
            if (score) {
              const curr = avgMap.get(s.user_id) || { total: 0, count: 0 }
              curr.total += score; curr.count++
              avgMap.set(s.user_id, curr)
            }
          }
          const ranking = sellers.map(e => {
            const d = avgMap.get(e.user_id)
            return { name: e.name, score: d ? Number((d.total / d.count).toFixed(1)) : 0, sessions: d?.count || 0 }
          }).filter(r => r.score > 0).sort((a, b) => b.score - a.score)
          return { dimension, ranking }
        }

        if (dimension === 'meet') {
          const { data: evals } = await supabaseAdmin
            .from('meet_evaluations').select('user_id, overall_score')
            .in('user_id', sellerIds)
          const avgMap = new Map<string, { total: number; count: number }>()
          for (const e of (evals || [])) {
            let score = e.overall_score
            if (score && score > 10) score = score / 10
            if (score) {
              const curr = avgMap.get(e.user_id) || { total: 0, count: 0 }
              curr.total += score; curr.count++
              avgMap.set(e.user_id, curr)
            }
          }
          const ranking = sellers.map(e => {
            const d = avgMap.get(e.user_id)
            return { name: e.name, score: d ? Number((d.total / d.count).toFixed(1)) : 0, count: d?.count || 0 }
          }).filter(r => r.score > 0).sort((a, b) => b.score - a.score)
          return { dimension, ranking }
        }

        return { dimension, ranking: [], message: `Dimensão "${dimension}" não reconhecida. Use: overall, spin_s, spin_p, spin_i, spin_n, roleplay, meet.` }
      }

      case 'compare_sellers': {
        const names: string[] = params.seller_names || []
        if (names.length < 2) return { error: 'Informe pelo menos 2 nomes de vendedores para comparar.' }

        const { data: employees } = await supabaseAdmin
          .from('employees')
          .select('user_id, name, role')
          .eq('company_id', companyId)

        const sellers = (employees || []).filter(e => (e.role || '').toLowerCase() !== 'admin')

        // Match sellers by name (partial, case-insensitive)
        const matched = names.map(searchName => {
          const found = sellers.find(e => e.name.toLowerCase().includes(searchName.toLowerCase()))
          return found || null
        }).filter(Boolean) as Array<{ user_id: string; name: string }>

        if (matched.length < 2) return { error: `Encontrei menos de 2 vendedores. Nomes encontrados: ${matched.map(m => m.name).join(', ') || 'nenhum'}. Vendedores disponíveis: ${sellers.map(s => s.name).join(', ')}` }

        const matchedIds = matched.map(m => m.user_id)

        const { data: summaries } = await supabaseAdmin
          .from('user_performance_summaries')
          .select('user_id, overall_average, total_sessions, spin_s_average, spin_p_average, spin_i_average, spin_n_average, trend, top_strengths_recurring, critical_gaps_recurring')
          .in('user_id', matchedIds)

        const comparison = matched.map(seller => {
          const s = (summaries || []).find(s => s.user_id === seller.user_id)
          return {
            name: seller.name,
            overall_average: s?.overall_average || 0,
            total_sessions: s?.total_sessions || 0,
            trend: s?.trend || 'stable',
            spin: {
              S: s?.spin_s_average ? parseFloat(String(s.spin_s_average)) : null,
              P: s?.spin_p_average ? parseFloat(String(s.spin_p_average)) : null,
              I: s?.spin_i_average ? parseFloat(String(s.spin_i_average)) : null,
              N: s?.spin_n_average ? parseFloat(String(s.spin_n_average)) : null,
            },
            top_strengths: s?.top_strengths_recurring || [],
            critical_gaps: s?.critical_gaps_recurring || [],
          }
        })

        return { sellers_compared: comparison }
      }

      case 'search_contact': {
        // ETAPA 1: Busca candidatos na web + WhatsApp (sem gerar briefing)
        const { name: contactName, company: contactCompany, phone: contactPhone } = params

        if (!contactName || typeof contactName !== 'string') {
          return { success: false, error: 'Nome do contato é obrigatório' }
        }

        // ── 0. Check if searching for internal team member ──────────────
        // If company matches user's own company (Ramppy, Assiny, etc.), search employees first
        let internalMatch: any = null
        if (contactCompany) {
          const { data: userCompany } = await supabaseAdmin
            .from('companies')
            .select('name, subdomain')
            .eq('id', companyId)
            .single()

          const companyLower = contactCompany.toLowerCase().trim()
          const isOwnCompany = userCompany && (
            userCompany.name?.toLowerCase().includes(companyLower) ||
            userCompany.subdomain?.toLowerCase().includes(companyLower) ||
            companyLower.includes(userCompany.name?.toLowerCase() || '') ||
            companyLower.includes(userCompany.subdomain?.toLowerCase() || '') ||
            companyLower === 'ramppy'
          )

          if (isOwnCompany) {
            const { data: teammates } = await supabaseAdmin
              .from('employees')
              .select('user_id, name, role')
              .eq('company_id', companyId)
              .ilike('name', `%${contactName}%`)

            if (teammates && teammates.length > 0) {
              // Found internal team member(s) — return them as candidates
              const internalCandidates = teammates.map(t => ({
                name: t.name || contactName,
                title: t.role || 'Vendedor',
                company: userCompany?.name || contactCompany,
                location: '',
                linkedin_url: '',
                is_internal: true,
                user_id: t.user_id,
              }))

              return {
                success: true,
                candidates: internalCandidates,
                whatsapp_match: null,
                whatsapp_matches_count: 0,
                has_whatsapp: false,
                has_web_results: false,
                is_internal_search: true,
                raw_linkedin_urls: [],
              }
            }
          }
        }

        // ── 1. Search WhatsApp conversations ──────────────────────────────
        let waConversations: any[] = []

        if (contactPhone) {
          const phoneSuffix = String(contactPhone).replace(/\D/g, '').slice(-9)
          const { data } = await supabaseAdmin
            .from('whatsapp_conversations')
            .select('contact_name, contact_phone, last_message_at, last_message_preview, profile_pic_url')
            .eq('user_id', userId)
            .ilike('contact_phone', `%${phoneSuffix}%`)
            .limit(5)
          waConversations = data || []
        }

        if (!waConversations.length) {
          const { data } = await supabaseAdmin
            .from('whatsapp_conversations')
            .select('contact_name, contact_phone, last_message_at, last_message_preview, profile_pic_url')
            .eq('user_id', userId)
            .ilike('contact_name', `%${contactName}%`)
            .limit(5)
          waConversations = data || []
        }

        // ── 2. Web search via Brave Search ────────────────────────────────
        let rawLinkedinUrls: string[] = []
        let candidates: Array<{ name: string; title: string; company: string; location: string; linkedin_url: string }> = []
        let snippets = ''

        try {
          const searchQuery = contactCompany
            ? `"${contactName}" "${contactCompany}" LinkedIn`
            : `${contactName} LinkedIn`
          const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(searchQuery)}&source=web`

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
            // Extract LinkedIn profile URLs from raw HTML
            const profileMatches = html.match(/(?:https?:\/\/)?(?:[a-z]{2}\.)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/g)
            if (profileMatches) {
              const unique = [...new Set(profileMatches.map((u: string) => u.startsWith('http') ? u : `https://${u}`))]
              rawLinkedinUrls.push(...unique)
            }
            snippets = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&[a-z]+;/gi, ' ')
              .replace(/\s+/g, ' ')
              .slice(0, 6000)
          }
        } catch (_) { /* search failed */ }

        // ── 3. Use GPT-4o-mini to extract structured candidates ───────────
        if (snippets.length > 200) {
          try {
            const extractResponse = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `Analise os resultados de busca e encontre perfis de LinkedIn de pessoas chamadas "${contactName}"${contactCompany ? ` que trabalham ou estão associadas à empresa "${contactCompany}"` : ''}.

Retorne um JSON array com os candidatos encontrados (máximo 3). Para cada candidato:
- name: nome completo da pessoa
- title: cargo/título atual
- company: empresa atual
- location: cidade/país
- linkedin_url: URL do perfil LinkedIn (se encontrado no texto)

REGRAS ESTRITAS:
- O PRIMEIRO NOME do candidato DEVE conter "${contactName}" (ou variação muito próxima). "Gabriela" NÃO é "Gabrielle", "João" NÃO é "John"${contactCompany ? `
- A EMPRESA do candidato DEVE ser "${contactCompany}" ou muito similar. NÃO confunda nomes de empresa com sobrenomes de pessoas (ex: empresa "New Hack" NÃO é sobrenome "Hacker")
- Se nenhum resultado mostra alguém que REALMENTE trabalha na "${contactCompany}", retorne []` : ''}
- NÃO invente dados. Se não encontrar algum campo, use string vazia ""
- Se não encontrar NENHUM candidato relevante, retorne []
- Se o nome/empresa são muito genéricos e os resultados não parecem ser a pessoa certa, retorne []
- Na DÚVIDA, retorne [] — é melhor não retornar nada do que retornar a pessoa errada
- Retorne APENAS o JSON array, sem texto adicional`
                },
                { role: 'user', content: snippets }
              ],
              temperature: 0.1,
              max_tokens: 500,
            })

            const rawCandidates = extractResponse.choices[0].message.content || '[]'
            try {
              const parsed = JSON.parse(rawCandidates.replace(/```json\n?/g, '').replace(/```/g, '').trim())
              if (Array.isArray(parsed)) {
                candidates = parsed.slice(0, 3).map((c: any) => ({
                  name: c.name || contactName,
                  title: c.title || '',
                  company: c.company || '',
                  location: c.location || '',
                  linkedin_url: c.linkedin_url || '',
                }))
              }
            } catch (_) { /* parse failed, continue */ }
          } catch (_) { /* extraction failed */ }
        }

        // ── 4. Hard-filter: reject candidates whose company clearly doesn't match
        if (contactCompany && candidates.length > 0) {
          const targetCompany = contactCompany.toLowerCase().replace(/[^a-z0-9]/g, '')
          candidates = candidates.filter(c => {
            if (!c.company) return true // no company info, keep as possible
            const candCompany = c.company.toLowerCase().replace(/[^a-z0-9]/g, '')
            // Check if company names overlap meaningfully
            return candCompany.includes(targetCompany) ||
                   targetCompany.includes(candCompany) ||
                   // Check individual words (e.g. "New Hack" vs "New Hack Tecnologia")
                   targetCompany.split(/\s+/).filter(Boolean).some((w: string) =>
                     w.length > 2 && candCompany.includes(w.replace(/[^a-z0-9]/g, ''))
                   )
          })
        }

        // Also hard-filter by first name similarity
        if (contactName && candidates.length > 0) {
          const targetFirst = contactName.toLowerCase().split(' ')[0]
          candidates = candidates.filter(c => {
            const candFirst = (c.name || '').toLowerCase().split(' ')[0]
            // First names must be very similar (allow small typos)
            return candFirst === targetFirst ||
                   candFirst.startsWith(targetFirst) ||
                   targetFirst.startsWith(candFirst)
          })
        }

        // Fill linkedin_url from rawLinkedinUrls if candidates lack it
        candidates.forEach((c, i) => {
          if (!c.linkedin_url && rawLinkedinUrls[i]) {
            c.linkedin_url = rawLinkedinUrls[i]
          }
        })

        // If no candidates from GPT but we have LinkedIn URLs, DON'T blindly create entries
        // Only create if we have no company filter (generic search)
        if (candidates.length === 0 && rawLinkedinUrls.length > 0 && !contactCompany) {
          candidates.push({
            name: contactName,
            title: '',
            company: contactCompany || '',
            location: '',
            linkedin_url: rawLinkedinUrls[0],
          })
        }

        // ── 5. Determine match quality ────────────────────────────────────
        const hasWebResults = candidates.length > 0

        // If no valid candidates after filtering, return clean "not found"
        // Don't leak raw URLs or unrelated WhatsApp contacts to the agent
        if (!hasWebResults && contactCompany) {
          return {
            success: true,
            candidates: [],
            whatsapp_match: null,
            whatsapp_matches_count: 0,
            has_whatsapp: false,
            has_web_results: false,
            raw_linkedin_urls: [],
            search_note: `Nenhum perfil encontrado para "${contactName}" na empresa "${contactCompany}". Tente com mais detalhes (sobrenome completo, cargo, etc).`,
          }
        }

        // WhatsApp match: only include if name closely matches a confirmed candidate
        let bestWaMatch: any = null
        if (waConversations.length > 0 && candidates.length > 0) {
          const topCandidate = candidates[0].name.toLowerCase()
          // Find a WA contact whose name matches the confirmed candidate well
          bestWaMatch = waConversations.find(wa => {
            const waName = (wa.contact_name || '').toLowerCase()
            // Must share more than just first name - check full name or company hint
            return topCandidate.includes(waName) || waName.includes(topCandidate) ||
              (contactCompany && waName.toLowerCase().includes(contactCompany.toLowerCase()))
          }) || null
        }

        return {
          success: true,
          candidates,
          whatsapp_match: bestWaMatch,
          whatsapp_matches_count: bestWaMatch ? 1 : 0,
          has_whatsapp: !!bestWaMatch,
          has_web_results: hasWebResults,
          raw_linkedin_urls: candidates.map(c => c.linkedin_url).filter(Boolean),
        }
      }

      case 'generate_briefing': {
        // ETAPA 2: Gera briefing completo após confirmação do candidato
        const { name: contactName, company: contactCompany, linkedin_url: confirmedLinkedinUrl, phone: contactPhone, web_profile: confirmedWebProfile } = params

        if (!contactName || typeof contactName !== 'string') {
          return { success: false, error: 'Nome do contato é obrigatório' }
        }

        // ── 1. Search WhatsApp conversations ──────────────────────────────
        let waConversations: any[] = []

        if (contactPhone) {
          const phoneSuffix = String(contactPhone).replace(/\D/g, '').slice(-9)
          const { data } = await supabaseAdmin
            .from('whatsapp_conversations')
            .select('contact_name, contact_phone, last_message_at, last_message_preview, profile_pic_url')
            .eq('user_id', userId)
            .ilike('contact_phone', `%${phoneSuffix}%`)
            .limit(5)
          waConversations = data || []
        }

        if (!waConversations.length) {
          const { data } = await supabaseAdmin
            .from('whatsapp_conversations')
            .select('contact_name, contact_phone, last_message_at, last_message_preview, profile_pic_url')
            .eq('user_id', userId)
            .ilike('contact_name', `%${contactName}%`)
            .limit(5)
          waConversations = data || []
        }

        // ── 2. Get recent WhatsApp messages ───────────────────────────────
        let recentMessages: any[] = []
        if (waConversations.length > 0) {
          const { data: msgs } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('content, direction, message_timestamp')
            .eq('user_id', userId)
            .eq('contact_phone', waConversations[0].contact_phone)
            .not('content', 'is', null)
            .order('message_timestamp', { ascending: false })
            .limit(20)
          recentMessages = (msgs || []).reverse()
        }

        // ── 3. Build web profile from confirmed data ──────────────────────
        const webProfile = confirmedWebProfile || ''

        // ── 4. RAG - parallel queries for examples and company knowledge ──
        const embeddingText = `reunião vendas ${contactName} ${contactCompany || ''}`
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingText.slice(0, 8000)
        })
        const embedding = embeddingResponse.data[0].embedding

        const [successResult, knowledgeResult] = await Promise.allSettled([
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
        const companyKnowledge = knowledgeResult.status === 'fulfilled' ? knowledgeResult.value.data || [] : []

        // ── 5. Generate briefing via GPT-4o ───────────────────────────────
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
- **Histórico de Interação**: Resumo das conversas anteriores no WhatsApp (tom, interesses, objeções levantadas). Se não houver histórico, diga explicitamente
- **Inteligência Competitiva**: O que sabemos sobre a empresa/setor do prospect que pode ser útil
- **Pontos de Atenção**: Objeções prováveis baseadas no perfil e histórico
- **Estratégia de Abordagem**: 2-3 táticas específicas baseadas nos exemplos de sucesso e perfil do prospect
- **Perguntas SPIN Recomendadas**: 1 pergunta situacional + 1 de problema personalizadas para este prospect

REGRAS:
- Use APENAS informações reais encontradas. NUNCA invente dados sobre o prospect
- Se não tiver informação sobre algo, diga "Não identificado" em vez de inventar
- Seja direto e prático. Máximo 300 palavras
- Personalize as perguntas SPIN com base no cargo/empresa real do prospect`
            },
            {
              role: 'user',
              content: `CONTATO: ${contactName}${contactCompany ? ` | Empresa: ${contactCompany}` : ''}${contactPhone ? ` | Tel: ${contactPhone}` : ''}

DADOS DO LINKEDIN / WEB:
${webProfile || 'Nenhuma informação pública encontrada.'}

CONVERSAS WHATSAPP:
${conversationSummary}

ABORDAGENS BEM-SUCEDIDAS (RAG):
${examplesContext}

CONHECIMENTO DA NOSSA EMPRESA:
${knowledgeContext || 'Não disponível.'}`
            }
          ],
          temperature: 0.5,
          max_tokens: 1000,
        })

        const briefing = briefingResponse.choices[0].message.content || ''

        // ── 6. Consume 1 credit ───────────────────────────────────────────
        const { data: credits } = await supabaseAdmin
          .from('companies')
          .select('monthly_credits_used')
          .eq('id', companyId)
          .single()

        if (credits) {
          await supabaseAdmin
            .from('companies')
            .update({ monthly_credits_used: (credits.monthly_credits_used || 0) + 1 })
            .eq('id', companyId)
        }

        const linkedinUrl = confirmedLinkedinUrl || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${contactName} ${contactCompany || ''}`.trim())}`

        return {
          success: true,
          whatsapp_match: waConversations[0] || null,
          recent_messages_count: recentMessages.length,
          web_profile: webProfile || null,
          briefing,
          linkedin_url: linkedinUrl,
          success_examples_count: successExamples.length,
        }
      }

      case 'configure_roleplay': {
        const { persona_name, objection_names, objective_name, age, temperament, auto_start } = params

        // Get companyId from employee table
        const { data: empData } = await supabaseAdmin
          .from('employees')
          .select('company_id')
          .eq('user_id', userId)
          .single()

        const rpCompanyId = empData?.company_id || companyId

        // Fetch personas, objections, and objectives for this company
        const [personasRes, objectionsRes, objectivesRes] = await Promise.all([
          supabaseAdmin.from('personas').select('id, cargo, job_title, profissao, profession').eq('company_id', rpCompanyId),
          supabaseAdmin.from('objections').select('id, name').eq('company_id', rpCompanyId),
          supabaseAdmin.from('roleplay_objectives').select('id, name').eq('company_id', rpCompanyId),
        ])

        const allPersonas = personasRes.data || []
        const allObjections = objectionsRes.data || []
        const allObjectives = objectivesRes.data || []

        // Match persona by partial name (case-insensitive)
        let matchedPersona: any = null
        if (persona_name) {
          const search = persona_name.toLowerCase()
          const matches = allPersonas.filter((p: any) => {
            const fields = [p.cargo, p.job_title, p.profissao, p.profession].filter(Boolean)
            return fields.some((f: string) => f.toLowerCase().includes(search))
          })
          if (matches.length === 1) {
            matchedPersona = matches[0]
          } else if (matches.length > 1) {
            return {
              success: false,
              multiple_personas: true,
              matches: matches.map((p: any) => ({
                id: p.id,
                name: p.cargo || p.job_title || p.profissao || p.profession,
              })),
              message: `Encontrei ${matches.length} personas. Qual você quer?`,
            }
          } else {
            return {
              success: false,
              no_persona: true,
              available: allPersonas.map((p: any) => ({
                id: p.id,
                name: p.cargo || p.job_title || p.profissao || p.profession,
              })),
              message: `Nenhuma persona encontrada com "${persona_name}". Personas disponíveis listadas.`,
            }
          }
        }

        // Match objections by partial name (case-insensitive)
        let matchedObjections: any[] = []
        if (objection_names && Array.isArray(objection_names)) {
          for (const objName of objection_names) {
            const search = objName.toLowerCase()
            const match = allObjections.find((o: any) => o.name?.toLowerCase().includes(search))
            if (match) matchedObjections.push(match)
          }
        }

        // Match objective by partial name (case-insensitive)
        let matchedObjective: any = null
        if (objective_name) {
          const search = objective_name.toLowerCase()
          matchedObjective = allObjectives.find((o: any) => o.name?.toLowerCase().includes(search)) || null
        }

        // Build roleplay config
        const roleplayConfig: Record<string, any> = {}
        if (matchedPersona) roleplayConfig.selectedPersona = matchedPersona
        if (matchedObjections.length > 0) roleplayConfig.objections = matchedObjections
        if (matchedObjective) roleplayConfig.selectedObjective = matchedObjective
        roleplayConfig.age = age || 35
        roleplayConfig.temperament = temperament || 'Analítico'
        roleplayConfig.auto_start = auto_start || false

        return {
          success: true,
          roleplayConfig,
          message: `Roleplay configurado${matchedPersona ? ` com persona "${matchedPersona.cargo || matchedPersona.job_title || matchedPersona.profissao}"` : ''}${matchedObjections.length > 0 ? `, ${matchedObjections.length} objeção(ões)` : ''}${matchedObjective ? `, objetivo "${matchedObjective.name}"` : ''}.`,
        }
      }

      case 'execute_desktop_action': {
        const { action_type, target } = params
        const validTypes = ['open_app', 'open_url', 'open_path', 'navigate_platform']
        if (!validTypes.includes(action_type)) {
          return { success: false, error: 'Tipo de ação inválido' }
        }
        if (!target || typeof target !== 'string' || target.trim().length === 0) {
          return { success: false, error: 'Alvo da ação não especificado' }
        }
        if (action_type === 'open_url') {
          try {
            const url = new URL(target)
            if (!['http:', 'https:'].includes(url.protocol)) {
              return { success: false, error: 'Apenas URLs http/https são permitidas' }
            }
          } catch {
            return { success: false, error: 'URL inválida' }
          }
        }
        return {
          success: true,
          action_type,
          target: action_type === 'open_path' ? target.trim() : action_type === 'navigate_platform' ? target.trim() : target.trim().toLowerCase(),
          message: action_type === 'navigate_platform'
            ? `Navegando para "${target}" dentro do app Ramppy.`
            : `Ação ${action_type} para "${target}" será executada no app desktop.`
        }
      }

      case 'search_computer': {
        const { search_type, name: searchName } = params
        const validSearchTypes = ['installed_apps', 'find_folder', 'find_file']
        if (!validSearchTypes.includes(search_type)) {
          return { success: false, error: 'Tipo de busca inválido' }
        }
        if (!searchName || typeof searchName !== 'string') {
          return { success: false, error: 'Nome para busca não especificado' }
        }
        return {
          success: true,
          search_type,
          name: searchName.trim(),
          message: `Busca "${searchName}" será executada no app desktop. Os resultados serão retornados automaticamente.`
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
      .select('company_id, name, role')
      .eq('user_id', user.id)
      .single()

    if (empError) console.error('[Agent] Employee lookup error:', empError.message)

    const companyId = employeeData?.company_id
    if (!companyId) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 400 })
    }

    // Get company subdomain for platform navigation
    const { data: companyData } = await supabaseAdmin
      .from('companies')
      .select('subdomain')
      .eq('id', companyId)
      .single()
    const companySubdomain = companyData?.subdomain || ''

    const userRole = (employeeData?.role || 'vendedor').toLowerCase()
    const isManager = userRole === 'admin' || userRole === 'gestor'

    // Parse body
    const { message, conversationHistory = [], viewingContext, screenshot } = await req.json()
    if (!message) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 })
    }

    // Analyze screenshot with vision model if provided (desktop app auto-capture)
    let screenContext = ''
    if (screenshot && typeof screenshot === 'string' && screenshot.startsWith('data:image')) {
      try {
        const visionResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Descreva brevemente o que está na tela do usuário. Foque em: qual app/site está aberto, que dados/conteúdo está visível, e o que o usuário parece estar fazendo. Seja conciso (2-3 frases).' },
              { type: 'image_url', image_url: { url: screenshot } }
            ]
          }]
        })
        screenContext = visionResponse.choices[0]?.message?.content || ''
      } catch (err) {
        console.error('Vision analysis error:', err)
      }
    }

    // Build messages
    const sellerName = employeeData?.name || user.email || 'Vendedor'
    const platformBase = companySubdomain ? `https://${companySubdomain}.ramppy.site` : 'https://ramppy.site'
    let systemMessage = `${SYSTEM_PROMPT}\n\nVocê está conversando com: ${sellerName}\nData/hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

NAVEGAÇÃO NA PLATAFORMA RAMPPY:
Quando o vendedor perguntar QUALQUER coisa sobre a plataforma Ramppy, funcionalidades, ou onde encontrar algo — NAVEGUE para a página certa usando execute_desktop_action(navigate_platform, "caminho"). Isso abre a página DENTRO do app Ramppy (NÃO no navegador externo). Sempre guie ativamente, nunca apenas descreva.

MAPA DE PÁGINAS (use navigate_platform com estes caminhos):
- Painel Inicial: "?view=home" — Dashboard com resumo de performance, streak, evolução
- Treinar Roleplay: "?view=roleplay" — Treino de vendas com IA (simulação de cliente)
- Chat IA: "?view=chat" — Assistente de vendas com IA (perguntas sobre técnicas, SPIN, etc)
- Meu PDI: "?view=pdi" — Plano de Desenvolvimento Individual (7 dias)
- Histórico: "?view=historico" — Histórico de todos os roleplays e avaliações
- Meu Perfil: "?view=perfil" — Performance detalhada, médias SPIN, gráfico de evolução
- Follow-Up (WhatsApp): "?view=followup" — Chat WhatsApp integrado com Copilot IA
- Análise de Reunião: "?view=meet-analysis" — Avaliação de reuniões Google Meet
- Desafios: "?view=challenge-history" — Histórico de desafios diários
- Configurações: "?openConfigHub=true" — Hub de configuração (personas, objeções, dados empresa)
- Download App: "?view=download" — Baixar app desktop Ramppy
- Gestão de Equipe: "?view=manager" — Visão de gestor (apenas admins)

COMO GUIAR O USUÁRIO:
- "Onde treino roleplay?" → execute_desktop_action(navigate_platform, "?view=roleplay") e diga "Abri o treino de roleplay pra você! Clique em Iniciar Sessão para começar."
- "Quero ver meu desempenho" → execute_desktop_action(navigate_platform, "?view=perfil") e diga "Abri seu perfil! Lá você vê suas médias SPIN e gráfico de evolução."
- "O que é o PDI?" → execute_desktop_action(navigate_platform, "?view=pdi") e explique brevemente
- "Como configuro personas?" → execute_desktop_action(navigate_platform, "?openConfigHub=true") e guie
- "Quero conectar meu WhatsApp" → execute_desktop_action(navigate_platform, "?view=followup") e guie o processo de QR code
- SEMPRE navegue para a página E explique o que o usuário vai encontrar lá
- IMPORTANTE: Para páginas da Ramppy, SEMPRE use navigate_platform (abre dentro do app). Use open_url APENAS para sites externos (Google, LinkedIn, etc).`

    if (isManager) {
      systemMessage += MANAGER_PROMPT_EXTENSION
    }

    // Inject viewing context (what the manager is currently looking at)
    if (viewingContext && isManager) {
      const vc = viewingContext
      const spinLabel = (v: number) => v >= 8 ? 'Excelente' : v >= 6 ? 'Bom' : v >= 4 ? 'Regular' : 'Precisa melhorar'
      systemMessage += `\n\n--- CONTEXTO ATUAL ---\nO gestor está visualizando o perfil do vendedor: ${vc.sellerName} (${vc.sellerEmail})\n`
      systemMessage += `Nota Geral: ${vc.overallAverage > 0 ? vc.overallAverage.toFixed(1) + '/10' : 'Sem dados'}\n`
      systemMessage += `Total de Treinos (Roleplay): ${vc.totalSessions}\n`
      systemMessage += `Total de Meets Avaliados: ${vc.totalMeets}\n`
      systemMessage += `Tendência: ${vc.trend === 'improving' ? 'Melhorando' : vc.trend === 'declining' ? 'Piorando' : 'Estável'}\n`
      systemMessage += `SPIN Selling:\n- Situação (S): ${vc.spinS > 0 ? vc.spinS.toFixed(1) + ' — ' + spinLabel(vc.spinS) : 'Sem dados'}\n- Problema (P): ${vc.spinP > 0 ? vc.spinP.toFixed(1) + ' — ' + spinLabel(vc.spinP) : 'Sem dados'}\n- Implicação (I): ${vc.spinI > 0 ? vc.spinI.toFixed(1) + ' — ' + spinLabel(vc.spinI) : 'Sem dados'}\n- Necessidade (N): ${vc.spinN > 0 ? vc.spinN.toFixed(1) + ' — ' + spinLabel(vc.spinN) : 'Sem dados'}\n`
      systemMessage += `Use esses dados para contextualizar suas respostas. Quando o gestor perguntar sobre "este vendedor" ou "ele/ela", refira-se a ${vc.sellerName}.`
    }

    // Inject screen vision context from desktop app
    if (screenContext) {
      systemMessage += `\n\n--- TELA DO USUÁRIO (captura automática do app desktop) ---\nO vendedor está vendo na tela: ${screenContext}\nUse isso para contextualizar suas respostas quando relevante. Se o vendedor perguntar sobre o que está na tela, use essa descrição.`
    }

    const activeTools = isManager ? [...toolDefinitions, ...teamToolDefinitions] : toolDefinitions

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
    const desktopActions: Array<{ type: string; target: string }> = []
    const searchActions: Array<{ search_type: string; name: string }> = []
    const contactCandidates: Array<{ candidates: any[]; whatsapp_match: any; has_whatsapp: boolean; search_name: string; search_company: string; is_internal_search?: boolean }> = []
    const enrichActions: Array<{ contact: any; web_profile: string | null; briefing: string; linkedin_url: string }> = []
    const MAX_ROUNDS = 5

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1',
        messages,
        tools: activeTools,
        temperature: 0.7,
        max_tokens: 2000,
      })

      const choice = response.choices[0]

      // If the model wants to respond directly
      if (choice.finish_reason === 'stop' || !choice.message.tool_calls?.length) {
        return NextResponse.json({
          response: choice.message.content || 'Desculpe, não consegui processar sua pergunta.',
          toolsUsed,
          isManager,
          ...(desktopActions.length > 0 ? { desktopActions } : {}),
          ...(searchActions.length > 0 ? { searchActions } : {}),
          ...(contactCandidates.length > 0 ? { contactCandidates } : {}),
          ...(enrichActions.length > 0 ? { enrichActions } : {}),
        })
      }

      // Execute tool calls in parallel
      const toolResults = await Promise.all(
        choice.message.tool_calls.map(async (tc) => {
          const tcFn = tc as { function: { name: string; arguments: string }; id: string }
          toolsUsed.push(tcFn.function.name)
          const result = await executeFunction(tc, user.id, companyId)

          // Collect desktop actions for client-side execution
          if (tcFn.function.name === 'execute_desktop_action' && result && (result as Record<string, unknown>).success) {
            desktopActions.push({
              type: (result as Record<string, unknown>).action_type as string,
              target: (result as Record<string, unknown>).target as string,
            })
          }

          // Collect search actions for client-side execution
          if (tcFn.function.name === 'search_computer' && result && (result as Record<string, unknown>).success) {
            searchActions.push({
              search_type: (result as Record<string, unknown>).search_type as string,
              name: (result as Record<string, unknown>).name as string,
            })
          }

          // Collect search_contact candidates for client-side confirmation card
          if (tcFn.function.name === 'search_contact' && result && (result as Record<string, unknown>).success) {
            const r = result as Record<string, unknown>
            const args = JSON.parse(tcFn.function.arguments)
            contactCandidates.push({
              candidates: (r.candidates as any[]) || [],
              whatsapp_match: r.whatsapp_match || null,
              has_whatsapp: r.has_whatsapp as boolean,
              search_name: args.name,
              search_company: args.company || '',
              is_internal_search: r.is_internal_search as boolean || false,
            })
          }

          // Collect configure_roleplay results → navigate to roleplay page with config
          if (tcFn.function.name === 'configure_roleplay' && result && (result as Record<string, unknown>).success) {
            const r = result as Record<string, unknown>
            desktopActions.push({
              type: 'navigate_platform',
              target: `?view=roleplay&nicoleConfig=${encodeURIComponent(JSON.stringify(r.roleplayConfig))}`,
            })
          }

          // Collect generate_briefing results for client-side briefing card
          if (tcFn.function.name === 'generate_briefing' && result && (result as Record<string, unknown>).success) {
            const r = result as Record<string, unknown>
            const args = JSON.parse(tcFn.function.arguments)
            enrichActions.push({
              contact: r.whatsapp_match || { name: args.name, company: args.company },
              web_profile: (r.web_profile as string) || null,
              briefing: r.briefing as string,
              linkedin_url: r.linkedin_url as string,
            })
          }

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
      isManager,
      ...(desktopActions.length > 0 ? { desktopActions } : {}),
      ...(searchActions.length > 0 ? { searchActions } : {}),
      ...(enrichActions.length > 0 ? { enrichActions } : {}),
    })

  } catch (error) {
    console.error('[Agent] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
