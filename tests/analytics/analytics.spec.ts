import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from '../../src/analytics/analytics.service';
import { prisma } from '../../src/database/client';
import { DomainEventPublisher } from '../../src/shared/events';
import { CacheService } from '../../src/utils/cache';

vi.mock('../../src/database/client', () => ({
  prisma: {
    task: {
      findMany: vi.fn()
    }
  }
}));

describe('AnalyticsService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should compute completion rates correctly', async () => {
    vi.mocked(prisma.task.findMany).mockResolvedValue([
      { id: 't1', status: 'DONE' },
      { id: 't2', status: 'TODO' }
    ] as any);

    const result = await AnalyticsService.getProjectSummary('p1');
    expect(result.completionRate).toBe(50);
    expect(result.totalTasks).toBe(2);
  });

  it('should invalidate cache when task is updated', async () => {
    const delSpy = vi.spyOn(CacheService, 'del');

    AnalyticsService.setupCacheListeners();

    DomainEventPublisher.publish('task.updated', {
      taskId: 't1',
      projectId: 'p1',
      orgId: 'o1',
      userId: 'u1',
      taskTitle: 'Test Task'
    });

    await new Promise(r => setTimeout(r, 10));
    expect(delSpy).toHaveBeenCalledWith('analytics:project:p1');
  });
});
