import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from '../../src/tasks/task.service';
import { prisma } from '../../src/database/client';
import { DomainEventPublisher } from '../../src/shared/events';
import { CacheService } from '../../src/utils/cache';
import { BillingService } from '../../src/billing/billing.service';

// A transaction stub: $transaction simply invokes the callback with the same
// mocked prisma object so we can assert tx.task / tx.taskLabel calls.
vi.mock('../../src/database/client', () => {
  const prismaMock: any = {
    task: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    taskLabel: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((fn: any) => fn(prismaMock)),
  };
  return { prisma: prismaMock };
});

vi.mock('../../src/shared/events', () => ({
  DomainEventPublisher: {
    startTransaction: vi.fn(),
    publish: vi.fn(),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn(),
  },
}));

vi.mock('../../src/utils/cache', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/billing/billing.service', () => ({
  BillingService: { checkTaskLimit: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../src/shared/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const db = prisma as any;

describe('TaskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
    (DomainEventPublisher.commitTransaction as any).mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('checks the task limit, creates the task and commits the event', async () => {
      db.task.create.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'Task' });
      const result = await TaskService.create('u1', 'org1', { title: 'Task', projectId: 'p1' });

      expect(BillingService.checkTaskLimit).toHaveBeenCalledWith('p1');
      expect(DomainEventPublisher.startTransaction).toHaveBeenCalled();
      // defaults applied
      const createArg = db.task.create.mock.calls[0][0].data;
      expect(createArg).toMatchObject({
        title: 'Task',
        description: '',
        projectId: 'p1',
        status: 'TODO',
        priority: 'MEDIUM',
        dueDate: null,
        creatorId: 'u1',
        assigneeId: null,
      });
      expect(db.taskLabel.createMany).not.toHaveBeenCalled();
      expect(DomainEventPublisher.publish).toHaveBeenCalledWith(
        'task.created',
        expect.objectContaining({ taskId: 't1', projectId: 'p1', orgId: 'org1', userId: 'u1' })
      );
      expect(DomainEventPublisher.commitTransaction).toHaveBeenCalled();
      expect(CacheService.delPattern).toHaveBeenCalledWith('tasks:project:p1:*');
      expect(result).toEqual({ id: 't1', projectId: 'p1', title: 'Task' });
    });

    it('honours supplied status/priority/dueDate/assignee and creates labels', async () => {
      db.task.create.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'Task' });
      await TaskService.create('u1', 'org1', {
        title: 'Task',
        description: 'd',
        projectId: 'p1',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: '2026-01-01T00:00:00.000Z',
        assigneeId: 'a1',
        labelIds: ['l1', 'l2'],
      });
      const createArg = db.task.create.mock.calls[0][0].data;
      expect(createArg.status).toBe('IN_PROGRESS');
      expect(createArg.priority).toBe('HIGH');
      expect(createArg.dueDate).toBeInstanceOf(Date);
      expect(createArg.assigneeId).toBe('a1');
      expect(db.taskLabel.createMany).toHaveBeenCalledWith({
        data: [
          { taskId: 't1', labelId: 'l1' },
          { taskId: 't1', labelId: 'l2' },
        ],
      });
    });

    it('does not create labels when labelIds is empty', async () => {
      db.task.create.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'Task' });
      await TaskService.create('u1', 'org1', { title: 'Task', projectId: 'p1', labelIds: [] });
      expect(db.taskLabel.createMany).not.toHaveBeenCalled();
    });

    it('rolls back the event transaction and rethrows when create fails', async () => {
      const boom = new Error('db down');
      db.task.create.mockRejectedValue(boom);
      await expect(
        TaskService.create('u1', 'org1', { title: 'Task', projectId: 'p1' })
      ).rejects.toThrow('db down');
      expect(DomainEventPublisher.rollbackTransaction).toHaveBeenCalled();
      expect(DomainEventPublisher.commitTransaction).not.toHaveBeenCalled();
    });

    it('propagates a billing limit error before starting a transaction', async () => {
      (BillingService.checkTaskLimit as any).mockRejectedValueOnce(new Error('limit reached'));
      await expect(
        TaskService.create('u1', 'org1', { title: 'Task', projectId: 'p1' })
      ).rejects.toThrow('limit reached');
      expect(DomainEventPublisher.startTransaction).not.toHaveBeenCalled();
    });

    it('PINS BUG: commit runs outside the prisma transaction; a listener error after commit still rethrows even though the task was persisted', async () => {
      // The task.create resolves (committed), but commitTransaction throws — the
      // method rolls back the (already-empty) event queue and rethrows, surfacing
      // an error to the caller despite the row being committed. We pin this actual
      // behaviour rather than "fixing" it.
      db.task.create.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'Task' });
      (DomainEventPublisher.commitTransaction as any).mockRejectedValueOnce(new Error('listener boom'));
      await expect(
        TaskService.create('u1', 'org1', { title: 'Task', projectId: 'p1' })
      ).rejects.toThrow('listener boom');
      expect(DomainEventPublisher.rollbackTransaction).toHaveBeenCalled();
      // delPattern is never reached because commit threw first
      expect(CacheService.delPattern).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns the cached task without hitting the database', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 't1', title: 'Cached' });
      const result = await TaskService.getById('t1');
      expect(result).toEqual({ id: 't1', title: 'Cached' });
      expect(db.task.findUnique).not.toHaveBeenCalled();
    });

    it('loads from the database, caches and returns the task', async () => {
      const task = { id: 't1', title: 'Task', status: 'TODO' };
      db.task.findUnique.mockResolvedValue(task);
      const result = await TaskService.getById('t1');
      expect(db.task.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't1' } })
      );
      expect(CacheService.set).toHaveBeenCalledWith('task:t1', task, 300);
      expect(result).toEqual(task);
    });

    it('throws NotFoundError when the task is missing', async () => {
      db.task.findUnique.mockResolvedValue(null);
      await expect(TaskService.getById('missing')).rejects.toThrow(/not found/i);
      expect(CacheService.set).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates fields, publishes task.updated and invalidates caches', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 't1', status: 'TODO', projectId: 'p1' });
      db.task.update.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'New', status: 'TODO' });

      const result = await TaskService.update('t1', 'u1', 'org1', { title: 'New' });

      expect(db.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't1' }, data: expect.objectContaining({ title: 'New' }) })
      );
      // no status change event since status not supplied
      expect(DomainEventPublisher.publish).not.toHaveBeenCalledWith('task.status_changed', expect.anything());
      expect(DomainEventPublisher.publish).toHaveBeenCalledWith('task.updated', expect.objectContaining({ taskId: 't1' }));
      expect(DomainEventPublisher.commitTransaction).toHaveBeenCalled();
      expect(CacheService.del).toHaveBeenCalledWith('task:t1');
      expect(CacheService.delPattern).toHaveBeenCalledWith('tasks:project:p1:*');
      expect(result.title).toBe('New');
    });

    it('publishes task.status_changed when the status actually changes', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 't1', status: 'TODO', projectId: 'p1' });
      db.task.update.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'T', status: 'DONE' });

      await TaskService.update('t1', 'u1', 'org1', { status: 'DONE' });

      expect(DomainEventPublisher.publish).toHaveBeenCalledWith(
        'task.status_changed',
        expect.objectContaining({ oldStatus: 'TODO', newStatus: 'DONE' })
      );
    });

    it('does not emit status_changed when the new status equals the old one', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 't1', status: 'DONE', projectId: 'p1' });
      db.task.update.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'T', status: 'DONE' });
      await TaskService.update('t1', 'u1', 'org1', { status: 'DONE' });
      expect(DomainEventPublisher.publish).not.toHaveBeenCalledWith('task.status_changed', expect.anything());
    });

    it('converts a supplied dueDate string to a Date', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 't1', status: 'TODO', projectId: 'p1' });
      db.task.update.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'T', status: 'TODO' });
      await TaskService.update('t1', 'u1', 'org1', { dueDate: '2026-05-01T00:00:00.000Z' });
      expect(db.task.update.mock.calls[0][0].data.dueDate).toBeInstanceOf(Date);
    });

    it('clears dueDate to null when explicitly set to null', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 't1', status: 'TODO', projectId: 'p1' });
      db.task.update.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'T', status: 'TODO' });
      await TaskService.update('t1', 'u1', 'org1', { dueDate: null });
      expect(db.task.update.mock.calls[0][0].data.dueDate).toBeNull();
    });

    it('replaces labels: deletes existing and creates the new set', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 't1', status: 'TODO', projectId: 'p1' });
      db.task.update.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'T', status: 'TODO' });
      await TaskService.update('t1', 'u1', 'org1', { labelIds: ['l1'] });
      expect(db.taskLabel.deleteMany).toHaveBeenCalledWith({ where: { taskId: 't1' } });
      expect(db.taskLabel.createMany).toHaveBeenCalledWith({ data: [{ taskId: 't1', labelId: 'l1' }] });
    });

    it('clears all labels when labelIds is an empty array', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 't1', status: 'TODO', projectId: 'p1' });
      db.task.update.mockResolvedValue({ id: 't1', projectId: 'p1', title: 'T', status: 'TODO' });
      await TaskService.update('t1', 'u1', 'org1', { labelIds: [] });
      expect(db.taskLabel.deleteMany).toHaveBeenCalledWith({ where: { taskId: 't1' } });
      expect(db.taskLabel.createMany).not.toHaveBeenCalled();
    });

    it('rolls back and rethrows when the task to update is not found', async () => {
      // getById will throw NotFoundError (uncached + null lookup)
      (CacheService.get as any).mockResolvedValue(null);
      db.task.findUnique.mockResolvedValue(null);
      await expect(TaskService.update('missing', 'u1', 'org1', { title: 'X' })).rejects.toThrow(/not found/i);
      expect(DomainEventPublisher.rollbackTransaction).toHaveBeenCalled();
      expect(DomainEventPublisher.commitTransaction).not.toHaveBeenCalled();
    });

    it('rolls back and rethrows when the update query fails', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 't1', status: 'TODO', projectId: 'p1' });
      db.task.update.mockRejectedValue(new Error('write failed'));
      await expect(TaskService.update('t1', 'u1', 'org1', { title: 'X' })).rejects.toThrow('write failed');
      expect(DomainEventPublisher.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
