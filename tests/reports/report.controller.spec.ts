import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/reports/report.service', () => ({
  ReportService: {
    exportProjectTasksToCSV: vi.fn(),
    exportOrganizationSummary: vi.fn(),
  },
}));

vi.mock('../../src/middleware/auth', () => ({ authenticate: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../src/middleware/permission', () => ({ checkOrgPermission: () => (_req: any, _res: any, next: any) => next() }));

import { reportRouter } from '../../src/reports/report.controller';
import { ReportService } from '../../src/reports/report.service';

function handlerFor(method: string, path: string) {
  const layer = (reportRouter as any).stack.find(
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
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

describe('report.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /project/:projectId/csv streams CSV with attachment headers', async () => {
    (ReportService.exportProjectTasksToCSV as any).mockResolvedValue('id,name\n1,A');
    const req: any = { params: { projectId: 'p1' } };
    const res = mockRes();
    await handlerFor('get', '/project/:projectId/csv')(req, res, vi.fn());
    expect(ReportService.exportProjectTasksToCSV).toHaveBeenCalledWith('p1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('project_p1_tasks.csv')
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('id,name\n1,A');
  });

  it('GET /project/:projectId/csv forwards errors to next()', async () => {
    const boom = new Error('no project');
    (ReportService.exportProjectTasksToCSV as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('get', '/project/:projectId/csv')({ params: { projectId: 'p1' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  it('GET /org/:orgId/summary returns the JSON summary', async () => {
    const summary = { totalProjects: 3 };
    (ReportService.exportOrganizationSummary as any).mockResolvedValue(summary);
    const res = mockRes();
    await handlerFor('get', '/org/:orgId/summary')({ params: { orgId: 'org1' } }, res, vi.fn());
    expect(ReportService.exportOrganizationSummary).toHaveBeenCalledWith('org1');
    expect(res.json).toHaveBeenCalledWith(summary);
  });

  it('GET /org/:orgId/summary forwards errors to next()', async () => {
    const boom = new Error('nope');
    (ReportService.exportOrganizationSummary as any).mockRejectedValue(boom);
    const next = vi.fn();
    await handlerFor('get', '/org/:orgId/summary')({ params: { orgId: 'org1' } }, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
