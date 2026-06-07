import { Milestone } from '@prisma/client';

export interface MilestoneDto {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  reachedAt: string | null;
  taskCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneSummaryDto extends MilestoneDto {
  stats: {
    totalTasks: number;
    completedTasks: number;
    openTasks: number;
    tasksByStatus: Record<string, number>;
    completionRate: number;
    isOverdue: boolean;
  };
}

export class MilestoneMapper {
  static toDto(milestone: Milestone & { _count?: { tasks: number } }): MilestoneDto {
    return {
      id: milestone.id,
      projectId: milestone.projectId,
      name: milestone.name,
      description: milestone.description,
      status: milestone.status,
      dueDate: milestone.dueDate ? milestone.dueDate.toISOString() : null,
      reachedAt: milestone.reachedAt ? milestone.reachedAt.toISOString() : null,
      taskCount: milestone._count?.tasks,
      createdAt: milestone.createdAt.toISOString(),
      updatedAt: milestone.updatedAt.toISOString(),
    };
  }

  static toDtoList(milestones: Array<Milestone & { _count?: { tasks: number } }>): MilestoneDto[] {
    return milestones.map((milestone) => this.toDto(milestone));
  }

  static toSummaryDto(
    milestone: Milestone,
    stats: {
      totalTasks: number;
      completedTasks: number;
      openTasks: number;
      tasksByStatus: Record<string, number>;
    }
  ): MilestoneSummaryDto {
    const completionRate =
      stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) / 100 : 0;
    const isOverdue =
      milestone.status === 'OPEN' &&
      milestone.dueDate != null &&
      milestone.dueDate.getTime() < Date.now();
    return {
      ...this.toDto(milestone),
      stats: { ...stats, completionRate, isOverdue },
    };
  }
}
