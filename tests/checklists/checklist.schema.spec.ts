import { describe, it, expect } from 'vitest';
import {
  CreateChecklistSchema,
  UpdateChecklistSchema,
  AddChecklistItemSchema,
  UpdateChecklistItemSchema,
} from '../../src/checklists/checklist.schema';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('checklist.schema', () => {
  describe('CreateChecklistSchema', () => {
    it('accepts a valid body', () => {
      const r = CreateChecklistSchema.safeParse({ body: { taskId: UUID, title: 'QA steps' } });
      expect(r.success).toBe(true);
    });

    it('rejects a non-uuid taskId', () => {
      const r = CreateChecklistSchema.safeParse({ body: { taskId: 'nope', title: 'QA' } });
      expect(r.success).toBe(false);
    });

    it('rejects an empty title', () => {
      const r = CreateChecklistSchema.safeParse({ body: { taskId: UUID, title: '' } });
      expect(r.success).toBe(false);
    });

    it('rejects a title longer than 200 chars', () => {
      const r = CreateChecklistSchema.safeParse({ body: { taskId: UUID, title: 'a'.repeat(201) } });
      expect(r.success).toBe(false);
    });
  });

  describe('UpdateChecklistSchema', () => {
    it('accepts a valid title', () => {
      expect(UpdateChecklistSchema.safeParse({ body: { title: 'New' } }).success).toBe(true);
    });

    it('rejects an empty title', () => {
      expect(UpdateChecklistSchema.safeParse({ body: { title: '' } }).success).toBe(false);
    });

    it('rejects a title longer than 200 chars', () => {
      expect(
        UpdateChecklistSchema.safeParse({ body: { title: 'a'.repeat(201) } }).success
      ).toBe(false);
    });
  });

  describe('AddChecklistItemSchema', () => {
    it('accepts valid content', () => {
      expect(AddChecklistItemSchema.safeParse({ body: { content: 'do it' } }).success).toBe(true);
    });

    it('rejects empty content', () => {
      expect(AddChecklistItemSchema.safeParse({ body: { content: '' } }).success).toBe(false);
    });

    it('rejects content longer than 500 chars', () => {
      expect(
        AddChecklistItemSchema.safeParse({ body: { content: 'a'.repeat(501) } }).success
      ).toBe(false);
    });
  });

  describe('UpdateChecklistItemSchema', () => {
    it('accepts an empty body (both fields optional)', () => {
      expect(UpdateChecklistItemSchema.safeParse({ body: {} }).success).toBe(true);
    });

    it('accepts content + isComplete', () => {
      expect(
        UpdateChecklistItemSchema.safeParse({ body: { content: 'x', isComplete: true } }).success
      ).toBe(true);
    });

    it('rejects a non-boolean isComplete', () => {
      expect(
        UpdateChecklistItemSchema.safeParse({ body: { isComplete: 'yes' } }).success
      ).toBe(false);
    });

    it('rejects content longer than 500 chars', () => {
      expect(
        UpdateChecklistItemSchema.safeParse({ body: { content: 'a'.repeat(501) } }).success
      ).toBe(false);
    });
  });
});
