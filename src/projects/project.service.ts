import { Project, ProjectRole } from '@prisma/client';
import { projectRepository, ProjectRepository } from './project.repository';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../shared/errors';
import { CacheService } from '../utils/cache';
import { CacheKeys, CACHE_TTL_DEFAULT, DEFAULT_LABELS } from '../shared/constants';
import { DomainEventPublisher } from '../shared/events';
import { DomainEvents } from '../shared/domain-events';
import { UnitOfWork } from '../shared/unit-of-work';
import { deriveProjectKey } from '../shared/strings';
import { OffsetPaginatedResult, buildOffsetMeta } from '../shared/types';
import { prisma } from '../database/client';
import { BillingService } from '../billing/billing.service';
import { logger } from '../shared/logger';

export interface CreateProjectInput {
  name: string;
  description?: string;
  key?: string;
  color?: string;
  leadId?: string;
  templateId?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
  leadId?: string | null;
}

export interface ListProjectsInput {
  page: number;
  pageSize: number;
  includeArchived?: boolean;
  search?: string;
  leadId?: string;
}

/**
 * Project service. Owns the business rules around project creation, archival,
 * restoration, ownership transfer and membership. Creation provisions a default
 * set of labels and enrols the creator (or designated lead) as project lead.
 */
export class ProjectService {
  private static repo: ProjectRepository = projectRepository;

  static async create(orgId: string, userId: string, input: CreateProjectInput): Promise<Project> {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestError('Project name is required');
    }

    await BillingService.checkProjectLimit(orgId);

    const key = await this.resolveUniqueKey(orgId, input.key ?? deriveProjectKey(input.name));
    const leadId = input.leadId ?? userId;

    const project = await UnitOfWork.execute(async (tx) => {
      const created = await tx.project.create({
        data: {
          organizationId: orgId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          key,
          color: input.color ?? '#3b82f6',
          leadId,
          templateId: input.templateId ?? null,
        },
      });

      await tx.projectMember.create({
        data: { projectId: created.id, userId: leadId, role: ProjectRole.LEAD },
      });

      // Provision the default label palette so new projects are immediately
      // usable for triage.
      await tx.label.createMany({
        data: DEFAULT_LABELS.map((label) => ({
          projectId: created.id,
          name: label.name,
          color: label.color,
        })),
        skipDuplicates: true,
      });

      DomainEventPublisher.publish(DomainEvents.ProjectCreated, {
        orgId,
        userId,
        projectId: created.id,
        projectName: created.name,
      });

      return created;
    });

    await CacheService.delPattern(CacheKeys.projectListPattern(orgId));
    logger.info(`Project ${project.key} created in org ${orgId}`);
    return project;
  }

  static async getById(projectId: string): Promise<Project> {
    const cacheKey = CacheKeys.project(projectId);
    const cached = await CacheService.get<Project>(cacheKey);
    if (cached) return cached;

    const project = await this.repo.findById(projectId);
    if (!project) throw new NotFoundError('Project');

    await CacheService.set(cacheKey, project, CACHE_TTL_DEFAULT);
    return project;
  }

  static async getDetail(projectId: string) {
    const project = await this.repo.findByIdWithRelations(projectId);
    if (!project) throw new NotFoundError('Project');
    return project;
  }

  static async list(orgId: string, input: ListProjectsInput): Promise<OffsetPaginatedResult<Project>> {
    const { items, total } = await this.repo.list({
      organizationId: orgId,
      includeArchived: input.includeArchived,
      search: input.search,
      leadId: input.leadId,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });
    return { data: items, meta: buildOffsetMeta(input.page, input.pageSize, total) };
  }

  static async update(projectId: string, userId: string, input: UpdateProjectInput): Promise<Project> {
    const existing = await this.getById(projectId);
    if (existing.isArchived) {
      throw new ForbiddenError('Archived projects cannot be edited until restored');
    }

    const updated = await this.repo.update(projectId, {
      name: input.name?.trim(),
      description: input.description?.trim(),
      color: input.color,
      leadId: input.leadId === null ? null : input.leadId,
    });

    DomainEventPublisher.publish(DomainEvents.ProjectUpdated, {
      orgId: existing.organizationId,
      userId,
      projectId,
      projectName: updated.name,
    });

    await this.invalidate(projectId, existing.organizationId);
    return updated;
  }

  static async archive(projectId: string, userId: string): Promise<Project> {
    const existing = await this.getById(projectId);
    if (existing.isArchived) throw new ConflictError('Project is already archived');

    const updated = await this.repo.update(projectId, {
      isArchived: true,
      archivedAt: new Date(),
    });

    DomainEventPublisher.publish(DomainEvents.ProjectArchived, {
      orgId: existing.organizationId,
      userId,
      projectId,
      projectName: updated.name,
    });

    await this.invalidate(projectId, existing.organizationId);
    return updated;
  }

  static async restore(projectId: string, userId: string): Promise<Project> {
    const existing = await this.getById(projectId);
    if (!existing.isArchived) throw new ConflictError('Project is not archived');

    const updated = await this.repo.update(projectId, {
      isArchived: false,
      archivedAt: null,
    });

    DomainEventPublisher.publish(DomainEvents.ProjectRestored, {
      orgId: existing.organizationId,
      userId,
      projectId,
      projectName: updated.name,
    });

    await this.invalidate(projectId, existing.organizationId);
    return updated;
  }

  static async softDelete(projectId: string, userId: string): Promise<void> {
    const existing = await this.getById(projectId);
    await this.repo.update(projectId, { deletedAt: new Date(), isArchived: true });
    DomainEventPublisher.publish(DomainEvents.ProjectDeleted, {
      orgId: existing.organizationId,
      userId,
      projectId,
      projectName: existing.name,
    });
    await this.invalidate(projectId, existing.organizationId);
  }

  /**
   * Transfer the project lead role to another member of the organization,
   * demoting the previous lead to contributor.
   */
  static async transferLead(projectId: string, userId: string, newLeadId: string): Promise<Project> {
    const existing = await this.getById(projectId);
    const targetMembership = await prisma.orgMember.findUnique({
      where: {
        organizationId_userId: { organizationId: existing.organizationId, userId: newLeadId },
      },
    });
    if (!targetMembership) {
      throw new BadRequestError('New lead must be a member of the organization');
    }

    return UnitOfWork.execute(async (tx) => {
      if (existing.leadId) {
        await tx.projectMember
          .update({
            where: { projectId_userId: { projectId, userId: existing.leadId } },
            data: { role: ProjectRole.CONTRIBUTOR },
          })
          .catch(() => undefined);
      }
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: newLeadId } },
        update: { role: ProjectRole.LEAD },
        create: { projectId, userId: newLeadId, role: ProjectRole.LEAD },
      });
      const updated = await tx.project.update({ where: { id: projectId }, data: { leadId: newLeadId } });
      await this.invalidate(projectId, existing.organizationId);
      return updated;
    });
  }

  static async addMember(projectId: string, userId: string, role: ProjectRole): Promise<void> {
    await this.getById(projectId);
    await this.repo.addMember(projectId, userId, role);
  }

  static async removeMember(projectId: string, userId: string): Promise<void> {
    const project = await this.getById(projectId);
    if (project.leadId === userId) {
      throw new ConflictError('Reassign the project lead before removing them');
    }
    await this.repo.removeMember(projectId, userId);
  }

  static async listMembers(projectId: string) {
    await this.getById(projectId);
    return this.repo.listMembers(projectId);
  }

  private static async resolveUniqueKey(orgId: string, base: string): Promise<string> {
    let candidate = base.toUpperCase().slice(0, 10);
    if (!(await this.repo.keyExists(orgId, candidate))) return candidate;
    for (let suffix = 2; suffix < 100; suffix++) {
      candidate = `${base.toUpperCase().slice(0, 8)}${suffix}`;
      if (!(await this.repo.keyExists(orgId, candidate))) return candidate;
    }
    throw new ConflictError('Unable to allocate a unique project key');
  }

  private static async invalidate(projectId: string, orgId: string): Promise<void> {
    await CacheService.del(CacheKeys.project(projectId));
    await CacheService.delPattern(CacheKeys.projectListPattern(orgId));
  }
}
