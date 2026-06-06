import { Sprint } from '@prisma/client';

export interface SprintDto {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  taskCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SprintSummaryDto extends SprintDto {
  stats: {
    totalTasks: number;
    completedTasks: number;
    tasksByStatus: Record<string, number>;
    storyPoints: { total: number; completed: number };
    completionRate: number;
  };
}

export class SprintMapper {
  static toDto(sprint: Sprint & { _count?: { tasks: number } }): SprintDto {
    return {
      id: sprint.id,
      projectId: sprint.projectId,
      name: sprint.name,
      goal: sprint.goal,
      status: sprint.status,
      startDate: sprint.startDate ? sprint.startDate.toISOString() : null,
      endDate: sprint.endDate ? sprint.endDate.toISOString() : null,
      taskCount: sprint._count?.tasks,
      createdAt: sprint.createdAt.toISOString(),
      updatedAt: sprint.updatedAt.toISOString(),
    };
  }

  static toDtoList(sprints: Array<Sprint & { _count?: { tasks: number } }>): SprintDto[] {
    return sprints.map((sprint) => this.toDto(sprint));
  }

  static toSummaryDto(
    sprint: Sprint,
    stats: {
      totalTasks: number;
      completedTasks: number;
      tasksByStatus: Record<string, number>;
      storyPoints: { total: number; completed: number };
    }
  ): SprintSummaryDto {
    const completionRate =
      stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) / 100 : 0;
    return {
      ...this.toDto(sprint),
      stats: { ...stats, completionRate },
    };
  }
}
