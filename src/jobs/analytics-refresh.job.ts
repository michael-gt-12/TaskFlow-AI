import { Job } from './job.interface';
import { prisma } from '../database/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { logger } from '../shared/logger';
import { CacheService } from '../utils/cache';

export class AnalyticsRefreshJob implements Job {
  name = 'analytics-refresh';

  async run(): Promise<void> {
    logger.info('Running AnalyticsRefreshJob...');
    const activeProjects = await prisma.project.findMany({
      where: { isArchived: false }
    });

    logger.info(`Found ${activeProjects.length} active projects to refresh analytics.`);
    for (const project of activeProjects) {
      try {
        // Delete cache first to force recalculation
        const cacheKey = `analytics:project:${project.id}`;
        await CacheService.del(cacheKey);
        
        // Recalculate and update cache
        await AnalyticsService.getProjectSummary(project.id);
        logger.info(`Successfully recalculated analytics for project ${project.id}`);
      } catch (err: any) {
        logger.error(`Failed to refresh analytics for project ${project.id}: ${err.message}`);
      }
    }
  }
}
