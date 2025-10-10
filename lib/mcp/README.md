# MCP - Model Context Protocol

## 📋 O que é o MCP?

O MCP (Model Context Protocol) é a camada de abstração que gerencia toda comunicação entre os usuários e o agente de IA. Ele:

- 🧠 Mantém contexto das conversas
- 📊 Analisa progresso do usuário
- 🎯 Personaliza respostas baseado no perfil
- 💾 Salva histórico no banco de dados
- 🔄 Gerencia fluxo de conversação

## 🏗️ Arquitetura

```
┌─────────────┐
│   Usuário   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  ChatInterface  │ (React Component)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    useChat      │ (React Hook)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   AIAgent       │ (MCP Core)
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────┐
│Supabase│ │ IA API│
└────────┘ └──────┘
```

## 🔧 Componentes Principais

### 1. Types (`types.ts`)

Define todas as interfaces TypeScript:

```typescript
// Mensagem no chat
interface MCPMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

// Contexto do usuário
interface MCPContext {
  userId: string
  userName?: string
  userRole: 'admin' | 'vendedor'
  conversationHistory: MCPMessage[]
  currentModule?: string
  userProgress?: UserProgressContext
}
```

### 2. Agent (`agent.ts`)

Classe principal que gerencia a IA:

```typescript
class AssinyAIAgent implements AIAgent {
  // Processar mensagens
  async processMessage(request: MCPRequest): Promise<MCPResponse>

  // Recomendar módulos
  async getTrainingRecommendations(userId: string): Promise<TrainingModule[]>

  // Analisar desempenho
  async analyzePerformance(userId: string): Promise<UserProgressContext>
}
```

## 📚 Como Usar

### No React Component

```typescript
import { useChat } from '@/lib/hooks/useChat'

function ChatComponent() {
  const { messages, sendMessage, loading } = useChat(userId)

  const handleSend = async (text: string) => {
    const response = await sendMessage(text)
    console.log('Sugestões:', response?.suggestions)
  }

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.content}</div>
      ))}
    </div>
  )
}
```

### Integrar com API de IA

Edite o método `generateResponse` em `agent.ts`:

#### Exemplo com OpenAI:

```typescript
private async generateResponse(
  systemPrompt: string,
  conversationContext: string,
  message: string
): Promise<MCPResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    })
  })

  const data = await response.json()

  return {
    message: data.choices[0].message.content,
    metadata: {
      confidence: 0.9,
      needsEscalation: false
    }
  }
}
```

#### Exemplo com Anthropic (Claude):

```typescript
private async generateResponse(
  systemPrompt: string,
  conversationContext: string,
  message: string
): Promise<MCPResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      system: systemPrompt,
      messages: [
        { role: 'user', content: message }
      ],
      max_tokens: 1024
    })
  })

  const data = await response.json()

  return {
    message: data.content[0].text,
    metadata: {
      confidence: 0.9,
      needsEscalation: false
    }
  }
}
```

## 🎯 Personalização do Contexto

O agente usa informações do usuário para personalizar respostas:

```typescript
const systemPrompt = `
Você é um assistente de treinamento da Assiny.

Contexto do usuário:
- Nome: ${context.userName}
- Função: ${context.userRole}
- Módulos completados: ${context.userProgress?.completedModules}
- Score: ${context.userProgress?.currentScore}
- Pontos fracos: ${context.userProgress?.weakPoints.join(', ')}
- Pontos fortes: ${context.userProgress?.strengths.join(', ')}

Adapte suas respostas baseado neste contexto.
`
```

## 📊 Análise de Performance

```typescript
const performance = await aiAgent.analyzePerformance(userId)

console.log({
  completedModules: performance.completedModules,
  totalModules: performance.totalModules,
  currentScore: performance.currentScore,
  weakPoints: performance.weakPoints,
  strengths: performance.strengths
})
```

## 🔄 Recomendações de Módulos

```typescript
const recommendations = await aiAgent.getTrainingRecommendations(userId)

recommendations.forEach(module => {
  console.log(`${module.title} - ${module.description}`)
})
```

## 🚀 Próximos Passos

1. **Integrar API de IA**
   - Adicionar variáveis de ambiente com API keys
   - Implementar método `generateResponse` real
   - Testar respostas

2. **Melhorar Análise de Performance**
   - Adicionar mais métricas
   - Criar gráficos de progresso
   - Comparar com média da equipe

3. **Adicionar Features Avançadas**
   - Streaming de respostas
   - Sugestões contextuais
   - Análise de sentimento
   - Detecção de dúvidas frequentes

4. **Otimizações**
   - Cache de respostas comuns
   - Rate limiting
   - Compressão de contexto
   - Parallel processing

## 📝 Variáveis de Ambiente Necessárias

Adicione ao `.env.local`:

```bash
# IA Provider (escolha um)
OPENAI_API_KEY=sk-...
# ou
ANTHROPIC_API_KEY=sk-ant-...
# ou
GOOGLE_AI_API_KEY=...

# Configurações opcionais
AI_MODEL=gpt-4
AI_MAX_TOKENS=2000
AI_TEMPERATURE=0.7
```

## 🐛 Debug

Ative logs detalhados:

```typescript
// Em agent.ts
const DEBUG = process.env.NODE_ENV === 'development'

if (DEBUG) {
  console.log('System Prompt:', systemPrompt)
  console.log('User Message:', message)
  console.log('Context:', context)
}
```

## 📖 Recursos

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Anthropic Claude API](https://docs.anthropic.com/claude/reference)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)