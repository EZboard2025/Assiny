# ⚡ Início Rápido - 3 Passos

## 📋 Checklist

### ✅ Passo 1: Configurar Supabase (5 min)

1. **Pegar a anon key:**
   - Acesse: https://vvqtgclprliryctavqal.supabase.co
   - Vá em Settings → API
   - Copie a chave **"anon public"**
   - Cole no arquivo `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://vvqtgclprliryctavqal.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
   ```

2. **Executar o schema SQL:**
   - No Supabase, vá em **SQL Editor**
   - Clique em **"+ New query"**
   - Abra o arquivo `supabase/schema.sql`
   - Copie **TODO** o conteúdo
   - Cole no editor e clique em **"Run"**
   - ✅ Verifique que as tabelas foram criadas em **Table Editor**

### ✅ Passo 2: Criar Usuário Admin (2 min)

**Opção A - Pelo Painel (Mais Fácil):**

1. No Supabase, vá em **Authentication** → **Users**
2. Clique em **"Add user"**
3. Email: `admin@assiny.com`
4. Senha: `senha123`
5. ✅ Marque **"Auto Confirm User"**
6. Clique em **"Create user"**

7. Vá em **Table Editor** → **users**
8. Clique em **"Insert row"**
9. Preencha:
   - email: `admin@assiny.com`
   - name: `Admin`
   - role: `admin`
10. Salve

**Opção B - Via SQL (Mais Rápido):**

```sql
-- Execute no SQL Editor
INSERT INTO public.users (email, name, role)
VALUES ('admin@assiny.com', 'Admin', 'admin')
ON CONFLICT (email) DO UPDATE
SET role = 'admin';
```

### ✅ Passo 3: Rodar o Projeto (1 min)

```bash
npm run dev
```

Acesse: http://localhost:3000

**Login:**
- Email: `admin@assiny.com`
- Senha: `senha123`

## 🎉 Pronto!

Agora você pode:

- ✅ Fazer login
- ✅ Usar o chat (histórico é salvo)
- ✅ Acessar Hub de Configuração (senha: `admin123`)
- ✅ Ver módulos de treinamento

## 🔧 Configuração Adicional (Opcional)

### Integrar com IA

Edite o arquivo `lib/mcp/agent.ts` e adicione sua API key preferida:

**OpenAI:**
```bash
# .env.local
OPENAI_API_KEY=sk-...
```

**Anthropic (Claude):**
```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

Veja `lib/mcp/README.md` para instruções detalhadas.

## 📚 Documentação

- `SETUP.md` - Guia completo de configuração
- `EXECUTAR-SCHEMA.md` - Como executar o schema SQL
- `CRIAR-USUARIO.md` - Como criar usuários
- `COMO-PEGAR-ANON-KEY.md` - Como pegar a anon key
- `supabase/README.md` - Documentação do banco
- `lib/mcp/README.md` - Documentação do MCP/IA

## 🐛 Problemas?

### Erro de conexão com Supabase
→ Verifique se a anon key está correta em `.env.local`

### "Invalid login credentials"
→ Verifique se criou o usuário no Authentication → Users

### "User not found"
→ Verifique se inseriu o usuário na tabela `users`

### Página não carrega
→ Verifique se executou o schema SQL completo

## 🚀 Estrutura Criada

```
✅ Frontend (Next.js + React)
   ├── Login/Logout
   ├── Dashboard
   ├── Chat com IA
   └── Hub de Configuração

✅ Backend (Supabase)
   ├── PostgreSQL Database
   ├── Authentication
   ├── Row Level Security
   └── Real-time (pronto para usar)

✅ MCP (Model Context Protocol)
   ├── Agente de IA
   ├── Análise de Performance
   ├── Recomendações
   └── Hooks React

✅ Segurança
   ├── RLS Policies
   ├── Role-based Access
   └── Encrypted Passwords
```

## 📧 Suporte

Consulte os arquivos de documentação para mais detalhes!