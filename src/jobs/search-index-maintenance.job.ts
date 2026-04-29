import { Job } from './job.interface';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export class SearchIndexMaintenanceJob implements Job {
  name = 'search-index-maintenance';

  async run(): Promise<void> {
    logger.info('Running SearchIndexMaintenanceJob...');
    const indexes = await prisma.searchIndex.findMany();
    let deletedCount = 0;

    for (const index of indexes) {
      let exists = false;
      try {
        if (index.entityType === 'task') {
          const task = await prisma.task.findUnique({ where: { id: index.entityId } });
          exists = !!task;
        } else if (index.entityType === 'project') {
          const proj = await prisma.project.findUnique({ where: { id: index.entityId } });
          exists = !!proj;
        } else if (index.entityType === 'user') {
          const user = await prisma.user.findUnique({ where: { id: index.entityId } });
          exists = !!user;
        } else if (index.entityType === 'organization') {
          const org = await prisma.organization.findUnique({ where: { id: index.entityId } });
          exists = !!org;
        } else {
          exists = true;
        }

        if (!exists) {
          await prisma.searchIndex.delete({ where: { id: index.id } });
          logger.info(`Cleaned up orphan search index for entity ${index.entityType} (ID: ${index.entityId})`);
          deletedCount++;
        }
      } catch (err: any) {
        logger.error(`Error checking orphan search index ${index.id}: ${err.message}`);
      }
    }

    logger.info(`SearchIndexMaintenanceJob finished. Cleaned up ${deletedCount} orphan records.`);
  }
}
