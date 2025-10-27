# Migração do Roleplay: OpenAI Assistant → N8N

## Resumo da Mudança

O sistema de roleplay foi migrado de **OpenAI Assistant API** para **agente N8N com memória PostgreSQL**.

## Arquivos Modificados

### 1. **SQL Migration**
- `supabase/migrations/14-criar-roleplay-chat-memory.sql`
  - Nova tabela `roleplay_chat_memory`
  - Formato LangChain Postgres Chat Memory
  - Colunas: `id`, `session_id`, `message` (JSONB), `context` (JSONB), `user_id`, `created_at`
  - RLS policies para isolamento de usuários
  - Trigger para auto-preencher `user_id`

### 2. **API Route**
- `app/api/roleplay/chat/route.ts`
  - **Removido:** OpenAI SDK, `threadId`, Assistant API calls
  - **Adicionado:** N8N webhook integration, `sessionId`, `userId`
  - Webhook: `https://ezboard.app.n8n.cloud/webhook/695b2256-8555-4b65-a4dc-d942405d4ca9/chat`
  - Parse de resposta N8N: `[{output: "..."}]` ou `{output: "..."}`

### 3. **Frontend**
- `components/RoleplayView.tsx`
  - **Removido:** `threadId` state
  - **Adicionado:** `sessionIdN8N` state
  - Passa `userId` em todas as chamadas à API
  - SessionId gerado no backend (formato: `roleplay_${timestamp}_${random}`)

## Fluxo Atual

### Iniciar Roleplay
```typescript
// Frontend envia
{
  config: {
    age: number,
    temperament: string,
    persona: { business_type, ... },
    objections: [{ name, rebuttals }]
  },
  userId: string
}

// Backend gera sessionId e envia para N8N
{
  action: "sendMessage",
  chatInput: "contexto completo...",
  sessionId: "roleplay_1234567890_abc123",
  userId: "uuid"
}

// N8N retorna
[{ output: "Olá, sou o cliente..." }]
```

### Continuar Conversa
```typescript
// Frontend envia
{
  sessionId: "roleplay_1234567890_abc123",
  message: "Mensagem do vendedor",
  userId: "uuid"
}

// Backend envia para N8N
{
  action: "sendMessage",
  chatInput: "Mensagem do vendedor",
  sessionId: "roleplay_1234567890_abc123",
  userId: "uuid"
}

// N8N retorna
[{ output: "Resposta do cliente..." }]
```

## Configuração N8N Necessária

O workflow N8N deve:

1. **Receber dados do webhook**
   - `action`: "sendMessage"
   - `chatInput`: mensagem do usuário
   - `sessionId`: identificador da sessão
   - `userId`: identificador do usuário

2. **Buscar histórico do PostgreSQL**
   ```sql
   SELECT message FROM roleplay_chat_memory
   WHERE session_id = $sessionId
   AND user_id = $userId
   ORDER BY created_at ASC
   ```

3. **Processar com agente LLM**
   - Usar contexto da primeira mensagem
   - Considerar todo o histórico
   - Gerar resposta como "cliente"

4. **Salvar no PostgreSQL**
   ```sql
   INSERT INTO roleplay_chat_memory (session_id, message, user_id)
   VALUES ($sessionId, $message, $userId)
   ```

5. **Retornar resposta**
   ```json
   [{ "output": "Resposta do cliente..." }]
   ```

## Próximos Passos

1. ✅ Estrutura básica implementada
2. ⏳ **Testar integração com N8N genérico**
3. ⏳ Configurar workflow N8N específico para roleplay
4. ⏳ Ajustar prompts do agente para simular cliente perfeito
5. ⏳ Adicionar retrieval de `company_data` (embeddings)
6. ⏳ Melhorar personalidade do cliente baseado em contexto

## Rollback (se necessário)

Para voltar ao OpenAI Assistant:
1. Reverter `app/api/roleplay/chat/route.ts`
2. Reverter `components/RoleplayView.tsx`
3. Remover tabela `roleplay_chat_memory` (opcional)
