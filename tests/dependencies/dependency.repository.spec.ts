import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DependencyType } from '@prisma/client';
import { DependencyRepository } from '../../src/dependencies/dependency.repository';

function mockClient() {
  return {
    taskDependency: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  } as any;
}

describe('DependencyRepository', () => {
  let client: any;
  let repo: DependencyRepository;

  beforeEach(() => {
    client = mockClient();
    repo = new DependencyRepository(client);
  });

  describe('create', () => {
    it('delegates to taskDependency.create', async () => {
      client.taskDependency.create.mockResolvedValue({ id: 'd1' });
      const data = { sourceTaskId: 't1', targetTaskId: 't2', type: 'BLOCKS' } as any;
      expect(await repo.create(data)).toEqual({ id: 'd1' });
      expect(client.taskDependency.create).toHaveBeenCalledWith({ data });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.taskDependency.create.mockResolvedValue({ id: 'tx' });
      await repo.create({ sourceTaskId: 't1', targetTaskId: 't2', type: 'BLOCKS' } as any, tx);
      expect(tx.taskDependency.create).toHaveBeenCalled();
      expect(client.taskDependency.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('looks up by id', async () => {
      client.taskDependency.findUnique.mockResolvedValue({ id: 'd1' });
      await repo.findById('d1');
      expect(client.taskDependency.findUnique).toHaveBeenCalledWith({ where: { id: 'd1' } });
    });
  });

  describe('findPair', () => {
    it('queries the compound unique key', async () => {
      client.taskDependency.findUnique.mockResolvedValue(null);
      await repo.findPair('t1', 't2', DependencyType.BLOCKS);
      expect(client.taskDependency.findUnique).toHaveBeenCalledWith({
        where: {
          sourceTaskId_targetTaskId_type: {
            sourceTaskId: 't1',
            targetTaskId: 't2',
            type: DependencyType.BLOCKS,
          },
        },
      });
    });
  });

  describe('delete', () => {
    it('delegates to taskDependency.delete', async () => {
      client.taskDependency.delete.mockResolvedValue(undefined);
      await repo.delete('d1');
      expect(client.taskDependency.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    });
  });

  describe('listForTask', () => {
    it('queries both directions with task summaries ordered by createdAt', async () => {
      client.taskDependency.findMany.mockResolvedValue([]);
      await repo.listForTask('t1');
      const arg = client.taskDependency.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ OR: [{ sourceTaskId: 't1' }, { targetTaskId: 't1' }] });
      expect(arg.include.source.select).toEqual({ id: true, title: true, status: true });
      expect(arg.include.target.select).toEqual({ id: true, title: true, status: true });
      expect(arg.orderBy).toEqual({ createdAt: 'asc' });
    });
  });

  describe('loadBlockEdges', () => {
    it('loads only BLOCKS edges for the project and maps to edges', async () => {
      client.taskDependency.findMany.mockResolvedValue([
        { sourceTaskId: 't1', targetTaskId: 't2' },
        { sourceTaskId: 't2', targetTaskId: 't3' },
      ]);
      const edges = await repo.loadBlockEdges('p1');
      const arg = client.taskDependency.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ type: DependencyType.BLOCKS, source: { projectId: 'p1' } });
      expect(arg.select).toEqual({ sourceTaskId: true, targetTaskId: true });
      expect(edges).toEqual([
        { sourceTaskId: 't1', targetTaskId: 't2' },
        { sourceTaskId: 't2', targetTaskId: 't3' },
      ]);
    });

    it('returns an empty list when there are no edges', async () => {
      client.taskDependency.findMany.mockResolvedValue([]);
      expect(await repo.loadBlockEdges('p1')).toEqual([]);
    });
  });
});
