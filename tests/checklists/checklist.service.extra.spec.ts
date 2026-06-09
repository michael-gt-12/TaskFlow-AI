import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChecklistService } from '../../src/checklists/checklist.service';
import { checklistRepository } from '../../src/checklists/checklist.repository';
import { prisma } from '../../src/database/client';

vi.mock('../../src/checklists/checklist.repository', () => ({
  checklistRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listForTask: vi.fn(),
    findItemById: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    nextItemPosition: vi.fn(),
  },
  ChecklistRepository: class {},
}));

vi.mock('../../src/database/client', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
  },
}));

const repo = checklistRepository as any;

describe('ChecklistService (extra cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('trims the title before persisting', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      repo.create.mockResolvedValue({ id: 'c1', taskId: 't1', title: 'QA steps' });
      await ChecklistService.create({ taskId: 't1', title: '  QA steps  ' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 't1', title: 'QA steps' })
      );
    });
  });

  describe('getById', () => {
    it('returns the checklist when found', async () => {
      repo.findById.mockResolvedValue({ id: 'c1', items: [] });
      const result = await ChecklistService.getById('c1');
      expect(result).toEqual({ id: 'c1', items: [] });
    });

    it('throws NotFound when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(ChecklistService.getById('missing')).rejects.toThrow(/checklist not found/i);
    });
  });

  describe('listForTask', () => {
    it('delegates to the repository', async () => {
      repo.listForTask.mockResolvedValue([{ id: 'c1', items: [] }]);
      const result = await ChecklistService.listForTask('t1');
      expect(repo.listForTask).toHaveBeenCalledWith('t1');
      expect(result).toEqual([{ id: 'c1', items: [] }]);
    });
  });

  describe('rename', () => {
    it('renames an existing checklist (trimming the title)', async () => {
      repo.findById.mockResolvedValue({ id: 'c1', items: [] });
      repo.update.mockResolvedValue({ id: 'c1', title: 'New' });
      const result = await ChecklistService.rename('c1', '  New  ');
      expect(repo.update).toHaveBeenCalledWith('c1', { title: 'New' });
      expect(result.title).toBe('New');
    });

    it('throws NotFound when the checklist does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(ChecklistService.rename('missing', 'X')).rejects.toThrow(/checklist not found/i);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes an existing checklist', async () => {
      repo.findById.mockResolvedValue({ id: 'c1', items: [] });
      repo.delete.mockResolvedValue(undefined);
      await ChecklistService.remove('c1');
      expect(repo.delete).toHaveBeenCalledWith('c1');
    });

    it('throws NotFound when the checklist does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(ChecklistService.remove('missing')).rejects.toThrow(/checklist not found/i);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('trims item content before persisting', async () => {
      repo.findById.mockResolvedValue({ id: 'c1', items: [] });
      repo.nextItemPosition.mockResolvedValue(0);
      repo.createItem.mockResolvedValue({ id: 'i1' });
      await ChecklistService.addItem('c1', { content: '  do thing  ' });
      expect(repo.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ checklistId: 'c1', content: 'do thing', position: 0 })
      );
    });
  });

  describe('updateItem', () => {
    it('updates only content when isComplete is omitted (no completedAt change)', async () => {
      repo.findItemById.mockResolvedValue({ id: 'i1', isComplete: false });
      repo.updateItem.mockResolvedValue({ id: 'i1', content: 'new' });
      await ChecklistService.updateItem('i1', { content: '  new  ' });
      const data = repo.updateItem.mock.calls[0][1];
      expect(data.content).toBe('new');
      expect('isComplete' in data).toBe(false);
      expect('completedAt' in data).toBe(false);
    });

    it('sends an empty data object when neither field is provided', async () => {
      repo.findItemById.mockResolvedValue({ id: 'i1', isComplete: false });
      repo.updateItem.mockResolvedValue({ id: 'i1' });
      await ChecklistService.updateItem('i1', {});
      expect(repo.updateItem).toHaveBeenCalledWith('i1', {});
    });
  });

  describe('removeItem', () => {
    it('deletes an existing item', async () => {
      repo.findItemById.mockResolvedValue({ id: 'i1' });
      repo.deleteItem.mockResolvedValue(undefined);
      await ChecklistService.removeItem('i1');
      expect(repo.deleteItem).toHaveBeenCalledWith('i1');
    });

    it('throws NotFound when the item does not exist', async () => {
      repo.findItemById.mockResolvedValue(null);
      await expect(ChecklistService.removeItem('missing')).rejects.toThrow(
        /checklist item not found/i
      );
      expect(repo.deleteItem).not.toHaveBeenCalled();
    });
  });
});
