# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Assiny is an internal sales training platform with AI-powered roleplay, administrative management hub, and employee tracking. The system integrates with N8N workflows for audio transcription, text-to-speech, and automated performance evaluation using OpenAI Assistants API.

## Tech Stack

- **Next.js 14** with App Router and TypeScript
- **Supabase** for authentication, PostgreSQL database, and storage
- **N8N** for workflow automation (TTS, transcription, evaluation)
- **OpenAI** Assistants API for roleplay chat and Whisper for transcription
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
3. **Evaluation**:
   - On session end, `/api/roleplay/evaluate` sends transcript + context to N8N
   - N8N agent analyzes using SPIN Selling methodology
   - Evaluation stored in `roleplay_sessions.evaluation` JSONB column
4. **History**: Users review past sessions with full transcripts and performance metrics

### Database Schema

**Key Tables:**
- `users` - User profiles with roles (admin/vendedor)
- `employees` - Employee records (synced with auth.users)
- `roleplay_sessions` - Roleplay sessions with messages, config, evaluation
  - `messages` - JSONB array: `[{ role: "client"|"seller", text: "...", timestamp: "..." }]`
  - `config` - JSONB: `{ age, temperament, segment, objections[] }`
  - `evaluation` - JSONB: Full SPIN evaluation from N8N agent
- `personas` - B2B/B2C customer personas (linked to business_type)
- `objections` - Sales objections library
- `customer_segments` - (Legacy, replaced by personas)
- `company_type` - Business type configuration (B2B or B2C)
- `documents` - Vector embeddings for AI knowledge base (pgvector)

**Important Notes:**
- All config tables have Row Level Security (RLS) enabled
- `roleplay_sessions` has RLS - users only see their own sessions
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

- **File Upload**: `https://ezboard.app.n8n.cloud/webhook/c91010a1-9003-4a8b-b9bd-30e689c7c4ac`

**N8N Response Parsing:**
N8N returns evaluations as: `[{ output: "json_string" }]`

You MUST parse this format in both backend AND frontend:
```typescript
// Backend (route.ts)
let evaluation
if (Array.isArray(rawResponse) && rawResponse[0]?.output) {
  evaluation = JSON.parse(rawResponse[0].output)
} else {
  evaluation = rawResponse
}

// Frontend (components)
if (evaluation && typeof evaluation === 'object' && 'output' in evaluation) {
  evaluation = JSON.parse(evaluation.output)
}
```

### Key Components

**Main Views:**
- `RoleplayView.tsx` - Voice-based roleplay training interface
  - Manages recording, transcription, TTS playback
  - Creates/updates roleplay sessions
  - Triggers evaluation on session end
  - Shows evaluation modal with scores

- `HistoricoView.tsx` - Session history with detailed analysis
  - Lists all user sessions
  - Shows full transcripts
  - Displays SPIN evaluation breakdown
  - Uses `getProcessedEvaluation()` to parse N8N format

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

### Roleplay Session Lifecycle
1. Start: Create thread → Create session in DB → Start recording
2. Turn: Record audio → Transcribe → Send to Assistant → Get response → Play TTS
3. End: Stop recording → Save final state → Call evaluate API → Show modal

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
    S: { final_score: number, technical_feedback: string, indicators: {...} },
    P: { ... },
    I: { ... },
    N: { ... }
  },
  objections_analysis: [...],
  top_strengths: string[],
  critical_gaps: string[],
  priority_improvements: [{ area, current_gap, action_plan, priority }]
}
```

### Safe Evaluation Rendering
Always check for nested properties before accessing:

```typescript
evaluation?.spin_evaluation?.S?.final_score?.toFixed(1) ?? 'N/A'
```

Or use a processing function like `getProcessedEvaluation()` in HistoricoView.

## Common Issues

1. **Evaluation shows N/A**:
   - Check if N8N returned `[{output: "..."}]` format
   - Ensure both backend and frontend parse the `output` string
   - Verify `evaluation` column exists in `roleplay_sessions` table

2. **Audio recording doesn't stop**:
   - Check silence detection thresholds (volume > 35 for speech, < 20 for silence)
   - Verify MediaRecorder state before stopping
   - Ensure stream tracks are properly closed

3. **TTS not playing**:
   - Verify N8N TTS webhook is active
   - Check audio blob format (should be MP3)
   - Ensure `audioRef` is properly managed

4. **Session not saving**:
   - Verify user is authenticated (`supabase.auth.getUser()`)
   - Check RLS policies on `roleplay_sessions`
   - Ensure `sessionId` is passed correctly to `addMessageToSession()`

5. **Employee creation fails**:
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
6. `criar-tabela-embeddings.sql` - Documents with vector extension (optional)
7. `criar-usuario-admin.sql` - Create admin user for testing

## Deployment Considerations

- N8N webhooks are in production mode
- ConfigHub password should be changed from `admin123`
- Remove quick login button from LoginPage in production
- Ensure all N8N workflows are active and properly configured
- Verify OpenAI API key has sufficient quota for Assistants + Whisper
