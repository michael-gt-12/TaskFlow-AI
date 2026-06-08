import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  uuidSchema,
  slugSchema,
  colorSchema,
  emailSchema,
  passwordSchema,
  paginationQuerySchema,
  isoDateStringSchema,
  validate,
  formatZodIssues,
  requireNonEmpty,
  ensureUuid,
} from '../../src/shared/validation';
import { BadRequestError } from '../../src/shared/errors';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('validation', () => {
  describe('schema fragments', () => {
    it('uuidSchema accepts a uuid and rejects junk', () => {
      expect(uuidSchema.safeParse(VALID_UUID).success).toBe(true);
      expect(uuidSchema.safeParse('nope').success).toBe(false);
    });

    it('slugSchema enforces the slug shape', () => {
      expect(slugSchema.safeParse('my-project').success).toBe(true);
      expect(slugSchema.safeParse('Bad Slug').success).toBe(false);
      expect(slugSchema.safeParse('a').success).toBe(false); // too short
    });

    it('colorSchema accepts 3 and 6 digit hex', () => {
      expect(colorSchema.safeParse('#fff').success).toBe(true);
      expect(colorSchema.safeParse('#3b82f6').success).toBe(true);
      expect(colorSchema.safeParse('blue').success).toBe(false);
    });

    it('emailSchema validates addresses', () => {
      expect(emailSchema.safeParse('a@b.com').success).toBe(true);
      expect(emailSchema.safeParse('not-email').success).toBe(false);
    });

    it('passwordSchema requires length and character classes', () => {
      expect(passwordSchema.safeParse('Password1').success).toBe(true);
      expect(passwordSchema.safeParse('short1A').success).toBe(false); // too short
      expect(passwordSchema.safeParse('alllowercase1').success).toBe(false); // no uppercase
      expect(passwordSchema.safeParse('NoNumbersHere').success).toBe(false); // no digit
    });

    it('paginationQuerySchema coerces and bounds first', () => {
      expect(paginationQuerySchema.parse({ first: '10' }).first).toBe(10);
      expect(paginationQuerySchema.safeParse({ first: '500' }).success).toBe(false);
      expect(paginationQuerySchema.safeParse({ orderDirection: 'sideways' }).success).toBe(false);
    });

    it('isoDateStringSchema requires an ISO datetime', () => {
      expect(isoDateStringSchema.safeParse('2026-03-15T00:00:00Z').success).toBe(true);
      expect(isoDateStringSchema.safeParse('2026-03-15').success).toBe(false);
    });
  });

  describe('validate', () => {
    it('returns parsed data on success', () => {
      const schema = z.object({ name: z.string() });
      expect(validate(schema, { name: 'ok' })).toEqual({ name: 'ok' });
    });

    it('throws BadRequestError with structured details on failure', () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      try {
        validate(schema, { name: 123 });
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestError);
        const details = (e as BadRequestError).details as Array<{ path: string; message: string }>;
        expect(details.some((d) => d.path === 'name')).toBe(true);
        expect(details.some((d) => d.path === 'age')).toBe(true);
      }
    });
  });

  describe('formatZodIssues', () => {
    it('joins nested paths with dots and labels root issues', () => {
      const schema = z.object({ nested: z.object({ value: z.string() }) });
      const result = schema.safeParse({ nested: { value: 1 } });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = formatZodIssues(result.error);
        expect(issues[0].path).toBe('nested.value');
      }
    });
  });

  describe('requireNonEmpty', () => {
    it('returns the trimmed value', () => {
      expect(requireNonEmpty('  hello  ', 'name')).toBe('hello');
    });

    it('throws for non-strings and blank strings', () => {
      expect(() => requireNonEmpty('   ', 'name')).toThrow(BadRequestError);
      expect(() => requireNonEmpty(undefined, 'name')).toThrow(/name is required/);
    });
  });

  describe('ensureUuid', () => {
    it('returns a valid uuid', () => {
      expect(ensureUuid(VALID_UUID, 'id')).toBe(VALID_UUID);
    });

    it('throws BadRequestError for an invalid uuid', () => {
      expect(() => ensureUuid('abc', 'taskId')).toThrow(/taskId must be a valid identifier/);
    });
  });
});
