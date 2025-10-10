# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Assiny is an internal sales training platform with AI-powered chat, administrative management hub, and employee tracking. The system integrates with N8N workflows for file processing and document embeddings stored in Supabase Vector Store.

## Tech Stack

- **Next.js 14** with App Router and TypeScript
- **Supabase** for authentication, PostgreSQL database, and vector embeddings
- **N8N** for workflow automation (file extraction and processing)
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

## Architecture

### Frontend Flow
1. User uploads file via ConfigHub component
2. File sent to N8N webhook for text extraction
3. N8N extracts text and creates OpenAI embedding
4. Embedding stored in Supabase `documents` table with vector search capability

### Authentication Flow
- Supabase Auth for user authentication
- User profile stored in `users` table with role-based access (admin/vendedor)
- Employee creation requires API route with service role key (not client-side)

### Database Schema

**Key Tables:**
- `users` - User profiles with roles
- `employees` - Employee records (synced with auth.users)
- `customer_segments` - Customer segmentation data
- `objections` - Sales objections library
- `documents` - Vector embeddings for AI knowledge base
  - Uses `pgvector` extension
  - Has `match_documents()` function for similarity search

**Important:** All config tables (`customer_segments`, `company_type`, `objections`) have Row Level Security (RLS) enabled.

### API Routes

- `/api/employees/create` - Creates employee with Supabase Auth user + employees table record
  - Requires service role key (server-side only)
  - Takes `{ name, email, password }`

### N8N Integration

**Webhook URL:** `https://ezboard.app.n8n.cloud/webhook/43795ad1-2faa-473d-925c-dab2c3227dbb`

**Expected N8N Flow:**
1. Webhook receives file
2. Extract text from file (PDF, audio, video, etc.)
3. Call OpenAI embeddings API
4. Insert to Supabase `documents` table with vector embedding

**Alternative approach (if needed):**
- N8N can return extracted text to frontend
- Frontend calls Supabase Edge Function to create embedding
- Edge Function: `supabase/functions/create-embedding/index.ts`

### Vector Search Setup

Must execute in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- documents table with vector column
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  file_name TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Similarity search function
CREATE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (...);
```

## Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vvqtgclprllryctavqal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # For server-side employee creation
```

## Key Components

- `ConfigHub.tsx` - Admin configuration hub with file upload
  - Protected by password (`admin123`)
  - Manages employees, segments, objections, file uploads

- `LoginPage.tsx` - Authentication interface
  - Quick login button for development (remove in production)

- `lib/config.ts` - Configuration management functions
  - CRUD operations for segments, objections, company type
  - Employee management (uses API route, not direct Supabase)

## Important Patterns

### Creating Employees
Always use the API route `/api/employees/create`, never create auth users client-side:

```typescript
const response = await fetch('/api/employees/create', {
  method: 'POST',
  body: JSON.stringify({ name, email, password })
})
```

### File Upload to N8N
```typescript
const formData = new FormData()
formData.append('file', file)
formData.append('fileName', file.name)

await fetch('https://ezboard.app.n8n.cloud/webhook/...', {
  method: 'POST',
  body: formData
})
```

### Vector Search (for AI agents in N8N)
Use Supabase Vector Store node in "Retrieve Documents (As Tool for AI Agent)" mode to enable semantic search over uploaded documents.

## Common Issues

1. **Employee creation fails**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in environment variables
2. **Vector search fails**: Verify `match_documents()` function exists in Supabase
3. **N8N webhook errors**: Check that file_name is properly mapped through the workflow
4. **RLS errors**: Service role key bypasses RLS; anon key respects it

## SQL Files Reference

- `criar-tabelas-config.sql` - Config tables (segments, objections, company_type)
- `criar-tabela-employees.sql` - Employees table structure
- `criar-tabela-embeddings.sql` - Documents table with vector extension
- `criar-usuario-admin.sql` - Create admin user for testing

## Deployment Considerations

- N8N webhook URL is in production mode (no `-test` suffix)
- ConfigHub password should be changed from `admin123` before production
- Quick login button in LoginPage should be removed in production
- Edge Function requires deployment via Supabase CLI or Dashboard
