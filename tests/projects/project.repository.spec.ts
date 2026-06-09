import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectRepository } from '../../src/projects/project.repository';

function mockClient() {
  return {
    project: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    projectMember: {
      upsert: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    task: { aggregate: vi.fn() },
  } as any;
}

describe('ProjectRepository', () => {
  let client: any;
  let repo: ProjectRepository;

  beforeEach(() => {
    client = mockClient();
    repo = new ProjectRepository(client);
  });

  describe('create', () => {
    it('delegates to project.create', async () => {
      client.project.create.mockResolvedValue({ id: 'p1' });
      const data = { name: 'A', key: 'A', organizationId: 'o', color: '#fff' } as any;
      expect(await repo.create(data)).toEqual({ id: 'p1' });
      expect(client.project.create).toHaveBeenCalledWith({ data });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.project.create.mockResolvedValue({ id: 'tx' });
      await repo.create({ name: 'A' } as any, tx);
      expect(tx.project.create).toHaveBeenCalled();
      expect(client.project.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('filters out soft-deleted rows', async () => {
      client.project.findFirst.mockResolvedValue({ id: 'p1' });
      await repo.findById('p1');
      expect(client.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', deletedAt: null },
      });
    });
  });

  describe('findByIdWithRelations', () => {
    it('includes organization, members, labels and counts', async () => {
      client.project.findFirst.mockResolvedValue({ id: 'p1' });
      await repo.findByIdWithRelations('p1');
      const arg = client.project.findFirst.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'p1', deletedAt: null });
      expect(arg.include).toHaveProperty('organization');
      expect(arg.include).toHaveProperty('_count');
    });
  });

  describe('findByKey', () => {
    it('scopes the query by organization and key', async () => {
      client.project.findFirst.mockResolvedValue(null);
      await repo.findByKey('o', 'KEY');
      expect(client.project.findFirst).toHaveBeenCalledWith({
        where: { organizationId: 'o', key: 'KEY', deletedAt: null },
      });
    });
  });

  describe('keyExists', () => {
    it('returns true when count > 0', async () => {
      client.project.count.mockResolvedValue(2);
      expect(await repo.keyExists('o', 'KEY')).toBe(true);
    });

    it('returns false when count is 0', async () => {
      client.project.count.mockResolvedValue(0);
      expect(await repo.keyExists('o', 'KEY')).toBe(false);
    });
  });

  describe('list', () => {
    it('builds default filters and returns items + total', async () => {
      client.project.findMany.mockResolvedValue([{ id: 'p1' }]);
      client.project.count.mockResolvedValue(1);
      const result = await repo.list({ organizationId: 'o' });
      expect(result).toEqual({ items: [{ id: 'p1' }], total: 1 });
      const where = client.project.findMany.mock.calls[0][0].where;
      expect(where).toEqual({ organizationId: 'o', deletedAt: null, isArchived: false });
    });

    it('includes archived and applies leadId + search OR filters', async () => {
      client.project.findMany.mockResolvedValue([]);
      client.project.count.mockResolvedValue(0);
      await repo.list({ organizationId: 'o', includeArchived: true, leadId: 'u1', search: 'foo' });
      const where = client.project.findMany.mock.calls[0][0].where;
      expect(where.isArchived).toBeUndefined();
      expect(where.leadId).toBe('u1');
      expect(where.OR).toHaveLength(3);
    });

    it('honours a custom orderBy', async () => {
      client.project.findMany.mockResolvedValue([]);
      client.project.count.mockResolvedValue(0);
      await repo.list({ organizationId: 'o', orderBy: { name: 'asc' } });
      expect(client.project.findMany.mock.calls[0][0].orderBy).toEqual({ name: 'asc' });
    });
  });

  describe('update', () => {
    it('delegates to project.update', async () => {
      client.project.update.mockResolvedValue({ id: 'p1', name: 'New' });
      await repo.update('p1', { name: 'New' });
      expect(client.project.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { name: 'New' } });
    });
  });

  describe('countActive', () => {
    it('counts non-archived, non-deleted projects', async () => {
      client.project.count.mockResolvedValue(4);
      expect(await repo.countActive('o')).toBe(4);
      expect(client.project.count).toHaveBeenCalledWith({
        where: { organizationId: 'o', isArchived: false, deletedAt: null },
      });
    });
  });

  describe('addMember', () => {
    it('upserts the membership', async () => {
      await repo.addMember('p1', 'u1', 'LEAD' as any);
      expect(client.projectMember.upsert).toHaveBeenCalledWith({
        where: { projectId_userId: { projectId: 'p1', userId: 'u1' } },
        update: { role: 'LEAD' },
        create: { projectId: 'p1', userId: 'u1', role: 'LEAD' },
      });
    });
  });

  describe('removeMember', () => {
    it('deletes the membership', async () => {
      client.projectMember.delete.mockReturnValue({ catch: () => Promise.resolve(undefined) });
      await repo.removeMember('p1', 'u1');
      expect(client.projectMember.delete).toHaveBeenCalledWith({
        where: { projectId_userId: { projectId: 'p1', userId: 'u1' } },
      });
    });

    it('swallows delete errors via catch', async () => {
      client.projectMember.delete.mockReturnValue(Promise.reject(new Error('not found')));
      await expect(repo.removeMember('p1', 'u1')).resolves.toBeUndefined();
    });
  });

  describe('listMembers', () => {
    it('orders members by createdAt asc with user relation', async () => {
      client.projectMember.findMany.mockResolvedValue([]);
      await repo.listMembers('p1');
      const arg = client.projectMember.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ projectId: 'p1' });
      expect(arg.orderBy).toEqual({ createdAt: 'asc' });
    });
  });

  describe('getMember', () => {
    it('looks up a single membership by compound key', async () => {
      client.projectMember.findUnique.mockResolvedValue({ role: 'LEAD' });
      await repo.getMember('p1', 'u1');
      expect(client.projectMember.findUnique).toHaveBeenCalledWith({
        where: { projectId_userId: { projectId: 'p1', userId: 'u1' } },
      });
    });
  });

  describe('nextTaskNumber', () => {
    it('returns max + 1', async () => {
      client.task.aggregate.mockResolvedValue({ _max: { number: 7 } });
      expect(await repo.nextTaskNumber('p1')).toBe(8);
    });

    it('starts at 1 when there are no tasks', async () => {
      client.task.aggregate.mockResolvedValue({ _max: { number: null } });
      expect(await repo.nextTaskNumber('p1')).toBe(1);
    });
  });
});
