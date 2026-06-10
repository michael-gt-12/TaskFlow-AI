import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/notifications/notification.service', () => ({
  NotificationService: { send: vi.fn() },
}));

vi.mock('../../src/database/client', () => ({
  prisma: { task: { findUnique: vi.fn() } },
}));

import { DomainEventPublisher, DomainEvent } from '../../src/shared/events';
import { setupNotificationListeners } from '../../src/notifications/notification.listener';
import { NotificationService } from '../../src/notifications/notification.service';
import { prisma } from '../../src/database/client';

const handlers = new Map<string, Array<(e: DomainEvent) => any>>();

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  vi.spyOn(DomainEventPublisher, 'subscribe').mockImplementation((name: string, fn: any) => {
    const list = handlers.get(name) ?? [];
    list.push(fn);
    handlers.set(name, list);
  });
  setupNotificationListeners();
});

const fire = (name: string, payload: any) =>
  Promise.all((handlers.get(name) ?? []).map((fn) => fn({ name, timestamp: new Date(), payload } as DomainEvent)));

describe('notification.listener', () => {
  describe('task.created', () => {
    it('notifies the assignee when one is set', async () => {
      (prisma.task.findUnique as any).mockResolvedValue({
        id: 't1', assigneeId: 'u2', project: { name: 'Proj' },
      });
      await fire('task.created', { taskId: 't1', projectId: 'p1', taskTitle: 'X' });
      expect(NotificationService.send).toHaveBeenCalledWith(
        'u2', 'New Task Assigned', expect.stringContaining('X')
      );
    });

    it('does nothing when the task has no assignee', async () => {
      (prisma.task.findUnique as any).mockResolvedValue({ id: 't1', assigneeId: null, project: { name: 'P' } });
      await fire('task.created', { taskId: 't1', projectId: 'p1', taskTitle: 'X' });
      expect(NotificationService.send).not.toHaveBeenCalled();
    });

    it('does nothing when the task is missing', async () => {
      (prisma.task.findUnique as any).mockResolvedValue(null);
      await fire('task.created', { taskId: 't1', projectId: 'p1', taskTitle: 'X' });
      expect(NotificationService.send).not.toHaveBeenCalled();
    });
  });

  describe('task.status_changed', () => {
    it('notifies the creator when they differ from the assignee', async () => {
      (prisma.task.findUnique as any).mockResolvedValue({ id: 't1', creatorId: 'u1', assigneeId: 'u2' });
      await fire('task.status_changed', { taskId: 't1', newStatus: 'DONE', taskTitle: 'X' });
      expect(NotificationService.send).toHaveBeenCalledWith(
        'u1', 'Task Status Updated', expect.stringContaining('DONE')
      );
    });

    it('does not notify when the creator is also the assignee', async () => {
      (prisma.task.findUnique as any).mockResolvedValue({ id: 't1', creatorId: 'u1', assigneeId: 'u1' });
      await fire('task.status_changed', { taskId: 't1', newStatus: 'DONE', taskTitle: 'X' });
      expect(NotificationService.send).not.toHaveBeenCalled();
    });
  });
});
