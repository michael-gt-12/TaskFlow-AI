import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/analytics/analytics.service', () => ({
  AnalyticsService: { getProjectSummary: vi.fn() },
}));

vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));

import { analyticsRouter } from '../../src/analytics/analytics.controller';
import { AnalyticsService } from '../../src/analytics/analytics.service';

function handlerFor(method: string, path: string) {
  const layer = (analyticsRouter as any).stack.find(
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

describe('analytics.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /project/:projectId returns the project summary', async () => {
    const summary = { total: 10, done: 4 };
    (AnalyticsService.getProjectSummary as any).mockResolvedValue(summary);
    const req: any = { params: { projectId: 'p1' } };
    const res = mockRes();
    await handlerFor('get', '/project/:projectId')(req, res, vi.fn());
    expect(AnalyticsService.getProjectSummary).toHaveBeenCalledWith('p1');
    expect(res.json).toHaveBeenCalledWith(summary);
  });

  it('forwards errors to next()', async () => {
    const boom = new Error('no project');
    (AnalyticsService.getProjectSummary as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('get', '/project/:projectId')({ params: { projectId: 'p1' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
