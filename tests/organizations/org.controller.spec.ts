import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/organizations/org.service', () => ({
  OrgService: {
    create: vi.fn(),
    getById: vi.fn(),
    inviteMember: vi.fn(),
  },
}));

vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/validator', () => ({ validateRequest: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/permission', () => ({ checkOrgRole: () => (_req: any, _res: any, next: any) => next() }));

import { orgRouter } from '../../src/organizations/org.controller';
import { OrgService } from '../../src/organizations/org.service';

function handlerFor(method: string, path: string) {
  const layer = (orgRouter as any).stack.find(
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

describe('org.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST / creates an organization and responds 201', async () => {
    const org = { id: 'org1', name: 'Acme', slug: 'acme' };
    (OrgService.create as any).mockResolvedValue(org);
    const req: any = { body: { name: 'Acme', slug: 'acme' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('post', '/')(req, res, vi.fn());
    expect(OrgService.create).toHaveBeenCalledWith('u1', req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(org);
  });

  it('GET /:orgId returns the organization', async () => {
    const org = { id: 'org1', name: 'Acme' };
    (OrgService.getById as any).mockResolvedValue(org);
    const req: any = { params: { orgId: 'org1' } };
    const res = mockRes();
    await handlerFor('get', '/:orgId')(req, res, vi.fn());
    expect(OrgService.getById).toHaveBeenCalledWith('org1');
    expect(res.json).toHaveBeenCalledWith(org);
  });

  it('POST /:orgId/invite invites a member and responds 200', async () => {
    const member = { id: 'm1', userId: 'u2', role: 'MEMBER' };
    (OrgService.inviteMember as any).mockResolvedValue(member);
    const req: any = {
      params: { orgId: 'org1' },
      user: { id: 'u1' },
      body: { email: 'u2@b.com', role: 'MEMBER' },
    };
    const res = mockRes();
    await handlerFor('post', '/:orgId/invite')(req, res, vi.fn());
    expect(OrgService.inviteMember).toHaveBeenCalledWith('org1', 'u1', 'u2@b.com', 'MEMBER');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(member);
  });

  it('forwards service errors to next()', async () => {
    const boom = new Error('boom');
    (OrgService.create as any).mockRejectedValue(boom);
    const req: any = { body: { name: 'Acme', slug: 'acme' }, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('post', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards getById errors to next()', async () => {
    const boom = new Error('nope');
    (OrgService.getById as any).mockRejectedValue(boom);
    const req: any = { params: { orgId: 'org1' } };
    const next = vi.fn();
    await handlerFor('get', '/:orgId')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
