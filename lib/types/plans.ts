// Tipos de Planos disponíveis
export enum PlanType {
  // Planos de Treinamento (créditos são consumidos por features)
  INDIVIDUAL = 'individual',   // R$129/mês - 20 créditos
  TEAM = 'team',               // R$1.999/mês - até 20 vendedores - 400 créditos
  BUSINESS = 'business',       // R$4.999/mês - 20 a 50 vendedores - 1.000 créditos
  ENTERPRISE = 'enterprise'    // +50 vendedores - créditos ilimitados
}

// Interface para definir as limitações de cada plano
export interface PlanLimits {
  // Limite de créditos por mês (consumidos por features)
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
  // Plano Individual - R$129/mês - 20 créditos
  [PlanType.INDIVIDUAL]: {
    monthlyCredits: 20,
    maxSellers: 1,
    priceMonthly: 129,
    extraCreditsPackages: [
      { credits: 10, price: 50 }
    ],
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

  // Plano Team - R$1.999/mês - até 20 vendedores - 400 créditos
  [PlanType.TEAM]: {
    monthlyCredits: 400,
    maxSellers: 20,
    priceMonthly: 1999,
    extraCreditsPackages: [
      { credits: 50, price: 250 }
    ],
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

  // Plano Business - R$4.999/mês - 20 a 50 vendedores - 1.000 créditos
  [PlanType.BUSINESS]: {
    monthlyCredits: 1000,
    maxSellers: 50,
    priceMonthly: 4999,
    extraCreditsPackages: [
      { credits: 50, price: 250 },
      { credits: 100, price: 450 }
    ],
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

  // Plano Enterprise - +50 vendedores - créditos ilimitados
  [PlanType.ENTERPRISE]: {
    monthlyCredits: null, // Ilimitado
    maxSellers: null, // Ilimitado
    priceMonthly: null, // Variável
    extraCreditsPackages: [], // Negociado
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
  }
};

// Nomes amigáveis dos planos
export const PLAN_NAMES: Record<PlanType, string> = {
  [PlanType.INDIVIDUAL]: 'Individual',
  [PlanType.TEAM]: 'Team',
  [PlanType.BUSINESS]: 'Business',
  [PlanType.ENTERPRISE]: 'Enterprise'
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
  const parts: string[] = [];

  if (config.monthlyCredits) {
    parts.push(`${config.monthlyCredits} créditos/mês`);
  } else {
    parts.push('Créditos ilimitados');
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
