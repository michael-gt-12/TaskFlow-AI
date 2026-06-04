import { logger } from '../shared/logger';

export interface StripeCheckoutSession {
  id: string;
  url: string;
  customerId: string;
  subscriptionId: string;
  clientReferenceId: string;
}

export class StripeMockClient {
  static async createCheckoutSession(
    orgId: string,
    tier: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<StripeCheckoutSession> {
    logger.info(`[Stripe Mock] Creating checkout session for organization ${orgId} to upgrade to ${tier}`);
    
    // Simulate API roundtrip delay
    await new Promise(r => setTimeout(r, 100));

    const sessionId = `cs_live_${Math.random().toString(36).substring(7)}`;
    const customerId = `cus_${Math.random().toString(36).substring(7)}`;
    const subscriptionId = `sub_${Math.random().toString(36).substring(7)}`;

    return {
      id: sessionId,
      url: `https://checkout.stripe.com/pay/${sessionId}`,
      customerId,
      subscriptionId,
      clientReferenceId: orgId
    };
  }

  static async cancelSubscription(subscriptionId: string): Promise<boolean> {
    logger.info(`[Stripe Mock] Cancelling subscription: ${subscriptionId}`);
    await new Promise(r => setTimeout(r, 50));
    return true;
  }

  static generateWebhookPayload(
    type: 'checkout.session.completed' | 'customer.subscription.deleted',
    orgId: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    tier = 'PRO'
  ) {
    return {
      id: `evt_${Math.random().toString(36).substring(7)}`,
      type,
      data: {
        object: {
          client_reference_id: orgId,
          customer: stripeCustomerId,
          subscription: stripeSubscriptionId,
          metadata: {
            tier
          }
        }
      }
    };
  }
}
