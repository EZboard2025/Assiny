// Tipos de Planos disponíveis
export enum PlanType {
  // Planos de Treinamento
  INDIVIDUAL = 'individual',   // R$129/mês - 20 simulações
  TEAM = 'team',               // R$1.999/mês - até 20 vendedores - 400 simulações
  BUSINESS = 'business',       // R$4.999/mês - 20 a 50 vendedores - 1.000 simulações
  ENTERPRISE = 'enterprise',   // +50 vendedores - preço variável

  // Planos de Processo Seletivo (mantidos)
  PS_STARTER = 'ps_starter',
  PS_SCALE = 'ps_scale',
  PS_GROWTH = 'ps_growth',
  PS_PRO = 'ps_pro',
  PS_MAX = 'ps_max'
}

// Interface para definir as limitações de cada plano
export interface PlanLimits {
  // Limite de créditos/simulações por mês
  monthlyCredits: number | null; // null = ilimitado ou variável

  // Limite de vendedores
  maxSellers: number | null; // null = ilimitado

  // Preço base mensal (para exibição)
  priceMonthly: number | null; // null = variável/personalizado

  // Pacotes de créditos extras disponíveis
  extraCreditsPackages: {
    credits: number;
    price: number;
  }[];

  // Limites de processo seletivo (apenas para planos PS_*)
  maxSelectionCandidates: number | null;
  isSelectionPlan: boolean;

  // Funcionalidades disponíveis (todas liberadas para planos de treinamento)
  hasRoleplay: boolean;
  hasChatIA: boolean;
  hasFollowUp: boolean;
  hasPDI: boolean;
  hasPerformanceAnalytics: boolean;
  hasDashboard: boolean;
  hasConfigHub: boolean;
  hasCustomPersonas: boolean;
  hasCustomObjections: boolean;
  hasCompanyData: boolean;

  // Suporte
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
}

// Configuração dos planos
export const PLAN_CONFIGS: Record<PlanType, PlanLimits> = {
  // Plano Individual - R$129/mês - 20 simulações
  [PlanType.INDIVIDUAL]: {
    monthlyCredits: 20,
    maxSellers: 1,
    priceMonthly: 129,
    extraCreditsPackages: [
      { credits: 10, price: 50 }
    ],
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
    supportLevel: 'email'
  },

  // Plano Team - R$1.999/mês - até 20 vendedores - 400 simulações
  [PlanType.TEAM]: {
    monthlyCredits: 400,
    maxSellers: 20,
    priceMonthly: 1999,
    extraCreditsPackages: [
      { credits: 50, price: 250 }
    ],
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

  // Plano Business - R$4.999/mês - 20 a 50 vendedores - 1.000 simulações
  [PlanType.BUSINESS]: {
    monthlyCredits: 1000,
    maxSellers: 50,
    priceMonthly: 4999,
    extraCreditsPackages: [
      { credits: 50, price: 250 },
      { credits: 100, price: 450 }
    ],
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
    supportLevel: 'dedicated'
  },

  // Plano Enterprise - +50 vendedores - preço variável
  [PlanType.ENTERPRISE]: {
    monthlyCredits: null, // Personalizável
    maxSellers: null, // Ilimitado
    priceMonthly: null, // Variável
    extraCreditsPackages: [], // Negociado
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
    supportLevel: 'dedicated'
  },

  // Planos de Processo Seletivo (mantidos)
  [PlanType.PS_STARTER]: {
    monthlyCredits: null,
    maxSellers: null,
    priceMonthly: null,
    extraCreditsPackages: [],
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
    monthlyCredits: null,
    maxSellers: null,
    priceMonthly: null,
    extraCreditsPackages: [],
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
    monthlyCredits: null,
    maxSellers: null,
    priceMonthly: null,
    extraCreditsPackages: [],
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
    monthlyCredits: null,
    maxSellers: null,
    priceMonthly: null,
    extraCreditsPackages: [],
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
    monthlyCredits: null,
    maxSellers: null,
    priceMonthly: null,
    extraCreditsPackages: [],
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
  [PlanType.INDIVIDUAL]: 'Individual',
  [PlanType.TEAM]: 'Team',
  [PlanType.BUSINESS]: 'Business',
  [PlanType.ENTERPRISE]: 'Enterprise',
  [PlanType.PS_STARTER]: 'Seleção Starter',
  [PlanType.PS_SCALE]: 'Seleção Scale',
  [PlanType.PS_GROWTH]: 'Seleção Growth',
  [PlanType.PS_PRO]: 'Seleção Pro',
  [PlanType.PS_MAX]: 'Seleção MAX'
};

// Cores dos planos para UI
export const PLAN_COLORS: Record<PlanType, { bg: string; border: string; text: string }> = {
  [PlanType.INDIVIDUAL]: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400'
  },
  [PlanType.TEAM]: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400'
  },
  [PlanType.BUSINESS]: {
    bg: 'bg-gradient-to-r from-purple-500/10 to-pink-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400'
  },
  [PlanType.ENTERPRISE]: {
    bg: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400'
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

// Função helper para verificar limite de créditos
export function checkCredits(plan: PlanType, usedCredits: number): {
  allowed: boolean;
  limit: number | null;
  remaining: number | null;
} {
  const limits = PLAN_CONFIGS[plan];
  const limit = limits.monthlyCredits;

  if (limit === null) {
    return { allowed: true, limit: null, remaining: null };
  }

  const remaining = limit - usedCredits;
  return {
    allowed: remaining > 0,
    limit,
    remaining: Math.max(0, remaining)
  };
}

// Função helper para verificar limite de vendedores
export function checkSellersLimit(plan: PlanType, currentSellers: number): {
  allowed: boolean;
  limit: number | null;
  remaining: number | null;
} {
  const limits = PLAN_CONFIGS[plan];
  const limit = limits.maxSellers;

  if (limit === null) {
    return { allowed: true, limit: null, remaining: null };
  }

  const remaining = limit - currentSellers;
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

// Função para formatar preço em BRL
export function formatPrice(price: number | null): string {
  if (price === null) return 'Personalizado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(price);
}

// Função para obter descrição do plano
export function getPlanDescription(plan: PlanType): string {
  const config = PLAN_CONFIGS[plan];

  if (config.isSelectionPlan) {
    return config.maxSelectionCandidates
      ? `Até ${config.maxSelectionCandidates} candidatos`
      : 'Candidatos ilimitados';
  }

  const parts: string[] = [];

  if (config.monthlyCredits) {
    parts.push(`${config.monthlyCredits} simulações/mês`);
  }

  if (config.maxSellers === 1) {
    parts.push('1 vendedor');
  } else if (config.maxSellers) {
    parts.push(`Até ${config.maxSellers} vendedores`);
  } else {
    parts.push('+50 vendedores');
  }

  return parts.join(' • ');
}
