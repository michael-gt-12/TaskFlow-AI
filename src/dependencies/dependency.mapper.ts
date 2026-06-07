import { TaskDependency } from '@prisma/client';
import { TaskDependencyGraph } from './dependency.service';

export interface DependencyDto {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: string;
  createdAt: string;
}

interface RelatedTaskDto {
  id: string;
  title: string;
  status: string;
}

export interface DependencyEdgeDto {
  id: string;
  type: string;
  task: RelatedTaskDto;
}

export interface DependencyGraphDto {
  taskId: string;
  outgoing: DependencyEdgeDto[];
  incoming: DependencyEdgeDto[];
}

export class DependencyMapper {
  static toDto(dependency: TaskDependency): DependencyDto {
    return {
      id: dependency.id,
      sourceTaskId: dependency.sourceTaskId,
      targetTaskId: dependency.targetTaskId,
      type: dependency.type,
      createdAt: dependency.createdAt.toISOString(),
    };
  }

  static toGraphDto(graph: TaskDependencyGraph): DependencyGraphDto {
    return {
      taskId: graph.taskId,
      outgoing: graph.outgoing.map((e) => ({ id: e.id, type: e.type, task: e.task })),
      incoming: graph.incoming.map((e) => ({ id: e.id, type: e.type, task: e.task })),
    };
  }
}
