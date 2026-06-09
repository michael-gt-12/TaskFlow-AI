import { describe, it, expect } from 'vitest';
import { CreateDependencySchema } from '../../src/dependencies/dependency.schema';

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';

describe('dependency.schema', () => {
  describe('CreateDependencySchema', () => {
    it('accepts a body with both task ids and no type', () => {
      const r = CreateDependencySchema.safeParse({
        body: { sourceTaskId: UUID_A, targetTaskId: UUID_B },
      });
      expect(r.success).toBe(true);
    });

    it('accepts an explicit valid dependency type', () => {
      const r = CreateDependencySchema.safeParse({
        body: { sourceTaskId: UUID_A, targetTaskId: UUID_B, type: 'RELATES_TO' },
      });
      expect(r.success).toBe(true);
    });

    it('rejects a non-uuid sourceTaskId', () => {
      const r = CreateDependencySchema.safeParse({
        body: { sourceTaskId: 'nope', targetTaskId: UUID_B },
      });
      expect(r.success).toBe(false);
    });

    it('rejects a non-uuid targetTaskId', () => {
      const r = CreateDependencySchema.safeParse({
        body: { sourceTaskId: UUID_A, targetTaskId: 'nope' },
      });
      expect(r.success).toBe(false);
    });

    it('rejects an unknown dependency type', () => {
      const r = CreateDependencySchema.safeParse({
        body: { sourceTaskId: UUID_A, targetTaskId: UUID_B, type: 'WHATEVER' },
      });
      expect(r.success).toBe(false);
    });

    it('requires targetTaskId', () => {
      const r = CreateDependencySchema.safeParse({ body: { sourceTaskId: UUID_A } });
      expect(r.success).toBe(false);
    });
  });
});
