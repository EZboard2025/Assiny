// Tipos de Planos disponíveis
export enum PlanType {
  OG = 'og',         // Original Gangster - Early Adopters
  PRO = 'pro',       // Plano Pro
  MAX = 'max',       // Plano Max
  // Planos de Processo Seletivo
  PS_STARTER = 'ps_starter',
  PS_SCALE = 'ps_scale',
  PS_GROWTH = 'ps_growth',
  PS_PRO = 'ps_pro',
  PS_MAX = 'ps_max'
}

// Interface para definir as limitações de cada plano
export interface PlanLimits {
  // Limites de roleplay de treinamento
  maxRoleplaysPerWeek: number | null; // null = ilimitado

  // Limites de configuração
  maxPersonas: number | null;
  maxObjections: number | null;
  maxObjectionRebuttals: number; // Formas de quebrar objeção

  // Limites de processo seletivo (apenas para planos PS_*)
  maxSelectionCandidates: number | null;
  isSelectionPlan: boolean;

  // Funcionalidades disponíveis
  hasRoleplay: boolean;
  hasChatIA: boolean;
  hasFollowUp: boolean; // Temporariamente true para todos
  hasPDI: boolean;
  hasPerformanceAnalytics: boolean;
  hasDashboard: boolean;
  hasConfigHub: boolean;

  // Recursos avançados
  hasCustomPersonas: boolean;
  hasCustomObjections: boolean;
  hasCompanyData: boolean;

  // Suporte
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
}

// Configuração dos planos
export const PLAN_CONFIGS: Record<PlanType, PlanLimits> = {
  // Plano OG - Tudo ilimitado para early adopters
  [PlanType.OG]: {
    maxRoleplaysPerWeek: null,
    maxPersonas: null,
    maxObjections: null,
    maxObjectionRebuttals: 999, // Praticamente ilimitado
    maxSelectionCandidates: null,
    isSelectionPlan: false,
    hasRoleplay: true,
    hasChatIA: true,
    hasFollowUp: true,
    hasPDI: true,
    hasPerformanceAnalytics: true,
    hasDashboard: true,
    hasConfigHub: true,
    hasCustomPersonas: true,
    hasCustomObjections: true,
    hasCompanyData: true,
    supportLevel: 'priority'
  },

  // Plano PRO - Limitado
  [PlanType.PRO]: {
    maxRoleplaysPerWeek: 4, // 4 simulações por semana
    maxPersonas: 3,
    maxObjections: 10,
    maxObjectionRebuttals: 3,
    maxSelectionCandidates: null,
    isSelectionPlan: false,
    hasRoleplay: true,
    hasChatIA: false,
    hasFollowUp: true, // Temporariamente liberado
    hasPDI: false,
    hasPerformanceAnalytics: true,
    hasDashboard: true,
    hasConfigHub: true,
    hasCustomPersonas: true,
    hasCustomObjections: true,
    hasCompanyData: true,
    supportLevel: 'email'
  },

  // Plano MAX - Ilimitado
  [PlanType.MAX]: {
    maxRoleplaysPerWeek: null,
    maxPersonas: null,
    maxObjections: null,
    maxObjectionRebuttals: 5,
    maxSelectionCandidates: null,
    isSelectionPlan: false,
    hasRoleplay: true,
    hasChatIA: true,
    hasFollowUp: true, // Temporariamente liberado
    hasPDI: true,
    hasPerformanceAnalytics: true,
    hasDashboard: true,
    hasConfigHub: true,
    hasCustomPersonas: true,
    hasCustomObjections: true,
    hasCompanyData: true,
    supportLevel: 'priority'
  },

  // Planos de Processo Seletivo
  [PlanType.PS_STARTER]: {
    maxRoleplaysPerWeek: null,
    maxPersonas: null,
    maxObjections: null,
    maxObjectionRebuttals: 5,
    maxSelectionCandidates: 5,
    isSelectionPlan: true,
    hasRoleplay: true,
    hasChatIA: false,
    hasFollowUp: false,
    hasPDI: false,
    hasPerformanceAnalytics: true,
    hasDashboard: true,
    hasConfigHub: false,
    hasCustomPersonas: false,
    hasCustomObjections: false,
    hasCompanyData: false,
    supportLevel: 'dedicated'
  },

  [PlanType.PS_SCALE]: {
    maxRoleplaysPerWeek: null,
    maxPersonas: null,
    maxObjections: null,
    maxObjectionRebuttals: 5,
    maxSelectionCandidates: 10,
    isSelectionPlan: true,
    hasRoleplay: true,
    hasChatIA: false,
    hasFollowUp: false,
    hasPDI: false,
    hasPerformanceAnalytics: true,
    hasDashboard: true,
    hasConfigHub: false,
    hasCustomPersonas: false,
    hasCustomObjections: false,
    hasCompanyData: false,
    supportLevel: 'dedicated'
  },

  [PlanType.PS_GROWTH]: {
    maxRoleplaysPerWeek: null,
    maxPersonas: null,
    maxObjections: null,
    maxObjectionRebuttals: 5,
    maxSelectionCandidates: 20,
    isSelectionPlan: true,
    hasRoleplay: true,
    hasChatIA: false,
    hasFollowUp: false,
    hasPDI: false,
    hasPerformanceAnalytics: true,
    hasDashboard: true,
    hasConfigHub: false,
    hasCustomPersonas: false,
    hasCustomObjections: false,
    hasCompanyData: false,
    supportLevel: 'dedicated'
  },

  [PlanType.PS_PRO]: {
    maxRoleplaysPerWeek: null,
    maxPersonas: null,
    maxObjections: null,
    maxObjectionRebuttals: 5,
    maxSelectionCandidates: 50,
    isSelectionPlan: true,
    hasRoleplay: true,
    hasChatIA: false,
    hasFollowUp: false,
    hasPDI: false,
    hasPerformanceAnalytics: true,
    hasDashboard: true,
    hasConfigHub: false,
    hasCustomPersonas: false,
    hasCustomObjections: false,
    hasCompanyData: false,
    supportLevel: 'dedicated'
  },

  [PlanType.PS_MAX]: {
    maxRoleplaysPerWeek: null,
    maxPersonas: null,
    maxObjections: null,
    maxObjectionRebuttals: 5,
    maxSelectionCandidates: null, // Ilimitado
    isSelectionPlan: true,
    hasRoleplay: true,
    hasChatIA: false,
    hasFollowUp: false,
    hasPDI: false,
    hasPerformanceAnalytics: true,
    hasDashboard: true,
    hasConfigHub: false,
    hasCustomPersonas: false,
    hasCustomObjections: false,
    hasCompanyData: false,
    supportLevel: 'dedicated'
  }
};

// Nomes amigáveis dos planos
export const PLAN_NAMES: Record<PlanType, string> = {
  [PlanType.OG]: 'OG (Original)',
  [PlanType.PRO]: 'PRO',
  [PlanType.MAX]: 'MAX',
  [PlanType.PS_STARTER]: 'Seleção Starter',
  [PlanType.PS_SCALE]: 'Seleção Scale',
  [PlanType.PS_GROWTH]: 'Seleção Growth',
  [PlanType.PS_PRO]: 'Seleção Pro',
  [PlanType.PS_MAX]: 'Seleção MAX'
};

// Cores dos planos para UI
export const PLAN_COLORS: Record<PlanType, { bg: string; border: string; text: string }> = {
  [PlanType.OG]: {
    bg: 'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400'
  },
  [PlanType.PRO]: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400'
  },
  [PlanType.MAX]: {
    bg: 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400'
  },
  [PlanType.PS_STARTER]: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400'
  },
  [PlanType.PS_SCALE]: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400'
  },
  [PlanType.PS_GROWTH]: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400'
  },
  [PlanType.PS_PRO]: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400'
  },
  [PlanType.PS_MAX]: {
    bg: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400'
  }
};

// Função helper para verificar se uma funcionalidade está disponível
export function hasFeature(plan: PlanType, feature: keyof PlanLimits): boolean {
  const limits = PLAN_CONFIGS[plan];
  const value = limits[feature];

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number' || value === null) {
    return value === null || value > 0;
  }

  return false;
}

// Função helper para verificar limites
export function checkLimit(plan: PlanType, feature: keyof PlanLimits, currentUsage: number): {
  allowed: boolean;
  limit: number | null;
  remaining: number | null;
} {
  const limits = PLAN_CONFIGS[plan];
  const limit = limits[feature] as number | null;

  if (limit === null) {
    return { allowed: true, limit: null, remaining: null };
  }

  const remaining = limit - currentUsage;
  return {
    allowed: remaining > 0,
    limit,
    remaining: Math.max(0, remaining)
  };
}

// Função para verificar se é plano de processo seletivo
export function isSelectionPlan(plan: PlanType): boolean {
  return PLAN_CONFIGS[plan].isSelectionPlan;
}

// Função para verificar se é plano de treinamento
export function isTrainingPlan(plan: PlanType): boolean {
  return !PLAN_CONFIGS[plan].isSelectionPlan;
}