import { DomainEventPublisher, DomainEvent } from '../shared/events';
import { ActivityService } from './activity.service';

export function setupActivityListeners() {
  DomainEventPublisher.subscribe('task.created', async (event: DomainEvent) => {
    const { userId, orgId, projectId, taskId, taskTitle } = event.payload;
    await ActivityService.log(
      userId,
      orgId,
      projectId,
      taskId,
      'TASK_CREATE',
      { title: taskTitle }
    );
  });

  DomainEventPublisher.subscribe('task.status_changed', async (event: DomainEvent) => {
    const { userId, orgId, projectId, taskId, oldStatus, newStatus, taskTitle } = event.payload;
    await ActivityService.log(
      userId,
      orgId,
      projectId,
      taskId,
      'TASK_STATUS_CHANGE',
      { title: taskTitle, oldStatus, newStatus }
    );
  });

  DomainEventPublisher.subscribe('task.updated', async (event: DomainEvent) => {
    const { userId, orgId, projectId, taskId, taskTitle } = event.payload;
    await ActivityService.log(
      userId,
      orgId,
      projectId,
      taskId,
      'TASK_UPDATE',
      { title: taskTitle }
    );
  });
}
