import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authenticate } from '../../src/middleware/auth';
import { CryptoUtils } from '../../src/utils/crypto';
import { UnauthorizedError } from '../../src/shared/errors';

vi.mock('../../src/utils/crypto', () => ({
  CryptoUtils: {
    verifyToken: vi.fn(),
  },
}));

describe('Authentication Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      headers: {},
    };
    res = {};
    next = vi.fn();
  });

  it('should call next with UnauthorizedError if Authorization header is missing', () => {
    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/missing or malformed/i);
  });

  it('should call next with UnauthorizedError if Authorization header is not Bearer', () => {
    req.headers.authorization = 'Basic credentials';
    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/missing or malformed/i);
  });

  it('should attach user payload to req.user and call next on success', () => {
    const mockPayload = { id: 'u1', email: 'test@example.com', role: 'USER' };
    req.headers.authorization = 'Bearer valid-jwt-token';
    vi.mocked(CryptoUtils.verifyToken).mockReturnValue(mockPayload as any);

    authenticate(req, res, next);

    expect(CryptoUtils.verifyToken).toHaveBeenCalledWith('valid-jwt-token');
    expect(req.user).toEqual(mockPayload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no arguments
  });

  it('should pass validation errors to next if token verification fails', () => {
    req.headers.authorization = 'Bearer invalid-jwt-token';
    const mockError = new Error('Token expired');
    vi.mocked(CryptoUtils.verifyToken).mockImplementation(() => {
      throw mockError;
    });

    authenticate(req, res, next);

    expect(CryptoUtils.verifyToken).toHaveBeenCalledWith('invalid-jwt-token');
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(mockError);
  });
});
