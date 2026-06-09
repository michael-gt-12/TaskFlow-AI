import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/milestones/milestone.service', () => ({
  MilestoneService: {
    create: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    getSummary: vi.fn(),
    update: vi.fn(),
    markReached: vi.fn(),
    markMissed: vi.fn(),
    reopen: vi.fn(),
    assignTask: vi.fn(),
    removeTask: vi.fn(),
  },
}));

vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/validator', () => ({ validateRequest: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/permission', () => ({ checkCapability: () => (_req: any, _res: any, next: any) => next() }));

import { milestoneRouter } from '../../src/milestones/milestone.controller';
import { MilestoneService } from '../../src/milestones/milestone.service';

function handlerFor(method: string, path: string) {
  const layer = (milestoneRouter as any).stack.find(
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

const sampleMilestone = {
  id: 'm1',
  projectId: 'p1',
  name: 'v1.0',
  description: null,
  status: 'OPEN',
  dueDate: new Date('2026-02-01T00:00:00.000Z'),
  reachedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('milestone.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST / creates a milestone and responds 201', async () => {
    (MilestoneService.create as any).mockResolvedValue(sampleMilestone);
    const req: any = { body: { projectId: 'p1', name: 'v1.0' }, user: { id: 'u1' } };
    const res = mockRes();
    const next = vi.fn();
    await handlerFor('post', '/')(req, res, next);
    expect(MilestoneService.create).toHaveBeenCalledWith('u1', req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('GET / lists milestones for a project with pagination + status', async () => {
    (MilestoneService.list as any).mockResolvedValue({ data: [sampleMilestone], meta: { totalCount: 1 } });
    const req: any = { query: { projectId: 'p1', page: '2', pageSize: '10', status: 'OPEN' } };
    const res = mockRes();
    await handlerFor('get', '/')(req, res, vi.fn());
    expect(MilestoneService.list).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ page: 2, pageSize: 10, status: 'OPEN' })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('GET / forwards a BadRequestError to next when projectId is missing', async () => {
    const req: any = { query: {} };
    const next = vi.fn();
    await handlerFor('get', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(MilestoneService.list).not.toHaveBeenCalled();
  });

  it('GET /:milestoneId returns the dto', async () => {
    (MilestoneService.getById as any).mockResolvedValue(sampleMilestone);
    const req: any = { params: { milestoneId: 'm1' } };
    const res = mockRes();
    await handlerFor('get', '/:milestoneId')(req, res, vi.fn());
    expect(MilestoneService.getById).toHaveBeenCalledWith('m1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('GET /:milestoneId/summary returns the summary dto', async () => {
    (MilestoneService.getSummary as any).mockResolvedValue({
      milestone: sampleMilestone,
      stats: {
        totalTasks: 4,
        completedTasks: 1,
        openTasks: 3,
        tasksByStatus: { DONE: 1, TODO: 3 },
      },
    });
    const req: any = { params: { milestoneId: 'm1' } };
    const res = mockRes();
    await handlerFor('get', '/:milestoneId/summary')(req, res, vi.fn());
    expect(MilestoneService.getSummary).toHaveBeenCalledWith('m1');
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.stats.completionRate).toBe(0.25);
  });

  it('PATCH /:milestoneId updates a milestone', async () => {
    (MilestoneService.update as any).mockResolvedValue(sampleMilestone);
    const req: any = { params: { milestoneId: 'm1' }, body: { name: 'New' } };
    const res = mockRes();
    await handlerFor('patch', '/:milestoneId')(req, res, vi.fn());
    expect(MilestoneService.update).toHaveBeenCalledWith('m1', { name: 'New' });
  });

  it('POST /:milestoneId/reach passes force=true when provided', async () => {
    (MilestoneService.markReached as any).mockResolvedValue(sampleMilestone);
    const req: any = { params: { milestoneId: 'm1' }, body: { force: true }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('post', '/:milestoneId/reach')(req, res, vi.fn());
    expect(MilestoneService.markReached).toHaveBeenCalledWith('m1', 'u1', true);
  });

  it('POST /:milestoneId/reach defaults force to false when absent', async () => {
    (MilestoneService.markReached as any).mockResolvedValue(sampleMilestone);
    const req: any = { params: { milestoneId: 'm1' }, body: {}, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('post', '/:milestoneId/reach')(req, res, vi.fn());
    expect(MilestoneService.markReached).toHaveBeenCalledWith('m1', 'u1', false);
  });

  it('POST /:milestoneId/miss marks a milestone missed', async () => {
    (MilestoneService.markMissed as any).mockResolvedValue(sampleMilestone);
    const req: any = { params: { milestoneId: 'm1' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('post', '/:milestoneId/miss')(req, res, vi.fn());
    expect(MilestoneService.markMissed).toHaveBeenCalledWith('m1', 'u1');
  });

  it('POST /:milestoneId/reopen reopens a milestone', async () => {
    (MilestoneService.reopen as any).mockResolvedValue(sampleMilestone);
    const req: any = { params: { milestoneId: 'm1' } };
    const res = mockRes();
    await handlerFor('post', '/:milestoneId/reopen')(req, res, vi.fn());
    expect(MilestoneService.reopen).toHaveBeenCalledWith('m1');
  });

  it('POST /:milestoneId/tasks assigns a task and responds 201', async () => {
    (MilestoneService.assignTask as any).mockResolvedValue(undefined);
    const req: any = { params: { milestoneId: 'm1' }, body: { taskId: 't1' } };
    const res = mockRes();
    await handlerFor('post', '/:milestoneId/tasks')(req, res, vi.fn());
    expect(MilestoneService.assignTask).toHaveBeenCalledWith('m1', 't1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { ok: true } }));
  });

  it('DELETE /:milestoneId/tasks/:taskId removes a task and responds 204', async () => {
    (MilestoneService.removeTask as any).mockResolvedValue(undefined);
    const req: any = { params: { milestoneId: 'm1', taskId: 't1' } };
    const res = mockRes();
    await handlerFor('delete', '/:milestoneId/tasks/:taskId')(req, res, vi.fn());
    expect(MilestoneService.removeTask).toHaveBeenCalledWith('m1', 't1');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('forwards service errors to next()', async () => {
    const boom = new Error('boom');
    (MilestoneService.create as any).mockRejectedValue(boom);
    const req: any = { body: { projectId: 'p1', name: 'v1.0' }, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('post', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('POST /:milestoneId/tasks forwards assignTask errors to next()', async () => {
    const boom = new Error('assign failed');
    (MilestoneService.assignTask as any).mockRejectedValue(boom);
    const req: any = { params: { milestoneId: 'm1' }, body: { taskId: 't1' } };
    const next = vi.fn();
    await handlerFor('post', '/:milestoneId/tasks')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('DELETE /:milestoneId/tasks/:taskId forwards removeTask errors to next()', async () => {
    const boom = new Error('remove failed');
    (MilestoneService.removeTask as any).mockRejectedValue(boom);
    const req: any = { params: { milestoneId: 'm1', taskId: 't1' } };
    const next = vi.fn();
    await handlerFor('delete', '/:milestoneId/tasks/:taskId')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('forwards errors from the remaining handlers to next()', async () => {
    const boom = new Error('kaboom');
    const cases: Array<[string, string, any]> = [
      ['get', '/:milestoneId', { params: { milestoneId: 'm1' } }],
      ['get', '/:milestoneId/summary', { params: { milestoneId: 'm1' } }],
      ['patch', '/:milestoneId', { params: { milestoneId: 'm1' }, body: {} }],
      ['post', '/:milestoneId/reach', { params: { milestoneId: 'm1' }, body: {}, user: { id: 'u1' } }],
      ['post', '/:milestoneId/miss', { params: { milestoneId: 'm1' }, user: { id: 'u1' } }],
      ['post', '/:milestoneId/reopen', { params: { milestoneId: 'm1' } }],
    ];
    (MilestoneService.getById as any).mockRejectedValue(boom);
    (MilestoneService.getSummary as any).mockRejectedValue(boom);
    (MilestoneService.update as any).mockRejectedValue(boom);
    (MilestoneService.markReached as any).mockRejectedValue(boom);
    (MilestoneService.markMissed as any).mockRejectedValue(boom);
    (MilestoneService.reopen as any).mockRejectedValue(boom);
    for (const [method, path, req] of cases) {
      const next = vi.fn();
      await handlerFor(method, path)(req, mockRes(), next);
      expect(next).toHaveBeenCalledWith(boom);
    }
  });
});
