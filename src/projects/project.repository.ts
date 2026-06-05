import { Prisma, Project, ProjectRole } from '@prisma/client';
import { BaseRepository, TxClient } from '../shared/base.repository';

export interface ProjectListFilter {
  organizationId: string;
  includeArchived?: boolean;
  leadId?: string;
  search?: string;
  skip?: number;
  take?: number;
  orderBy?: Prisma.ProjectOrderByWithRelationInput;
}

/**
 * Data-access layer for projects. Encapsulates all Prisma queries for the
 * project aggregate so the service layer stays focused on business rules.
 */
export class ProjectRepository extends BaseRepository {
  async create(data: Prisma.ProjectUncheckedCreateInput, tx?: TxClient): Promise<Project> {
    return this.client(tx).project.create({ data });
  }

  async findById(id: string, tx?: TxClient): Promise<Project | null> {
    return this.client(tx).project.findFirst({ where: { id, deletedAt: null } });
  }

  async findByIdWithRelations(id: string) {
    return this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        labels: true,
        _count: { select: { tasks: true, members: true, sprints: true, milestones: true } },
      },
    });
  }

  async findByKey(organizationId: string, key: string, tx?: TxClient): Promise<Project | null> {
    return this.client(tx).project.findFirst({
      where: { organizationId, key, deletedAt: null },
    });
  }

  async keyExists(organizationId: string, key: string, tx?: TxClient): Promise<boolean> {
    const count = await this.client(tx).project.count({ where: { organizationId, key } });
    return count > 0;
  }

  async list(filter: ProjectListFilter): Promise<{ items: Project[]; total: number }> {
    const where: Prisma.ProjectWhereInput = {
      organizationId: filter.organizationId,
      deletedAt: null,
    };
    if (!filter.includeArchived) where.isArchived = false;
    if (filter.leadId) where.leadId = filter.leadId;
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { key: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: filter.orderBy ?? { createdAt: 'desc' },
        include: { _count: { select: { tasks: true, members: true } } },
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: Prisma.ProjectUpdateInput, tx?: TxClient): Promise<Project> {
    return this.client(tx).project.update({ where: { id }, data });
  }

  async countActive(organizationId: string, tx?: TxClient): Promise<number> {
    return this.client(tx).project.count({
      where: { organizationId, isArchived: false, deletedAt: null },
    });
  }

  async addMember(
    projectId: string,
    userId: string,
    role: ProjectRole,
    tx?: TxClient
  ): Promise<void> {
    await this.client(tx).projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role },
      create: { projectId, userId, role },
    });
  }

  async removeMember(projectId: string, userId: string, tx?: TxClient): Promise<void> {
    await this.client(tx)
      .projectMember.delete({ where: { projectId_userId: { projectId, userId } } })
      .catch(() => undefined);
  }

  async listMembers(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getMember(projectId: string, userId: string) {
    return this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
  }

  /**
   * Allocate the next sequential task number within a project. Done inside the
   * provided transaction so concurrent task creation does not collide.
   */
  async nextTaskNumber(projectId: string, tx?: TxClient): Promise<number> {
    const max = await this.client(tx).task.aggregate({
      where: { projectId },
      _max: { number: true },
    });
    return (max._max.number ?? 0) + 1;
  }
}

export const projectRepository = new ProjectRepository();
