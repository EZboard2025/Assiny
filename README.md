# Assiny - Plataforma de Treinamento

## 🚀 Sobre o Projeto

Plataforma interna de treinamento para vendedores da Assiny. Sistema completo com chat assistente de IA, módulos de aprendizado e centro de gerenciamento administrativo.

## 🛠️ Tecnologias Utilizadas

- **Next.js 14** - Framework React com SSR
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Lucide Icons** - Ícones modernos
- **Framer Motion** - Animações (instalado, pronto para uso)

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

## 🔐 Credenciais de Acesso

### Login
- **Email**: Qualquer email válido
- **Senha**: Qualquer senha (temporário)

### Centro de Gerenciamento
- **Senha**: `admin123`

## 📁 Estrutura do Projeto

```
/app
  layout.tsx      # Layout principal
  page.tsx        # Página inicial
  globals.css     # Estilos globais

/components
  LandingPage.tsx    # Landing page
  LoginModal.tsx     # Modal de login
  Dashboard.tsx      # Dashboard principal
  ChatInterface.tsx  # Interface do chat
  ConfigHub.tsx      # Hub de configurações
  Logo.tsx          # Componente do logo
```

## 🎨 Recursos Implementados

✅ Landing page responsiva focada em treinamento
✅ Sistema de login com validação
✅ Chat assistente de IA para dúvidas de vendas
✅ Centro de Gerenciamento administrativo protegido
✅ Gestão de vendedores e módulos
✅ Relatórios e métricas de desempenho
✅ Sistema de certificações

## 🔄 Status do Projeto

### ✅ Implementado

- ✅ Autenticação com Supabase
- ✅ Banco de dados PostgreSQL completo
- ✅ Sistema de chat com histórico
- ✅ Estrutura MCP (Model Context Protocol)
- ✅ Hooks React otimizados
- ✅ TypeScript types completos
- ✅ Row Level Security (RLS)

### 🚧 Próximos Passos

1. **Conectar API de IA** (OpenAI, Anthropic, etc)
2. **Criar conteúdo dos módulos de treinamento**
3. **Dashboard com analytics e métricas**
4. **Sistema de certificados**
5. **Upload de vídeos e materiais**

## 🎯 Como Personalizar

### Cores da Marca
Edite as cores em `tailwind.config.ts`:
```javascript
colors: {
  primary: '#7030F0',      // Roxo Assiny
  'primary-dark': '#5B25C4',
  'primary-light': '#8E5BF4',
}
```

### Senha do Hub
Altere a senha em `components/ConfigHub.tsx` na linha 19:
```javascript
if (password === 'admin123') { // Mude 'admin123' para sua senha
```

## 📱 Visualização

A aplicação está totalmente responsiva e funciona perfeitamente em:
- Desktop
- Tablet
- Mobile

## 🤝 Suporte

Para qualquer dúvida ou sugestão, entre em contato com a equipe Assiny.