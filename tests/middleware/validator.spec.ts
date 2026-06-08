import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateRequest } from '../../src/middleware/validator';
import { z, ZodError } from 'zod';
import { BadRequestError } from '../../src/shared/errors';

describe('Validator Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
    };
    res = {};
    next = vi.fn();
  });

  const testSchema = z.object({
    body: z.object({
      email: z.string().email(),
      age: z.number().min(18).optional(),
    }),
    query: z.object({
      search: z.string().optional(),
    }),
    params: z.object({
      id: z.string(),
    }),
  });

  it('should validate valid request and update body, query, and params', async () => {
    req.body = { email: 'valid@example.com', age: 25, extra: 'field' };
    req.query = { search: 'term' };
    req.params = { id: 'user-123' };

    const middleware = validateRequest(testSchema);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error
    // Checked properties should only contain validated schema properties
    expect(req.body).toEqual({ email: 'valid@example.com', age: 25 });
    expect(req.query).toEqual({ search: 'term' });
    expect(req.params).toEqual({ id: 'user-123' });
  });

  it('should call next with BadRequestError when Zod validation fails', async () => {
    req.body = { email: 'invalid-email', age: 10 };
    req.query = {};
    req.params = {}; // missing id in params

    const middleware = validateRequest(testSchema);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(BadRequestError);
    expect(error.message).toBe('Validation failed');
    expect(error.details).toHaveLength(3); // invalid email, age too small, missing id in params
    expect(error.details).toContainEqual({ field: 'body.email', message: expect.any(String) });
    expect(error.details).toContainEqual({ field: 'body.age', message: expect.any(String) });
    expect(error.details).toContainEqual({ field: 'params.id', message: expect.any(String) });
  });

  it('should forward non-Zod errors directly to next', async () => {
    const mockErrorSchema = {
      parseAsync: vi.fn().mockRejectedValue(new Error('Unknown schema error')),
    } as any;

    const middleware = validateRequest(mockErrorSchema);
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Unknown schema error');
  });
});
