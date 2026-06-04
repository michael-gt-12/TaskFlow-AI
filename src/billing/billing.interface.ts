export type OrgSubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface BillingTierLimits {
  maxProjects: number;
  maxMembers: number;
  maxTasks: number;
  aiAssistantAllowed: boolean;
  premiumAnalyticsAllowed: boolean;
  automationRulesAllowed: boolean;
}

export const TIER_LIMITS: Record<OrgSubscriptionTier, BillingTierLimits> = {
  FREE: {
    maxProjects: 3,
    maxMembers: 5,
    maxTasks: 25,
    aiAssistantAllowed: false,
    premiumAnalyticsAllowed: false,
    automationRulesAllowed: false
  },
  PRO: {
    maxProjects: 15,
    maxMembers: 30,
    maxTasks: 500,
    aiAssistantAllowed: true,
    premiumAnalyticsAllowed: true,
    automationRulesAllowed: true
  },
  ENTERPRISE: {
    maxProjects: 9999,
    maxMembers: 9999,
    maxTasks: 99999,
    aiAssistantAllowed: true,
    premiumAnalyticsAllowed: true,
    automationRulesAllowed: true
  }
};

export interface SubscriptionInfo {
  tier: OrgSubscriptionTier;
  status: string;
  endsAt: Date | null;
  limits: BillingTierLimits;
}
