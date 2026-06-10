import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/tasks/task.service', () => ({
  TaskService: {
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
  },
}));

// Neutralise auth/validation/permission middleware so we can exercise the
// route handlers (the business logic) in isolation.
vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/validator', () => ({ validateRequest: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/permission', () => ({ checkOrgRole: () => (_req: any, _res: any, next: any) => next() }));

import { taskRouter } from '../../src/tasks/task.controller';
import { TaskService } from '../../src/tasks/task.service';

/** Pull the final (business-logic) handler for a given method+path off the router stack. */
function handlerFor(method: string, path: string) {
  const layer = (taskRouter as any).stack.find(
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

const sampleTask = { id: 't1', title: 'Task', projectId: 'p1' };

describe('task.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST / creates a task and responds 201, passing orgId from body', async () => {
    (TaskService.create as any).mockResolvedValue(sampleTask);
    const req: any = { body: { title: 'Task', projectId: 'p1', orgId: 'org1' }, user: { id: 'u1' } };
    const res = mockRes();
    const next = vi.fn();
    await handlerFor('post', '/')(req, res, next);
    expect(TaskService.create).toHaveBeenCalledWith('u1', 'org1', req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(sampleTask);
    expect(next).not.toHaveBeenCalled();
  });

  it('POST / defaults orgId to an empty string when absent', async () => {
    (TaskService.create as any).mockResolvedValue(sampleTask);
    const req: any = { body: { title: 'Task', projectId: 'p1' }, user: { id: 'u1' } };
    await handlerFor('post', '/')(req, mockRes(), vi.fn());
    expect(TaskService.create).toHaveBeenCalledWith('u1', '', req.body);
  });

  it('POST / forwards service errors to next()', async () => {
    const boom = new Error('boom');
    (TaskService.create as any).mockRejectedValue(boom);
    const req: any = { body: { title: 'Task' }, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('post', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('GET /:taskId returns the task', async () => {
    (TaskService.getById as any).mockResolvedValue(sampleTask);
    const req: any = { params: { taskId: 't1' } };
    const res = mockRes();
    await handlerFor('get', '/:taskId')(req, res, vi.fn());
    expect(TaskService.getById).toHaveBeenCalledWith('t1');
    expect(res.json).toHaveBeenCalledWith(sampleTask);
  });

  it('GET /:taskId forwards errors to next()', async () => {
    const boom = new Error('not found');
    (TaskService.getById as any).mockRejectedValue(boom);
    const req: any = { params: { taskId: 't1' } };
    const next = vi.fn();
    await handlerFor('get', '/:taskId')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('PUT /:taskId updates a task and passes orgId from body', async () => {
    (TaskService.update as any).mockResolvedValue(sampleTask);
    const req: any = {
      params: { taskId: 't1' },
      body: { title: 'New', orgId: 'org1' },
      user: { id: 'u1' },
    };
    const res = mockRes();
    await handlerFor('put', '/:taskId')(req, res, vi.fn());
    expect(TaskService.update).toHaveBeenCalledWith('t1', 'u1', 'org1', req.body);
    expect(res.json).toHaveBeenCalledWith(sampleTask);
  });

  it('PUT /:taskId defaults orgId to an empty string when absent', async () => {
    (TaskService.update as any).mockResolvedValue(sampleTask);
    const req: any = { params: { taskId: 't1' }, body: { title: 'New' }, user: { id: 'u1' } };
    await handlerFor('put', '/:taskId')(req, mockRes(), vi.fn());
    expect(TaskService.update).toHaveBeenCalledWith('t1', 'u1', '', req.body);
  });

  it('PUT /:taskId forwards errors to next()', async () => {
    const boom = new Error('update boom');
    (TaskService.update as any).mockRejectedValue(boom);
    const req: any = { params: { taskId: 't1' }, body: {}, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('put', '/:taskId')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
