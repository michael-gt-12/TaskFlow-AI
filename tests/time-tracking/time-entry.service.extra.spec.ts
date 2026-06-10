import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeEntryService } from '../../src/time-tracking/time-entry.service';
import { timeEntryRepository } from '../../src/time-tracking/time-entry.repository';
import { CacheService } from '../../src/utils/cache';
import { prisma } from '../../src/database/client';

vi.mock('../../src/time-tracking/time-entry.repository', () => ({
  timeEntryRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    totalMinutesForTask: vi.fn(),
    minutesByUserForTask: vi.fn(),
  },
  TimeEntryRepository: class {},
}));

vi.mock('../../src/utils/cache', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/database/client', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
  },
}));

const repo = timeEntryRepository as any;

describe('TimeEntryService (extra branches)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
  });

  describe('log', () => {
    it('parses a provided startedAt and trims description', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      repo.create.mockResolvedValue({ id: 'e1', taskId: 't1' });
      await TimeEntryService.log('u1', {
        taskId: 't1',
        minutes: 30,
        description: '  hello  ',
        startedAt: '2026-01-01T00:00:00.000Z',
      });
      const arg = repo.create.mock.calls[0][0];
      expect(arg.description).toBe('hello');
      expect(arg.startedAt).toBeInstanceOf(Date);
      expect((arg.startedAt as Date).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('stores null description when only whitespace is supplied', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      repo.create.mockResolvedValue({ id: 'e1' });
      await TimeEntryService.log('u1', { taskId: 't1', minutes: 30, description: '   ' });
      expect(repo.create.mock.calls[0][0].description).toBeNull();
    });

    it('throws BadRequestError on an invalid startedAt date', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      await expect(
        TimeEntryService.log('u1', { taskId: 't1', minutes: 30, startedAt: 'garbage' })
      ).rejects.toThrow(/invalid date/i);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('computes skip/take from page/pageSize and returns paginated meta', async () => {
      repo.list.mockResolvedValue({ items: [{ id: 'e1' }], total: 30 });
      const result = await TimeEntryService.list({ taskId: 't1', page: 2, pageSize: 10 });
      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 't1', skip: 10, take: 10 })
      );
      expect(result.data).toEqual([{ id: 'e1' }]);
      expect(result.meta).toEqual(expect.objectContaining({ page: 2, pageSize: 10, totalCount: 30 }));
    });
  });

  describe('update', () => {
    it('passes undefined through for description/startedAt when not supplied', async () => {
      repo.findById.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'u1' });
      repo.update.mockResolvedValue({ id: 'e1' });
      await TimeEntryService.update('e1', 'u1', { minutes: 20 });
      const arg = repo.update.mock.calls[0][1];
      expect(arg.description).toBeUndefined();
      expect(arg.startedAt).toBeUndefined();
    });

    it('sets description to null when an empty string is supplied', async () => {
      repo.findById.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'u1' });
      repo.update.mockResolvedValue({ id: 'e1' });
      await TimeEntryService.update('e1', 'u1', { description: '   ' });
      expect(repo.update.mock.calls[0][1].description).toBeNull();
    });

    it('parses a supplied startedAt string into a Date', async () => {
      repo.findById.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'u1' });
      repo.update.mockResolvedValue({ id: 'e1' });
      await TimeEntryService.update('e1', 'u1', { startedAt: '2026-02-02T00:00:00.000Z' });
      expect(repo.update.mock.calls[0][1].startedAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundError when the entry does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(TimeEntryService.update('missing', 'u1', { minutes: 10 })).rejects.toThrow(
        /not found/i
      );
    });

    it('invalidates the task summary cache after updating', async () => {
      repo.findById.mockResolvedValue({ id: 'e1', taskId: 't9', userId: 'u1' });
      repo.update.mockResolvedValue({ id: 'e1' });
      await TimeEntryService.update('e1', 'u1', { minutes: 5 });
      expect(CacheService.del).toHaveBeenCalledWith('time:task:t9');
    });
  });

  describe('remove', () => {
    it('invalidates the task summary cache after deleting', async () => {
      repo.findById.mockResolvedValue({ id: 'e1', taskId: 't5', userId: 'u1' });
      await TimeEntryService.remove('e1', 'u1');
      expect(CacheService.del).toHaveBeenCalledWith('time:task:t5');
    });
  });

  describe('getTaskSummary', () => {
    it('throws NotFoundError when the task is missing (and not cached)', async () => {
      (prisma.task.findFirst as any).mockResolvedValue(null);
      await expect(TimeEntryService.getTaskSummary('missing')).rejects.toThrow(/not found/i);
      expect(repo.totalMinutesForTask).not.toHaveBeenCalled();
    });

    it('rounds totalHours to two decimal places', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      repo.totalMinutesForTask.mockResolvedValue(100);
      repo.minutesByUserForTask.mockResolvedValue([]);
      const summary = await TimeEntryService.getTaskSummary('t1');
      // 100 / 60 = 1.666... -> rounded to 1.67
      expect(summary.totalHours).toBe(1.67);
      expect(summary.totalMinutes).toBe(100);
    });
  });
});
