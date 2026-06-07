import { Prisma, TaskDependency, DependencyType } from '@prisma/client';
import { BaseRepository, TxClient } from '../shared/base.repository';

export interface DependencyEdge {
  sourceTaskId: string;
  targetTaskId: string;
}

/**
 * Data-access layer for task dependencies. Beyond plain CRUD it exposes the
 * edge-loading query the service uses to walk the dependency graph and reject
 * cycles before a new BLOCKS edge is committed.
 */
export class DependencyRepository extends BaseRepository {
  async create(
    data: Prisma.TaskDependencyUncheckedCreateInput,
    tx?: TxClient
  ): Promise<TaskDependency> {
    return this.client(tx).taskDependency.create({ data });
  }

  async findById(id: string, tx?: TxClient): Promise<TaskDependency | null> {
    return this.client(tx).taskDependency.findUnique({ where: { id } });
  }

  async findPair(
    sourceTaskId: string,
    targetTaskId: string,
    type: DependencyType,
    tx?: TxClient
  ): Promise<TaskDependency | null> {
    return this.client(tx).taskDependency.findUnique({
      where: {
        sourceTaskId_targetTaskId_type: { sourceTaskId, targetTaskId, type },
      },
    });
  }

  async delete(id: string, tx?: TxClient): Promise<void> {
    await this.client(tx).taskDependency.delete({ where: { id } });
  }

  /**
   * All dependency rows that touch a task in either direction, with a light
   * task summary on both ends so the API can render labels without extra
   * round-trips.
   */
  async listForTask(taskId: string, tx?: TxClient): Promise<
    Array<
      TaskDependency & {
        source: { id: string; title: string; status: string };
        target: { id: string; title: string; status: string };
      }
    >
  > {
    return this.client(tx).taskDependency.findMany({
      where: { OR: [{ sourceTaskId: taskId }, { targetTaskId: taskId }] },
      include: {
        source: { select: { id: true, title: true, status: true } },
        target: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    }) as any;
  }

  /**
   * Load every BLOCKS edge whose source task belongs to the given project. Only
   * BLOCKS edges participate in cycle detection — RELATES_TO / DUPLICATES are
   * informational and may form loops freely.
   */
  async loadBlockEdges(projectId: string, tx?: TxClient): Promise<DependencyEdge[]> {
    const rows = await this.client(tx).taskDependency.findMany({
      where: { type: DependencyType.BLOCKS, source: { projectId } },
      select: { sourceTaskId: true, targetTaskId: true },
    });
    return rows.map((r) => ({ sourceTaskId: r.sourceTaskId, targetTaskId: r.targetTaskId }));
  }
}

export const dependencyRepository = new DependencyRepository();
