import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyService } from './dependency.service';
import { dependencyRepository } from './dependency.repository';
import { prisma } from '../database/client';

vi.mock('./dependency.repository', () => ({
  dependencyRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    findPair: vi.fn(),
    delete: vi.fn(),
    listForTask: vi.fn(),
    loadBlockEdges: vi.fn(),
  },
  DependencyRepository: class {},
}));

vi.mock('../database/client', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
  },
}));

vi.mock('../shared/unit-of-work', () => ({
  UnitOfWork: {
    execute: vi.fn(async (work: any) =>
      work({
        project: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org1' }) },
        task: { findUnique: vi.fn().mockResolvedValue({ projectId: 'p1' }) },
      })
    ),
  },
}));

const repo = dependencyRepository as any;

/** Make prisma.task.findFirst resolve each task to the given project. */
function stubTasks(byId: Record<string, { projectId: string } | null>) {
  (prisma.task.findFirst as any).mockImplementation(async ({ where }: any) => {
    const found = byId[where.id];
    return found ? { id: where.id, deletedAt: null, ...found } : null;
  });
}

describe('DependencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findPair.mockResolvedValue(null);
    repo.loadBlockEdges.mockResolvedValue([]);
  });

  describe('create', () => {
    it('rejects a self-referential dependency before touching the database', async () => {
      await expect(
        DependencyService.create('u1', { sourceTaskId: 't1', targetTaskId: 't1' })
      ).rejects.toThrow(/cannot depend on itself/i);
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
    });

    it('rejects linking tasks from different projects', async () => {
      stubTasks({ t1: { projectId: 'pA' }, t2: { projectId: 'pB' } });
      await expect(
        DependencyService.create('u1', { sourceTaskId: 't1', targetTaskId: 't2' })
      ).rejects.toThrow(/same project/i);
    });

    it('rejects a missing target task', async () => {
      stubTasks({ t1: { projectId: 'p1' }, t2: null });
      await expect(
        DependencyService.create('u1', { sourceTaskId: 't1', targetTaskId: 't2' })
      ).rejects.toThrow(/target task not found/i);
    });

    it('rejects a duplicate dependency of the same type', async () => {
      stubTasks({ t1: { projectId: 'p1' }, t2: { projectId: 'p1' } });
      repo.findPair.mockResolvedValue({ id: 'd-existing' });
      await expect(
        DependencyService.create('u1', { sourceTaskId: 't1', targetTaskId: 't2' })
      ).rejects.toThrow(/already exists/i);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates a BLOCKS dependency when the graph stays acyclic', async () => {
      stubTasks({ t1: { projectId: 'p1' }, t2: { projectId: 'p1' } });
      repo.create.mockResolvedValue({ id: 'd1', sourceTaskId: 't1', targetTaskId: 't2', type: 'BLOCKS' });

      const result = await DependencyService.create('u1', { sourceTaskId: 't1', targetTaskId: 't2' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sourceTaskId: 't1', targetTaskId: 't2', type: 'BLOCKS' }),
        expect.anything()
      );
      expect(result.id).toBe('d1');
    });

    it('rejects a BLOCKS edge that would close a cycle', async () => {
      // Existing edges: t2 -> t3 -> t1. Adding t1 -> t2 closes the loop.
      stubTasks({ t1: { projectId: 'p1' }, t2: { projectId: 'p1' } });
      repo.loadBlockEdges.mockResolvedValue([
        { sourceTaskId: 't2', targetTaskId: 't3' },
        { sourceTaskId: 't3', targetTaskId: 't1' },
      ]);

      await expect(
        DependencyService.create('u1', { sourceTaskId: 't1', targetTaskId: 't2' })
      ).rejects.toThrow(/cycle/i);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('allows a RELATES_TO edge even when it would form a loop', async () => {
      stubTasks({ t1: { projectId: 'p1' }, t2: { projectId: 'p1' } });
      repo.loadBlockEdges.mockResolvedValue([
        { sourceTaskId: 't2', targetTaskId: 't1' },
      ]);
      repo.create.mockResolvedValue({ id: 'd2', sourceTaskId: 't1', targetTaskId: 't2', type: 'RELATES_TO' });

      const result = await DependencyService.create('u1', {
        sourceTaskId: 't1',
        targetTaskId: 't2',
        type: 'RELATES_TO' as any,
      });

      expect(repo.loadBlockEdges).not.toHaveBeenCalled();
      expect(result.type).toBe('RELATES_TO');
    });
  });

  describe('remove', () => {
    it('throws when the dependency does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(DependencyService.remove('missing', 'u1')).rejects.toThrow(/not found/i);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('deletes an existing dependency', async () => {
      repo.findById.mockResolvedValue({
        id: 'd1',
        sourceTaskId: 't1',
        targetTaskId: 't2',
        type: 'BLOCKS',
      });
      await DependencyService.remove('d1', 'u1');
      expect(repo.delete).toHaveBeenCalledWith('d1', expect.anything());
    });
  });

  describe('listForTask', () => {
    it('splits dependencies into outgoing and incoming by direction', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      repo.listForTask.mockResolvedValue([
        {
          id: 'd1',
          sourceTaskId: 't1',
          targetTaskId: 't2',
          type: 'BLOCKS',
          source: { id: 't1', title: 'A', status: 'TODO' },
          target: { id: 't2', title: 'B', status: 'TODO' },
        },
        {
          id: 'd2',
          sourceTaskId: 't3',
          targetTaskId: 't1',
          type: 'BLOCKS',
          source: { id: 't3', title: 'C', status: 'DONE' },
          target: { id: 't1', title: 'A', status: 'TODO' },
        },
      ]);

      const graph = await DependencyService.listForTask('t1');

      expect(graph.outgoing).toHaveLength(1);
      expect(graph.outgoing[0].task.id).toBe('t2');
      expect(graph.incoming).toHaveLength(1);
      expect(graph.incoming[0].task.id).toBe('t3');
    });
  });
});
