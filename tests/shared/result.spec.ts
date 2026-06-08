import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  mapResult,
  tryCatch,
  collect,
  partition,
  Result,
} from '../../src/shared/result';

describe('result', () => {
  describe('ok / err / isOk / isErr', () => {
    it('constructs and narrows an Ok', () => {
      const r = ok(42);
      expect(r).toEqual({ ok: true, value: 42 });
      expect(isOk(r)).toBe(true);
      expect(isErr(r)).toBe(false);
    });

    it('constructs and narrows an Err', () => {
      const e = new Error('boom');
      const r = err(e);
      expect(r).toEqual({ ok: false, error: e });
      expect(isErr(r)).toBe(true);
      expect(isOk(r)).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('returns the value for an Ok', () => {
      expect(unwrap(ok('hello'))).toBe('hello');
    });

    it('throws the original Error for an Err', () => {
      const e = new Error('failure');
      expect(() => unwrap(err(e))).toThrow(e);
    });

    it('wraps a non-Error reason in an Error before throwing', () => {
      expect(() => unwrap(err('string reason'))).toThrow('string reason');
    });
  });

  describe('unwrapOr', () => {
    it('returns the value for Ok and the fallback for Err', () => {
      expect(unwrapOr(ok(1), 99)).toBe(1);
      expect(unwrapOr(err(new Error()), 99)).toBe(99);
    });
  });

  describe('mapResult', () => {
    it('maps the value of an Ok', () => {
      expect(mapResult(ok(2), (n) => n * 10)).toEqual(ok(20));
    });

    it('passes an Err through untouched', () => {
      const e: Result<number, Error> = err(new Error('x'));
      expect(mapResult(e, (n) => n * 10)).toBe(e);
    });
  });

  describe('tryCatch', () => {
    it('wraps a resolved value in Ok', async () => {
      const r = await tryCatch(async () => 'good');
      expect(r).toEqual(ok('good'));
    });

    it('wraps a thrown Error in Err', async () => {
      const r = await tryCatch(async () => {
        throw new Error('nope');
      });
      expect(isErr(r)).toBe(true);
      expect((r as any).error.message).toBe('nope');
    });

    it('coerces a thrown non-Error into an Error', async () => {
      const r = await tryCatch(async () => {
        throw 'string throw';
      });
      expect(isErr(r)).toBe(true);
      expect((r as any).error).toBeInstanceOf(Error);
      expect((r as any).error.message).toBe('string throw');
    });
  });

  describe('collect', () => {
    it('returns all values when every result is Ok', () => {
      expect(collect([ok(1), ok(2), ok(3)])).toEqual(ok([1, 2, 3]));
    });

    it('returns the first Err encountered', () => {
      const e = err(new Error('second failed'));
      const result = collect([ok(1), e, ok(3)]);
      expect(result).toBe(e);
    });
  });

  describe('partition', () => {
    it('separates values from errors', () => {
      const e1 = new Error('a');
      const e2 = new Error('b');
      const { values, errors } = partition([ok(1), err(e1), ok(2), err(e2)]);
      expect(values).toEqual([1, 2]);
      expect(errors).toEqual([e1, e2]);
    });
  });
});
