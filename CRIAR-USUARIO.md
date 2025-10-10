# 👤 Como Criar Usuário Admin

## Método 1: Via Interface da Aplicação (Recomendado)

### Passo 1: Habilitar Cadastro Temporariamente

Por padrão, a aplicação só tem login. Vamos habilitar o cadastro temporariamente.

1. Acesse: http://localhost:3000
2. Tente fazer login com qualquer email/senha
3. Vai aparecer um erro (esperado)

### Passo 2: Criar via Supabase Auth

1. Vá para o painel do Supabase: https://vvqtgclprliryctavqal.supabase.co
2. No menu lateral, clique em **Authentication**
3. Clique em **Users**
4. Clique no botão **"Add user"** ou **"Invite user"**
5. Preencha:
   - Email: `admin@assiny.com`
   - Password: `senha123`
   - Confirm Password: `senha123`
   - Auto Confirm User: ✅ **MARQUE ESTA OPÇÃO**
6. Clique em **"Create user"** ou **"Send invite"**

### Passo 3: Adicionar na Tabela Users

1. Vá em **Table Editor**
2. Selecione a tabela **users**
3. Clique em **"Insert"** → **"Insert row"**
4. Preencha:
   - `email`: admin@assiny.com
   - `name`: Admin
   - `role`: admin
5. Clique em **"Save"**

## Método 2: Via SQL Editor (Mais Rápido)

Execute este SQL no **SQL Editor** do Supabase:

```sql
-- 1. Verificar se o usuário já existe na auth
SELECT * FROM auth.users WHERE email = 'admin@assiny.com';

-- 2. Se não existir, criar manualmente
-- (ATENÇÃO: Ajuste o hash da senha conforme necessário)

-- 3. Inserir na tabela users (funciona independente)
INSERT INTO public.users (email, name, role)
VALUES ('admin@assiny.com', 'Admin', 'admin')
ON CONFLICT (email) DO UPDATE
SET role = 'admin', name = 'Admin';
```

## Método 3: Via Código (Script Node.js)

Execute no terminal:

```bash
node scripts/setup-database.js
```

Este script vai:
- ✅ Criar usuário admin@assiny.com
- ✅ Definir senha como senha123
- ✅ Configurar role como admin

## ✅ Verificar se Funcionou

### 1. Verificar no Supabase

No SQL Editor, execute:

```sql
SELECT * FROM auth.users WHERE email = 'admin@assiny.com';
SELECT * FROM public.users WHERE email = 'admin@assiny.com';
```

Você deve ver o usuário nas duas tabelas.

### 2. Testar Login

1. Acesse: http://localhost:3000
2. Faça login com:
   - Email: `admin@assiny.com`
   - Senha: `senha123`
3. Deve entrar no dashboard! 🎉

## 🚨 Problemas Comuns

### "Invalid login credentials"

**Causa:** Usuário não existe na `auth.users` ou senha incorreta.

**Solução:**
1. Vá em Authentication → Users no Supabase
2. Verifique se o usuário existe
3. Se não, crie pelo painel (Método 1)

### "User not found in users table"

**Causa:** Usuário existe na `auth.users` mas não na `public.users`.

**Solução:**
Execute no SQL Editor:

```sql
INSERT INTO public.users (email, name, role)
VALUES ('admin@assiny.com', 'Admin', 'admin')
ON CONFLICT (email) DO NOTHING;
```

### "Access denied" ou "Row level security"

**Causa:** RLS está bloqueando o acesso.

**Solução:**
Execute no SQL Editor:

```sql
-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Se necessário, desabilitar RLS temporariamente (APENAS DESENVOLVIMENTO)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
```

## 📝 Credenciais Padrão

Após configurar, use:

- **Email:** admin@assiny.com
- **Senha:** senha123
- **Role:** admin

## 🔐 Criar Mais Usuários

### Admin adicional:

```sql
-- Via auth (Supabase Auth UI)
-- Depois:
INSERT INTO public.users (email, name, role)
VALUES ('outro@assiny.com', 'Outro Admin', 'admin');
```

### Vendedor:

```sql
-- Via auth (Supabase Auth UI)
-- Depois:
INSERT INTO public.users (email, name, role)
VALUES ('vendedor@assiny.com', 'João Vendedor', 'vendedor');
```

## 🎯 Próximo Passo

Agora que tem um usuário admin, você pode:

1. ✅ Fazer login na plataforma
2. ✅ Acessar o Hub de Configuração (senha: admin123)
3. ✅ Testar o chat
4. ✅ Criar mais usuários pelo painel