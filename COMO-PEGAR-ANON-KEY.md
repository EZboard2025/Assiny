# 🔑 Como Pegar a Anon Key do Supabase

## Passo a Passo

1. **Acesse o painel do Supabase:**
   - URL: https://vvqtgclprliryctavqal.supabase.co

2. **Vá em Settings (⚙️)**
   - No menu lateral esquerdo, clique no ícone de engrenagem

3. **Clique em API**
   - Você verá a seção "Project API keys"

4. **Copie a chave "anon public"**
   - Ela começa com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **NÃO** use a service_role key no frontend!

5. **Cole no arquivo `.env.local`:**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://vvqtgclprliryctavqal.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

## ⚠️ IMPORTANTE

- ✅ **USAR:** `anon` key (segura para frontend)
- ❌ **NÃO USAR:** `service_role` key (apenas backend)

## Diferenças

| Key | Onde usar | Permissões |
|-----|-----------|------------|
| `anon` | Frontend (React) | Limitada por RLS |
| `service_role` | Backend apenas | Admin completo |

## Depois de configurar

Execute:
```bash
npm run dev
```

E teste o login na aplicação!