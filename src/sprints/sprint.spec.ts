import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SprintService } from './sprint.service';
import { sprintRepository } from './sprint.repository';
import { CacheService } from '../utils/cache';
import { prisma } from '../database/client';

vi.mock('./sprint.repository', () => ({
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
    project: { findFirst: vi.fn() },
    task: { findFirst: vi.fn() },
  },
}));

// Run the unit-of-work callback immediately with a tx stub that can resolve the
// organization id, sidestepping the real Prisma transaction machinery.
vi.mock('../shared/unit-of-work', () => ({
  UnitOfWork: {
    execute: vi.fn(async (work: any) =>
      work({ project: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org1' }) } })
    ),
  },
}));

const repo = sprintRepository as any;

describe('SprintService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as any).mockResolvedValue(null);
  });

  describe('create', () => {
    it('creates a PLANNED sprint for an existing project', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', organizationId: 'org1' });
      repo.create.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'PLANNED' });

      const result = await SprintService.create('u1', { projectId: 'p1', name: 'Sprint 1' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'p1', name: 'Sprint 1', status: 'PLANNED' })
      );
      expect(result.status).toBe('PLANNED');
    });

    it('rejects creation against a missing project', async () => {
      (prisma.project.findFirst as any).mockResolvedValue(null);
      await expect(
        SprintService.create('u1', { projectId: 'missing', name: 'Sprint 1' })
      ).rejects.toThrow(/not found/i);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a start date later than the end date', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({ id: 'p1', organizationId: 'org1' });
      await expect(
        SprintService.create('u1', {
          projectId: 'p1',
          name: 'Sprint 1',
          startDate: '2026-02-01T00:00:00.000Z',
          endDate: '2026-01-01T00:00:00.000Z',
        })
      ).rejects.toThrow(/on or before/i);
    });
  });

  describe('start', () => {
    it('rejects starting a sprint that is not PLANNED', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      await expect(SprintService.start('s1', 'u1')).rejects.toThrow(/PLANNED/);
    });

    it('rejects starting when another sprint is already active', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'PLANNED' });
      repo.findActive.mockResolvedValue({ id: 's0', name: 'Older Sprint', status: 'ACTIVE' });
      await expect(SprintService.start('s1', 'u1')).rejects.toThrow(/already has an active sprint/i);
    });

    it('transitions a PLANNED sprint to ACTIVE', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'PLANNED', startDate: null });
      repo.findActive.mockResolvedValue(null);
      repo.update.mockResolvedValue({ id: 's1', projectId: 'p1', name: 'S1', status: 'ACTIVE' });

      const result = await SprintService.start('s1', 'u1');

      expect(repo.update).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ status: 'ACTIVE' }),
        expect.anything()
      );
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('complete', () => {
    it('rejects completing a sprint that is not ACTIVE', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'PLANNED' });
      await expect(SprintService.complete('s1', 'u1')).rejects.toThrow(/ACTIVE/);
    });

    it('carries unfinished tasks back to the backlog by default', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      repo.countTasksByStatus.mockResolvedValue({ DONE: 3, IN_PROGRESS: 2 });
      repo.moveUnfinishedTasks.mockResolvedValue(2);
      repo.update.mockResolvedValue({ id: 's1', projectId: 'p1', name: 'S1', status: 'COMPLETED' });

      const result = await SprintService.complete('s1', 'u1');

      expect(repo.moveUnfinishedTasks).toHaveBeenCalledWith('s1', null, expect.anything());
      expect(result.status).toBe('COMPLETED');
    });

    it('rejects rolling tasks over into the same sprint', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      await expect(SprintService.complete('s1', 'u1', 's1')).rejects.toThrow(/same sprint/i);
    });

    it('rejects rolling tasks over into a sprint from another project', async () => {
      repo.findById
        .mockResolvedValueOnce({ id: 's1', projectId: 'p1', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 's2', projectId: 'pOTHER', status: 'PLANNED' });
      await expect(SprintService.complete('s1', 'u1', 's2')).rejects.toThrow(/same project/i);
    });
  });

  describe('assignTask', () => {
    it('rejects adding tasks to a closed sprint', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'COMPLETED' });
      await expect(SprintService.assignTask('s1', 't1')).rejects.toThrow(/closed sprint/i);
    });

    it('rejects a task from a different project', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', projectId: 'pOTHER' });
      await expect(SprintService.assignTask('s1', 't1')).rejects.toThrow(/same project/i);
    });

    it('assigns a task that belongs to the sprint project', async () => {
      repo.findById.mockResolvedValue({ id: 's1', projectId: 'p1', status: 'ACTIVE' });
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', projectId: 'p1' });
      await SprintService.assignTask('s1', 't1');
      expect(repo.assignTask).toHaveBeenCalledWith('s1', 't1');
    });
  });
});
