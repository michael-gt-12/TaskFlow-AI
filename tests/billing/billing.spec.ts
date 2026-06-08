import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingService } from '../../src/billing/billing.service';
import { prisma } from '../../src/database/client';
import { CacheService } from '../../src/utils/cache';
import { StripeMockClient } from '../../src/billing/stripe.mock';

vi.mock('../../src/database/client', () => ({
  prisma: {
    orgBilling: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn()
    },
    project: {
      count: vi.fn(),
      findUnique: vi.fn()
    },
    orgMember: {
      count: vi.fn()
    },
    task: {
      count: vi.fn()
    },
    organization: {
      findUnique: vi.fn()
    }
  }
}));

describe('Billing & Subscriptions Module', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(CacheService, 'get').mockResolvedValue(null);
    vi.spyOn(CacheService, 'set').mockResolvedValue(undefined);
    vi.spyOn(CacheService, 'del').mockResolvedValue(undefined);
  });

  describe('getSubscription', () => {
    it('should return default FREE limits when no billing record exists', async () => {
      vi.mocked(prisma.orgBilling.findUnique).mockResolvedValue(null);

      const sub = await BillingService.getSubscription('org1');
      expect(sub.tier).toBe('FREE');
      expect(sub.limits.maxProjects).toBe(3);
      expect(sub.limits.maxMembers).toBe(5);
      expect(sub.limits.aiAssistantAllowed).toBe(false);
    });

    it('should return PRO limits when organization has active billing', async () => {
      vi.mocked(prisma.orgBilling.findUnique).mockResolvedValue({
        id: 'b1',
        organizationId: 'org1',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
        tier: 'PRO',
        status: 'ACTIVE',
        seats: 30,
        trialEndsAt: null,
        currentPeriodEnd: null,
        endsAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const sub = await BillingService.getSubscription('org1');
      expect(sub.tier).toBe('PRO');
      expect(sub.limits.maxProjects).toBe(15);
      expect(sub.limits.aiAssistantAllowed).toBe(true);
    });
  });

  describe('checkLimits', () => {
    it('should enforce project limits for FREE tier', async () => {
      vi.mocked(prisma.orgBilling.findUnique).mockResolvedValue(null); // FREE
      vi.mocked(prisma.project.count).mockResolvedValue(3); // At limit

      await expect(BillingService.checkProjectLimit('org1')).rejects.toThrow(
        /Project limit reached/
      );
    });

    it('should allow more projects for PRO tier', async () => {
      vi.mocked(prisma.orgBilling.findUnique).mockResolvedValue({ tier: 'PRO' } as any);
      vi.mocked(prisma.project.count).mockResolvedValue(3); // 3 projects is below PRO's 15 limit

      await expect(BillingService.checkProjectLimit('org1')).resolves.not.toThrow();
    });

    it('should enforce member limits for FREE tier', async () => {
      vi.mocked(prisma.orgBilling.findUnique).mockResolvedValue(null); // FREE
      vi.mocked(prisma.orgMember.count).mockResolvedValue(5); // At limit

      await expect(BillingService.checkMemberLimit('org1')).rejects.toThrow(
        /Member limit reached/
      );
    });

    it('should enforce task limits across all projects for FREE tier', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValue({ organizationId: 'org1' } as any);
      vi.mocked(prisma.orgBilling.findUnique).mockResolvedValue(null); // FREE
      vi.mocked(prisma.task.count).mockResolvedValue(25); // At limit

      await expect(BillingService.checkTaskLimit('proj1')).rejects.toThrow(
        /Task limit reached/
      );
    });
  });

  describe('handleStripeWebhook', () => {
    it('should upsert billing details on checkout session completed event', async () => {
      const event = StripeMockClient.generateWebhookPayload(
        'checkout.session.completed',
        'org1',
        'cus_stripe',
        'sub_stripe',
        'PRO'
      );

      await BillingService.handleStripeWebhook(event);

      expect(prisma.orgBilling.upsert).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        update: {
          stripeCustomerId: 'cus_stripe',
          stripeSubscriptionId: 'sub_stripe',
          tier: 'PRO',
          status: 'ACTIVE',
          endsAt: null
        },
        create: {
          organizationId: 'org1',
          stripeCustomerId: 'cus_stripe',
          stripeSubscriptionId: 'sub_stripe',
          tier: 'PRO',
          status: 'ACTIVE'
        }
      });
    });

    it('should downgrade to FREE on customer subscription deleted event', async () => {
      vi.mocked(prisma.orgBilling.findFirst).mockResolvedValue({
        organizationId: 'org1',
        stripeSubscriptionId: 'sub_stripe'
      } as any);

      const event = StripeMockClient.generateWebhookPayload(
        'customer.subscription.deleted',
        'org1',
        'cus_stripe',
        'sub_stripe'
      );

      await BillingService.handleStripeWebhook(event);

      expect(prisma.orgBilling.update).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        data: {
          tier: 'FREE',
          stripeSubscriptionId: null,
          status: 'EXPIRED',
          endsAt: expect.any(Date)
        }
      });
    });
  });
});
