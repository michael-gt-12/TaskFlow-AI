import { Prisma, Sprint, SprintStatus } from '@prisma/client';
import { BaseRepository, TxClient } from '../shared/base.repository';

export interface SprintListFilter {
  projectId: string;
  status?: SprintStatus;
  skip?: number;
  take?: number;
  orderBy?: Prisma.SprintOrderByWithRelationInput;
}

/**
 * Data-access layer for sprints. Owns all Prisma queries for the sprint
 * aggregate, including the task-status roll-ups the service uses to compute
 * burndown style summaries.
 */
export class SprintRepository extends BaseRepository {
  async create(data: Prisma.SprintUncheckedCreateInput, tx?: TxClient): Promise<Sprint> {
    return this.client(tx).sprint.create({ data });
  }

  async findById(id: string, tx?: TxClient): Promise<Sprint | null> {
    return this.client(tx).sprint.findUnique({ where: { id } });
  }

  async findByIdWithProject(id: string) {
    return this.prisma.sprint.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, organizationId: true, name: true, key: true } },
        _count: { select: { tasks: true } },
      },
    });
  }

  async update(id: string, data: Prisma.SprintUpdateInput, tx?: TxClient): Promise<Sprint> {
    return this.client(tx).sprint.update({ where: { id }, data });
  }

  async list(filter: SprintListFilter): Promise<{ items: Sprint[]; total: number }> {
    const where: Prisma.SprintWhereInput = { projectId: filter.projectId };
    if (filter.status) where.status = filter.status;

    const [items, total] = await Promise.all([
      this.prisma.sprint.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: filter.orderBy ?? [{ status: 'asc' }, { startDate: 'desc' }],
        include: { _count: { select: { tasks: true } } },
      }),
      this.prisma.sprint.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * The single ACTIVE sprint for a project, if one exists. A project may only
   * have one sprint in flight at a time, so callers treat this as a uniqueness
   * guard before starting a new sprint.
   */
  async findActive(projectId: string, tx?: TxClient): Promise<Sprint | null> {
    return this.client(tx).sprint.findFirst({
      where: { projectId, status: SprintStatus.ACTIVE },
    });
  }

  /**
   * Count tasks in a sprint grouped by status. Returns a plain map keyed by the
   * task status so the service can derive completion totals without loading
   * every task row.
   */
  async countTasksByStatus(sprintId: string, tx?: TxClient): Promise<Record<string, number>> {
    const groups = await this.client(tx).task.groupBy({
      by: ['status'],
      where: { sprintId, deletedAt: null },
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const group of groups) {
      result[group.status] = group._count._all;
    }
    return result;
  }

  /**
   * Sum of story points in a sprint, split into completed (DONE) and total.
   */
  async sumStoryPoints(sprintId: string, tx?: TxClient): Promise<{ total: number; completed: number }> {
    const client = this.client(tx);
    const [total, completed] = await Promise.all([
      client.task.aggregate({
        where: { sprintId, deletedAt: null },
        _sum: { storyPoints: true },
      }),
      client.task.aggregate({
        where: { sprintId, deletedAt: null, status: 'DONE' },
        _sum: { storyPoints: true },
      }),
    ]);
    return {
      total: total._sum.storyPoints ?? 0,
      completed: completed._sum.storyPoints ?? 0,
    };
  }

  async assignTask(sprintId: string, taskId: string, tx?: TxClient): Promise<void> {
    await this.client(tx).task.update({ where: { id: taskId }, data: { sprintId } });
  }

  async removeTask(taskId: string, tx?: TxClient): Promise<void> {
    await this.client(tx).task.update({ where: { id: taskId }, data: { sprintId: null } });
  }

  /**
   * Move every unfinished task (anything not DONE) off the sprint, optionally
   * onto a target sprint. Used when a sprint is completed or cancelled so work
   * is never silently lost. Returns the number of tasks moved.
   */
  async moveUnfinishedTasks(
    sprintId: string,
    targetSprintId: string | null,
    tx?: TxClient
  ): Promise<number> {
    const result = await this.client(tx).task.updateMany({
      where: { sprintId, deletedAt: null, status: { not: 'DONE' } },
      data: { sprintId: targetSprintId },
    });
    return result.count;
  }
}

export const sprintRepository = new SprintRepository();
