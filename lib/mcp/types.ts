// Types para o MCP (Model Context Protocol)

export interface MCPMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface MCPContext {
  userId: string
  userName?: string
  userRole: 'admin' | 'vendedor'
  conversationHistory: MCPMessage[]
  currentModule?: string
  userProgress?: UserProgressContext
}

export interface UserProgressContext {
  completedModules: number
  totalModules: number
  currentScore: number
  weakPoints: string[]
  strengths: string[]
}

export interface MCPRequest {
  message: string
  context: MCPContext
  options?: {
    temperature?: number
    maxTokens?: number
    stream?: boolean
  }
}

export interface MCPResponse {
  message: string
  suggestions?: string[]
  relatedModules?: string[]
  metadata?: {
    confidence: number
    sources?: string[]
    needsEscalation?: boolean
  }
}

export interface TrainingModule {
  id: string
  title: string
  description: string
  content: string
  order: number
  estimatedTime?: number
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  tags?: string[]
}

export interface AIAgent {
  processMessage(request: MCPRequest): Promise<MCPResponse>
  getTrainingRecommendations(userId: string): Promise<TrainingModule[]>
  analyzePerformance(userId: string): Promise<UserProgressContext>
}