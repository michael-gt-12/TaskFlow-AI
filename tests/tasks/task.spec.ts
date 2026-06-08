import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from '../../src/tasks/task.service';
import { prisma } from '../../src/database/client';

vi.mock('../../src/database/client', () => ({
  prisma: {
    task: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    taskLabel: {
      createMany: vi.fn(),
      deleteMany: vi.fn()
    },
    $transaction: (fn: any) => fn(prisma)
  }
}));

describe('TaskService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getById', () => {
    it('should retrieve task model correctly', async () => {
      const mockTask = { id: 'task123', title: 'Unit Task', creatorId: 'u1' };
      vi.mocked(prisma.task.findUnique).mockResolvedValue(mockTask as any);

      const result = await TaskService.getById('task123');
      expect(result.title).toBe('Unit Task');
    });
  });
});
