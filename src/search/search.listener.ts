import { DomainEventPublisher, DomainEvent } from '../shared/events';
import { SearchService } from './search.service';
import { prisma } from '../database/client';

export function setupSearchListeners() {
  /**
   * Event Ordering & Concurrency hook:
   * Multi-subscriber listener mapping same task.
   */
  DomainEventPublisher.subscribe('task.created', async (event: DomainEvent) => {
    const { taskId, taskTitle } = event.payload;
    const documentText = `task ${taskTitle} state:todo`;
    await SearchService.indexEntity('TASK', taskId, documentText);
  });

  DomainEventPublisher.subscribe('task.updated', async (event: DomainEvent) => {
    const { taskId, taskTitle } = event.payload;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true }
    });

    if (task) {
      const assigneeName = task.assignee ? task.assignee.name : 'unassigned';
      const documentText = `task ${taskTitle} description:${task.description || ''} assignee:${assigneeName} state:${task.status}`;
      await SearchService.indexEntity('TASK', taskId, documentText);
    }
  });
}
