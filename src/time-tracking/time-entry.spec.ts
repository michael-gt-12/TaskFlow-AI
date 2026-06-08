import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeEntryService } from './time-entry.service';
import { timeEntryRepository } from './time-entry.repository';
import { CacheService } from '../utils/cache';
import { prisma } from '../database/client';

vi.mock('./time-entry.repository', () => ({
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

vi.mock('../utils/cache', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../database/client', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
  },
}));

const repo = timeEntryRepository as any;

describe('TimeEntryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
  });

  describe('log', () => {
    it('records an entry against an existing task owned by the logger', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      repo.create.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'u1', minutes: 90 });

      const result = await TimeEntryService.log('u1', { taskId: 't1', minutes: 90 });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 't1', userId: 'u1', minutes: 90 })
      );
      expect(result.id).toBe('e1');
    });

    it('rejects logging against a missing task', async () => {
      (prisma.task.findFirst as any).mockResolvedValue(null);
      await expect(
        TimeEntryService.log('u1', { taskId: 'missing', minutes: 30 })
      ).rejects.toThrow(/task not found/i);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('invalidates the cached task summary after logging', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      repo.create.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'u1', minutes: 15 });
      await TimeEntryService.log('u1', { taskId: 't1', minutes: 15 });
      expect(CacheService.del).toHaveBeenCalledWith('time:task:t1');
    });
  });

  describe('update', () => {
    it("rejects editing another user's entry", async () => {
      repo.findById.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'owner' });
      await expect(
        TimeEntryService.update('e1', 'intruder', { minutes: 60 })
      ).rejects.toThrow(/your own time entries/i);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates an entry owned by the caller', async () => {
      repo.findById.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'u1' });
      repo.update.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'u1', minutes: 45 });
      const result = await TimeEntryService.update('e1', 'u1', { minutes: 45 });
      expect(repo.update).toHaveBeenCalledWith('e1', expect.objectContaining({ minutes: 45 }));
      expect(result.minutes).toBe(45);
    });
  });

  describe('remove', () => {
    it('throws when the entry does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(TimeEntryService.remove('missing', 'u1')).rejects.toThrow(/not found/i);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting another user's entry", async () => {
      repo.findById.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'owner' });
      await expect(TimeEntryService.remove('e1', 'intruder')).rejects.toThrow(/your own/i);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes an entry owned by the caller', async () => {
      repo.findById.mockResolvedValue({ id: 'e1', taskId: 't1', userId: 'u1' });
      await TimeEntryService.remove('e1', 'u1');
      expect(repo.delete).toHaveBeenCalledWith('e1');
    });
  });

  describe('getTaskSummary', () => {
    it('aggregates total and per-user minutes and converts hours', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      repo.totalMinutesForTask.mockResolvedValue(150);
      repo.minutesByUserForTask.mockResolvedValue([
        { userId: 'u1', minutes: 90 },
        { userId: 'u2', minutes: 60 },
      ]);

      const summary = await TimeEntryService.getTaskSummary('t1');

      expect(summary.totalMinutes).toBe(150);
      expect(summary.totalHours).toBe(2.5);
      expect(summary.byUser).toHaveLength(2);
      expect(CacheService.set).toHaveBeenCalled();
    });

    it('serves the cached summary when present', async () => {
      (CacheService.get as any).mockResolvedValue({
        taskId: 't1',
        totalMinutes: 10,
        totalHours: 0.17,
        byUser: [],
      });
      const summary = await TimeEntryService.getTaskSummary('t1');
      expect(summary.totalMinutes).toBe(10);
      expect(repo.totalMinutesForTask).not.toHaveBeenCalled();
    });
  });
});
