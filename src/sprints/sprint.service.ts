import { Sprint, SprintStatus } from '@prisma/client';
import { sprintRepository, SprintRepository } from './sprint.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../shared/errors';
import { CacheService } from '../utils/cache';
import { CacheKeys, CACHE_TTL_DEFAULT } from '../shared/constants';
import { DomainEventPublisher } from '../shared/events';
import { DomainEvents } from '../shared/domain-events';
import { UnitOfWork } from '../shared/unit-of-work';
import { OffsetPaginatedResult, buildOffsetMeta } from '../shared/types';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export interface CreateSprintInput {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateSprintInput {
  name?: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface ListSprintsInput {
  page: number;
  pageSize: number;
  status?: SprintStatus;
}

/**
 * Sprint service. Owns the agile planning lifecycle: sprints are drafted in a
 * PLANNED state, started (transitioning to ACTIVE), and finally COMPLETED or
 * CANCELLED. A project may only have one ACTIVE sprint at a time. Completing or
 * cancelling a sprint never drops unfinished work — it either rolls it over to a
 * target sprint or returns it to the project backlog.
 */
export class SprintService {
  private static repo: SprintRepository = sprintRepository;

  static async create(userId: string, input: CreateSprintInput): Promise<Sprint> {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
    });
    if (!project) throw new NotFoundError('Project');

    const { startDate, endDate } = this.normaliseWindow(input.startDate, input.endDate);

    const sprint = await this.repo.create({
      projectId: input.projectId,
      name: input.name.trim(),
      goal: input.goal?.trim() || null,
      status: SprintStatus.PLANNED,
      startDate,
      endDate,
    });

    await this.invalidate(sprint.id, input.projectId);
    logger.info(`Sprint ${sprint.id} created in project ${input.projectId}`);
    return sprint;
  }

  static async getById(sprintId: string): Promise<Sprint> {
    const cacheKey = CacheKeys.sprint(sprintId);
    const cached = await CacheService.get<Sprint>(cacheKey);
    if (cached) return cached;

    const sprint = await this.repo.findById(sprintId);
    if (!sprint) throw new NotFoundError('Sprint');

    await CacheService.set(cacheKey, sprint, CACHE_TTL_DEFAULT);
    return sprint;
  }

  static async list(projectId: string, input: ListSprintsInput): Promise<OffsetPaginatedResult<Sprint>> {
    const { items, total } = await this.repo.list({
      projectId,
      status: input.status,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });
    return { data: items, meta: buildOffsetMeta(input.page, input.pageSize, total) };
  }

  /**
   * Build a burndown-style summary for a sprint: task counts grouped by status,
   * completion totals and story point progress.
   */
  static async getSummary(sprintId: string) {
    const sprint = await this.getById(sprintId);
    const [tasksByStatus, storyPoints] = await Promise.all([
      this.repo.countTasksByStatus(sprintId),
      this.repo.sumStoryPoints(sprintId),
    ]);

    const totalTasks = Object.values(tasksByStatus).reduce((sum, n) => sum + n, 0);
    const completedTasks = tasksByStatus['DONE'] ?? 0;

    return { sprint, stats: { totalTasks, completedTasks, tasksByStatus, storyPoints } };
  }

  static async update(sprintId: string, input: UpdateSprintInput): Promise<Sprint> {
    const existing = await this.getById(sprintId);
    if (existing.status === SprintStatus.COMPLETED || existing.status === SprintStatus.CANCELLED) {
      throw new ConflictError('A completed or cancelled sprint can no longer be edited');
    }

    const start = input.startDate === undefined ? existing.startDate : this.parseDate(input.startDate);
    const end = input.endDate === undefined ? existing.endDate : this.parseDate(input.endDate);
    this.assertWindowOrder(start, end);

    const updated = await this.repo.update(sprintId, {
      name: input.name?.trim(),
      goal: input.goal === undefined ? undefined : input.goal?.trim() || null,
      startDate: input.startDate === undefined ? undefined : start,
      endDate: input.endDate === undefined ? undefined : end,
    });

    await this.invalidate(sprintId, existing.projectId);
    return updated;
  }

  /**
   * Transition a PLANNED sprint to ACTIVE. Fails if another sprint in the same
   * project is already active, enforcing the single-active-sprint invariant.
   */
  static async start(sprintId: string, userId: string): Promise<Sprint> {
    const existing = await this.getById(sprintId);
    if (existing.status !== SprintStatus.PLANNED) {
      throw new ConflictError(`Only PLANNED sprints can be started (current: ${existing.status})`);
    }

    const active = await this.repo.findActive(existing.projectId);
    if (active) {
      throw new ConflictError(
        `Project already has an active sprint (${active.name}). Complete it before starting another.`
      );
    }

    const updated = await UnitOfWork.execute(async (tx) => {
      const sprint = await this.repo.update(
        sprintId,
        {
          status: SprintStatus.ACTIVE,
          startDate: existing.startDate ?? new Date(),
        },
        tx
      );

      const orgId = await this.resolveOrgId(existing.projectId, tx);
      DomainEventPublisher.publish(DomainEvents.SprintStarted, {
        orgId,
        userId,
        projectId: existing.projectId,
        sprintId,
        sprintName: sprint.name,
      });
      return sprint;
    });

    await this.invalidate(sprintId, existing.projectId);
    logger.info(`Sprint ${sprintId} started`);
    return updated;
  }

  /**
   * Complete an ACTIVE sprint. Unfinished tasks are moved to `moveToSprintId`
   * when provided, otherwise returned to the backlog (sprintId cleared).
   */
  static async complete(
    sprintId: string,
    userId: string,
    moveToSprintId?: string
  ): Promise<Sprint> {
    const existing = await this.getById(sprintId);
    if (existing.status !== SprintStatus.ACTIVE) {
      throw new ConflictError(`Only ACTIVE sprints can be completed (current: ${existing.status})`);
    }

    if (moveToSprintId) {
      if (moveToSprintId === sprintId) {
        throw new BadRequestError('Cannot roll tasks over into the same sprint being completed');
      }
      const target = await this.repo.findById(moveToSprintId);
      if (!target || target.projectId !== existing.projectId) {
        throw new BadRequestError('Roll-over sprint must belong to the same project');
      }
      if (target.status === SprintStatus.COMPLETED || target.status === SprintStatus.CANCELLED) {
        throw new BadRequestError('Cannot roll tasks over into a closed sprint');
      }
    }

    const { sprint, completedTasks, carriedOverTasks } = await UnitOfWork.execute(async (tx) => {
      const points = await this.repo.countTasksByStatus(sprintId, tx);
      const completed = points['DONE'] ?? 0;
      const carried = await this.repo.moveUnfinishedTasks(sprintId, moveToSprintId ?? null, tx);

      const updated = await this.repo.update(sprintId, { status: SprintStatus.COMPLETED }, tx);

      const orgId = await this.resolveOrgId(existing.projectId, tx);
      DomainEventPublisher.publish(DomainEvents.SprintCompleted, {
        orgId,
        userId,
        projectId: existing.projectId,
        sprintId,
        sprintName: updated.name,
        completedTasks: completed,
        carriedOverTasks: carried,
      });
      return { sprint: updated, completedTasks: completed, carriedOverTasks: carried };
    });

    await this.invalidate(sprintId, existing.projectId);
    if (moveToSprintId) await CacheService.del(CacheKeys.sprint(moveToSprintId));
    logger.info(
      `Sprint ${sprintId} completed: ${completedTasks} done, ${carriedOverTasks} carried over`
    );
    return sprint;
  }

  /**
   * Cancel a PLANNED or ACTIVE sprint, detaching any tasks back to the backlog.
   */
  static async cancel(sprintId: string, userId: string): Promise<Sprint> {
    const existing = await this.getById(sprintId);
    if (existing.status === SprintStatus.COMPLETED || existing.status === SprintStatus.CANCELLED) {
      throw new ConflictError(`Sprint is already ${existing.status.toLowerCase()}`);
    }

    const updated = await UnitOfWork.execute(async (tx) => {
      await this.repo.moveUnfinishedTasks(sprintId, null, tx);
      const sprint = await this.repo.update(sprintId, { status: SprintStatus.CANCELLED }, tx);
      const orgId = await this.resolveOrgId(existing.projectId, tx);
      DomainEventPublisher.publish(DomainEvents.SprintCancelled, {
        orgId,
        userId,
        projectId: existing.projectId,
        sprintId,
        sprintName: sprint.name,
      });
      return sprint;
    });

    await this.invalidate(sprintId, existing.projectId);
    return updated;
  }

  static async assignTask(sprintId: string, taskId: string): Promise<void> {
    const sprint = await this.getById(sprintId);
    if (sprint.status === SprintStatus.COMPLETED || sprint.status === SprintStatus.CANCELLED) {
      throw new ConflictError('Cannot add tasks to a closed sprint');
    }
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundError('Task');
    if (task.projectId !== sprint.projectId) {
      throw new BadRequestError('Task and sprint must belong to the same project');
    }
    await this.repo.assignTask(sprintId, taskId);
    await this.invalidate(sprintId, sprint.projectId);
  }

  static async removeTask(sprintId: string, taskId: string): Promise<void> {
    const sprint = await this.getById(sprintId);
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task || task.sprintId !== sprintId) {
      throw new NotFoundError('Task in sprint');
    }
    await this.repo.removeTask(taskId);
    await this.invalidate(sprintId, sprint.projectId);
  }

  // --- internal helpers -----------------------------------------------------

  private static normaliseWindow(
    startRaw?: string,
    endRaw?: string
  ): { startDate: Date | null; endDate: Date | null } {
    const startDate = this.parseDate(startRaw ?? null);
    const endDate = this.parseDate(endRaw ?? null);
    this.assertWindowOrder(startDate, endDate);
    return { startDate, endDate };
  }

  private static parseDate(value: string | null): Date | null {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid date value');
    return date;
  }

  private static assertWindowOrder(start: Date | null, end: Date | null): void {
    if (start && end && start.getTime() > end.getTime()) {
      throw new BadRequestError('Sprint start date must be on or before the end date');
    }
  }

  private static async resolveOrgId(projectId: string, tx: any): Promise<string> {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    return project?.organizationId ?? '';
  }

  private static async invalidate(sprintId: string, projectId: string): Promise<void> {
    await CacheService.del(CacheKeys.sprint(sprintId));
    await CacheService.delPattern(CacheKeys.sprintListPattern(projectId));
  }
}
