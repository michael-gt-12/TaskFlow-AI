import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeEntryRepository } from '../../src/time-tracking/time-entry.repository';

function mockClient() {
  return {
    timeEntry: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  } as any;
}

describe('TimeEntryRepository', () => {
  let client: any;
  let repo: TimeEntryRepository;

  beforeEach(() => {
    client = mockClient();
    repo = new TimeEntryRepository(client);
  });

  describe('create', () => {
    it('delegates to timeEntry.create', async () => {
      client.timeEntry.create.mockResolvedValue({ id: 'e1' });
      const data = { taskId: 't1', userId: 'u1', minutes: 30 } as any;
      expect(await repo.create(data)).toEqual({ id: 'e1' });
      expect(client.timeEntry.create).toHaveBeenCalledWith({ data });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.timeEntry.create.mockResolvedValue({ id: 'tx' });
      await repo.create({ taskId: 't1' } as any, tx);
      expect(tx.timeEntry.create).toHaveBeenCalled();
      expect(client.timeEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('looks up by id', async () => {
      client.timeEntry.findUnique.mockResolvedValue({ id: 'e1' });
      expect(await repo.findById('e1')).toEqual({ id: 'e1' });
      expect(client.timeEntry.findUnique).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });
  });

  describe('update', () => {
    it('delegates to timeEntry.update', async () => {
      client.timeEntry.update.mockResolvedValue({ id: 'e1', minutes: 45 });
      await repo.update('e1', { minutes: 45 });
      expect(client.timeEntry.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { minutes: 45 } });
    });
  });

  describe('delete', () => {
    it('delegates to timeEntry.delete', async () => {
      client.timeEntry.delete.mockResolvedValue(undefined);
      await repo.delete('e1');
      expect(client.timeEntry.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });
  });

  describe('list', () => {
    it('returns items + total with no filters (empty where)', async () => {
      client.timeEntry.findMany.mockResolvedValue([{ id: 'e1' }]);
      client.timeEntry.count.mockResolvedValue(1);
      const result = await repo.list({});
      expect(result).toEqual({ items: [{ id: 'e1' }], total: 1 });
      const arg = client.timeEntry.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({});
      expect(arg.orderBy).toEqual({ loggedAt: 'desc' });
    });

    it('applies taskId, userId, skip and take filters', async () => {
      client.timeEntry.findMany.mockResolvedValue([]);
      client.timeEntry.count.mockResolvedValue(0);
      await repo.list({ taskId: 't1', userId: 'u1', skip: 10, take: 5 });
      const arg = client.timeEntry.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ taskId: 't1', userId: 'u1' });
      expect(arg.skip).toBe(10);
      expect(arg.take).toBe(5);
      expect(client.timeEntry.count).toHaveBeenCalledWith({ where: { taskId: 't1', userId: 'u1' } });
    });
  });

  describe('totalMinutesForTask', () => {
    it('returns the summed minutes', async () => {
      client.timeEntry.aggregate.mockResolvedValue({ _sum: { minutes: 120 } });
      expect(await repo.totalMinutesForTask('t1')).toBe(120);
      expect(client.timeEntry.aggregate).toHaveBeenCalledWith({
        where: { taskId: 't1' },
        _sum: { minutes: true },
      });
    });

    it('coalesces a null sum to 0', async () => {
      client.timeEntry.aggregate.mockResolvedValue({ _sum: { minutes: null } });
      expect(await repo.totalMinutesForTask('t1')).toBe(0);
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.timeEntry.aggregate.mockResolvedValue({ _sum: { minutes: 5 } });
      expect(await repo.totalMinutesForTask('t1', tx)).toBe(5);
      expect(client.timeEntry.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('minutesByUserForTask', () => {
    it('maps groupBy rows to user totals', async () => {
      client.timeEntry.groupBy.mockResolvedValue([
        { userId: 'u1', _sum: { minutes: 90 } },
        { userId: 'u2', _sum: { minutes: null } },
      ]);
      const result = await repo.minutesByUserForTask('t1');
      expect(result).toEqual([
        { userId: 'u1', minutes: 90 },
        { userId: 'u2', minutes: 0 },
      ]);
      expect(client.timeEntry.groupBy).toHaveBeenCalledWith({
        by: ['userId'],
        where: { taskId: 't1' },
        _sum: { minutes: true },
      });
    });
  });
});
