import { DomainEventPublisher, DomainEvent } from '../shared/events';
import { SearchService } from './search.service';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export function setupSearchListeners() {
  DomainEventPublisher.subscribe('task.created', async (event: DomainEvent) => {
    const { taskId, taskTitle } = event.payload;
    const documentText = `task ${taskTitle} state:todo`;
    await SearchService.indexEntity('TASK', taskId, documentText);
  });

  /**
   * BUG HOOK: Race condition on event indexing!
   * Under heavy concurrency of task updates, listeners write asynchronously using Prisma upsert.
   * However, there is no sequence locking or version checking on the SearchIndex record.
   * If 'task.updated' events are processed out-of-order, an older state might overwrite a newer state!
   */
  DomainEventPublisher.subscribe('task.updated', async (event: DomainEvent) => {
    const { taskId, taskTitle } = event.payload;
    
    // Simulate slight race condition window (random latency up to 50ms)
    const delay = Math.floor(Math.random() * 50);
    await new Promise(r => setTimeout(r, delay));

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
