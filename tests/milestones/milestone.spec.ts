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

describe('MilestoneService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
  });

  describe('create', () => {
    it('creates an OPEN milestone for an existing project', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', organizationId: 'org1' });
      repo.create.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });

      const result = await MilestoneService.create('u1', { projectId: 'p1', name: 'v1.0 GA' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'p1', name: 'v1.0 GA', status: 'OPEN' })
      );
      expect(result.status).toBe('OPEN');
    });

    it('rejects creation against a missing project', async () => {
      (prisma.project.findFirst as any).mockResolvedValue(null);
      await expect(
        MilestoneService.create('u1', { projectId: 'missing', name: 'v1.0' })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('markReached', () => {
    it('refuses to reach a milestone with open tasks unless forced', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      repo.countOpenTasks.mockResolvedValue(2);
      await expect(MilestoneService.markReached('m1', 'u1', false)).rejects.toThrow(/not yet done/i);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('reaches a milestone when all tasks are done', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      repo.countOpenTasks.mockResolvedValue(0);
      repo.update.mockResolvedValue({ id: 'm1', projectId: 'p1', name: 'M', status: 'REACHED' });

      const result = await MilestoneService.markReached('m1', 'u1', false);

      expect(repo.update).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ status: 'REACHED' }),
        expect.anything()
      );
      expect(result.status).toBe('REACHED');
    });

    it('reaches a milestone with open tasks when forced', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      repo.update.mockResolvedValue({ id: 'm1', projectId: 'p1', name: 'M', status: 'REACHED' });

      await MilestoneService.markReached('m1', 'u1', true);

      expect(repo.countOpenTasks).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalled();
    });

    it('rejects reaching an already reached milestone', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'REACHED' });
      await expect(MilestoneService.markReached('m1', 'u1')).rejects.toThrow(/already reached/i);
    });
  });

  describe('reopen', () => {
    it('rejects reopening an already open milestone', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      await expect(MilestoneService.reopen('m1')).rejects.toThrow(/already open/i);
    });

    it('clears the reached timestamp on reopen', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'REACHED' });
      repo.update.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      await MilestoneService.reopen('m1');
      expect(repo.update).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ status: 'OPEN', reachedAt: null })
      );
    });
  });

  describe('assignTask', () => {
    it('rejects a task from a different project', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'OPEN' });
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', projectId: 'pOTHER' });
      await expect(MilestoneService.assignTask('m1', 't1')).rejects.toThrow(/same project/i);
    });

    it('rejects attaching tasks to a closed milestone', async () => {
      repo.findById.mockResolvedValue({ id: 'm1', projectId: 'p1', status: 'REACHED' });
      await expect(MilestoneService.assignTask('m1', 't1')).rejects.toThrow(/closed milestone/i);
    });
  });
});
