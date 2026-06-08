import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobRunner } from '../../src/jobs/job.runner';
import { AnalyticsRefreshJob } from '../../src/jobs/analytics-refresh.job';
import { SearchIndexMaintenanceJob } from '../../src/jobs/search-index-maintenance.job';
import { NotificationCleanupJob } from '../../src/jobs/notification-cleanup.job';
import { ArchivalMaintenanceJob } from '../../src/jobs/archival-maintenance.job';
import { prisma } from '../../src/database/client';
import { CacheService } from '../../src/utils/cache';

vi.mock('../../src/database/client', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    task: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    organization: {
      findUnique: vi.fn()
    },
    searchIndex: {
      findMany: vi.fn(),
      delete: vi.fn()
    },
    notification: {
      deleteMany: vi.fn()
    }
  }
}));

describe('Background Jobs Engine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    JobRunner.clearLogs();
  });

  describe('JobRunner', () => {
    it('should register and list jobs correctly', () => {
      const initialCount = JobRunner.getJobs().length;
      JobRunner.register({ name: 'test-job', run: async () => {} });
      expect(JobRunner.getJobs().length).toBe(initialCount + 1);
      expect(JobRunner.getJobs().some(j => j.name === 'test-job')).toBe(true);
    });

    it('should log execution status on success', async () => {
      const successJob = { name: 'success-job', run: vi.fn().mockResolvedValue(undefined) };
      JobRunner.register(successJob);
      await JobRunner.runJob('success-job');

      const logs = JobRunner.getLogs();
      const jobLog = logs.find(l => l.jobName === 'success-job');
      expect(jobLog).toBeDefined();
      expect(jobLog?.status).toBe('SUCCESS');
      expect(jobLog?.completedAt).toBeDefined();
    });

    it('should log execution status and errors on failure', async () => {
      const failJob = { name: 'fail-job', run: vi.fn().mockRejectedValue(new Error('Job failed!')) };
      JobRunner.register(failJob);

      await expect(JobRunner.runJob('fail-job')).rejects.toThrow('Job failed!');

      const logs = JobRunner.getLogs();
      const jobLog = logs.find(l => l.jobName === 'fail-job');
      expect(jobLog).toBeDefined();
      expect(jobLog?.status).toBe('FAILED');
      expect(jobLog?.error).toBe('Job failed!');
    });
  });

  describe('Individual Jobs', () => {
    it('should execute AnalyticsRefreshJob and query projects', async () => {
      const mockProjects = [{ id: 'p1', name: 'Proj 1', isArchived: false }];
      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue([]);

      const job = new AnalyticsRefreshJob();
      await job.run();

      expect(prisma.project.findMany).toHaveBeenCalled();
    });

    it('should execute SearchIndexMaintenanceJob and delete orphans', async () => {
      const mockIndexes = [
        { id: 'si1', entityType: 'task', entityId: 't1' },
        { id: 'si2', entityType: 'project', entityId: 'p1' }
      ];
      vi.mocked(prisma.searchIndex.findMany).mockResolvedValue(mockIndexes as any);
      vi.mocked(prisma.task.findUnique).mockResolvedValue(null); // orphan
      vi.mocked(prisma.project.findUnique).mockResolvedValue({ id: 'p1' } as any); // exists

      const job = new SearchIndexMaintenanceJob();
      await job.run();

      expect(prisma.searchIndex.delete).toHaveBeenCalledWith({ where: { id: 'si1' } });
      expect(prisma.searchIndex.delete).not.toHaveBeenCalledWith({ where: { id: 'si2' } });
    });

    it('should execute NotificationCleanupJob', async () => {
      vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 5 } as any);

      const job = new NotificationCleanupJob();
      await job.run();

      expect(prisma.notification.deleteMany).toHaveBeenCalled();
    });

    it('should execute ArchivalMaintenanceJob', async () => {
      const mockArchivedProjects = [{ id: 'p_archived', name: 'Archived Proj', isArchived: true }];
      const mockUncompletedTasks = [{ id: 't1', title: 'Task 1', status: 'TODO', projectId: 'p_archived' }];

      vi.mocked(prisma.project.findMany).mockResolvedValue(mockArchivedProjects as any);
      vi.mocked(prisma.task.findMany).mockResolvedValue(mockUncompletedTasks as any);
      vi.mocked(prisma.task.updateMany).mockResolvedValue({ count: 1 } as any);

      const job = new ArchivalMaintenanceJob();
      await job.run();

      expect(prisma.project.findMany).toHaveBeenCalledWith({ where: { isArchived: true } });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: {
          projectId: 'p_archived',
          NOT: {
            status: 'DONE'
          }
        },
        data: {
          status: 'BACKLOG'
        }
      });
    });
  });
});
