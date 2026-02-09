# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Assiny is a **multi-tenant SaaS** internal sales training platform with AI-powered roleplay, conversational AI assistant (Chat IA), administrative management hub, and employee tracking. The system uses **subdomain-based routing** for company isolation and integrates with N8N workflows for audio transcription, text-to-speech, automated performance evaluation, and persistent chat memory using LangChain + PostgreSQL.

### Multi-Tenant Architecture

**Subdomain Routing:**
- Each company has a unique subdomain (e.g., `assiny.ramppy.local`, `maniafoods.ramppy.local`)
- Middleware (`middleware.ts`) detects subdomain and sets `x-subdomain` header
- Main domain without subdomain shows default content (no company selection page)
- Development: `*.ramppy.local:3000` | Production: `*.ramppy.site`

**Company Isolation:**
- All core tables have `company_id` foreign key for data isolation
- `getCompanyId()` prioritizes subdomain detection over user's company
- Row Level Security (RLS) enforces company boundaries at database level
- ConfigHub, personas, objections, company_data all use subdomain-based company detection

## Tech Stack

- **Next.js 16** with App Router and TypeScript
- **Supabase** for authentication, PostgreSQL database, and storage
- **N8N** for workflow automation (TTS, transcription, evaluation, chat memory)
- **OpenAI** GPT-4o for copilot/analysis, Assistants API for roleplay, Whisper for transcription, Embeddings (ada-002) for RAG
- **whatsapp-web.js 1.34.6** + **Puppeteer** for WhatsApp integration (browser automation, not Cloud API)
- **LangChain** Postgres Chat Memory for conversation persistence
- **Tailwind CSS** for styling
- **pgvector** extension for semantic document search
- **Recall.ai** + **Deepgram** for Google Meet transcription analysis

## Development Commands

```bash
# Development
npm run dev              # Start dev server at localhost:3000
npm run dev:https        # HTTPS mode (for testing secure contexts)
npm run dev:network      # Bind to 0.0.0.0 (remote device access)

# Production
npm run build            # Build for production
npm run start            # Run production build
npm run start:network    # Production with 0.0.0.0

# Code quality
npm run lint             # Run ESLint

# Note: postinstall runs `node scripts/patch-wwebjs.js` (patches whatsapp-web.js)
```

### Local Multi-Tenant Development

**Setup /etc/hosts for subdomain testing:**
```bash
sudo nano /etc/hosts
```

Add these lines:
```
127.0.0.1 assiny.ramppy.local
127.0.0.1 maniafoods.ramppy.local
```

**Access URLs:**
- Assiny (B2B): `http://assiny.ramppy.local:3000`
- Mania Foods (B2C): `http://maniafoods.ramppy.local:3000`
- Main domain: `http://localhost:3000` (shows default login page)

**Production URLs:**
- Assiny: `https://assiny.ramppy.site`
- Mania Foods: `https://maniafoods.ramppy.site`
- Admin panel: `https://ramppy.site/admin/companies`

**Admin Panel:**
- URL: `/admin/companies` (accessible without subdomain)
- Password: `admin123` (session-based authentication)
- Features: Create/delete companies, view employee counts, manage multi-tenant instances

## Architecture Overview

### Core Application Flow

1. **Authentication**: Users authenticate via Supabase Auth
2. **Roleplay Training**:
   - User configures session (age, temperament, persona, objections)
   - Frontend creates OpenAI Assistant thread via `/api/roleplay/chat`
   - Session metadata saved to `roleplay_sessions` table
   - Voice conversation: User speaks → Whisper transcription → Assistant response → N8N TTS → User listens
   - All messages appended to `roleplay_sessions.messages` JSONB array
3. **Evaluation & Performance Tracking**:
   - On session end, `/api/roleplay/evaluate` sends transcript + context to N8N
   - N8N agent analyzes using SPIN Selling methodology
   - Evaluation stored in `roleplay_sessions.evaluation` JSONB column
   - Performance summary auto-updated in `user_performance_summaries` table
   - Summary uses ALL sessions for averages, LAST 5 for recurring feedback patterns
4. **Chat IA (Conversational Assistant)**:
   - Multi-user conversational AI with session persistence
   - Messages stored in `chat_sessions` table (LangChain Postgres Chat Memory format)
   - Each conversation has unique `session_id` shared by all messages
   - Session finalization triggers webhook to N8N with `sessionId` + `userId`
   - Users can create new sessions, load history, and manage conversations
5. **PDI (Plano de Desenvolvimento Individual)**:
   - AI-generated 7-day development plan based on user performance data
   - Sends performance summary to N8N agent for personalized PDI generation
   - Stored in `pdis` table with 1-week cooldown between generations
   - Displays diagnostics, SPIN radar chart, goals, actions, and next steps
6. **History & Profile**: Users review past sessions with transcripts, metrics, and consolidated analytics
7. **WhatsApp Integration** (`FollowUpView.tsx` + `lib/whatsapp-client.ts`):
   - Uses **whatsapp-web.js** (browser automation via Puppeteer), NOT Meta's Cloud API
   - Per-user client instances with QR code authentication and LocalAuth session caching
   - Client lifecycle: `initializing` → `qr_ready` → `connecting` → `connected`
   - Real-time message sync: messages saved to `whatsapp_messages` on receive/send
   - Chat history sync: lightweight Store.Chat evaluation (not `getChats()`) for 40 most recent chats
   - Media handling: images, audio, video, documents with Supabase Storage
   - Audio voice messages: WebM→WAV→OGG/Opus conversion via ffmpeg (WhatsApp mobile requires OGG/Opus 16kHz mono)
   - Anti-ban: typing simulation + random delays (2-4s text, 1-2s media) before sending
   - TTL reaper: auto-disconnects stale clients after 3 min without heartbeat (soft reap preserves session)
   - Browser health check: periodic `page.evaluate(() => 1)` detects broken Puppeteer contexts
   - Audio transcription: Whisper auto-transcribes incoming voice messages
8. **Sales Copilot AI** (`SalesCopilot.tsx` + `app/api/copilot/`):
   - Floating AI chat panel for real-time WhatsApp conversation assistance
   - RAG pipeline: embeddings → `match_followup_examples()` + `match_company_knowledge()` → GPT-4o
   - Auto-learning: tracks all seller messages → classifies client responses (GPT-4o-mini) → saves as success/failure examples
   - No-response detection: marks messages with no reply after 24h as failure
   - Manual feedback loop: 👍/👎 on suggestions saves directly to success/failure example tables
   - Costs 1 credit per message
9. **Daily Challenges / Desafios** (`components/Challenge/`, `app/desafio/`):
   - AI-generated personalized daily roleplay challenges targeting SPIN weaknesses
   - One challenge per day (UNIQUE constraint on user_id + challenge_date)
   - Tracks effectiveness over time (`challenge_effectiveness` table)
   - Enabled per-company via `companies.daily_challenges_enabled`
10. **Google Meet Analysis** (`app/api/meet/evaluate/`):
    - Recall.ai API extracts meeting transcription, Deepgram for PT-BR accuracy
    - Ultra-strict SPIN evaluation (scores 7-10 are rare; 5-6 = competent)
    - Same output structure as roleplay evaluations
11. **Follow-Up Analysis** (`app/api/followup/analyze/`):
    - Evaluates WhatsApp follow-up messages with detailed scoring (6 criteria)
    - Auto-saves high-scoring examples (≥7.5) to `followup_examples_success` with embeddings for RAG
    - Costs 1 credit per analysis

### Database Schema

**Key Tables:**
- `companies` - **Multi-tenant company registry**
  - Columns: `id`, `name`, `subdomain`, `created_at`, `updated_at`
  - Each company has unique subdomain for URL routing
  - All other tables reference `company_id` for data isolation
- `users` - User profiles with roles (admin/vendedor)
- `employees` - Employee records (synced with auth.users)
  - Has `company_id` foreign key
  - Users belong to one company
- `roleplay_sessions` - Roleplay sessions with messages, config, evaluation
  - `messages` - JSONB array: `[{ role: "client"|"seller", text: "...", timestamp: "..." }]`
  - `config` - JSONB: `{ age, temperament, segment, objections[] }`
  - `evaluation` - JSONB: Full SPIN evaluation from N8N agent
- `user_performance_summaries` - **Performance summaries for AI agent personalization**
  - Auto-updated after each roleplay via `/api/performance-summary/update`
  - Stores: overall averages, SPIN metrics, top strengths/gaps (last 5 sessions), trend
  - Has UNIQUE constraint on `user_id` for upsert operations
  - Service role has full access (for AI agents to read all user data)
- `chat_sessions` - **LangChain Postgres Chat Memory**
  - Structure: `id`, `session_id`, `message` (JSONB), `user_id`, `created_at`
  - Each message is a separate row (NOT array of messages)
  - `message` column format: `{ type: "human"|"ai", data: { content: "..." } }`
  - Has RLS - users see only their own sessions (`auth.uid() = user_id`)
  - **Trigger**: `trigger_auto_fill_user_id` auto-populates `user_id` for subsequent messages in same session
- `pdis` - **PDI (Plano de Desenvolvimento Individual) storage**
  - Stores 7-day development plans generated by N8N agent
  - Contains: diagnostics, SPIN scores, goals, actions, checkpoints, next steps
  - Has `created_at` timestamp for cooldown calculation (1 week between generations)
  - Only one active PDI per user at a time (deleted when generating new)
- `personas` - B2B/B2C customer personas (linked to business_type)
  - Has `company_id` foreign key for multi-tenant isolation
  - Has `evaluation_score` column (DECIMAL 0-10) for quality assessment
  - Score resets to NULL when persona is edited
- `objections` - Sales objections library
  - Has `company_id` foreign key for multi-tenant isolation
  - `name` - The objection text
  - `rebuttals` - JSONB array of rebuttal strategies
  - `evaluation_score` - DECIMAL(3,1) for quality assessment (0-10)
  - Score resets to NULL when objection or rebuttals are edited
  - Evaluation webhook: `https://ezboard.app.n8n.cloud/webhook/ed84cced-6bf5-4c4d-87e7-4ca3057be871`
- `company_data` - **Company information for AI training**
  - Has `company_id` foreign key (one record per company)
  - Stores 9 fields: nome, descricao, produtos_servicos, funcao_produtos, diferenciais, concorrentes, dados_metricas, erros_comuns, percepcao_desejada
  - Uses UPDATE (not INSERT) when editing existing company data
  - Auto-generates embeddings on save/update via `/api/company/generate-embeddings`
- `documents` - **Vector embeddings for company knowledge (pgvector, N8N compatible)**
  - Stores embeddings from `company_data` in chunks (8 chunks per company)
  - Columns: `id`, `company_data_id`, `category`, `question`, `content`, `embedding` (VECTOR 1536), `metadata` (JSONB)
  - ON DELETE CASCADE - embeddings auto-deleted when company_data is deleted
  - 100% cleared and regenerated when company_data is updated
  - Uses `match_company_knowledge()` function for semantic search
  - Compatible with N8N Supabase Vector Store (uses standard table name)
- `whatsapp_connections` - Per-user WhatsApp client sessions
  - Columns: `user_id`, `company_id`, `phone_number_id`, `display_phone_number`, `status` (active/disconnected), `connected_at`
  - FK integrity: messages reference `connection_id` — use UPDATE (not DELETE) on disconnect to preserve messages
- `whatsapp_messages` - All WhatsApp messages (inbound + outbound)
  - Columns: `connection_id`, `user_id`, `wa_message_id`, `contact_phone`, `contact_name`, `direction`, `message_type`, `content`, `media_id`, `message_timestamp`, `transcription`, `raw_payload` (JSONB)
  - `raw_payload` stores: `original_chat_id`, `is_lid`, `is_group`, `hasMedia`
  - RLS: users see only their own messages
- `whatsapp_conversations` - Conversation summaries (one per contact per connection)
  - UNIQUE constraint on `(connection_id, contact_phone)` for upsert
  - Tracks `last_message_at`, `last_message_preview`, `unread_count`, `profile_pic_url`
- `copilot_feedback` - Copilot interaction logs with optional 👍/👎 feedback
  - `was_helpful` (boolean | null) — null = no feedback yet
- `seller_message_tracking` - Auto-tracks all outbound seller messages for outcome analysis
  - `outcome` (success | failure | partial | null) — null = pending analysis
  - `saved_as_example` — whether it was already saved to followup_examples tables
- `followup_analyses` - Follow-up message evaluations with detailed scoring
- `followup_examples_success` / `followup_examples_failure` - RAG examples with embeddings (VECTOR 1536)
  - Used by `match_followup_examples()` for semantic search in Copilot and Follow-Up Analysis
- `daily_challenges` - Daily personalized roleplay challenges
  - `challenge_config` (JSONB) with roleplay settings, success criteria, coaching tips
  - UNIQUE on `(user_id, challenge_date)`
- `challenge_effectiveness` - Tracks improvement for each target weakness over time
- `knowledge_base` - SPIN/psychology content (category, title, content)
- `customer_segments` - (Legacy, replaced by personas)
- `company_type` - Business type configuration (B2B or B2C)
  - Has `company_id` foreign key (one record per company)
  - CRITICAL: Each company must have its own company_type record

**Important Notes:**
- **Multi-tenant Isolation**: All core tables (employees, personas, objections, company_data, company_type) have `company_id` foreign key
- All config tables have Row Level Security (RLS) enabled for security enforcement at database level
- `roleplay_sessions` has RLS - users only see their own sessions (filtered by `user_id`)
- `user_performance_summaries` has RLS - users see only their own, service role has full access
- `chat_sessions` has RLS by `user_id` - critical for multi-user isolation
- First message in each chat session MUST include `user_id` from frontend
- `evaluation` column added via `adicionar-coluna-evaluation.sql`
- **CRITICAL**: When creating/updating data, always use `getCompanyId()` from `lib/utils/getCompanyFromSubdomain.ts` (NOT `getCompanyIdFromUser()`)

### API Routes

**Employee Management:**
- `/api/employees/create` - Create employee (requires service role key)
- `/api/employees/delete` - Delete employee
- `/api/employees` - List employees

**Roleplay:**
- `/api/roleplay/chat` - OpenAI Assistant conversation
- `/api/roleplay/transcribe` - Whisper audio transcription
- `/api/roleplay/tts` - Text-to-speech via N8N
- `/api/roleplay/evaluate` - Send session to N8N for SPIN evaluation

**Performance Summaries:**
- `/api/performance-summary/update` - Update user's performance summary (auto-called after evaluation)
- `/api/performance-summary/populate-all` - Populate summaries for all users with existing sessions

**Company Data & Embeddings:**
- `/api/company/generate-embeddings` - Generate vector embeddings from company_data
  - Called automatically after company_data save/update
  - Deletes all old embeddings, creates 8 new chunks
  - Uses OpenAI text-embedding-ada-002 model
- `/api/company/search` - Semantic search test endpoint (for debugging)

**WhatsApp:**
- `/api/whatsapp/connect` - POST: Initialize client + QR code; GET: Poll status
- `/api/whatsapp/status` - GET: Check connection status (in-memory + DB fallback)
- `/api/whatsapp/disconnect` - POST: Logout and destroy client
- `/api/whatsapp/heartbeat` - POST: Keep-alive signal (frontend sends every 20s)
- `/api/whatsapp/conversations` - GET: List conversations (deduplicated by phone/name)
- `/api/whatsapp/messages` - GET: Fetch messages for a contact (supports phone normalization, LID contacts, groups)
- `/api/whatsapp/send` - POST: Send text or media messages (multipart/form-data for media)
- `/api/whatsapp/sync` - POST: Manually trigger chat sync
- `/api/whatsapp/media/[mediaId]` - GET: Download media from Supabase Storage

**Copilot:**
- `/api/copilot/chat` - POST: AI suggestion with RAG pipeline (1 credit)
- `/api/copilot/feedback` - POST: 👍/👎 feedback → saves to success/failure examples with embedding
- `/api/copilot/analyze-outcome` - POST: Auto-classify client response (GPT-4o-mini, non-blocking)
- `/api/copilot/check-no-response` - POST: Detect seller messages with no reply >24h → mark as failure

**Follow-Up:**
- `/api/followup/analyze` - POST: Evaluate follow-up message with detailed scoring (1 credit)

**Meet:**
- `/api/meet/evaluate` - POST: SPIN evaluation of meeting transcription (ultra-strict scoring)

**Other:**
- `/api/evaluate-quality` - Quality evaluation endpoint

### N8N Webhook Integration

**Critical Webhooks:**
- **TTS**: `https://ezboard.app.n8n.cloud/webhook/0ffb3d05-ba95-40e1-b3f1-9bd963fd2b59`
  - Input: `{ text: string }`
  - Output: Audio blob (MP3)

- **Evaluation**: `https://ezboard.app.n8n.cloud/webhook/b34f1d38-493b-4ae8-8998-b8450ab84d16`
  - Input: `{ transcription: string, context: { age, temperament, persona, objections[] } }`
  - Output: `[{ output: "json_string" }]` (must be parsed!)

- **Chat IA**: `https://ezboard.app.n8n.cloud/webhook/6ca93480-7567-4d51-914a-6f16fcf39bc8/chat`
  - Input: `{ action: "sendMessage", chatInput: string, sessionId: string, userId: string }`
  - Output: `[{ output: "response_text" }]`
  - Uses LangChain Postgres Chat Memory in N8N for conversation persistence
  - N8N Postgres INSERT node must be configured to use `{{ $json.userId }}` for `user_id` column

- **Session Finalization**: `https://ezboard.app.n8n.cloud/webhook/6b6ee058-e7f6-480f-ac0a-2ba409835c9a`
  - Triggered when user ends a chat session (via modal confirmation)
  - Input: `{ sessionId: string, userId: string }`
  - Used for post-session processing (analytics, summaries, etc.)

- **File Upload**: `https://ezboard.app.n8n.cloud/webhook/c91010a1-9003-4a8b-b9bd-30e689c7c4ac`

- **Persona Evaluation**: `https://ezboard.app.n8n.cloud/webhook/persona-consultor`
  - Triggered when admin clicks "AVALIAR PERSONA" in ConfigHub
  - Input: `{ persona: string }` (formatted text with all 5 persona fields)
  - Output: `[{ output: "```json\n{...}\n```" }]` (JSON wrapped in markdown code block)
  - Agent evaluates persona quality for B2B/B2C sales roleplay scenarios
  - Returns scores (0-10) for each field, SPIN readiness, strengths, gaps, and recommendations

- **PDI Generation**: `https://ezboard.app.n8n.cloud/webhook/pdi/generate`
  - Triggered when user clicks "Gerar PDI" or "Gerar Novo PDI" in PDIView
  - Input: `{ userId: string, userName: string, resumoPerformance: string }`
  - Output: `[{ output: "json_string" }]` or `{ output: "json_string" }` (must be parsed!)
  - Agent generates 7-day development plan based on SPIN performance data
  - Returns: diagnostics, SPIN scores, goals, actions, checkpoint, next steps
  - **Cooldown**: 1 week between generations (enforced by frontend)

- **Objection Evaluation**: `https://ezboard.app.n8n.cloud/webhook/ed84cced-6bf5-4c4d-87e7-4ca3057be871`
  - Triggered when admin clicks "AVALIAR" on objection in ConfigHub
  - Input: `{ objecao_completa: string }` (formatted text with objection + rebuttals)
  - Output: JSON with nota_final, status, como_melhorar, etc.
  - Score saved to `objections.evaluation_score` column

**N8N Response Parsing:**
N8N can return evaluations in multiple formats. Always handle both:

```typescript
// Backend (api/roleplay/evaluate/route.ts)
let evaluation = rawResponse

// Case 1: {output: "json_string"}
if (evaluation?.output && typeof evaluation.output === 'string') {
  evaluation = JSON.parse(evaluation.output)
}
// Case 2: [{output: "json_string"}]
else if (Array.isArray(evaluation) && evaluation[0]?.output && typeof evaluation[0].output === 'string') {
  evaluation = JSON.parse(evaluation[0].output)
}

// Frontend (components)
if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
  try {
    evaluation = JSON.parse(evaluation.output)
  } catch (e) {
    console.error('Failed to parse evaluation:', e)
  }
}

// Persona Evaluation (ConfigHub.tsx) - Remove markdown code blocks
if (Array.isArray(result) && result[0]?.output) {
  const outputString = result[0].output
  const jsonString = outputString.replace(/```json\n/, '').replace(/\n```$/, '')
  evaluation = JSON.parse(jsonString)
}
```

**Important:** Backend must parse BEFORE saving to database. Frontend parsing is a fallback for legacy data.

### Key Components

**Main Views:**
- `Dashboard.tsx` - Main application shell with header navigation
  - Uses `useRef<ChatInterfaceHandle>` to intercept Chat IA navigation
  - `handleViewChange()` calls `chatRef.current.requestLeave()` when leaving Chat IA
  - Prevents data loss by showing confirmation modal before navigation
  - Header does NOT include "Empresas" button (admin panel accessible only via direct URL)

- `app/admin/companies/page.tsx` - **Company management admin panel**
  - Password-protected interface (`admin123` stored in sessionStorage)
  - Create new companies with subdomain, admin user, and business type
  - Delete companies with CASCADE cleanup (removes all related data)
  - IMPORTANT: Does NOT auto-create personas/objections/company_data (companies start empty)
  - Shows warning about manual `/etc/hosts` configuration for subdomains
  - Uses custom Toast and ConfirmModal components instead of browser alerts

- `ChatInterface.tsx` - **Conversational AI assistant with session management**
  - Uses `forwardRef` to expose `requestLeave()` method to Dashboard
  - Session lifecycle: Create session → Send messages → End session (with confirmation)
  - **Session Management**:
    - Each conversation has unique `session_id` (format: `session_${timestamp}_${random}`)
    - First message includes `userId` from `supabase.auth.getUser()`
    - Subsequent messages inherit `user_id` via database trigger
    - Sessions saved to localStorage as backup
  - **End Session Modal**:
    - Triggered when: creating new session, loading different session, navigating away via header
    - Shows yellow warning modal: "Você está encerrando essa sessão"
    - On OK: Sends `{ sessionId, userId }` to finalization webhook → Saves to localStorage → Executes action
  - **History**:
    - Loads sessions filtered by `user_id` (multi-user support)
    - Groups messages by `session_id`, counts messages, shows last message preview
    - Clicking session loads full conversation from database

- `RoleplayView.tsx` - Voice-based roleplay training interface
  - **Audio Recording**: Manual start/stop (no automatic silence detection)
    - User clicks microphone to START recording
    - User clicks "Finalizar Fala" button to STOP and send
    - Removes buggy auto-detection of silence
  - **Audio Visualization**: Purple blob reacts to TTS playback
    - 4 layers: main blob, secondary, tertiary (volume >0.3), bright core (volume >0.5)
    - Uses Web Audio API to analyze frequency data in real-time
    - Dynamic size, opacity, blur, and transform based on audio volume
    - FFT size 128, smoothing 0.3 for high responsiveness
  - Manages recording, transcription, TTS playback
  - Creates/updates roleplay sessions
  - Triggers evaluation on session end
  - Shows evaluation modal with scores
  - Auto-updates performance summary after successful evaluation
  - **Session Info**: Shows real-time date/time (no static timestamps)
  - **Age & Temperament Info Boxes**: Dynamic behavior descriptions shown based on user selections
    - Age ranges: 18-24, 25-34, 35-44, 45-60 (tone, vocabulary, behavior patterns)
    - Temperaments: Analítico, Empático, Determinado, Indeciso, Sociável (behavior, style, triggers)

- `HistoricoView.tsx` - Session history with detailed analysis
  - Lists all user sessions
  - Shows full transcripts
  - Displays SPIN evaluation breakdown
  - Uses `getProcessedEvaluation()` to parse N8N format

- `PerfilView.tsx` - User profile with performance analytics
  - Shows overall average and SPIN metrics from ALL sessions
  - Interactive evolution chart with navigation (8 sessions visible at a time)
  - Summary modal consolidating feedback from LAST 5 roleplays:
    - Pontos Fortes Recorrentes: Shows which sessions (#3, #5, #7) each strength appeared in
    - Gaps Críticos Recorrentes: Shows which sessions each gap appeared in
    - Melhorias Prioritárias: Shows which session each improvement came from
  - Uses `key={Date.now()}` in Dashboard to force reload on navigation
  - Real-time user data from Supabase Auth

- `ConfigHub.tsx` - Admin configuration hub
  - Password protected (`admin123`)
  - Manages employees, personas, objections, business type, company data
  - **Dados da Empresa Tab**:
    - 9-field form for company information (nome, descricao, produtos_servicos, etc.)
    - Button dynamically shows "Salvar" (first time) or "Atualizar" (when editing)
    - Auto-generates embeddings on save via `/api/company/generate-embeddings`
    - Tracks `companyDataId` state to prevent duplicates (UPDATE vs INSERT)
  - **Persona Evaluation System**:
    - "AVALIAR PERSONA" button sends persona data to N8N consultant agent
    - Agent evaluates using SPIN Selling methodology (5 fields: cargo, tipo_empresa_faturamento, contexto, busca, dores)
    - Returns detailed JSON with scores (0-10), SPIN readiness, suggestions, and quality classification
    - Side panel displays evaluation (z-[70]) while ConfigHub shifts left (translate-x-[-250px])
    - Red warning banner: Personas below 7.0 may compromise roleplay quality
    - Evaluation webhook: `https://ezboard.app.n8n.cloud/webhook/persona-consultor`
  - **Objection Evaluation System**:
    - "AVALIAR" button on each objection (becomes "REAVALIAR" after first evaluation)
    - Sends formatted text with objection + all rebuttals to N8N
    - Green-themed modal displays results (nota_final, status, como_melhorar)
    - Score badge shows color-coded rating (green ≥7, yellow 4-6.9, red <4)
    - Score resets to NULL when objection or rebuttals are edited

- `PDIView.tsx` - **PDI (Plano de Desenvolvimento Individual) interface**
  - Displays AI-generated 7-day development plans
  - **Generation**:
    - Fetches user's performance summary from `user_performance_summaries`
    - Formats all data (averages, SPIN scores, strengths, gaps) into single text string
    - Sends to N8N webhook: `https://ezboard.app.n8n.cloud/webhook/pdi/generate`
    - Parses response and saves to `pdis` table
  - **Cooldown System**:
    - Tracks last PDI creation date from database
    - Calculates days remaining (7 - days since creation)
    - Button disabled if cooldown active, shows "Aguarde X dia(s)"
    - Deletes old PDI before creating new one
  - **Display**:
    - Diagnóstico Geral with overall score and summary
    - SPIN radar chart (viewBox 220x220, centered at 110,110)
    - Meta de 7 Dias with progress bar
    - Ações para os Próximos 7 Dias (numbered list)
    - Próximos Passos (final guidance)
  - Empty state shows placeholder structure before generation

- `FollowUpView.tsx` - **WhatsApp chat interface** (largest component, ~2000+ lines)
  - Full WhatsApp-style chat UI with dark theme (`#111b21`)
  - Connection flow: disconnected → initializing → qr_ready → connecting → connected
  - Left sidebar (400px): conversation list with search, profile pics, unread badges
  - Main content: message thread with media support (images, audio player, documents)
  - Input bar: text input, emoji picker, voice recording, file attachment
  - Polls `/api/whatsapp/connect` every 2s during initialization
  - Heartbeat every 20s when connected
  - Renders `SalesCopilot` as floating overlay when conversation is selected
  - `loadConversations(showSpinner)` — only first call shows full spinner; retries are silent

- `SalesCopilot.tsx` - **AI assistant floating panel** for WhatsApp conversations
  - 400px slide-in panel from right, z-[60], WhatsApp dark theme
  - Quick suggestions: "O que responder?", "Analise conversa", "Como fechar?", "Sugira follow-up"
  - Context formatting: last 30 messages with smart truncation (5 first + 25 last if >30)
  - Resets on conversation change
  - Copy button + feedback (👍/👎) on each AI response

**Libraries:**
- `lib/whatsapp-client.ts` - **WhatsApp client singleton** (server-side only)
  - Manages per-user Puppeteer/WhatsApp instances
  - Exports: `initializeClient()`, `disconnectClient()`, `getClientState()`, `getConnectedClient()`, `updateHeartbeat()`, `triggerSync()`
  - Internal: `syncChatHistory()`, `handleIncomingMessage()`, `reapClient()`, `checkBrowserHealth()`, `ensureValidConnectionId()`
  - TTL reaper runs on `setInterval` — auto-disconnects stale clients
  - Copilot hooks: `trackSellerMessage()`, `triggerOutcomeAnalysis()` (fire-and-forget, non-blocking)
- `lib/whatsapp-api.ts` - WhatsApp utility functions (`jidToPhone`, `phoneToJid`, `formatPhoneDisplay`)
- `lib/roleplay.ts` - Session CRUD operations
- `lib/config.ts` - Configuration management (personas, objections, etc.)
  - All functions use `getCompanyId()` for subdomain-based company detection
  - Functions: `addPersona()`, `addObjection()`, `setCompanyType()` all include `company_id`
- `lib/supabase.ts` - Supabase client initialization
- `lib/utils/getCompanyFromSubdomain.ts` - **Multi-tenant company detection**
  - `getCompanyIdFromSubdomain()` - Detects company from URL subdomain
  - `getCompanyId()` - Smart function that prioritizes subdomain over user's company
  - Used throughout the app for data isolation
- `lib/types/plans.ts` - Credit/plan system types and configuration constants

## Important Patterns

### Multi-Tenant Company Detection Pattern

**ALWAYS use `getCompanyId()` for data operations:**
```typescript
import { getCompanyId } from '@/lib/utils/getCompanyFromSubdomain'

// Get company from subdomain (prioritized) or user (fallback)
const companyId = await getCompanyId()

if (!companyId) {
  console.error('Company ID not found')
  return null
}

// Use companyId in queries
await supabase
  .from('personas')
  .insert({ ...data, company_id: companyId })
```

**How it works:**
1. Browser: Detects subdomain from `window.location.hostname`
2. Server: Extracts subdomain from request `headers.get('host')`
3. Queries `companies` table to get `company_id` by subdomain
4. Falls back to user's company if subdomain detection fails

**NEVER use `getCompanyIdFromUser()` in ConfigHub or multi-tenant contexts** - it will use the logged-in user's company instead of the subdomain company, causing data to be saved to the wrong company.

### Creating Employees
NEVER create auth users client-side. Always use the API route:

```typescript
const response = await fetch('/api/employees/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, password })
})
```

### Creating Companies (Admin Panel)
Companies are created via `/api/admin/companies/create` with service role:

```typescript
// POST /api/admin/companies/create
{
  companyName: string,
  subdomain: string,
  adminName: string,
  adminEmail: string,
  adminPassword: string,
  businessType: 'B2B' | 'B2C'
}
```

**What gets created:**
- Company record in `companies` table
- Admin user in Supabase Auth
- Employee record linked to admin user
- Company type (B2B/B2C) in `company_type` table

**What does NOT get created:**
- Personas (must be configured manually in ConfigHub)
- Objections (must be configured manually in ConfigHub)
- Company data (must be filled manually in ConfigHub)

**Manual steps after creation:**
1. Add subdomain to `/etc/hosts` (development) or DNS (production)
2. Configure company data in ConfigHub
3. Add personas and objections via ConfigHub

### Deleting Companies
Deletion via `/api/admin/companies/delete` handles CASCADE cleanup:

```typescript
// DELETE /api/admin/companies/delete?companyId={id}
```

**Automatic cleanup (CASCADE):**
- Deletes auth users first (via `supabaseAdmin.auth.admin.deleteUser()`)
- Deletes company record (triggers CASCADE)
- All related data auto-deleted: employees, personas, objections, company_data, documents, roleplay_sessions, chat_sessions, pdis, user_performance_summaries

**Manual cleanup required:**
- Remove subdomain from `/etc/hosts` (development)
- Remove DNS record (production)

### Custom UI Components Pattern

The app uses custom Toast and ConfirmModal components instead of browser alerts:

```typescript
// Import
import { useToast, ToastContainer } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'

// Usage
const { toasts, showToast, removeToast } = useToast()

// Show toast
showToast('success', 'Title', 'Optional message', 5000)
showToast('error', 'Error Title', 'Error details')
showToast('warning', 'Warning', 'Important notice', 10000)

// Confirm modal
<ConfirmModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onConfirm={handleAction}
  title="Confirm Action"
  message="Are you sure?"
  confirmText="Yes"
  cancelText="No"
  requireTyping="company-name"  // Optional: user must type this to confirm
  typedValue={inputValue}
  onTypedValueChange={setInputValue}
/>

// Toast container (required)
<ToastContainer toasts={toasts} onClose={removeToast} />
```

**Design:**
- Matches site gradient theme (purple/pink for general, green for success, red for errors, yellow for warnings)
- Animations: slide-in-right, scale-in, fade-out
- Auto-dismiss with configurable duration
- Stacked display (top-right corner)

### Chat IA Session Management Pattern

**Starting a new session:**
```typescript
const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
setSessionId(newSessionId)
```

**Sending messages:**
```typescript
const { data: { user } } = await supabase.auth.getUser()
const userId = user?.id

await fetch(N8N_CHAT_WEBHOOK, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'sendMessage',
    chatInput: userMessage,
    sessionId: sessionId,
    userId: userId  // CRITICAL: First message must include userId
  })
})
```

**Ending a session (with confirmation):**
```typescript
// Show modal first
setShowEndSessionModal(true)

// On confirmation, send to N8N
await fetch(SESSION_FINALIZATION_WEBHOOK, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: sessionId,
    userId: userId
  })
})
```

**Loading session history:**
```typescript
const { data } = await supabase
  .from('chat_sessions')
  .select('session_id, created_at, message')
  .eq('user_id', userId)  // CRITICAL: Filter by user_id
  .order('created_at', { ascending: false })

// Group by session_id
const sessionsMap = new Map<string, ChatSession>()
data?.forEach((row) => {
  if (!sessionsMap.has(row.session_id)) {
    sessionsMap.set(row.session_id, {
      session_id: row.session_id,
      created_at: row.created_at,
      message_count: 1,
      last_message: row.message?.data?.content || row.message?.content
    })
  } else {
    sessionsMap.get(row.session_id)!.message_count++
  }
})
```

### Roleplay Session Lifecycle
1. Start: Create thread → Create session in DB → Start recording
2. Turn: Record audio → Transcribe → Send to Assistant → Get response → Play TTS
3. End: Stop recording → Save final state → Call evaluate API → Update performance summary → Show modal

### Audio Recording Pattern (Manual Control)
- Uses `MediaRecorder` with **manual** start/stop (no automatic silence detection)
- User workflow:
  1. Click microphone button → Starts recording
  2. Speak freely (no time limit)
  3. Click "Finalizar Fala" button → Stops recording and sends for transcription
- Must track `isRecording`, `isPlayingAudio`, `isLoading` states
- Removed automatic silence detection to prevent bugs

### Audio Visualization Pattern
```typescript
// Setup audio visualizer when TTS plays
const setupAudioVisualizer = (audio: HTMLAudioElement) => {
  const audioContext = new AudioContext()
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 128 // Smaller = more responsive
  analyser.smoothingTimeConstant = 0.3 // Less smoothing = more reactive

  const source = audioContext.createMediaStreamSource(audio)
  source.connect(analyser)
  analyser.connect(audioContext.destination)

  // Analyze frequencies in real-time
  const updateVolume = () => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)

    // Focus on mid-high frequencies (human voice)
    const relevantFrequencies = dataArray.slice(5, 40)
    const average = relevantFrequencies.reduce((a, b) => a + b) / relevantFrequencies.length

    // Amplify for dramatic effect
    const normalizedVolume = Math.min((average / 80) * 2.5, 1.2)
    setAudioVolume(normalizedVolume)

    requestAnimationFrame(updateVolume)
  }
  updateVolume()
}
```

### Evaluation Data Structure

**Roleplay Session Evaluation:**
```typescript
{
  overall_score: number,
  performance_level: 'legendary'|'excellent'|'very_good'|'good'|'needs_improvement'|'poor',
  executive_summary: string,
  spin_evaluation: {
    S: { final_score: number, technical_feedback: string, indicators: {...}, missed_opportunities: string[] },
    P: { final_score: number, technical_feedback: string, indicators: {...}, missed_opportunities: string[] },
    I: { final_score: number, technical_feedback: string, indicators: {...}, missed_opportunities: string[] },
    N: { final_score: number, technical_feedback: string, indicators: {...}, missed_opportunities: string[] }
  },
  objections_analysis: [...],
  top_strengths: string[],
  critical_gaps: string[],
  priority_improvements: [{ area, current_gap, action_plan, priority }]
}
```

**Persona Quality Evaluation:**
```typescript
{
  qualidade_geral: 'alta'|'média'|'baixa',
  score_geral: number,  // 0-10
  nivel_qualidade_textual: 'excelente'|'bom'|'precisa_melhorias'|'insuficiente',
  score_detalhado: {
    cargo: number,
    tipo_empresa_faturamento: number,
    contexto: number,
    busca: number,
    dores: number
  },
  destaques_positivos: string[],
  spin_readiness: {
    situacao: 'pronto'|'precisa_ajuste'|'insuficiente',
    problema: 'pronto'|'precisa_ajuste'|'insuficiente',
    implicacao: 'pronto'|'precisa_ajuste'|'insuficiente',
    need_payoff: 'pronto'|'precisa_ajuste'|'insuficiente',
    score_spin_total: number
  },
  campos_excelentes: string[],        // Fields with score >= 9
  campos_que_precisam_ajuste: string[], // Fields with score < 7
  sugestoes_melhora_prioritarias: string[],
  pronto_para_roleplay: boolean,
  nivel_complexidade_roleplay: 'básico'|'intermediário'|'avançado',
  proxima_acao_recomendada: string,
  mensagem_motivacional: string
}
```

**CRITICAL: Handling Zero Scores**
When processing SPIN scores, **ALWAYS use `!== undefined`** instead of truthy checks to include zero scores:

```typescript
// WRONG - Ignores zero scores
if (spin.S?.final_score) { ... }

// CORRECT - Includes zero scores
if (spin.S?.final_score !== undefined) { ... }
```

This applies to:
- `PerfilView.tsx` - Overall average and SPIN averages calculation
- `api/performance-summary/update/route.ts` - Summary calculation
- All evaluation processing that computes averages or totals

### Safe Evaluation Rendering
Always check for nested properties before accessing:

```typescript
evaluation?.spin_evaluation?.S?.final_score?.toFixed(1) ?? 'N/A'
```

Or use a processing function like `getProcessedEvaluation()` in HistoricoView.

### Chat Message Parsing (Multiple Formats)
Chat messages can come in different formats from N8N or database:

```typescript
let content = ''
let role: 'user' | 'assistant' = 'assistant'

if (msg?.data?.content) {
  content = msg.data.content
  role = msg.type === 'human' ? 'user' : 'assistant'
} else if (msg?.content) {
  content = msg.content
  role = msg.type === 'human' ? 'user' : 'assistant'
} else if (typeof msg === 'string') {
  content = msg
}
```

### PDI Generation Pattern

**Fetching performance data:**
```typescript
const { data: performanceSummary } = await supabase
  .from('user_performance_summaries')
  .select('*')
  .eq('user_id', user.id)
  .single()

// Extract SPIN averages from separate columns (not object)
const spinS = parseFloat(performanceSummary.spin_s_average)
const spinP = parseFloat(performanceSummary.spin_p_average)
const spinI = parseFloat(performanceSummary.spin_i_average)
const spinN = parseFloat(performanceSummary.spin_n_average)

// Format as single text string for N8N
const resumoTexto = `
RESUMO DE PERFORMANCE - ${userName}

DADOS GERAIS:
- Nome: ${userName}
- Total de Sessões: ${performanceSummary.total_sessions}
- Nota Média Geral: ${performanceSummary.overall_average?.toFixed(1)}

MÉDIAS SPIN:
- Situação (S): ${spinS.toFixed(1)}
- Problema (P): ${spinP.toFixed(1)}
- Implicação (I): ${spinI.toFixed(1)}
- Necessidade (N): ${spinN.toFixed(1)}

PONTOS FORTES RECORRENTES:
${strengthsList.map(s => `- ${s}`).join('\n')}

GAPS CRÍTICOS RECORRENTES:
${gapsList.map(g => `- ${g}`).join('\n')}
`
```

**Cooldown calculation:**
```typescript
// Load last PDI date
const { data: pdiRecord } = await supabase
  .from('pdis')
  .select('created_at')
  .eq('user_id', user.id)
  .eq('status', 'ativo')
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

// Calculate days remaining
const createdAt = new Date(pdiRecord.created_at)
const now = new Date()
const diffInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
const cooldownRemaining = Math.max(0, 7 - diffInDays)

// Block generation if cooldown active
if (cooldownRemaining > 0) {
  alert(`Você só pode gerar um novo PDI após ${cooldownRemaining} dia(s)`)
  return
}

// Delete old PDI before creating new
await supabase
  .from('pdis')
  .delete()
  .eq('user_id', user.id)
  .eq('status', 'ativo')
```

### Company Data Embeddings Pattern

**Two-table architecture for semantic search:**

1. **`company_data` table** (source of truth):
   - Single record with 9 fields describing the company
   - Uses UPDATE (not INSERT) when `companyDataId` exists
   - Triggers embedding generation on save

2. **`documents` table** (vector embeddings):
   - 8 chunks per company (one per category)
   - Columns: `company_data_id`, `category`, `question`, `content`, `embedding`, `metadata`
   - 100% cleared and regenerated on company_data update
   - Uses `ON DELETE CASCADE` FK

**Save flow:**
```typescript
// 1. Check if company_data exists
if (companyDataId) {
  // UPDATE existing record
  await supabase.from('company_data').update(data).eq('id', companyDataId)
} else {
  // INSERT new record
  const { data } = await supabase.from('company_data').insert(data)
  setCompanyDataId(data.id) // Track for future updates
}

// 2. Generate embeddings (async, non-blocking)
fetch('/api/company/generate-embeddings', {
  method: 'POST',
  body: JSON.stringify({ companyDataId })
})
```

**Embedding generation (in API):**
```typescript
// 1. Delete old embeddings
await supabase.from('documents').delete().eq('company_data_id', companyDataId)

// 2. Create 8 chunks (categories: identidade, produtos, diferenciais, etc.)
// 3. Generate embedding for each chunk (OpenAI ada-002)
// 4. Insert with metadata for N8N compatibility
await supabase.from('documents').insert({
  company_data_id: companyDataId,
  category: chunk.category,
  question: chunk.question,
  content: chunk.content,
  embedding: embedding,
  metadata: { category, question, company_data_id } // N8N needs this
})
```

**Semantic search:**
```typescript
const { data } = await supabase.rpc('match_company_knowledge', {
  query_embedding: await generateEmbedding(question),
  match_threshold: 0.7,
  match_count: 5
})
// Returns most similar chunks with similarity scores
```

### Persona Evaluation UI Pattern

**Side Panel Layout:**
The persona evaluation results display in a side panel (500px width) that slides in from the right while the ConfigHub shifts left by 250px, creating a side-by-side layout:

```typescript
// ConfigHub container shifts left when evaluation is shown
<div className={`relative max-w-5xl w-full transition-transform duration-300 ${
  showPersonaEvaluationModal ? 'sm:-translate-x-[250px]' : ''
}`}>

// Evaluation panel positioned fixed at right edge
<div className="fixed top-0 right-0 h-screen w-full sm:w-[500px] z-[70] p-4">
  <div className="animate-slide-in">
    {/* Evaluation content */}
  </div>
</div>
```

**Key UI Elements:**
- Red warning banner at top of Personas tab (personas < 7.0 compromise quality)
- Green "AVALIAR PERSONA" button on each persona card
- Loading state with spinner during evaluation
- Side panel with: Score Geral, Scores por Campo, Destaques Positivos, Prontidão SPIN, Campos Excelentes/Para Ajustar, Sugestões, Status, Próxima Ação
- Compact design with small fonts (10px-14px) to fit all content without scroll issues
- Color-coded sections: green (positive), orange (needs work), blue (suggestions), purple (SPIN)

### WhatsApp Client Lifecycle Pattern

**Key files:** `lib/whatsapp-client.ts` (server singleton), `components/FollowUpView.tsx` (UI), `app/api/whatsapp/connect/route.ts`

**Connection flow:**
1. User clicks "Conectar" → POST `/api/whatsapp/connect` → `initializeClient()` creates Puppeteer client
2. Client emits `qr` → QR code shown in UI (polling every 2s via GET `/api/whatsapp/connect`)
3. User scans QR → `authenticated` event → status becomes `connecting`
4. WhatsApp loads chats → `ready` event → status becomes `connected` (timeout: 180s)
5. Sync: lightweight `Store.Chat.getModelsArray()` eval → process 40 chats → save to DB
6. Real-time: `message` and `message_create` events → `handleIncomingMessage()` → save to DB + Supabase Storage

**Heartbeat & TTL:**
- Frontend sends heartbeat every 20s to `/api/whatsapp/heartbeat`
- TTL reaper checks every 30s, threshold 180s
- Soft reap (`reapClient`): destroys Puppeteer but preserves LocalAuth session (no QR needed on retry)
- Hard disconnect (`disconnectClient`): calls `client.logout()` + `client.destroy()` (requires new QR)

**Phone number normalization (critical for matching):**
- LID contacts: `lid_` prefix + LID number (WhatsApp's internal ID format)
- Groups: use `@g.us` serialized ID as-is (no normalization)
- Regular contacts: strip country code (55), take last 9 digits for suffix matching
- The `normalizePhone()` function exists in both `conversations/route.ts` and `messages/route.ts`

**Connection record management:**
- On disconnect: UPDATE `whatsapp_connections.status = 'disconnected'` (NOT DELETE — preserves FK integrity)
- On connect: upsert connection record, reuse existing if present
- `ensureValidConnectionId()`: validates connection_id before every DB insert (prevents FK violations)

**Group support:**
- Groups identified by `@g.us` suffix in chat ID
- Group messages: `contactPhone` = group serialized ID, sender resolved per-message
- Notification types filtered: `gp2`, `call_log`, `protocol`, `ciphertext`, `revoked`, `groups_v4_invite`
- LID sender name sanitization: regex `/^\d+(@|$)/` prevents raw IDs as display names

**Voice message conversion (ffmpeg):**
- Browser records WebM/Opus → two-stage ffmpeg conversion:
  1. WebM → WAV (clean metadata, strip browser artifacts)
  2. WAV → OGG/Opus (16kHz, mono, 32kbps, libopus)
- WhatsApp mobile requires real OGG/Opus container (48kHz works on Web but fails on mobile)
- `sendAudioAsVoice: true` sets PTT flag but does NOT convert format

### Credit / Plan System

**Plans** (defined in `lib/types/plans.ts`):
| Plan | Sellers | Monthly Credits | Price |
|------|---------|----------------|-------|
| Individual | 1 | 20 | R$129 |
| Team | 20 | 400 | R$1.999 |
| Business | 50 | 1000 | R$4.999 |
| Enterprise | Unlimited | Unlimited | Custom |

**Credit costs:** Copilot chat = 1, Follow-up analysis = 1

**Columns on `companies` table:** `training_plan`, `monthly_credits_used`, `extra_monthly_credits`, `monthly_credits_reset_at`

**Pattern:** API routes check credits BEFORE processing. Monthly reset detected by comparing `monthly_credits_reset_at` month/year to current date.

### Copilot Auto-Learning Pattern

**Two learning sources (both feed into RAG):**

1. **Automatic (all conversations):** In `handleIncomingMessage()` of `whatsapp-client.ts`:
   - Outbound message → `trackSellerMessage()` → saves to `seller_message_tracking` (outcome=null)
   - Inbound response → `triggerOutcomeAnalysis()` → POST `/api/copilot/analyze-outcome` → GPT-4o-mini classifies success/failure/partial → generates embedding → saves to `followup_examples_success` or `failure`
   - No response after 24h → `/api/copilot/check-no-response` → marks as failure

2. **Manual feedback:** User clicks 👍/👎 on Copilot suggestion → POST `/api/copilot/feedback` → saves directly to success/failure examples with embedding

**Result:** `match_followup_examples()` returns increasingly accurate results as examples accumulate.

## Common Issues

1. **Evaluation shows N/A or scores are undefined**:
   - Check if N8N returned `{output: "..."}` or `[{output: "..."}]` format
   - Ensure backend parses BEFORE saving to database
   - Verify `evaluation` column exists in `roleplay_sessions` table
   - Check console logs for parsing errors

2. **Performance metrics not counting sessions with score 0**:
   - Verify all score checks use `!== undefined` instead of truthy checks
   - Check both `PerfilView.tsx` and `api/performance-summary/update/route.ts`
   - Zero scores should be included in averages (poor performance is still performance)

3. **Chat sessions not appearing in history**:
   - Verify `user_id` is being sent with first message
   - Check RLS policies on `chat_sessions` table
   - Ensure `trigger_auto_fill_user_id` trigger exists and is active
   - Verify history query filters by `user_id`

4. **Chat messages showing database IDs instead of content**:
   - N8N "Respond to Webhook" must return AI Agent output, not Postgres data
   - Check response parsing logic for `ignoredKeys` array
   - Verify N8N workflow returns `[{ output: "message text" }]`

5. **Session finalization webhook not firing**:
   - Verify user clicked OK on confirmation modal
   - Check `confirmEndSession()` function has correct webhook URL
   - Ensure `sessionId` and `userId` are not null

6. **Audio recording doesn't stop**:
   - Check silence detection thresholds (volume > 35 for speech, < 20 for silence)
   - Verify MediaRecorder state before stopping
   - Ensure stream tracks are properly closed

7. **TTS not playing**:
   - Verify N8N TTS webhook is active
   - Check audio blob format (should be MP3)
   - Ensure `audioRef` is properly managed

8. **Session not saving**:
   - Verify user is authenticated (`supabase.auth.getUser()`)
   - Check RLS policies on `roleplay_sessions`
   - Ensure `sessionId` is passed correctly to `addMessageToSession()`

9. **Employee creation fails**:
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
   - Check that service role key bypasses RLS

10. **PDI generation fails**:
   - Verify user has completed roleplay sessions (needs `user_performance_summaries` entry)
   - Check N8N webhook is active: `https://ezboard.app.n8n.cloud/webhook/pdi/generate`
   - Ensure response parsing handles both `{output: "..."}` and `[{output: "..."}]` formats
   - Verify cooldown calculation (days since last PDI creation)

11. **PDI cooldown not working**:
   - Check `created_at` timestamp in `pdis` table
   - Verify cooldown calculation: `Math.floor((now - created) / (1000 * 60 * 60 * 24))`
   - Ensure old PDI is deleted before creating new one
   - Cooldown should be 7 days (not hours or seconds)

12. **SPIN radar chart labels cut off**:
   - Ensure SVG viewBox is `220x220` (not `200x200`)
   - Center should be at `(110, 110)` not `(100, 100)`
   - Label distance should be `radius + 25` (not `radius + 20`)
   - Applies to both `renderRadarChart()` and `renderEmptyRadarChart()`

13. **Multi-tenant data isolation failures**:
   - Verify all data creation functions use `getCompanyId()` not `getCompanyIdFromUser()`
   - Check that ConfigHub uses subdomain-based detection (`lib/utils/getCompanyFromSubdomain`)
   - Ensure RLS policies exist for all tables with `company_id`
   - Execute SQL to enable RLS: `ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY`
   - For roleplay_sessions, create RLS policy filtering by `user_id`:
     ```sql
     CREATE POLICY "Users can only see their own roleplay sessions"
     ON roleplay_sessions FOR SELECT TO authenticated
     USING (auth.uid() = user_id);
     ```

14. **Admin panel 404 error**:
   - Ensure `/app/admin/layout.tsx` exists (required for admin routes)
   - Verify middleware excludes `/admin` routes from redirect logic
   - Check Next.js cache: `rm -rf .next && npm run dev`

15. **Middleware "Cannot find the middleware module" error**:
   - Clear Next.js cache: `rm -rf .next`
   - Restart dev server
   - Verify `middleware.ts` has no syntax errors

16. **Subdomain still accessible after deleting company**:
   - Company deleted from database but subdomain configuration persists
   - Development: Manually remove from `/etc/hosts`
   - Production: Manually remove DNS record
   - SSL certificate renewal will fail for deleted subdomains (expected)

17. **WhatsApp "Conexao perdida" after QR scan**:
   - Ready timeout (180s) may fire before WhatsApp finishes loading chats
   - VPS memory pressure causes slow Puppeteer execution
   - Session cache is preserved on timeout (retry uses cached session, no new QR needed)
   - Init cooldown (15s) is cleared after timeout — user can retry immediately
   - Check PM2 logs: `pm2 logs assiny --lines 200`

18. **WhatsApp FK violation errors (`whatsapp_messages_connection_id_fkey`)**:
   - Caused by messages referencing a deleted connection record
   - Fix: `disconnectClient` uses UPDATE (not DELETE) on `whatsapp_connections`
   - `ensureValidConnectionId()` validates connection before every insert

19. **WhatsApp voice messages play on Web but not on mobile**:
   - Mobile requires OGG/Opus container at 16kHz, mono, 32kbps
   - 48kHz/128kbps plays on Web but shows "unavailable" on mobile
   - Must use two-stage ffmpeg conversion: WebM → WAV → OGG/Opus
   - ffmpeg must be installed on VPS (`apt install ffmpeg`)

20. **WhatsApp group notification messages appearing in chat**:
   - Types `gp2`, `call_log`, `protocol`, `ciphertext`, `revoked`, `groups_v4_invite` must be filtered
   - Filtered in `extractMessageContent()` in `lib/whatsapp-client.ts`
   - Also filtered in frontend: FollowUpView message display filter

21. **WhatsApp Puppeteer "Execution context destroyed" errors**:
   - Browser context crashes silently without firing `disconnected` event
   - Periodic health check (`checkBrowserHealth`) detects broken contexts via `page.evaluate(() => 1)`
   - On failure, soft-reaps client (preserves session for reconnection)

## Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vvqtgclprllryctavqal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # For server-side operations
OPENAI_API_KEY=sk-...             # For Assistant API

# Google Meet Analysis (Recall.ai + Deepgram)
RECALL_API_KEY=...                # Recall.ai API key
RECALL_API_REGION=us-west-2       # Recall.ai region (us-west-2 for pay-as-you-go)
# NOTE: Deepgram API key must be added in Recall.ai Dashboard, not here
# Go to: https://app.recall.ai/dashboard → Integrations → Deepgram → Add API Key
```

## SQL Schema Setup Order

1. `criar-tabelas-config.sql` - Config tables (segments, objections, company_type)
2. `criar-tabela-employees.sql` - Employees table
3. `criar-tabela-personas.sql` - Personas (B2B/B2C)
4. `adicionar-quebras-objecoes.sql` - Add rebuttals JSONB column to objections
5. `adicionar-score-objecoes.sql` - Add evaluation_score to objections
6. `criar-tabela-roleplay-sessions.sql` - Sessions table
7. `adicionar-coluna-evaluation.sql` - Add evaluation JSONB column
8. `criar-tabela-resumos-performance.sql` - Performance summaries table
9. `adicionar-unique-constraint.sql` - Add UNIQUE constraint on user_id (required for upsert)
10. `criar-tabela-knowledge-base.sql` - Knowledge base for SPIN/psychology content
11. `criar-tabela-chat-sessions.sql` or `limpar-e-recriar-chat-sessions.sql` - Chat sessions (LangChain format)
12. `adicionar-user-id-chat-sessions.sql` - Add user_id column with RLS policies
13. `trigger-auto-user-id.sql` - Auto-populate user_id for messages in same session
14. `criar-tabela-pdis.sql` - PDI (Plano de Desenvolvimento Individual) table
15. `criar-tabela-company-data.sql` - Company information table
16. `criar-tabela-company-embeddings.sql` - Documents table with pgvector (IMPORTANT: Run this BEFORE renaming)
17. `renomear-para-documents.sql` - Rename company_knowledge_embeddings → documents (N8N compatibility)
18. `adicionar-metadata-documents.sql` - Add metadata JSONB column to documents
19. `atualizar-funcao-match.sql` - Update match_company_knowledge function for documents table
20. `limpar-duplicatas-company-data.sql` - Remove duplicate company_data records (cleanup)
21. `criar-usuario-admin.sql` - Create admin user for testing
22. `popular-resumos-existentes.sql` - Populate summaries for existing sessions

## Deployment

### Production Server (Hostinger VPS)

**Server Details:**
- Host: `31.97.84.130`
- Domain: `https://ramppy.site`
- OS: Ubuntu
- Node.js: v20.19.5 (via NVM)
- Process Manager: PM2
- Web Server: Nginx (reverse proxy)
- SSL: Let's Encrypt (auto-renewal via Certbot)

**Automatic Deployment:**
GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically deploys to production on every push to `main`:
1. Connects to VPS via SSH
2. Pulls latest code from GitHub
3. Installs dependencies
4. Builds production bundle
5. Restarts PM2 process

**Manual Deployment:**
```bash
ssh root@31.97.84.130
cd /var/www/assiny
git pull origin main
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm install
npm run build
pm2 restart assiny
```

**Server Management:**
```bash
# View application status
pm2 status

# View logs
pm2 logs assiny

# Restart application
pm2 restart assiny

# Edit environment variables
nano /var/www/assiny/.env.local
pm2 restart assiny  # Must restart after env changes

# Check Nginx configuration
nginx -t

# SSL Certificate Management
sudo certbot certificates                    # List all certificates
sudo certbot renew                           # Renew certificates manually
sudo certbot renew --dry-run                 # Test renewal process
sudo certbot --nginx -d subdomain.ramppy.site  # Add SSL for new subdomain
sudo systemctl status certbot.timer          # Check auto-renewal timer

# Restart Nginx
systemctl restart nginx

# Renew SSL certificate (auto-renews, but manual trigger if needed)
certbot renew
```

**Important Files on Server:**
- Application: `/var/www/assiny/`
- Environment: `/var/www/assiny/.env.local`
- Nginx config: `/etc/nginx/sites-available/assiny`
- SSL certs: `/etc/letsencrypt/live/ramppy.site/`
- PM2 config: `~/.pm2/`
- SSH deploy key: `~/.ssh/github_deploy`

### Deployment Checklist

- N8N webhooks are in production mode
- ConfigHub password should be changed from `admin123`
- Remove quick login button from LoginPage in production
- Ensure all N8N workflows are active and properly configured
- Verify OpenAI API key has sufficient quota for Assistants + Whisper
- **Chat IA**: Ensure N8N Postgres INSERT node is configured with `userId` mapping
- **Chat IA**: Verify database trigger is active for auto-populating `user_id`
- **Session Finalization**: Ensure N8N workflow for session finalization webhook is deployed
- **PDI**: Ensure N8N PDI generation workflow is deployed and returns proper JSON format
- **PDI**: Verify `pdis` table has RLS policies configured for user access
- **VPS**: Verify GitHub Actions secrets are configured (SSH_PRIVATE_KEY, SSH_HOST, SSH_USER)
- **VPS**: Ensure PM2 is running and configured to start on boot (`pm2 startup` + `pm2 save`)
- **VPS**: Verify Nginx reverse proxy is configured for both HTTP and HTTPS
- **VPS**: Confirm SSL certificate auto-renewal is enabled via Certbot
- **SSL**: Configure SSL for all subdomains (see `docs/QUICK-SSL-SETUP.md`)
- **DNS**: Ensure all subdomains point to VPS IP (31.97.84.130)
- **Admin**: Change default admin password from `admin123` in production
