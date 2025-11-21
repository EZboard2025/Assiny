import { supabase } from '../supabase'
import type { MCPRequest, MCPResponse, TrainingModule, UserProgressContext, AIAgent } from './types'

class RamppyAIAgent implements AIAgent {
  /**
   * Processa mensagens do usuário e retorna resposta contextualizada
   */
  async processMessage(request: MCPRequest): Promise<MCPResponse> {
    const { message, context } = request

    // Salvar mensagem do usuário no banco
    await this.saveMessage(context.userId, message, 'user')

    // Construir contexto para IA
    const systemPrompt = this.buildSystemPrompt(context)
    const conversationContext = this.buildConversationContext(context)

    // Aqui você integrará com a API da IA (OpenAI, Anthropic, etc)
    // Por enquanto, vamos retornar uma resposta simulada
    const response = await this.generateResponse(systemPrompt, conversationContext, message)

    // Salvar resposta da IA no banco
    await this.saveMessage(context.userId, response.message, 'assistant')

    return response
  }

  /**
   * Recomenda módulos de treinamento baseado no perfil do usuário
   */
  async getTrainingRecommendations(userId: string): Promise<TrainingModule[]> {
    // Buscar progresso do usuário
    const { data: progress } = await supabase
      .from('user_progress')
      .select('module_id, completed, score')
      .eq('user_id', userId)

    const completedModuleIds = progress
      ?.filter(p => p.completed)
      .map(p => p.module_id) || []

    // Buscar módulos não completados
    const { data: modules } = await supabase
      .from('training_modules')
      .select('*')
      .not('id', 'in', `(${completedModuleIds.join(',')})`)
      .order('order', { ascending: true })
      .limit(5)

    return modules || []
  }

  /**
   * Analisa o desempenho do usuário
   */
  async analyzePerformance(userId: string): Promise<UserProgressContext> {
    const { data: progress } = await supabase
      .from('user_progress')
      .select('*, training_modules(*)')
      .eq('user_id', userId)

    const { data: allModules } = await supabase
      .from('training_modules')
      .select('id')

    const completedModules = progress?.filter(p => p.completed).length || 0
    const totalModules = allModules?.length || 0
    const avgScore = progress?.reduce((acc, p) => acc + (p.score || 0), 0) / (progress?.length || 1)

    // Análise simplificada - você pode melhorar isso
    const weakPoints = progress
      ?.filter(p => p.score && p.score < 70)
      .map(p => p.training_modules?.title)
      .filter(Boolean) || []

    const strengths = progress
      ?.filter(p => p.score && p.score >= 90)
      .map(p => p.training_modules?.title)
      .filter(Boolean) || []

    return {
      completedModules,
      totalModules,
      currentScore: Math.round(avgScore),
      weakPoints,
      strengths
    }
  }

  /**
   * Constrói o prompt de sistema para a IA
   */
  private buildSystemPrompt(context: any): string {
    return `Você é um assistente de treinamento especializado em vendas da Ramppy.

Seu papel é:
- Ajudar vendedores a desenvolver suas habilidades
- Responder perguntas sobre técnicas de vendas
- Fornecer feedback construtivo
- Recomendar módulos de treinamento relevantes
- Motivar e engajar os vendedores

Contexto do usuário:
- Nome: ${context.userName || 'Vendedor'}
- Função: ${context.userRole}
- Módulos completados: ${context.userProgress?.completedModules || 0}/${context.userProgress?.totalModules || 0}
- Score atual: ${context.userProgress?.currentScore || 0}

Seja sempre profissional, motivador e focado em resultados práticos.`
  }

  /**
   * Constrói o contexto da conversa
   */
  private buildConversationContext(context: any): string {
    const recent = context.conversationHistory.slice(-5)
    return recent
      .map((msg: any) => `${msg.role}: ${msg.content}`)
      .join('\n')
  }

  /**
   * Gera resposta da IA (simulada por enquanto)
   */
  private async generateResponse(
    systemPrompt: string,
    conversationContext: string,
    message: string
  ): Promise<MCPResponse> {
    // TODO: Integrar com API da IA real (OpenAI, Anthropic, etc)
    // Por enquanto, resposta simulada

    return {
      message: `Entendi sua pergunta sobre "${message}". Vou ajudá-lo com isso! [Esta é uma resposta simulada - a integração com IA será implementada em breve]`,
      suggestions: [
        'Como posso melhorar minhas técnicas de fechamento?',
        'Quais são os próximos módulos recomendados?',
        'Como estou performando comparado à média?'
      ],
      metadata: {
        confidence: 0.85,
        needsEscalation: false
      }
    }
  }

  /**
   * Salva mensagem no banco de dados
   */
  private async saveMessage(userId: string, message: string, role: 'user' | 'assistant') {
    await supabase.from('chat_messages').insert({
      user_id: userId,
      message,
      role
    })
  }
}

// Exportar instância singleton
export const aiAgent = new RamppyAIAgent()