import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/projects/project.service', () => ({
  ProjectService: {
    create: vi.fn(),
    list: vi.fn(),
    getDetail: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    softDelete: vi.fn(),
    transferLead: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  },
}));

// Neutralise auth/validation/permission middleware so we can exercise the
// route handlers (the business logic) in isolation.
vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/validator', () => ({ validateRequest: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/permission', () => ({ checkCapability: () => (_req: any, _res: any, next: any) => next() }));

import { projectRouter } from '../../src/projects/project.controller';
import { ProjectService } from '../../src/projects/project.service';

/** Pull the final (business-logic) handler for a given method+path off the router stack. */
function handlerFor(method: string, path: string) {
  const layer = (projectRouter as any).stack.find(
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
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

const sampleProject = {
  id: 'p1',
  organizationId: 'org1',
  key: 'ALP',
  name: 'Alpha',
  description: null,
  color: '#fff',
  isArchived: false,
  archivedAt: null,
  leadId: 'u1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('project.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST / creates a project and responds 201', async () => {
    (ProjectService.create as any).mockResolvedValue(sampleProject);
    const req: any = { body: { orgId: 'org1', name: 'Alpha' }, user: { id: 'u1' } };
    const res = mockRes();
    const next = vi.fn();
    await handlerFor('post', '/')(req, res, next);
    expect(ProjectService.create).toHaveBeenCalledWith('org1', 'u1', req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('GET / lists projects with pagination + filters', async () => {
    (ProjectService.list as any).mockResolvedValue({ data: [sampleProject], meta: { totalCount: 1 } });
    const req: any = {
      orgMember: { orgId: 'org1' },
      query: { page: '1', includeArchived: 'true', search: 'a', leadId: 'u1' },
    };
    const res = mockRes();
    await handlerFor('get', '/')(req, res, vi.fn());
    expect(ProjectService.list).toHaveBeenCalledWith(
      'org1',
      expect.objectContaining({ includeArchived: true, search: 'a', leadId: 'u1' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('GET /:projectId returns the detail dto', async () => {
    (ProjectService.getDetail as any).mockResolvedValue(sampleProject);
    const req: any = { params: { projectId: 'p1' } };
    const res = mockRes();
    await handlerFor('get', '/:projectId')(req, res, vi.fn());
    expect(ProjectService.getDetail).toHaveBeenCalledWith('p1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('PATCH /:projectId updates a project', async () => {
    (ProjectService.update as any).mockResolvedValue(sampleProject);
    const req: any = { params: { projectId: 'p1' }, body: { name: 'New' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('patch', '/:projectId')(req, res, vi.fn());
    expect(ProjectService.update).toHaveBeenCalledWith('p1', 'u1', { name: 'New' });
  });

  it('POST /:projectId/archive archives', async () => {
    (ProjectService.archive as any).mockResolvedValue(sampleProject);
    const req: any = { params: { projectId: 'p1' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('post', '/:projectId/archive')(req, res, vi.fn());
    expect(ProjectService.archive).toHaveBeenCalledWith('p1', 'u1');
  });

  it('POST /:projectId/restore restores', async () => {
    (ProjectService.restore as any).mockResolvedValue(sampleProject);
    const req: any = { params: { projectId: 'p1' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('post', '/:projectId/restore')(req, res, vi.fn());
    expect(ProjectService.restore).toHaveBeenCalledWith('p1', 'u1');
  });

  it('DELETE /:projectId soft-deletes and responds 204', async () => {
    (ProjectService.softDelete as any).mockResolvedValue(undefined);
    const req: any = { params: { projectId: 'p1' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('delete', '/:projectId')(req, res, vi.fn());
    expect(ProjectService.softDelete).toHaveBeenCalledWith('p1', 'u1');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('POST /:projectId/transfer-lead transfers leadership', async () => {
    (ProjectService.transferLead as any).mockResolvedValue(sampleProject);
    const req: any = { params: { projectId: 'p1' }, body: { newLeadId: 'u2' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('post', '/:projectId/transfer-lead')(req, res, vi.fn());
    expect(ProjectService.transferLead).toHaveBeenCalledWith('p1', 'u1', 'u2');
  });

  it('GET /:projectId/members lists members', async () => {
    (ProjectService.listMembers as any).mockResolvedValue([{ userId: 'u1' }]);
    const req: any = { params: { projectId: 'p1' } };
    const res = mockRes();
    await handlerFor('get', '/:projectId/members')(req, res, vi.fn());
    expect(ProjectService.listMembers).toHaveBeenCalledWith('p1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('POST /:projectId/members adds a member with default role', async () => {
    (ProjectService.addMember as any).mockResolvedValue(undefined);
    const req: any = { params: { projectId: 'p1' }, body: { userId: 'u2' } };
    const res = mockRes();
    await handlerFor('post', '/:projectId/members')(req, res, vi.fn());
    expect(ProjectService.addMember).toHaveBeenCalledWith('p1', 'u2', 'CONTRIBUTOR');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('DELETE /:projectId/members/:userId removes a member', async () => {
    (ProjectService.removeMember as any).mockResolvedValue(undefined);
    const req: any = { params: { projectId: 'p1', userId: 'u2' } };
    const res = mockRes();
    await handlerFor('delete', '/:projectId/members/:userId')(req, res, vi.fn());
    expect(ProjectService.removeMember).toHaveBeenCalledWith('p1', 'u2');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('forwards service errors to next()', async () => {
    const boom = new Error('boom');
    (ProjectService.create as any).mockRejectedValue(boom);
    const req: any = { body: { orgId: 'org1', name: 'Alpha' }, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('post', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
