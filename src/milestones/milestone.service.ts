import { Milestone, MilestoneStatus } from '@prisma/client';
import { milestoneRepository, MilestoneRepository } from './milestone.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../shared/errors';
import { CacheService } from '../utils/cache';
import { CacheKeys, CACHE_TTL_DEFAULT } from '../shared/constants';
import { DomainEventPublisher } from '../shared/events';
import { DomainEvents } from '../shared/domain-events';
import { UnitOfWork } from '../shared/unit-of-work';
import { OffsetPaginatedResult, buildOffsetMeta } from '../shared/types';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export interface CreateMilestoneInput {
  projectId: string;
  name: string;
  description?: string;
  dueDate?: string;
}

export interface UpdateMilestoneInput {
  name?: string;
  description?: string | null;
  dueDate?: string | null;
}

export interface ListMilestonesInput {
  page: number;
  pageSize: number;
  status?: MilestoneStatus;
}

/**
 * Milestone service. A milestone is a dated deliverable that tasks are attached
 * to. Milestones move OPEN -> REACHED (all work done, or force-closed) or
 * OPEN -> MISSED, and can be reopened back to OPEN. Reaching a milestone is
 * guarded: by default every attached task must be DONE unless the caller forces
 * it, which keeps the "reached" signal trustworthy for reporting.
 */
export class MilestoneService {
  private static repo: MilestoneRepository = milestoneRepository;

  static async create(userId: string, input: CreateMilestoneInput): Promise<Milestone> {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, deletedAt: null },
    });
    if (!project) throw new NotFoundError('Project');

    const dueDate = this.parseDate(input.dueDate ?? null);

    const milestone = await this.repo.create({
      projectId: input.projectId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: MilestoneStatus.OPEN,
      dueDate,
    });

    await this.invalidate(milestone.id, input.projectId);
    logger.info(`Milestone ${milestone.id} created in project ${input.projectId}`);
    return milestone;
  }

  static async getById(milestoneId: string): Promise<Milestone> {
    const cacheKey = CacheKeys.milestone(milestoneId);
    const cached = await CacheService.get<Milestone>(cacheKey);
    if (cached) return cached;

    const milestone = await this.repo.findById(milestoneId);
    if (!milestone) throw new NotFoundError('Milestone');

    await CacheService.set(cacheKey, milestone, CACHE_TTL_DEFAULT);
    return milestone;
  }

  static async list(
    projectId: string,
    input: ListMilestonesInput
  ): Promise<OffsetPaginatedResult<Milestone>> {
    const { items, total } = await this.repo.list({
      projectId,
      status: input.status,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });
    return { data: items, meta: buildOffsetMeta(input.page, input.pageSize, total) };
  }

  static async getSummary(milestoneId: string) {
    const milestone = await this.getById(milestoneId);
    const tasksByStatus = await this.repo.countTasksByStatus(milestoneId);
    const totalTasks = Object.values(tasksByStatus).reduce((sum, n) => sum + n, 0);
    const completedTasks = tasksByStatus['DONE'] ?? 0;
    const openTasks = totalTasks - completedTasks;
    return { milestone, stats: { totalTasks, completedTasks, openTasks, tasksByStatus } };
  }

  static async update(milestoneId: string, input: UpdateMilestoneInput): Promise<Milestone> {
    const existing = await this.getById(milestoneId);
    if (existing.status !== MilestoneStatus.OPEN) {
      throw new ConflictError('Only OPEN milestones can be edited; reopen it first');
    }

    const updated = await this.repo.update(milestoneId, {
      name: input.name?.trim(),
      description:
        input.description === undefined ? undefined : input.description?.trim() || null,
      dueDate: input.dueDate === undefined ? undefined : this.parseDate(input.dueDate),
    });

    await this.invalidate(milestoneId, existing.projectId);
    return updated;
  }

  /**
   * Mark a milestone as reached. Unless `force` is set, every attached task must
   * already be DONE — otherwise the call is rejected so the milestone history
   * stays meaningful.
   */
  static async markReached(
    milestoneId: string,
    userId: string,
    force = false
  ): Promise<Milestone> {
    const existing = await this.getById(milestoneId);
    if (existing.status === MilestoneStatus.REACHED) {
      throw new ConflictError('Milestone is already reached');
    }

    if (!force) {
      const openTasks = await this.repo.countOpenTasks(milestoneId);
      if (openTasks > 0) {
        throw new ConflictError(
          `${openTasks} task(s) on this milestone are not yet done. Complete them or pass force=true.`
        );
      }
    }

    const updated = await UnitOfWork.execute(async (tx) => {
      const milestone = await this.repo.update(
        milestoneId,
        { status: MilestoneStatus.REACHED, reachedAt: new Date() },
        tx
      );
      const orgId = await this.resolveOrgId(existing.projectId, tx);
      DomainEventPublisher.publish(DomainEvents.MilestoneReached, {
        orgId,
        userId,
        projectId: existing.projectId,
        milestoneId,
        milestoneName: milestone.name,
      });
      return milestone;
    });

    await this.invalidate(milestoneId, existing.projectId);
    logger.info(`Milestone ${milestoneId} reached`);
    return updated;
  }

  /**
   * Mark a milestone as missed (its due date passed without completion).
   */
  static async markMissed(milestoneId: string, userId: string): Promise<Milestone> {
    const existing = await this.getById(milestoneId);
    if (existing.status !== MilestoneStatus.OPEN) {
      throw new ConflictError(`Only OPEN milestones can be marked missed (current: ${existing.status})`);
    }

    const updated = await UnitOfWork.execute(async (tx) => {
      const milestone = await this.repo.update(milestoneId, { status: MilestoneStatus.MISSED }, tx);
      const orgId = await this.resolveOrgId(existing.projectId, tx);
      DomainEventPublisher.publish(DomainEvents.MilestoneMissed, {
        orgId,
        userId,
        projectId: existing.projectId,
        milestoneId,
        milestoneName: milestone.name,
      });
      return milestone;
    });

    await this.invalidate(milestoneId, existing.projectId);
    return updated;
  }

  /**
   * Reopen a reached or missed milestone, clearing the reached timestamp.
   */
  static async reopen(milestoneId: string): Promise<Milestone> {
    const existing = await this.getById(milestoneId);
    if (existing.status === MilestoneStatus.OPEN) {
      throw new ConflictError('Milestone is already open');
    }
    const updated = await this.repo.update(milestoneId, {
      status: MilestoneStatus.OPEN,
      reachedAt: null,
    });
    await this.invalidate(milestoneId, existing.projectId);
    return updated;
  }

  static async assignTask(milestoneId: string, taskId: string): Promise<void> {
    const milestone = await this.getById(milestoneId);
    if (milestone.status !== MilestoneStatus.OPEN) {
      throw new ConflictError('Cannot attach tasks to a closed milestone');
    }
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundError('Task');
    if (task.projectId !== milestone.projectId) {
      throw new BadRequestError('Task and milestone must belong to the same project');
    }
    await this.repo.assignTask(milestoneId, taskId);
    await this.invalidate(milestoneId, milestone.projectId);
  }

  static async removeTask(milestoneId: string, taskId: string): Promise<void> {
    const milestone = await this.getById(milestoneId);
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task || task.milestoneId !== milestoneId) {
      throw new NotFoundError('Task in milestone');
    }
    await this.repo.removeTask(taskId);
    await this.invalidate(milestoneId, milestone.projectId);
  }

  // --- internal helpers -----------------------------------------------------

  private static parseDate(value: string | null): Date | null {
    if (value === null || value === undefined) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid date value');
    return date;
  }

  private static async resolveOrgId(projectId: string, tx: any): Promise<string> {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    return project?.organizationId ?? '';
  }

  private static async invalidate(milestoneId: string, projectId: string): Promise<void> {
    await CacheService.del(CacheKeys.milestone(milestoneId));
    await CacheService.delPattern(CacheKeys.milestoneListPattern(projectId));
  }
}
