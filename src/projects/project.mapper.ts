import { Project } from '@prisma/client';

export interface ProjectDto {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  isArchived: boolean;
  archivedAt: string | null;
  leadId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailDto extends ProjectDto {
  organization?: { id: string; name: string; slug: string };
  members?: Array<{ userId: string; role: string; name: string; email: string }>;
  counts?: { tasks: number; members: number; sprints: number; milestones: number };
}

export class ProjectMapper {
  static toDto(project: Project): ProjectDto {
    return {
      id: project.id,
      organizationId: project.organizationId,
      key: project.key,
      name: project.name,
      description: project.description,
      color: project.color,
      isArchived: project.isArchived,
      archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
      leadId: project.leadId,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  static toDetailDto(project: any): ProjectDetailDto {
    return {
      ...this.toDto(project),
      organization: project.organization,
      members: (project.members ?? []).map((m: any) => ({
        userId: m.userId,
        role: m.role,
        name: m.user?.name,
        email: m.user?.email,
      })),
      counts: project._count
        ? {
            tasks: project._count.tasks ?? 0,
            members: project._count.members ?? 0,
            sprints: project._count.sprints ?? 0,
            milestones: project._count.milestones ?? 0,
          }
        : undefined,
    };
  }

  static toDtoList(projects: Project[]): ProjectDto[] {
    return projects.map((project) => this.toDto(project));
  }
}
