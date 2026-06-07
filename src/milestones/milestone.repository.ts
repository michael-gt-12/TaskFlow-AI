import { Prisma, Milestone, MilestoneStatus } from '@prisma/client';
import { BaseRepository, TxClient } from '../shared/base.repository';

export interface MilestoneListFilter {
  projectId: string;
  status?: MilestoneStatus;
  skip?: number;
  take?: number;
  orderBy?: Prisma.MilestoneOrderByWithRelationInput;
}

/**
 * Data-access layer for milestones. A milestone groups tasks toward a dated
 * deliverable; the repository owns the task roll-up queries used to decide
 * whether a milestone can be considered reached.
 */
export class MilestoneRepository extends BaseRepository {
  async create(data: Prisma.MilestoneUncheckedCreateInput, tx?: TxClient): Promise<Milestone> {
    return this.client(tx).milestone.create({ data });
  }

  async findById(id: string, tx?: TxClient): Promise<Milestone | null> {
    return this.client(tx).milestone.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.MilestoneUpdateInput, tx?: TxClient): Promise<Milestone> {
    return this.client(tx).milestone.update({ where: { id }, data });
  }

  async list(filter: MilestoneListFilter): Promise<{ items: Milestone[]; total: number }> {
    const where: Prisma.MilestoneWhereInput = { projectId: filter.projectId };
    if (filter.status) where.status = filter.status;

    const [items, total] = await Promise.all([
      this.prisma.milestone.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: filter.orderBy ?? [{ status: 'asc' }, { dueDate: 'asc' }],
        include: { _count: { select: { tasks: true } } },
      }),
      this.prisma.milestone.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * Count tasks attached to a milestone grouped by status, used to compute the
   * completion ratio shown on the milestone summary.
   */
  async countTasksByStatus(milestoneId: string, tx?: TxClient): Promise<Record<string, number>> {
    const groups = await this.client(tx).task.groupBy({
      by: ['status'],
      where: { milestoneId, deletedAt: null },
      _count: { _all: true },
    });
    const result: Record<string, number> = {};
    for (const group of groups) {
      result[group.status] = group._count._all;
    }
    return result;
  }

  /**
   * Number of tasks attached to the milestone that are not yet DONE. Zero means
   * every task is complete and the milestone is eligible to be marked reached.
   */
  async countOpenTasks(milestoneId: string, tx?: TxClient): Promise<number> {
    return this.client(tx).task.count({
      where: { milestoneId, deletedAt: null, status: { not: 'DONE' } },
    });
  }

  async assignTask(milestoneId: string, taskId: string, tx?: TxClient): Promise<void> {
    await this.client(tx).task.update({ where: { id: taskId }, data: { milestoneId } });
  }

  async removeTask(taskId: string, tx?: TxClient): Promise<void> {
    await this.client(tx).task.update({ where: { id: taskId }, data: { milestoneId: null } });
  }
}

export const milestoneRepository = new MilestoneRepository();
