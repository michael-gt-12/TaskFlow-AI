import { DomainEventPublisher, DomainEvent } from '../shared/events';
import { NotificationService } from './notification.service';
import { prisma } from '../database/client';

export function setupNotificationListeners() {
  DomainEventPublisher.subscribe('task.created', async (event: DomainEvent) => {
    const { taskId, projectId, taskTitle } = event.payload;

    // Fetch task and project settings to find assignees
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true }
    });

    if (task && task.assigneeId) {
      await NotificationService.send(
        task.assigneeId,
        'New Task Assigned',
        `You have been assigned to task "${taskTitle}" in project "${task.project.name}".`
      );
    }
  });

  DomainEventPublisher.subscribe('task.status_changed', async (event: DomainEvent) => {
    const { taskId, newStatus, taskTitle } = event.payload;
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    // Notify creator of status progress
    if (task && task.creatorId && task.creatorId !== task.assigneeId) {
      await NotificationService.send(
        task.creatorId,
        'Task Status Updated',
        `Task "${taskTitle}" has been moved to ${newStatus}.`
      );
    }
  });
}
