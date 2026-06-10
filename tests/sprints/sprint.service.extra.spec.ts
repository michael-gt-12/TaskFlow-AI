import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SprintService } from '../../src/sprints/sprint.service';
import { sprintRepository } from '../../src/sprints/sprint.repository';
import { CacheService } from '../../src/utils/cache';
import { prisma } from '../../src/database/client';

vi.mock('../../src/sprints/sprint.repository', () => ({
  sprintRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findActive: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    countTasksByStatus: vi.fn(),
    sumStoryPoints: vi.fn(),
    moveUnfinishedTasks: vi.fn(),
    assignTask: vi.fn(),
    removeTask: vi.fn(),
  },
  SprintRepository: class {},
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
    project: { findFirst: vi.fn() },
    task: { findFirst: vi.fn() },
  },
}));

vi.mock('../../src/shared/unit-of-work', () => ({
  UnitOfWork: {
    execute: vi.fn(async (work: any) =>
      work({ project: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org1' }) } })
    ),
  },
}));

const repo = sprintRepository as any;

describe('SprintService (extra)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
  });

  describe('create', () => {
    it('trims name/goal and normalises an undefined window to nulls', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', organizationId: 'org1' });
      repo.create.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'PLANNED' });

      await SprintService.create('u1', { projectId: 'p1', name: '  Sprint  ', goal: '  go  ' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Sprint', goal: 'go', startDate: null, endDate: null })
      );
    });

    it('coerces an empty/whitespace goal to null', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', organizationId: 'org1' });
      repo.create.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'PLANNED' });
      await SprintService.create('u1', { projectId: 'p1', name: 'Sprint', goal: '   ' });
      expect(repo.create.mock.calls[0][0].goal).toBeNull();
    });

    it('rejects an invalid date value', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', organizationId: 'org1' });
      await expect(
        SprintService.create('u1', { projectId: 'p1', name: 'Sprint', startDate: 'not-a-date' })
      ).rejects.toThrow(/invalid date/i);
    });
  });

  describe('getById', () => {
    it('returns the cached sprint without hitting the repo', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 's1', status: 'PLANNED' });
      const result = await SprintService.getById('s1');
      expect(result).toEqual({ id: 's1', status: 'PLANNED' });
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('loads from the repo and caches on a miss', async () => {
      repo.findById.mockResolvedValue({ id: 's1', status: 'PLANNED' });
      const result = await SprintService.getById('s1');
      expect(result.id).toBe('s1');
      expect(CacheService.set).toHaveBeenCalled();
    });

    it('throws NotFound when the sprint does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(SprintService.getById('missing')).rejects.toThrow(/not found/i);
    });
  });

  describe('list', () => {
    it('computes skip/take and wraps the result with offset meta', async () => {
      repo.list.mockResolvedValue({ items: [{ id: 's1' }], total: 1 });
      const result = await SprintService.list('p1', { page: 2, pageSize: 10 });
      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'p1', skip: 10, take: 10 })
      );
      expect(result.data).toEqual([{ id: 's1' }]);
      expect(result.meta).toBeDefined();
    });
  });

  describe('getSummary', () => {
    it('aggregates task counts and story points', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      repo.countTasksByStatus.mockResolvedValue({ DONE: 2, TODO: 3 });
      repo.sumStoryPoints.mockResolvedValue({ total: 8, completed: 4 });

      const { stats } = await SprintService.getSummary('s1');
      expect(stats.totalTasks).toBe(5);
      expect(stats.completedTasks).toBe(2);
      expect(stats.storyPoints).toEqual({ total: 8, completed: 4 });
    });
  });

  describe('update', () => {
    it('refuses to edit a COMPLETED sprint', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'COMPLETED' });
      await expect(SprintService.update('s1', { name: 'X' })).rejects.toThrow(/no longer be edited/i);
    });

    it('refuses to edit a CANCELLED sprint', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'CANCELLED' });
      await expect(SprintService.update('s1', { name: 'X' })).rejects.toThrow(/no longer be edited/i);
    });

    it('rejects a start date after the end date', async () => {
      repo.findById.mockResolvedValue({
        id: 's1',
        projectId: 'p1',
        status: 'PLANNED',
        startDate: null,
        endDate: null,
      });
      await expect(
        SprintService.update('s1', {
          startDate: '2026-02-01T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
        })
      ).rejects.toThrow(/on or before/i);
    });

    it('updates fields and keeps undefined dates untouched', async () => {
      repo.findById.mockResolvedValue({
        id: 's1',
        projectId: 'p1',
        status: 'PLANNED',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-01-14T00:00:00.000Z'),
      });
      repo.update.mockResolvedValue({ id: 's1', projectId: 'p1', name: 'New', status: 'PLANNED' });

      await SprintService.update('s1', { name: '  New  ', goal: null });
      const data = repo.update.mock.calls[0][1];
      expect(data.name).toBe('New');
      expect(data.goal).toBeNull();
      expect(data.startDate).toBeUndefined();
      expect(data.endDate).toBeUndefined();
    });

    it('parses explicit new dates', async () => {
      repo.findById.mockResolvedValue({
        id: 's1',
        projectId: 'p1',
        status: 'PLANNED',
        startDate: null,
        endDate: null,
      });
      repo.update.mockResolvedValue({ id: 's1', projectId: 'p1', name: 'X', status: 'PLANNED' });
      await SprintService.update('s1', {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-14T00:00:00.000Z',
      });
      const data = repo.update.mock.calls[0][1];
      expect(data.startDate).toBeInstanceOf(Date);
      expect(data.endDate).toBeInstanceOf(Date);
    });
  });

  describe('start', () => {
    it('keeps an existing startDate rather than stamping now', async () => {
      const existingStart = new Date('2026-01-01T00:00:00.000Z');
      repo.findById.mockResolvedValue({
        id: 's1',
        projectId: 'p1',
        status: 'PLANNED',
        startDate: existingStart,
      });
      repo.findActive.mockResolvedValue(null);
      repo.update.mockResolvedValue({ id: 's1', projectId: 'p1', name: 'S1', status: 'ACTIVE' });

      await SprintService.start('s1', 'u1');
      expect(repo.update.mock.calls[0][1].startDate).toBe(existingStart);
    });
  });

  describe('complete', () => {
    it('rolls unfinished tasks over into a valid target sprint', async () => {
      repo.findById
        .mockResolvedValueOnce({ id: 's1', projectId: 'p1', status: 'ACTIVE' }) // getById
        .mockResolvedValueOnce({ id: 's2', projectId: 'p1', status: 'PLANNED' }); // target lookup
      repo.countTasksByStatus.mockResolvedValue({ DONE: 1, TODO: 1 });
      repo.moveUnfinishedTasks.mockResolvedValue(1);
      repo.update.mockResolvedValue({ id: 's1', projectId: 'p1', name: 'S1', status: 'COMPLETED' });

      const result = await SprintService.complete('s1', 'u1', 's2');
      expect(repo.moveUnfinishedTasks).toHaveBeenCalledWith('s1', 's2', expect.anything());
      expect(CacheService.del).toHaveBeenCalled();
      expect(result.status).toBe('COMPLETED');
    });

    it('rejects rolling tasks into a missing target sprint', async () => {
      repo.findById
        .mockResolvedValueOnce({ id: 's1', projectId: 'p1', status: 'ACTIVE' })
        .mockResolvedValueOnce(null);
      await expect(SprintService.complete('s1', 'u1', 's2')).rejects.toThrow(/same project/i);
    });

    it('rejects rolling tasks into a closed target sprint', async () => {
      repo.findById
        .mockResolvedValueOnce({ id: 's1', projectId: 'p1', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 's2', projectId: 'p1', status: 'COMPLETED' });
      await expect(SprintService.complete('s1', 'u1', 's2')).rejects.toThrow(/closed sprint/i);
    });
  });

  describe('cancel', () => {
    it('detaches tasks and cancels an ACTIVE sprint', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      repo.moveUnfinishedTasks.mockResolvedValue(0);
      repo.update.mockResolvedValue({ id: 's1', projectId: 'p1', name: 'S1', status: 'CANCELLED' });

      const result = await SprintService.cancel('s1', 'u1');
      expect(repo.moveUnfinishedTasks).toHaveBeenCalledWith('s1', null, expect.anything());
      expect(result.status).toBe('CANCELLED');
    });

    it('rejects cancelling an already completed sprint', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'COMPLETED' });
      await expect(SprintService.cancel('s1', 'u1')).rejects.toThrow(/already completed/i);
    });
  });

  describe('assignTask', () => {
    it('throws NotFound when the task does not exist', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      (prisma.task.findFirst as any).mockResolvedValue(null);
      await expect(SprintService.assignTask('s1', 't1')).rejects.toThrow(/not found/i);
    });
  });

  describe('removeTask', () => {
    it('removes a task that belongs to the sprint', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', sprintId: 's1' });
      await SprintService.removeTask('s1', 't1');
      expect(repo.removeTask).toHaveBeenCalledWith('t1');
    });

    it('throws NotFound when the task is not in this sprint', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', sprintId: 'sOTHER' });
      await expect(SprintService.removeTask('s1', 't1')).rejects.toThrow(/in sprint/i);
    });

    it('throws NotFound when the task does not exist', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      (prisma.task.findFirst as any).mockResolvedValue(null);
      await expect(SprintService.removeTask('s1', 't1')).rejects.toThrow(/in sprint/i);
    });
  });
});
