# 🚀 Guia Rápido de Setup - Assiny Training

## ⚡ Setup Rápido (5 minutos)

### 1. Configurar Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Vá em **SQL Editor** e execute o arquivo `supabase/schema.sql`
4. Vá em **Settings** > **API** e copie:
   - Project URL
   - anon public key

### 2. Configurar Variáveis de Ambiente

Edite o arquivo `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_key_do_supabase
```

### 3. Instalar e Rodar

```bash
npm install
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## ✅ Checklist de Configuração

- [ ] Supabase configurado
- [ ] Tabelas criadas (schema.sql executado)
- [ ] Variáveis de ambiente configuradas
- [ ] Dependências instaladas
- [ ] Servidor rodando

## 📊 Estrutura do Projeto

```
assiny/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Layout principal
│   ├── page.tsx           # Página inicial (login)
│   └── globals.css        # Estilos globais
│
├── components/            # Componentes React
│   ├── LoginPage.tsx     # Tela de login
│   ├── Dashboard.tsx     # Dashboard principal
│   ├── ChatInterface.tsx # Chat com IA
│   └── ConfigHub.tsx     # Hub administrativo
│
├── lib/                   # Lógica de negócio
│   ├── supabase.ts       # Cliente Supabase
│   ├── hooks/            # React Hooks
│   │   ├── useAuth.ts    # Autenticação
│   │   └── useChat.ts    # Chat
│   └── mcp/              # Model Context Protocol
│       ├── types.ts      # TypeScript types
│       ├── agent.ts      # Agente IA
│       └── README.md     # Documentação MCP
│
└── supabase/             # Configuração banco
    ├── schema.sql        # Schema do banco
    └── README.md         # Guia Supabase
```

## 🔐 Criar Primeiro Usuário

Execute no SQL Editor do Supabase:

```sql
-- 1. Criar usuário na auth
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@assiny.com',
  crypt('senha123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Admin"}'
);

-- 2. Criar perfil do usuário
INSERT INTO users (email, name, role)
VALUES ('admin@assiny.com', 'Admin', 'admin');
```

**Login de teste:**
- Email: `admin@assiny.com`
- Senha: `senha123`

## 🤖 Integrar IA (Opcional)

### Opção 1: OpenAI

```bash
npm install openai
```

Adicione ao `.env.local`:
```bash
OPENAI_API_KEY=sk-...
```

Edite `lib/mcp/agent.ts` no método `generateResponse`.

### Opção 2: Anthropic (Claude)

```bash
npm install @anthropic-ai/sdk
```

Adicione ao `.env.local`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

### Opção 3: Google AI

```bash
npm install @google/generative-ai
```

Adicione ao `.env.local`:
```bash
GOOGLE_AI_API_KEY=...
```

## 📝 Inserir Dados de Teste

Execute no SQL Editor:

```sql
-- Módulos de treinamento
INSERT INTO training_modules (title, description, content, "order") VALUES
('Introdução a Vendas', 'Fundamentos básicos', 'Conteúdo...', 1),
('Prospecção', 'Como encontrar clientes', 'Conteúdo...', 2),
('Fechamento', 'Técnicas de fechamento', 'Conteúdo...', 3),
('Pós-venda', 'Fidelização de clientes', 'Conteúdo...', 4);

-- Vendedor de teste
INSERT INTO users (email, name, role)
VALUES ('vendedor@assiny.com', 'João Vendedor', 'vendedor');
```

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build de produção
npm run build

# Rodar produção localmente
npm run start

# Lint
npm run lint
```

## 🎯 Funcionalidades Prontas

✅ Login/Logout com Supabase Auth
✅ Chat com histórico salvo no banco
✅ Dashboard responsivo
✅ Hub de configuração (senha: admin123)
✅ Sistema de tipos TypeScript completo
✅ Estrutura MCP para IA
✅ Hooks React otimizados

## 🚧 Próximos Passos

1. **Conectar API de IA**
   - Escolher provider (OpenAI, Anthropic, etc)
   - Implementar método `generateResponse`
   - Testar respostas

2. **Criar Módulos de Treinamento**
   - Adicionar conteúdo real
   - Criar interface de gerenciamento
   - Sistema de quiz/avaliação

3. **Dashboard Analytics**
   - Gráficos de progresso
   - Ranking de vendedores
   - Métricas de performance

4. **Features Avançadas**
   - Upload de arquivos
   - Vídeos de treinamento
   - Certificados PDF
   - Notificações em tempo real

## 🐛 Problemas Comuns

### Erro de conexão com Supabase
- Verifique se as variáveis de ambiente estão corretas
- Confirme que executou o schema.sql
- Teste a conexão no painel do Supabase

### IA não responde
- Verifique se a API key está configurada
- Veja os logs do console para erros
- Confirme que implementou `generateResponse`

### Erro de autenticação
- Limpe o localStorage: `localStorage.clear()`
- Verifique RLS policies no Supabase
- Confirme que o usuário existe na tabela users

## 📚 Recursos

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs)

## 💬 Suporte

Para dúvidas ou problemas, consulte:
- `supabase/README.md` - Guia detalhado do Supabase
- `lib/mcp/README.md` - Documentação do MCP
- `README.md` - Visão geral do projeto