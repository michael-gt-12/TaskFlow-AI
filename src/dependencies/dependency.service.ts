import { TaskDependency, DependencyType } from '@prisma/client';
import { dependencyRepository, DependencyRepository, DependencyEdge } from './dependency.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../shared/errors';
import { DomainEventPublisher } from '../shared/events';
import { DomainEvents } from '../shared/domain-events';
import { UnitOfWork } from '../shared/unit-of-work';
import { prisma } from '../database/client';
import { logger } from '../shared/logger';

export interface CreateDependencyInput {
  sourceTaskId: string;
  targetTaskId: string;
  type?: DependencyType;
}

interface TaskSummary {
  id: string;
  title: string;
  status: string;
}

export interface TaskDependencyGraph {
  taskId: string;
  /** Tasks this task blocks / is otherwise the source of. */
  outgoing: Array<{ id: string; type: DependencyType; task: TaskSummary }>;
  /** Tasks that point at this task (e.g. things blocking it). */
  incoming: Array<{ id: string; type: DependencyType; task: TaskSummary }>;
}

/**
 * Task dependency service. Dependencies are directed edges between two tasks in
 * the same project. BLOCKS edges express ordering ("source must finish before
 * target") and must keep the graph acyclic — adding one is rejected if it would
 * close a loop. The other relation types (RELATES_TO, DUPLICATES) are purely
 * informational and skip cycle detection.
 */
export class DependencyService {
  private static repo: DependencyRepository = dependencyRepository;

  static async create(userId: string, input: CreateDependencyInput): Promise<TaskDependency> {
    const type = input.type ?? DependencyType.BLOCKS;

    if (input.sourceTaskId === input.targetTaskId) {
      throw new BadRequestError('A task cannot depend on itself');
    }

    const [source, target] = await Promise.all([
      prisma.task.findFirst({ where: { id: input.sourceTaskId, deletedAt: null } }),
      prisma.task.findFirst({ where: { id: input.targetTaskId, deletedAt: null } }),
    ]);
    if (!source) throw new NotFoundError('Source task');
    if (!target) throw new NotFoundError('Target task');
    if (source.projectId !== target.projectId) {
      throw new BadRequestError('Dependencies can only link tasks in the same project');
    }

    const existing = await this.repo.findPair(input.sourceTaskId, input.targetTaskId, type);
    if (existing) {
      throw new ConflictError('This dependency already exists');
    }

    // Only ordering edges are cycle-checked; a loop of BLOCKS edges would make
    // the work unschedulable, so reject the edge that closes it.
    if (type === DependencyType.BLOCKS) {
      const edges = await this.repo.loadBlockEdges(source.projectId);
      if (this.wouldCreateCycle(edges, input.sourceTaskId, input.targetTaskId)) {
        throw new ConflictError(
          'Adding this dependency would create a cycle in the task graph'
        );
      }
    }

    const dependency = await UnitOfWork.execute(async (tx) => {
      const created = await this.repo.create(
        {
          sourceTaskId: input.sourceTaskId,
          targetTaskId: input.targetTaskId,
          type,
        },
        tx
      );
      const orgId = await this.resolveOrgId(source.projectId, tx);
      DomainEventPublisher.publish(DomainEvents.TaskDependencyAdded, {
        orgId,
        userId,
        projectId: source.projectId,
        sourceTaskId: input.sourceTaskId,
        targetTaskId: input.targetTaskId,
        type,
      });
      return created;
    });

    logger.info(
      `Dependency ${dependency.id} (${type}) added: ${input.sourceTaskId} -> ${input.targetTaskId}`
    );
    return dependency;
  }

  static async remove(dependencyId: string, userId: string): Promise<void> {
    const dependency = await this.repo.findById(dependencyId);
    if (!dependency) throw new NotFoundError('Dependency');

    await UnitOfWork.execute(async (tx) => {
      await this.repo.delete(dependencyId, tx);
      const source = await tx.task.findUnique({
        where: { id: dependency.sourceTaskId },
        select: { projectId: true },
      });
      const projectId = source?.projectId ?? '';
      const orgId = projectId ? await this.resolveOrgId(projectId, tx) : '';
      DomainEventPublisher.publish(DomainEvents.TaskDependencyRemoved, {
        orgId,
        userId,
        projectId,
        sourceTaskId: dependency.sourceTaskId,
        targetTaskId: dependency.targetTaskId,
        type: dependency.type,
      });
    });

    logger.info(`Dependency ${dependencyId} removed`);
  }

  /**
   * Return the dependencies touching a task split by direction, so callers can
   * distinguish "this task blocks X" from "Y blocks this task".
   */
  static async listForTask(taskId: string): Promise<TaskDependencyGraph> {
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) throw new NotFoundError('Task');

    const rows = await this.repo.listForTask(taskId);
    const outgoing: TaskDependencyGraph['outgoing'] = [];
    const incoming: TaskDependencyGraph['incoming'] = [];

    for (const row of rows) {
      if (row.sourceTaskId === taskId) {
        outgoing.push({ id: row.id, type: row.type, task: row.target });
      } else {
        incoming.push({ id: row.id, type: row.type, task: row.source });
      }
    }

    return { taskId, outgoing, incoming };
  }

  // --- internal helpers -----------------------------------------------------

  /**
   * Decide whether adding the edge source -> target would introduce a cycle.
   * We treat the existing BLOCKS edges as a directed graph and ask whether
   * `target` can already reach `source`; if it can, the new edge closes a loop.
   */
  private static wouldCreateCycle(
    edges: DependencyEdge[],
    source: string,
    target: string
  ): boolean {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const list = adjacency.get(edge.sourceTaskId);
      if (list) list.push(edge.targetTaskId);
      else adjacency.set(edge.sourceTaskId, [edge.targetTaskId]);
    }

    // DFS from `target`; if we ever reach `source`, the edge would be a back-edge.
    const stack = [target];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === source) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbours = adjacency.get(current);
      if (neighbours) stack.push(...neighbours);
    }
    return false;
  }

  private static async resolveOrgId(projectId: string, tx: any): Promise<string> {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    return project?.organizationId ?? '';
  }
}
