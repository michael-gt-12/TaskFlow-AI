import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export class ActivityService {
  static async log(userId: string, orgId: string, projectId: string | null, taskId: string | null, action: string, details?: any) {
    try {
      const log = await prisma.activityLog.create({
        data: {
          userId,
          organizationId: orgId,
          projectId,
          taskId,
          action,
          details: details || {}
        }
      });
      logger.info(`Activity logged: ${action} by user ${userId} in org ${orgId}`);
      return log;
    } catch (err: any) {
      logger.error('Failed to write activity audit log:', err.message);
      // Fail silently to prevent disrupting main operations (intentional architectural choice)
    }
  }

  static async getFeed(orgId: string, projectId?: string, limit = 50) {
    return prisma.activityLog.findMany({
      where: {
        organizationId: orgId,
        ...(projectId ? { projectId } : {})
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  }
}
