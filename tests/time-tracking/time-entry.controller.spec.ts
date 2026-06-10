import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/time-tracking/time-entry.service', () => ({
  TimeEntryService: {
    log: vi.fn(),
    list: vi.fn(),
    getTaskSummary: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

// Neutralise auth/validation/permission middleware so we can exercise the
// route handlers (the business logic) in isolation.
vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/validator', () => ({ validateRequest: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/permission', () => ({ checkCapability: () => (_req: any, _res: any, next: any) => next() }));

import { timeEntryRouter } from '../../src/time-tracking/time-entry.controller';
import { TimeEntryService } from '../../src/time-tracking/time-entry.service';

/** Pull the final (business-logic) handler for a given method+path off the router stack. */
function handlerFor(method: string, path: string) {
  const layer = (timeEntryRouter as any).stack.find(
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

const sampleEntry = {
  id: 'e1',
  taskId: 't1',
  userId: 'u1',
  minutes: 90,
  description: 'work',
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  loggedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('time-entry.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST / logs a time entry and responds 201', async () => {
    (TimeEntryService.log as any).mockResolvedValue(sampleEntry);
    const req: any = { body: { taskId: 't1', minutes: 90 }, user: { id: 'u1' } };
    const res = mockRes();
    const next = vi.fn();
    await handlerFor('post', '/')(req, res, next);
    expect(TimeEntryService.log).toHaveBeenCalledWith('u1', req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('POST / forwards service errors to next()', async () => {
    const boom = new Error('boom');
    (TimeEntryService.log as any).mockRejectedValue(boom);
    const req: any = { body: { taskId: 't1', minutes: 90 }, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('post', '/')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('GET /tasks/:taskId lists entries with pagination + userId filter', async () => {
    (TimeEntryService.list as any).mockResolvedValue({
      data: [sampleEntry],
      meta: { page: 1, pageSize: 25, totalCount: 1 },
    });
    const req: any = {
      params: { taskId: 't1' },
      query: { page: '1', pageSize: '25', userId: 'u2' },
    };
    const res = mockRes();
    await handlerFor('get', '/tasks/:taskId')(req, res, vi.fn());
    expect(TimeEntryService.list).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't1', userId: 'u2', page: 1, pageSize: 25 })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('GET /tasks/:taskId forwards errors to next()', async () => {
    const boom = new Error('list boom');
    (TimeEntryService.list as any).mockRejectedValue(boom);
    const req: any = { params: { taskId: 't1' }, query: {} };
    const next = vi.fn();
    await handlerFor('get', '/tasks/:taskId')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('GET /tasks/:taskId/summary returns the summary dto', async () => {
    (TimeEntryService.getTaskSummary as any).mockResolvedValue({
      taskId: 't1',
      totalMinutes: 90,
      totalHours: 1.5,
      byUser: [{ userId: 'u1', minutes: 90 }],
    });
    const req: any = { params: { taskId: 't1' } };
    const res = mockRes();
    await handlerFor('get', '/tasks/:taskId/summary')(req, res, vi.fn());
    expect(TimeEntryService.getTaskSummary).toHaveBeenCalledWith('t1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('GET /tasks/:taskId/summary forwards errors to next()', async () => {
    const boom = new Error('summary boom');
    (TimeEntryService.getTaskSummary as any).mockRejectedValue(boom);
    const req: any = { params: { taskId: 't1' } };
    const next = vi.fn();
    await handlerFor('get', '/tasks/:taskId/summary')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('PATCH /:entryId updates an entry', async () => {
    (TimeEntryService.update as any).mockResolvedValue(sampleEntry);
    const req: any = { params: { entryId: 'e1' }, body: { minutes: 45 }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('patch', '/:entryId')(req, res, vi.fn());
    expect(TimeEntryService.update).toHaveBeenCalledWith('e1', 'u1', { minutes: 45 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('PATCH /:entryId forwards errors to next()', async () => {
    const boom = new Error('update boom');
    (TimeEntryService.update as any).mockRejectedValue(boom);
    const req: any = { params: { entryId: 'e1' }, body: {}, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('patch', '/:entryId')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('DELETE /:entryId removes an entry and responds 204', async () => {
    (TimeEntryService.remove as any).mockResolvedValue(undefined);
    const req: any = { params: { entryId: 'e1' }, user: { id: 'u1' } };
    const res = mockRes();
    await handlerFor('delete', '/:entryId')(req, res, vi.fn());
    expect(TimeEntryService.remove).toHaveBeenCalledWith('e1', 'u1');
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('DELETE /:entryId forwards errors to next()', async () => {
    const boom = new Error('delete boom');
    (TimeEntryService.remove as any).mockRejectedValue(boom);
    const req: any = { params: { entryId: 'e1' }, user: { id: 'u1' } };
    const next = vi.fn();
    await handlerFor('delete', '/:entryId')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
