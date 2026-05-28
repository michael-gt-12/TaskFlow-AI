import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockEmailProvider } from './email.provider';
import { MockWebhookProvider } from './webhook.provider';
import { MockIdentityProvider } from './identity.provider';
import { setupIntegrationListeners } from './integration.listener';
import { DomainEventPublisher } from '../shared/events';
import { prisma } from '../database/client';

vi.mock('../database/client', () => ({
  prisma: {
    task: {
      findUnique: vi.fn()
    }
  }
}));

describe('Integrations Abstractions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    MockEmailProvider.clearSent();
    MockWebhookProvider.clearSent();
    MockIdentityProvider.clearLinks();
  });

  describe('Mock Providers', () => {
    it('should send email and record it', async () => {
      const emailProvider = new MockEmailProvider();
      const success = await emailProvider.sendEmail({
        to: 'user@test.com',
        subject: 'Welcome',
        body: 'Welcome to TaskFlow AI!'
      });

      expect(success).toBe(true);
      const sent = MockEmailProvider.getSentEmails();
      expect(sent.length).toBe(1);
      expect(sent[0].to).toBe('user@test.com');
      expect(sent[0].subject).toBe('Welcome');
    });

    it('should dispatch webhook and record it', async () => {
      const webhookProvider = new MockWebhookProvider();
      const success = await webhookProvider.sendWebhook({
        url: 'https://test-endpoint.com/webhook',
        event: 'test.event',
        payload: { ok: true }
      });

      expect(success).toBe(true);
      const sent = MockWebhookProvider.getSentWebhooks();
      expect(sent.length).toBe(1);
      expect(sent[0].url).toBe('https://test-endpoint.com/webhook');
      expect(sent[0].event).toBe('test.event');
    });

    it('should link SSO identity and retrieve it', async () => {
      const identityProvider = new MockIdentityProvider();
      const success = await identityProvider.linkSSOUser('u1', 'sso123', 'google');

      expect(success).toBe(true);
      const link = MockIdentityProvider.getLink('u1');
      expect(link).toBeDefined();
      expect(link?.ssoId).toBe('sso123');
      expect(link?.providerName).toBe('google');
    });
  });

  describe('Event Listeners Integration', () => {
    it('should react to task.created event and dispatch notifications', async () => {
      const mockTask = {
        id: 't1',
        title: 'Build API',
        creator: { name: 'Alice', email: 'alice@test.com' },
        assignee: { name: 'Bob', email: 'bob@test.com' }
      };

      vi.mocked(prisma.task.findUnique).mockResolvedValue(mockTask as any);

      setupIntegrationListeners();

      DomainEventPublisher.publish('task.created', {
        taskId: 't1',
        taskTitle: 'Build API',
        orgId: 'o1',
        userId: 'u1'
      });

      // Wait for listeners to execute (250ms to ensure all mock async providers finish)
      await new Promise(r => setTimeout(r, 250));

      const sentEmails = MockEmailProvider.getSentEmails();
      expect(sentEmails.some(e => e.to === 'alice@test.com')).toBe(true);
      expect(sentEmails.some(e => e.to === 'bob@test.com')).toBe(true);

      const sentWebhooks = MockWebhookProvider.getSentWebhooks();
      expect(sentWebhooks.length).toBe(1);
      expect(sentWebhooks[0].event).toBe('task.created');
    });
  });
});
