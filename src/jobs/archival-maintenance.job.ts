import { Job } from './job.interface';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';
import { CacheService } from '../utils/cache';

export class ArchivalMaintenanceJob implements Job {
  name = 'archival-maintenance';

  async run(): Promise<void> {
    logger.info('Running ArchivalMaintenanceJob...');
    
    // Find all projects that are archived
    const archivedProjects = await prisma.project.findMany({
      where: { isArchived: true }
    });

    logger.info(`Found ${archivedProjects.length} archived projects.`);
    let updatedTasksCount = 0;

    for (const project of archivedProjects) {
      // Find tasks in the archived project that are not completed (DONE) and not already BACKLOG
      const uncompletedTasks = await prisma.task.findMany({
        where: {
          projectId: project.id,
          NOT: {
            status: 'DONE'
          }
        }
      });

      if (uncompletedTasks.length > 0) {
        logger.info(`Archived project ${project.id} ("${project.name}") has ${uncompletedTasks.length} uncompleted tasks. Reverting status to BACKLOG.`);
        
        const updateResult = await prisma.task.updateMany({
          where: {
            projectId: project.id,
            NOT: {
              status: 'DONE'
            }
          },
          data: {
            status: 'BACKLOG'
          }
        });

        updatedTasksCount += updateResult.count;
        
        // Invalidate task list caches for this project
        await CacheService.delPattern(`tasks:project:${project.id}:*`);
      }
    }

    logger.info(`ArchivalMaintenanceJob finished. Reset status of ${updatedTasksCount} tasks to BACKLOG.`);
  }
}
