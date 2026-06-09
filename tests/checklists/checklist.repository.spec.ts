import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChecklistRepository } from '../../src/checklists/checklist.repository';

function mockClient() {
  return {
    checklist: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    checklistItem: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
  } as any;
}

describe('ChecklistRepository', () => {
  let client: any;
  let repo: ChecklistRepository;

  beforeEach(() => {
    client = mockClient();
    repo = new ChecklistRepository(client);
  });

  describe('create', () => {
    it('delegates to checklist.create', async () => {
      client.checklist.create.mockResolvedValue({ id: 'c1' });
      const data = { taskId: 't1', title: 'QA' } as any;
      expect(await repo.create(data)).toEqual({ id: 'c1' });
      expect(client.checklist.create).toHaveBeenCalledWith({ data });
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.checklist.create.mockResolvedValue({ id: 'tx' });
      await repo.create({ taskId: 't1', title: 'QA' } as any, tx);
      expect(tx.checklist.create).toHaveBeenCalled();
      expect(client.checklist.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('looks up by id and includes ordered items', async () => {
      client.checklist.findUnique.mockResolvedValue({ id: 'c1', items: [] });
      await repo.findById('c1');
      expect(client.checklist.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        include: { items: { orderBy: { position: 'asc' } } },
      });
    });
  });

  describe('update', () => {
    it('delegates to checklist.update', async () => {
      client.checklist.update.mockResolvedValue({ id: 'c1', title: 'New' });
      await repo.update('c1', { title: 'New' });
      expect(client.checklist.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { title: 'New' },
      });
    });
  });

  describe('delete', () => {
    it('delegates to checklist.delete', async () => {
      client.checklist.delete.mockResolvedValue(undefined);
      await repo.delete('c1');
      expect(client.checklist.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });
  });

  describe('listForTask', () => {
    it('queries by taskId, includes ordered items, and orders checklists', async () => {
      client.checklist.findMany.mockResolvedValue([]);
      await repo.listForTask('t1');
      expect(client.checklist.findMany).toHaveBeenCalledWith({
        where: { taskId: 't1' },
        include: { items: { orderBy: { position: 'asc' } } },
        orderBy: { position: 'asc' },
      });
    });
  });

  describe('findItemById', () => {
    it('looks up an item by id', async () => {
      client.checklistItem.findUnique.mockResolvedValue({ id: 'i1' });
      await repo.findItemById('i1');
      expect(client.checklistItem.findUnique).toHaveBeenCalledWith({ where: { id: 'i1' } });
    });
  });

  describe('createItem', () => {
    it('delegates to checklistItem.create', async () => {
      client.checklistItem.create.mockResolvedValue({ id: 'i1' });
      const data = { checklistId: 'c1', content: 'x', position: 0 } as any;
      await repo.createItem(data);
      expect(client.checklistItem.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('updateItem', () => {
    it('delegates to checklistItem.update', async () => {
      client.checklistItem.update.mockResolvedValue({ id: 'i1' });
      await repo.updateItem('i1', { content: 'y' });
      expect(client.checklistItem.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { content: 'y' },
      });
    });
  });

  describe('deleteItem', () => {
    it('delegates to checklistItem.delete', async () => {
      client.checklistItem.delete.mockResolvedValue(undefined);
      await repo.deleteItem('i1');
      expect(client.checklistItem.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
    });
  });

  describe('nextItemPosition', () => {
    it('returns last position + 1 when items exist', async () => {
      client.checklistItem.findFirst.mockResolvedValue({ position: 4 });
      expect(await repo.nextItemPosition('c1')).toBe(5);
      expect(client.checklistItem.findFirst).toHaveBeenCalledWith({
        where: { checklistId: 'c1' },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
    });

    it('returns 0 when the checklist is empty', async () => {
      client.checklistItem.findFirst.mockResolvedValue(null);
      expect(await repo.nextItemPosition('c1')).toBe(0);
    });

    it('uses the transaction client when provided', async () => {
      const tx = mockClient();
      tx.checklistItem.findFirst.mockResolvedValue({ position: 0 });
      await repo.nextItemPosition('c1', tx);
      expect(tx.checklistItem.findFirst).toHaveBeenCalled();
      expect(client.checklistItem.findFirst).not.toHaveBeenCalled();
    });
  });
});
