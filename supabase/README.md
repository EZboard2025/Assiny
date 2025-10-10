# Configuração do Supabase

## 🚀 Passos para Configuração

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie uma nova organização (se ainda não tiver)
3. Crie um novo projeto
4. Escolha um nome, senha do banco e região

### 2. Executar o Schema SQL

1. No painel do Supabase, vá em **SQL Editor**
2. Clique em **New Query**
3. Copie todo o conteúdo do arquivo `schema.sql`
4. Cole no editor e execute (Run)

### 3. Configurar Autenticação

1. Vá em **Authentication** > **Providers**
2. Habilite **Email**
3. Configure as URLs de redirecionamento:
   - Development: `http://localhost:3000`
   - Production: `https://seu-dominio.com`

### 4. Configurar Variáveis de Ambiente

1. No painel do Supabase, vá em **Settings** > **API**
2. Copie:
   - **Project URL**
   - **anon public** key

3. Cole no arquivo `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_key_aqui
```

### 5. Testar Conexão

Execute o projeto e verifique se consegue fazer login:

```bash
npm run dev
```

## 📊 Estrutura do Banco de Dados

### Tabelas Criadas

1. **users** - Dados dos vendedores e admins
2. **training_modules** - Módulos de treinamento
3. **user_progress** - Progresso de cada usuário nos módulos
4. **chat_messages** - Histórico de conversas com IA

### Políticas de Segurança (RLS)

- ✅ Row Level Security habilitado em todas as tabelas
- ✅ Usuários só veem seus próprios dados
- ✅ Admins têm acesso completo
- ✅ Proteção contra acesso não autorizado

## 🔐 Criar Primeiro Usuário Admin

Execute no SQL Editor do Supabase:

```sql
-- Criar usuário admin de teste
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  uuid_generate_v4(),
  'authenticated',
  'authenticated',
  'admin@assiny.com',
  crypt('senha123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Admin"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Criar perfil do admin na tabela users
INSERT INTO users (email, name, role)
VALUES ('admin@assiny.com', 'Admin', 'admin');
```

**Credenciais de teste:**
- Email: `admin@assiny.com`
- Senha: `senha123`

## 📝 Inserir Módulos de Treinamento de Exemplo

```sql
INSERT INTO training_modules (title, description, content, "order") VALUES
('Fundamentos de Vendas', 'Aprenda os conceitos básicos de vendas', 'Conteúdo do módulo...', 1),
('Técnicas de Prospecção', 'Como encontrar e qualificar leads', 'Conteúdo do módulo...', 2),
('Negociação Avançada', 'Estratégias para fechar negócios', 'Conteúdo do módulo...', 3),
('Gestão de Relacionamento', 'Mantenha clientes satisfeitos', 'Conteúdo do módulo...', 4);
```

## 🔄 Migrations Futuras

Para adicionar novas features ao banco de dados, crie arquivos numerados:

- `001_initial_schema.sql` (já executado)
- `002_add_certifications.sql` (futuro)
- `003_add_analytics.sql` (futuro)

## 📚 Recursos Úteis

- [Documentação Supabase](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime](https://supabase.com/docs/guides/realtime)