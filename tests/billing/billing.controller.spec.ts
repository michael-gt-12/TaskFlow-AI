import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/billing/billing.service', () => ({
  BillingService: {
    getSubscription: vi.fn(),
    getCheckoutUrl: vi.fn(),
    cancelSubscription: vi.fn(),
    handleStripeWebhook: vi.fn(),
  },
}));

vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/permission', () => ({ checkOrgPermission: () => (_req: any, _res: any, next: any) => next() }));

import { billingRouter } from '../../src/billing/billing.controller';
import { BillingService } from '../../src/billing/billing.service';

function handlerFor(method: string, path: string) {
  const layer = (billingRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`no route ${method} ${path}`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('billing.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /:orgId returns subscription info', async () => {
    const info = { tier: 'FREE', status: 'ACTIVE' };
    (BillingService.getSubscription as any).mockResolvedValue(info);
    const req: any = { params: { orgId: 'org1' } };
    const res = mockRes();
    await handlerFor('get', '/:orgId')(req, res, vi.fn());
    expect(BillingService.getSubscription).toHaveBeenCalledWith('org1');
    expect(res.json).toHaveBeenCalledWith(info);
  });

  it('POST /:orgId/checkout uses the requested tier', async () => {
    (BillingService.getCheckoutUrl as any).mockResolvedValue('https://pay/123');
    const req: any = { params: { orgId: 'org1' }, body: { tier: 'ENTERPRISE' } };
    const res = mockRes();
    await handlerFor('post', '/:orgId/checkout')(req, res, vi.fn());
    expect(BillingService.getCheckoutUrl).toHaveBeenCalledWith('org1', 'ENTERPRISE');
    expect(res.json).toHaveBeenCalledWith({ checkoutUrl: 'https://pay/123' });
  });

  it('POST /:orgId/checkout defaults to the PRO tier', async () => {
    (BillingService.getCheckoutUrl as any).mockResolvedValue('https://pay/pro');
    const req: any = { params: { orgId: 'org1' }, body: {} };
    const res = mockRes();
    await handlerFor('post', '/:orgId/checkout')(req, res, vi.fn());
    expect(BillingService.getCheckoutUrl).toHaveBeenCalledWith('org1', 'PRO');
  });

  it('POST /:orgId/cancel cancels the subscription', async () => {
    (BillingService.cancelSubscription as any).mockResolvedValue(undefined);
    const req: any = { params: { orgId: 'org1' } };
    const res = mockRes();
    await handlerFor('post', '/:orgId/cancel')(req, res, vi.fn());
    expect(BillingService.cancelSubscription).toHaveBeenCalledWith('org1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('POST /webhook acknowledges receipt', async () => {
    (BillingService.handleStripeWebhook as any).mockResolvedValue(undefined);
    const req: any = { body: { type: 'checkout.session.completed', data: {} } };
    const res = mockRes();
    await handlerFor('post', '/webhook')(req, res, vi.fn());
    expect(BillingService.handleStripeWebhook).toHaveBeenCalledWith(req.body);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('forwards checkout errors to next()', async () => {
    const boom = new Error('stripe down');
    (BillingService.getCheckoutUrl as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('post', '/:orgId/checkout')({ params: { orgId: 'o' }, body: {} }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards webhook errors to next()', async () => {
    const boom = new Error('bad event');
    (BillingService.handleStripeWebhook as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('post', '/webhook')({ body: {} }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
