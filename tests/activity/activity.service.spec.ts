import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivityService } from '../../src/activity/activity.service';
import { prisma } from '../../src/database/client';

vi.mock('../../src/database/client', () => ({
  prisma: {
    activityLog: { create: vi.fn(), findMany: vi.fn() },
  },
}));

describe('ActivityService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('log', () => {
    it('writes an audit row with the supplied details', async () => {
      (prisma.activityLog.create as any).mockResolvedValue({ id: 'a1' });
      const result = await ActivityService.log('u1', 'org1', 'p1', 't1', 'TASK_CREATE', { title: 'X' });
      expect(result).toEqual({ id: 'a1' });
      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          organizationId: 'org1',
          projectId: 'p1',
          taskId: 't1',
          action: 'TASK_CREATE',
          details: { title: 'X' },
        }),
      });
    });

    it('defaults details to an empty object', async () => {
      (prisma.activityLog.create as any).mockResolvedValue({ id: 'a2' });
      await ActivityService.log('u1', 'org1', null, null, 'PING');
      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ details: {} }),
      });
    });

    it('swallows database errors so the main flow is not disrupted', async () => {
      (prisma.activityLog.create as any).mockRejectedValue(new Error('db down'));
      const result = await ActivityService.log('u1', 'org1', null, null, 'PING');
      expect(result).toBeUndefined();
    });
  });

  describe('getFeed', () => {
    it('queries by org with the default limit', async () => {
      (prisma.activityLog.findMany as any).mockResolvedValue([]);
      await ActivityService.getFeed('org1');
      expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org1' }, take: 50 })
      );
    });

    it('filters by project and honours a custom limit', async () => {
      (prisma.activityLog.findMany as any).mockResolvedValue([]);
      await ActivityService.getFeed('org1', 'p1', 10);
      expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org1', projectId: 'p1' }, take: 10 })
      );
    });
  });
});
