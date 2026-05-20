import { WebhookProvider, WebhookPayload } from './integration.interface';
import { logger } from '../shared/logger';

export class MockWebhookProvider implements WebhookProvider {
  private static sentWebhooks: WebhookPayload[] = [];

  async sendWebhook(payload: WebhookPayload): Promise<boolean> {
    logger.info(`[Webhook Integration] Mock dispatching webhook event "${payload.event}" to URL ${payload.url}`);
    await new Promise(r => setTimeout(r, 50));
    MockWebhookProvider.sentWebhooks.push(payload);
    return true;
  }

  static getSentWebhooks() {
    return this.sentWebhooks;
  }

  static clearSent() {
    this.sentWebhooks = [];
  }
}
