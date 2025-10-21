# 🚀 Guia Completo de Deploy no Vercel

## ✅ Pré-requisitos (JÁ FEITOS)
- [x] Build local funcionando
- [x] Código no GitHub
- [x] Variáveis de ambiente listadas

---

## 📦 Método: Deploy via Dashboard do Vercel

### **Passo 1: Acessar o Vercel**

1. Acesse: **https://vercel.com**
2. Faça login com sua conta (GitHub, GitLab, ou Email)

### **Passo 2: Criar Novo Projeto**

1. No dashboard, clique em **"Add New..."** (botão azul no canto superior direito)
2. Selecione **"Project"**
3. Clique em **"Import Git Repository"**

### **Passo 3: Importar Repositório**

1. Conecte sua conta do GitHub (se ainda não estiver conectada)
2. Encontre o repositório **"EZboard2025/Assiny"** na lista
3. Clique em **"Import"** ao lado do repositório

### **Passo 4: Configurar o Projeto**

Na tela de configuração, você verá:

#### Framework Preset
- Será detectado automaticamente como **Next.js** ✅

#### Build and Output Settings
- **Build Command**: `npm run build` (deixe como está)
- **Output Directory**: `.next` (deixe como está)
- **Install Command**: `npm install` (deixe como está)

#### Root Directory
- Deixe como `./` (raiz do projeto)

### **Passo 5: Adicionar Variáveis de Ambiente** ⚠️ IMPORTANTE

Role para baixo até a seção **"Environment Variables"** e adicione as seguintes variáveis:

#### Variable 1:
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://vvqtgclprllryctavqal.supabase.co`
- **Environment**: Marque **Production**, **Preview**, **Development**

#### Variable 2:
- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cXRnY2xwcmxscnljdGF2cWFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjU1NDIsImV4cCI6MjA3NTEwMTU0Mn0.WMGackcrbMmAwoXx9R8f6KAuiDBIMHYK7o8vdwvawvg`
- **Environment**: Marque **Production**, **Preview**, **Development**

#### Variable 3:
- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2cXRnY2xwcmxscnljdGF2cWFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTUyNTU0MiwiZXhwIjoyMDc1MTAxNTQyfQ.OwsRj4RPV4JMhnjHNdATeIf9KDJTJMusNzriUn5BOfQ`
- **Environment**: Marque **Production**, **Preview**, **Development**

#### Variable 4:
- **Name**: `OPENAI_API_KEY`
- **Value**: `sua-api-key-do-openai-aqui`
- **Environment**: Marque **Production**, **Preview**, **Development**

#### Variable 5:
- **Name**: `OPENAI_ASSISTANT_ID_ROLEPLAY`
- **Value**: `asst_B7v7Nd1E1cPlUrTKRqxdOQDm`
- **Environment**: Marque **Production**, **Preview**, **Development**

### **Passo 6: Deploy**

1. Após adicionar todas as variáveis, clique em **"Deploy"**
2. Aguarde o build completar (1-3 minutos)
3. Você verá confetes 🎉 quando o deploy for bem-sucedido!

### **Passo 7: Acessar a Aplicação**

1. Clique em **"Continue to Dashboard"**
2. No topo da página, você verá a URL do seu projeto, algo como:
   - `https://assiny.vercel.app`
   - ou `https://assiny-ezboard2025.vercel.app`
3. Clique na URL para abrir sua aplicação!

---

## ⚙️ Configuração do Supabase (OBRIGATÓRIA)

Após o deploy, você **DEVE** configurar o Supabase para aceitar requisições do Vercel:

1. Acesse: **https://supabase.com/dashboard/project/vvqtgclprllryctavqal**
2. No menu lateral, clique em **Authentication**
3. Clique em **URL Configuration**
4. Em **Site URL**, cole a URL do Vercel (exemplo: `https://assiny.vercel.app`)
5. Em **Redirect URLs**, adicione:
   ```
   https://assiny.vercel.app/**
   ```
   (troque pela sua URL real do Vercel)
6. Clique em **Save**

---

## 🧪 Testando a Aplicação

### Teste 1: Página de Login
1. Acesse a URL do Vercel
2. A página de login deve carregar corretamente

### Teste 2: Login
1. Use as credenciais de um usuário existente
2. Se conseguir fazer login, o Supabase está funcionando ✅

### Teste 3: Criar Roleplay
1. Após o login, vá para "Configuração da Sessão"
2. Selecione idade, temperamento, persona e objeções
3. Clique em "Iniciar Simulação"
4. Se o roleplay iniciar, o OpenAI está funcionando ✅

---

## 🔧 Troubleshooting

### Erro "Failed to fetch" no login
**Causa**: Supabase não está configurado para aceitar o domínio do Vercel
**Solução**: Configure as URLs no Supabase (Passo 7 acima)

### Erro 500 na aplicação
**Causa**: Variáveis de ambiente não configuradas
**Solução**:
1. No Vercel Dashboard, vá em **Settings** → **Environment Variables**
2. Confirme que todas as 5 variáveis estão corretas
3. Faça um **Redeploy**: Deployments → ⋯ (três pontos) → Redeploy

### Roleplay não inicia
**Causa**: OpenAI API key inválida ou sem créditos
**Solução**:
1. Verifique se a API key está correta
2. Acesse https://platform.openai.com/account/usage para ver créditos
3. Verifique se o Assistant ID está correto

### Build falhou
**Causa**: Erro no código TypeScript
**Solução**: O build local já passou, então isso não deve acontecer. Se acontecer, veja os logs em:
- Vercel Dashboard → Deployments → Build Logs

---

## 📋 Checklist Final

- [ ] Deploy concluído com sucesso (confetes 🎉)
- [ ] URL de produção acessível
- [ ] Supabase configurado com URL do Vercel
- [ ] Login funcionando
- [ ] Roleplay iniciando corretamente
- [ ] Chat IA funcionando
- [ ] ConfigHub acessível (senha: admin123)

---

## 🎯 Próximos Passos (Opcional)

### Domínio Customizado
Se quiser usar um domínio próprio (exemplo: assiny.com.br):

1. No Vercel Dashboard, vá em **Settings** → **Domains**
2. Clique em **Add Domain**
3. Siga as instruções para configurar o DNS

### Monitoramento
O Vercel oferece logs em tempo real:
1. Vá em **Analytics** para ver métricas de uso
2. Vá em **Functions** → **Logs** para ver logs da API

---

## 💡 Dicas

- **Deploy Automático**: Toda vez que você fizer `git push` no GitHub, o Vercel fará um deploy automaticamente
- **Preview Deploys**: Branches diferentes criam URLs de preview automaticamente
- **Rollback**: Você pode voltar para deploys anteriores a qualquer momento

---

Qualquer dúvida, acesse: https://vercel.com/docs