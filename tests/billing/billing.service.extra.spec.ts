import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingService } from '../../src/billing/billing.service';
import { prisma } from '../../src/database/client';
import { CacheService } from '../../src/utils/cache';
import { StripeMockClient } from '../../src/billing/stripe.mock';

vi.mock('../../src/database/client', () => ({
  prisma: {
    orgBilling: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    organization: { findUnique: vi.fn() },
    project: { count: vi.fn(), findUnique: vi.fn() },
    orgMember: { count: vi.fn() },
    task: { count: vi.fn() },
  },
}));

vi.mock('../../src/utils/cache', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/billing/stripe.mock', () => ({
  StripeMockClient: {
    createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://checkout/abc' }),
    cancelSubscription: vi.fn().mockResolvedValue(true),
  },
}));

describe('BillingService (extra branches)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
  });

  describe('getSubscription', () => {
    it('returns the cached subscription without a db lookup', async () => {
      (CacheService.get as any).mockResolvedValue({ tier: 'PRO', status: 'ACTIVE', limits: {} });
      const info = await BillingService.getSubscription('org1');
      expect(info.tier).toBe('PRO');
      expect(prisma.orgBilling.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to FREE defaults when no billing row exists', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue(null);
      const info = await BillingService.getSubscription('org1');
      expect(info.tier).toBe('FREE');
      expect(CacheService.set).toHaveBeenCalled();
    });

    it('uses the stored tier when billing exists', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue({ tier: 'PRO', status: 'ACTIVE', endsAt: null });
      const info = await BillingService.getSubscription('org1');
      expect(info.tier).toBe('PRO');
    });
  });

  describe('getCheckoutUrl', () => {
    it('throws NotFound when the organization is missing', async () => {
      (prisma.organization.findUnique as any).mockResolvedValue(null);
      await expect(BillingService.getCheckoutUrl('org1', 'PRO' as any)).rejects.toThrow(/not found/i);
    });

    it('returns the stripe session url', async () => {
      (prisma.organization.findUnique as any).mockResolvedValue({ id: 'org1' });
      const url = await BillingService.getCheckoutUrl('org1', 'PRO' as any);
      expect(url).toBe('https://checkout/abc');
      expect(StripeMockClient.createCheckoutSession).toHaveBeenCalled();
    });
  });

  describe('cancelSubscription', () => {
    it('throws when there is no active paid subscription', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue({ stripeSubscriptionId: null });
      await expect(BillingService.cancelSubscription('org1')).rejects.toThrow(/no active paid/i);
    });

    it('cancels with Stripe and downgrades to FREE', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue({ stripeSubscriptionId: 'sub_1' });
      (prisma.orgBilling.update as any).mockResolvedValue({});
      await BillingService.cancelSubscription('org1');
      expect(StripeMockClient.cancelSubscription).toHaveBeenCalledWith('sub_1');
      expect(prisma.orgBilling.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tier: 'FREE', status: 'CANCELLED' }) })
      );
      expect(CacheService.del).toHaveBeenCalled();
    });
  });

  describe('handleStripeWebhook', () => {
    it('upserts billing on checkout.session.completed', async () => {
      (prisma.orgBilling.upsert as any).mockResolvedValue({});
      await BillingService.handleStripeWebhook({
        type: 'checkout.session.completed',
        data: { object: { client_reference_id: 'org1', customer: 'cus_1', subscription: 'sub_1', metadata: { tier: 'PRO' } } },
      });
      expect(prisma.orgBilling.upsert).toHaveBeenCalled();
      expect(CacheService.del).toHaveBeenCalledWith('billing:org:org1');
    });

    it('downgrades on customer.subscription.deleted when billing is found', async () => {
      (prisma.orgBilling.findFirst as any).mockResolvedValue({ organizationId: 'org1' });
      (prisma.orgBilling.update as any).mockResolvedValue({});
      await BillingService.handleStripeWebhook({
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1' } },
      });
      expect(prisma.orgBilling.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED' }) })
      );
    });

    it('is a no-op on customer.subscription.deleted when no billing matches', async () => {
      (prisma.orgBilling.findFirst as any).mockResolvedValue(null);
      await BillingService.handleStripeWebhook({
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_unknown' } },
      });
      expect(prisma.orgBilling.update).not.toHaveBeenCalled();
    });

    it('ignores unrecognised event types', async () => {
      await BillingService.handleStripeWebhook({ type: 'invoice.paid', data: { object: {} } });
      expect(prisma.orgBilling.upsert).not.toHaveBeenCalled();
      expect(prisma.orgBilling.update).not.toHaveBeenCalled();
    });
  });

  describe('limit gates', () => {
    it('checkProjectLimit throws when at the tier cap', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue(null); // FREE
      (prisma.project.count as any).mockResolvedValue(999);
      await expect(BillingService.checkProjectLimit('org1')).rejects.toThrow(/project limit reached/i);
    });

    it('checkProjectLimit passes when under the cap', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue(null);
      (prisma.project.count as any).mockResolvedValue(0);
      await expect(BillingService.checkProjectLimit('org1')).resolves.toBeUndefined();
    });

    it('checkMemberLimit throws when at the cap', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue(null);
      (prisma.orgMember.count as any).mockResolvedValue(999);
      await expect(BillingService.checkMemberLimit('org1')).rejects.toThrow(/member limit reached/i);
    });

    it('checkTaskLimit throws NotFound when the project is missing', async () => {
      (prisma.project.findUnique as any).mockResolvedValue(null);
      await expect(BillingService.checkTaskLimit('p1')).rejects.toThrow(/not found/i);
    });

    it('checkTaskLimit throws when the org is at the task cap', async () => {
      (prisma.project.findUnique as any).mockResolvedValue({ organizationId: 'org1' });
      (prisma.orgBilling.findUnique as any).mockResolvedValue(null);
      (prisma.task.count as any).mockResolvedValue(99999);
      await expect(BillingService.checkTaskLimit('p1')).rejects.toThrow(/task limit reached/i);
    });

    it('checkAiAccess throws on a tier without AI', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue(null); // FREE
      await expect(BillingService.checkAiAccess('org1')).rejects.toThrow(/AI features/i);
    });

    it('checkAiAccess passes on a tier with AI', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue({ tier: 'PRO', status: 'ACTIVE' });
      await expect(BillingService.checkAiAccess('org1')).resolves.toBeUndefined();
    });

    it('checkAutomationAccess throws on a tier without automation', async () => {
      (prisma.orgBilling.findUnique as any).mockResolvedValue(null);
      await expect(BillingService.checkAutomationAccess('org1')).rejects.toThrow(/Automation/i);
    });
  });
});
