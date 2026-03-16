import { prisma } from '../database/client';
import { CacheService } from '../utils/cache';
import { logger } from '../shared/logger';

export class AnalyticsService {
  /**
   * Analytics Correctness and Cache Invalidation hooks
   */
  static async getProjectSummary(projectId: string) {
    const cacheKey = `analytics:project:${projectId}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      logger.info(`Analytics cache hit for project ${projectId}`);
      return cached;
    }

    logger.info(`Analytics cache miss, recalculating for project ${projectId}...`);
    const tasks = await prisma.task.findMany({
      where: { projectId }
    });

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'DONE').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
    const backlog = tasks.filter(t => t.status === 'BACKLOG' || t.status === 'TODO').length;

    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const summary = {
      totalTasks: total,
      completedTasks: completed,
      inProgressTasks: inProgress,
      backlogTasks: backlog,
      completionRate: Math.round(completionRate * 100) / 100
    };

    // Cache metrics for 30 minutes (30 * 60 = 1800s)
    await CacheService.set(cacheKey, summary, 1800);
    return summary;
  }
}
