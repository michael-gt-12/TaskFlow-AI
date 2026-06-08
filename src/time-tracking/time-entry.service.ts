import { TimeEntry } from '@prisma/client';
import { timeEntryRepository, TimeEntryRepository } from './time-entry.repository';
import { NotFoundError, BadRequestError, ForbiddenError } from '../shared/errors';
import { CacheService } from '../utils/cache';
import { CacheKeys, CACHE_TTL_DEFAULT } from '../shared/constants';
import { OffsetPaginatedResult, buildOffsetMeta } from '../shared/types';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export interface LogTimeInput {
  taskId: string;
  minutes: number;
  description?: string;
  startedAt?: string;
}

export interface UpdateTimeEntryInput {
  minutes?: number;
  description?: string | null;
  startedAt?: string | null;
}

export interface ListTimeEntriesInput {
  taskId?: string;
  userId?: string;
  page: number;
  pageSize: number;
}

export interface TaskTimeSummary {
  taskId: string;
  totalMinutes: number;
  totalHours: number;
  byUser: Array<{ userId: string; minutes: number }>;
}

/**
 * Time-tracking service. Contributors log work against a task in whole minutes;
 * an entry belongs to the user who logged it and only its owner may edit or
 * delete it. The service also exposes per-task roll-ups (total and per-user)
 * used by reporting and the task detail view.
 */
export class TimeEntryService {
  private static repo: TimeEntryRepository = timeEntryRepository;

  static async log(userId: string, input: LogTimeInput): Promise<TimeEntry> {
    const task = await prisma.task.findFirst({ where: { id: input.taskId, deletedAt: null } });
    if (!task) throw new NotFoundError('Task');

    const startedAt = this.parseDate(input.startedAt ?? null);

    const entry = await this.repo.create({
      taskId: input.taskId,
      userId,
      minutes: input.minutes,
      description: input.description?.trim() || null,
      startedAt,
    });

    await this.invalidate(input.taskId);
    logger.info(`Time entry ${entry.id}: ${input.minutes}m logged on task ${input.taskId} by ${userId}`);
    return entry;
  }

  static async list(input: ListTimeEntriesInput): Promise<OffsetPaginatedResult<TimeEntry>> {
    const { items, total } = await this.repo.list({
      taskId: input.taskId,
      userId: input.userId,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });
    return { data: items, meta: buildOffsetMeta(input.page, input.pageSize, total) };
  }

  static async update(
    entryId: string,
    userId: string,
    input: UpdateTimeEntryInput
  ): Promise<TimeEntry> {
    const existing = await this.requireOwned(entryId, userId);

    const updated = await this.repo.update(entryId, {
      minutes: input.minutes,
      description:
        input.description === undefined ? undefined : input.description?.trim() || null,
      startedAt: input.startedAt === undefined ? undefined : this.parseDate(input.startedAt),
    });

    await this.invalidate(existing.taskId);
    return updated;
  }

  static async remove(entryId: string, userId: string): Promise<void> {
    const existing = await this.requireOwned(entryId, userId);
    await this.repo.delete(entryId);
    await this.invalidate(existing.taskId);
    logger.info(`Time entry ${entryId} deleted by ${userId}`);
  }

  /**
   * Total and per-contributor minutes logged against a task. Cached because the
   * task detail view reads it on every open while writes are comparatively rare.
   */
  static async getTaskSummary(taskId: string): Promise<TaskTimeSummary> {
    const cacheKey = CacheKeys.taskTimeSummary(taskId);
    const cached = await CacheService.get<TaskTimeSummary>(cacheKey);
    if (cached) return cached;

    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundError('Task');

    const [totalMinutes, byUser] = await Promise.all([
      this.repo.totalMinutesForTask(taskId),
      this.repo.minutesByUserForTask(taskId),
    ]);

    const summary: TaskTimeSummary = {
      taskId,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      byUser,
    };
    await CacheService.set(cacheKey, summary, CACHE_TTL_DEFAULT);
    return summary;
  }

  // --- internal helpers -----------------------------------------------------

  private static async requireOwned(entryId: string, userId: string): Promise<TimeEntry> {
    const entry = await this.repo.findById(entryId);
    if (!entry) throw new NotFoundError('Time entry');
    if (entry.userId !== userId) {
      throw new ForbiddenError('You can only modify your own time entries');
    }
    return entry;
  }

  private static parseDate(value: string | null): Date | null {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid date value');
    return date;
  }

  private static async invalidate(taskId: string): Promise<void> {
    await CacheService.del(CacheKeys.taskTimeSummary(taskId));
  }
}
