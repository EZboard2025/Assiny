# Suporte Multi-Tenant para Company Data

## O que mudou?

Adicionamos suporte multi-tenant à tabela `company_data`, permitindo que múltiplas empresas usem o sistema sem conflito de dados.

## Arquivos modificados

### 1. Migration: `supabase/migrations/16-adicionar-company-id-company-data.sql`
- Adiciona coluna `company_id` à tabela `company_data`
- Atualiza RLS policies para filtrar por `company_id`
- Cria índice para performance
- Service role mantém acesso total

### 2. API: `app/api/roleplay/chat/route.ts`
- Agora busca `company_data` filtrado por `company_id`
- Usa service role key para bypassar RLS
- Envia dados da empresa correta no webhook do N8N

### 3. Frontend: `components/ConfigHub.tsx`
- Carrega dados da empresa usando `getCompanyIdFromUser()`
- Filtra `company_data` por `company_id` do usuário logado
- Salva novos registros com `company_id` automaticamente

## Como funciona?

1. **Carregar dados**: Sistema busca `company_data` onde `company_id` = company_id do usuário logado
2. **Salvar dados**: Sistema salva/atualiza apenas dados da empresa do usuário
3. **Roleplay**: N8N recebe dados da empresa correta baseado no `company_id` do vendedor

## Migração de dados existentes

Se você já tem dados de `company_data` sem `company_id`, precisa atualizar manualmente:

```sql
-- Ver company_id disponível
SELECT id, company_id FROM employees LIMIT 1;

-- Atualizar company_data existente
UPDATE company_data
SET company_id = 'SEU_COMPANY_ID_AQUI'
WHERE company_id IS NULL;
```

## Benefícios

✅ Cada empresa tem seus próprios dados isolados
✅ Múltiplas empresas podem usar o mesmo sistema
✅ RLS garante segurança (usuários não veem dados de outras empresas)
✅ Service role ainda tem acesso total (para N8N agents)
