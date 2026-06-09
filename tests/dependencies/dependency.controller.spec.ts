import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/dependencies/dependency.service', () => ({
  DependencyService: {
    create: vi.fn(),
    listForTask: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../src/middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../src/middleware/validator', () => ({
  validateRequest: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../src/middleware/permission', () => ({
  checkCapability: () => (_req: any, _res: any, next: any) => next(),
}));

import { dependencyRouter } from '../../src/dependencies/dependency.controller';
import { DependencyService } from '../../src/dependencies/dependency.service';

function handlerFor(method: string, path: string) {
  const layer = (dependencyRouter as any).stack.find(
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

const sampleDependency = {
  id: 'd1',
  sourceTaskId: 't1',
  targetTaskId: 't2',
  type: 'BLOCKS',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('dependency.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST / creates a dependency for the authenticated user and responds 201', async () => {
    (DependencyService.create as any).mockResolvedValue(sampleDependency);
    const req: any = { body: { sourceTaskId: 't1', targetTaskId: 't2' }, user: { id: 'u1' } };
    const res = mockRes();
    const next = vi.fn();
    await handlerFor('post', '/')(req, res, next);
    expect(DependencyService.create).toHaveBeenCalledWith('u1', req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('GET /tasks/:taskId returns the dependency graph', async () => {
    (DependencyService.listForTask as any).mockResolvedValue({
      taskId: 't1',
      outgoing: [],
      incoming: [],
    });
    const req: any = { params: { taskId: 't1' } };
    const res = mockRes();
    await handlerFor('get', '/tasks/:taskId')(req, res, vi.fn());
    expect(DependencyService.listForTask).toHaveBeenCalledWith('t1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('DELETE /:dependencyId removes a dependency and responds 204', async () => {
    (DependencyService.remove as any).mockResolvedValue(undefined);
    const req: any = { params: { dependencyId: 'd1' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('delete', '/:dependencyId')(req, res, vi.fn());
    expect(DependencyService.remove).toHaveBeenCalledWith('d1', 'u1');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('forwards service errors to next()', async () => {
    const boom = new Error('boom');
    (DependencyService.create as any).mockRejectedValue(boom);
    const req: any = { body: { sourceTaskId: 't1', targetTaskId: 't2' }, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('post', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards listForTask errors to next()', async () => {
    const boom = new Error('boom');
    (DependencyService.listForTask as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('get', '/tasks/:taskId')({ params: { taskId: 't1' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards remove errors to next()', async () => {
    const boom = new Error('boom');
    (DependencyService.remove as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('delete', '/:dependencyId')(
      { params: { dependencyId: 'd1' }, user: { id: 'u1' } },
      mockRes(),
      next
    );
    expect(next).toHaveBeenCalledWith(boom);
  });
});
