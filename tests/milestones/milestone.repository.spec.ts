import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MilestoneRepository } from '../../src/milestones/milestone.repository';

function mockClient() {
  return {
    milestone: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    task: {
      groupBy: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  } as any;
}

describe('MilestoneRepository', () => {
  let client: any;
  let repo: MilestoneRepository;

  beforeEach(() => {
    client = mockClient();
    repo = new MilestoneRepository(client);
  });

  describe('create', () => {
    it('delegates to milestone.create', async () => {
      client.milestone.create.mockResolvedValue({ id: 'm1' });
      const data = { projectId: 'p1', name: 'M', status: 'OPEN' } as any;
      expect(await repo.create(data)).toEqual({ id: 'm1' });
      expect(client.milestone.create).toHaveBeenCalledWith({ data });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.milestone.create.mockResolvedValue({ id: 'tx' });
      await repo.create({ projectId: 'p1', name: 'M' } as any, tx);
      expect(tx.milestone.create).toHaveBeenCalled();
      expect(client.milestone.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('looks up by id', async () => {
      client.milestone.findUnique.mockResolvedValue({ id: 'm1' });
      await repo.findById('m1');
      expect(client.milestone.findUnique).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      await repo.findById('m1', tx);
      expect(tx.milestone.findUnique).toHaveBeenCalled();
      expect(client.milestone.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('delegates to milestone.update', async () => {
      client.milestone.update.mockResolvedValue({ id: 'm1', status: 'REACHED' });
      await repo.update('m1', { status: 'REACHED' } as any);
      expect(client.milestone.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'REACHED' },
      });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.milestone.update.mockResolvedValue({ id: 'm1' });
      await repo.update('m1', { name: 'X' } as any, tx);
      expect(tx.milestone.update).toHaveBeenCalled();
      expect(client.milestone.update).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('builds default filters/orderBy and returns items + total', async () => {
      client.milestone.findMany.mockResolvedValue([{ id: 'm1' }]);
      client.milestone.count.mockResolvedValue(1);
      const result = await repo.list({ projectId: 'p1' });
      expect(result).toEqual({ items: [{ id: 'm1' }], total: 1 });
      const arg = client.milestone.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ projectId: 'p1' });
      expect(arg.orderBy).toEqual([{ status: 'asc' }, { dueDate: 'asc' }]);
    });

    it('applies a status filter when provided', async () => {
      client.milestone.findMany.mockResolvedValue([]);
      client.milestone.count.mockResolvedValue(0);
      await repo.list({ projectId: 'p1', status: 'OPEN' as any });
      expect(client.milestone.findMany.mock.calls[0][0].where).toEqual({
        projectId: 'p1',
        status: 'OPEN',
      });
    });

    it('honours a custom orderBy', async () => {
      client.milestone.findMany.mockResolvedValue([]);
      client.milestone.count.mockResolvedValue(0);
      await repo.list({ projectId: 'p1', orderBy: { name: 'asc' } as any });
      expect(client.milestone.findMany.mock.calls[0][0].orderBy).toEqual({ name: 'asc' });
    });
  });

  describe('countTasksByStatus', () => {
    it('reduces grouped counts into a status map', async () => {
      client.task.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { _all: 4 } },
        { status: 'TODO', _count: { _all: 1 } },
      ]);
      const result = await repo.countTasksByStatus('m1');
      expect(result).toEqual({ DONE: 4, TODO: 1 });
      expect(client.task.groupBy.mock.calls[0][0].where).toEqual({
        milestoneId: 'm1',
        deletedAt: null,
      });
    });

    it('returns an empty map when there are no tasks', async () => {
      client.task.groupBy.mockResolvedValue([]);
      expect(await repo.countTasksByStatus('m1')).toEqual({});
    });
  });

  describe('countOpenTasks', () => {
    it('counts not-DONE tasks on the milestone', async () => {
      client.task.count.mockResolvedValue(3);
      expect(await repo.countOpenTasks('m1')).toBe(3);
      expect(client.task.count).toHaveBeenCalledWith({
        where: { milestoneId: 'm1', deletedAt: null, status: { not: 'DONE' } },
      });
    });
  });

  describe('assignTask', () => {
    it('sets the milestoneId on the task', async () => {
      await repo.assignTask('m1', 't1');
      expect(client.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { milestoneId: 'm1' },
      });
    });
  });

  describe('removeTask', () => {
    it('clears the milestoneId on the task', async () => {
      await repo.removeTask('t1');
      expect(client.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { milestoneId: null },
      });
    });
  });
});
