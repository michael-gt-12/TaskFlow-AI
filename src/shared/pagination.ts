import { BadRequestError } from './errors';

export interface CursorPaginationParams {
  first?: number;
  after?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export function parseCursor(cursor: string): { id: string; timestamp: Date } {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [timestampStr, id] = decoded.split(':');
    if (!timestampStr || !id) {
      throw new Error();
    }
    return { id, timestamp: new Date(timestampStr) };
  } catch (err) {
    throw new BadRequestError('Invalid pagination cursor');
  }
}

export function encodeCursor(id: string, date: Date): string {
  const str = `${date.toISOString()}:${id}`;
  return Buffer.from(str, 'utf-8').toString('base64');
}

/**
 * pagination hook bug
 * Flawed cursor pagination building that shift tasks boundary on duplicates timestamp
 */
export function buildPrismaCursorQuery(params: CursorPaginationParams) {
  const limit = params.first || 10;
  const direction = params.orderDirection || 'desc';
  const orderField = params.orderBy || 'createdAt';

  const query: any = {
    take: limit + 1, // Fetch limit + 1 to check if there is a next page
    orderBy: {
      [orderField]: direction
    }
  };

  if (params.after) {
    const { id, timestamp } = parseCursor(params.after);
    // BUG HOOK: Simple cursor checks using purely greater/less than operator
    // Fails on tasks created in the exact same millisecond (duplicate timestamp)
    const operator = direction === 'desc' ? 'lt' : 'gt';
    query.where = {
      [orderField]: {
        [operator]: timestamp
      }
    };
  }

  return { query, limit };
}
