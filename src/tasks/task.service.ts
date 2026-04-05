import { prisma } from '../database/client';
import { NotFoundError } from '../shared/errors';
import { DomainEventPublisher } from '../shared/events';
import { CacheService } from '../utils/cache';
import { logger } from '../shared/logger';

export class TaskService {
  /**
   * Transaction Rollback and cache invalidation hooks
   */
  static async create(userId: string, orgId: string, data: any) {
    DomainEventPublisher.startTransaction();

    try {
      const task = await prisma.$transaction(async (tx) => {
        const newTask = await tx.task.create({
          data: {
            title: data.title,
            description: data.description || '',
            projectId: data.projectId,
            status: data.status || 'TODO',
            priority: data.priority || 'MEDIUM',
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            creatorId: userId,
            assigneeId: data.assigneeId || null
          }
        });

        if (data.labelIds && data.labelIds.length > 0) {
          const taskLabels = data.labelIds.map((lId: string) => ({
            taskId: newTask.id,
            labelId: lId
          }));
          await tx.taskLabel.createMany({ data: taskLabels });
        }

        return newTask;
      });

      // Queue domain event
      DomainEventPublisher.publish('task.created', {
        taskId: task.id,
        projectId: task.projectId,
        orgId,
        userId,
        taskTitle: task.title
      });

      /**
       * BUG HOOK: Transaction isolation error!
       * The DomainEventPublisher commitTransaction is run OUTSIDE of the Prisma transaction.
       * If a listener (e.g., SearchIndexListener or ActivityLogListener) throws a synchronous
       * error during event dispatch, this outer create method throws an error to the caller,
       * but the task has ALREADY been committed to the database!
       */
      await DomainEventPublisher.commitTransaction();

      // Clear related task list cache
      await CacheService.delPattern(`tasks:project:${task.projectId}:*`);

      return task;
    } catch (error) {
      DomainEventPublisher.rollbackTransaction();
      logger.error('Error occurred in task creation execution:', error);
      throw error;
    }
  }

  static async getById(taskId: string) {
    const cacheKey = `task:${taskId}`;
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) return cached;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        creator: true,
        assignee: true,
        project: true,
        labels: { include: { label: true } }
      }
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    await CacheService.set(cacheKey, task, 300);
    return task;
  }

  static async update(taskId: string, userId: string, orgId: string, data: any) {
    DomainEventPublisher.startTransaction();

    try {
      const oldTask = await this.getById(taskId);
      
      const updatedTask = await prisma.$transaction(async (tx) => {
        const { labelIds, ...fields } = data;
        const updateData: any = { ...fields };
        if (fields.dueDate !== undefined) updateData.dueDate = fields.dueDate ? new Date(fields.dueDate) : null;

        const task = await tx.task.update({
          where: { id: taskId },
          data: updateData
        });

        if (labelIds !== undefined) {
          await tx.taskLabel.deleteMany({ where: { taskId } });
          if (labelIds.length > 0) {
            const taskLabels = labelIds.map((lId: string) => ({
              taskId,
              labelId: lId
            }));
            await tx.taskLabel.createMany({ data: taskLabels });
          }
        }

        return task;
      });

      // Check status changes
      if (data.status && data.status !== oldTask.status) {
        DomainEventPublisher.publish('task.status_changed', {
          taskId,
          projectId: updatedTask.projectId,
          orgId,
          userId,
          oldStatus: oldTask.status,
          newStatus: updatedTask.status,
          taskTitle: updatedTask.title
        });
      }

      DomainEventPublisher.publish('task.updated', {
        taskId,
        projectId: updatedTask.projectId,
        orgId,
        userId,
        taskTitle: updatedTask.title
      });

      await DomainEventPublisher.commitTransaction();

      // Invalidate cache
      await CacheService.del(`task:${taskId}`);
      await CacheService.delPattern(`tasks:project:${updatedTask.projectId}:*`);

      return updatedTask;
    } catch (err) {
      DomainEventPublisher.rollbackTransaction();
      throw err;
    }
  }
}
