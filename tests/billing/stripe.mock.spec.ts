import { describe, it, expect } from 'vitest';
import { StripeMockClient } from '../../src/billing/stripe.mock';

describe('StripeMockClient', () => {
  it('creates a checkout session referencing the org and tier', async () => {
    const session = await StripeMockClient.createCheckoutSession(
      'org1',
      'PRO',
      'http://ok',
      'http://cancel'
    );
    expect(session.clientReferenceId).toBe('org1');
    expect(session.url).toContain('checkout.stripe.com');
    expect(session.id).toMatch(/^cs_live_/);
    expect(session.customerId).toMatch(/^cus_/);
    expect(session.subscriptionId).toMatch(/^sub_/);
  });

  it('cancels a subscription and returns true', async () => {
    await expect(StripeMockClient.cancelSubscription('sub_1')).resolves.toBe(true);
  });

  it('generates a checkout.session.completed webhook payload', () => {
    const payload = StripeMockClient.generateWebhookPayload(
      'checkout.session.completed',
      'org1',
      'cus_1',
      'sub_1',
      'PRO'
    );
    expect(payload.type).toBe('checkout.session.completed');
    expect(payload.data.object.client_reference_id).toBe('org1');
    expect(payload.data.object.metadata.tier).toBe('PRO');
    expect(payload.id).toMatch(/^evt_/);
  });

  it('defaults the tier to PRO when omitted', () => {
    const payload = StripeMockClient.generateWebhookPayload(
      'customer.subscription.deleted',
      'org1',
      'cus_1',
      'sub_1'
    );
    expect(payload.data.object.metadata.tier).toBe('PRO');
    expect(payload.type).toBe('customer.subscription.deleted');
  });
});
