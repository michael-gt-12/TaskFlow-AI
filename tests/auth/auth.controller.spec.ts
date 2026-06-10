import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/auth/auth.service', () => ({
  AuthService: {
    register: vi.fn(),
    login: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

vi.mock('../../src/middleware/validator', () => ({ validateRequest: () => (_req: any, _res: any, next: any) => next() }));

import { authRouter } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';

function handlerFor(method: string, path: string) {
  const layer = (authRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`no route ${method} ${path}`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const tokens = { accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } };

describe('auth.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /register creates a user and responds 201', async () => {
    (AuthService.register as any).mockResolvedValue(tokens);
    const req: any = { body: { email: 'a@b.com', password: 'longenough', name: 'Al' } };
    const res = mockRes();
    await handlerFor('post', '/register')(req, res, vi.fn());
    expect(AuthService.register).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(tokens);
  });

  it('POST /login returns tokens', async () => {
    (AuthService.login as any).mockResolvedValue(tokens);
    const req: any = { body: { email: 'a@b.com', password: 'x' } };
    const res = mockRes();
    await handlerFor('post', '/login')(req, res, vi.fn());
    expect(AuthService.login).toHaveBeenCalledWith(req.body);
    expect(res.json).toHaveBeenCalledWith(tokens);
  });

  it('POST /refresh exchanges the refresh token', async () => {
    (AuthService.refreshToken as any).mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });
    const req: any = { body: { refreshToken: 'r' } };
    const res = mockRes();
    await handlerFor('post', '/refresh')(req, res, vi.fn());
    expect(AuthService.refreshToken).toHaveBeenCalledWith('r');
    expect(res.json).toHaveBeenCalledWith({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('forwards register errors to next()', async () => {
    const boom = new Error('email taken');
    (AuthService.register as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('post', '/register')({ body: {} }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards login errors to next()', async () => {
    const boom = new Error('bad creds');
    (AuthService.login as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('post', '/login')({ body: {} }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards refresh errors to next()', async () => {
    const boom = new Error('bad token');
    (AuthService.refreshToken as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('post', '/refresh')({ body: { refreshToken: 'x' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
