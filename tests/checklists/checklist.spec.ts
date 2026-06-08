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

describe('ChecklistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates a checklist on an existing task', async () => {
      (prisma.task.findFirst as any).mockResolvedValue({ id: 't1', deletedAt: null });
      repo.create.mockResolvedValue({ id: 'c1', taskId: 't1', title: 'QA steps' });

      const result = await ChecklistService.create({ taskId: 't1', title: 'QA steps' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 't1', title: 'QA steps' })
      );
      expect(result.items).toEqual([]);
    });

    it('rejects creation against a missing task', async () => {
      (prisma.task.findFirst as any).mockResolvedValue(null);
      await expect(
        ChecklistService.create({ taskId: 'missing', title: 'X' })
      ).rejects.toThrow(/task not found/i);
    });
  });

  describe('addItem', () => {
    it('appends an item at the next position', async () => {
      repo.findById.mockResolvedValue({ id: 'c1', items: [] });
      repo.nextItemPosition.mockResolvedValue(3);
      repo.createItem.mockResolvedValue({ id: 'i1', checklistId: 'c1', content: 'do thing', position: 3 });

      const item = await ChecklistService.addItem('c1', { content: 'do thing' });

      expect(repo.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ checklistId: 'c1', content: 'do thing', position: 3 })
      );
      expect(item.position).toBe(3);
    });

    it('rejects adding to a missing checklist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(ChecklistService.addItem('missing', { content: 'x' })).rejects.toThrow(
        /checklist not found/i
      );
    });
  });

  describe('updateItem', () => {
    it('stamps completedAt when an item is checked', async () => {
      repo.findItemById.mockResolvedValue({ id: 'i1', isComplete: false });
      repo.updateItem.mockImplementation(async (_id: string, data: any) => ({ id: 'i1', ...data }));

      await ChecklistService.updateItem('i1', { isComplete: true });

      const data = repo.updateItem.mock.calls[0][1];
      expect(data.isComplete).toBe(true);
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when an item is unchecked', async () => {
      repo.findItemById.mockResolvedValue({ id: 'i1', isComplete: true });
      repo.updateItem.mockResolvedValue({ id: 'i1', isComplete: false, completedAt: null });

      await ChecklistService.updateItem('i1', { isComplete: false });

      const data = repo.updateItem.mock.calls[0][1];
      expect(data.isComplete).toBe(false);
      expect(data.completedAt).toBeNull();
    });

    it('rejects updating a missing item', async () => {
      repo.findItemById.mockResolvedValue(null);
      await expect(ChecklistService.updateItem('missing', { content: 'x' })).rejects.toThrow(
        /checklist item not found/i
      );
    });
  });

  describe('getTaskProgress', () => {
    it('aggregates completion across all checklists on a task', async () => {
      repo.listForTask.mockResolvedValue([
        {
          id: 'c1',
          items: [
            { id: 'i1', isComplete: true },
            { id: 'i2', isComplete: false },
          ],
        },
        {
          id: 'c2',
          items: [
            { id: 'i3', isComplete: true },
            { id: 'i4', isComplete: true },
          ],
        },
      ]);

      const progress = await ChecklistService.getTaskProgress('t1');

      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(3);
      expect(progress.ratio).toBe(0.75);
    });

    it('returns zeroed progress when there are no items', async () => {
      repo.listForTask.mockResolvedValue([{ id: 'c1', items: [] }]);
      const progress = await ChecklistService.getTaskProgress('t1');
      expect(progress).toEqual({ total: 0, completed: 0, ratio: 0 });
    });
  });
});
