# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Assiny is an internal sales training platform with AI-powered roleplay, conversational AI assistant (Chat IA), administrative management hub, and employee tracking. The system integrates with N8N workflows for audio transcription, text-to-speech, automated performance evaluation, and persistent chat memory using LangChain + PostgreSQL.

## Tech Stack

- **Next.js 14** with App Router and TypeScript
- **Supabase** for authentication, PostgreSQL database, and storage
- **N8N** for workflow automation (TTS, transcription, evaluation, chat memory)
- **OpenAI** Assistants API for roleplay chat, Whisper for transcription, Embeddings for documents
- **LangChain** Postgres Chat Memory for conversation persistence
- **Tailwind CSS** for styling
- **pgvector** extension for semantic document search

## Development Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Production
npm run build        # Build for production
npm run start        # Run production build

# Code quality
npm run lint         # Run ESLint
```

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
5. **History & Profile**: Users review past sessions with transcripts, metrics, and consolidated analytics

### Database Schema

**Key Tables:**
- `users` - User profiles with roles (admin/vendedor)
- `employees` - Employee records (synced with auth.users)
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
- `personas` - B2B/B2C customer personas (linked to business_type)
- `objections` - Sales objections library
- `knowledge_base` - SPIN/psychology content (category, title, content)
- `customer_segments` - (Legacy, replaced by personas)
- `company_type` - Business type configuration (B2B or B2C)
- `documents` - Vector embeddings for AI knowledge base (pgvector)

**Important Notes:**
- All config tables have Row Level Security (RLS) enabled
- `roleplay_sessions` has RLS - users only see their own sessions
- `user_performance_summaries` has RLS - users see only their own, service role has full access
- `chat_sessions` has RLS by `user_id` - critical for multi-user isolation
- First message in each chat session MUST include `user_id` from frontend
- `evaluation` column added via `adicionar-coluna-evaluation.sql`

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

**Other:**
- `/api/upload-file` - Upload files to N8N for embedding
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
```

**Important:** Backend must parse BEFORE saving to database. Frontend parsing is a fallback for legacy data.

### Key Components

**Main Views:**
- `Dashboard.tsx` - Main application shell with header navigation
  - Uses `useRef<ChatInterfaceHandle>` to intercept Chat IA navigation
  - `handleViewChange()` calls `chatRef.current.requestLeave()` when leaving Chat IA
  - Prevents data loss by showing confirmation modal before navigation

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
  - Manages recording, transcription, TTS playback
  - Creates/updates roleplay sessions
  - Triggers evaluation on session end
  - Shows evaluation modal with scores
  - Auto-updates performance summary after successful evaluation
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
  - Manages employees, personas, objections, business type
  - File upload for document embeddings

**Libraries:**
- `lib/roleplay.ts` - Session CRUD operations
- `lib/config.ts` - Configuration management (personas, objections, etc.)
- `lib/supabase.ts` - Supabase client initialization

## Important Patterns

### Creating Employees
NEVER create auth users client-side. Always use the API route:

```typescript
const response = await fetch('/api/employees/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, password })
})
```

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

### Audio Recording Pattern
- Uses `MediaRecorder` with silence detection
- Auto-stops after 1s of silence (30 frames of low volume)
- Must track `isRecording`, `isPlayingAudio`, `isLoading` states
- User must manually click microphone button (no auto-recording after TTS)

### Evaluation Data Structure
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

## Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vvqtgclprllryctavqal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # For server-side operations
OPENAI_API_KEY=sk-...             # For Assistant API
```

## SQL Schema Setup Order

1. `criar-tabelas-config.sql` - Config tables (segments, objections, company_type)
2. `criar-tabela-employees.sql` - Employees table
3. `criar-tabela-personas.sql` - Personas (B2B/B2C)
4. `criar-tabela-roleplay-sessions.sql` - Sessions table
5. `adicionar-coluna-evaluation.sql` - Add evaluation JSONB column
6. `criar-tabela-resumos-performance.sql` - Performance summaries table
7. `adicionar-unique-constraint.sql` - Add UNIQUE constraint on user_id (required for upsert)
8. `criar-tabela-knowledge-base.sql` - Knowledge base for SPIN/psychology content
9. `criar-tabela-chat-sessions.sql` or `limpar-e-recriar-chat-sessions.sql` - Chat sessions (LangChain format)
10. `adicionar-user-id-chat-sessions.sql` - Add user_id column with RLS policies
11. `trigger-auto-user-id.sql` - Auto-populate user_id for messages in same session
12. `criar-tabela-embeddings.sql` - Documents with vector extension (optional)
13. `criar-usuario-admin.sql` - Create admin user for testing
14. `popular-resumos-existentes.sql` - Populate summaries for existing sessions

## Deployment Considerations

- N8N webhooks are in production mode
- ConfigHub password should be changed from `admin123`
- Remove quick login button from LoginPage in production
- Ensure all N8N workflows are active and properly configured
- Verify OpenAI API key has sufficient quota for Assistants + Whisper
- **Chat IA**: Ensure N8N Postgres INSERT node is configured with `userId` mapping
- **Chat IA**: Verify database trigger is active for auto-populating `user_id`
- **Session Finalization**: Ensure N8N workflow for session finalization webhook is deployed
