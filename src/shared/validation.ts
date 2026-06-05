import { z } from 'zod';
import { BadRequestError } from './errors';

/**
 * Reusable zod fragments and validation helpers shared by module schemas. These
 * keep validation rules consistent (e.g. one definition of what a valid slug or
 * colour looks like) across organizations, projects and labels.
 */

export const uuidSchema = z.string().uuid('Must be a valid UUID');

export const slugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(64, 'Slug must be at most 64 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers and hyphens');

export const colorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex colour');

export const emailSchema = z.string().email('Must be a valid email address').max(254);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const paginationQuerySchema = z.object({
  first: z.coerce.number().int().min(1).max(100).optional(),
  after: z.string().optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

export const isoDateStringSchema = z
  .string()
  .datetime({ message: 'Must be an ISO 8601 datetime string' });

/**
 * Validate a value against a schema, converting zod failures into the
 * platform's BadRequestError with a structured field list.
 */
export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError('Validation failed', formatZodIssues(result.error));
  }
  return result.data;
}

export function formatZodIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Ensure a value is a non-empty trimmed string, returning the trimmed value.
 */
export function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestError(`${field} is required`);
  }
  return value.trim();
}

export function ensureUuid(value: unknown, field: string): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError(`${field} must be a valid identifier`);
  }
  return result.data;
}
