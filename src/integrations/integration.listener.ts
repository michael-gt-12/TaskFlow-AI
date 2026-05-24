import { DomainEventPublisher } from '../shared/events';
import { MockEmailProvider } from './email.provider';
import { MockWebhookProvider } from './webhook.provider';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export function setupIntegrationListeners() {
  const emailProvider = new MockEmailProvider();
  const webhookProvider = new MockWebhookProvider();

  DomainEventPublisher.subscribe('task.created', async (event) => {
    const { taskId, taskTitle } = event.payload;
    logger.info(`[Integration Listener] Reacting to task.created (ID: ${taskId})`);

    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { creator: true, assignee: true }
      });

      if (task) {
        await emailProvider.sendEmail({
          to: task.creator.email,
          subject: `Task Created: ${taskTitle}`,
          body: `Hi ${task.creator.name}, the task "${taskTitle}" has been created successfully.`
        });

        if (task.assignee) {
          await emailProvider.sendEmail({
            to: task.assignee.email,
            subject: `Task Assigned: ${taskTitle}`,
            body: `Hi ${task.assignee.name}, you have been assigned to task "${taskTitle}".`
          });
        }
      }

      await webhookProvider.sendWebhook({
        url: 'https://api.external-webhook.com/v1/events',
        event: 'task.created',
        payload: event.payload
      });
    } catch (err: any) {
      logger.error('Error in task.created integration listener:', err.message);
    }
  });

  DomainEventPublisher.subscribe('task.status_changed', async (event) => {
    const { taskId, taskTitle, oldStatus, newStatus } = event.payload;
    logger.info(`[Integration Listener] Reacting to task.status_changed (ID: ${taskId})`);

    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { creator: true, assignee: true }
      });

      if (task) {
        if (task.assignee) {
          await emailProvider.sendEmail({
            to: task.assignee.email,
            subject: `Task Status Changed: ${taskTitle}`,
            body: `Hi ${task.assignee.name}, the task "${taskTitle}" changed from ${oldStatus} to ${newStatus}.`
          });
        }
      }

      await webhookProvider.sendWebhook({
        url: 'https://api.external-webhook.com/v1/events',
        event: 'task.status_changed',
        payload: event.payload
      });
    } catch (err: any) {
      logger.error('Error in task.status_changed integration listener:', err.message);
    }
  });

  DomainEventPublisher.subscribe('task.updated', async (event) => {
    const { taskId } = event.payload;
    logger.info(`[Integration Listener] Reacting to task.updated (ID: ${taskId})`);

    try {
      await webhookProvider.sendWebhook({
        url: 'https://api.external-webhook.com/v1/events',
        event: 'task.updated',
        payload: event.payload
      });
    } catch (err: any) {
      logger.error('Error in task.updated integration listener:', err.message);
    }
  });
}
