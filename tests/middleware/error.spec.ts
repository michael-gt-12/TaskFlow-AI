import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorHandler } from '../../src/middleware/error';
import { AppError, BadRequestError } from '../../src/shared/errors';
import { logger } from '../../src/shared/logger';

vi.mock('../../src/shared/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should handle AppError and send custom response structure', () => {
    const error = new BadRequestError('Validation failed', [{ field: 'email', message: 'invalid' }]);

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      code: 'BAD_REQUEST',
      message: 'Validation failed',
      details: [{ field: 'email', message: 'invalid' }],
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should handle general Error, log it, and send 500 internal server error', () => {
    const error = new Error('Database connection lost');

    errorHandler(error, req, res, next);

    expect(logger.error).toHaveBeenCalledWith('Unhandled Server Exception:', error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred on the server',
    });
  });
});
