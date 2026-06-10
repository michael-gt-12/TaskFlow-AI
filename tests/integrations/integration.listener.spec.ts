import { describe, it, expect, beforeEach, vi } from 'vitest';

const { sendEmail, sendWebhook } = vi.hoisted(() => ({ sendEmail: vi.fn(), sendWebhook: vi.fn() }));

vi.mock('../../src/integrations/email.provider', () => ({
  MockEmailProvider: class {
    sendEmail = sendEmail;
  },
}));

vi.mock('../../src/integrations/webhook.provider', () => ({
  MockWebhookProvider: class {
    sendWebhook = sendWebhook;
  },
}));

vi.mock('../../src/database/client', () => ({
  prisma: { task: { findUnique: vi.fn() } },
}));

import { DomainEventPublisher } from '../../src/shared/events';
import { setupIntegrationListeners } from '../../src/integrations/integration.listener';
import { prisma } from '../../src/database/client';

const handlers = new Map<string, Array<(e: any) => any>>();

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  vi.spyOn(DomainEventPublisher, 'subscribe').mockImplementation((name: string, fn: any) => {
    const list = handlers.get(name) ?? [];
    list.push(fn);
    handlers.set(name, list);
  });
  setupIntegrationListeners();
});

const fire = (name: string, payload: any) =>
  Promise.all((handlers.get(name) ?? []).map((fn) => fn({ name, timestamp: new Date(), payload })));

describe('integration.listener', () => {
  describe('task.created', () => {
    it('emails creator + assignee and posts a webhook', async () => {
      (prisma.task.findUnique as any).mockResolvedValue({
        id: 't1',
        creator: { email: 'c@b.com', name: 'Creator' },
        assignee: { email: 'a@b.com', name: 'Assignee' },
      });
      await fire('task.created', { taskId: 't1', taskTitle: 'X' });
      expect(sendEmail).toHaveBeenCalledTimes(2);
      expect(sendWebhook).toHaveBeenCalledWith(expect.objectContaining({ event: 'task.created' }));
    });

    it('emails only the creator when there is no assignee', async () => {
      (prisma.task.findUnique as any).mockResolvedValue({
        id: 't1',
        creator: { email: 'c@b.com', name: 'Creator' },
        assignee: null,
      });
      await fire('task.created', { taskId: 't1', taskTitle: 'X' });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendWebhook).toHaveBeenCalledTimes(1);
    });

    it('still posts a webhook when the task is missing', async () => {
      (prisma.task.findUnique as any).mockResolvedValue(null);
      await fire('task.created', { taskId: 't1', taskTitle: 'X' });
      expect(sendEmail).not.toHaveBeenCalled();
      expect(sendWebhook).toHaveBeenCalledTimes(1);
    });

    it('swallows provider errors', async () => {
      (prisma.task.findUnique as any).mockRejectedValue(new Error('db down'));
      await expect(fire('task.created', { taskId: 't1', taskTitle: 'X' })).resolves.toBeDefined();
    });
  });

  describe('task.status_changed', () => {
    it('emails the assignee and posts a webhook', async () => {
      (prisma.task.findUnique as any).mockResolvedValue({
        id: 't1',
        creator: { email: 'c@b.com', name: 'Creator' },
        assignee: { email: 'a@b.com', name: 'Assignee' },
      });
      await fire('task.status_changed', { taskId: 't1', taskTitle: 'X', oldStatus: 'TODO', newStatus: 'DONE' });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendWebhook).toHaveBeenCalledWith(expect.objectContaining({ event: 'task.status_changed' }));
    });
  });

  describe('task.updated', () => {
    it('posts a webhook only', async () => {
      await fire('task.updated', { taskId: 't1' });
      expect(sendEmail).not.toHaveBeenCalled();
      expect(sendWebhook).toHaveBeenCalledWith(expect.objectContaining({ event: 'task.updated' }));
    });
  });
});
