# 🗄️ Como Executar o Schema SQL no Supabase

## Passo a Passo Detalhado

### 1. Acesse o SQL Editor

1. Vá para: https://vvqtgclprliryctavqal.supabase.co
2. No menu lateral esquerdo, clique em **SQL Editor** (ícone de terminal)

### 2. Criar Nova Query

1. Clique no botão **"+ New query"** (canto superior direito)
2. Ou use o botão **"New query"** no centro da tela

### 3. Copiar o Schema

Abra o arquivo `supabase/schema.sql` e copie **TODO** o conteúdo.

Ou copie daqui:

```sql
-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de módulos de treinamento
CREATE TABLE IF NOT EXISTS training_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de progresso do usuário
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  score INTEGER,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- Criar tabela de mensagens do chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_module_id ON user_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_training_modules_order ON training_modules("order");

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_training_modules_updated_at
  BEFORE UPDATE ON training_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para users
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON users FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Admins podem ver todos os usuários"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Políticas para training_modules
CREATE POLICY "Todos podem ver módulos de treinamento"
  ON training_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas admins podem criar módulos"
  ON training_modules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

CREATE POLICY "Apenas admins podem atualizar módulos"
  ON training_modules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Políticas para user_progress
CREATE POLICY "Usuários podem ver seu próprio progresso"
  ON user_progress FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Usuários podem atualizar seu próprio progresso"
  ON user_progress FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Usuários podem criar seu próprio progresso"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admins podem ver todo o progresso"
  ON user_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Políticas para chat_messages
CREATE POLICY "Usuários podem ver suas próprias mensagens"
  ON chat_messages FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Usuários podem criar suas próprias mensagens"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admins podem ver todas as mensagens"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id::text = auth.uid()::text AND role = 'admin'
    )
  );

-- Inserir módulos de exemplo
INSERT INTO training_modules (title, description, content, "order") VALUES
('Fundamentos de Vendas', 'Aprenda os conceitos básicos de vendas', 'Conteúdo do módulo sobre fundamentos...', 1),
('Técnicas de Prospecção', 'Como encontrar e qualificar leads', 'Conteúdo sobre prospecção...', 2),
('Negociação Avançada', 'Estratégias para fechar negócios', 'Conteúdo sobre negociação...', 3),
('Gestão de Relacionamento', 'Mantenha clientes satisfeitos', 'Conteúdo sobre relacionamento...', 4);
```

### 4. Colar e Executar

1. Cole todo o SQL no editor
2. Clique no botão **"Run"** (ou pressione `Ctrl+Enter` / `Cmd+Enter`)
3. Aguarde a mensagem de sucesso ✅

### 5. Verificar

No menu lateral, vá em **Table Editor** e verifique se as tabelas foram criadas:

- ✅ users
- ✅ training_modules
- ✅ user_progress
- ✅ chat_messages

## ✅ Pronto!

Agora você pode:

1. Configurar a anon key no `.env.local`
2. Executar `npm run dev`
3. Acessar a aplicação

## 🎯 Próximo Passo

Criar seu primeiro usuário admin - veja `CRIAR-USUARIO.md`