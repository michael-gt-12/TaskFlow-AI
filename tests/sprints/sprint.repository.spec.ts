import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SprintRepository } from '../../src/sprints/sprint.repository';

function mockClient() {
  return {
    sprint: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    task: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  } as any;
}

describe('SprintRepository', () => {
  let client: any;
  let repo: SprintRepository;

  beforeEach(() => {
    client = mockClient();
    repo = new SprintRepository(client);
  });

  describe('create', () => {
    it('delegates to sprint.create', async () => {
      client.sprint.create.mockResolvedValue({ id: 's1' });
      const data = { projectId: 'p1', name: 'S', status: 'PLANNED' } as any;
      expect(await repo.create(data)).toEqual({ id: 's1' });
      expect(client.sprint.create).toHaveBeenCalledWith({ data });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.sprint.create.mockResolvedValue({ id: 'tx' });
      await repo.create({ projectId: 'p1', name: 'S' } as any, tx);
      expect(tx.sprint.create).toHaveBeenCalled();
      expect(client.sprint.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('looks up by id with the default client', async () => {
      client.sprint.findUnique.mockResolvedValue({ id: 's1' });
      await repo.findById('s1');
      expect(client.sprint.findUnique).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      await repo.findById('s1', tx);
      expect(tx.sprint.findUnique).toHaveBeenCalled();
      expect(client.sprint.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findByIdWithProject', () => {
    it('includes project selection and task count', async () => {
      client.sprint.findUnique.mockResolvedValue({ id: 's1' });
      await repo.findByIdWithProject('s1');
      const arg = client.sprint.findUnique.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 's1' });
      expect(arg.include).toHaveProperty('project');
      expect(arg.include).toHaveProperty('_count');
    });
  });

  describe('update', () => {
    it('delegates to sprint.update', async () => {
      client.sprint.update.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
      await repo.update('s1', { status: 'ACTIVE' } as any);
      expect(client.sprint.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'ACTIVE' },
      });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.sprint.update.mockResolvedValue({ id: 's1' });
      await repo.update('s1', { name: 'X' } as any, tx);
      expect(tx.sprint.update).toHaveBeenCalled();
      expect(client.sprint.update).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('builds default filters/orderBy and returns items + total', async () => {
      client.sprint.findMany.mockResolvedValue([{ id: 's1' }]);
      client.sprint.count.mockResolvedValue(1);
      const result = await repo.list({ projectId: 'p1' });
      expect(result).toEqual({ items: [{ id: 's1' }], total: 1 });
      const arg = client.sprint.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ projectId: 'p1' });
      expect(arg.orderBy).toEqual([{ status: 'asc' }, { startDate: 'desc' }]);
    });

    it('applies a status filter when provided', async () => {
      client.sprint.findMany.mockResolvedValue([]);
      client.sprint.count.mockResolvedValue(0);
      await repo.list({ projectId: 'p1', status: 'ACTIVE' as any });
      expect(client.sprint.findMany.mock.calls[0][0].where).toEqual({
        projectId: 'p1',
        status: 'ACTIVE',
      });
    });

    it('honours a custom orderBy', async () => {
      client.sprint.findMany.mockResolvedValue([]);
      client.sprint.count.mockResolvedValue(0);
      await repo.list({ projectId: 'p1', orderBy: { name: 'asc' } as any });
      expect(client.sprint.findMany.mock.calls[0][0].orderBy).toEqual({ name: 'asc' });
    });
  });

  describe('findActive', () => {
    it('finds the single ACTIVE sprint for a project', async () => {
      client.sprint.findFirst.mockResolvedValue({ id: 's1' });
      await repo.findActive('p1');
      expect(client.sprint.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'p1', status: 'ACTIVE' },
      });
    });
  });

  describe('countTasksByStatus', () => {
    it('reduces grouped counts into a status map', async () => {
      client.task.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { _all: 3 } },
        { status: 'TODO', _count: { _all: 2 } },
      ]);
      const result = await repo.countTasksByStatus('s1');
      expect(result).toEqual({ DONE: 3, TODO: 2 });
      const arg = client.task.groupBy.mock.calls[0][0];
      expect(arg.where).toEqual({ sprintId: 's1', deletedAt: null });
    });

    it('returns an empty map when there are no tasks', async () => {
      client.task.groupBy.mockResolvedValue([]);
      expect(await repo.countTasksByStatus('s1')).toEqual({});
    });
  });

  describe('sumStoryPoints', () => {
    it('returns total and completed story points', async () => {
      client.task.aggregate
        .mockResolvedValueOnce({ _sum: { storyPoints: 10 } })
        .mockResolvedValueOnce({ _sum: { storyPoints: 4 } });
      expect(await repo.sumStoryPoints('s1')).toEqual({ total: 10, completed: 4 });
    });

    it('coalesces null sums to zero', async () => {
      client.task.aggregate
        .mockResolvedValueOnce({ _sum: { storyPoints: null } })
        .mockResolvedValueOnce({ _sum: { storyPoints: null } });
      expect(await repo.sumStoryPoints('s1')).toEqual({ total: 0, completed: 0 });
    });
  });

  describe('assignTask', () => {
    it('sets the sprintId on the task', async () => {
      await repo.assignTask('s1', 't1');
      expect(client.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { sprintId: 's1' },
      });
    });
  });

  describe('removeTask', () => {
    it('clears the sprintId on the task', async () => {
      await repo.removeTask('t1');
      expect(client.task.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { sprintId: null },
      });
    });
  });

  describe('moveUnfinishedTasks', () => {
    it('moves not-DONE tasks to a target sprint and returns the count', async () => {
      client.task.updateMany.mockResolvedValue({ count: 2 });
      const moved = await repo.moveUnfinishedTasks('s1', 's2');
      expect(moved).toBe(2);
      const arg = client.task.updateMany.mock.calls[0][0];
      expect(arg.where).toEqual({ sprintId: 's1', deletedAt: null, status: { not: 'DONE' } });
      expect(arg.data).toEqual({ sprintId: 's2' });
    });

    it('moves tasks back to the backlog when target is null', async () => {
      client.task.updateMany.mockResolvedValue({ count: 0 });
      await repo.moveUnfinishedTasks('s1', null);
      expect(client.task.updateMany.mock.calls[0][0].data).toEqual({ sprintId: null });
    });
  });
});
