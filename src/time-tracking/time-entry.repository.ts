import { Prisma, TimeEntry } from '@prisma/client';
import { BaseRepository, TxClient } from '../shared/base.repository';

export interface TimeEntryListFilter {
  taskId?: string;
  userId?: string;
  skip?: number;
  take?: number;
}

export interface UserTimeTotal {
  userId: string;
  minutes: number;
}

/**
 * Data-access layer for time entries. Beyond CRUD it owns the roll-up queries
 * used to total logged minutes per task and per contributor, which the service
 * exposes as task time summaries.
 */
export class TimeEntryRepository extends BaseRepository {
  async create(data: Prisma.TimeEntryUncheckedCreateInput, tx?: TxClient): Promise<TimeEntry> {
    return this.client(tx).timeEntry.create({ data });
  }

  async findById(id: string, tx?: TxClient): Promise<TimeEntry | null> {
    return this.client(tx).timeEntry.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.TimeEntryUpdateInput, tx?: TxClient): Promise<TimeEntry> {
    return this.client(tx).timeEntry.update({ where: { id }, data });
  }

  async delete(id: string, tx?: TxClient): Promise<void> {
    await this.client(tx).timeEntry.delete({ where: { id } });
  }

  async list(filter: TimeEntryListFilter): Promise<{ items: TimeEntry[]; total: number }> {
    const where: Prisma.TimeEntryWhereInput = {};
    if (filter.taskId) where.taskId = filter.taskId;
    if (filter.userId) where.userId = filter.userId;

    const [items, total] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { loggedAt: 'desc' },
      }),
      this.prisma.timeEntry.count({ where }),
    ]);
    return { items, total };
  }

  /** Total minutes logged against a task across all contributors. */
  async totalMinutesForTask(taskId: string, tx?: TxClient): Promise<number> {
    const result = await this.client(tx).timeEntry.aggregate({
      where: { taskId },
      _sum: { minutes: true },
    });
    return result._sum.minutes ?? 0;
  }

  /** Minutes logged against a task broken down by contributor. */
  async minutesByUserForTask(taskId: string, tx?: TxClient): Promise<UserTimeTotal[]> {
    const groups = await this.client(tx).timeEntry.groupBy({
      by: ['userId'],
      where: { taskId },
      _sum: { minutes: true },
    });
    return groups.map((g) => ({ userId: g.userId, minutes: g._sum.minutes ?? 0 }));
  }
}

export const timeEntryRepository = new TimeEntryRepository();
