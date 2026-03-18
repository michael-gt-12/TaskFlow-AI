import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';
import { prisma } from '../database/client';

vi.mock('../database/client', () => ({
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
});
