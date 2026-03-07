import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export class NotificationService {
  static async send(userId: string, title: string, message: string) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          message
        }
      });
      logger.info(`Notification sent to user ${userId}: ${title}`);
      return notification;
    } catch (err: any) {
      logger.error('Failed to create in-app notification:', err.message);
      // Suppress error so caller is unaffected
    }
  }

  static async getUnread(userId: string) {
    return prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }
}
