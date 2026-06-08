import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiKeyAuth } from '../../src/middleware/api-key';
import { prisma } from '../../src/database/client';
import { extractApiKey } from '../../src/shared/http';
import { hashToken, constantTimeEquals } from '../../src/shared/ids';
import { UnauthorizedError, ForbiddenError } from '../../src/shared/errors';

vi.mock('../../src/database/client', () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../src/shared/http', () => ({
  extractApiKey: vi.fn(),
}));

vi.mock('../../src/shared/ids', () => ({
  hashToken: vi.fn((secret) => `hashed-${secret}`),
  constantTimeEquals: vi.fn((a, b) => a === b),
}));

describe('API Key Authentication Middleware', () => {
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

  it('should return UnauthorizedError if extractApiKey returns null', async () => {
    vi.mocked(extractApiKey).mockReturnValue(null);

    const middleware = apiKeyAuth();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/API key required/i);
  });

  it('should return UnauthorizedError if API key has invalid format (no dot)', async () => {
    vi.mocked(extractApiKey).mockReturnValue('invalidFormatKey');

    const middleware = apiKeyAuth();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/Malformed API key/i);
  });

  it('should return UnauthorizedError if API key is not found in database', async () => {
    vi.mocked(extractApiKey).mockReturnValue('prefix.secret');
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null);

    const middleware = apiKeyAuth();
    await middleware(req, res, next);

    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { prefix: 'prefix' },
      include: { user: true },
    });
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/Invalid API key/i);
  });

  it('should return UnauthorizedError if API key status is not ACTIVE', async () => {
    vi.mocked(extractApiKey).mockReturnValue('prefix.secret');
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: 'ak1',
      status: 'REVOKED',
    } as any);

    const middleware = apiKeyAuth();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/Invalid API key/i);
  });

  it('should return UnauthorizedError if API key has expired', async () => {
    vi.mocked(extractApiKey).mockReturnValue('prefix.secret');
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: 'ak1',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 10000), // in the past
    } as any);

    const middleware = apiKeyAuth();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/expired/i);
  });

  it('should return UnauthorizedError if secret hash does not match', async () => {
    vi.mocked(extractApiKey).mockReturnValue('prefix.wrong_secret');
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: 'ak1',
      status: 'ACTIVE',
      expiresAt: null,
      hashedKey: 'hashed-secret', // expected hashed-secret
    } as any);

    // hashToken returns 'hashed-wrong_secret', which won't match
    const middleware = apiKeyAuth();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error.message).toMatch(/Invalid API key/i);
  });

  it('should return ForbiddenError if scope is required and key does not contain it', async () => {
    vi.mocked(extractApiKey).mockReturnValue('prefix.secret');
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: 'ak1',
      status: 'ACTIVE',
      expiresAt: null,
      hashedKey: 'hashed-secret',
      scopes: ['read:tasks'],
    } as any);

    const middleware = apiKeyAuth('write:tasks');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toMatch(/missing required scope/i);
  });

  it('should authorize if exact scope matches', async () => {
    vi.mocked(extractApiKey).mockReturnValue('prefix.secret');
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: 'ak1',
      status: 'ACTIVE',
      expiresAt: null,
      hashedKey: 'hashed-secret',
      scopes: ['write:tasks'],
      userId: 'u123',
      organizationId: 'org456',
      user: { email: 'user@test.com', role: 'MEMBER' },
    } as any);
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any);

    const middleware = apiKeyAuth('write:tasks');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'u123', email: 'user@test.com', role: 'MEMBER' });
    expect(req.apiKeyId).toBe('ak1');
    expect(req.orgMember).toEqual({ orgId: 'org456', role: 'ADMIN' });
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: 'ak1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('should authorize if scope is wildcard (*)', async () => {
    vi.mocked(extractApiKey).mockReturnValue('prefix.secret');
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: 'ak1',
      status: 'ACTIVE',
      expiresAt: null,
      hashedKey: 'hashed-secret',
      scopes: ['*'],
      userId: 'u123',
      organizationId: 'org456',
      user: { email: 'user@test.com', role: 'MEMBER' },
    } as any);
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any);

    const middleware = apiKeyAuth('write:tasks');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
