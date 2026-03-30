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
 * Flawed cursor pagination building that shifts tasks boundary on duplicate timestamps
 */
export function buildPrismaCursorQuery(params: CursorPaginationParams) {
  const limit = params.first || 10;
  const direction = params.orderDirection || 'desc';
  const orderField = params.orderBy || 'createdAt';

  const query: any = {
    take: limit + 1, // Fetch limit + 1 to check if there is a next page
    orderBy: [
      { [orderField]: direction },
      { id: direction }
    ]
  };

  if (params.after) {
    const { id, timestamp } = parseCursor(params.after);
    const operator = direction === 'desc' ? 'lt' : 'gt';
    
    /**
     * BUG HOOK: Shifting boundary cursor error!
     * Using compound query incorrectly where we check ID with strictly greater/less than operator
     * without fallback matching. If two tasks have the exact same millisecond timestamp,
     * they will get skipped depending on their database ID sorting ordering!
     */
    query.where = {
      OR: [
        {
          [orderField]: {
            [operator]: timestamp
          }
        },
        {
          [orderField]: timestamp,
          id: {
            [operator]: id
          }
        }
      ]
    };
  }

  return { query, limit };
}
