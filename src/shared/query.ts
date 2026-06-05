import { BadRequestError } from './errors';

/**
 * Generic query-string parsing helpers shared by list endpoints. These convert
 * raw Express query objects into typed, validated filter/sort/pagination
 * descriptors that repositories can translate into Prisma queries.
 */

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

export interface OffsetPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function parseIntParam(
  raw: unknown,
  fallback: number,
  { min, max }: { min?: number; max?: number } = {}
): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestError(`Expected a numeric value but received "${String(raw)}"`);
  }
  let value = Math.trunc(parsed);
  if (min !== undefined) value = Math.max(value, min);
  if (max !== undefined) value = Math.min(value, max);
  return value;
}

export function parseOffsetPagination(query: Record<string, unknown>): OffsetPagination {
  const page = parseIntParam(query.page, 1, { min: 1 });
  const pageSize = parseIntParam(query.pageSize ?? query.limit, DEFAULT_PAGE_SIZE, {
    min: 1,
    max: MAX_PAGE_SIZE,
  });
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Parse a sort expression such as `-createdAt` or `priority` into a structured
 * spec, validating the field against an allow-list to prevent arbitrary column
 * access.
 */
export function parseSort(
  raw: unknown,
  allowedFields: string[],
  fallback: SortSpec
): SortSpec {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  const direction: 'asc' | 'desc' = raw.startsWith('-') ? 'desc' : 'asc';
  const field = raw.replace(/^[-+]/, '');
  if (!allowedFields.includes(field)) {
    throw new BadRequestError(
      `Cannot sort by "${field}". Allowed fields: ${allowedFields.join(', ')}`
    );
  }
  return { field, direction };
}

/**
 * Parse a comma-separated list query parameter into a string array.
 */
export function parseList(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) return raw.map(String);
  return String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseBoolean(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

export function parseDate(raw: unknown): Date | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`Invalid date value: "${String(raw)}"`);
  }
  return date;
}

/**
 * Build a Prisma `orderBy` clause from a SortSpec, tie-breaking on id to keep
 * pagination stable.
 */
export function toPrismaOrderBy(sort: SortSpec): Array<Record<string, 'asc' | 'desc'>> {
  return [{ [sort.field]: sort.direction }, { id: sort.direction }];
}
