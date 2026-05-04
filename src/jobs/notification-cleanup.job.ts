import { Job } from './job.interface';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export class NotificationCleanupJob implements Job {
  name = 'notification-cleanup';

  async run(): Promise<void> {
    logger.info('Running NotificationCleanupJob...');
    const daysAgo = 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

    const result = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info(`NotificationCleanupJob finished. Purged ${result.count} read notifications older than ${daysAgo} days.`);
  }
}
