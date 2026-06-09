import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MilestoneService } from '../../src/milestones/milestone.service';
import { milestoneRepository } from '../../src/milestones/milestone.repository';
import { CacheService } from '../../src/utils/cache';
import { prisma } from '../../src/database/client';

vi.mock('../../src/milestones/milestone.repository', () => ({
  milestoneRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    countTasksByStatus: vi.fn(),
    countOpenTasks: vi.fn(),
    assignTask: vi.fn(),
    removeTask: vi.fn(),
  },
  MilestoneRepository: class {},
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

const repo = milestoneRepository as any;

describe('MilestoneService (extra)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
  });

  describe('create', () => {
    it('trims name/description and parses an ISO dueDate', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', organizationId: 'org1' });
      repo.create.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });

      await MilestoneService.create('u1', {
        projectId: 'p1',
        name: '  v1.0  ',
        description: '  desc  ',
        dueDate: '2026-02-01T00:00:00.000Z',
      });

      const data = repo.create.mock.calls[0][0];
      expect(data.name).toBe('v1.0');
      expect(data.description).toBe('desc');
      expect(data.dueDate).toBeInstanceOf(Date);
    });

    it('coerces an empty description and missing dueDate to null', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', organizationId: 'org1' });
      repo.create.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      await MilestoneService.create('u1', { projectId: 'p1', name: 'v1.0', description: '  ' });
      const data = repo.create.mock.calls[0][0];
      expect(data.description).toBeNull();
      expect(data.dueDate).toBeNull();
    });

    it('rejects an invalid dueDate', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', organizationId: 'org1' });
      await expect(
        MilestoneService.create('u1', { projectId: 'p1', name: 'v1.0', dueDate: 'nope' })
      ).rejects.toThrow(/invalid date/i);
    });
  });

  describe('getById', () => {
    it('returns the cached milestone without hitting the repo', async () => {
      (CacheService.get as any).mockResolvedValue({ id: 'm1', status: 'OPEN' });
      const result = await MilestoneService.getById('m1');
      expect(result).toEqual({ id: 'm1', status: 'OPEN' });
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('loads from the repo and caches on a miss', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', status: 'OPEN' });
      const result = await MilestoneService.getById('m1');
      expect(result.id).toBe('m1');
      expect(CacheService.set).toHaveBeenCalled();
    });

    it('throws NotFound when the milestone does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(MilestoneService.getById('missing')).rejects.toThrow(/not found/i);
    });
  });

  describe('list', () => {
    it('computes skip/take and wraps the result with offset meta', async () => {
      repo.list.mockResolvedValue({ items: [{ id: 'm1' }], total: 1 });
      const result = await MilestoneService.list('p1', { page: 3, pageSize: 5 });
      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'p1', skip: 10, take: 5 })
      );
      expect(result.data).toEqual([{ id: 'm1' }]);
      expect(result.meta).toBeDefined();
    });
  });

  describe('getSummary', () => {
    it('aggregates task counts and derives open tasks', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      repo.countTasksByStatus.mockResolvedValue({ DONE: 2, TODO: 3 });
      const { stats } = await MilestoneService.getSummary('m1');
      expect(stats.totalTasks).toBe(5);
      expect(stats.completedTasks).toBe(2);
      expect(stats.openTasks).toBe(3);
    });
  });

  describe('update', () => {
    it('refuses to edit a non-OPEN milestone', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'REACHED' });
      await expect(MilestoneService.update('m1', { name: 'X' })).rejects.toThrow(
        /only open milestones/i
      );
    });

    it('trims fields, nulls an empty description and parses a new dueDate', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      repo.update.mockResolvedValue({ id: 'm1', projectId: 'p1', name: 'X', status: 'OPEN' });

      await MilestoneService.update('m1', {
        name: '  New  ',
        description: '  ',
        dueDate: '2026-02-01T00:00:00.000Z',
      });
      const data = repo.update.mock.calls[0][1];
      expect(data.name).toBe('New');
      expect(data.description).toBeNull();
      expect(data.dueDate).toBeInstanceOf(Date);
    });

    it('leaves an undefined dueDate untouched', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      repo.update.mockResolvedValue({ id: 'm1', projectId: 'p1', name: 'X', status: 'OPEN' });
      await MilestoneService.update('m1', { name: 'New' });
      const data = repo.update.mock.calls[0][1];
      expect(data.dueDate).toBeUndefined();
      expect(data.description).toBeUndefined();
    });
  });

  describe('markReached', () => {
    it('stamps reachedAt and invalidates when reaching with all tasks done', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      repo.countOpenTasks.mockResolvedValue(0);
      repo.update.mockResolvedValue({ id: 'm1', projectId: 'p1', name: 'M', status: 'REACHED' });

      await MilestoneService.markReached('m1', 'u1', false);
      const data = repo.update.mock.calls[0][1];
      expect(data.status).toBe('REACHED');
      expect(data.reachedAt).toBeInstanceOf(Date);
      expect(CacheService.delPattern).toHaveBeenCalled();
    });
  });

  describe('markMissed', () => {
    it('marks an OPEN milestone missed', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      repo.update.mockResolvedValue({ id: 'm1', projectId: 'p1', name: 'M', status: 'MISSED' });

      const result = await MilestoneService.markMissed('m1', 'u1');
      expect(repo.update).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ status: 'MISSED' }),
        expect.anything()
      );
      expect(result.status).toBe('MISSED');
    });

    it('rejects marking a non-OPEN milestone missed', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'REACHED' });
      await expect(MilestoneService.markMissed('m1', 'u1')).rejects.toThrow(
        /only open milestones can be marked missed/i
      );
    });
  });

  describe('reopen', () => {
    it('reopens a MISSED milestone and clears reachedAt', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'MISSED' });
      repo.update.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      const result = await MilestoneService.reopen('m1');
      expect(repo.update).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ status: 'OPEN', reachedAt: null })
      );
      expect(result.status).toBe('OPEN');
    });
  });

  describe('assignTask', () => {
    it('throws NotFound when the task does not exist', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      (prisma.task.findFirst as any).mockResolvedValue(null);
      await expect(MilestoneService.assignTask('m1', 't1')).rejects.toThrow(/not found/i);
    });

    it('assigns a task that belongs to the milestone project', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', projectId: 'p1' });
      await MilestoneService.assignTask('m1', 't1');
      expect(repo.assignTask).toHaveBeenCalledWith('m1', 't1');
    });
  });

  describe('removeTask', () => {
    it('removes a task that belongs to the milestone', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', milestoneId: 'm1' });
      await MilestoneService.removeTask('m1', 't1');
      expect(repo.removeTask).toHaveBeenCalledWith('t1');
    });

    it('throws NotFound when the task is not in this milestone', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', milestoneId: 'mOTHER' });
      await expect(MilestoneService.removeTask('m1', 't1')).rejects.toThrow(/in milestone/i);
    });

    it('throws NotFound when the task does not exist', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      (prisma.task.findFirst as any).mockResolvedValue(null);
      await expect(MilestoneService.removeTask('m1', 't1')).rejects.toThrow(/in milestone/i);
    });
  });
});
