import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from './logger';

/**
 * Transaction client type — either the root Prisma client or a transactional
 * proxy handed out by `prisma.$transaction`. Repositories accept this so they
 * can participate in a caller-controlled transaction.
 */
export type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * BaseRepository centralises the boilerplate every entity repository needs:
 * access to the shared prisma client, a helper to run inside an existing or new
 * transaction, and consistent logging. Concrete repositories extend this and
 * expose entity-specific query methods.
 */
export abstract class BaseRepository {
  protected readonly prisma: PrismaClient;

  constructor(client: PrismaClient = prisma) {
    this.prisma = client;
  }

  /**
   * Return the transactional client if one was passed, otherwise the shared
   * client. This lets repository methods accept an optional `tx` argument and
   * transparently enlist in an outer transaction.
   */
  protected client(tx?: TxClient): TxClient {
    return tx ?? this.prisma;
  }

  /**
   * Run a function inside a transaction. If a transaction client is already
   * provided the function reuses it (nested transactions collapse into the
   * outermost one), otherwise a new transaction is opened.
   */
  protected async withTransaction<T>(
    fn: (tx: TxClient) => Promise<T>,
    tx?: TxClient
  ): Promise<T> {
    if (tx) return fn(tx);
    return this.prisma.$transaction(async (innerTx) => fn(innerTx));
  }

  protected logQuery(method: string, meta?: Record<string, unknown>): void {
    logger.info(`[${this.constructor.name}] ${method}`, meta ?? '');
  }
}
