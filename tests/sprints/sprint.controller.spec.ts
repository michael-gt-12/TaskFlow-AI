import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/sprints/sprint.service', () => ({
  SprintService: {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    getSummary: vi.fn(),
    update: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    assignTask: vi.fn(),
    removeTask: vi.fn(),
  },
}));

// Neutralise auth/validation/permission middleware so we can exercise the
// route handlers (the business logic) in isolation.
vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/validator', () => ({ validateRequest: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/permission', () => ({ checkCapability: () => (_req: any, _res: any, next: any) => next() }));

import { sprintRouter } from '../../src/sprints/sprint.controller';
import { SprintService } from '../../src/sprints/sprint.service';

/** Pull the final (business-logic) handler for a given method+path off the router stack. */
function handlerFor(method: string, path: string) {
  const layer = (sprintRouter as any).stack.find(
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

const sampleSprint = {
  id: 's1',
  projectId: 'p1',
  name: 'Sprint 1',
  goal: null,
  status: 'PLANNED',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-01-14T00:00:00.000Z'),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('sprint.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST / creates a sprint and responds 201', async () => {
    (SprintService.create as any).mockResolvedValue(sampleSprint);
    const req: any = { body: { projectId: 'p1', name: 'Sprint 1' }, user: { id: 'u1' } };
    const res = mockRes();
    const next = vi.fn();
    await handlerFor('post', '/')(req, res, next);
    expect(SprintService.create).toHaveBeenCalledWith('u1', req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('GET / lists sprints for a project with pagination + status', async () => {
    (SprintService.list as any).mockResolvedValue({ data: [sampleSprint], meta: { totalCount: 1 } });
    const req: any = { query: { projectId: 'p1', page: '2', pageSize: '10', status: 'ACTIVE' } };
    const res = mockRes();
    await handlerFor('get', '/')(req, res, vi.fn());
    expect(SprintService.list).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ page: 2, pageSize: 10, status: 'ACTIVE' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('GET / forwards a BadRequestError to next when projectId is missing', async () => {
    const req: any = { query: {} };
    const next = vi.fn();
    await handlerFor('get', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(SprintService.list).not.toHaveBeenCalled();
  });

  it('GET /:sprintId returns the dto', async () => {
    (SprintService.getById as any).mockResolvedValue(sampleSprint);
    const req: any = { params: { sprintId: 's1' } };
    const res = mockRes();
    await handlerFor('get', '/:sprintId')(req, res, vi.fn());
    expect(SprintService.getById).toHaveBeenCalledWith('s1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('GET /:sprintId/summary returns the summary dto', async () => {
    (SprintService.getSummary as any).mockResolvedValue({
      sprint: sampleSprint,
      stats: {
        totalTasks: 4,
        completedTasks: 2,
        tasksByStatus: { DONE: 2, TODO: 2 },
        storyPoints: { total: 10, completed: 5 },
      },
    });
    const req: any = { params: { sprintId: 's1' } };
    const res = mockRes();
    await handlerFor('get', '/:sprintId/summary')(req, res, vi.fn());
    expect(SprintService.getSummary).toHaveBeenCalledWith('s1');
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.stats.completionRate).toBe(0.5);
  });

  it('PATCH /:sprintId updates a sprint', async () => {
    (SprintService.update as any).mockResolvedValue(sampleSprint);
    const req: any = { params: { sprintId: 's1' }, body: { name: 'New' } };
    const res = mockRes();
    await handlerFor('patch', '/:sprintId')(req, res, vi.fn());
    expect(SprintService.update).toHaveBeenCalledWith('s1', { name: 'New' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('POST /:sprintId/start starts a sprint', async () => {
    (SprintService.start as any).mockResolvedValue(sampleSprint);
    const req: any = { params: { sprintId: 's1' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('post', '/:sprintId/start')(req, res, vi.fn());
    expect(SprintService.start).toHaveBeenCalledWith('s1', 'u1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('POST /:sprintId/complete completes a sprint and passes the roll-over target', async () => {
    (SprintService.complete as any).mockResolvedValue(sampleSprint);
    const req: any = {
      params: { sprintId: 's1' },
      body: { moveUnfinishedToSprintId: 's2' },
      user: { id: 'u1' },
    };
    const res = mockRes();
    await handlerFor('post', '/:sprintId/complete')(req, res, vi.fn());
    expect(SprintService.complete).toHaveBeenCalledWith('s1', 'u1', 's2');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('POST /:sprintId/cancel cancels a sprint', async () => {
    (SprintService.cancel as any).mockResolvedValue(sampleSprint);
    const req: any = { params: { sprintId: 's1' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('post', '/:sprintId/cancel')(req, res, vi.fn());
    expect(SprintService.cancel).toHaveBeenCalledWith('s1', 'u1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('POST /:sprintId/tasks assigns a task and responds 201', async () => {
    (SprintService.assignTask as any).mockResolvedValue(undefined);
    const req: any = { params: { sprintId: 's1' }, body: { taskId: 't1' } };
    const res = mockRes();
    await handlerFor('post', '/:sprintId/tasks')(req, res, vi.fn());
    expect(SprintService.assignTask).toHaveBeenCalledWith('s1', 't1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { ok: true } }));
  });

  it('DELETE /:sprintId/tasks/:taskId removes a task and responds 204', async () => {
    (SprintService.removeTask as any).mockResolvedValue(undefined);
    const req: any = { params: { sprintId: 's1', taskId: 't1' } };
    const res = mockRes();
    await handlerFor('delete', '/:sprintId/tasks/:taskId')(req, res, vi.fn());
    expect(SprintService.removeTask).toHaveBeenCalledWith('s1', 't1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it('forwards service errors to next()', async () => {
    const boom = new Error('boom');
    (SprintService.create as any).mockRejectedValue(boom);
    const req: any = { body: { projectId: 'p1', name: 'Sprint 1' }, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('post', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('POST /:sprintId/tasks forwards assignTask errors to next()', async () => {
    const boom = new Error('assign failed');
    (SprintService.assignTask as any).mockRejectedValue(boom);
    const req: any = { params: { sprintId: 's1' }, body: { taskId: 't1' } };
    const next = vi.fn();
    await handlerFor('post', '/:sprintId/tasks')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('DELETE /:sprintId/tasks/:taskId forwards removeTask errors to next()', async () => {
    const boom = new Error('remove failed');
    (SprintService.removeTask as any).mockRejectedValue(boom);
    const req: any = { params: { sprintId: 's1', taskId: 't1' } };
    const next = vi.fn();
    await handlerFor('delete', '/:sprintId/tasks/:taskId')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards errors from the remaining handlers to next()', async () => {
    const boom = new Error('kaboom');
    const cases: Array<[string, string, any]> = [
      ['get', '/:sprintId', { params: { sprintId: 's1' } }],
      ['get', '/:sprintId/summary', { params: { sprintId: 's1' } }],
      ['patch', '/:sprintId', { params: { sprintId: 's1' }, body: {} }],
      ['post', '/:sprintId/start', { params: { sprintId: 's1' }, user: { id: 'u1' } }],
      ['post', '/:sprintId/complete', { params: { sprintId: 's1' }, body: {}, user: { id: 'u1' } }],
      ['post', '/:sprintId/cancel', { params: { sprintId: 's1' }, user: { id: 'u1' } }],
    ];
    (SprintService.getById as any).mockRejectedValue(boom);
    (SprintService.getSummary as any).mockRejectedValue(boom);
    (SprintService.update as any).mockRejectedValue(boom);
    (SprintService.start as any).mockRejectedValue(boom);
    (SprintService.complete as any).mockRejectedValue(boom);
    (SprintService.cancel as any).mockRejectedValue(boom);
    for (const [method, path, req] of cases) {
      const next = vi.fn();
      await handlerFor(method, path)(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith(boom);
    }
  });
});
