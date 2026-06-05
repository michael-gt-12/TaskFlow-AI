import { Prisma } from '@prisma/client';
import { prisma } from '../database/client';
import { DomainEventPublisher } from './events';
import { logger } from './logger';

export type TransactionClient = Prisma.TransactionClient;

/**
 * Unit of Work coordinates a database transaction with the domain event
 * publisher. Events published from within the callback are buffered and only
 * dispatched after the database transaction commits successfully, ensuring
 * listeners never observe state that was subsequently rolled back.
 *
 * This wraps the lower level DomainEventPublisher transaction primitives so
 * services don't have to remember the start/commit/rollback dance.
 */
export class UnitOfWork {
  /**
   * Execute `work` inside a Prisma transaction with event buffering. On success
   * the buffered events are flushed; on failure they are discarded and the
   * error is rethrown.
   */
  static async execute<T>(
    work: (tx: TransactionClient) => Promise<T>,
    options?: { timeoutMs?: number }
  ): Promise<T> {
    DomainEventPublisher.startTransaction();
    try {
      const result = await prisma.$transaction(
        async (tx) => work(tx),
        options?.timeoutMs ? { timeout: options.timeoutMs } : undefined
      );
      await DomainEventPublisher.commitTransaction();
      return result;
    } catch (error) {
      DomainEventPublisher.rollbackTransaction();
      logger.error('UnitOfWork transaction rolled back:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Run multiple independent operations and collect their results. Unlike
   * execute this does not share a single transaction; it is a convenience for
   * read-mostly aggregation work.
   */
  static async all<T extends readonly unknown[]>(
    operations: { [K in keyof T]: () => Promise<T[K]> }
  ): Promise<T> {
    return Promise.all(operations.map((op) => op())) as unknown as Promise<T>;
  }
}
